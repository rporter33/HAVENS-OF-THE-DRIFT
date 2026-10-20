// G12b idle at real frame rates, as the wyvern's tail is held (wyvern.tail.test.ts): the dragon's
// driver runs once per rendered frame with whatever time the frame took, so its look spring and
// whiskers step at a fixed 120 Hz and everything else is a function of the drawn time. These run the
// idle at the frame times browsers produce (the same profiles as the wyvern's) against a 120 Hz run
// of the same scene, with the head following an orbiting camera, and hold it to:
//   - the same motion at every frame rate: head, neck, wings, tail, lids and whiskers within a hair
//     of the 120 Hz run at the same drawn time;
//   - no zig-zag: each frame's whisker tips lie on the smooth path through their neighbours';
//   - a stable chain: after minutes at 30 Hz with hitches the whiskers keep their length, stay on or
//     above the platform and hold no NaN;
// and check the life itself: breathing, blinks at their times, the look inside its cone.

import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { PROFILES, type FrameProfile } from '../wyvern/wyvern.realloop';
import { diskAssets } from './dragon.testkit';
import { DragonIdle, IDLE } from './idle';
import { dragonRig } from './rig';

const rig = dragonRig();
const { idx } = rig;
const R2D = 180 / Math.PI;

/** The camera the head follows: orbiting the dragon at 15 m, 20°/s, bobbing between 3 and 7 m. */
function camera(t: number, out: Vector3): Vector3 {
  const a = (40 + 20 * t) * (Math.PI / 180);
  return out.set(1.5 + 15 * Math.sin(a), 5 + 2 * Math.sin(t * 0.7), 15 * Math.cos(a));
}

interface Sample {
  t: number;
  /** Bone directions (model frame) for the head, neck0, both wrists' forearms, the tail tip. */
  dirs: number[];
  whiskers: number[];
  blink: number;
  breath: number;
}

const TRACKED = () => [idx.head, idx.neck[0], idx.neck[5], idx.wings[0].humerus, idx.wings[1].humerus, idx.wings[0].fingers[0][1], idx.tail[9], idx.tail[6]];

function sample(idle: DragonIdle, t: number): Sample {
  const dirs: number[] = [];
  const v = new Vector3();
  for (const b of TRACKED()) {
    v.set(0, 0, 1).applyQuaternion(idle.model.q[b]);
    dirs.push(v.x, v.y, v.z);
  }
  const whiskers: number[] = [];
  const w = idle.whiskers!;
  for (let s = 0; s < w.strands.length; s++) {
    const nodes = w.drawn(s, idle.whiskerBlend, new Float64Array(w.count[s] * 3));
    const k = (w.count[s] - 1) * 3;
    whiskers.push(nodes[k], nodes[k + 1], nodes[k + 2], nodes[k - 15], nodes[k - 14], nodes[k - 13]);
  }
  return { t, dirs, whiskers, blink: idle.blink, breath: idle.breathScale.x };
}

/** Run the idle for `seconds` of frames from `profile`, the head following the orbiting camera. */
async function run(profile: FrameProfile, seconds: number, opts: { look?: boolean; blinks?: number[] } = {}): Promise<{ s: Sample[]; idle: DragonIdle }> {
  const a = await diskAssets();
  const strands = a.parts.pieces.find((p) => p.piece === 'whiskers' && p.lod === 0)!.strands;
  const idle = new DragonIdle(rig, { strands, seed: 3, blinks: opts.blinks });
  const next = profile.gen();
  const cam = new Vector3();
  const out: Sample[] = [];
  let t = 0;
  idle.update(0, opts.look === false ? null : camera(0, cam));
  while (t < seconds) {
    const dt = next();
    t += dt;
    idle.update(dt, opts.look === false ? null : camera(t, cam));
    out.push(sample(idle, idle.drawnTime));
  }
  return { s: out, idle };
}

/** The reference's sample at time t, linearly between its frames. */
function at(ref: Sample[], t: number): Sample {
  let lo = 0;
  let hi = ref.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (ref[m].t <= t) lo = m;
    else hi = m;
  }
  const a = ref[lo];
  const b = ref[hi];
  const f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
  const mix = (x: number[], y: number[]) => x.map((v, i) => v + (y[i] - v) * f);
  return { t, dirs: mix(a.dirs, b.dirs), whiskers: mix(a.whiskers, b.whiskers), blink: a.blink + (b.blink - a.blink) * f, breath: a.breath + (b.breath - a.breath) * f };
}

