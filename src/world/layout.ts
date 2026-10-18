// The archipelago: hand-placed landmarks plus a seeded scatter of smaller islands. Pure data —
// physics, rendering, races and collectibles all read the same layout, so a ring placed next to
// a cliff in the course editor is next to that cliff in the game.

import { Rng } from '../core/rng';

export type IslandKind =
  | 'roost' // the hub: wide flat center for the stable and rookery
  | 'meadow' // gentle rolling grass
  | 'forest' // dense trees
  | 'rocky' // ridged, sparse grass, boulders
  | 'plateau' // high windswept moor, flat-ish with a craggy rim
  | 'ruin' // old stonework on a modest island
  | 'cascade' // big island with waterfalls off its edge
  | 'grove' // mushroom/glowcap forest that lights up at night
  | 'islet'; // small rock with a tuft of grass

export interface IslandDef {
  id: number;
  kind: IslandKind;
  /** Landmark id if this island is a named landmark. */
  landmark?: string;
  name?: string;
  /** Footprint center; y is the base height of the top surface. */
  x: number;
  y: number;
  z: number;
  /** Mean footprint radius (m). */
  radius: number;
  /** 0..0.4 how ragged the outline is. */
  outline: number;
  /** Hill relief on the top surface (m). */
  hills: number;
  /** How far the underside hangs below the top (m). */
  depth: number;
  /** Rim thickness at the cliff edge (m). Must exceed the rim drop (~3 m). */
  lip: number;
  /** 0..1 fraction of the radius kept nearly flat around the center. */
  flatCenter: number;
  seed: number;
  /** Dressing hints, 0..1 densities and counts. */
  trees: number;
  grass: number;
  waterfalls: number;
}

/**
 * A floating rock needle: pointed tip at the bottom, widest at the belly, flat top you can land
 * on. Radius is interpolated tip→belly→top.
 */
export interface SpireDef {
  id: number;
  landmark?: string;
  name?: string;
  x: number;
  z: number;
  tipY: number;
  bellyY: number;
  topY: number;
  bellyRadius: number;
  topRadius: number;
  seed: number;
  /** A lantern platform on the top (the Lantern Spire). */
  lantern?: boolean;
}

/**
 * A stone arch as a segment of a torus: centered at (x, y, z), lying in a vertical plane whose
 * normal points along `yaw` (0 = +Z). `arcStart..arcEnd` measured in that plane from the +right
 * axis going up, so 0..π is a standing arch and 0..2π is a full ring you can fly through.
 */
export interface ArchDef {
  id: number;
  landmark?: string;
  name?: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Tilt of the ring plane about its own right axis (radians); 0 = vertical. */
  tilt: number;
  radius: number;
  tube: number;
  arcStart: number;
  arcEnd: number;
  seed: number;
}

/**
 * A sculpted rock form: a signed-distance solid (world/rockForm.ts) for shapes the analytic
 * islands, spires and arches can't make. Collision, landing and the mesh all evaluate the same
 * function. Two kinds, both capability sites (docs/design/CAPABILITIES.md, decision Q30):
 *
 *   crag     a leaning rock pillar whose top is one plane sloping `slope` downhill along `yaw`
 *            ((sin yaw, 0, cos yaw)); (x, y, z) is the top plane's center
 *   keyhole  a floating rock mass with a hollow chamber, entered through two slanted cracks, one
 *            in each wall, tilted opposite ways: threading it means a bank reversal inside the
 *            chamber. (x, y, z) is the chamber's center; the passage runs along `yaw`
 */
interface RockFormBase {
  id: number;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  seed: number;
}

export interface CragDef extends RockFormBase {
  kind: 'crag';
  /** Slope of the top plane from horizontal (radians). */
  slope: number;
  /** Pillar radius at the top, at its widest (the belly) and how far the pointed tip hangs below the top (m). */
  topRadius: number;
  bellyRadius: number;
  depth: number;
}

export interface KeyholeDef extends RockFormBase {
  kind: 'keyhole';
  /** Outer mass: width (across the passage), height, and each wall's thickness (m). */
  width: number;
  height: number;
  wall: number;
  /** The chamber between the walls: its length along the passage (the bank-reversal window), width and height (m). */
  chamber: number;
  chamberWidth: number;
  chamberHeight: number;
  /** Each crack: its opening width, its length along the slant (m) and its tilt from horizontal (rad; the entry crack +, the exit crack −). */
  crackWidth: number;
  crackLength: number;
  crackAngle: number;
}

