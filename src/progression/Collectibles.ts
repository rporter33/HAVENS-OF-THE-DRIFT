// Feathers and relics hidden around the Drift, and landmark discovery.
//
// Pickup: within PICKUP_RADIUS of the rider on foot (riderPosition) or of the wyvern in the air
// (position). A find emits 'collect' (with counts), a toast, records itself in the save and
// evaluates unlocks (which emit 'unlock' + toasts of their own). Entering a landmark's vicinity
// the first time emits 'discover'. Pickups and discovery only run while active (Game turns them
// off outside play, so the title screen never announces anything). Visuals: instanced shader
// feathers, relic artifacts on pedestals, twinkling halos (see collectibleVisuals.ts). Relic
// pedestals and floating stones are solid (`colliders`, a source on the terrain's index).

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Points,
  Vector3,
  type PerspectiveCamera,
  type Scene,
} from 'three';
import type { GameEventBus } from '../core/events';
import type { Collider } from '../core/types';
import type { CollectibleSystem, PlayerSystem, SaveData, SaveStore } from '../game/contracts';
import type { QualityProfile } from '../render/quality';
import type { Terrain } from '../world/terrain';
import { lightPoolMesh } from '../world/dressing/structures/lightPools';
import { relicById, FEATHER_COUNT, RELICS } from './relics';
import { placeCollectibles, type Collectible } from './collectibleDefs';
import { FEATHER_COLORS, FEATHER_GLINT, RELIC_SCALE, buildRelic, featherGeometry, featherMaterial, haloMaterial } from './collectibleVisuals';
import { grantUnlocks } from './unlocks';
import { discoveryZones, newlyDiscovered, type DiscoveryZone } from './discovery';
import { beaconMaterial } from '../race/raceMaterials';
import { hashString } from '../core/rng';

/** Pickup reach (m): around the rider on foot, around the wyvern in flight. */
export const PICKUP_RADIUS = { foot: 4, air: 7 } as const;
/** Seconds the pickup flourish takes. */
const COLLECT_TIME = 0.9;
const TAU = Math.PI * 2;

export interface CollectiblesDeps {
  scene: Scene;
  events: GameEventBus;
  save: SaveStore & { data: SaveData };
  terrain: Terrain;
  /** The world dressing: its launch deck carries a feather. */
  dressing?: { deckAt(x: number, z: number, fromY: number): { y: number } | null; readonly colliders?: readonly Collider[] };
  quality: QualityProfile;
  /**
   * Height of the drawing buffer in pixels (the canvas, after device pixel ratio, render scale
   * and adaptive resolution), so halo glints keep their size on any screen. Defaults to the window.
   */
  viewportHeight?: () => number;
}

interface Live {
  c: Collectible;
  /** -1 waiting; 0..1 being collected; 2 gone. */
  collect: number;
  featherIndex: number;
  relic: { artifact: Group; base: Group; shaft: Mesh; spin: number } | null;
}

const _m = new Matrix4();

export class Collectibles implements CollectibleSystem {
  readonly total = { feathers: FEATHER_COUNT, relics: RELICS.length };
  readonly found = { feathers: 0, relics: 0 };
  /** The relic catalog (names and lore) for the collection screen. */
  readonly relics = RELICS;
  readonly group = new Group();
  readonly items: Collectible[];
  /** Relic pedestals and floating stones (static; a collider source on the terrain). */
  readonly colliders: Collider[] = [];
  /** Pickups and landmark discovery run only while active (play); visuals always animate. */
  active = true;

  private deps: CollectiblesDeps;
  private live: Live[] = [];
  private feathers: InstancedMesh;
  private featherInst: InstancedBufferAttribute;
  private halo: Points;
  private haloState: BufferAttribute;
  private zones: DiscoveryZone[];
  private discoverTimer = 0;
  /** Relic turn and breathing phases (radians, wrapped: no clock grows without bound). */
  private spin = 0;
  private bob = 0;
  /** The save document the visuals reflect (a reset swaps it for a fresh one). */
  private shownData: SaveData;

