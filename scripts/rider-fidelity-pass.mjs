// Matched, actual-engine iteration captures. Uses the already running isolated Vite server.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const pass = process.argv[2] ?? 'pass-1';
const output = path.resolve('shots/rider-fidelity', pass);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ ...(process.platform === 'win32' ? { channel: 'msedge' } : {}), headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = [], captures = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
try {
  for (const [name, query] of [
    ['front', 'riderProof=wanderer&angle=18&dist=2.55&height=.92'],
    ['face', 'riderProof=wanderer&focus=head&dist=.8&height=1.64&camUp=-.10&angle=12'],
    ['costume', 'riderProof=wanderer&angle=18&dist=1.35&height=1.2'],
    ['back', 'riderProof=wanderer&angle=170&dist=2.55&height=.92'],
    ['material', 'riderProof=wanderer&riderMaps=normal&angle=18&dist=.75&height=1.28'],
    ['mounted-left', 'riderProof=aerie&real=1&ground=1&angle=90&dist=2.7&height=.4&speed=0'],
    ['mounted-right', 'riderProof=aerie&real=1&ground=1&angle=270&dist=2.7&height=.4&speed=0'],
    ['wave', 'riderProof=wanderer&action=wave&t=.4&angle=315&dist=2.2&height=1.1'],
  ]) {
    const url = `http://127.0.0.1:5187/?view=rider&manual=1&quality=low&weather=clear&tod=.42&${query}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction(() => window.__dw?.ready, null, { timeout: 120000 });
    const data = await page.evaluate(() => {
      window.__dw.advance(.5); window.__dw.render();
      const rider = window.__riderShow?.actors[0]?.rider ?? window.__dw.game.rider, g = rider.model.geometry;
      return { triangles: g.index.count / 3, vertices: g.attributes.position.count,
        finite: Object.values(g.attributes).every(a => Array.from(a.array).every(Number.isFinite)),
        errors: window.__dw.errors };
    });
    if (!data.finite || data.errors.length) throw new Error(JSON.stringify(data));
    await page.screenshot({ path: path.join(output, `${name}.png`) });
    captures.push({ name, url, ...data }); console.log(`${pass}: ${name}: ${data.triangles} triangles`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ pass, renderer: 'SwiftShader WebGL; no hardware timing', captures, errors }, null, 2));
} finally { await browser.close(); }
