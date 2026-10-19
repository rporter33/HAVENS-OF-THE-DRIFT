// Wyvern animator core, ground motion and life: robustness, IK and gait, the folded stance,
// landing, bask, lids, tongue, breathing, tail, exertion, the head held through the beat, and the
// capture hooks (stream C). Shared poses and helpers: wyvern.testkit.ts.

import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import type { BreedId, GroundHit, WyvernPose } from '../../core/types';
import { BREEDS, BREED_ORDER } from '../../flight/breeds';
import { createWyvernPose } from '../../player/poses';
import { mulberry32 } from '../../core/rng';
import { Wyvern } from './Wyvern';
import { aimRotation, solveTwoBone } from './ik';
import { Gait, footPhase, type GaitContext } from './gait';
import { beat, boneWorld, gliding, look, standing } from './wyvern.testkit';
import { PEN_PAIRS, type Penetration, wyvernPenetration } from './collision';
import { GroundWalker, standingOrientation } from '../../player/ground';
import { PLAYER_TUNING as P } from '../../player/tuning';
import { gaitProfile } from '../../core/gait';
import { DEG } from '../../core/math';
import { Player } from '../../player/Player';
import { emptyFrame } from '../../input/Input';
import { EventBus } from '../../core/events';
import { Terrain } from '../../world/terrain';
import { LAYOUT } from '../../world/layout';
import { DEFAULT_SETTINGS } from '../../game/settings';

const _p = new Vector3();
const _q = new Vector3();

describe('animator robustness', { timeout: 60000 }, () => {
  it('never produces NaN under random poses, gaits, dt and teleports', () => {
    const rnd = mulberry32(42);
    const gaits = ['idle', 'walk', 'run', 'takeoff', 'landing', 'jump'] as const;
    for (const breed of BREED_ORDER) {
      const w = new Wyvern(look(breed, { tail: 'ribbon', frill: 'fan' }));
      const pose = createWyvernPose();
      const q = new Quaternion();
      for (let i = 0; i < 400; i++) {
        if (i % 50 === 0) pose.position.set((rnd() - 0.5) * 2000, 200 + rnd() * 400, (rnd() - 0.5) * 2000);
        else pose.position.addScaledVector(pose.velocity, 1 / 60);
        q.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
        pose.orientation.slerp(q, 0.05);
        pose.velocity.set((rnd() - 0.5) * 60, (rnd() - 0.5) * 30, (rnd() - 0.5) * 60);
        pose.angularVelocity.set((rnd() - 0.5) * 4, (rnd() - 0.5) * 4, (rnd() - 0.5) * 4);
        pose.airborne = rnd() > 0.3;
        pose.airspeed = rnd() * 80;
        pose.wingSpread = 0.2 + rnd() * 0.8;
        pose.flapPhase = rnd();
        pose.flapStrength = rnd();
        pose.flare = rnd();
        pose.stall = rnd();
        pose.fatigue = rnd();
        pose.gait = gaits[Math.floor(rnd() * gaits.length)];
        pose.gaitTime = rnd() * 2;
        pose.groundSpeed = rnd() * 10;
        pose.groundY = rnd() > 0.5 ? pose.position.y - BREEDS[breed].standHeight : null;
        pose.lookTarget.set(rnd() * 100, rnd() * 100, rnd() * 100);
        const dt = [0, 1 / 144, 1 / 60, 1 / 30, 0.1, 0.5][Math.floor(rnd() * 6)];
        w.update(dt, pose);
        let ok = true;
        for (const b of w.skinnedMesh!.skeleton.bones) {
          ok &&= Number.isFinite(b.quaternion.x + b.quaternion.y + b.quaternion.z + b.quaternion.w);
          ok &&= Number.isFinite(b.position.x + b.position.y + b.position.z + b.scale.x);
        }
        w.getWingtips(_p, _q);
        ok &&= Number.isFinite(_p.x + _p.y + _p.z + _q.x + _q.y + _q.z);
        if (!ok) throw new Error(`non-finite pose at step ${i} (${breed})`);
      }
      w.dispose();
    }
  });

  it('keeps the tail attached and its segments rigid while whipping through turns', () => {
    const w = new Wyvern(look('harrier'));
    const pose = gliding();
    const yaw = new Quaternion();
    for (let i = 0; i < 240; i++) {
      // Hard yaw back and forth.
      yaw.setFromAxisAngle(new Vector3(0, 1, 0), Math.sin(i / 20) * 1.2);
      pose.orientation.copy(yaw);
      pose.angularVelocity.set(0, Math.cos(i / 20) * 1.2 * 3, 0);
      pose.position.addScaledVector(pose.velocity, 1 / 60);
      w.update(1 / 60, pose);
    }
    const bones = w.skinnedMesh!.skeleton.bones;
    const names = Array.from({ length: 10 }, (_, i) => `tail${i}`);
    const rig = w.rigDef;
    for (let i = 0; i < names.length - 1; i++) {
      const a = bones.find((b) => b.name === names[i])!.getWorldPosition(new Vector3());
      const b = bones.find((b) => b.name === names[i + 1])!.getWorldPosition(new Vector3());
      const bind = rig.bones[rig.idx.tail[i]].pos.distanceTo(rig.bones[rig.idx.tail[i + 1]].pos);
      expect(a.distanceTo(b)).toBeCloseTo(bind, 3);
    }
    w.dispose();
  });
});

/** Tail segment directions (body frame) after the last update, root → tip, plus the pelvis's rest direction for segment 0. */
function tailDirs(w: Wyvern): { dirs: Vector3[]; base: Vector3 } {
  const a = (w as unknown as { animator: { modelQ: Quaternion[]; parent: number[] } }).animator;
  const rig = w.rigDef;
  const T = rig.idx.tail;
  const dirs = T.map((b, i) => {
    const q = i + 1 < T.length ? rig.bones[T[i + 1]].pos : rig.tailTip;
    return q.clone().sub(rig.bones[b].pos).normalize().applyQuaternion(a.modelQ[b]);
  });
  const base = rig.bones[T[1]].pos.clone().sub(rig.bones[T[0]].pos).normalize().applyQuaternion(a.modelQ[a.parent[T[0]]]);
  return { dirs, base };
}

const angleDeg = (a: Vector3, b: Vector3) => (Math.acos(Math.min(1, a.dot(b))) * 180) / Math.PI;

/**
 * Two seconds (after a settle) of a ground walk or run, a flapping climb, or a flared landing, at
 * 60 fps with a render-only (dt 0) frame after every second update, as the capture harness and a
 * paused game do. Reports the largest bend between tail segments (joints past the root), the root
 * joint's, and the tip's pitch excursion over the last wingbeat.
 */