  constructor(deps: CollectiblesDeps) {
    this.deps = deps;
    this.group.name = 'collectibles';
    this.items = placeCollectibles({ terrain: deps.terrain, deckAt: deps.dressing ? (x, z, y) => deps.dressing!.deckAt(x, z, y) : undefined });
    this.zones = discoveryZones(deps.terrain.layout);
    this.shownData = deps.save.data;
    const collected = new Set(deps.save.data.collected);

    // Feathers: one instanced mesh.
    const feathers = this.items.filter((c) => c.kind === 'feather');
    const geo = featherGeometry();
    this.featherInst = new InstancedBufferAttribute(new Float32Array(feathers.length * 4), 4);
    const colA = new InstancedBufferAttribute(new Float32Array(feathers.length * 3), 3);
    const colB = new InstancedBufferAttribute(new Float32Array(feathers.length * 3), 3);
    geo.setAttribute('aInst', this.featherInst);
    geo.setAttribute('aColorA', colA);
    geo.setAttribute('aColorB', colB);
    this.feathers = new InstancedMesh(geo, featherMaterial(), feathers.length);
    this.feathers.frustumCulled = false;
    const ca = new Color();
    feathers.forEach((c, i) => {
      _m.makeTranslation(c.position.x, c.position.y, c.position.z);
      this.feathers.setMatrixAt(i, _m);
      const h = hashString(c.id);
      const [a, b] = FEATHER_COLORS[h % FEATHER_COLORS.length];
      ca.set(a);
      colA.setXYZ(i, ca.r, ca.g, ca.b);
      ca.set(b);
      colB.setXYZ(i, ca.r, ca.g, ca.b);
      this.featherInst.setXYZW(i, (h % 997) / 997, collected.has(c.id) ? 2 : -1, 0.9, 0);
      this.live.push({ c, collect: collected.has(c.id) ? 2 : -1, featherIndex: i, relic: null });
    });
    this.group.add(this.feathers);

    // Relics: an artifact on a pedestal (or floating stone) each, a soft shaft of light rising
    // from it (findable from afar), and warm light pools at night.
    const pools: number[] = [];
    // The shaft starts above the artifact so it never veils it.
    const shaftGeo = new CylinderGeometry(0.7, 1.4, 18, 16, 1, true);
    shaftGeo.translate(0, 9 + 1.6, 0);
    this.items
      .filter((c) => c.kind === 'relic')
      .forEach((c, i) => {
        const r = buildRelic(c.id, c.groundY === null, i);
        const restY = c.groundY !== null ? c.groundY + 0.95 : c.position.y - 0.45;
        r.base.position.set(c.position.x, c.groundY !== null ? c.groundY : c.position.y - 0.6, c.position.z);
        this.colliders.push(...relicBaseColliders(c.position.x, c.position.z, c.groundY !== null ? c.groundY : c.position.y - 0.6, c.groundY === null));
        r.artifact.position.set(c.position.x, restY, c.position.z);
        this.group.add(r.base, r.artifact);
        if (c.groundY !== null) pools.push(c.position.x, c.groundY + 0.05, c.position.z, 4.5);
        const gone = collected.has(c.id);
        r.artifact.visible = !gone;
        const shaft = new Mesh(shaftGeo, beaconMaterial(r.light, 2.2, 0.16));
        shaft.position.set(c.position.x, restY, c.position.z);
        shaft.visible = !gone;
        shaft.renderOrder = 5;
        this.group.add(shaft);
        this.live.push({ c, collect: gone ? 2 : -1, featherIndex: -1, relic: { artifact: r.artifact, base: r.base, shaft, spin: i * 0.9 } });
      });
    const poolMesh = lightPoolMesh(pools);
    if (poolMesh) this.group.add(poolMesh);

    // Halos on everything.
    const hg = new BufferGeometry();
    const n = this.live.length;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const col = new Float32Array(n * 3);
    const state = new Float32Array(n * 2);
    this.live.forEach((l, i) => {
      pos.set([l.c.position.x, l.c.position.y + (l.c.kind === 'relic' ? 0.4 : 0), l.c.position.z], i * 3);
      size[i] = l.c.kind === 'relic' ? 7 : 6.5;
      const light = new Color(l.c.kind === 'relic' ? relicLight(l.c.id) : FEATHER_GLINT);
      col.set([light.r, light.g, light.b], i * 3);
      state.set([(hashString(l.c.id) % 101) / 101, l.collect === 2 ? 0 : 1], i * 2);
    });
    hg.setAttribute('position', new BufferAttribute(pos, 3));
    hg.setAttribute('aSize', new BufferAttribute(size, 1));
    hg.setAttribute('aColor', new BufferAttribute(col, 3));
    this.haloState = new BufferAttribute(state, 2);
    hg.setAttribute('aState', this.haloState);
    this.halo = new Points(hg, haloMaterial());
    this.halo.frustumCulled = false;
    this.halo.renderOrder = 6;
    this.group.add(this.halo);

    this.recount();
    deps.scene.add(this.group);
    // Catch up an older save on unlocks it already earned (quietly).
    grantUnlocks(deps.save.data, null, true);
  }

