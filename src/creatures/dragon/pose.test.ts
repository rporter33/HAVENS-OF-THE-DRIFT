// G12b resting pose: render 08's sphinx on the dragon's own skeleton, checked on the skinned fitted
// body and its parts. Lying on the belly, forelegs stretched forward along the platform, hind legs
// folded under, the tail curled round the left side, the head held high, the wings folded and half
// raised; nothing sinks into the platform, and the limbs mirror.

import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { ELDER_DRAGONS } from './catalog';
import { piecesFor } from './Dragon';
import { diskAssets } from './dragon.testkit';
import { buildDragonLod } from './mesh';
import { bindPose, dragonSkin, modelPose, restingPose } from './pose';
import { dragonRig } from './rig';

const rig = dragonRig();
const { idx } = rig;
const pose = restingPose(rig);
const M = modelPose(rig, pose);
const P = (i: number) => M.p[i];
const R2D = 180 / Math.PI;

/** The posed LOD0 body and parts (dragon frame), and each vertex's heaviest bone. */
async function posedLod0() {
  const a = await diskAssets();
  const g = buildDragonLod(rig, a.bodies[0], piecesFor(ELDER_DRAGONS.white!, a.parts.pieces, 0), 0).geometry;
  const pos = g.getAttribute('position').array as Float32Array;
  const si = g.getAttribute('skinIndex').array as Uint16Array;
  const sw = g.getAttribute('skinWeight').array as Float32Array;
  const out = dragonSkin(rig, M, pos, si, sw);
  const main = new Uint16Array(pos.length / 3);
  for (let v = 0; v < main.length; v++) {
    let best = -1;
    for (let k = 0; k < 4; k++) if (best < 0 || sw[v * 4 + k] > sw[v * 4 + best]) best = k;
    main[v] = si[v * 4 + best];
  }
  return { out, main, n: main.length };
}

/** Lowest posed point over the vertices whose heaviest bone is in `bones`. */
function lowest(s: { out: Float32Array; main: Uint16Array; n: number }, bones: Set<number>): number {
  let lo = Infinity;
  for (let v = 0; v < s.n; v++) if (bones.has(s.main[v])) lo = Math.min(lo, s.out[v * 3 + 1]);
  return lo;
}

