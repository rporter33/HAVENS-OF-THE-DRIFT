// Stand-ins for systems that are still baselines (races, collectibles) so the UI showcases can
// stage every screen: a handful of race courses with records, collectibles with relics, and an
// input wrapper that pretends to be a particular controller. Debug only; nothing in the game
// imports this.

import { Vector3 } from 'three';
import type { InputDevice, RaceRecord } from '../../core/types';
import type { CollectibleSystem, GameView, InputSystem, RaceDef, RaceSystem, RelicInfo } from '../../game/contracts';
import type { Game } from '../../game/Game';
import { LAYOUT } from '../../world/layout';

function ring(x: number, y: number, z: number) {
  return { position: [x, y, z] as [number, number, number], normal: [0, 0, 1] as [number, number, number], radius: 9 };
}

function rings(n: number, cx: number, cy: number, cz: number, r: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return ring(cx + Math.cos(a) * r, cy + Math.sin(a * 2) * 20, cz + Math.sin(a) * r);
  });
}

export const FAKE_RACES: RaceDef[] = [
  {
    id: 'roost-loop', name: 'Roost Loop', kind: 'rings', difficulty: 1, landmark: 'roost',
    description: 'A gentle circuit of Windhaven: round the rookery towers, under the launch deck and home again.',
    start: { position: [40, 330, 80], yaw: 0 }, rings: rings(12, 0, 320, 0, 260),
    medals: { gold: 62000, silver: 70000, bronze: 82000 },
  },
  {
    id: 'cascade-run', name: 'Cascade Run', kind: 'rings', difficulty: 2, landmark: 'cascade',
    description: 'Five falls, fourteen gates. Dive through the spray and climb out before the next one.',
    start: { position: [700, 560, -400], yaw: 1 }, rings: rings(14, 820, 520, -520, 220),
    medals: { gold: 95000, silver: 108000, bronze: 125000 },
  },
  {
    id: 'lantern-dash', name: 'Lantern Dash', kind: 'sprint', difficulty: 3, landmark: 'lantern',
    description: 'From the Roost to the Lantern Spire as fast as wings allow. No rings, no rules — find your own line.',
    start: { position: [-60, 330, 60], yaw: -0.8 }, rings: [ring(-1150, 870, 760)],
    medals: { gold: 74000, silver: 82000, bronze: 95000 },
  },
  {
    id: 'needle-slalom', name: 'Needle Slalom', kind: 'rings', difficulty: 4, landmark: 'needles',
    description: 'Thread the stone forest of the Needles, gate by gate, without kissing a spire.',
    start: { position: [1000, 600, -1400], yaw: 2.6 }, rings: rings(18, 1110, 560, -1600, 180),
    medals: { gold: 118000, silver: 130000, bronze: 150000 },
  },
  {
    id: 'underspan', name: 'Underspan', kind: 'rings', difficulty: 5, landmark: 'rootfall',
    description: 'Beneath the islands, through hanging roots and broken arches, where the light runs thin.',
    start: { position: [300, 600, 900], yaw: 0.4 }, rings: rings(22, 340, 560, 1000, 240),
    medals: { gold: 150000, silver: 165000, bronze: 190000 },
  },
];

export const FAKE_RECORDS: Record<string, RaceRecord> = {
  'roost-loop': { bestMs: 59870, medal: 'gold', breed: 'harrier', runs: 7 },
  'cascade-run': { bestMs: 101230, medal: 'silver', breed: 'skimmer', runs: 3 },
  'lantern-dash': { bestMs: 90120, medal: 'bronze', breed: 'ironback', runs: 2 },
};

export const FAKE_RELICS: RelicInfo[] = [
  { id: 'relic-ember', name: 'Ember Scale', lore: 'Shed by a fire-veined wyvern that nested behind the falls, where no spray could reach it. It is still warm.' },
  { id: 'relic-antler', name: 'Old Bull’s Antler', lore: 'A shed tine from the great wyvern of Highmoor.' },
  { id: 'relic-mane', name: 'Gale Plume', lore: 'A tuft of feathered mane caught in the stone of the Eye.' },
  { id: 'relic-ribbon', name: 'Winner’s Ribbon', lore: 'Snagged on Rootfall’s roots by the first rider to thread them.' },
  { id: 'relic-howdah', name: 'Howdah Finial', lore: 'A carved finial from a queen’s howdah.' },
  { id: 'relic-charts', name: 'Wind Charts', lore: 'Every thermal in the Drift, inked by hand and left beneath the Observatory’s broken dome. Half the margins are notes on where the best pears grow.' },
  { id: 'relic-circlet', name: 'Keeper’s Circlet', lore: 'Worn by the keeper of the Lantern Spire.' },
];

