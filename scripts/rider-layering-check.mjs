// Matched C02 light-outfit art pass. Posed WebGL captures; gameplay remains covered by smoke/mixed wardrobe checks.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';
const phase = process.argv[2] ?? 'after';
const output = path.resolve('shots/rider-layering', phase); await fs.mkdir(output, { recursive: true });
const server = phase === 'before' ? null : await preview({ preview: { host: '127.0.0.1', port: 5197, strictPort: true } });
const origin = phase === 'before' ? 'http://127.0.0.1:5193' : 'http://127.0.0.1:5197';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const report = { phase, renderer: 'Production WebGL / Edge SwiftShader; posed art evidence, not GPU timing', captures: [], checks: [], errors: [] };
page.on('pageerror', e => report.errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
const check = (name, pass) => { if (!pass) throw Error(name); report.checks.push({ name, passed: true }); console.log('PASS ' + name); };
const light = 'chest=none&shoulderDrape=none&legWraps=none';
const captures = [
  ['light-front', light + '&angle=18&dist=2.7&height=.95&camUp=.15'],
  ['light-top', light + '&angle=18&dist=1.05&height=1.32&camUp=0'],
  ['shoulders-back', light + '&angle=170&dist=1.05&height=1.32&camUp=0'],
  ['ankles', light + '&angle=30&dist=.8&height=.19&camUp=.08'],
  ['ankle-side', light + '&angle=90&dist=.8&height=.19&camUp=.08'],
  ['wave', light + '&action=wave&t=.4&angle=315&dist=1.8&height=1.22&camUp=0'],
  ['full-outfit', 'angle=18&dist=2.7&height=.95&camUp=.15'],
  ['mounted-left', light + '&real=1&angle=90&speed=40&dist=2.7&height=.4&camUp=.15'],
  ['mounted-right', light + '&real=1&angle=270&speed=40&dist=2.7&height=.4&camUp=.15'],
  ['mounted-bank', light + '&real=1&angle=135&speed=70&lean=.9&crouch=.25&dist=2.7&height=.4&camUp=.15'],
];
try {
  for (const [name, query] of phase === 'before' ? captures.slice(0, 5) : captures) {
    const url = `${origin}/?view=rider&manual=1&quality=medium&weather=clear&tod=.42&outfit=travel-drape&headgear=none&scarf=none&cape=none&primary=f2eada&secondary=7fa8c4&${query}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 }); await page.waitForFunction(() => window.__dw?.ready, null, { timeout: 120000 });
    const state = await page.evaluate(() => {
      window.__dw.advance(.75); window.__dw.render();
      const r = window.__riderShow.actors[0]?.rider ?? window.__dw.game.rider;
      return { triangles: r.model.geometry.index.count / 3, bones: r.model.rig.skeleton.bones.length,
        finite: Object.values(r.model.geometry.attributes).every(a => Array.from(a.array).every(Number.isFinite))
          && r.cloth.pieces.every(p => Array.from(p.cloth.pos).every(Number.isFinite)),
        texture: r.model.mesh.material.map.image.width, errors: window.__dw.errors };
    });
    check(name + ': finite model/cloth, existing rig and 2K material', state.finite && state.bones === 27 && state.texture === 2048 && !state.errors.length);
    await page.screenshot({ path: path.join(output, name + '.png') }); report.captures.push({ name, url, state });
  }
  check('no page or shader errors', report.errors.length === 0);
} catch (e) { report.failure = String(e); process.exitCode = 1; console.error(e); }
finally { await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2)); await browser.close(); if (server) await server.httpServer.close(); }
