// White dragon capture harness (gate G12b): stills, strips and side-by-sides beside render 08 from
// ?view=white-dragon, driven by a JSON manifest, for Robert to score on the brief's three questions
// (identity, fidelity, reachability).
//
//   node scripts/white-dragon-capture.mjs [--manifest scripts/white-dragon-capture.manifest.json]
//        [--out shots/white-dragon] [--base http://127.0.0.1:5421/] [--serve] [--only REGEX] [--list]
//
//   --serve   start `vite --port <port of --base> --strictPort` if nothing answers, stop it at the end
//   CHROMIUM_PATH  the browser to drive (on Robert's PC, Edge); SwiftShader unless --gpu
//
// Manifest: { defaults: { boot, size, settle }, items: [ { id, desc, stage, settle?, size?, compare?,
//   clip?: [x, y, w, h], strip?: { frames, step, cols? } } ] }. Each item re-stages the showcase with its query
// (window.__whiteDragon.restage: fresh dragons, the idle from rest), waits for the files, advances
// `settle` seconds in exact 1/30 s frames, and shoots. `compare` also writes <id>.compare.png with
// render 08 on the left at the same height. Strips shoot `frames` frames `step` seconds apart and
// assemble a labelled sheet.
//
// Output: <out>/<id>.png (strips: <out>/<id>/fNN.png and <id>.sheet.png), <out>/results.json with
// every file's SHA-256, size and staging, and <out>/index.md. The dragon files load from the dev
// server only (creatures/dragon/load.ts), so this needs `npm run dev`, never a build.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const manifestPath = opt('manifest', 'scripts/white-dragon-capture.manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const D = { boot: '?view=white-dragon&play=1&manual=1&quality=high&weather=clear&tod=0.66', size: '1280x720', settle: 3, ...manifest.defaults };
const base = opt('base', 'http://127.0.0.1:5421/');
const outDir = path.resolve(opt('out', 'shots/white-dragon'));
const only = opt('only') ? new RegExp(opt('only')) : null;
const items = manifest.items.filter((it) => !only || only.test(it.id));
const REFERENCE = path.resolve('docs/art/targets/08-sleek-dragon-elder.png');

if (flag('list')) {
  for (const it of items) console.log(`${it.id.padEnd(28)} ${it.strip ? 'strip' : 'still'}  ${it.stage}`);
  console.log(`${items.length} of ${manifest.items.length} items`);
  process.exit(0);
}

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function reachable(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

let server = null;
if (!(await reachable(base))) {
  if (!flag('serve')) {
    console.error(`Nothing answers at ${base}. Start the dev server (npx vite --port ${new URL(base).port} --strictPort) or pass --serve.`);
    process.exit(1);
  }
  server = spawn('npx', ['vite', '--port', new URL(base).port, '--strictPort', '--host', new URL(base).hostname], { stdio: 'ignore', shell: true });
  for (let i = 0; i < 120 && !(await reachable(base)); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await reachable(base))) throw new Error('dev server did not come up');
}
process.on('exit', () => server?.kill());

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: !flag('headful'),
  args: flag('gpu')
    ? ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--use-angle=default']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const sizeOf = (s) => s.split('x').map(Number);
const [W0, H0] = sizeOf(D.size);
const context = await browser.newContext({ viewport: { width: W0, height: H0 } });
const page = await context.newPage();
const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.setDefaultTimeout(300000);

const bootQuery = (stage) => {
  const q = new URLSearchParams(D.boot.replace(/^\?/, ''));
  for (const [k, v] of new URLSearchParams(stage)) q.set(k, v);
  return q;
};

