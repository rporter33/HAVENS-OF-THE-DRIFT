// Production WebGL evidence for bounded C02 cloth and 1K/2K/3K/4K material sampling.
// Build first. Controlled gust stress is separate from actual player/weather evidence.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';
const output = path.resolve('shots/rider-cloth-hd');
await fs.mkdir(output, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 5190, strictPort: true } });
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const report = { renderer: 'production WebGL / Edge SwiftShader; not hardware timing', checks: [], captures: [], errors: [] };
page.on('pageerror', e => report.errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
const check = (name, pass) => { if (!pass) throw new Error(name); report.checks.push({ name, passed: true }); console.log(`PASS ${name}`); };
async function open(query, showcase = true) {
  const url = new URL(`http://127.0.0.1:5190/?manual=1&play=1&weather=clear&tod=.42&quality=low${showcase ? '&view=rider' : ''}`);
  for (const [key, value] of new URLSearchParams(query)) url.searchParams.set(key, value);
  await page.goto(url.href, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => window.__dw?.ready, null, { timeout: 120000 });
  await page.evaluate(() => { window.__dw.advance(.5); window.__dw.render(); });
  return url.href;
}
async function capture(name, url, extra = {}) {
  await page.evaluate(() => window.__dw.render());
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  report.captures.push({ name, url, ...extra });
}
try {
  const url = await open('riderProof=wanderer&quality=medium&wind=0,0&angle=160&dist=2.3&height=1.02');
  for (const [name, air, seconds] of [['calm', [0, 0, 0], 3], ['breeze', [8, 0, -4], 3],
    ['gust-left', [24, 2, -30], 2], ['gust-right', [-24, -2, -30], 2], ['settled', [0, 0, 0], 10]]) {
    const data = await page.evaluate(({ air, seconds }) => {
      const r = window.__riderShow.actors[0].rider, pose = window.__riderShow.actors[0].pose;
      let finite = true, maxExcess = 0, maxSpeed = 0;
      for (let i = 0; i < seconds * 60; i++) {
        pose.airflow.set(...air); r.update(1 / 60, pose, null);
        for (const pc of r.cloth.pieces) {
          const p = pc.cloth.pos, q = pc.cloth.prev;
          finite &&= Array.from(p).every(Number.isFinite) && Array.from(pc.pos).every(Number.isFinite);
          for (let k = pc.spec.cols; k < pc.cloth.n; k++) {
            const c = k % pc.spec.cols, row = Math.floor(k / pc.spec.cols), j = k * 3;
            let length = 0;
            for (let rr = 1; rr <= row; rr++) length += pc.spec.rest[rr * pc.spec.cols + c].distanceTo(pc.spec.rest[(rr - 1) * pc.spec.cols + c]);
            maxExcess = Math.max(maxExcess, Math.hypot(p[j] - p[c * 3], p[j + 1] - p[c * 3 + 1], p[j + 2] - p[c * 3 + 2]) - length * 1.03);
            if (i > seconds * 60 - 60) maxSpeed = Math.max(maxSpeed, Math.hypot(p[j] - q[j], p[j + 1] - q[j + 1], p[j + 2] - q[j + 2]) * 120);
          }
        }
      }
      const drape = r.cloth.pieces.find(p => p.spec.name === 'c02-chlamys');
      return { finite, maxExcess, maxSpeed, air, seconds, drapeTip: Array.from(drape.cloth.pos.slice(-15)), errors: window.__dw.errors };
    }, { air, seconds });
    check(`${name}: finite cloth, bounded reach and no game errors`, data.finite && data.maxExcess < .035 && !data.errors.length);
    if (name === 'settled') check('calm recovery has no sustained flailing', data.maxSpeed < .35);
    // Draw the state directly: render() poses one zero-dt frame, preserving particle state.
    await capture(`wind-${name}`, url, data);
  }
  const breeze = report.captures.find(c => c.name === 'wind-breeze').drapeTip;
  const calm = report.captures.find(c => c.name === 'wind-calm').drapeTip;
  check('gentle wind visibly moves the free drape', Math.hypot(...breeze.map((v, i) => v - calm[i])) > .04);
  const stress = await page.evaluate(() => {
    const r = window.__riderShow.actors[0].rider, pose = window.__riderShow.actors[0].pose;
    const dts = [1 / 240, 1 / 144, 1 / 60, 1 / 30, .1, .25]; let time = 0, finite = true, maxSpan = 0;
    for (let i = 0; i < 900; i++) {
      const dt = dts[i % dts.length]; time += dt;
      pose.airflow.set(24 * Math.sin(time * 3), 6 * Math.cos(time), -90 * Math.cos(time));
      pose.velocity.set(5 * Math.sin(time * 2), 0, 8 * Math.cos(time));
      r.update(dt, pose, null);
      for (const pc of r.cloth.pieces) {
        finite &&= Array.from(pc.cloth.pos).every(Number.isFinite) && Array.from(pc.pos).every(Number.isFinite);
        for (let k = 0; k < pc.cloth.n; k++) maxSpan = Math.max(maxSpan, Math.hypot(...pc.cloth.pos.slice(k * 3, k * 3 + 3)));
      }
    }
    return { frames: 900, simulatedSeconds: time, dts, finite, maxSpan, errors: window.__dw.errors };
  });
  check('90 m/s reversals, inertia and 250 ms frame hitches stay bounded', stress.finite && stress.maxSpan < 2 && !stress.errors.length);
  report.stress = stress;

  // Resolution-only comparison at High has identical cameras, animation and lighting.
  for (const [label, quality, override, expected] of [['low-1k', 'low', '', 1024], ['medium-2k', 'medium', '', 2048],
    ['high-3k', 'high', '&riderTexture=3072', 3072], ['high-4k', 'high', '&riderTexture=4096', 4096]]) {
    const u = await open(`riderProof=wanderer&riderMaps=normal&quality=${quality}${override}&angle=18&dist=.8&height=1.28&wind=0,0`);
    const data = await page.evaluate(() => {
      const r = window.__riderShow.actors[0].rider, m = r.model.mesh.material;
      return { width: m.map.image.width, normalWidth: m.normalMap.image.width,
        maxTextureSize: window.__dw.game.renderer.gl.capabilities.maxTextureSize,
        clothSharesMaps: r.cloth.pieces.filter(p => p.spec.render.proofLinen).every(p => p.mesh.material.map === m.map && p.mesh.material.normalMap === m.normalMap),
        errors: window.__dw.errors, triangles: r.model.geometry.index.count / 3 };
    });
    check(`${label}: actual dimensions, shared maps and shader compile`, data.width === expected && data.normalWidth === expected && data.maxTextureSize >= expected && data.clothSharesMaps && !data.errors.length);
    await capture(`material-${label}`, u, data);
  }

  for (const [name, extra] of [['mounted-left', 'angle=90&speed=40'], ['mounted-right', 'angle=270&speed=40'],
    ['mounted-bank', 'angle=135&speed=70&lean=.9&crouch=.25']]) {
    const u = await open(`riderProof=aerie&real=1&${extra}&dist=2.7&height=.4&quality=medium`);
    await page.evaluate(() => window.__dw.advance(3));
    check(`${name}: cloth remains finite`, await page.evaluate(() => window.__dw.game.rider.cloth.pieces.every(p => Array.from(p.cloth.pos).every(Number.isFinite))));
    await capture(name, u);
  }

  // Real player/weather path: not the fixed-air pose showcase.
  const gameplayUrl = await open('riderProof=wanderer&weather=rain&mode=onFoot', false);
  const live = await page.evaluate(() => {
    const h = window.__dw, g = h.game, rp = g.player.riderPose;
    g.previewRiderLook({ ...g.rider.look, build: 'medium', outfit: 'flight', hair: 'ponytail', headgear: 'none', scarf: 'none', cape: 'none',
      outfitPrimary: '#F2EADA', outfitSecondary: '#7FA8C4', scarfColor: '#315E9C', capeColor: '#F2EADA' });
    let maxAirError = 0, finite = true, windSpeed = 0;
    let sampledWind = null;
    const originalWindAt = g.weather.windAt;
    g.weather.windAt = function(p, out) {
      const result = originalWindAt.call(this, p, out);
      if (out === rp.airflow) sampledWind = out.clone();
      return result;
    };
    for (let i = 0; i < 120; i++) {
      h.advance(1 / 30);
      // Weather advances after player poses in Game.frame. Observe the actual wind sample
      // received by this pose rather than comparing it against a later weather time.
      const wind = sampledWind.clone().sub(rp.velocity);
      maxAirError = Math.max(maxAirError, wind.distanceTo(rp.airflow)); windSpeed = Math.max(windSpeed, wind.length());
      finite &&= g.rider.cloth.pieces.every(p => Array.from(p.cloth.pos).every(Number.isFinite));
    }
    const center = rp.position.clone().add({ x: 0, y: 1.0, z: 0 });
    g.cameraRig.setOverride({ position: center.clone().add({ x: 2, y: .4, z: 1.7 }), target: center });
    return { maxAirError, windSpeed, finite, weather: g.weather.kind, errors: h.errors };
  });
  report.liveWeather = live;
  check('actual weather minus player motion drives finite cloth', live.maxAirError < 1e-6 && live.windSpeed > 0 && live.finite && !live.errors.length);
  await capture('actual-weather', gameplayUrl, live);
  check('no browser errors', report.errors.length === 0);
} catch (error) { report.failure = String(error); throw error; }
finally {
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(report, null, 2));
  await browser.close(); await server.close();
}
