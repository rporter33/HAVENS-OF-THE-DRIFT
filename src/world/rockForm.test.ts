// The capability sites (gate G8a, decision Q30): the sculpted rock forms, their collision and mesh
// agreeing, and the two physics gates proven with the real flight model and player:
//   - the Cascade south perch: no wyvern lands on its 51.5° top today; with the steep-landing
//     unlock (land limit cos 53°) every breed can, and stays standing
//   - the Archway Keyhole: a harrier can't thread its two opposed cracks today, at any approach a
//     search tries; with the snap-roll (roll rate and authority × 1.6) it can
// See docs/design/CAPABILITIES.md for the requirements and docs/qa/G8A_CAPABILITY_SITES.md for the
// measured margins.

import { afterEach, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { LAYOUT, type CragDef, type KeyholeDef } from './layout';
import { ROCK_GROUND_BASE, Terrain } from './terrain';
import type { RockFormShape } from './rockForm';
import { ROCK_LODS, buildRockFormMesh } from './mesh/rockFormMesh';
import { COURSES, courseVia } from '../race/courses';
import { coursePoints } from '../race/courseMath';
import { BREEDS, BREED_ORDER } from '../flight/breeds';
import { FlightModel } from '../flight/FlightModel';
import { bankAngle, neutralInput, stillAir, yawQuat, SIM_DT } from '../flight/telemetry';
import { clamp, DEG } from '../core/math';
import { GAIT_PROFILES } from '../core/gait';
import { Player } from '../player/Player';
import { EventBus } from '../core/events';
import type { BreedId, GameEvents } from '../core/types';
import { emptyFrame } from '../input/Input';
import { DEFAULT_SETTINGS } from '../game/settings';

const terrain = new Terrain(LAYOUT);
const bare = new Terrain({ ...LAYOUT, rocks: [] });
const crag = terrain.rocks.find((r) => r.def.kind === 'crag')!;
const keyhole = terrain.rocks.find((r) => r.def.kind === 'keyhole')!;
const C = crag.def as CragDef;
const K = keyhole.def as KeyholeDef;
const SLOW = 120_000;

/** Today's landing limit and the steep-landing unlock's (decision Q30; CAPABILITIES.md §2). */
const LAND_TODAY = 0.65;
const LAND_UNLOCKED = Math.cos(53 * DEG);

function mesh(shape: RockFormShape, level: number) {
  const gen = buildRockFormMesh(shape, ROCK_LODS[level]);
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value.data;
  }
}

/** Points on the form's surface (its LOD1 mesh vertices, world space). */
function surface(shape: RockFormShape): Vector3[] {
  const d = mesh(shape, 1);
  const out: Vector3[] = [];
  for (let i = 0; i < d.positions.length; i += 3) out.push(new Vector3(d.positions[i] + shape.def.x, d.positions[i + 1] + shape.def.y, d.positions[i + 2] + shape.def.z));
  return out;
}

describe('the capability sites in the layout', () => {
  it('has the perch and the keyhole, neither a landmark', () => {
    expect(LAYOUT.rocks?.map((r) => r.kind)).toEqual(['crag', 'keyhole']);
    expect(C.slope).toBeCloseTo(51.5 * DEG, 6);
    expect(K.chamber).toBe(9.5);
  });

  it('keeps 30 m of air between each form and any other rock', () => {
    for (const shape of terrain.rocks) {
      let min = Infinity;
      for (const p of surface(shape)) min = Math.min(min, bare.distance(p));
      expect(min, shape.def.name).toBeGreaterThan(30);
    }
  });

  it('keeps every race line 40 m from both forms', () => {
    for (const shape of terrain.rocks) {
      let min = Infinity;
      for (const c of COURSES) {
        const pts = coursePoints(c, courseVia(c.id)).map((q) => new Vector3(...('p' in q ? q.p : q)));
        for (let i = 0; i + 1 < pts.length; i++) {
          const n = Math.ceil(pts[i].distanceTo(pts[i + 1]) / 4);
          for (let s = 0; s <= n; s++) {
            const p = pts[i].clone().lerp(pts[i + 1], s / n);
            if (p.distanceTo(shape.center) < shape.boundRadius + 60) min = Math.min(min, shape.sdf(p.x, p.y, p.z));
          }
        }
      }
      expect(min, shape.def.name).toBeGreaterThan(40);
    }
  });
});