describe('G12b resting pose (render 08)', () => {
  it('is a pose of the same skeleton: unit rotations, every bone length kept', () => {
    expect(pose.local.length).toBe(64);
    for (const q of pose.local) expect(Math.abs(q.length() - 1)).toBeLessThan(1e-9);
    for (let i = 0; i < rig.bones.length; i++) {
      const p = rig.bones[i].parent;
      if (p < 0) continue;
      expect(P(i).distanceTo(P(p))).toBeCloseTo(rig.bones[i].pos.distanceTo(rig.bones[p].pos), 9);
    }
  });

  it('lies on its belly: the trunk rests on the platform and nothing sinks into it', async () => {
    const s = await posedLod0();
    const trunk = new Set([idx.spine, idx.chest, idx.pelvis, idx.breath]);
    const belly = lowest(s, trunk);
    expect(belly).toBeGreaterThan(-0.03);
    expect(belly).toBeLessThan(0.06);
    let lo = Infinity;
    for (let v = 0; v < s.n; v++) lo = Math.min(lo, s.out[v * 3 + 1]);
    // The pads of the paws press a few centimetres in, no more.
    expect(lo).toBeGreaterThan(-0.08);
  });

  it('holds the head high, above the withers, the neck rising from the chest', () => {
    const head = P(idx.head);
    expect(head.y).toBeGreaterThan(3.6);
    expect(head.y).toBeLessThan(4.8);
    expect(head.y - P(idx.neck[0]).y).toBeGreaterThan(1.5);
    // Ahead of the neck's base, as render 08 carries it, but not reaching out over the paws.
    expect(head.z).toBeGreaterThan(P(idx.neck[0]).z);
    expect(head.z).toBeLessThan(P(idx.forelegs[0].hand).z);
  });

  it('stretches the forelegs forward along the platform, paws flat, elbows down', async () => {
    const s = await posedLod0();
    for (const f of idx.forelegs) {
      expect(P(f.toes).z - P(idx.neck[0]).z).toBeGreaterThan(2);
      expect(P(f.toes).y).toBeLessThan(0.35);
      expect(P(f.forearm).y).toBeLessThan(P(f.humerus).y - 0.4);
      // The forearm lies along the platform.
      const d = P(f.hand).clone().sub(P(f.forearm));
      expect(Math.abs(Math.atan2(d.y, Math.hypot(d.x, d.z)) * R2D)).toBeLessThan(10);
      const paw = lowest(s, new Set([f.hand, f.toes]));
      expect(paw).toBeLessThan(0.08);
    }
  });

  it('folds the hind legs under: the knee forward, the hock back, the foot flat on the platform beside the belly', async () => {
    const s = await posedLod0();
    for (const h of idx.hindlegs) {
      expect(P(h.shin).z).toBeGreaterThan(P(h.thigh).z + 0.5);
      expect(P(h.meta).z).toBeLessThan(P(h.shin).z - 0.5);
      expect(P(h.toes).z).toBeGreaterThan(P(h.meta).z + 0.8);
      expect(P(h.toes).y).toBeLessThan(0.45);
      expect(Math.abs(P(h.toes).x)).toBeGreaterThan(0.8);
      expect(Math.abs(P(h.toes).x)).toBeLessThan(2);
      expect(lowest(s, new Set([h.meta, h.toes]))).toBeLessThan(0.08);
    }
  });

  it('curls the tail round its left side on the platform and forward again', async () => {
    const s = await posedLod0();
    for (const b of idx.tail.slice(1)) {
      expect(P(b).y).toBeGreaterThan(0);
      expect(P(b).y).toBeLessThan(0.7);
    }
    // The last segment heads forward (turned more than 180° from straight back), to the left of the haunch.
    const last = idx.tail[idx.tail.length - 1];
    const tip = rig.tailTip.clone().sub(rig.bones[last].pos).applyQuaternion(M.q[last]).add(P(last));
    const d = tip.clone().sub(P(last));
    const heading = Math.atan2(d.x, -d.z) * R2D;
    expect(heading < -150 || heading > 150 || d.z > 0).toBe(true);
    expect(tip.x).toBeGreaterThan(1.8);
    expect(tip.z).toBeGreaterThan(P(idx.tail[0]).z);
    // Lying on it: every segment's underside within a few centimetres of the platform.
    for (const b of idx.tail) {
      const lo = lowest(s, new Set([b]));
      expect(lo).toBeGreaterThan(-0.03);
      expect(lo).toBeLessThan(0.12);
    }
  });

  it('folds the wings and half raises them: wrists high over the back, fingers back and down, the span closed', () => {
    const withers = P(idx.neck[0]).y;
    for (const w of idx.wings) {
      const wrist = P(w.hand);
      expect(wrist.y - withers).toBeGreaterThan(2);
      for (const [a, b] of w.fingers) {
        expect(P(b).z).toBeLessThan(P(a).z);
        expect(P(b).y).toBeLessThan(P(a).y);
      }
      for (const b of [w.humerus, w.forearm, w.hand, ...w.fingers.flat()]) expect(Math.abs(P(b).x)).toBeLessThan(4);
    }
  });

  it('mirrors the limbs left to right; only the tail curls to one side', () => {
    const mirrored = (l: number, r: number) => {
      const a = P(l);
      const b = P(r);
      expect(a.x).toBeCloseTo(-b.x, 6);
      expect(a.y).toBeCloseTo(b.y, 6);
      expect(a.z).toBeCloseTo(b.z, 6);
    };
    const [fl, fr] = idx.forelegs;
    const [hl, hr] = idx.hindlegs;
    const [wl, wr] = idx.wings;
    for (const k of ['scapula', 'humerus', 'forearm', 'hand', 'toes'] as const) mirrored(fl[k], fr[k]);
    for (const k of ['thigh', 'shin', 'meta', 'toes'] as const) mirrored(hl[k], hr[k]);
    mirrored(wl.hand, wr.hand);
    for (let f = 0; f < 3; f++) mirrored(wl.fingers[f][1], wr.fingers[f][1]);
    expect(P(idx.tail[9]).x).toBeGreaterThan(1);
  });

  it('keeps the bind pose available, standing on the platform with every rotation the identity', () => {
    const b = bindPose(rig);
    const m = modelPose(rig, b);
    for (const q of b.local) expect(q.equals(new Quaternion())).toBe(true);
    const sole = rig.hindleg.ball.clone().add(new Vector3(0, -rig.props.hindleg.sole, 0));
    expect(m.p[idx.root].y + sole.y).toBeCloseTo(0, 6);
  });
});
