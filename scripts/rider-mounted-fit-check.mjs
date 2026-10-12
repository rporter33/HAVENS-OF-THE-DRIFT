// Build first. Captures both sides of the actual saddle/rider after the mounted-fit correction.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';

const output = path.resolve(process.env.RIDER_FIT_OUTPUT ?? 'shots/mounted-fit-final');
await fs.mkdir(output, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 5188, strictPort: true } });
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const report = { renderer: 'production WebGL; Edge/SwiftShader; not hardware timing', captures: [], checks: [] };
const check = (name, ok) => { if (!ok) throw new Error(name); report.checks.push({ name, passed: true }); };
const poses = [
  ['ground', 'ground=1&speed=0'], ['glide', 'speed=40'],
  ['bank-left', 'lean=-.9&crouch=.25&speed=40'], ['bank-right', 'lean=.9&crouch=.25&speed=40'],
  ['dive', 'pitch=55&crouch=.8&speed=70'], ['brake', 'brace=1&speed=12'],
];

async function capture(name, params, gameplay = false) {
  const url = new URL('http://127.0.0.1:5188/');
  url.search = `view=rider&manual=1&quality=low&weather=clear&tod=.42&riderProof=aerie&real=1&dist=2.3&height=.23&camUp=.06&${params}`;
  if (gameplay) url.searchParams.delete('view');
  await page.goto(url.href, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => window.__dw?.ready, null, { timeout: 120000 });
  if (gameplay) await page.evaluate(() => {
    const h = window.__dw, g = h.game, spawn = g.world.layout.spawn.position;
    const at = g.player.foot.position.clone(); g.world.terrain.standingPoint(spawn[0] - 6, spawn[2] + 4, at);
    g.previewRiderLook({ ...g.save.data.rider, build: 'medium', outfit: 'flight', hair: 'ponytail', headgear: 'none', scarf: 'none', cape: 'none', outfitPrimary: '#F2EADA', outfitSecondary: '#7FA8C4' });
    g.player.teleport(at, 0, 'landed'); h.advance(1.5);
    const target = g.wyvern.saddle.getWorldPosition(at).add(at.clone().set(0, .23, 0));
    const angle = Number(new URLSearchParams(location.search).get('angle')) * Math.PI / 180;
    const position = target.clone().add(at.clone().set(Math.sin(angle) * 2.3, .138, Math.cos(angle) * 2.3));
    g.cameraRig.setOverride({ position, target }); h.render();
  });
  else await page.evaluate(() => { window.__dw.advance(1.5); window.__dw.render(); });
  const metrics = await page.evaluate(() => {
    const h = window.__dw, g = h.game, r = g.rider, w = g.wyvern, model = r.model, mesh = model.mesh;
    const inv = w.saddle.matrixWorld.clone().invert(), p = r.group.position.clone();
    const vertex = (m, i) => m.getVertexPosition(i, p.clone()).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
    const ranges = w.info.saddle.fitRanges, idx = w.skinnedMesh.geometry.index;
    const positions = mesh.geometry.attributes.position, si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
    const fit = ['L', 'R'].map((side, n) => {
      const sign = n === 0 ? 1 : -1;
      const indexOf = name => model.rig.bones.findIndex(b => b.name === name);
      const thigh = indexOf('thigh' + side), shin = indexOf('shin' + side), foot = indexOf('foot' + side);
      const range = ranges.flaps[n], flap = [];
      for (let i = 0; i < idx.count; i += 3) {
        const vi = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
        if (vi.every(v => v >= range[0] && v < range[1])) flap.push(vi.map(v => vertex(w.skinnedMesh, v)));
      }
      let gap = Infinity, samples = 0;
      for (let i = 0; i < positions.count; i++) {
        const s = model.rig.bindPos[thigh].y - positions.getY(i);
        let weight = 0;
        for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === thigh || si.getComponent(i, k) === shin) weight += sw.getComponent(i, k);
        if (sign * positions.getX(i) <= 0 || s < .36 || s > .72 || weight < .99) continue;
        const q = vertex(mesh, i);
        for (const [a, b, c] of flap) {
          const by = b.y - a.y, bz = b.z - a.z, cy = c.y - a.y, cz = c.z - a.z, det = by * cz - bz * cy;
          if (Math.abs(det) < 1e-9) continue;
          const u = ((q.y - a.y) * cz - (q.z - a.z) * cy) / det;
          const v = (by * (q.z - a.z) - bz * (q.y - a.y)) / det;
          if (u < -1e-5 || v < -1e-5 || u + v > 1.00001) continue;
          gap = Math.min(gap, sign * (q.x - a.x - u * (b.x - a.x) - v * (c.x - a.x))); samples++;
        }
      }
      const z = model.rig.dims.footLen * .32;
      const sole = model.rig.bones[foot].localToWorld(p.clone().set(-sign * .004 * z / .2, -model.rig.bindPos[foot].y, z));
      return { side, minKneeCalfFlapGap: gap, samples, soleToTreadCentre: sole.distanceTo(w.socket('stirrup' + side, p)) };
    });
    return { fit, mode: g.player.mode, proof: model.proof, mountW: r.ctx.mountW, errors: h.errors, stats: h.stats() };
  });
  check(`${name}: both knee/calf surfaces clear the actual flap`, metrics.fit.every(f => f.samples > 0 && f.minKneeCalfFlapGap > .005));
  check(`${name}: both soles supported on current stirrup sockets`, metrics.fit.every(f => f.soleToTreadCentre < .02));
  check(`${name}: no game errors`, metrics.errors.length === 0 && metrics.proof === 'aerie');
  if (gameplay) check(`${name}: actual landed simulation`, metrics.mode === 'landed');
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  report.captures.push({ name, url: url.href, kind: gameplay ? 'actual landed player simulation; inspection camera' : 'posed real-wyvern showcase', ...metrics });
  console.log(`PASS ${name}`);
}