console.log(`boot ${base}${D.boot}`);
await page.goto(`${base}${D.boot}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__dw?.ready === true, null, { timeout: 300000 });
// The HUD, banners and tutorial cards stay out of the pictures.
await page.addStyleTag({ content: '#ui, #boot { display: none !important; }' });

/** Re-stage the showcase, wait for the dragon files, then advance exactly `seconds` in 1/30 s frames. */
async function stage(query, seconds) {
  await page.evaluate((q) => window.__whiteDragon.restage(q), query);
  await page.waitForFunction(() => window.__whiteDragon?.ready === true, null, { timeout: 300000 });
  await advance(seconds);
}
async function advance(seconds) {
  let left = Math.round(seconds * 30);
  while (left > 0) {
    const n = Math.min(left, 15);
    await page.evaluate((k) => {
      for (let i = 0; i < k; i++) window.__dw.game.frame(1 / 30, false);
    }, n);
    left -= n;
  }
}
async function shoot(file, clip) {
  await page.evaluate(() => window.__dw.render());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, clip: clip ? { x: clip[0], y: clip[1], width: clip[2], height: clip[3] } : undefined });
}

/** Lay images out on a canvas in a scratch page and save it. */
async function compose(files, labels, cols, out, heightPx) {
  const imgs = files.map((f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
  const p2 = await context.newPage();
  const dataUrl = await p2.evaluate(
    async ({ imgs, labels, cols, heightPx }) => {
      const els = await Promise.all(
        imgs.map(
          (src) =>
            new Promise((res) => {
              const i = new Image();
              i.onload = () => res(i);
              i.src = src;
            }),
        ),
      );
      const h = heightPx;
      const ws = els.map((i) => Math.round((i.width * h) / i.height));
      const rows = Math.ceil(els.length / cols);
      const colW = Math.max(...ws);
      const c = document.createElement('canvas');
      c.width = cols === els.length ? ws.reduce((a, b) => a + b, 0) : colW * cols;
      c.height = rows * (h + 22);
      const g = c.getContext('2d');
      g.fillStyle = '#111';
      g.fillRect(0, 0, c.width, c.height);
      let x = 0;
      els.forEach((img, k) => {
        const r = Math.floor(k / cols);
        const cx = cols === els.length ? x : (k % cols) * colW;
        g.drawImage(img, cx, r * (h + 22) + 22, ws[k], h);
        g.fillStyle = '#eee';
        g.font = '15px sans-serif';
        g.fillText(labels[k] ?? '', cx + 6, r * (h + 22) + 16);
        x += ws[k];
      });
      return c.toDataURL('image/png');
    },
    { imgs, labels, cols, heightPx },
  );
  await p2.close();
  fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

fs.mkdirSync(outDir, { recursive: true });
const resultsPath = path.join(outDir, 'results.json');
const results = fs.existsSync(resultsPath) ? JSON.parse(fs.readFileSync(resultsPath, 'utf8')) : {};
const record = (it, files, extra = {}) => {
  results[it.id] = {
    id: it.id,
    desc: it.desc,
    stage: bootQuery(it.stage).toString(),
    settle: it.settle ?? D.settle,
    when: new Date().toISOString(),
    files: files.map((f) => ({ file: path.relative(outDir, f).replace(/\\/g, '/'), sha256: sha256(f), bytes: fs.statSync(f).size })),
    ...extra,
  };
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 1));
};

for (const it of items) {
  const size = it.size ?? D.size;
  const [w, h] = sizeOf(size);
  await page.setViewportSize({ width: w, height: h });
  const settle = it.settle ?? D.settle;
  const q = bootQuery(it.stage).toString();
  console.log(`${it.id}: ${q}`);
  await stage(q, settle);
  if (it.strip) {
    const dir = path.join(outDir, it.id);
    const frames = [];
    for (let k = 0; k < it.strip.frames; k++) {
      if (k > 0) await advance(it.strip.step);
      const f = path.join(dir, `f${String(k).padStart(2, '0')}.png`);
      await shoot(f);
      frames.push(f);
    }
    const sheet = path.join(outDir, `${it.id}.sheet.png`);
    await compose(frames, frames.map((_, k) => `t = ${(settle + k * it.strip.step).toFixed(2)} s`), it.strip.cols ?? 4, sheet, Math.round(h / 2));
    record(it, [...frames, sheet]);
  } else {
    const f = path.join(outDir, `${it.id}.png`);
    await shoot(f, it.clip);
    const files = [f];
    if (it.compare) {
      const c = path.join(outDir, `${it.id}.compare.png`);
      await compose([REFERENCE, f], ['render 08 (target)', `${it.id} (game, ${size})`], 2, c, h);
      files.push(c);
    }
    const stats = await page.evaluate(() => {
      const d = window.__whiteDragon?.dragons?.[0];
      return d ? { lod: d.lod, triangles: d.triangles(d.lod), hueShift: d.currentLook.hueShift } : null;
    });
    record(it, files, { dragon: stats });
  }
}

const errors = await page.evaluate(() => window.__dw.errors);
fs.writeFileSync(
  path.join(outDir, 'index.md'),
  [
    '# White dragon captures (G12b)',
    '',
    `Manifest: \`${manifestPath}\`. Boot: \`${D.boot}\`. Base: ${base}. Console errors: ${errors.length}.`,
    '',
    ...Object.values(results).map((r) => `- **${r.id}**: ${r.desc}\n  ${r.files.map((f) => `\`${f.file}\` (${f.sha256.slice(0, 12)}…)`).join(', ')}`),
    '',
  ].join('\n'),
);
for (const l of logs) console.log(l);
if (errors.length) console.log('errors:', errors);
console.log(`${items.length} items → ${outDir}`);
await browser.close();
process.exit(errors.length ? 1 : 0);