function tailRun(breed: BreedId, kind: 'walk' | 'run' | 'flap' | 'landing') {
  const B = BREEDS[breed];
  const sh = B.standHeight;
  const w = new Wyvern(look(breed));
  const pose: WyvernPose = kind === 'flap' ? gliding() : standing(breed);
  if (kind === 'flap') pose.flapStrength = 1;
  let maxJoint = 0;
  let maxRoot = 0;
  const tip: number[] = [];
  const frames = kind === 'landing' ? 90 + 150 : 60 + 120;
  for (let i = 0; i < frames; i++) {
    if (kind === 'walk' || kind === 'run') {
      const v = kind === 'walk' ? 0.4 * B.groundSpeed : B.groundSpeed;
      pose.gait = kind;
      pose.groundSpeed = v;
      pose.velocity.set(0, 0, v);
      pose.position.z += v / 60;
      pose.lookTarget.z += v / 60;
    } else if (kind === 'flap') {
      pose.flapPhase = ((i / 60) * B.flapRate) % 1;
      pose.position.z += 24 / 60;
      pose.lookTarget.z += 24 / 60;
    } else if (i < 90) {
      // Flaring in, sinking at 6 m/s, then down hard.
      pose.airborne = true;
      pose.wingSpread = 1;
      pose.flare = 1;
      pose.flapStrength = 0.5;
      pose.flapPhase = ((i / 60) * B.flapRate) % 1;
      pose.velocity.set(0, -6, 6);
      pose.position.y = 10 + sh + (90 - i) * 0.05;
    } else {
      pose.airborne = false;
      pose.wingSpread = 0.22;
      pose.flare = 0;
      pose.flapStrength = 0;
      pose.velocity.set(0, 0, 0);
      pose.position.y = 10 + sh;
      pose.gait = i < 130 ? 'landing' : 'idle';
    }
    w.update(1 / 60, pose);
    if (i % 2 === 1) w.update(0, pose);
    if (kind !== 'landing' && i < 60) continue;
    const { dirs, base } = tailDirs(w);
    for (let j = 1; j < dirs.length; j++) maxJoint = Math.max(maxJoint, angleDeg(dirs[j], dirs[j - 1]));
    maxRoot = Math.max(maxRoot, angleDeg(dirs[0], base));
    const d = dirs[dirs.length - 1];
    tip.push((Math.atan2(d.y, -d.z) * 180) / Math.PI);
  }
  w.dispose();
  const beat = tip.slice(-Math.round(60 / B.flapRate));
  return { maxJoint, maxRoot, tipExcursion: (Math.max(...beat) - Math.min(...beat)) / 2 };
}

describe('the tail: a heavy reptile counterweight (C1)', { timeout: 120000 }, () => {
  it('never kinks: every joint stays inside its cone in the walk, run, flapping and landing, for every breed', () => {
    for (const breed of BREED_ORDER) {
      // 20° on the light skimmer's whippy tail, 15° on the others.
      const limit = breed === 'skimmer' ? 20 : 15;
      for (const kind of ['walk', 'run', 'flap', 'landing'] as const) {
        const r = tailRun(breed, kind);
        expect(r.maxJoint, `${breed} ${kind}`).toBeLessThan(limit + 0.01);
        // The root joint follows the authored curve (down to −14° in the flare) within its cone.
        expect(r.maxRoot, `${breed} ${kind} root`).toBeLessThan(24);
      }
    }
  });

  it('sends a gentle wave down the tail on each wingbeat, not a flick at the tip', () => {
    for (const breed of BREED_ORDER) {
      const r = tailRun(breed, 'flap');
      expect(r.tipExcursion, breed).toBeLessThan(breed === 'ironback' ? 15 : 20);
    }
  });

  it('hangs in an S air brake while flaring: dropped at the root, curling back up toward the tip', () => {
    for (const breed of BREED_ORDER) {
      const w = new Wyvern(look(breed));
      const pose = gliding();
      pose.airspeed = 12;
      pose.velocity.set(0, -1, 12);
      pose.flare = 1;
      pose.flapStrength = 0.6;
      for (let i = 0; i < 180; i++) {
        pose.flapPhase = ((i / 60) * BREEDS[breed].flapRate) % 1;
        pose.position.addScaledVector(pose.velocity, 1 / 60);
        w.update(1 / 60, pose);
      }
      const { dirs, base } = tailDirs(w);
      const pitch = (v: Vector3) => Math.atan2(v.y, Math.hypot(v.x, v.z));
      // The root bends down from the pelvis...
      expect(pitch(dirs[0]) - pitch(base), breed).toBeLessThan(-0.12);
      // ...and the distal half curls back up.
      expect(pitch(dirs[dirs.length - 1]) - pitch(dirs[4]), breed).toBeGreaterThan(0.12);
      w.dispose();
    }
  });

  it('settles at rest: the tail sinks to the ground in a sideways S, and holds still', () => {
    for (const breed of BREED_ORDER) {
      const sh = BREEDS[breed].standHeight;
      const w = new Wyvern(look(breed));
      const pose = standing(breed);
      for (let i = 0; i < 60 * 8; i++) w.update(1 / 60, pose);
      const pts = Array.from({ length: 10 }, (_, k) => boneWorld(w, `tail${k}`));
      // Low at the tip (lying out along the ground)...
      expect(pts[9].y - 10, breed).toBeLessThan(0.35 * sh);
      // ...curved to one side and back (the lateral offset's slope changes sign: an S, not a C).
      const slopes = pts.slice(1).map((p, k) => (p.x - pts[k].x) / Math.max(1e-6, pts[k].z - p.z));
      expect(Math.max(...slopes) * Math.min(...slopes), breed).toBeLessThan(0);
      // Still: over the next two seconds the tip moves less than 5 cm.
      const tip0 = pts[9].clone();
      let drift = 0;
      for (let i = 0; i < 120; i++) {
        w.update(1 / 60, pose);
        drift = Math.max(drift, boneWorld(w, 'tail9').distanceTo(tip0));
      }
      expect(drift, breed).toBeLessThan(0.05);
      w.dispose();
    }
  });

  it('ignores render-only frames: a dt 0 update changes nothing', () => {
    const a = new Wyvern(look('harrier'));
    const b = new Wyvern(look('harrier'));
    const pa = standing('harrier');
    const pb = standing('harrier');
    for (let i = 0; i < 120; i++) {
      for (const p of [pa, pb]) {
        p.gait = 'run';
        p.groundSpeed = 9;
        p.velocity.set(0, 0, 9);
        p.position.z += 9 / 60;
        p.lookTarget.z += 9 / 60;
      }
      a.update(1 / 60, pa);
      b.update(1 / 60, pb);
      b.update(0, pb);
    }
    const ba = a.skinnedMesh!.skeleton.bones;
    const bb = b.skinnedMesh!.skeleton.bones;
    // (Component differences: an angle from acos near 1 turns 1e-13 of rounding into 1e-6 rad.)
    for (let i = 0; i < ba.length; i++) {
      const qa = ba[i].quaternion;
      const qb = bb[i].quaternion;
      const d = Math.max(Math.abs(qa.x - qb.x), Math.abs(qa.y - qb.y), Math.abs(qa.z - qb.z), Math.abs(qa.w - qb.w));
      expect(d, ba[i].name).toBeLessThan(1e-9);
    }
    a.dispose();
    b.dispose();
  });
});

describe('budget (animator cost)', () => {
  it('queries the terrain only when a landing spot moves: none standing, a few a stride walking', () => {
    let calls = 0;
    const terrain = {
      groundAt: (x: number, _z: number, _y: number, out?: GroundHit) => {
        calls++;
        const h = out ?? { y: 0, normal: new Vector3(0, 1, 0), islandId: 1, surface: 'grass' as const };
        h.y = 10 + 0.02 * Math.sin(x);
        return h;
      },
    };
    const w = new Wyvern(look('harrier'), { terrain });
    const pose = standing('harrier');
    for (let i = 0; i < 120; i++) w.update(1 / 60, pose);
    calls = 0;
    for (let i = 0; i < 300; i++) w.update(1 / 60, pose);
    expect(calls).toBe(0);
    pose.gait = 'walk';
    pose.groundSpeed = 3;
    pose.velocity.set(0, 0, 3);
    calls = 0;
    for (let i = 0; i < 300; i++) {
      pose.position.z += 3 / 60;
      w.update(1 / 60, pose);
    }
    // (It was four per update: every foot, every frame.)
    expect(calls / 300).toBeLessThan(0.25);
    w.dispose();
  });
});