describe('the Cascade south perch', () => {
  it('is ground only on its top plane, sloping 51.5° everywhere on it', () => {
    let hits = 0;
    for (let x = -14; x <= 14; x += 0.5) {
      for (let z = -14; z <= 14; z += 0.5) {
        const g = terrain.groundAt(C.x + x, C.z + z, 5000);
        if (!g || g.islandId !== ROCK_GROUND_BASE - C.id) continue;
        hits++;
        expect(g.normal.y).toBeCloseTo(Math.cos(C.slope), 6);
        expect(g.surface).toBe('stone');
      }
    }
    expect(hits).toBeGreaterThan(600);
    // Between today's limit and the unlock's.
    expect(Math.cos(C.slope)).toBeLessThan(LAND_TODAY);
    expect(Math.cos(C.slope)).toBeGreaterThan(LAND_UNLOCKED);
  });

  it('has no flatter ground within 12 m of its top at a similar height', () => {
    const top = new Vector3();
    for (let a = 0; a < 64; a++) {
      for (const r of [10, 14, 18, 21]) {
        const x = C.x + Math.cos((a / 64) * Math.PI * 2) * r;
        const z = C.z + Math.sin((a / 64) * Math.PI * 2) * r;
        const g = terrain.groundAt(x, z, C.y + 20);
        if (g && Math.abs(g.y - C.y) < 20) expect(g.normal.y < LAND_TODAY, `ground at ${x.toFixed(0)}, ${z.toFixed(0)}`).toBe(true);
      }
    }
    expect(crag.groundAt(C.x, C.z, 1e6, top)).not.toBeNull();
  });

  afterEach(() => {
    for (const id of BREED_ORDER) (GAIT_PROFILES[id] as { landNormalY?: number }).landNormalY = undefined;
  });

  /** A flared approach onto the top plane, `along` m downhill of its center, heading uphill. */
  function land(breed: BreedId, along: number, side: number, speed: number): { landed: boolean; standing: boolean } {
    const events = new EventBus<GameEvents>();
    const p = new Player({ terrain, env: { windAt: (_q, o) => o.set(0, 0, 0), terrain }, events, breed, settings: () => ({ ...DEFAULT_SETTINGS, holdToFlap: true }) });
    const x = C.x + crag.fwd.x * along + crag.side.x * side;
    const z = C.z + crag.fwd.z * along + crag.side.z * side;
    const gy = crag.groundAt(x, z, 1e6, new Vector3())!;
    const yaw = C.yaw + Math.PI;
    p.teleport(new Vector3(x - Math.sin(yaw) * 14, gy + 7, z - Math.cos(yaw) * 14), yaw, 'flying', speed);
    let landed = false;
    for (let i = 0; i < 6 * 120; i++) {
      const inp = emptyFrame();
      inp.flight.flare = 1;
      p.latchPresses(inp);
      p.fixedUpdate(1 / 120, inp, 0);
      p.update(1 / 120, 1);
      if (p.mode === 'landed') landed = true;
    }
    return { landed, standing: p.mode === 'landed' && Math.hypot(p.position.x - C.x, p.position.z - C.z) < C.topRadius + 2 };
  }

  it('no wyvern lands on it today; with the steep-landing unlock every breed does, and stays', () => {
    const tries: [number, number, number][] = [];
    for (const along of [-3, 0, 3]) for (const side of [-2, 2]) for (const speed of [12, 15]) tries.push([along, side, speed]);
    for (const breed of BREED_ORDER) {
      expect(tries.filter((t) => land(breed, ...t).landed), `${breed} today`).toHaveLength(0);
      (GAIT_PROFILES[breed] as { landNormalY?: number }).landNormalY = LAND_UNLOCKED;
      const after = tries.map((t) => land(breed, ...t));
      expect(after.filter((r) => r.landed).length, `${breed} unlocked`).toBeGreaterThan(2);
      for (const r of after) if (r.landed) expect(r.standing, `${breed} stands`).toBe(true);
    }
  }, SLOW);
});

