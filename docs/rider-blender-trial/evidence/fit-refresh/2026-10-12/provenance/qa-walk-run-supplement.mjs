// QA-only supplement: visible on-foot gameplay, retaining the full-fit transition report.
// This file lives outside the trial. It changes no runtime, assets, owner profiles or world data.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const trial = 'C:/Users/Robert/.codex/worktrees/rider-blender-trial/Driftwing';
const require = createRequire(path.join(trial, 'package.json'));
const { chromium } = require('playwright');
const origin = process.argv.find(arg => /^https?:/.test(arg)) ?? 'http://127.0.0.1:5210';
if (new URL(origin).hostname !== '127.0.0.1') throw Error('This supplement is for the isolated local trial only');
const script = fileURLToPath(import.meta.url);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(path.dirname(script), 'walk-run-supplement', stamp + '-' + crypto.randomUUID().slice(0, 8));
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.mkdir(output); // Never reuse or replace an earlier evidence directory.
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceFiles = [
  'package.json', 'package-lock.json', 'docs/rider-blender-trial/ASSET_MANIFEST.json',
  'src/assets/rider-blender/rider-trial.glb', 'assets/rider-blender/source/rider-trial.blend',
  'src/creatures/rider/Rider.ts', 'src/creatures/rider/model.ts',
  'src/creatures/rider/windkeelHarness.ts', 'src/creatures/rider/windkeelContact.ts',
  'src/creatures/rider/authoredConstruction.ts', 'src/debug/hooks.ts',
  'src/input/Input.ts', 'src/camera/CameraRig.ts', 'src/camera/followRigs.ts',
  'src/player/Player.ts', 'src/player/foot.ts',
];
async function sourceHashes() {
  return Promise.all(sourceFiles.map(async file => {
    const bytes = await fs.readFile(path.join(trial, file));
    return { file, bytes: bytes.length, sha256: hash(bytes) };
  }));
}
const asset = JSON.parse(await fs.readFile(path.join(trial, 'docs/rider-blender-trial/ASSET_MANIFEST.json'), 'utf8'));
const report = {
  startedUtc: new Date().toISOString(), origin, trial, output,
  scope: 'Eight supplemental scripted on-foot gameplay captures: Medium Travel and Flight, walk/run, front/back; actual follow rig without override. The separate full-fit report owns actual takeoff, landing, dismount and both mounted sides.',
  profile: 'Fresh nonpersistent Edge context per outfit; no owner profile or existing saves opened.',
  staging: 'Existing terrain standingPoint at spawn +24,+4, normal Player.teleport to onFoot. No world, terrain, companion, camera tuning or runtime asset edits.',
  input: 'Every advance receives explicit scripted input: {} while settling; declared foot controls while moving. Every render receives explicit {} and restores live input afterward.',
  cameraContract: 'Actual on-foot follow rig; yaw/pitch orbit only; collisions enabled; no camera override or custom camera matrix.',
  limits: 'Software-rendered appearance/state evidence; visual review is required. No controller, hardware-performance, exhaustive contact, cloth-self-collision or near-concept-fidelity certification.',
  baselineHead: { value: '8e055069703c83308d5508ee72e5ad1d15ef348e', meaning: 'Previously read local branch HEAD only; dirty implementation is identified by file hashes, not HEAD.' },
  tools: { node: process.version, nodeExecutable: process.execPath, platform: process.platform,
    playwright: require('playwright/package.json').version, script: { file: script, sha256: hash(await fs.readFile(script)) } },
  asset: { file: asset.export, bytes: asset.bytes, sha256: asset.sha256, sourceSha256: asset.sourceSha256 },
  sourcesBefore: await sourceHashes(), cases: [], captures: [], errors: [],
};
const actualAsset = report.sourcesBefore.find(row => row.file === asset.export);
if (actualAsset?.sha256 !== asset.sha256 || actualAsset?.bytes !== asset.bytes) throw Error('Local GLB does not match asset manifest');
const native = report.sourcesBefore.find(row => row.file === asset.source);
if (native?.sha256 !== asset.sourceSha256) throw Error('Editable source does not match asset manifest');
const saveReport = () => fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
await saveReport();
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  report.tools.browser = browser.version();
  for (const outfit of ['travel-drape', 'flight']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const row = { outfit, build: 'medium', responses: [], captures: [] };
    report.cases.push(row);
    page.on('pageerror', error => report.errors.push({ outfit, kind: 'pageerror', error: String(error) }));
    page.on('console', message => { if (message.type() === 'error') report.errors.push({ outfit, kind: 'console', error: message.text() }); });
    page.on('response', response => { if (/rider-trial[^/]*\.glb/.test(response.url())) row.responses.push({ url: response.url(), status: response.status() }); });
    try {
      await page.goto(origin + '/?manual=1&quality=high&weather=clear&tod=.42&riderTrial=blender', { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForFunction(() => window.__dw?.ready && window.__dw.game.rider.trialState.status === 'ready', null, { timeout: 120000 });
      if (!row.responses.length) throw Error('No selected runtime GLB response observed');
      const url = row.responses.at(-1).url;
      const delivered = await page.request.get(url, { timeout: 120000 });
      try {
        const bytes = await delivered.body();
        row.deliveredAsset = { method: 'Separate same-URL GET after runtime readiness; endpoint bytes at verification time', url,
          status: delivered.status(), bytes: bytes.length, sha256: hash(bytes) };
        if (!delivered.ok() || row.deliveredAsset.sha256 !== asset.sha256) throw Error('Served GLB differs from local asset manifest');
      } finally { await delivered.dispose(); }
      await page.evaluate(async outfit => {
        const { DEFAULT_RIDER } = await import('/src/cosmetics/catalog.ts');
        window.__dw.game.setRiderLook({ ...DEFAULT_RIDER, outfit, build: 'medium', hair: 'ponytail',
          headgear: 'none', scarf: 'none', cape: 'none', outfitPrimary: '#f2eada', outfitSecondary: '#7fa8c4' });
      }, outfit);
      for (const action of ['walk', 'run']) for (const view of ['front', 'back']) {
        const state = await page.evaluate(async ({ action, view, outfit }) => {
          const { Vector3 } = await import('/node_modules/three/build/three.module.js');
          const h = window.__dw, g = h.game, p = g.player, r = g.rider, spawn = g.world.layout.spawn.position;
          const at = p.foot.position.clone();
          g.world.terrain.standingPoint(spawn[0] + 24, spawn[2] + 4, at);
          g.setScreen('play');
          p.teleport(at, 0, 'onFoot');
          g.cameraRig.setOverride(null);
          g.cameraRig.snap(p);
          h.advance(.1, {});
          const rig = g.cameraRig.rigs.foot;
          rig.view.yaw = view === 'front' ? Math.PI : 0;
          rig.view.pitch = .14;
          rig.lookIdle = 0;
          rig.recenterT = 0;
          h.advance(.1, {});
          const start = p.foot.position.clone();
          // Foot controls are camera-relative. Reverse moveY in the front orbit to
          // keep both views travelling +Z with the same rider-facing direction.
          const controls = { foot: { moveX: 0, moveY: view === 'front' ? -1 : 1, sprint: action === 'run' } };
          h.advance(.45, controls);
          g.input.setScripted({});
          try { h.render(); } finally { g.input.setScripted(null); }
          g.scene.updateMatrixWorld(true);
          const m = r.model, fit = m.harness;
          if (!fit) throw Error('No selected equipment');
          m.rig.skeleton.update();
          const finiteMesh = mesh => {
            const point = new Vector3();
            for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
              mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
              if (!point.toArray().every(Number.isFinite)) return false;
            }
            return true;
          };
          const sockets = {};
          for (const name of Object.keys(fit.sockets ?? {})) {
            const point = new Vector3(); sockets[name] = { available: r.equipmentSocket(name, point), world: point.toArray() };
          }
          const finite = finiteMesh(m.mesh) && finiteMesh(fit.mesh)
            && r.cloth.pieces.every(piece => Array.from(piece.pos).every(Number.isFinite))
            && g.camera.position.toArray().every(Number.isFinite)
            && g.camera.quaternion.toArray().every(Number.isFinite)
            && p.riderPose.position.toArray().every(Number.isFinite);
          const gl = g.renderer.gl.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
          const cameraOffset = g.camera.position.clone().sub(p.riderPose.position);
          const forward = new Vector3(Math.sin(p.riderPose.yaw), 0, Math.cos(p.riderPose.yaw));
          const facingDot = cameraOffset.clone().setY(0).normalize().dot(forward);
          return {
            outfit, action, view, requestedXZ: [spawn[0] + 24, spawn[2] + 4], standingPoint: at.toArray(),
            screen: g.screen, camera: g.cameraRig.rig, overrideActive: g.cameraRig.override !== null,
            mode: p.mode, look: r.look, actualBuild: m.ctx.d.build, provider: r.trialState,
            harness: { kind: fit.kind, visible: fit.mesh.visible, sharedSkeleton: fit.mesh.skeleton === m.rig.skeleton, sockets },
            importedRegions: m.importedRegions, finite, errors: [...h.errors],
            movement: { seconds: .45, start: start.toArray(), finish: p.foot.position.toArray(), displacement: start.distanceTo(p.foot.position),
              controls, speed: p.foot.speed, velocity: p.foot.velocity.toArray(), grounded: p.foot.grounded,
              poseAction: p.riderPose.action, poseActionTime: p.riderPose.actionTime },
            player: { position: p.riderPose.position.toArray(), yaw: p.riderPose.yaw, velocity: p.riderPose.velocity.toArray(), mounted: p.riderPose.mounted },
            cameraState: { position: g.camera.position.toArray(), quaternion: g.camera.quaternion.toArray(), projection: g.camera.projectionMatrix.toArray(),
              facingDot, orbit: { yaw: rig.view.yaw, pitch: rig.view.pitch, lookIdle: rig.lookIdle, recenterT: rig.recenterT },
              terrainCollision: 'Existing actual follow rig enabled; no tuning replacement or override' },
            renderer: { vendor: gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
              renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER), stats: h.stats() },
            clothPanels: r.cloth.pieces.filter(piece => piece.spec.name.startsWith('garment-travel-drape-')).length,
            contactDiagnostics: fit.geometry.userData.windkeelContact ?? null, boot: h.boot,
          };
        }, { action, view, outfit });
        if (state.screen !== 'play' || state.mode !== 'onFoot' || state.camera !== 'foot' || state.overrideActive)
          throw Error('Supplement lost actual on-foot gameplay camera');
        if (state.provider.status !== 'ready' || state.harness.kind !== 'windkeel' || !state.harness.visible || !state.harness.sharedSkeleton)
          throw Error('Supplement fell back or lost selected shared-skeleton equipment');
        if (state.look.outfit !== outfit || state.actualBuild !== 'medium' || state.look.hair !== 'ponytail') throw Error('Wrong selected appearance');
        if (Object.keys(state.harness.sockets).length !== 4 || !Object.values(state.harness.sockets).every(socket => socket.available && socket.world.every(Number.isFinite))) throw Error('Four equipment sockets were not retained');
        if (!state.finite || state.errors.length || state.movement.displacement <= .3 || !state.movement.grounded || state.movement.poseAction !== action)
          throw Error('Invalid real locomotion/finite state: ' + JSON.stringify(state.movement));
        if (view === 'front' ? state.cameraState.facingDot <= 0 : state.cameraState.facingDot >= 0) throw Error('Requested front/back camera does not face the expected rider side');
        if (outfit === 'travel-drape' && (!state.importedRegions.includes('piece:shoulderDrape:aerie') || state.clothPanels !== 4)) throw Error('Travel shoulder or live skirt missing');
        const name = 'medium-' + outfit + '-' + action + '-' + view;
        const file = path.join(output, name + '.png');
        await page.screenshot({ path: file, animations: 'disabled' });
        const capture = { name, file, sha256: hash(await fs.readFile(file)), url: page.url(), ...state };
        row.captures.push(name); report.captures.push(capture);
        await saveReport(); console.log('CAPTURE ' + name);
      }
    } finally { await context.close(); }
  }
  if (report.captures.length !== 8 || report.errors.length) throw Error('Incomplete or errored supplement');
} catch (error) {
  report.failure = String(error); process.exitCode = 1; console.error(error);
} finally {
  if (browser) await browser.close();
  report.sourcesAfter = await sourceHashes();
  report.sourcesUnchanged = JSON.stringify(report.sourcesBefore) === JSON.stringify(report.sourcesAfter);
  if (!report.sourcesUnchanged) { report.failure = (report.failure ?? '') + ' Source bytes changed during capture'; process.exitCode = 1; }
  report.finishedUtc = new Date().toISOString(); await saveReport();
}
console.log(JSON.stringify({ output, captures: report.captures.length, errors: report.errors, failure: report.failure,
  sourcesUnchanged: report.sourcesUnchanged, visualReviewRequired: true }, null, 2));
