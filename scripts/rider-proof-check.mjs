// Actual-engine C02 proof: isolated browser storage, screenshots and runtime/save checks.
// Build first, then: node scripts/rider-proof-check.mjs [--dev] [--quick | --flows-only]
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer, preview } from 'vite';
const dev = process.argv.includes('--dev'), quick = process.argv.includes('--quick');
const flowsOnly = process.argv.includes('--flows-only');
const sculpt = process.argv.includes('--sculpt');
const port = Number(process.env.RIDER_PROOF_PORT ?? 5187);
const output = path.resolve(process.env.RIDER_PROOF_OUTPUT ?? 'shots/rider-c02');
await fs.mkdir(output, { recursive: true });
const server = dev
  ? await createServer({ server: { host: '127.0.0.1', port, strictPort: true } })
  : await preview({ preview: { host: '127.0.0.1', port, strictPort: true } });
if (dev) await server.listen();
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const base = `http://127.0.0.1:${port}/`;
const captures = [
  ['wanderer-front', 'riderProof=wanderer&angle=18&dist=2.7&height=.92'],
  ['wanderer-face', 'riderProof=wanderer&focus=head&dist=.68&height=1.64&camUp=-.15&angle=12'],
  ['wanderer-back', 'riderProof=wanderer&angle=170&dist=2.7&height=.92'],
  ['aerie-mounted', 'riderProof=aerie&real=1&angle=135&dist=8&height=.5&speed=30'],
  ...quick ? [] : [
    ['wanderer-side', 'riderProof=wanderer&angle=90&dist=2.7&height=.92'],
    ['aerie-front', 'riderProof=aerie&angle=18&dist=2.7&height=.92'],
    ['aerie-back', 'riderProof=aerie&angle=170&dist=2.7&height=.92'],
    ['aerie-saddle-close', 'riderProof=aerie&real=1&angle=135&dist=2.7&height=.45&speed=40'],
    ['aerie-brace-close', 'riderProof=aerie&real=1&brace=1&angle=45&dist=2.7&height=.45&speed=12'],
    ...['walk', 'run', 'jump', 'fall', 'land', 'wave', 'mount', 'dismount'].map(action =>
      [`wanderer-${action}`, `riderProof=wanderer&action=${action}&t=${action === 'dismount' ? .85 : .16}&angle=35&dist=${['mount', 'dismount'].includes(action) ? 4.6 : 3.2}&height=1.3`]),
    ['material-off', 'riderProof=wanderer&riderMaps=off&dist=1.45&height=1.18&angle=18'],
    ['material-color', 'riderProof=wanderer&dist=1.45&height=1.18&angle=18'],
    ['material-normal', 'riderProof=wanderer&riderMaps=normal&dist=1.45&height=1.18&angle=18'],
    ['wanderer-night', 'riderProof=wanderer&tod=.03&angle=18&dist=2.7&height=.92'],
    ['aerie-bank-left', 'riderProof=aerie&real=1&lean=-.9&angle=135&dist=8&height=.5&speed=40'],
    ['aerie-bank-right', 'riderProof=aerie&real=1&lean=.9&angle=225&dist=8&height=.5&speed=40'],
    ['aerie-dive', 'riderProof=aerie&real=1&pitch=55&crouch=.8&angle=135&dist=8&height=.5&speed=70'],
    ['aerie-brake', 'riderProof=aerie&real=1&brace=1&angle=135&dist=8&height=.5&speed=12'],
    ['aerie-ground', 'riderProof=aerie&real=1&ground=1&angle=135&dist=8&height=.5&speed=0'],
    ['legacy-default', 'angle=18&dist=2.7&height=.92'],
    ...sculpt ? [
      ['sculpt-front', 'riderProof=wanderer&angle=18&dist=1.6&height=1.15'],
      ['sculpt-left', 'riderProof=wanderer&angle=90&dist=1.8&height=1.1'],
      ['sculpt-right', 'riderProof=wanderer&angle=270&dist=1.8&height=1.1'],
      ['sculpt-wave', 'riderProof=wanderer&action=wave&t=.4&angle=315&dist=1.8&height=1.3'],
      ['sculpt-hands', 'riderProof=aerie&real=1&angle=25&dist=1.7&height=.55&speed=30'],
      ['sculpt-sandals', 'riderProof=wanderer&angle=35&dist=.8&height=.17'],
    ] : [],
  ],
];
const manifest = { renderer: 'software WebGL / SwiftShader; not hardware timing', dev, captures: [], checks: [] };
const check = (name, condition) => { if (!condition) throw new Error(name); manifest.checks.push({ name, passed: true }); console.log(`PASS ${name}`); };
async function open(query, view = 'rider') {
  const url = new URL(`?view=${view}&manual=1&quality=low&weather=clear&tod=.42`, base);
  for (const [key, value] of new URLSearchParams(query)) url.searchParams.set(key, value);
  await page.goto(url.href, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => window.__dw?.ready, null, { timeout: 120000 });
  await page.evaluate(() => { window.__dw.advance(.5); window.__dw.render(); });
  return url.href;
}
try {
  for (const [name, query] of flowsOnly ? [] : captures) {
    const url = await open(query);
    const data = await page.evaluate(() => {
      const h = window.__dw, actors = window.__riderShow?.actors ?? [];
      const rider = actors[0]?.rider ?? h.game.rider;
      const model = rider.model, m = model.mesh, a = m.geometry.attributes;
      return { vertices: a.position.count, triangles: m.geometry.index.count / 3, bones: m.skeleton.bones.length,
        uv: !!a.uv, proof: model.proof ?? null, clothDraws: rider.group.children.length - 1,
        clothTriangles: rider.group.children.slice(1).filter(c => c.geometry).reduce((n, c) => n + c.geometry.index.count / 3, 0),
        geometryBytes: Object.values(a).reduce((n, x) => n + x.array.byteLength, 0) + m.geometry.index.array.byteLength,
        quality: h.game.renderer.quality.level, timeOfDay: h.game.sky.timeOfDay,
        finite: Object.values(a).every(x => Array.from(x.array).every(Number.isFinite)), errors: h.errors,
        stats: h.stats(), savedRider: JSON.stringify(h.game.save.data.rider) };
    });
    check(`${name}: finite geometry and no game errors`, data.finite && data.errors.length === 0);
    await page.screenshot({ path: path.join(output, `${name}.png`) });
    manifest.captures.push({ name, url, ...data });
    console.log(`PASS capture ${name}: ${data.triangles} triangles, ${data.clothDraws} cloth draws`);
  }
  if (!quick) {
    const url = await open('riderProof=aerie&play=1', 'skyLance');
    const gameplay = await page.evaluate(async () => {
      const h = window.__dw, g = h.game, before = JSON.stringify(g.save.data.rider);
      const look = { ...g.save.data.rider, build: 'medium', hair: 'ponytail', outfit: 'flight', headgear: 'none', scarf: 'none', cape: 'none', outfitPrimary: '#F2EADA', outfitSecondary: '#7FA8C4' };
      g.previewRiderLook(look);
      const geometry = g.rider.model.geometry, uv = Array.from(geometry.attributes.uv.array);
      for (let i = 0; i < 12; i++) g.previewRiderLook({ ...look, outfitPrimary: i % 2 ? '#806080' : '#F2EADA' });
      const recolorKeptGeometry = geometry === g.rider.model.geometry && JSON.stringify(uv) === JSON.stringify(Array.from(geometry.attributes.uv.array));
      g.previewRiderLook(look); h.advance(1); h.render();
      return { savedUnchanged: before === JSON.stringify(g.save.data.rider), recolorKeptGeometry, errors: h.errors };
    });
    check('preview and repeated dye changes preserve saved rider and geometry', gameplay.savedUnchanged && gameplay.recolorKeptGeometry);
    check('Windline scene with proof has no runtime errors', gameplay.errors.length === 0);
    await page.screenshot({ path: path.join(output, 'windline-gameplay.png') });
    manifest.captures.push({ name: 'windline-gameplay', url, ...gameplay });
    const traversal = await page.evaluate(() => {
      const g = window.__dw.game, p = g.player;
      const tick = (input = {}) => { g.input.setScripted(input); g.frame(1 / 120, false); g.input.setScripted(null); };
      document.querySelector('#sky-lance-controls button').click();
      tick();
      const aim = p.foot.position.clone().set(0, 430, -66).sub(p.foot.position.clone().add({ x: 0, y: 1, z: 0 })).normalize();
      tick({ pressed: { lance: true }, lanceHeld: true, aim });
      for (let i = 0; i < 180 && !p.skyLance.rope && p.skyLance.state === 'projectile'; i++) tick({ lanceHeld: true, aim });
      const attached = !!p.skyLance.rope;
      for (let i = 0; i < 45; i++) tick({ lanceHeld: true, aim });
      g.frame(0, true);
      return { attached, state: p.skyLance.state, mode: p.mode, proof: g.rider.model.proof, errors: window.__dw.errors };
    });
    check('proof retains real Windline cast and attachment', traversal.attached && traversal.proof === 'aerie' && traversal.errors.length === 0);
    await page.screenshot({ path: path.join(output, 'windline-attached.png') });
    manifest.captures.push({ name: 'windline-attached', url, ...traversal });
    const release = await page.evaluate(() => {
      const g = window.__dw.game, p = g.player, before = p.foot.velocity.clone();
      p.skyLance.detach(); const momentum = before.equals(p.foot.velocity);
      g.input.setScripted({}); g.frame(1 / 120, false); g.input.setScripted(null);
      return { detached: !p.skyLance.rope, momentum };
    });
    check('Windline release preserves momentum with proof', release.detached && release.momentum);
    manifest.traversal = { ...traversal, release };
    // Existing quality and shape rebuilds, with no new cosmetic IDs or saved fields.
    const combinations = await page.evaluate(() => {
      const g = window.__dw.game, base = { ...g.save.data.rider }, before = JSON.stringify(base);
      for (const build of ['slight', 'medium', 'broad']) for (const hair of ['ponytail', 'long']) for (const headgear of ['none', 'cap', 'hood', 'helm']) {
        g.previewRiderLook({ ...base, build, hair, headgear, scarf: 'none', cape: 'none' });
        window.__dw.advance(.1);
      }
      g.previewRiderLook(base);
      return { savedUnchanged: before === JSON.stringify(g.save.data.rider), errors: window.__dw.errors };
    });
    check('build / long hair / headgear rebuilds preserve saved choices', combinations.savedUnchanged && combinations.errors.length === 0);
    if (!flowsOnly) {
    // Material shader proof under High is a real render, not a software-GPU benchmark.
    const highUrl = await open('riderProof=aerie&riderMaps=normal&quality=high&angle=18&dist=2.7&height=.92');
    const high = await page.evaluate(() => ({ quality: window.__dw.game.renderer.quality.level, errors: window.__dw.errors }));
    check('High quality normal-map shader compiles', high.quality === 'high' && high.errors.length === 0);
    await page.screenshot({ path: path.join(output, 'aerie-high-normal.png') });
    manifest.captures.push({ name: 'aerie-high-normal', url: highUrl, ...high });
    for (const kind of ['map', 'normalMap']) {
      const png = await page.evaluate(kind => {
        const image = window.__riderShow.actors[0].rider.model.mesh.material[kind].image;
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
        return canvas.toDataURL('image/png').split(',')[1];
      }, kind);
      await fs.writeFile(path.join(output, `atlas-${kind}.png`), Buffer.from(png, 'base64'));
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    const mediumUrl = await open('riderProof=wanderer&quality=medium&angle=18&dist=2.7&height=.92');
    check('Medium quality renders', await page.evaluate(() => window.__dw.game.renderer.quality.level === 'medium' && window.__dw.errors.length === 0));
    await page.screenshot({ path: path.join(output, 'wanderer-medium.png') });
    manifest.captures.push({ name: 'wanderer-medium', url: mediumUrl });
    await page.setViewportSize({ width: 1280, height: 720 });
    }
    // Real Stable DOM flow in isolated storage: preview, revert, apply, then reload.
    await open('riderProof=aerie&play=1', '');
    const entry = await page.evaluate(() => {
      const g = window.__dw.game;
      const look = { ...g.save.data.rider, build: 'medium', outfit: 'flight', hair: 'ponytail', headgear: 'none', scarf: 'none', cape: 'none', outfitPrimary: '#F2EADA', outfitSecondary: '#7FA8C4' };
      g.setRiderLook(look); g.save.flush(); g.openStable(); g.frame(0, true);
      return JSON.stringify(look);
    });
    const outfitTab = () => page.locator('.dw-tab').filter({ hasText: /^Outfit$/ }).click();
    const changeDye = () => page.locator('.dw-swatches').first().locator('.dw-swatch:not(.is-selected)').first().click();
    await outfitTab(); await changeDye();
    check('Stable dye pick previews without saving', await page.evaluate(entry => JSON.stringify(window.__dw.game.save.data.rider) === entry
      && window.__dw.game.rider.look.outfitPrimary.toLowerCase() !== JSON.parse(entry).outfitPrimary.toLowerCase(), entry));
    await page.locator('.dw-stable-foot .dw-btn').filter({ hasText: 'Revert' }).click();
    await page.locator('.dw-dialog .dw-btn').filter({ hasText: /^Revert$/ }).click();
    check('Stable Revert restores entry look and save', await page.evaluate(entry => JSON.stringify(window.__dw.game.save.data.rider) === entry
      && JSON.stringify(window.__dw.game.rider.look) === entry, entry));
    await page.evaluate(() => { window.__dw.game.openStable(); window.__dw.render(); });
    await outfitTab(); await changeDye();
    await page.locator('.dw-stable-foot .dw-btn').filter({ hasText: 'Save & leave' }).click();
    const applied = await page.evaluate(() => JSON.stringify(window.__dw.game.save.data.rider));
    check('Stable Apply keeps the selected dye', applied !== entry);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__dw?.ready, null, { timeout: 120000 });
    const reload = await page.evaluate(applied => {
      const expected = JSON.parse(applied), g = window.__dw.game, actual = g.save.data.rider;
      // Existing save sanitization normalizes hex case. Compare selections, not JSON casing.
      const same = Object.keys(actual).length === Object.keys(expected).length && Object.entries(expected).every(([key, value]) =>
        typeof value === 'string' && value.startsWith('#') ? actual[key].toLowerCase() === value.toLowerCase() : actual[key] === value);
      return { same, actual, noProofFields: !Object.keys(g.save.data).some(key => /proof/i.test(key)), proof: g.rider.model.proof };
    }, applied);
    manifest.reload = reload;
    check('save reload retains choices without new fields', reload.same && reload.noProofFields && reload.proof === 'aerie');
    manifest.stable = { entry: JSON.parse(entry), applied: JSON.parse(applied), reloadPassed: true };
    // Actual simulation takeoff; the posed montage above is labeled separately in the handoff.
    await page.evaluate(() => {
      const g = window.__dw.game, spawn = g.world.layout.spawn.position;
      g.previewRiderLook({ ...g.save.data.rider, outfitPrimary: '#F2EADA', outfitSecondary: '#7FA8C4' });
      const at = g.player.foot.position.clone(); g.world.terrain.standingPoint(spawn[0], spawn[2], at);
      g.player.teleport(at, 0, 'landed'); g.cameraRig.setOverride(null); g.cameraRig.snap(g.player);
      window.__dw.advance(.6, { flight: { flap: 1 } }); window.__dw.render();
    });
    check('actual player takeoff with proof', await page.evaluate(() => window.__dw.game.player.mode === 'flying' && window.__dw.errors.length === 0));
    await page.screenshot({ path: path.join(output, 'aerie-takeoff-gameplay.png') });
    manifest.captures.push({ name: 'aerie-takeoff-gameplay', mode: await page.evaluate(() => window.__dw.game.player.mode) });
    const landing = await page.evaluate(() => {
      const h = window.__dw, g = h.game, p = g.player, spawn = g.world.layout.spawn.position;
      const at = p.foot.position.clone(); g.world.terrain.standingPoint(spawn[0] - 6, spawn[2] + 4, at);
      at.y += p.breed.standHeight + 3;
      p.teleport(at, 0, 'flying', 4); p.model.state.velocity.y = -2;
      g.cameraRig.snap(p);
      for (let i = 0; i < 180 && p.mode === 'flying'; i++) h.advance(1 / 30, { flight: { flare: 1 } });
      h.render(); return { mode: p.mode, errors: h.errors };
    });
    check('actual player landing with proof', landing.mode === 'landed' && landing.errors.length === 0);
    await page.screenshot({ path: path.join(output, 'aerie-landing-gameplay.png') });
    manifest.captures.push({ name: 'aerie-landing-gameplay', ...landing });
    const dismount = await page.evaluate(() => {
      const h = window.__dw;
      h.advance(1); // Let the existing touchdown blend finish before requesting dismount.
      h.advance(.25, { pressed: { interact: true } }); h.render();
      return { mode: h.game.player.mode, errors: h.errors };
    });
    manifest.dismount = dismount;
    check('actual player dismount begins with proof', dismount.mode === 'dismounting' && dismount.errors.length === 0);
    await page.screenshot({ path: path.join(output, 'aerie-dismount-gameplay.png') });
    manifest.captures.push({ name: 'aerie-dismount-gameplay', ...dismount });
    const onFoot = await page.evaluate(() => { window.__dw.advance(1); return window.__dw.game.player.mode; });
    check('actual player dismount completes', onFoot === 'onFoot');
  }
  check('browser console/page errors', errors.length === 0);
  if (!quick && !flowsOnly) {
    const cards = manifest.captures.map(({ name }) => `<figure><a href="${name}.png"><img loading="lazy" src="${name}.png" alt="${name}"></a><figcaption>${name.replaceAll('-', ' ')}</figcaption></figure>`).join('\n');
    await fs.writeFile(path.join(output, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>C02 P1 — actual engine review</title><style>body{margin:0;background:#182631;color:#FAF8F3;font:16px/1.6 system-ui}header,main{max-width:1300px;margin:auto;padding:24px}h1{font-size:32px;margin:0}p{max-width:90ch}a{color:#a8d4f0}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:24px}figure{margin:0;background:#263a47;border:1px solid #586875;border-radius:8px;overflow:hidden}img{display:block;width:100%;height:auto}figcaption{padding:10px 16px;text-transform:capitalize}@media(max-width:500px){main{grid-template-columns:1fr}}</style><header><h1>C02 Travel Drape · P1 engine proof</h1><p>All images below are actual Three.js WebGL renders. Low: 1280×720; Medium: 1920×1080. ${manifest.checks.length} browser checks passed. Software SwiftShader provides appearance and integration evidence, not integrated-GPU performance certification.</p><p>Wanderer actions and bank/dive/brake views use the existing pose showcase. Takeoff, landing, dismount and Windline attachment use actual player simulation. Production art, all-option clearance and hardware timing remain for review. <a href="manifest.json">Exact capture queries and results</a> · <a href="atlas-map.png">High color atlas</a> · <a href="atlas-normalMap.png">High optional normal atlas</a></p></header><main>${cards}</main></html>`);
  }
  console.log(`PASS ${manifest.checks.length} checks; ${manifest.captures.length} captures in ${output}`);
} catch (error) { manifest.failure = String(error); throw error; }
finally {
  manifest.browserErrors = errors;
  await fs.writeFile(path.join(output, flowsOnly ? 'flow-manifest.json' : 'manifest.json'), JSON.stringify(manifest, null, 2));
  await browser.close(); if (dev) await server.close(); else await new Promise(resolve => server.httpServer.close(resolve));
}
