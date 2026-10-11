import { describe, expect, it } from 'vitest';
import { Color, PerspectiveCamera, SRGBColorSpace, Scene, Vector3, type Points } from 'three';
import { EventBus } from '../core/events';
import type { GameEvents, PlayerMode } from '../core/types';
import type { PlayerSystem } from '../game/contracts';
import { LAYOUT } from '../world/layout';
import { Terrain } from '../world/terrain';
import { QUALITY } from '../render/quality';
import { Dressing } from '../world/dressing/Dressing';
import { LocalSaveStore, MemoryGhostStore } from './save';
import { Collectibles, PICKUP_RADIUS } from './Collectibles';
import { ColliderIndex } from '../world/colliders';
import { discoveryZones, inZone, newlyDiscovered } from './discovery';
import { featherId } from './relics';
import { FEATHER_COLORS, FEATHER_GLINT } from './collectibleVisuals';

const terrain = new Terrain(LAYOUT);
const camera = new PerspectiveCamera(60, 16 / 9, 0.5, 5000);
const dressing = new Dressing({ scene: new Scene(), terrain, quality: QUALITY.low, asyncStreaming: false });

function setup(collected: string[] = [], viewportHeight?: () => number) {
  const events = new EventBus<GameEvents>();
  const log: { type: string; payload: any }[] = [];
  for (const type of ['collect', 'unlock', 'discover', 'toast'] as const) events.on(type, (payload) => log.push({ type, payload }));
  const save = new LocalSaveStore({ storage: null, ghosts: new MemoryGhostStore() });
  save.data.collected.push(...collected);
  const sys = new Collectibles({ scene: new Scene(), events, save, terrain, dressing, quality: QUALITY.low, viewportHeight });
  const player = {
    mode: 'flying' as PlayerMode,
    position: new Vector3(0, 5000, 0),
    riderPosition: new Vector3(0, 5000, 0),
  };
  const step = (dt = 1 / 30) => sys.update(dt, camera, player as unknown as PlayerSystem);
  return { events, log, save, sys, player, step };
}

describe('collectible pickup', () => {
  it('picks up a feather when the wyvern flies within reach, once', () => {
    const { log, save, sys, player, step } = setup();
    const f = sys.items.find((c) => c.access === 'air' && c.kind === 'feather')!;
    player.position.copy(f.position).add(new Vector3(PICKUP_RADIUS.air + 0.5, 0, 0));
    step();
    expect(log.filter((e) => e.type === 'collect')).toHaveLength(0);
    player.position.copy(f.position).add(new Vector3(PICKUP_RADIUS.air - 0.5, 0, 0));
    step();
    step();
    const got = log.filter((e) => e.type === 'collect');
    expect(got).toHaveLength(1);
    expect(got[0].payload).toMatchObject({ id: f.id, kind: 'feather', total: 1, ofTotal: 48 });
    expect(save.data.collected).toEqual([f.id]);
    expect(sys.found).toEqual({ feathers: 1, relics: 0 });
    expect(log.some((e) => e.type === 'toast' && e.payload.icon === 'feather')).toBe(true);
  });

  it.each(['onFoot', 'traversing'] as const)('%s reach is measured from the rider and is shorter', mode => {
    const { log, sys, player, step } = setup();
    const f = sys.items.find((c) => c.id === featherId(0))!; // the launch deck
    expect(f.access).toBe('foot');
    player.mode = mode;
    player.position.set(0, 5000, 0); // the wyvern is far away: irrelevant on foot
    player.riderPosition.copy(f.position).add(new Vector3(PICKUP_RADIUS.foot + 1, -1.3, 0));
    step();
    expect(log.some((e) => e.type === 'collect')).toBe(false);
    player.riderPosition.copy(f.position).add(new Vector3(2, -1.3, 0));
    step();
    expect(log.find((e) => e.type === 'collect')?.payload.id).toBe(f.id);
  });

  it('a relic announces its lore and unlocks its cosmetic', () => {
    const { log, sys, player, step } = setup();
    const r = sys.items.find((c) => c.id === 'relic-ember')!;
    player.position.copy(r.position);
    step();
    expect(log.find((e) => e.type === 'collect')?.payload).toMatchObject({ id: 'relic-ember', kind: 'relic', name: 'Ember Scale', total: 1, ofTotal: 7 });
    expect(log.find((e) => e.type === 'toast' && e.payload.icon === 'relic')?.payload.sub).toMatch(/falls/);
    expect(log.find((e) => e.type === 'unlock')?.payload).toMatchObject({ cosmeticId: 'ember', slot: 'wyvernPattern' });
  });

  it('feather counts unlock at their thresholds', () => {
    const { log, sys, player, step } = setup([featherId(10), featherId(11), featherId(12), featherId(13)]);
    expect(sys.found.feathers).toBe(4);
    // The 4-feather cap was already earned; it was granted quietly at load.
    const fifth = sys.items.find((c) => c.kind === 'feather' && !sys.has(c.id))!;
    player.position.copy(fifth.position);
    step();
    expect(log.filter((e) => e.type === 'unlock').map((e) => e.payload.cosmeticId)).toEqual(['stripes']);
  });

  it('collected ones are gone from hints; hints find the nearest within range', () => {
    const { sys } = setup([featherId(0)]);
    const deck = sys.items.find((c) => c.id === featherId(0))!;
    const near = sys.nearestHint(deck.position, 30);
    expect(near === null || !near.equals(deck.position)).toBe(true);
    expect(sys.nearestHint(new Vector3(0, 9000, 0), 50)).toBeNull();
  });

  it('a reset save brings everything back', () => {
    const { save, sys, step } = setup([featherId(0), 'relic-charts']);
    expect(sys.found).toEqual({ feathers: 1, relics: 1 });
    save.reset();
    step();
    expect(sys.found).toEqual({ feathers: 0, relics: 0 });
    expect(sys.nearestHint(sys.items.find((c) => c.id === featherId(0))!.position, 1)).not.toBeNull();
  });
});

