// Production browser evidence for the authoring workflow and save isolation.
// CHROMIUM_PATH=/usr/bin/chromium node scripts/editor-check.mjs http://127.0.0.1:5399/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const base = new URL(process.argv[2] ?? 'http://127.0.0.1:5399/');
const evidenceDir = process.env.EDITOR_EVIDENCE_DIR ?? '/tmp/driftwing-editor-evidence';
fs.mkdirSync(evidenceDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
  window.__editorStorageTrace = []; window.__editorDbTrace = [];
  for (const method of ['getItem', 'setItem', 'removeItem']) {
    const original = Storage.prototype[method];
    Storage.prototype[method] = function(key, ...args) {
      if (key === 'driftwing.save.v1' || key === 'driftwing.save') window.__editorStorageTrace.push({ method, key });
      return original.call(this, key, ...args);
    };
  }
  const open = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function(name, ...args) {
    window.__editorDbTrace.push(name); return open.call(this, name, ...args);
  };
});
const page = await context.newPage();
const errors = [];
const pendingRequests = new Set();
let phase = 'initial boot';
page.on('request', r => { if (r.url().startsWith(base.origin)) pendingRequests.add(r.url()); });
page.on('requestfinished', r => pendingRequests.delete(r.url()));
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('requestfailed', r => {
  pendingRequests.delete(r.url());
  if (r.url().startsWith(base.origin)) errors.push(r.url() + ': ' + r.failure()?.errorText);
});
page.on('response', r => {
  if (r.url().startsWith(base.origin) && r.status() >= 400) errors.push('HTTP ' + r.status() + ': ' + r.url());
});
const report = {
  passed: false,
  commit: execSync('git rev-parse HEAD').toString().trim(),
  dirty: execSync('git status --porcelain').toString().trim(),
  browser: browser.version(), url: base.href, viewport: { width: 1440, height: 900 },
  cycles: [], captures: [], errors,
};
const document = () => page.evaluate(() => JSON.parse(JSON.stringify(__regionEditor.history.current)));
async function field(label, value) {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(String(value)); await input.press('Tab');
}
async function capture(name) {
  const file = path.join(evidenceDir, name + '.png');
  await page.screenshot({ path: file });
  report.captures.push({ name, file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
}
try {
  await page.goto(new URL('editor.html?debug=1', base).href);
  await page.waitForFunction(() => window.__regionEditor, null, { timeout: 120_000 });
  await page.evaluate(() => { localStorage['driftwing.save.v1'] = '{"sentinel":"player progress untouched"}'; });
  assert.equal(await page.locator('#playtest').isEnabled(), true);
  await capture('editor-overview');
  for (let cycle = 0; cycle < 3; cycle++) {
    phase = 'edit/playtest/return cycle ' + (cycle + 1);
    await page.locator('#hierarchy [data-kind="island"]').first().click();
    const before = await document();
    await field('Radius (m)', before.islands[0].radius + 5);
    assert.equal((await document()).islands[0].radius, before.islands[0].radius + 5);
    await page.locator('#undo').click(); assert.deepEqual(await document(), before);
    await page.locator('#redo').click(); assert.equal((await document()).islands[0].radius, before.islands[0].radius + 5);
    await page.locator('#add-island').click();
    assert.equal((await document()).islands.length, before.islands.length + 1);
    await page.locator('#undo').click(); assert.equal((await document()).islands.length, before.islands.length);
    await page.locator('#redo').click(); assert.equal((await document()).islands.length, before.islands.length + 1);
    // Undo the trial island so repeated cycles retain a compact, clear sample region.
    await page.locator('#undo').click();
    await page.locator('#save').click();
    const saved = await document();
    await field('Region name', 'Unsaved change ' + cycle);
    await page.locator('#load').click(); assert.deepEqual(await document(), saved);
    await page.locator('#undo').click(); assert.equal((await document()).name, 'Unsaved change ' + cycle);
    await page.locator('#redo').click(); assert.deepEqual(await document(), saved);
    const beforePlay = await document();
    const undoAvailable = await page.locator('#undo').isEnabled();
    // Delay the sandbox response to exercise native repeated activation during boot.
    const delayedSandbox = '**/editor-playtest.html*';
    if (cycle < 2) await page.route(delayedSandbox, async route => {
      await new Promise(resolve => setTimeout(resolve, 750)); await route.continue();
    });
    const navigation = page.waitForEvent('framenavigated', { predicate: f => f.url().includes('editor-playtest.html') });
    if (cycle === 0) {
      await page.locator('#playtest').focus();
      await page.keyboard.down('Enter'); await page.keyboard.down('Enter'); await page.keyboard.down('Enter'); await page.keyboard.up('Enter');
    } else if (cycle === 1) await page.locator('#playtest').dblclick({ delay: 30 });
    else await page.locator('#playtest').click();
    await page.waitForSelector('#playtest-frame');
    assert.equal(await page.locator('#playtest-frame').count(), 1, 'repeated activation creates exactly one sandbox');
    assert.equal(await page.locator('#playtest').isDisabled(), true);
    const sandbox = await navigation;
    if (cycle < 2) await page.unroute(delayedSandbox);
    try { await sandbox.waitForFunction(() => window.__editorPlaytest?.ready, null, { timeout: 180_000 }); }
    catch (error) {
      report.sandboxBootFailure = await Promise.race([
        sandbox.evaluate(() => ({ url: location.href, readyState: document.readyState, ready: !!window.__editorPlaytest?.ready, boot: document.getElementById('boot')?.textContent })),
        new Promise(resolve => setTimeout(() => resolve('Sandbox renderer did not answer within 3 seconds'), 3000)),
      ]).catch(() => 'Sandbox state unavailable');
      console.error('Sandbox boot failure diagnostics:', JSON.stringify(report.sandboxBootFailure));
      throw error;
    }
    const result = await sandbox.evaluate(async () => {
      const { game: g, region, assets } = __editorPlaytest;
      g.save.data.collected.push('sandbox-only'); g.save.flush();
      const storage = [...__editorStorageTrace]; const databases = [...__editorDbTrace];
      return {
        mode: g.player.mode, race: g.races.activeId, islands: region.islands.length,
        authoredInTerrain: g.world.terrain.islands.filter(s => s.def.id >= 10000).length,
        assetCount: assets.objects.size, shrine: !!g.firstLead,
        roost: g.world.layout.islands[0].landmark, storage, databases,
        sentinel: localStorage['driftwing.save.v1'],
      };
    });
    assert.equal(result.mode, 'flying'); assert.equal(result.race, 'authored-region');
    assert.equal(result.authoredInTerrain, beforePlay.islands.length);
    assert.equal(result.assetCount, beforePlay.assets.length);
    assert.equal(result.shrine, true); assert.equal(result.roost, 'roost');
    assert.deepEqual(result.storage, []); assert.deepEqual(result.databases, []);
    assert.equal(result.sentinel, '{"sentinel":"player progress untouched"}');
    await sandbox.locator('#walk').click();
    assert.equal(await sandbox.evaluate(() => __editorPlaytest.game.player.mode), 'onFoot');
    if (cycle === 0) {
      await sandbox.evaluate(() => {
        const g = __editorPlaytest.game;
        for (let i = 0; i < 60; i++) g.frame(1 / 120, false);
        g.frame(0, true);
      });
      await capture('playtest-on-foot');
      await sandbox.locator('#fly').click();
      await capture('playtest-mounted');
      await sandbox.locator('#capture').click();
      await sandbox.waitForFunction(() => document.pointerLockElement === __editorPlaytest.game.renderer.canvas);
      await page.keyboard.press('Escape');
      await sandbox.waitForFunction(() => document.pointerLockElement === null);
      await sandbox.locator('#fly').click();
    }
    await sandbox.locator('#return').click();
    await page.waitForSelector('#playtest-frame', { state: 'detached' });
    assert.equal(await page.locator('iframe').count(), 0, 'Return destroys the only sandbox');
    assert.equal(await page.locator('#playtest').isEnabled(), true, 'Return permits another playtest');
    assert.deepEqual(await document(), beforePlay);
    assert.equal(await page.locator('#undo').isEnabled(), undoAvailable);
    assert.equal(await page.evaluate(() => __regionEditor.preview.active), true);
    report.cycles.push({ cycle, activation: cycle === 0 ? 'repeated-enter' : cycle === 1 ? 'pointer-double-click' : 'single-click', singleSandbox: true, ...result });
  }
  phase = 'gizmo/checkpoint/placement';
  // Translate an island through the actual gizmo, then undo/redo the committed move.
  await page.locator('#hierarchy [data-kind="island"]').first().click();
  await page.locator('#focus').click();
  const beforeDrag = await document();
  const handles = await page.evaluate(() => {
    const p = __regionEditor.preview, candidates = [];
    p.transform.getHelper().updateMatrixWorld(true);
    p.transform.getHelper().traverse(o => {
      if (!o.isMesh || o.name !== 'X') return;
      for (let ancestor = o; ancestor; ancestor = ancestor.parent) if (!ancestor.visible) return;
      o.geometry.computeBoundingBox();
      const v = o.geometry.boundingBox.getCenter(p.controls.target.clone());
      o.localToWorld(v); candidates.push(p.screenPoint(v));
    });
    return candidates;
  });
  let handle;
  for (const candidate of handles) {
    await page.mouse.move(candidate[0], candidate[1]);
    if (await page.evaluate(() => __regionEditor.preview.transform.axis === 'X')) { handle = candidate; break; }
  }
  assert.ok(handle, 'visible X translation handle is pickable');
  await page.mouse.down();
  await page.mouse.move(handle[0] + 50, handle[1], { steps: 8 });
  await page.mouse.up();
  const dragged = await document();
  assert.ok(Math.abs(dragged.islands[0].x - beforeDrag.islands[0].x) >= 1, 'gizmo move commits to the region');
  await page.locator('#undo').click(); assert.deepEqual(await document(), beforeDrag);
  await page.locator('#redo').click(); assert.deepEqual(await document(), dragged);
  await page.locator('#undo').click();
  // Add and reorder a checkpoint; both operations are whole-document undo steps.
  const beforeCheckpoint = await document();
  await page.locator('#add-checkpoint').click();
  assert.equal((await document()).checkpoints.length, beforeCheckpoint.checkpoints.length + 1);
  const addedId = (await document()).checkpoints.at(-1).id;
  await page.locator('#earlier').click(); assert.equal((await document()).checkpoints.at(-2).id, addedId);
  await page.locator('#undo').click(); await page.locator('#undo').click(); assert.deepEqual(await document(), beforeCheckpoint);
  // Manual placement through the real pointer path, followed by parameter edits and undo.
  await page.locator('#hierarchy [data-kind="island"]').first().click();
  await page.locator('#focus').click();
  await page.locator('[data-place="column"]').click();
  const point = await page.evaluate(() => {
    const p = __regionEditor.preview, shape = p.world.terrain.islands[0];
    const v = shape.def; const x = v.x + 22, z = v.z + 18;
    const xyz = p.controls.target.clone().set(x, shape.topHeight(x, z), z);
    return p.screenPoint(xyz);
  });
  const count = (await document()).assets.length;
  await page.mouse.click(point[0], point[1]);
  assert.equal((await document()).assets.length, count + 1);
  await field('Facing (°)', 35);
  await field('Size', 1.2);
  await page.locator('#undo').click(); assert.equal((await document()).assets.at(-1).scale, 1);
  await page.locator('#redo').click(); assert.equal((await document()).assets.at(-1).scale, 1.2);
  await page.locator('#focus').click(); await capture('editor-column');
  // Validation must block unsafe playtests, while export/import remains an undoable operation.
  phase = 'validation/export/import';
  await page.locator('#hierarchy [data-kind="checkpoint"]').first().click();
  const good = await document();
  await field('Height (m)', 480);
  assert.equal(await page.locator('#playtest').isEnabled(), false);
  await page.locator('#undo').click(); assert.deepEqual(await document(), good);
  assert.equal(await page.locator('#playtest').isEnabled(), true);
  const exported = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await exported;
  const exportedFile = path.join(evidenceDir, 'exported-region.json');
  await download.saveAs(exportedFile);
  assert.deepEqual(JSON.parse(fs.readFileSync(exportedFile, 'utf8')), await document());
  const importDoc = await document(); importDoc.name = 'Imported <img src=x onerror=alert(1)>';
  importDoc.script = 'not executable';
  await page.locator('#file-input').setInputFiles({ name: 'region.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(importDoc)) });
  await page.waitForFunction(() => __regionEditor.history.current.name === 'Imported <img src=x onerror=alert(1)>');
  assert.equal((await document()).name, importDoc.name);
  assert.equal(await page.locator('#editor-ui img').count(), 0);
  assert.equal((await document()).script, undefined);
  await page.locator('#undo').click(); assert.deepEqual(await document(), good);
  const prior = await document();
  await page.locator('#file-input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":99}') });
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('Import rejected'));
  assert.deepEqual(await document(), prior);
  assert.match(await page.locator('#status').textContent(), /Import rejected/);
  await page.locator('#save').click();
  phase = 'reload and persisted-region recovery';
  const reloadStarted = Date.now();
  // Wait for the document and functioning editor explicitly. Playwright's implicit
  // 30 s load timeout previously hid the existing 120 s application-ready allowance.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
  const documentReadyMs = Date.now() - reloadStarted;
  await page.waitForFunction(() => window.__regionEditor?.preview.renderer.gl.info.render.frame >= 2, null, { timeout: 120_000 });
  report.reload = {
    documentReadyMs, editorReadyMs: Date.now() - reloadStarted,
    state: await page.evaluate(() => ({
      readyState: document.readyState,
      renderFrame: __regionEditor.preview.renderer.gl.info.render.frame,
      navigation: performance.getEntriesByType('navigation')[0]?.toJSON(),
    })),
  };
  assert.deepEqual(await document(), prior);
  assert.equal(await page.evaluate(() => localStorage['driftwing.save.v1']), '{"sentinel":"player progress untouched"}');
  assert.deepEqual(await page.evaluate(() => __editorStorageTrace), []);
  assert.deepEqual(await page.evaluate(() => __editorDbTrace), []);
  assert.deepEqual(errors, []);
  report.passed = true;
  console.log('Editor browser workflow passed: 3 edit/undo/redo/save/load/playtest/return cycles; manual placement; collision-backed validation; export/import; save/ghost isolation.');
} catch (error) {
  report.failure = { phase, message: error.message, pendingRequests: [...pendingRequests] };
  report.failure.pageState = await Promise.race([
    page.evaluate(() => ({ readyState: document.readyState, editorReady: !!window.__regionEditor })),
    new Promise(resolve => setTimeout(() => resolve('Renderer did not answer within 3 seconds'), 3000)),
  ]).catch(() => 'Page state unavailable');
  throw error;
} finally {
  fs.writeFileSync(path.join(evidenceDir, 'browser-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