try {
  for (const [pose, params] of poses) for (const [side, angle] of [['left', 90], ['right', 270]]) await capture(`${pose}-${side}`, `${params}&angle=${angle}`);
  await capture('tread-left-oblique', 'ground=1&speed=0&angle=45');
  await capture('tread-right-oblique', 'ground=1&speed=0&angle=315');
  await capture('gameplay-left', 'angle=90', true);
  await capture('gameplay-right', 'angle=270', true);
  check('browser page/console errors', errors.length === 0);
  await fs.writeFile(path.join(output, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mounted fit correction — both sides</title><style>body{margin:0;background:#182631;color:#faf8f3;font:16px/1.6 system-ui}header,main{max-width:1440px;margin:auto;padding:24px}h1{margin:0}a{color:#a8d4f0}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:20px}figure{margin:0;background:#263a47}img{width:100%;display:block}figcaption{padding:12px}@media(max-width:500px){main{grid-template-columns:1fr}}</style><header><h1>Mounted leg and stirrup correction</h1><p>Updated actual-engine renders from both sides. Costume, rig, animation and flight behavior are unchanged. Saddle flaps now turn inward beneath the legs; stirrup irons span across each foot with a flat tread at the unchanged socket.</p><p>${report.checks.length} production browser checks passed; 16 captures. Ground/glide/bank/dive/brake use the real-wyvern pose showcase. Gameplay views use actual landed player simulation with an inspection camera. Edge/SwiftShader is appearance evidence, not hardware timing. <a href="manifest.json">Exact queries and measured contacts</a></p></header><main>${report.captures.map(c => `<figure><a href="${c.name}.png"><img loading="lazy" src="${c.name}.png" alt="${c.name}"></a><figcaption>${c.name} · ${c.kind}</figcaption></figure>`).join('')}</main></html>`);
  console.log(`PASS ${report.checks.length} checks / ${report.captures.length} captures`);
} catch (e) { report.failure = String(e); throw e; }
finally {
  report.browserErrors = errors;
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(report, null, 2));
  await browser.close(); await new Promise(resolve => server.httpServer.close(resolve));
}