describe('pure helpers', () => {
  it('two-bone IK preserves segment lengths and bends toward the pole', () => {
    const root = new Vector3(0, 0, 0);
    const target = new Vector3(0, -1.5, 0.3);
    const mid = new Vector3();
    solveTwoBone(root, 1, 1, target, new Vector3(0, 0, 1), mid);
    expect(mid.distanceTo(root)).toBeCloseTo(1, 5);
    expect(mid.distanceTo(target)).toBeCloseTo(1, 5);
    expect(mid.z).toBeGreaterThan(0.3);
    // Out of reach: stays straight toward the target.
    const far = solveTwoBone(root, 1, 1, new Vector3(0, -5, 0), new Vector3(0, 0, 1), mid);
    expect(far).toBeGreaterThan(2.9);
    expect(mid.y).toBeLessThan(-0.99);
  });

  it('aimRotation maps a rest direction onto a target direction', () => {
    const q = new Quaternion();
    const rest = new Vector3(1, 0, 0);
    const dir = new Vector3(0.2, -0.9, 0.4).normalize();
    aimRotation(rest, new Vector3(0, 1, 0), dir, new Vector3(0, 0, 1), q);
    const out = rest.clone().applyQuaternion(q);
    expect(out.distanceTo(dir)).toBeLessThan(1e-6);
  });

  it('gait: planted feet never slide while the body walks and turns', () => {
    const rest = [new Vector3(0.5, -2.6, -0.8), new Vector3(-0.5, -2.6, -0.8), new Vector3(1.2, -2.6, 1.5), new Vector3(-1.2, -2.6, 1.5)];
    const gait = new Gait(rest);
    const body = new Vector3(0, 2.6, 0);
    let yaw = 0;
    const q = new Quaternion();
    const ctx: GaitContext = {
      dt: 1 / 60,
      toWorld: (m, out) => out.copy(m).applyQuaternion(q).add(body),
      groundAt: () => 0,
      velocity: new Vector3(),
      yawRate: 0.4,
      standHeight: 2.6,
      runBlend: 0,
      moving: true,
    };
    const last = rest.map(() => new Vector3());
    const wasPlanted = [false, false, false, false];
    let swings = 0;
    for (let i = 0; i < 600; i++) {
      yaw += 0.4 / 60;
      q.setFromAxisAngle(new Vector3(0, 1, 0), yaw);
      ctx.velocity.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(3);
      body.addScaledVector(ctx.velocity, 1 / 60);
      gait.update(ctx);
      gait.feet.forEach((f, k) => {
        if (!f.swinging && wasPlanted[k]) expect(f.pos.distanceTo(last[k])).toBeLessThan(1e-9);
        if (f.swinging && wasPlanted[k]) swings++;
        // Feet stay near the body.
        expect(Math.hypot(f.pos.x - body.x, f.pos.z - body.z)).toBeLessThan(4);
        wasPlanted[k] = !f.swinging;
        last[k].copy(f.pos);
      });
    }
    expect(swings).toBeGreaterThan(20);
    expect(footPhase(0.1, 0, 0.6).swing).toBe(false);
    expect(footPhase(0.7, 0, 0.6).swing).toBe(true);
  });
});

/**
 * A wyvern walking on the gameplay walker's gait clock over `ground` (height and normal at x, z):
 * the walker (player/ground.ts) runs its footstep clock and the model follows WyvernPose.gaitPhase,
 * as in the game. `speedAt(frame)` is the target speed, reached at the walker's acceleration.
 * `each` sees every frame after the model's update; footstep contacts come with where the model said
 * the foot would come down (footLanding, read before the update, as the game's footsteps are).
 */
function walkOn(
  breed: BreedId,
  ground: (x: number, z: number, n: Vector3) => number,
  yaw: number,
  frames: number,
  speedAt: (i: number) => number,
  each: (w: Wyvern, i: number, walker: GroundWalker, steps: { foot: number; at: Vector3 }[]) => void,
) {
  const b = BREEDS[breed];
  const terrain = {
    groundAt: (x: number, z: number, _y: number, out?: GroundHit) => {
      const h = out ?? { y: 0, normal: new Vector3(), islandId: 1, surface: 'grass' as const };
      h.y = ground(x, z, h.normal);
      return h;
    },
  };
  const w = new Wyvern(look(breed), { terrain });
  const walker = new GroundWalker();
  walker.yaw = yaw;
  walker.position.set(0, ground(0, 0, new Vector3()) + b.standHeight, 0);
  const n = new Vector3();
  const pose = standing(breed);
  for (let i = 0; i < frames; i++) {
    const v = speedAt(i);
    walker.speed = v > walker.speed ? Math.min(v, walker.speed + P.wyvernAccel / 60) : Math.max(v, walker.speed - P.wyvernBrake / 60);
    walker.position.x += (Math.sin(yaw) * walker.speed) / 60;
    walker.position.z += (Math.cos(yaw) * walker.speed) / 60;
    walker.groundY = ground(walker.position.x, walker.position.z, n);
    walker.normal.copy(n);
    walker.position.y = walker.groundY + b.standHeight;
    walker.velocity.set(Math.sin(yaw) * walker.speed, 0, Math.cos(yaw) * walker.speed);
    const c = walker.gaitStep(1 / 60, b, true);
    const steps: { foot: number; at: Vector3 }[] = [];
    for (let k = 0; k < 4; k++) if (c & (1 << k)) steps.push({ foot: k, at: w.footLanding(k, new Vector3()) });
    pose.position.copy(walker.position);
    standingOrientation(yaw, walker.normal, gaitProfile(breed).slopeTilt, 0, pose.orientation);
    pose.velocity.copy(walker.velocity);
    pose.groundY = walker.groundY;
    pose.gait = walker.speed > 0.3 ? 'walk' : 'idle';
    pose.groundSpeed = walker.speed;
    pose.gaitPhase = walker.gaitPhase;
    pose.lookTarget.set(walker.position.x + Math.sin(yaw) * 40, walker.position.y + 1, walker.position.z + Math.cos(yaw) * 40);
    w.update(1 / 60, pose);
    each(w, i, walker, steps);
  }
  w.dispose();
}

const FLAT = (_x: number, _z: number, n: Vector3) => {
  n.set(0, 1, 0);
  return 10;
};

