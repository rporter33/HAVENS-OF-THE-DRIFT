// Actual Stable and production WebGL evidence. All storage is isolated from the owner's save.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';
const output = path.resolve('shots/rider-mixed-wardrobe'); await fs.mkdir(output, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 5196, strictPort: true } });
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const report = { renderer: 'Production WebGL / Edge SwiftShader; not GPU timing', checks: [], captures: [], errors: [] };
page.on('pageerror', e => report.errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') report.errors.push({ message: m.text(), url: page.url(), location: m.location(), phase: report.checks.at(-1)?.name }); });
const check = (name, pass) => { if (!pass) throw Error(name); report.checks.push({ name, passed: true }); console.log('PASS ' + name); };
async function open(query = '') {
  const url = new URL('http://127.0.0.1:5196/?manual=1&play=1&quality=low&weather=clear&tod=.42');
  for (const [k, v] of new URLSearchParams(query)) url.searchParams.set(k, v);
  await page.goto(url.href, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => window.__dw?.ready, null, { timeout: 120000 });
  await page.evaluate(() => { window.__dw.advance(.5); window.__dw.render(); });
}
const tab = label => page.locator('.dw-tab').filter({ hasText: new RegExp(`^${label}$`) }).click();
const pick = label => page.locator('.dw-stable-body').getByText(label, { exact: true }).last().click();
const saveButton = () => page.locator('.dw-stable-foot .dw-btn').filter({ hasText: 'Save & leave' }).click();
async function revert() { await page.locator('.dw-stable-foot .dw-btn').filter({ hasText: 'Revert' }).click(); await page.locator('.dw-dialog .dw-btn').filter({ hasText: /^Revert$/ }).click(); }
const capture = async name => { await page.evaluate(() => { window.__dw.advance(1.5); window.__dw.render(); }); await page.screenshot({ path: path.join(output, name + '.png') }); report.captures.push({ name, url: page.url() }); };
const choices = [
  ['top', 'courier-top', "Courier's Coat"], ['trousers', 'racer-trousers', 'Racing Trousers'],
  ['chest', 'scout-chest', 'Scout Jerkin'], ['shoulderDrape', 'chlamys', 'Shoulder Drape & Brooch'],
  ['waist', 'cartographer-waist', 'Cartographer Sash'], ['armWraps', 'skyknight-armWraps', 'Skyknight Vambraces & Gloves'],
  ['legWraps', 'scout-legWraps', 'Scout Calf Wraps'], ['footwear', 'flight-footwear', 'Flight Boots'],
];
async function mix() { for (const [key, id, name] of choices) {
  await pick(name);
  check(key + ' selects its real garment', await page.evaluate(({ key, id }) => {
    const look = window.__dw.game.rider.look; return (look.wardrobe?.[key] ?? look[key]) === id;
  }, { key, id }));
} }
try {
  await open();
  await page.evaluate(() => { const g = window.__dw.game; g.openStable(); g.frame(0, true); });
  await tab('Outfit Pieces'); await pick("Courier's Coat");
  check('locked parent outfit also locks its pieces', await page.evaluate(() => !window.__dw.game.rider.look.wardrobe));
  await page.evaluate(() => {
    const g = window.__dw.game; g.closeStable(); g.save.data.unlocked.push('courier', 'racer', 'cartographer', 'skyknight');
    g.setRiderLook({ ...g.save.data.rider, outfit: 'travel-drape', headgear: 'none', scarf: 'none', cape: 'none', outfitPrimary: '#f2eada', outfitSecondary: '#7fa8c4' });
    g.save.flush(); g.openStable(); g.frame(0, true);
  });
  const entry = await page.evaluate(() => JSON.stringify(window.__dw.game.save.data.rider));
  await tab('Outfit Pieces'); await mix();
  check('all seven outfits contribute to one preview without saving', await page.evaluate(entry => JSON.stringify(window.__dw.game.save.data.rider) === entry
    && window.__dw.game.rider.model.rig.skeleton.bones.length === 27 && window.__dw.game.rider.cloth.pieces.some(p => p.spec.name === 'coatL'), entry));
  await capture('stable-mixed-pieces');
  await revert();
  check('Revert restores the entire entry loadout and save', await page.evaluate(entry => {
    const g = window.__dw.game; return JSON.stringify(g.save.data.rider) === entry && JSON.stringify(g.rider.look) === entry;
  }, entry));
  await page.evaluate(() => { window.__dw.game.openStable(); window.__dw.render(); }); await tab('Outfit Pieces'); await mix();
  await page.evaluate(() => { const r = window.__dw.game.rider; window.__mixedRefs = { geometry: r.model.geometry, bones: r.model.rig.skeleton, material: r.model.mesh.material }; });
  for (const row of [0, 1]) await page.locator('.dw-swatches').nth(row).locator('.dw-swatch:not(.is-selected)').first().click();
  check('mixed armor and leather dyes reuse geometry, bones and material', await page.evaluate(() => {
    const r = window.__dw.game.rider, refs = window.__mixedRefs;
    return r.model.geometry === refs.geometry && r.model.rig.skeleton === refs.bones && r.model.mesh.material === refs.material;
  }));
  await saveButton();
  const applied = await page.evaluate(() => JSON.stringify(window.__dw.game.save.data.rider));
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__dw?.ready, null, { timeout: 120000 });
  check('mixed choices and dyes survive Save and reload without debug costume flags', await page.evaluate(applied => JSON.stringify(window.__dw.game.save.data.rider) === applied
    && window.__dw.game.rider.cloth.pieces.some(p => p.spec.name === 'coatL'), applied));
  const gameplay = await page.evaluate(() => {
    const h = window.__dw, g = h.game, p = g.player, spawn = g.world.layout.spawn.position;
    const at = p.foot.position.clone(); g.world.terrain.standingPoint(spawn[0], spawn[2], at);
    p.teleport(at, 0, 'landed'); g.cameraRig.setOverride(null); g.cameraRig.snap(p);
    h.advance(.6, { flight: { flap: 1 } }); const takeoff = p.mode;
    g.world.terrain.standingPoint(spawn[0] - 6, spawn[2] + 4, at); at.y += p.breed.standHeight + 3;
    p.teleport(at, 0, 'flying', 4); p.model.state.velocity.y = -2;
    for (let i = 0; i < 180 && p.mode === 'flying'; i++) h.advance(1 / 30, { flight: { flare: 1 } });
    const landing = p.mode; h.advance(1); h.advance(.25, { pressed: { interact: true } }); const dismount = p.mode; h.advance(1); h.render();
    return { takeoff, landing, dismount, finished: p.mode, finite: g.rider.cloth.pieces.every(pc => Array.from(pc.cloth.pos).every(Number.isFinite)), errors: h.errors };
  });
  check('seven-outfit mix completes actual takeoff, landing and dismount with finite cloth', gameplay.takeoff === 'flying' && gameplay.landing === 'landed'
    && gameplay.dismount === 'dismounting' && gameplay.finished === 'onFoot' && gameplay.finite && !gameplay.errors.length); report.gameplay = gameplay;
  await page.evaluate(() => { window.__dw.game.openStable(); window.__dw.render(); }); await tab('Outfit Pieces'); await pick('Restore all outfit pieces');
  check('Restore returns the complete preset and removes coat tails', await page.evaluate(() => !window.__dw.game.rider.look.wardrobe
    && !window.__dw.game.rider.cloth.pieces.some(p => p.spec.name === 'coatL')));
  await tab('Outfit'); await pick('Flight Leathers');
  check('complete Flight Leathers keeps its garments on the shared refined body', await page.evaluate(() => window.__dw.game.rider.look.outfit === 'flight' && !window.__dw.game.rider.model.proof
    && window.__dw.game.rider.model.bodyVersion === 'refined'
    && !window.__dw.game.rider.look.wardrobe));
  report.appliedLook = JSON.parse(applied);

  const query = choices.map(([part, id]) => `piece${part[0].toUpperCase()}${part.slice(1)}=${id}`).join('&');
  const base = 'view=rider&outfit=travel-drape&headgear=none&scarf=none&cape=none&primary=f2eada&secondary=7fa8c4&quality=medium&camUp=.15';
  const captures = [
    ['seven-outfit-front', query + '&angle=18&dist=2.7&height=.95'],
    ['seven-outfit-back', query + '&angle=195&dist=2.7&height=.95'],
    ['mounted-left', query + '&real=1&angle=90&speed=40&dist=2.7&height=.4'],
    ['mounted-right', query + '&real=1&angle=270&speed=40&dist=2.7&height=.4'],
    ['mounted-bank', query + '&real=1&angle=135&speed=70&lean=.9&crouch=.25&dist=2.7&height=.4'],
    ['linen-and-flight', 'pieceTop=travel-drape-top&pieceChest=slate-scales&pieceFootwear=flight-footwear&angle=18&dist=2.7&height=.95'],
    ['robe-and-scales', 'pieceTop=cartographer-top&pieceChest=slate-scales&pieceShoulderDrape=none&pieceFootwear=scout-footwear&angle=18&dist=2.7&height=.95'],
  ];
  for (const [name, extra] of captures) {
    await open(base + '&' + extra); await page.evaluate(() => window.__dw.advance(3));
    const state = await page.evaluate(() => {
      const r = window.__riderShow.actors[0]?.rider ?? window.__dw.game.rider;
      return { look: r.look, triangles: r.model.geometry.index.count / 3, bones: r.model.rig.skeleton.bones.length, mapSize: r.model.mesh.material.map.image.width,
        cloth: r.cloth.pieces.map(pc => pc.spec.name), finite: r.cloth.pieces.every(pc => Array.from(pc.cloth.pos).every(Number.isFinite))
          && Array.from(r.model.geometry.attributes.position.array).every(Number.isFinite), errors: window.__dw.errors };
    });
    check(name + ': real combined geometry, 2K material and finite cloth', state.bones === 27 && state.mapSize === 2048 && state.finite && !state.errors.length);
    await capture(name); report.captures.at(-1).state = state;
  }
  check('no page or shader errors', report.errors.length === 0);
} catch (e) { report.failure = String(e); process.exitCode = 1; console.error(e); }
finally { await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2)); await browser.close(); await server.httpServer.close(); }