/** Largest angle (deg) between tracked bone directions, largest whisker gap (m), lid and breath gaps. */
function versus(s: Sample[], ref: Sample[], from = 1): { angle: number; whisker: number; blink: number; breath: number } {
  let angle = 0;
  let whisker = 0;
  let blink = 0;
  let breath = 0;
  for (const x of s) {
    if (x.t < from || x.t > ref[ref.length - 1].t) continue;
    const r = at(ref, x.t);
    for (let i = 0; i < x.dirs.length; i += 3) {
      const d = x.dirs[i] * r.dirs[i] + x.dirs[i + 1] * r.dirs[i + 1] + x.dirs[i + 2] * r.dirs[i + 2];
      angle = Math.max(angle, Math.acos(Math.min(1, d / Math.hypot(r.dirs[i], r.dirs[i + 1], r.dirs[i + 2]))) * R2D);
    }
    for (let i = 0; i < x.whiskers.length; i += 3) whisker = Math.max(whisker, Math.hypot(x.whiskers[i] - r.whiskers[i], x.whiskers[i + 1] - r.whiskers[i + 1], x.whiskers[i + 2] - r.whiskers[i + 2]));
    blink = Math.max(blink, Math.abs(x.blink - r.blink));
    breath = Math.max(breath, Math.abs(x.breath - r.breath));
  }
  return { angle, whisker, blink, breath };
}

/** Whisker tips' deviation (m) from the straight path between each frame's neighbours, RMS and max. */
function zigzag(s: Sample[]): { rms: number; max: number } {
  let sum = 0;
  let n = 0;
  let max = 0;
  for (let i = 1; i < s.length - 1; i++) {
    const a = s[i - 1];
    const b = s[i];
    const c = s[i + 1];
    if (!(c.t > a.t)) continue;
    const f = (b.t - a.t) / (c.t - a.t);
    for (let k = 0; k < b.whiskers.length; k += 3) {
      const e = Math.hypot(
        b.whiskers[k] - (a.whiskers[k] + (c.whiskers[k] - a.whiskers[k]) * f),
        b.whiskers[k + 1] - (a.whiskers[k + 1] + (c.whiskers[k + 1] - a.whiskers[k + 1]) * f),
        b.whiskers[k + 2] - (a.whiskers[k + 2] + (c.whiskers[k + 2] - a.whiskers[k + 2]) * f),
      );
      sum += e * e;
      n++;
      max = Math.max(max, e);
    }
  }
  return { rms: Math.sqrt(sum / Math.max(1, n)), max };
}

