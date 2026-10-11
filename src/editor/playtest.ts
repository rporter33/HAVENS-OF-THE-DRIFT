import { Vector3 } from 'three';
import { Game } from '../game/Game';
import { LAYOUT } from '../world/layout';
import { Terrain } from '../world/terrain';
import { buildAssets } from './assets';
import { parseRegion, PLAYTEST_KEY, regionLayout, regionRace, REGION_ORIGIN } from './region';
import { sandboxSave } from './storage';
import { validateRegion } from './validation';

function returnToEditor(): void {
  if (window.parent !== window) window.parent.postMessage({ type: 'driftwing-editor-return' }, location.origin);
  else location.href = './editor.html';
}
document.getElementById('return')!.onclick = returnToEditor;
async function boot(): Promise<void> {
  const raw = sessionStorage.getItem(PLAYTEST_KEY);
  if (!raw) throw Error('Open a region in the workshop and choose Playtest.');
  const region = parseRegion(raw);
  const blockers = validateRegion(region).filter(i => i.severity === 'error');
  if (blockers.length) throw Error(blockers.map(i => i.message).join(' '));
  const save = sandboxSave();
  const race = regionRace(region, true);
  const game = new Game(document.getElementById('app')!, document.getElementById('ui')!, {
    layout: regionLayout(region, true), races: race ? [race] : [], save,
    // Keep the required Roost/shrine/dock and their original dressing. Authored islands
    // receive only the props visible in the editor, not hidden automatic decoration.
    dressingTerrain: new Terrain(LAYOUT),
  });
  const assets = buildAssets(region, game.world.terrain);
  game.scene.add(assets.group);
  game.world.terrain.colliders.addSource('authored-assets', () => assets.colliders);
  game.start();
  game.startGame();
  function fly(): void {
    game.resume();
    if (race) game.beginRace(race.id);
    else {
      const p = region.start.position;
      game.player.teleport(new Vector3(p[0] + REGION_ORIGIN.x, p[1], p[2] + REGION_ORIGIN.z), region.start.yaw * Math.PI / 180, 'flying', 26);
      game.cameraRig.snap(game.player);
    }
    game.input.setPointerLock(false);
  }
  function walk(): void {
    game.races.abort('quit'); game.resume();
    const island = game.world.terrain.islands.find(s => s.def.id === region.islands[0].id)!;
    const x = island.def.x; const z = island.def.z + Math.min(22, island.def.radius * 0.2);
    game.player.teleport(new Vector3(x, island.topHeight(x, z) + 1, z), Math.PI, 'onFoot');
    game.cameraRig.snap(game.player);
    game.input.setPointerLock(false);
  }
  document.getElementById('fly')!.onclick = fly;
  document.getElementById('walk')!.onclick = walk;
  document.getElementById('capture')!.onclick = () => { game.resume(); game.input.setPointerLock(true); };
  window.addEventListener('pagehide', () => game.stop());
  // A sandbox always exposes its own debug handle for reproducible workflow evidence.
  // It is never installed by the ordinary game entrypoint.
  (window as any).__editorPlaytest = { game, region, assets, fly, walk, ready: true };
  fly();
  document.getElementById('boot')!.remove();
}
requestAnimationFrame(() => setTimeout(() => {
  boot().catch(err => {
    const boot = document.getElementById('boot')!;
    boot.textContent = 'Playtest could not start: ' + (err as Error).message;
    const button = document.createElement('button'); button.textContent = 'Return to editor'; button.onclick = returnToEditor; boot.append(button);
  });
}, 0));