describe('ground gait truth (C4)', { timeout: 300000 }, () => {
  it('walks in the lateral sequence (LH, LF, RH, RF) on the walker\'s clock, each footstep within 0.1 m of where its foot comes down', () => {
    const pos = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
    const wt: number[] = [0, 0, 0, 0];
    for (const breed of BREED_ORDER) {
      const b = BREEDS[breed];
      // The keyboard walk, and a brisk walk (short of where the walk starts blending into the run).
      for (const walk of [P.keyboardWalk, Math.min(P.walkFraction * 0.9, (0.65 * gaitProfile(breed).runSpeed) / b.groundSpeed)]) {
        const order: number[] = [];
        const heard: (Vector3 | null)[] = [null, null, null, null];
        let worst = 0;
        let landed = 0;
        walkOn(breed, FLAT, 0.3, 420, (i) => (i < 30 ? 0 : walk * b.groundSpeed), (w, _i, _walker, steps) => {
          for (const s of steps) {
            order.push(s.foot);
            heard[s.foot] = s.at;
          }
          w.footContacts(pos, wt);
          for (let k = 0; k < 4; k++) {
            if (heard[k] === null || wt[k] < 1) continue;
            worst = Math.max(worst, heard[k]!.distanceTo(pos[k]));
            heard[k] = null;
            landed++;
          }
        });
        const tag = `${breed} at ${walk} of groundSpeed`;
        expect(landed, tag).toBeGreaterThan(12);
        expect(worst, tag).toBeLessThan(0.1);
        // After the first few, the touchdowns go LH, LF, RH, RF round and round (foot order LH 0,
        // RH 1, LF 2, RF 3).
        const seq = [0, 2, 1, 3];
        const tail = order.slice(4);
        const k0 = seq.indexOf(tail[0]);
        tail.forEach((f, j) => expect(f, `${tag}: touchdown ${j}`).toBe(seq[(k0 + j) % 4]));
      }
    }
  });

  it('rolls the trunk over the feet that are down: the swinging side\'s hip and shoulder hike', () => {
    for (const breed of BREED_ORDER) {
      let hips = 0;
      let shoulders = 0;
      walkOn(breed, FLAT, 0, 360, (i) => (i < 30 ? 0 : P.keyboardWalk * BREEDS[breed].groundSpeed), (w, i) => {
        if (i < 150) return;
        const feet = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
        const down = [0, 0, 0, 0];
        w.footContacts(feet, down);
        // + when the left foot is lifted (less of it down) than the right.
        const hindLift = down[1] - down[0];
        const foreLift = down[3] - down[2];
        hips += hindLift * (boneWorld(w, 'thighL').y - boneWorld(w, 'thighR').y);
        shoulders += foreLift * (boneWorld(w, 'humerusL').y - boneWorld(w, 'humerusR').y);
      });
      expect(hips, breed).toBeGreaterThan(0.05);
      expect(shoulders, breed).toBeGreaterThan(0.02);
    }
  });

  it('keeps every planted foot on the ground: slopes up to the walk limit, up, down and across, and steps', () => {
    const DEGS = Math.acos(P.maxSlopeY) / DEG;
    const grounds: [string, (x: number, z: number, n: Vector3) => number][] = [
      [`${Math.round(DEGS)}° slope`, (_x, z, n) => {
        const t = Math.tan(DEGS * DEG);
        n.set(0, 1, -t).normalize();
        return 10 + z * t;
      }],
      ['20° slope', (_x, z, n) => {
        const t = Math.tan(20 * DEG);
        n.set(0, 1, -t).normalize();
        return 10 + z * t;
      }],
      ['0.3 m step', (_x, z, n) => {
        n.set(0, 1, 0);
        return z > 2 ? 9.7 : 10;
      }],
    ];
    const pos = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
    const wt: number[] = [0, 0, 0, 0];
    for (const breed of BREED_ORDER) {
      const b = BREEDS[breed];
      for (const [name, ground] of grounds) {
        for (const yaw of [0, Math.PI, Math.PI / 2]) {
          let worst = 0;
          // Each foot's own bone (the ball of the foot, the wrist) sits a fixed way off the spot the
          // gait planted it on (the sole, the claws), as when standing there: never hung in the air.
          const stand = [Infinity, Infinity, Infinity, Infinity];
          const was = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
          walkOn(breed, ground, yaw, 300, (i) => (i < 90 ? 0 : P.keyboardWalk * b.groundSpeed), (w, i) => {
            w.footContacts(pos, wt);
            for (let k = 0; k < 4; k++) {
              // (Planted: down, and where it was last frame.)
              const planted = wt[k] === 1 && pos[k].distanceTo(was[k]) < 1e-9;
              was[k].copy(pos[k]);
              if (!planted || i < 60) continue;
              const rise = boneWorld(w, ['toesL', 'toesR', 'clawL', 'clawR'][k]).distanceTo(pos[k]);
              if (i < 90) stand[k] = Math.min(stand[k], rise);
              else worst = Math.max(worst, rise - stand[k]);
            }
          });
          // (At most a frame or two, at the walk limit, before a foot out of reach lifts early.)
          expect(worst, `${breed} on a ${name}, yaw ${Math.round((yaw * 180) / Math.PI)}°`).toBeLessThan(0.03 * b.standHeight);
        }
      }
    }
  });
});

/** A pose over time: the starting pose and a step per frame (frame index, breed). */
type PoseRun = { base: (breed: BreedId) => WyvernPose; frames: number; step?: (p: WyvernPose, i: number, breed: BreedId) => void };

const SELF_POSES: Record<string, PoseRun> = {
  stand: { base: standing, frames: 150 },
  // Looking back over its shoulder (the head and neck past the folded wing).
  lookback: { base: standing, frames: 150, step: (p) => p.lookTarget.set(8, 12, -6) },
  kneel: {
    base: standing,
    frames: 150,
    step: (p, i, b) => {
      p.kneel = Math.min(1, i / 24);
      p.lookTarget.set(BREEDS[b].standHeight * 0.55 + 1.3, 11.6, 0.6);
    },
  },
  glide: { base: () => gliding(), frames: 90, step: (p) => { p.position.z += 0.4; p.lookTarget.z += 0.4; } },
  flap: {
    base: () => gliding(),
    frames: 200,
    step: (p, i, b) => {
      p.flapStrength = 1;
      p.flapPhase = ((i / 60) * BREEDS[b].flapRate) % 1;
      p.position.z += 0.4;
      p.lookTarget.z += 0.4;
    },
  },
  flare: { base: () => gliding(), frames: 90, step: (p) => { p.flare = 1; p.position.z += 0.25; p.lookTarget.z += 0.25; } },
  bank: {
    base: () => gliding(),
    frames: 90,
    step: (p) => {
      p.orientation.setFromAxisAngle(new Vector3(0, 0, 1), 0.7);
      p.angularVelocity.set(0, -0.6, 0.3);
      p.position.z += 0.4;
      p.lookTarget.z += 0.4;
    },
  },
};

/** The deepest self-penetration per part pair over a pose run (sampled every 6th frame after a second). */
function selfPenetration(breed: BreedId, saddle: string, run: PoseRun): Penetration {
  const w = new Wyvern(look(breed, { saddle }));
  const p = run.base(breed);
  const max = {} as Penetration;
  for (const k of PEN_PAIRS) max[k] = 0;
  const pen = {} as Penetration;
  for (let i = 0; i < run.frames; i++) {
    run.step?.(p, i, breed);
    w.update(1 / 60, p);
    if ((i >= 60 && i % 6 === 0) || i === run.frames - 1) {
      wyvernPenetration(w, pen);
      for (const k of PEN_PAIRS) max[k] = Math.max(max[k], pen[k]);
    }
  }
  w.dispose();
  return max;
}

describe('no clipping: the wyvern never passes through itself (Q17, C16)', { timeout: 600000 }, () => {
  // Self-collision proxies (collision.ts): every wing vertex against the leg capsules and the
  // torso's cross-sections, the neck and head against the wing, the tail against the legs. At
  // most 2 cm anywhere, as the capture harness's penetration report measures it.
  for (const breed of BREED_ORDER) {
    it(`${breed}: standing, looking back, kneeling, gliding, a full wingbeat, flaring, banking; every saddle`, () => {
      for (const saddle of ['rider', 'racing', 'royal', 'nomad']) {
        for (const [name, run] of Object.entries(SELF_POSES)) {
          if (saddle !== 'rider' && name !== 'stand' && name !== 'flap') continue;
          const pen = selfPenetration(breed, saddle, run);
          for (const k of PEN_PAIRS) expect(pen[k], `${breed} ${saddle} ${name} ${k}`).toBeLessThan(0.02);
        }
      }
    });
  }
});

describe('no clipping on the move: the folded wings keep off the hind legs (2026-10-18)', { timeout: 600000 }, () => {
  // Robert: "make sure the wings fold in with no flipping on the hind legs". Standing was covered
  // above; striding, the forearm, the membrane folded along it and the finger spars swept through
  // the thigh and shin by up to 0.48 m. The forefeet now plant outside the hind track, the elbow
  // swings out to clear the posed leg and the folded fingers keep over and ahead of it.
  for (const breed of BREED_ORDER) {
    it(`${breed}: walking, a brisk walk and running`, () => {
      const b = BREEDS[breed];
      for (const frac of [P.keyboardWalk, P.walkFraction * 0.9, 1]) {
        const pen = {} as Penetration;
        let worst = 0;
        walkOn(breed, FLAT, 0.3, 300, (i) => (i < 30 ? 0 : frac * b.groundSpeed), (w, i) => {
          if (i < 60) return;
          wyvernPenetration(w, pen);
          worst = Math.max(worst, pen['wing-leg']);
        });
        expect(worst, `${breed} at ${frac.toFixed(2)} of groundSpeed`).toBeLessThan(0.02);
      }
    });
  }
});