export type RockFormDef = CragDef | KeyholeDef;

/** A column of rising warm air. Visible as drifting motes; strength is the core updraft (m/s). */
export interface ThermalDef {
  id: number;
  x: number;
  z: number;
  radius: number;
  strength: number;
  baseY: number;
  topY: number;
}

export interface LandmarkDef {
  id: string;
  name: string;
  description: string;
  /** A good point to look at / fly to (above the feature). */
  position: [number, number, number];
}

export interface WorldLayout {
  islands: IslandDef[];
  spires: SpireDef[];
  arches: ArchDef[];
  thermals: ThermalDef[];
  /** Sculpted rock forms (the capability sites). Optional: editor region layouts have none. */
  rocks?: RockFormDef[];
  landmarks: LandmarkDef[];
  /**
   * Where a new game starts: on foot in front of the stable. Only x/z are authored; y is
   * resolved against the terrain at runtime. Yaw: facing direction is (sin yaw, 0, cos yaw).
   */
  spawn: { position: [number, number, number]; yaw: number };
  /** Where the wyvern waits when the game starts (x, z; y from terrain) and its facing yaw. */
  wyvernSpawn: { position: [number, number, number]; yaw: number };
  /**
   * The stable on the Roost: walking up to its door (or landing beside it) opens customization.
   * (x, z) is the door; the building extends behind it, away from `yaw`.
   */
  stable: { x: number; z: number; yaw: number; interactRadius: number };
  /** Beyond this horizontal radius a steady headwind turns you back toward the Roost. */
  boundaryRadius: number;
  /** Below this height the cloud sea swallows you and you respawn. */
  cloudFloor: number;
}

const D = Math.PI / 180;

function island(
  partial: Partial<IslandDef> & Pick<IslandDef, 'id' | 'kind' | 'x' | 'y' | 'z' | 'radius'>,
): IslandDef {
  return {
    outline: 0.18,
    hills: 10,
    depth: partial.radius * 1.1,
    lip: 9,
    flatCenter: 0.15,
    seed: 1000 + partial.id * 7919,
    trees: 0.3,
    grass: 0.8,
    waterfalls: 0,
    ...partial,
  };
}