describe('G12b idle at real frame rates', { timeout: 300000 }, () => {
  it('moves the same at 30, 60, 120, 144 and 165 Hz, steady or jittery, as at a steady 120 Hz', async () => {
    const { s: ref } = await run(PROFILES.ref120, 20);
    for (const p of [PROFILES.fixed60, PROFILES.alt60, PROFILES.chrome60, PROFILES.firefox60, PROFILES.chrome120, PROFILES.chrome144, PROFILES.chrome165, PROFILES.hitch60, PROFILES.hitch144, PROFILES.chrome30]) {
      const { s } = await run(p, 20);
      const v = versus(s, ref);
      expect(v.angle, `${p.name}: bone directions vs 120 Hz (deg)`).toBeLessThan(0.25);
      expect(v.whisker, `${p.name}: whisker nodes vs 120 Hz (m)`).toBeLessThan(0.01);
      expect(v.blink, `${p.name}: lids vs 120 Hz`).toBeLessThan(0.05);
      expect(v.breath, `${p.name}: breath vs 120 Hz`).toBeLessThan(1e-3);
      const z = zigzag(s);
      expect(z.rms, `${p.name}: whisker tip zig-zag RMS (m)`).toBeLessThan(0.002);
      expect(z.max, `${p.name}: whisker tip zig-zag max (m)`).toBeLessThan(0.01);
    }
  });

  it('keeps the whiskers whole through minutes at 30 Hz with hitches: their length, above the platform, no NaN', async () => {
    const hitch30: FrameProfile = { name: '30 Hz + hitches', gen: () => { const g = PROFILES.chrome30.gen(); let k = 0; return () => (++k % 97 === 0 ? 0.25 : g()); } };
    const { idle } = await run(hitch30, 180);
    const w = idle.whiskers!;
    for (let s = 0; s < w.strands.length; s++) {
      const nodes = w.drawn(s, idle.whiskerBlend, new Float64Array(w.count[s] * 3));
      let len = 0;
      for (let i = 1; i < w.count[s]; i++) len += Math.hypot(nodes[i * 3] - nodes[i * 3 - 3], nodes[i * 3 + 1] - nodes[i * 3 - 2], nodes[i * 3 + 2] - nodes[i * 3 - 1]);
      expect(Math.abs(len - w.strands[s].length) / w.strands[s].length).toBeLessThan(0.03);
      for (let i = 0; i < nodes.length; i++) expect(Number.isFinite(nodes[i])).toBe(true);
      for (let i = 0; i < w.count[s]; i++) expect(nodes[i * 3 + 1]).toBeGreaterThan(0);
    }
    for (const q of idle.pose.local) expect(Number.isFinite(q.x + q.y + q.z + q.w)).toBe(true);
  });

  it('hangs the whiskers from the lip toward the platform', async () => {
    const { idle } = await run(PROFILES.ref120, 6, { look: false });
    const w = idle.whiskers!;
    const head = idle.model.p[idx.head];
    for (let s = 0; s < w.strands.length; s++) {
      const nodes = w.drawn(s, idle.whiskerBlend, new Float64Array(w.count[s] * 3));
      // The root at the lip, by the head; the rest hanging nearly straight down. The lip stands about
      // 3.9 m up on the approved sheet's neck, so 3.6 m whiskers end some 0.8 m above the platform
      // (render 08's reach the floor: a longer whisker part would; see docs/design/WHITE_DRAGON.md).
      expect(Math.hypot(nodes[0] - head.x, nodes[1] - head.y, nodes[2] - head.z)).toBeLessThan(2);
      const tipY = nodes[(w.count[s] - 1) * 3 + 1];
      expect(nodes[1] - tipY).toBeGreaterThan(2.8);
      expect(tipY).toBeLessThan(1);
      // Each on its own side.
      expect(Math.sign(nodes[(w.count[s] - 1) * 3])).toBe(s === 0 ? 1 : -1);
    }
  });

  it('breathes, blinks and looks: slow breaths, blinks at their times, the head turning only inside its cone', async () => {
    const { s } = await run(PROFILES.ref120, 30, { blinks: [4, 9.5] });
    const breath = s.map((x) => x.breath);
    expect(Math.max(...breath) - 1).toBeGreaterThan(IDLE.breathAmp * 1.1);
    // Lids shut at the cues and only then.
    const shut = s.filter((x) => x.blink > 0.95).map((x) => x.t);
    expect(shut.some((t) => t > 4 && t < 4.3)).toBe(true);
    expect(shut.some((t) => t > 9.5 && t < 9.8)).toBe(true);
    expect(shut.every((t) => (t > 4 && t < 4.3) || (t > 9.5 && t < 9.8))).toBe(true);
  });

  it('turns the head toward a target inside the cone and gives up outside it', async () => {
    const a = await diskAssets();
    const strands = a.parts.pieces.find((p) => p.piece === 'whiskers' && p.lod === 0)!.strands;
    const idle = new DragonIdle(rig, { strands });
    const eye = idle.eyePoint.clone();
    const restHead = new Vector3(0, 0, 1).applyQuaternion(idle.model.q[idx.head]);
    const yawOf = (q: Quaternion) => {
      const d = new Vector3(0, 0, 1).applyQuaternion(q);
      return (Math.atan2(d.x, d.z) - Math.atan2(restHead.x, restHead.z)) * R2D;
    };
    // 30° to the left, level: the head turns that way, all of it within a degree or two.
    const left = eye.clone().add(new Vector3(Math.sin(0.52), 0, Math.cos(0.52)).multiplyScalar(20));
    for (let i = 0; i < 6 * 60; i++) idle.update(1 / 60, left);
    expect(idle.lookYaw * R2D).toBeGreaterThan(28);
    expect(idle.lookYaw * R2D).toBeLessThan(32);
    expect(yawOf(idle.model.q[idx.head])).toBeGreaterThan(24);
    // 80° to the right: held at the cone's edge.
    const right = eye.clone().add(new Vector3(-Math.sin(1.4), 0, Math.cos(1.4)).multiplyScalar(20));
    for (let i = 0; i < 8 * 60; i++) idle.update(1 / 60, right);
    expect(idle.lookYaw * R2D).toBeCloseTo(-IDLE.look.yawMax * R2D, 0);
    // Behind it: the head looks ahead again.
    const behind = eye.clone().add(new Vector3(0, 0, -20));
    for (let i = 0; i < 10 * 60; i++) idle.update(1 / 60, behind);
    expect(Math.abs(idle.lookYaw * R2D)).toBeLessThan(2);
  });
});