describe('environment awareness (C16): the folded wings keep off walls', () => {
  it('draws the folded wing in against the body when a rock face is at its elbow, and only that one', () => {
    for (const breed of BREED_ORDER) {
      const elbows = (wallX: number | null) => {
        const terrain = {
          groundAt: (_x: number, _z: number, _y: number, out?: GroundHit) => {
            const h = out ?? { y: 0, normal: new Vector3(0, 1, 0), islandId: 0, surface: 'grass' as const };
            h.y = 10;
            return h;
          },
          // A sheer face beside the wyvern's left flank (x = wallX), open everywhere else.
          distance: (p: Vector3) => (wallX === null ? 50 : wallX - p.x),
        };
        const w = new Wyvern(look(breed), { terrain });
        const pose = standing(breed);
        for (let i = 0; i < 150; i++) w.update(1 / 60, pose);
        const out = [boneWorld(w, 'forearmL'), boneWorld(w, 'forearmR')];
        w.dispose();
        return out;
      };
      const open = elbows(null);
      // The wall 5 cm off the open-ground elbow's surface (about 0.25 m out from its bone).
      const wall = elbows(open[0].x + 0.3);
      expect(wall[0].x, `${breed} left elbow drawn in`).toBeLessThan(open[0].x - 0.05);
      expect(Math.abs(wall[1].x - open[1].x), `${breed} right elbow unchanged`).toBeLessThan(0.01);
    }
  });
});