describe('the Archway Keyhole', () => {
  const half = K.chamber / 2;
  const at = (u: number, v: number, w: number) => new Vector3(K.x, K.y + v, K.z).addScaledVector(keyhole.fwd, u).addScaledVector(keyhole.side, w);
  /** The exact free width across a direction through p (bisection on the field). */
  function width(p: Vector3, dir: Vector3): number {
    const edge = (sign: number) => {
      let lo = 0;
      let hi = 20;
      for (let i = 0; i < 40; i++) {
        const m = (lo + hi) / 2;
        const q = p.clone().addScaledVector(dir, sign * m);
        if (keyhole.sdf(q.x, q.y, q.z) > 0) lo = m;
        else hi = m;
      }
      return lo;
    };
    return edge(1) + edge(-1);
  }

  it('has cracks of the specified width and a chamber of the specified length', () => {
    for (const [u, a] of [[-half - K.wall / 2, K.crackAngle], [half + K.wall / 2, -K.crackAngle]]) {
      const across = new Vector3().addScaledVector(keyhole.side, -Math.sin(a)).add(new Vector3(0, Math.cos(a), 0)).normalize();
      expect(width(at(u, 0, 0), across)).toBeCloseTo(K.crackWidth, 1);
    }
    // Off the crack lines the chamber's end walls are planes K.chamber apart.
    expect(width(at(0, 9, 9), keyhole.fwd)).toBeCloseTo(K.chamber, 1);
  });

  it('is entered only through its cracks', () => {
    const c0 = at(0, 0, 0);
    let escaped = 0;
    for (let k = 0; k < 1500; k++) {
      const a = Math.acos(1 - (2 * (k + 0.5)) / 1500);
      const b = Math.PI * (1 + Math.sqrt(5)) * k;
      const dir = new Vector3(Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b));
      const p = c0.clone();
      let travelled = 0;
      let hit = false;
      while (travelled < 90) {
        const s = keyhole.sdf(p.x, p.y, p.z);
        if (s < 0.01) {
          hit = true;
          break;
        }
        const step = Math.max(s * 0.7, 0.05);
        p.addScaledVector(dir, step);
        travelled += step;
      }
      if (hit) continue;
      escaped++;
      // Out through an end wall, not the sides, top or underside.
      expect(Math.abs(p.clone().sub(new Vector3(K.x, K.y, K.z)).dot(keyhole.fwd))).toBeGreaterThan(half);
    }
    expect(escaped).toBeGreaterThan(50);
  });

  /**
   * A scripted pilot threading it: settled in a +crackAngle bank on the entry crack's line, `aim`
   * metres up its slant and climbing at `climb` m/s, 6 m before the entry face; it starts the
   * reversal at u = startAt (rolls flat out, stopping the roll with a `tau` s lead) and steers with
   * the lift: across the crack it's in while banked, toward the exit crack's height while the wings
   * pass level. Returns true when it leaves the exit untouched.
   */
  function thread(breed: BreedId, rollMult: number, V: number, startAt: number, tau: number, aim: number, climb: number): boolean {
    const base = BREEDS[breed];
    const a = K.crackAngle;
    const m = new FlightModel(base);
    m.breed = { ...base, maxRollRate: base.maxRollRate * rollMult, rollAuthority: base.rollAuthority * rollMult };
    const env = stillAir(terrain);
    const vel = keyhole.fwd.clone().multiplyScalar(Math.sqrt(V * V - climb * climb)).add(new Vector3(0, climb, 0));
    m.reset(at(-half - K.wall - 6, Math.sin(a) * aim, Math.cos(a) * aim), yawQuat(K.yaw, -Math.atan2(climb, V), a), vel);
    const inp = neutralInput();
    let prev = NaN;
    for (let i = 0; i < 5 / SIM_DT; i++) {
      const q = m.state.position.clone().sub(new Vector3(K.x, K.y, K.z));
      const u = q.dot(keyhole.fwd);
      const w = q.dot(keyhole.side);
      const v = q.y;
      if (u > half + K.wall + 6) return true;
      const bank = bankAngle(m);
      inp.roll = clamp(6 * ((u >= startAt ? -a : a) - bank - m.state.angularVelocity.z * tau), -1, 1);
      if (Math.abs(bank) > 0.85) {
        const ca = bank > 0 ? a : -a;
        const across = -w * Math.sin(ca) + v * Math.cos(ca);
        const rate = Number.isNaN(prev) ? 0 : (across - prev) / SIM_DT;
        prev = across;
        inp.pitch = clamp(-0.35 * across - 0.15 * rate + 0.1, -1, 1);
      } else {
        prev = NaN;
        inp.pitch = clamp(0.35 * (Math.sin(a) * aim * 0.5 - (v + m.state.velocity.y * 0.4)), -1, 1);
      }
      m.step(SIM_DT, inp, env);
      if (m.state.timeSinceContact === 0) return false;
    }
    return false;
  }

  it('a harrier at its normal roll never threads it', () => {
    let tried = 0;
    for (let V = 14; V <= 18; V++) {
      for (let s = -9; s <= 2; s++) {
        for (const tau of [0.12, 0.18, 0.24]) {
          for (const aim of [0, 3, 6, 9]) {
            for (const climb of [0, 4, 8]) {
              tried++;
              expect(thread('harrier', 1, V, -half + s, tau, aim, climb), `V${V} s${s} tau${tau} aim${aim} climb${climb}`).toBe(false);
            }
          }
        }
      }
    }
    expect(tried).toBe(2160);
  }, SLOW);

  it('a harrier with the snap-roll threads it (slowly: 14 to 16.5 m/s, just above its stall)', () => {
    const lines: [number, number, number, number, number][] = [
      [14, -half - 6, 0.16, 6, 6],
      [14, -half - 7, 0.2, 9, 4],
      [16, -half - 7, 0.16, 6, 6],
      [16.5, -half - 6.5, 0.12, 6, 6],
    ];
    for (const l of lines) {
      expect(thread('harrier', 1.6, ...l), `snap-roll ${l.join(' ')}`).toBe(true);
      // The same line at the harrier's normal roll hits the rock.
      expect(thread('harrier', 1, ...l), `normal roll ${l.join(' ')}`).toBe(false);
    }
  });
});