  private recount(): void {
    let f = 0;
    let r = 0;
    for (const id of this.deps.save.data.collected) {
      const item = this.items.find((c) => c.id === id);
      if (!item) continue;
      if (item.kind === 'feather') f++;
      else r++;
    }
    this.found.feathers = f;
    this.found.relics = r;
  }

  /** Is this collectible already found? */
  has(id: string): boolean {
    return this.deps.save.data.collected.includes(id);
  }

  nearestHint(p: Vector3, range: number): Vector3 | null {
    let best: Collectible | null = null;
    let bestD = range * range;
    for (const l of this.live) {
      if (l.collect !== -1) continue;
      const d = l.c.position.distanceToSquared(p);
      if (d < bestD) {
        bestD = d;
        best = l.c;
      }
    }
    return best ? best.position : null;
  }

  /** Turn pickups and discovery on (play) or off (title, menus, the stable). */
  setActive(on: boolean): void {
    this.active = on;
  }

  update(dt: number, camera: PerspectiveCamera, player: PlayerSystem): void {
    this.spin = (this.spin + dt * 0.45) % TAU;
    this.bob = (this.bob + dt * 1.3) % TAU;
    if (this.deps.save.data !== this.shownData) this.resetFromSave();
    // Pickups follow the independent rider, or the wyvern carrying them.
    const onFoot = player.mode === 'onFoot' || player.mode === 'traversing';
    const reach = onFoot ? PICKUP_RADIUS.foot : PICKUP_RADIUS.air;
    const from = onFoot ? player.riderPosition : player.position;
    const r2 = reach * reach;
    const canPick = this.active && player.mode !== 'respawning' && player.mode !== 'falling';
    let dirty = false;
    for (let i = 0; i < this.live.length; i++) {
      const l = this.live[i];
      if (l.collect === -1) {
        // Ground relics also count the rider standing at the pedestal (artifact sits higher).
        if (canPick && l.c.position.distanceToSquared(from) <= r2) this.pick(l);
        else continue;
      }
      if (l.collect >= 0 && l.collect < 1.5) {
        l.collect = Math.min(1, l.collect + dt / COLLECT_TIME);
        if (l.collect >= 1) l.collect = 2;
        dirty = true;
        this.haloState.setY(i, l.collect === 2 ? 0 : 1 + l.collect * 2);
        if (l.relic) {
          const c = Math.min(1, l.collect);
          l.relic.artifact.position.y += dt * 2.5 * c;
          l.relic.artifact.scale.setScalar(RELIC_SCALE * (1 + 0.4 * c) * (1 - Math.max(0, (c - 0.6) / 0.4)));
          if (l.collect === 2) l.relic.artifact.visible = false;
          l.relic.shaft.visible = l.collect !== 2;
          l.relic.shaft.scale.set(1 + c * 2, 1 + c, 1 + c * 2);
        } else {
          this.featherInst.setY(l.featherIndex, l.collect);
        }
      }
    }
    if (dirty) {
      this.featherInst.needsUpdate = true;
      this.haloState.needsUpdate = true;
    }
    // Relics turn slowly and breathe.
    for (const l of this.live) {
      if (!l.relic || l.collect === 2) continue;
      const a = l.relic.artifact;
      a.rotation.y = this.spin + l.relic.spin;
      if (l.collect === -1) a.position.y = (l.c.groundY !== null ? l.c.groundY + 0.95 : l.c.position.y - 0.45) + 0.06 * Math.sin(this.bob + l.relic.spin);
    }
    // Halo size follows the view so glints stay a sensible size on any screen.
    (this.halo.material as import('three').ShaderMaterial).uniforms.uPixelScale.value = this.pixelScale(camera);

    // Discovery, a few times a second (the first check runs on the first active frame).
    if (!this.active) {
      this.discoverTimer = 0;
      return;
    }
    this.discoverTimer -= dt;
    if (this.discoverTimer <= 0) {
      this.discoverTimer = 0.25;
      this.discover(player.riderPosition);
    }
  }