describe('weight and life (client direction: a big, heavy dragon)', { timeout: 60000 }, () => {
  it('holds the head steadier than the body, trailing the shoulders it hangs from (neck lag), on every breed and beat rate', () => {
    // The head-height hold (C12) holds it on the slow galewing and ironback beats as well as the
    // quick ones (before it, the galewing's 0.95 Hz beat lifted the head with the chest: 1.05× the
    // saddle's travel).
    for (const breed of BREED_ORDER) {
      const h = beat(breed);
      expect(h.headRange, breed).toBeLessThan(h.saddleRange * 0.55);
      expect(h.headRange, breed).toBeLessThan(h.shoulderRange * 0.55);
      // The head's high point comes after the shoulders' (modulo the cycle).
      const lag = (h.headPeak - h.shoulderPeak + 1) % 1;
      expect(lag, breed).toBeGreaterThan(0.01);
      expect(lag, breed).toBeLessThan(0.3);
    }
  });

  it('folds the wings back along the flank on the ground: tips up off the ground, behind the shoulder (VIS-17)', () => {
    for (const breed of BREED_ORDER) {
      const w = new Wyvern(look(breed));
      const pose = standing(breed);
      for (let i = 0; i < 120; i++) w.update(1 / 60, pose);
      const l = new Vector3();
      const r = new Vector3();
      w.getWingtips(l, r);
      const sh = BREEDS[breed].standHeight;
      const shoulder = boneWorld(w, 'humerusL');
      for (const tip of [l, r]) {
        // Not a second pair of stilts: the tips ride well above the ground...
        expect(tip.y - 10).toBeGreaterThan(0.5 * sh);
        // ...back along the body, behind the shoulder, and close in to the flank.
        expect(tip.z).toBeLessThan(shoulder.z - 0.4);
        expect(Math.abs(tip.x)).toBeLessThan(BREEDS[breed].wingspan * 0.2);
      }
      expect(w.uniforms.uFold.value).toBeGreaterThan(0.95);
      w.dispose();
    }
  });

  it('folds each wing into a limb that hangs from the shoulder, its membrane in along the body (Q3, C3)', () => {
    // The client's top complaint: on the ground the folded membrane stood out from the flank as a
    // big flat panel, 1.2-1.6 m outboard ("greaves"). Now every bone keeps its dorsal face turned
    // out, the fingers bundle up the forearm and the innermost finger's roll keeps the inner
    // panel's trailing edge in to the flank. Measured in the body frame from the skinned mesh.
    for (const breed of BREED_ORDER) {
      const w = new Wyvern(look(breed));
      const pose = standing(breed);
      for (let i = 0; i < 150; i++) w.update(1 / 60, pose);
      const f = foldedStance(w);
      for (const s of f.sides) {
        // The wrist plants under the shoulder or just ahead of it, and the forearm stands near
        // vertical seen from the front: no sideways elbow.
        expect(s.wrist.z - s.shoulder.z, `${breed} wrist under the shoulder`).toBeGreaterThan(-0.2);
        expect(s.wrist.z - s.shoulder.z, `${breed} wrist under the shoulder`).toBeLessThan(0.45);
        expect(Math.abs(s.foreFrontDeg), `${breed} forearm from the front`).toBeLessThan(15);
        // From the side it leans forward from the elbow tucked back against the flank, like a
        // bat's or a pterosaur's on the ground. (How far is geometry: an arm this long for the
        // shoulder's height must fold, and with the elbow held against the flank the fold can only
        // go back. With the arm at its own length again (A13: the span is in the wingtip finger's
        // outer phalanx) it is 9-35 deg.)
        expect(s.foreSideDeg, `${breed} forearm from the side`).toBeGreaterThan(0);
        expect(s.foreSideDeg, `${breed} forearm from the side`).toBeLessThan(38);
        expect(Math.abs(s.elbow.x) - f.maxHalfWidth, `${breed} elbow tucked in`).toBeLessThan(0.3);
      }
      // Seen from the front, the hand-wing panels stay within 0.35 m of the body's silhouette (the
      // shoulders, its widest). The inner panel's trailing edge is skinned partly to the body,
      // which holds its spread-wing (bind) position, so the folded edge can't come all the way in
      // on the long-armed breeds until that edge is re-skinned (A2): within 0.5 m (was 1.2-1.6 m).
      expect(f.outboard.handWing, `${breed} hand-wing panels`).toBeLessThan(0.35);
      expect(f.outboard.leading, `${breed} leading-edge panel`).toBeLessThan(0.35);
      expect(f.outboard.inner, `${breed} inner panel`).toBeLessThan(0.5);
      w.dispose();
    }
  });

  it('kneels for its rider: a belly-down couch toward their side, the folded forearm a low step (C11)', () => {
    for (const breed of BREED_ORDER) {
      const sh = BREEDS[breed].standHeight;
      for (const side of [1, -1]) {
        const w = new Wyvern(look(breed));
        const pose = standing(breed);
        // The rider at the shoulder on `side` (+1 the wyvern's left), its head the look target.
        pose.lookTarget.set(side * (0.55 * sh + 1.3), 10 + 1.6, 0.25 * sh);
        for (let i = 0; i < 120; i++) w.update(1 / 60, pose);
        const near = side > 0 ? 'L' : 'R';
        const far = side > 0 ? 'R' : 'L';
        const stand = {
          seat: w.socket('seat', new Vector3())!.clone(),
          step: w.socket(side > 0 ? 'stepL' : 'stepR', new Vector3())!.clone(),
          shoulder: boneWorld(w, `humerus${near}`),
        };
        const hind0 = [boneWorld(w, 'toesL'), boneWorld(w, 'toesR')];
        // Down over 0.4 s (E's timeline ramps at 2.6/s), held.
        for (let i = 0; i < 120; i++) {
          pose.kneel = Math.min(1, i / 24);
          w.update(1 / 60, pose);
        }
        const seat = w.socket('seat', new Vector3())!;
        const step = w.socket(side > 0 ? 'stepL' : 'stepR', new Vector3())!;
        const shoulder = boneWorld(w, `humerus${near}`);
        const id = `${breed} ${near}`;
        // The shoulder comes down at least 0.3·standHeight (a couch, not a dip), the seat with it.
        expect(stand.shoulder.y - shoulder.y, id).toBeGreaterThan(0.3 * sh);
        expect(stand.seat.y - seat.y, id).toBeGreaterThan(0.3 * sh);
        // Rolled toward the rider: the near shoulder lower than the far one.
        expect(shoulder.y, id).toBeLessThan(boneWorld(w, `humerus${far}`).y - 0.02);
        // The near forearm is brought forward and out as a low step.
        expect(step.y - 10, id).toBeLessThan(0.75 * (stand.step.y - 10));
        expect(step.y - 10, id).toBeLessThan(0.3 * sh);
        expect(step.z - stand.step.z, id).toBeGreaterThan(0.2);
        expect((step.x - stand.step.x) * side, id).toBeGreaterThan(0.15);
        // The belly stays off the ground; the hind feet stay where they stood.
        expect(seat.y - 10, id).toBeGreaterThan(0.5 * sh);
        expect(boneWorld(w, 'toesL').distanceTo(hind0[0]), id).toBeLessThan(0.08);
        expect(boneWorld(w, 'toesR').distanceTo(hind0[1]), id).toBeLessThan(0.08);
        // And up again: back to the standing seat.
        for (let i = 0; i < 180; i++) {
          pose.kneel = Math.max(0, 1 - i / 24);
          w.update(1 / 60, pose);
        }
        expect(w.socket('seat', new Vector3())!.distanceTo(stand.seat), id).toBeLessThan(0.03);
        w.dispose();
      }
    }
  });

  it('settles on landing: the body sinks into the legs and springs back', () => {
    const w = new Wyvern(look('harrier'));
    const sh = BREEDS.harrier.standHeight;
    const pose = standing('harrier');
    pose.airborne = true;
    pose.wingSpread = 1;
    pose.velocity.set(0, -6, 6);
    for (let i = 0; i < 30; i++) w.update(1 / 60, pose);
    pose.airborne = false;
    pose.wingSpread = 0.22;
    pose.velocity.set(0, 0, 0);
    const ys: number[] = [];
    for (let i = 0; i < 150; i++) {
      w.update(1 / 60, pose);
      ys.push(w.saddle.getWorldPosition(_p).y);
    }
    const rest = ys[ys.length - 1];
    const low = Math.min(...ys.slice(0, 40));
    // A visible sink (several cm on a hard landing), then back to rest.
    expect(rest - low).toBeGreaterThan(0.04);
    expect(rest - low).toBeLessThan(0.5 * sh);
    expect(Math.abs(ys[ys.length - 2] - rest)).toBeLessThan(0.005);
    w.dispose();
  });

  it('stretches and basks after resting: neck up, a slight gape, wings spread wide, then folds away', () => {
    const w = new Wyvern(look('harrier'));
    const pose = standing('harrier');
    for (let i = 0; i < 120; i++) w.update(1 / 60, pose);
    const l0 = new Vector3();
    const r0 = new Vector3();
    w.getWingtips(l0, r0);
    const head0 = w.getHead(new Vector3()).y;
    const jaw = w.skinnedMesh!.skeleton.bones.find((b) => b.name === 'jaw')!;
    let span = 0;
    let headUp = 0;
    let gape = 0;
    let lids = 1;
    let fold = 1;
    const dur = (w as unknown as { animator: { baskDuration: number } }).animator.baskDuration;
    expect(dur).toBeGreaterThan(2.5);
    // The player drives ruffle 0 -> 1 over 1.4 s; the animator plays its own, slower bask.
    for (let i = 0; i < 60 * 4.5; i++) {
      pose.ruffle = i < 84 ? i / 84 : 0;
      w.update(1 / 60, pose);
      w.getWingtips(_p, _q);
      span = Math.max(span, _p.distanceTo(_q));
      headUp = Math.max(headUp, w.getHead(_p).y - head0);
      gape = Math.max(gape, 2 * Math.acos(Math.min(1, Math.abs(jaw.quaternion.w))));
      // Through the full bask the eyes stay half-lidded (a blink only closes them further).
      const u = i / 60 / dur;
      if (u > 0.55 && u < 0.75) lids = Math.min(lids, w.uniforms.uBlink.value);
      fold = Math.min(fold, w.uniforms.uFold.value);
    }
    // Wings spread wide (most of the span), membranes unfolded to the light.
    expect(span).toBeGreaterThan(0.7 * BREEDS.harrier.wingspan);
    expect(fold).toBeLessThan(0.2);
    // The neck reaches up; a slight gape, not a yawn; eyes half-lidded in the sun.
    expect(headUp).toBeGreaterThan(0.25);
    expect(gape).toBeGreaterThan(0.08);
    expect(gape).toBeLessThan(0.3);
    expect(lids).toBeGreaterThan(0.3);
    // ...and settles back into the folded stance.
    for (let i = 0; i < 120; i++) w.update(1 / 60, pose);
    w.getWingtips(_p, _q);
    expect(_p.distanceTo(l0)).toBeLessThan(0.1);
    expect(w.uniforms.uFold.value).toBeGreaterThan(0.95);
    w.dispose();
  });

  it('cuts the bask short, smoothly, when the wyvern walks off', () => {
    const w = new Wyvern(look('harrier'));
    const pose = standing('harrier');
    for (let i = 0; i < 60; i++) w.update(1 / 60, pose);
    for (let i = 0; i < 100; i++) {
      pose.ruffle = Math.min(1, i / 84);
      w.update(1 / 60, pose);
    }
    expect(w.uniforms.uFold.value).toBeLessThan(0.6);
    pose.gait = 'walk';
    pose.groundSpeed = 2;
    pose.velocity.set(0, 0, 2);
    let last = w.uniforms.uFold.value;
    let maxStep = 0;
    for (let i = 0; i < 90; i++) {
      pose.position.z += 2 / 60;
      pose.lookTarget.z += 2 / 60;
      w.update(1 / 60, pose);
      maxStep = Math.max(maxStep, Math.abs(w.uniforms.uFold.value - last));
      last = w.uniforms.uFold.value;
    }
    expect(last).toBeGreaterThan(0.9);
    expect(maxStep).toBeLessThan(0.12);
    w.dispose();
  });

  it('blinks like a reptile: sideways sweeps of the nictitating membrane, held half-drawn in a fast dive', () => {
    const w = new Wyvern(look('harrier'));
    const pose = standing('harrier');
    let nict = 0;
    let both = 0;
    for (let i = 0; i < 60 * 12; i++) {
      w.update(1 / 60, pose);
      nict = Math.max(nict, w.uniforms.uNictitate.value);
      if (w.uniforms.uNictitate.value > 0.5 && w.uniforms.uBlink.value > 0.5) both++;
    }
    expect(nict).toBeGreaterThan(0.9);
    // The inner and outer lids are separate.
    expect(both).toBeLessThan(5);
    const dive = gliding();
    dive.airspeed = 62;
    dive.velocity.set(0, -40, 47);
    let minN = 1;
    for (let i = 0; i < 120; i++) {
      w.update(1 / 60, dive);
      if (i > 60) minN = Math.min(minN, w.uniforms.uNictitate.value);
    }
    expect(minN).toBeGreaterThan(0.4);
    w.dispose();
  });

  it('flicks a forked tongue out past the snout to taste the air when idle, never in flight', () => {
    const w = new Wyvern(look('harrier'));
    const anim = (w as unknown as { animator: { tongueExt: number } }).animator;
    const pose = standing('harrier');
    const L = w.rigDef.props.shape.headLength;
    let out = 0;
    for (let i = 0; i < 60 * 14; i++) {
      w.update(1 / 60, pose);
      out = Math.max(out, anim.tongueExt);
    }
    // The fork (0.92 of the head length at rest) slides out beyond the snout tip (1.0).
    expect(out / L).toBeGreaterThan(0.3);
    const air = gliding();
    let flying = 0;
    for (let i = 0; i < 60 * 14; i++) {
      w.update(1 / 60, air);
      flying = Math.max(flying, anim.tongueExt);
    }
    expect(flying).toBe(0);
    w.dispose();
  });

  it('breathes with its ribs: the flanks swell sideways, the body hardly rises', () => {
    const w = new Wyvern(look('harrier'));
    const pose = standing('harrier');
    const br = w.skinnedMesh!.skeleton.bones.find((b) => b.name === 'breath')!;
    let sx = 0;
    let sy = 0;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < 60 * 8; i++) {
      w.update(1 / 60, pose);
      sx = Math.max(sx, Math.abs(br.scale.x - 1));
      sy = Math.max(sy, Math.abs(br.scale.y - 1));
      if (i > 120) {
        const y = w.saddle.getWorldPosition(_p).y;
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
    expect(sx).toBeGreaterThan(0.025);
    expect(sx).toBeGreaterThan(sy * 3);
    expect(y1 - y0).toBeLessThan(0.02);
    w.dispose();
  });

  it('swings the tail against the head as a counterweight on the ground', () => {
    const tailX = (target: number) => {
      const w = new Wyvern(look('harrier'));
      const pose = standing('harrier');
      pose.lookTarget.set(target, 13, 6);
      for (let i = 0; i < 240; i++) w.update(1 / 60, pose);
      const x = boneWorld(w, 'tail9').x;
      w.dispose();
      return x;
    };
    // Looking left (+x), the tail swings right (-x), and the other way round.
    expect(tailX(30)).toBeLessThan(tailX(-30) - 0.5);
  });

  it('greets its rider on a called arrival: the head comes down and round to them, a nictitating sweep, a tongue burst (C2)', () => {
    for (const breed of BREED_ORDER) {
      const sh = BREEDS[breed].standHeight;
      const w = new Wyvern(look(breed));
      const pose = standing(breed);
      // The rider beside its near (left) shoulder, where a called wyvern stops (player/companion.ts).
      const riderHead = new Vector3(0.42 * sh + 1.2, 10 + 1.6, 0.4 * sh);
      pose.lookTarget.copy(riderHead);
      w.cueIdle(null, 1e4);
      for (let i = 0; i < 180; i++) w.update(1 / 60, pose);
      const y0 = w.getHead(_p).y;
      const d0 = _p.distanceTo(riderHead);
      pose.cue = { kind: 'greet', id: 1 };
      let nict = 0;
      let tongue = 0;
      for (let i = 0; i < 90; i++) {
        w.update(1 / 60, pose);
        nict = Math.max(nict, w.uniforms.uNictitate.value);
        tongue = Math.max(tongue, (w as unknown as { animator: { tongueExt: number } }).animator.tongueExt);
      }
      // Within 1.5 s the head is well down and in toward the rider, the mouth still clear of them.
      const mouth = w.getHead(_p);
      expect(y0 - mouth.y).toBeGreaterThan(0.25 * sh);
      expect(d0 - mouth.distanceTo(riderHead)).toBeGreaterThan(0.25 * sh);
      expect(mouth.distanceTo(riderHead)).toBeGreaterThan(0.8);
      // ...facing them (the head's forward within 60° of the way to their face).
      const head = w.skinnedMesh!.skeleton.bones.find((b) => b.name === 'head')!;
      const fwd = new Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new Quaternion()));
      expect(fwd.dot(riderHead.clone().sub(mouth).normalize())).toBeGreaterThan(Math.cos((60 * Math.PI) / 180));
      expect(nict).toBeGreaterThan(0.9);
      expect(tongue).toBeGreaterThan(0);
      // A cue plays once: the same id again does nothing; and the head comes back up afterwards.
      for (let i = 0; i < 180; i++) w.update(1 / 60, pose);
      expect(w.getHead(_p).y).toBeGreaterThan(y0 - 0.15);
      w.dispose();
    }
  });

  it('builds up exertion on a long climb and pants it off at rest', () => {
    const w = new Wyvern(look('harrier'));
    const pose = gliding();
    pose.flapStrength = 1;
    for (let i = 0; i < 60 * 12; i++) {
      pose.flapPhase = ((i / 60) * 1.6) % 1;
      w.update(1 / 60, pose);
    }
    const anim = (w as unknown as { animator: { exertion: number } }).animator;
    const after = anim.exertion;
    expect(after).toBeGreaterThan(0.4);
    const rest = standing('harrier');
    for (let i = 0; i < 60 * 10; i++) w.update(1 / 60, rest);
    expect(anim.exertion).toBeLessThan(after - 0.4);
    w.dispose();
  });
});