export class FakeRaces implements RaceSystem {
  defs = FAKE_RACES;
  activeId: string | null = null;
  state: RaceSystem['state'] = 'idle';
  elapsedMs = 0;
  nextRingIndex = 0;
  bestMs: number | null = null;
  lastDeltaMs: number | null = null;
  /** Where waypoint() points; null = none. */
  target: Vector3 | null = null;
  /** Advance elapsedMs with real time while running. */
  ticking = false;

  waypoint(out: Vector3): Vector3 | null {
    return this.target ? out.copy(this.target) : null;
  }
  nearbyStart(): RaceDef | null {
    return null;
  }
  begin(raceId: string): void {
    this.activeId = raceId;
    this.state = 'countdown';
  }
  restart(): void {}
  abort(): void {
    this.activeId = null;
    this.state = 'idle';
  }
  fixedUpdate(): void {}
  update(dt: number): void {
    if (this.ticking && this.state === 'running') this.elapsedMs += dt * 1000;
  }
  setShowGhost(): void {}
}

export class FakeCollectibles implements CollectibleSystem {
  total = { feathers: 48, relics: FAKE_RELICS.length };
  found = { feathers: 12, relics: 2 };
  relics = FAKE_RELICS;
  update(): void {}
  nearestHint(): Vector3 | null {
    return null;
  }
}

/** An InputSystem that reports a chosen device and pad family but reads the real frame. */
export function fakeInput(real: InputSystem, device: InputDevice, padStyle: 'xbox' | 'playstation' | 'generic' | null, pointer?: { wanted: boolean; locked: boolean }): InputSystem {
  return {
    poll: (dt) => real.poll(dt),
    get frame() {
      const f = real.frame;
      f.device = device;
      return f;
    },
    device,
    padStyle,
    rumble: () => {},
    setPointerLock: () => {},
    setScripted: (f) => real.setScripted(f),
    pointerLockWanted: pointer?.wanted ?? false,
    pointerLocked: pointer?.locked ?? false,
  };
}

/** Fill the save with a mid-game journey: feathers, two relics, medals, discoveries, unlocks. */
export function fakeProgress(game: Game): void {
  const d = game.save.data;
  d.races = { ...FAKE_RECORDS };
  d.collected = [...Array.from({ length: 12 }, (_, i) => `feather-${String(i + 1).padStart(2, '0')}`), 'relic-ember', 'relic-charts'];
  d.discovered = ['roost', 'gullrest', 'cascade', 'rootfall', 'observatory', 'highmoor'];
  d.unlocked = ['stripes', 'dapple', 'ember', 'ram', 'crown', 'blade', 'racing', 'nomad', 'long', 'courier', 'cartographer', 'cap', 'half'];
  d.playTime = 3 * 3600 + 14 * 60;
}

/** Patch the UI's view of the game with the fakes; returns them for the showcase to drive. */
export function installFakes(
  game: Game,
  opts: { device?: InputDevice; pad?: 'xbox' | 'playstation' | 'generic' | null; pointer?: { wanted: boolean; locked: boolean } } = {},
): { races: FakeRaces; collectibles: FakeCollectibles; patch: Partial<GameView> } {
  const races = new FakeRaces();
  const collectibles = new FakeCollectibles();
  const patch: Partial<GameView> = { races, collectibles };
  if (opts.device) patch.input = fakeInput(game.input, opts.device, opts.pad ?? (opts.device === 'gamepad' ? 'xbox' : null), opts.pointer);
  game.ui.setDebugView(patch);
  return { races, collectibles, patch };
}

/** A landmark's position as a Vector3 (for waypoints). */
export function landmarkPos(id: string): Vector3 {
  const l = LAYOUT.landmarks.find((m) => m.id === id)!;
  return new Vector3(...l.position);
}