  /**
   * Points are sized in world meters: pixels = size × (buffer height / 2) / tan(fov/2) / distance.
   * gl_PointSize is in drawing-buffer pixels, so this must be the buffer's height, not the window's.
   */
  pixelScale(camera: PerspectiveCamera): number {
    const h = this.deps.viewportHeight?.() || (typeof window !== 'undefined' ? window.innerHeight * Math.min(2, window.devicePixelRatio || 1) : 1080);
    return h / 2 / Math.tan((camera.fov * Math.PI) / 360);
  }

  private pick(l: Live): void {
    l.collect = 0;
    const save = this.deps.save;
    if (!save.data.collected.includes(l.c.id)) save.data.collected.push(l.c.id);
    this.recount();
    const isFeather = l.c.kind === 'feather';
    const total = isFeather ? this.found.feathers : this.found.relics;
    const ofTotal = isFeather ? this.total.feathers : this.total.relics;
    const ev = this.deps.events;
    ev.emit('collect', { id: l.c.id, kind: l.c.kind, name: l.c.name, position: l.c.position.clone(), total, ofTotal });
    if (isFeather) ev.emit('toast', { text: `Feather ${total} of ${ofTotal}`, sub: `Found at ${l.c.where}`, icon: 'feather' });
    else ev.emit('toast', { text: l.c.name, sub: relicById(l.c.id)?.lore, icon: 'relic' });
    grantUnlocks(save.data, ev);
    save.save();
  }

  private discover(p: Vector3): void {
    const save = this.deps.save;
    for (const z of newlyDiscovered(this.zones, save.data.discovered, p.x, p.y, p.z)) {
      save.data.discovered.push(z.landmarkId);
      const lm = this.deps.terrain.layout.landmarks.find((l) => l.id === z.landmarkId);
      this.deps.events.emit('discover', { landmarkId: z.landmarkId, name: z.name });
      this.deps.events.emit('toast', { text: z.name, sub: lm?.description, icon: 'info' });
      save.save();
    }
  }

  /** Reset visuals after the save was reset (everything back in place). */
  resetFromSave(): void {
    this.shownData = this.deps.save.data;
    const collected = new Set(this.deps.save.data.collected);
    this.live.forEach((l, i) => {
      l.collect = collected.has(l.c.id) ? 2 : -1;
      if (l.featherIndex >= 0) this.featherInst.setY(l.featherIndex, l.collect);
      if (l.relic) {
        l.relic.artifact.visible = l.collect !== 2;
        l.relic.artifact.scale.setScalar(RELIC_SCALE);
        l.relic.shaft.visible = l.collect !== 2;
        l.relic.shaft.scale.set(1, 1, 1);
      }
      this.haloState.setY(i, l.collect === 2 ? 0 : 1);
    });
    this.featherInst.needsUpdate = true;
    this.haloState.needsUpdate = true;
    this.recount();
  }
}

function relicLight(id: string): string {
  return { 'relic-ember': '#ff9a4a', 'relic-antler': '#fff0c8', 'relic-mane': '#bfe8ff', 'relic-ribbon': '#ffd27a', 'relic-howdah': '#7fe0ff', 'relic-charts': '#ffe0a0', 'relic-circlet': '#ffb459' }[id] ?? '#ffe0a0';
}


/**
 * A relic's base as collision shapes: a pedestal is a squat stone box (its top at the visible
 * ~1 m, which a rider can step onto); a floating stone is a slab with its crag hanging beneath.
 */
export function relicBaseColliders(x: number, z: number, y: number, floating: boolean): Collider[] {
  if (!floating) return [{ kind: 'box', x, y: y + 0.5, z, hx: 0.5, hy: 0.5, hz: 0.5, yaw: 0, surface: 'stone' }];
  return [
    { x, z, radius: 1.25, y0: y - 0.9, y1: y + 0.15, surface: 'stone' },
    { x, z, radius: 0.7, y0: y - 2.6, y1: y - 0.9, surface: 'stone' },
  ];
}