function buildLayout(): WorldLayout {
  const islands: IslandDef[] = [];
  const spires: SpireDef[] = [];
  const arches: ArchDef[] = [];
  let nextId = 0;
  const id = () => nextId++;

  // --- Landmark islands ----------------------------------------------------------------------
  islands.push(
    island({
      id: id(), kind: 'roost', landmark: 'roost', name: 'Windward Roost',
      x: 0, y: 240, z: 0, radius: 170, outline: 0.14, hills: 3, depth: 170, lip: 11,
      flatCenter: 0.55, trees: 0.18, grass: 1, waterfalls: 1,
    }),
    island({
      id: id(), kind: 'meadow', landmark: 'gullrest', name: "Gull's Rest",
      x: 560, y: 330, z: 420, radius: 75, outline: 0.22, hills: 2, depth: 110, lip: 8,
      flatCenter: 0.65, trees: 0.06, grass: 1,
    }),
    island({
      id: id(), kind: 'cascade', landmark: 'cascade', name: 'Cascade Isle',
      x: 820, y: 430, z: -520, radius: 230, outline: 0.2, hills: 38, depth: 280, lip: 12,
      flatCenter: 0.1, trees: 0.45, grass: 0.9, waterfalls: 5,
    }),
    island({
      id: id(), kind: 'forest', landmark: 'rootfall', name: 'Rootfall',
      x: 340, y: 620, z: 1000, radius: 200, outline: 0.16, hills: 18, depth: 330, lip: 12,
      flatCenter: 0.1, trees: 0.9, grass: 0.7,
    }),
    island({
      id: id(), kind: 'ruin', landmark: 'observatory', name: 'The Old Observatory',
      x: -1500, y: 420, z: 150, radius: 135, outline: 0.18, hills: 9, depth: 170, lip: 10,
      flatCenter: 0.45, trees: 0.15, grass: 0.8,
    }),
    island({
      id: id(), kind: 'plateau', landmark: 'highmoor', name: 'Highmoor',
      x: -450, y: 760, z: 420, radius: 185, outline: 0.24, hills: 8, depth: 230, lip: 14,
      flatCenter: 0.5, trees: 0.05, grass: 1,
    }),
    island({
      id: id(), kind: 'grove', landmark: 'glowcap', name: 'Glowcap Grove',
      x: -900, y: 330, z: -350, radius: 150, outline: 0.2, hills: 14, depth: 190, lip: 10,
      flatCenter: 0.1, trees: 0.8, grass: 0.8, waterfalls: 1,
    }),
  );

  // The Archway Reach: a westward chain of islets joined by standing arches.
  const reach = [
    { x: -380, y: 205, z: -760, r: 62 },
    { x: -640, y: 225, z: -905, r: 55 },
    { x: -905, y: 238, z: -1010, r: 58 },
    { x: -1180, y: 262, z: -1080, r: 66 },
  ];
  reach.forEach((p, i) =>
    islands.push(
      island({
        id: id(), kind: i === 0 ? 'meadow' : 'rocky',
        landmark: i === 0 ? 'archway' : undefined,
        name: i === 0 ? 'The Archway Reach' : undefined,
        x: p.x, y: p.y, z: p.z, radius: p.r, outline: 0.22, hills: 6, depth: 95, lip: 8,
        flatCenter: 0.2, trees: 0.2, grass: 0.9,
      }),
    ),
  );
  for (let i = 0; i < reach.length - 1; i++) {
    const a = reach[i];
    const b = reach[i + 1];
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const span = Math.hypot(b.x - a.x, b.z - a.z);
    // The arch plane contains the chord a→b, so its normal is perpendicular to it.
    const chordYaw = Math.atan2(b.x - a.x, b.z - a.z);
    arches.push({
      id: arches.length,
      landmark: i === 0 ? 'archway' : undefined,
      x: mx,
      y: Math.min(a.y, b.y) + 2,
      z: mz,
      yaw: chordYaw + Math.PI / 2,
      tilt: 0,
      radius: span / 2 - 22,
      tube: 9 + (i % 2) * 2,
      arcStart: 0,
      arcEnd: Math.PI,
      seed: 5000 + i * 31,
    });
  }

  // Mistveil Shelves: a staircase of islets stepping up out of the cloud sea.
  const shelves = [
    { x: 1560, y: 170, z: -880, r: 60 },
    { x: 1700, y: 260, z: -1010, r: 52 },
    { x: 1640, y: 360, z: -1170, r: 56 },
    { x: 1480, y: 455, z: -1250, r: 50 },
    { x: 1330, y: 545, z: -1180, r: 58 },
  ];
  shelves.forEach((p, i) =>
    islands.push(
      island({
        id: id(), kind: i === 4 ? 'meadow' : 'islet',
        landmark: i === 0 ? 'shelves' : undefined,
        name: i === 0 ? 'Mistveil Shelves' : undefined,
        x: p.x, y: p.y, z: p.z, radius: p.r, outline: 0.26, hills: 5, depth: 80, lip: 8,
        flatCenter: 0.25, trees: 0.1, grass: 0.9, waterfalls: i === 2 ? 1 : 0,
      }),
    ),
  );

  // --- Spires ---------------------------------------------------------------------------------
  spires.push({
    id: spires.length, landmark: 'lantern', name: 'The Lantern Spire',
    x: -1150, z: 760, tipY: 140, bellyY: 380, topY: 830, bellyRadius: 72, topRadius: 20,
    seed: 7001, lantern: true,
  });
  // The Needles: a slalom field of thinner spires.
  const needles = [
    [1020, -1260, 520], [1120, -1420, 600], [920, -1500, 470], [1230, -1600, 560],
    [1050, -1700, 640], [1300, -1830, 500], [1110, -1950, 580],
  ];
  needles.forEach(([x, z, top], i) =>
    spires.push({
      id: spires.length, landmark: i === 0 ? 'needles' : undefined,
      name: i === 0 ? 'The Needles' : undefined,
      x, z, tipY: 120 + (i % 3) * 30, bellyY: 240 + (i % 2) * 40, topY: top,
      bellyRadius: 26 + (i % 3) * 5, topRadius: 7, seed: 7100 + i * 13,
    }),
  );

  // --- Arches and rings -----------------------------------------------------------------------
  // The Eye of the Gale: a huge stone ring hanging in open sky.
  arches.push({
    id: arches.length, landmark: 'eye', name: 'Eye of the Gale',
    x: 1350, y: 560, z: 650, yaw: -40 * D, tilt: 8 * D, radius: 95, tube: 17,
    arcStart: 0, arcEnd: Math.PI * 2, seed: 6001,
  });
  // A broken ring near the Observatory.
  arches.push({
    id: arches.length,
    x: -1280, y: 470, z: 330, yaw: 25 * D, tilt: 0, radius: 48, tube: 8,
    arcStart: -0.4, arcEnd: Math.PI * 1.35, seed: 6002,
  });

  // --- Scatter: seeded filler islands -------------------------------------------------------
  const rng = new Rng(0xd41f7);
  const occupied: { x: number; z: number; y: number; r: number }[] = [
    ...islands.map((i) => ({ x: i.x, z: i.z, y: i.y, r: i.radius })),
    ...spires.map((s) => ({ x: s.x, z: s.z, y: s.bellyY, r: s.bellyRadius + 20 })),
    ...arches.map((a) => ({ x: a.x, z: a.z, y: a.y, r: a.radius + a.tube })),
  ];
  const kinds: IslandKind[] = ['meadow', 'meadow', 'forest', 'rocky', 'islet', 'islet', 'forest'];
  let attempts = 0;
  let placed = 0;
  while (placed < 38 && attempts < 4000) {
    attempts++;
    const ang = rng.range(0, Math.PI * 2);
    const dist = Math.sqrt(rng.float()) * 2500 + 120;
    const x = Math.cos(ang) * dist;
    const z = Math.sin(ang) * dist;
    const kind = rng.pick(kinds);
    const radius = kind === 'islet' ? rng.range(22, 45) : rng.range(45, 110);
    const y = Math.round(160 + 480 * (0.5 + 0.5 * Math.sin(x * 0.0011 + 1.3) * Math.cos(z * 0.0009 - 0.4)) + rng.range(-60, 60));
    // Keep clear of everything placed so far, in 3D-ish terms (vertical separation counts).
    let ok = true;
    for (const o of occupied) {
      const dxz = Math.hypot(o.x - x, o.z - z);
      const dy = Math.abs(o.y - y);
      const need = o.r + radius + 70;
      if (dxz < need && dy < 220) {
        ok = false;
        break;
      }
      if (dxz < (o.r + radius) * 0.9) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    islands.push(
      island({
        id: id(), kind, x: Math.round(x), y, z: Math.round(z), radius: Math.round(radius),
        outline: rng.range(0.14, 0.3),
        hills: kind === 'rocky' ? rng.range(12, 24) : rng.range(3, 12),
        depth: radius * rng.range(0.9, 1.6),
        lip: rng.range(7, 10),
        flatCenter: rng.range(0.05, 0.3),
        trees: kind === 'forest' ? rng.range(0.6, 0.95) : kind === 'islet' ? rng.range(0, 0.15) : rng.range(0.1, 0.4),
        grass: kind === 'rocky' ? 0.4 : 0.9,
        waterfalls: kind !== 'islet' && rng.chance(0.18) ? 1 : 0,
      }),
    );
    occupied.push({ x, z, y, r: radius });
    placed++;
  }

  // --- Thermals --------------------------------------------------------------------------------
  const thermals: ThermalDef[] = [
    { id: 0, x: 260, z: -60, radius: 110, strength: 9, baseY: 0, topY: 640 },
    { id: 1, x: 620, z: -240, radius: 120, strength: 10, baseY: 0, topY: 720 },
    { id: 2, x: -620, z: -620, radius: 100, strength: 8, baseY: 0, topY: 520 },
    { id: 3, x: -260, z: 330, radius: 140, strength: 12, baseY: 0, topY: 1050 },
    { id: 4, x: -1300, z: 480, radius: 110, strength: 10, baseY: 0, topY: 900 },
    { id: 5, x: 1180, z: -1100, radius: 100, strength: 9, baseY: 0, topY: 760 },
    { id: 6, x: 1100, z: 380, radius: 120, strength: 9, baseY: 0, topY: 820 },
    { id: 7, x: 150, z: 760, radius: 110, strength: 11, baseY: 0, topY: 900 },
  ];

  // --- Capability sites (decision Q30; requirements in docs/design/CAPABILITIES.md) ----------
  // Placed after the scatter so the seeded islands are unchanged. Neither is a landmark, and
  // neither carries required content.
  const rocks: RockFormDef[] = [
    {
      // A leaning pillar 380 m south of Cascade Isle's axis whose whole top falls away south at
      // 51.5°: steeper than any wyvern lands on today (49.5°), within the steep-landing unlock
      // (53°) and short of the Craghorn's 56°. Nothing flatter within reach.
      id: 0, kind: 'crag', name: 'Cascade south perch',
      x: 820, y: 478, z: -900, yaw: Math.PI, seed: 8101,
      slope: 51.5 * D, topRadius: 9, bellyRadius: 12.5, depth: 95,
    },
    {
      // A floating rock south of the Archway Reach, pierced along the chain's line: an entry
      // crack tilted 70° one way, a chamber, an exit crack tilted 70° the other. Threading it
      // is a bank reversal in and around the chamber: a well-aimed harrier at its normal roll can
      // sometimes manage it, and the snap-roll's ×1.6 makes it reliable (G8b, decision Q43).
      id: 1, kind: 'keyhole', name: 'Archway Keyhole',
      x: -850, y: 330, z: -1280, yaw: Math.atan2(-800, -320), seed: 8102,
      width: 56, height: 60, wall: 8,
      chamber: 14, chamberWidth: 28, chamberHeight: 40,
      crackWidth: 8, crackLength: 36, crackAngle: 70 * D,
    },
  ];

  const landmarks: LandmarkDef[] = [
    { id: 'roost', name: 'Windward Roost', description: 'The rookery. Stables, banners and the start of every journey.', position: [0, 300, 0] },
    { id: 'gullrest', name: "Gull's Rest", description: 'A quiet meadow a short glide from the Roost.', position: [560, 360, 420] },
    { id: 'cascade', name: 'Cascade Isle', description: 'Five falls pour off its rim into the cloud sea.', position: [820, 520, -520] },
    { id: 'rootfall', name: 'Rootfall', description: 'An old forest whose roots hang a hundred meters into the sky.', position: [340, 700, 1000] },
    { id: 'observatory', name: 'The Old Observatory', description: 'Whoever charted the winds here left their dome behind.', position: [-1500, 480, 150] },
    { id: 'highmoor', name: 'Highmoor', description: 'The highest ground in the Drift. Cold, bright and loud with wind.', position: [-450, 820, 420] },
    { id: 'glowcap', name: 'Glowcap Grove', description: 'Mushroom woods that light up after dusk.', position: [-900, 380, -350] },
    { id: 'archway', name: 'The Archway Reach', description: 'Stone arches stepping west from islet to islet.', position: [-760, 300, -930] },
    { id: 'shelves', name: 'Mistveil Shelves', description: 'A staircase of islets climbing out of the cloud sea.', position: [1520, 400, -1060] },
    { id: 'lantern', name: 'The Lantern Spire', description: 'A needle of rock with a lantern that never goes out.', position: [-1150, 850, 760] },
    { id: 'needles', name: 'The Needles', description: 'A forest of rock spires. Thread them if you dare.', position: [1110, 560, -1600] },
    { id: 'eye', name: 'Eye of the Gale', description: 'A ring of stone the size of a hill, hanging in open air.', position: [1350, 560, 650] },
  ];

  return {
    islands,
    spires,
    arches,
    thermals,
    rocks,
    landmarks,
    // The rider starts a few strides from the waiting wyvern, north of the plaza's middle: the
    // title camera frames them as a two-shot from the south (rider left, wyvern right, both
    // turned three-quarters toward it), with the northern sky — never the sun — behind them.
    spawn: { position: [10, 0, 30], yaw: -1.6 },
    wyvernSpawn: { position: [-1, 0, 33], yaw: 2.1 },
    stable: { x: 0, z: -20, yaw: 0, interactRadius: 14 },
    boundaryRadius: 2900,
    cloudFloor: 25,
  };
}

export const LAYOUT: WorldLayout = buildLayout();

export function landmarkById(id: string): LandmarkDef | undefined {
  return LAYOUT.landmarks.find((l) => l.id === id);
}

export function islandByLandmark(id: string): IslandDef | undefined {
  return LAYOUT.islands.find((i) => i.landmark === id);
}
