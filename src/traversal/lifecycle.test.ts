import { afterEach, describe, expect, it, vi } from 'vitest';
import { BufferGeometry, Group, Material, Mesh, Line } from 'three';
import { Game } from '../game/Game';
import showcase from '../debug/showcases/skyLance';
import { Player } from '../player/Player';
import { Terrain } from '../world/terrain';
import { LAYOUT } from '../world/layout';
import { EventBus } from '../core/events';
import type { GameEvents } from '../core/types';
import { emptyFrame } from '../input/Input';
import { DEFAULT_SETTINGS } from '../game/settings';

class Node {
  id = ''; style = {}; textContent = ''; innerHTML = ''; onclick: (() => void) | null = null;
  removed = false; children = new Map<string, Node>();
  querySelector(selector: string): Node { if (!this.children.has(selector)) this.children.set(selector, new Node()); return this.children.get(selector)!; }
  setAttribute() {} remove() { this.removed = true; }
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function rig(practice = true) {
  const nodes: Node[] = [], listeners = new Map<string, () => void>();
  vi.stubGlobal('document', { createElement: () => new Node(), body: { append: (node: Node) => nodes.push(node) } });
  vi.stubGlobal('window', { addEventListener: (name: string, fn: () => void) => listeners.set(name, fn), removeEventListener: (name: string) => listeners.delete(name) });
  const terrain = new Terrain(LAYOUT), events = new EventBus<GameEvents>();
  const player = new Player({ terrain, env: { terrain, windAt: (_p, out) => out.set(0, 0, 0) }, events, breed: 'harrier' });
  player.placeAtSpawn();
  // Run actual Game lifecycle methods without constructing a renderer or parallel game loop.
  const game: Game = Object.assign(Object.create(Game.prototype), {
    scene: new Group(), world: { terrain }, player, events, showcase: practice ? showcase : null, screen: 'play', adaptiveGrace: 0,
    cameraRig: { snap: vi.fn(), setOverride: vi.fn() }, skyLanceVisuals: null,
    audio: { setScreen: vi.fn(), applySettings: vi.fn() }, ui: { setScreen: vi.fn(), enableWindline: vi.fn(), disableWindline: vi.fn() }, collectibles: { setActive: vi.fn() }, input: { setPointerLock: vi.fn() },
    races: { activeId: null, resetProgress: vi.fn(), setShowGhost: vi.fn() }, save: { reset: vi.fn(), save: vi.fn(), data: { wyvern: {}, rider: {}, settings: {...DEFAULT_SETTINGS} } },
    research: { refresh: vi.fn() }, firstLead: { setStage: vi.fn() },
    previewWyvernLook: vi.fn(), previewRiderLook: vi.fn(),
  });
  if (practice) showcase.setup(game, new URLSearchParams());
  else game['enableWindline']();
  return { game, player, terrain, nodes, listeners };
}
describe('experimental scene lifecycle', () => {
  it.each(['stop', 'pagehide'] as const)('%s releases owned geometry, DOM, source and listener without touching unrelated geometry', path => {
    const r = rig(), geometry = new Set<BufferGeometry>(), materials = new Set<Material>();
    r.game.scene.traverse(object => {
      if (object instanceof Mesh || object instanceof Line) {
        geometry.add(object.geometry);
        for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m);
      }
    });
    const geometrySpies = [...geometry].map(g => vi.spyOn(g, 'dispose'));
    const materialSpies = [...materials].map(m => vi.spyOn(m, 'dispose'));
    const unrelated = { kind: 'sphere' as const, x: 9000, y: 1000, z: 9000, radius: 1 }; r.terrain.colliders.add(unrelated);
    const lance = r.player.skyLance!; lance.beginCharge();
    if (path === 'stop') r.game.stop(); else r.listeners.get('pagehide')!();
    r.game.stop(); // Idempotent after either entry point.
    expect(r.player.skyLance).toBeNull(); expect(lance.state).toBe('ready'); expect(lance.charging).toBe(false);
    expect(r.game.skyLanceVisuals).toBeNull(); expect(r.game.scene.children).toHaveLength(0);
    expect(r.nodes.every(n => n.removed)).toBe(true); expect(r.nodes[0].querySelector('button').onclick).toBeNull();
    expect(r.listeners.size).toBe(0); expect(r.terrain.colliders.size).toBe(1); expect(r.terrain.colliders.contains(unrelated)).toBe(true);
    for (const spy of [...geometrySpies, ...materialSpies]) expect(spy).toHaveBeenCalledTimes(1);
  });
  it('bfcache suspension preserves the scene while clearing queued input', () => {
    const r = rig(); r.player.skyLance!.beginCharge();
    (r.listeners.get('pagehide') as (event: { persisted: boolean }) => void)({ persisted: true });
    expect(r.player.skyLance).not.toBeNull(); expect(r.player.skyLance!.charging).toBe(false);
    expect(r.nodes.every(n => !n.removed)).toBe(true); expect(r.listeners.size).toBe(1); r.game.stop();
  });
  it('actual pause/resume clears buffered windup actions without replaying a cast', () => {
    const r = rig(), input = emptyFrame(); input.pressed.lance = true; input.lanceHeld = true;
    r.player.latchPresses(input); r.game.pause(); r.game.resume();
    r.player.fixedUpdate(1 / 120, emptyFrame(), 0);
    expect(r.player.skyLance!.state).toBe('ready'); expect(r.player.skyLance!.charging).toBe(false);
    r.game.stop();
  });
  it('actual save-reset path clears live equipment and queued actions through spawn reset', () => {
    const r = rig(), input = emptyFrame(); input.pressed.lance = input.pressed.jump = true;
    r.player.skyLance!.beginCharge(); r.player.latchPresses(input); r.game.resetProgress();
    r.player.fixedUpdate(1 / 120, emptyFrame(), 0);
    expect(r.game.save.reset).toHaveBeenCalledTimes(1); expect(r.player.skyLance!.state).toBe('ready');
    expect(r.player.skyLance!.anchorId).toBeNull(); expect(r.player.foot.grounded).toBe(true); r.game.stop();
  });
});

describe('normal-game Windline lifecycle', () => {
  it('uses only the shared world and disposes normal equipment once', () => {
    const r = rig(false), lance = r.player.skyLance!, visuals = r.game.skyLanceVisuals!;
    expect(r.terrain.colliders.size).toBe(0); // Neither practice platforms nor the ship were installed.
    expect(r.game.ui.enableWindline).toHaveBeenCalledOnce();
    expect(r.player.foot.grounded).toBe(true);
    const dispose = vi.spyOn(visuals, 'dispose');
    r.game.stop(); r.game.stop();
    expect(dispose).toHaveBeenCalledOnce(); expect(r.game.ui.disableWindline).toHaveBeenCalledOnce();
    expect(r.player.skyLance).toBeNull(); expect(lance.state).toBe('ready');
  });
  it('applies the persisted toggle setting and clears a live cast when changed', () => {
    const r = rig(false), lance = r.player.skyLance!;
    lance.beginCharge();
    r.game.applySettings({...r.game.settings, windlineToggle: true});
    expect(r.player.lanceInteraction).toBe('toggle'); expect(lance.charging).toBe(false);
    expect(r.game.save.save).toHaveBeenCalledOnce();
    r.game.applySettings({...r.game.settings, windlineToggle: false});
    expect(r.player.lanceInteraction).toBe('hold'); r.game.stop();
  });
});