describe('landmark discovery', () => {
  const zones = discoveryZones(LAYOUT);

  it('every landmark has a zone that contains its own point of interest', () => {
    expect(zones.map((z) => z.landmarkId).sort()).toEqual(LAYOUT.landmarks.map((l) => l.id).sort());
    for (const l of LAYOUT.landmarks) {
      const z = zones.find((zz) => zz.landmarkId === l.id)!;
      expect(inZone(z, ...l.position), l.id).toBe(true);
    }
    // Open sky far from everything is nobody's vicinity.
    expect(zones.some((z) => inZone(z, 0, 2000, 2700))).toBe(false);
  });

  it('discovers once, on entering, and announces it', () => {
    const { log, save, player, step } = setup();
    const gull = LAYOUT.landmarks.find((l) => l.id === 'gullrest')!;
    player.riderPosition.set(...gull.position);
    step(0.3);
    step(0.3);
    const found = log.filter((e) => e.type === 'discover');
    expect(found).toHaveLength(1);
    expect(found[0].payload).toEqual({ landmarkId: 'gullrest', name: "Gull's Rest" });
    expect(save.data.discovered).toContain('gullrest');
    expect(newlyDiscovered(zones, save.data.discovered, ...gull.position)).toEqual([]);
  });
});

describe('only during play (PLAY-15)', () => {
  it('announces and collects nothing while inactive (the title screen), then catches up at once', () => {
    const { log, save, sys, player, step } = setup();
    sys.setActive(false);
    const gull = LAYOUT.landmarks.find((l) => l.id === 'gullrest')!;
    const f = sys.items.find((c) => c.access === 'air' && c.kind === 'feather')!;
    player.riderPosition.set(...gull.position);
    player.position.copy(f.position);
    for (let i = 0; i < 10; i++) step(0.3);
    expect(log).toHaveLength(0);
    expect(save.data.discovered).not.toContain('gullrest');
    expect(save.data.collected).toHaveLength(0);
    // Play begins: the first frame discovers and picks up.
    sys.setActive(true);
    step(1 / 60);
    expect(log.filter((e) => e.type === 'discover').map((e) => e.payload.landmarkId)).toContain('gullrest');
    expect(log.find((e) => e.type === 'collect')?.payload.id).toBe(f.id);
  });
});

describe('halo glints are sized for the drawing buffer (HALO-01)', () => {
  it('uses the buffer height it is given', () => {
    const { sys } = setup([], () => 675);
    const cam = new PerspectiveCamera(60, 16 / 9, 0.5, 5000);
    expect(sys.pixelScale(cam)).toBeCloseTo(675 / 2 / Math.tan(Math.PI / 6), 6);
  });
});

describe('relic bases are solid', () => {
  it('every relic stands on a pedestal or stone you collide with, without walling off its pickup', () => {
    const { sys } = setup();
    const index = new ColliderIndex();
    index.addAll(sys.colliders);
    const relics = sys.items.filter((c) => c.kind === 'relic');
    expect(relics.length).toBe(7);
    const n = new Vector3();
    for (const r of relics) {
      const base = r.groundY !== null ? new Vector3(r.position.x, r.groundY + 0.4, r.position.z) : r.position.clone().add(new Vector3(0, -1.2, 0));
      expect(index.resolveSphere(base.clone(), 0.3, n), r.id).toBe(true);
      // The rider can reach the relic: a point within foot reach of it is free.
      const reach = r.position.clone().add(new Vector3(PICKUP_RADIUS.foot - 1.5, 0, 0));
      expect(index.resolveSphere(reach, 0.3, n), r.id).toBe(false);
    }
  });
});

describe('feathers look like treasure (VIS-23)', () => {
  const hsl = { h: 0, s: 0, l: 0 };
  it('every colorway runs from a saturated base out to a gold tip, and every feather glints gold', () => {
    for (const [base, tip] of FEATHER_COLORS) {
      new Color(tip).getHSL(hsl, SRGBColorSpace);
      expect(hsl.h * 360, tip).toBeGreaterThan(28);
      expect(hsl.h * 360, tip).toBeLessThan(50);
      expect(hsl.s, tip).toBeGreaterThan(0.6);
      // The base is a different, deeper color than the gilding (pearl is the one pale exception).
      new Color(base).getHSL(hsl, SRGBColorSpace);
      expect(hsl.l, base).toBeLessThan(0.75);
    }
    new Color(FEATHER_GLINT).getHSL(hsl, SRGBColorSpace);
    expect(hsl.h * 360).toBeGreaterThan(28);
    expect(hsl.h * 360).toBeLessThan(50);
    const { sys } = setup();
    const halo = sys.group.children.find((c) => (c as { isPoints?: boolean }).isPoints) as Points;
    const color = halo.geometry.getAttribute('aColor');
    const glint = new Color(FEATHER_GLINT);
    sys.items.forEach((c, i) => {
      if (c.kind !== 'feather') return;
      expect([color.getX(i), color.getY(i), color.getZ(i)]).toEqual([glint.r, glint.g, glint.b].map((v) => Math.fround(v)));
    });
  });
});