describe('debug capture hooks (scripts/dragon-capture.mjs)', () => {
  const tongueOf = (w: Wyvern) => (w as unknown as { animator: { tongueExt: number } }).animator.tongueExt;

  it('holds the natural idle events off, then plays each cued one', () => {
    const w = new Wyvern(look('harrier'));
    const pose = standing('harrier');
    w.cueIdle(null, 1e4);
    const peak = { lid: 0, nict: 0, tongue: 0 };
    const run = (seconds: number) => {
      peak.lid = peak.nict = peak.tongue = 0;
      for (let i = 0; i < seconds * 60; i++) {
        w.update(1 / 60, pose);
        peak.lid = Math.max(peak.lid, w.uniforms.uBlink.value);
        peak.nict = Math.max(peak.nict, w.uniforms.uNictitate.value);
        peak.tongue = Math.max(peak.tongue, tongueOf(w));
      }
    };
    run(12);
    expect(peak).toEqual({ lid: 0, nict: 0, tongue: 0 });
    w.cueIdle('blink');
    run(0.5);
    expect(peak.lid).toBeGreaterThan(0.9);
    expect(peak.nict + peak.tongue).toBe(0);
    w.cueIdle('nictitate');
    run(0.5);
    expect(peak.nict).toBeGreaterThan(0.9);
    w.cueIdle('tongue');
    run(0.5);
    expect(peak.tongue).toBeGreaterThan(0.01);
    w.dispose();
  });

  it('resetAnimation makes a re-staged wyvern move exactly like a new one', () => {
    const a = new Wyvern(look('ironback'));
    const b = new Wyvern(look('ironback'));
    const pose = standing('ironback');
    for (let i = 0; i < 150; i++) a.update(1 / 60, gliding());
    a.resetAnimation();
    for (let i = 0; i < 45; i++) {
      a.update(1 / 60, pose);
      b.update(1 / 60, pose);
    }
    const ba = a.skinnedMesh!.skeleton.bones;
    const bb = b.skinnedMesh!.skeleton.bones;
    for (let i = 0; i < ba.length; i++) {
      expect(ba[i].quaternion.angleTo(bb[i].quaternion)).toBeLessThan(1e-6);
      expect(ba[i].position.distanceTo(bb[i].position)).toBeLessThan(1e-9);
    }
    a.dispose();
    b.dispose();
  });
});

/**
 * The folded stance of a standing wyvern, measured in its body frame: each arm's joints and the
 * forearm's lean (degrees from vertical; seen from the side + = the wrist ahead of the elbow, from
 * the front + = the wrist outboard of it), the body's widest half-width (front view) and how far
 * the membrane panels reach beyond it (m): the hand-wing panels between the fingers, the
 * leading-edge panel and the inner panel (arm to flank).
 */
