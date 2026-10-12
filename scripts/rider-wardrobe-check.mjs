// Historical Travel-only checkpoint harness. The all-outfit UI supersedes its CTA;
// use rider-mixed-wardrobe-check.mjs for current Stable validation.
// Production WebGL / actual Stable DOM. Isolated browser storage, no real player save changes.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';
const output = path.resolve('shots/rider-wardrobe');
await fs.mkdir(output, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 5196, strictPort: true } });
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const report = { renderer: 'Production WebGL / Edge SwiftShader; functional evidence, not GPU timing', checks: [], captures: [], errors: [] };
page.on('pageerror', e => report.errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
const check = (name, pass) => { if (!pass) throw new Error(name); report.checks.push({ name, passed: true }); console.log(`PASS ${name}`); };
async function open(query) {
  const url = new URL('http://127.0.0.1:5196/?manual=1&play=1&quality=low&weather=clear&tod=.42');
  for (const [key, value] of new URLSearchParams(query)) url.searchParams.set(key, value);
  await page.goto(url.href, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => window.__dw?.ready, null, { timeout: 120000 });
  await page.evaluate(() => { window.__dw.advance(.5); window.__dw.render(); });
}
const tab = name => page.locator('.dw-tab').filter({ hasText: new RegExp(`^${name}$`) }).click();
const pick = name => page.locator('.dw-stable-body').getByText(name, { exact: true }).click();
const saved = () => page.evaluate(() => JSON.stringify(window.__dw.game.save.data.rider));
const capture = async name => { await page.evaluate(() => { window.__dw.advance(1.5); window.__dw.render(); }); await page.screenshot({ path: path.join(output, `${name}.png`) }); report.captures.push({ name, url: page.url() }); };
try {
  await open('');
  const entry = await page.evaluate(() => {
    const g = window.__dw.game;
    const look = { ...g.save.data.rider, headgear: 'none', scarf: 'none', cape: 'none', outfitPrimary: '#f2eada', outfitSecondary: '#7fa8c4' };
    g.setRiderLook(look); g.save.flush(); g.openStable(); g.frame(0, true);
    return JSON.stringify(look);
  });
  await tab('Outfit Pieces');
  check('legacy outfits explain the piece selector', await page.getByText('Wear Travel Drape', { exact: true }).isVisible());
  await pick('Wear Travel Drape');
  check('wearing Travel Drape previews without saving or debug proof flags', await page.evaluate(entry => {
    const g = window.__dw.game;
    return JSON.stringify(g.save.data.rider) === entry && g.rider.look.outfit === 'travel-drape' && g.rider.model.proof === 'aerie';
  }, entry));
  await capture('stable-full');
  const slots = [['chest', 'No Chest Armor'], ['shoulderDrape', 'No Shoulder Drape'], ['waist', 'No Sash'],
    ['armWraps', 'No Arm Wraps'], ['legWraps', 'No Leg Wraps'], ['footwear', 'Bare Feet']];
  for (const [key, label] of slots) {
    const before = await page.evaluate(() => window.__dw.game.rider.model.geometry.index.count);
    await pick(label);
    check(`${key}: selection visibly removes geometry without saving`, await page.evaluate(({ key, before, entry }) => {
      const g = window.__dw.game;
      return g.rider.look[key] === 'none' && g.rider.model.geometry.index.count < before && JSON.stringify(g.save.data.rider) === entry;
    }, { key, before, entry }));
  }
  await page.locator('.dw-stable-foot .dw-btn').filter({ hasText: 'Revert' }).click();
  await page.locator('.dw-dialog .dw-btn').filter({ hasText: /^Revert$/ }).click();
  check('Revert restores every component, costume and persisted save', await page.evaluate(entry => {
    const g = window.__dw.game; return JSON.stringify(g.save.data.rider) === entry && JSON.stringify(g.rider.look) === entry;
  }, entry));
  await page.evaluate(() => { window.__dw.game.openStable(); window.__dw.render(); });
  await tab('Outfit');
  await pick('Travel Drape');
  await tab('Rider'); await pick('Broad');
  check('medium-only costume gives an explicit build constraint', await page.evaluate(() => window.__dw.game.rider.look.build === 'medium')
    && await page.getByText('Travel Drape uses Medium', { exact: true }).isVisible());
  await tab('Outfit Pieces');
  await pick('No Chest Armor'); await pick('No Shoulder Drape');
  await pick('Restore all outfit pieces');
  check('restore pieces previews the complete set while retaining colors', await page.evaluate(() => {
    const r = window.__dw.game.rider.look;
    return r.chest === 'slate-scales' && r.shoulderDrape === 'chlamys' && r.outfitPrimary === '#f2eada';
  }));
  await page.evaluate(() => {
    const r = window.__dw.game.rider;
    window.__wardrobeRefs = { geometry: r.model.geometry, skeleton: r.model.rig.skeleton, material: r.model.mesh.material };
  });
  for (const row of [0, 1]) await page.locator('.dw-swatches').nth(row).locator('.dw-swatch:not(.is-selected)').first().click();
  check('scale and leather dyes retain geometry, skeleton and shared material', await page.evaluate(() => {
    const r = window.__dw.game.rider, refs = window.__wardrobeRefs;
    return r.look.armorColor !== '#586875' && r.look.leatherColor !== '#80634d' && r.model.geometry === refs.geometry
      && r.model.rig.skeleton === refs.skeleton && r.model.mesh.material === refs.material;
  }));
  await pick('No Shoulder Drape'); await pick('No Leg Wraps');
  await page.locator('.dw-stable-foot .dw-btn').filter({ hasText: 'Save & leave' }).click();
  const applied = await saved();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__dw?.ready, null, { timeout: 120000 });
  check('save/reload restores equipped pieces and dyes without riderProof query', await saved() === applied
    && await page.evaluate(() => window.__dw.game.rider.model.proof === 'aerie'));
  const takeoff = await page.evaluate(() => {
    const h = window.__dw, g = h.game, spawn = g.world.layout.spawn.position;
    const at = g.player.foot.position.clone(); g.world.terrain.standingPoint(spawn[0], spawn[2], at);
    g.player.teleport(at, 0, 'landed'); g.cameraRig.setOverride(null); g.cameraRig.snap(g.player);
    h.advance(.6, { flight: { flap: 1 } }); h.render();
    return { mode: g.player.mode, finite: g.rider.cloth.pieces.every(p => Array.from(p.cloth.pos).every(Number.isFinite)), errors: h.errors };
  });
  check('customized saved costume completes an actual player takeoff', takeoff.mode === 'flying' && takeoff.finite && !takeoff.errors.length);
  const landing = await page.evaluate(() => {
    const h = window.__dw, g = h.game, p = g.player, spawn = g.world.layout.spawn.position;
    const at = p.foot.position.clone(); g.world.terrain.standingPoint(spawn[0] - 6, spawn[2] + 4, at);
    at.y += p.breed.standHeight + 3;
    p.teleport(at, 0, 'flying', 4); p.model.state.velocity.y = -2; g.cameraRig.snap(p);
    for (let i = 0; i < 180 && p.mode === 'flying'; i++) h.advance(1 / 30, { flight: { flare: 1 } });
    h.render(); return { mode: p.mode, errors: h.errors };
  });
  check('customized saved costume completes an actual player landing', landing.mode === 'landed' && !landing.errors.length);
  const dismount = await page.evaluate(() => {
    const h = window.__dw; h.advance(1); h.advance(.25, { pressed: { interact: true } }); h.render(); return h.game.player.mode;
  });
  check('actual player dismount begins with the custom loadout', dismount === 'dismounting');
  check('actual player dismount completes', await page.evaluate(() => { window.__dw.advance(1); return window.__dw.game.player.mode; }) === 'onFoot');
  report.gameplay = { takeoff, landing, dismount, completed: 'onFoot' };
  await page.evaluate(() => { window.__dw.game.openStable(); window.__dw.render(); });
  await tab('Outfit'); await pick("Scout's Tunic");
  await tab('Outfit Pieces'); await pick('Wear Travel Drape');
  check('switching complete outfits retains the custom piece loadout', await page.evaluate(() => {
    const r = window.__dw.game.rider.look; return r.shoulderDrape === 'none' && r.legWraps === 'none';
  }));
  await tab('Outfit');
  await pick("Courier's Coat");
  check('existing earned outfit remains locked with no progression changes', await page.evaluate(() => window.__dw.game.rider.look.outfit === 'travel-drape'));
  report.savedLook = JSON.parse(applied);

  // Posed actual-engine captures, separate from the real Stable edit/persistence checks above.
  const base = 'view=rider&outfit=travel-drape&headgear=none&scarf=none&cape=none&primary=f2eada&secondary=7fa8c4&quality=medium&camUp=.15';
  for (const [name, extra] of [
    ['outfit-full', 'angle=18&dist=2.7&height=.95'],
    ['outfit-light', 'angle=18&dist=2.7&height=.95&chest=none&shoulderDrape=none&legWraps=none'],
    ['mounted-left', 'real=1&angle=90&speed=40&dist=2.7&height=.4&shoulderDrape=none&legWraps=none'],
    ['mounted-right', 'real=1&angle=270&speed=40&dist=2.7&height=.4&shoulderDrape=none&legWraps=none'],
  ]) {
    await open(`${base}&${extra}`);
    await page.evaluate(() => window.__dw.advance(3));
    const state = await page.evaluate(() => {
      const r = window.__riderShow.actors[0]?.rider ?? window.__dw.game.rider;
      return { proof: r.model.proof, look: r.look, triangles: r.model.geometry.index.count / 3,
        mapSize: r.model.mesh.material.map.image.width, bones: r.model.rig.skeleton.bones.length,
        finite: r.cloth.pieces.every(p => Array.from(p.cloth.pos).every(Number.isFinite)), errors: window.__dw.errors };
    });
    check(`${name}: saved outfit path renders with 2K maps, finite cloth and the existing rig`, state.proof === 'aerie'
      && state.mapSize === 2048 && state.bones === 27 && state.finite && !state.errors.length);
    await capture(name);
    report.captures.at(-1).state = state;
  }
  check('no browser or shader errors', report.errors.length === 0);
} catch (e) { report.failure = String(e); process.exitCode = 1; console.error(e); }
finally {
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
  await browser.close(); await server.httpServer.close();
}