describe('rock-form meshes', () => {
  it('are closed and sit on the collision surface', () => {
    for (const shape of terrain.rocks) {
      const d = mesh(shape, 0);
      let maxErr = 0;
      for (let i = 0; i < d.positions.length; i += 3) {
        maxErr = Math.max(maxErr, Math.abs(shape.sdf(d.positions[i] + shape.def.x, d.positions[i + 1] + shape.def.y, d.positions[i + 2] + shape.def.z)));
      }
      expect(maxErr, shape.def.name).toBeLessThan(0.45);
      const edges = new Map<number, number>();
      const nv = d.positions.length / 3;
      for (let k = 0; k < d.indices.length; k += 3) {
        for (const [p, q] of [[0, 1], [1, 2], [2, 0]]) {
          const a = d.indices[k + p];
          const b = d.indices[k + q];
          const key = Math.min(a, b) * nv + Math.max(a, b);
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
      expect([...edges.values()].filter((n) => n === 1), shape.def.name).toHaveLength(0);
    }
  });

  it('stay inside the triangle budget per LOD', () => {
    const budget = [48_000, 10_000, 1_400];
    for (const shape of terrain.rocks) for (let l = 0; l < 3; l++) expect(mesh(shape, l).indices.length / 3, `${shape.def.name} LOD${l}`).toBeLessThan(budget[l]);
  });
});

describe('rock forms in the terrain', () => {
  it('push spheres out, stop rays and bound sphere tracing', () => {
    const push = new Vector3();
    const normal = new Vector3();
    const p = new Vector3(C.x, C.y - 30, C.z);
    // A probe just inside the flank is pushed back out along the flank's normal.
    const flank = new Vector3();
    for (let r = 0; r < 40; r += 0.25) {
      flank.set(C.x + r, C.y - 30, C.z);
      if (crag.sdf(flank.x, flank.y, flank.z) > -0.3) break;
    }
    expect(terrain.collideSphere(flank, 1, push, normal)).toBe(true);
    expect(crag.sdf(flank.x + push.x, flank.y + push.y, flank.z + push.z)).toBeGreaterThan(0.5);
    // A ray dropped onto the top plane stops on it.
    const hit = terrain.raycast(new Vector3(C.x, C.y + 40, C.z), new Vector3(0, -1, 0), 80)!;
    expect(hit.point.y).toBeCloseTo(C.y, 0);
    // distance() never overstates the field (sphere tracing stays outside).
    for (let i = 0; i < 200; i++) {
      const q = p.clone().add(new Vector3(Math.sin(i) * 30, Math.cos(i * 1.3) * 40, Math.sin(i * 0.7) * 30));
      const s = crag.sdf(q.x, q.y, q.z);
      if (s > 0) expect(terrain.distance(q)).toBeLessThanOrEqual(s + 1e-6);
    }
  });

  it('the keyhole islet has a turf top to land on', () => {
    const g = terrain.groundAt(K.x, K.z, K.y + 200);
    expect(g).not.toBeNull();
    expect(g!.islandId).toBe(ROCK_GROUND_BASE - K.id);
    expect(g!.y).toBeGreaterThan(K.y + K.height / 2 - 3);
    expect(g!.normal.y).toBeGreaterThan(0.9);
  });
});