function foldedStance(w: Wyvern) {
  const mesh = w.skinnedMesh!;
  const inv = w.group.matrixWorld.clone().invert();
  const rig = w.rigDef;
  const bones = mesh.skeleton.bones;
  const at = (name: string) => bones.find((b) => b.name === name)!.getWorldPosition(new Vector3()).applyMatrix4(inv);
  const plan = rig.plan;
  const s0 = plan.keyS[plan.marks.neckBase];
  const s1 = plan.keyS[plan.marks.tailBase];
  let maxHalfWidth = 0;
  for (let k = 0; k <= 100; k++) maxHalfWidth = Math.max(maxHalfWidth, plan.station(s0 + ((s1 - s0) * k) / 100).halfWidth);
  const sides = ['L', 'R'].map((n) => {
    const shoulder = at(`humerus${n}`);
    const elbow = at(`forearm${n}`);
    const wrist = at(`hand${n}`);
    const fore = wrist.clone().sub(elbow);
    return {
      shoulder,
      elbow,
      wrist,
      foreSideDeg: (Math.atan2(fore.z, -fore.y) * 180) / Math.PI,
      foreFrontDeg: (Math.atan2(Math.abs(wrist.x) - Math.abs(elbow.x), -fore.y) * 180) / Math.PI,
    };
  });
  // Membrane panels by aUv2.y (parts/wings.ts): the leading-edge panel below 0, the hand-wing
  // panels 0..2, the inner panel 2..3.
  const geo = mesh.geometry;
  const uv2 = geo.getAttribute('aUv2');
  const idx = geo.index!.array;
  const g1 = geo.groups[1];
  const outboard = { handWing: -Infinity, leading: -Infinity, inner: -Infinity };
  const seen = new Set<number>();
  for (let i = g1.start; i < g1.start + g1.count; i++) {
    const v = idx[i];
    if (seen.has(v)) continue;
    seen.add(v);
    mesh.getVertexPosition(v, _p).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);
    const o = Math.abs(_p.x) - maxHalfWidth;
    const y = uv2.getY(v);
    const key = y < 0 ? 'leading' : y <= 2 ? 'handWing' : 'inner';
    outboard[key] = Math.max(outboard[key], o);
  }
  return { sides, maxHalfWidth, outboard };
}


describe('authoritative touchdown presentation', () => {
  for (const breed of BREED_ORDER) {
    it(`${breed}: uses contact impact once, including gentle contact and short teleports`, () => {
      const w = new Wyvern(look(breed));
      const pose = standing(breed);
      pose.touchdown = { id: 0, reset: 0, impact: 0 };
      pose.airborne = true;
      pose.velocity.set(0, -20, 5); // Deliberately disagrees with terrain-normal impact.
      w.update(1 / 60, pose);
      pose.airborne = false;
      pose.touchdown.id++;
      pose.touchdown.impact = 0.2;
      w.update(1 / 60, pose);
      expect(w['animator'].frame.touchdown).toBe(true);
      expect(w['animator'].frame.sink).toBe(0.2);
      expect(w['animator'].frame.landImpact).toBeCloseTo(0.025);
      for (const dt of [0, 1 / 144, 1 / 60, 1 / 30]) {
        w.update(dt, pose);
        expect(w['animator'].frame.touchdown).toBe(false);
      }
      pose.airborne = true;
      w.update(1 / 60, pose);
      pose.airborne = false;
      pose.position.x += 1;
      pose.touchdown.reset++;
      w.update(0, pose);
      expect(w['animator'].frame.teleport).toBe(true);
      expect(w['animator'].frame.touchdown).toBe(false);
      expect(w['animator'].frame.landT).toBeGreaterThan(90);
      w.update(1 / 60, pose);
      expect(w['animator'].frame.touchdown).toBe(false);
      // A later hard contact still works after reset.
      pose.airborne = true;
      w.update(1 / 60, pose);
      pose.airborne = false;
      pose.touchdown.id++;
      pose.touchdown.impact = 6;
      w.update(1 / 60, pose);
      expect(w['animator'].frame.sink).toBe(6);
      expect(w['animator'].frame.landImpact).toBe(0.75);
      w.dispose();
    });
  }
});


it('keeps authoritative landing response bounded across render rates and interrupted settling', () => {
  for (const breed of BREED_ORDER) {
    const settled: number[] = [];
    for (const fps of [30, 60, 120, 144, -1]) {
      const w = new Wyvern(look(breed));
      const pose = standing(breed);
      pose.touchdown = { id: 0, reset: 0, impact: 0 };
      pose.airborne = true;
      w.update(1 / 60, pose);
      pose.airborne = false;
      pose.touchdown.id = 1;
      pose.touchdown.impact = 5;
      let time = 0, impulses = 0, frame = 0;
      while (time < 1 - 1e-8) {
        const dt = Math.min(1 - time, fps > 0 ? 1 / fps : [1 / 30, 1 / 144, 1 / 60][frame++ % 3]);
        w.update(dt, pose);
        if (w['animator'].frame.touchdown) impulses++;
        expect(w['animator'].frame.landImpact).toBe(5 / 8);
        time += dt;
      }
      expect(impulses).toBe(1);
      settled.push(w.saddle.getWorldPosition(new Vector3()).y);
      // Taking off while settling cannot replay the previous contact.
      pose.airborne = true;
      pose.gait = 'takeoff';
      w.update(0, pose);
      w.update(1 / 60, pose);
      expect(w['animator'].frame.touchdown).toBe(false);
      expect(Number.isFinite(w['animator'].frame.dipV)).toBe(true);
      w.dispose();
    }
    expect(Math.max(...settled) - Math.min(...settled), breed).toBeLessThan(0.05);
  }
});


it('preserves fixed-step landing outcomes with interpolated presentation at every render rate', () => {
  const terrain = new Terrain(LAYOUT);
  for (const breed of BREED_ORDER) {
    const finalStates: number[][] = [];
    const saddleHeights: number[] = [];
    for (const fps of [30, 60, 120, 144, -1]) {
      const events = new EventBus<import('../../core/types').GameEvents>();
      const player = new Player({ terrain, env: { terrain, windAt: (_p, out) => out.set(0, 0, 0) },
        events, breed, settings: () => DEFAULT_SETTINGS });
      const w = new Wyvern(look(breed), { terrain });
      const ground = terrain.groundAt(0, -60, 1e6)!;
      player.teleport(new Vector3(0, ground.y + BREEDS[breed].standHeight + 0.15, -60), 0, 'flying', 10);
      player.flight.velocity.y = -0.4;
      w.update(0, player.wyvernPose);
      const input = emptyFrame();
      input.flight.flare = 1;
      let elapsed = 0, ticks = 0, frame = 0, impulses = 0, impact = -1;
      events.on('touchdown', (event) => { impact = event.impact; });
      while (elapsed < 2 - 1e-8) {
        const dt = Math.min(2 - elapsed, fps > 0 ? 1 / fps : [1 / 30, 1 / 144, 1 / 60][frame++ % 3]);
        elapsed += dt;
        const targetTicks = Math.floor(elapsed * 120 + 1e-8);
        while (ticks < targetTicks) {
          player.fixedUpdate(1 / 120, input, 0);
          ticks++;
        }
        player.update(dt, Math.max(0, elapsed * 120 - ticks));
        w.update(dt, player.wyvernPose);
        if (w['animator'].frame.touchdown) {
          impulses++;
          expect(w['animator'].frame.sink).toBe(impact);
        }
      }
      expect(player.mode).toBe('landed');
      expect(impulses).toBe(1);
      finalStates.push([...player.flight.position.toArray(), ...player.flight.velocity.toArray()]);
      saddleHeights.push(w.saddle.getWorldPosition(new Vector3()).y);
      w.dispose();
    }
    for (const state of finalStates) expect(state).toEqual(finalStates[0]);
    expect(Math.max(...saddleHeights) - Math.min(...saddleHeights), breed).toBeLessThan(0.05);
  }
});
