import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { dragonRig, type DragonRigDef } from './rig';

const rig: DragonRigDef = dragonRig();
const S = rig.props.shape;
const pos = (i: number) => rig.bones[i].pos;

/**
 * Side view C (white-dragon-ref-left.png) at 86.3 px/m, the method in proportions.ts: metres, and
 * joint positions from the body center (z forward, y up). Three readers agreed within about 3% on
 * the lengths; the joints inside the flesh (shoulder, hip, skull joint) within about 0.17 m.
 */
const SHEET_C = {
  head: 1.532,
  neckArc: 2.227,
  torso: 5.005,
  tailArc: 11.76,
  /** Back to belly at the chest's deepest section (0.1 of the torso ahead of the center) and at the center. */
  chestDepth: 2.317,
  midDepth: 2.213,
  standHeight: 3.415,
  noseToTailTip: 17.82,
  noseToHip: 5.538,
  foreElbowToToes: 2.618,
  hindAnkleToToes: 1.758,
  hipToKnee: 1.069,
  /** The neck's and tail's centre lines at the rig's own joint spacing: equal arcs for the neck, the
   * tail's shrinking segments; base first, then the skull joint or the tail tip. */
  neck: [[1.616, 1.255], [1.665, 1.62], [1.641, 1.99], [1.632, 2.361], [1.712, 2.721], [1.891, 3.043], [2.178, 3.27]],
  tail: [[-2.537, -0.055], [-4.18, -0.271], [-5.674, -0.601], [-7.059, -0.857], [-8.34, -1.044], [-9.525, -1.168], [-10.619, -1.242], [-11.627, -1.267], [-12.554, -1.236], [-13.405, -1.168], [-14.181, -1.051]],
  at: {
    head: { z: 2.178, y: 3.27 },
    snout: { z: 3.638, y: 2.807 },
    tailTip: { z: -14.181, y: -1.051 },
    wingRoot: { z: -0.463, y: 0.93 },
    shoulder: { z: 1.506, y: -0.055 },
    elbow: { z: 0.857, y: -1.179 },
    wrist: { z: 1.043, y: -2.812 },
    hip: { z: -1.9, y: -0.194 },
    knee: { z: -1.981, y: -1.26 },
    ankle: { z: -3.024, y: -1.897 },
  },
};

/** The wing's bones from the Meshy body at the fit's scale (sheet C's raised wing is out of scale
 * with the other views; proportions.ts). */
const MESHY_WING = { humerus: 2.669, forearm: 2.008, hand: 0.238, fingers: [5.617, 4.421, 3.283] };

/** Render 08's body readings, which set the size: head, neck, torso, tail, back height lying. */
const RENDER_08 = { head: 1.5, neckArc: 2.65, torso: 5.6, tailArc: 11, chestDepth: 1.9 };

/** Within ±5% of a reading. */
const nearReading = (value: number, reading: number, band = 0.05) => {
  expect(value).toBeGreaterThanOrEqual(reading * (1 - band));
  expect(value).toBeLessThanOrEqual(reading * (1 + band));
};

/** A joint within 0.15 m (3% of the torso) of where the sheet puts it. */
const nearJoint = (p: { y: number; z: number }, at: { y: number; z: number }) => {
  expect(Math.abs(p.z - at.z)).toBeLessThanOrEqual(0.15);
  expect(Math.abs(p.y - at.y)).toBeLessThanOrEqual(0.15);
};

const chainLength = (pts: Vector3[]) => {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += pts[i].distanceTo(pts[i - 1]);
  return n;
};

const descendsFrom = (i: number, ancestor: number) => {
  for (let p = rig.bones[i].parent; p >= 0; p = rig.bones[p].parent) if (p === ancestor) return true;
  return false;
};

describe('dragon skeleton', () => {
  it('fits the 64-bone budget exactly (the bone texture stays 16x16)', () => {
    expect(rig.bones.length).toBe(64);
  });

  it('has unique names, one root, and every parent before its child', () => {
    expect(new Set(rig.bones.map((b) => b.name)).size).toBe(rig.bones.length);
    expect(rig.bones.filter((b) => b.parent < 0).length).toBe(1);
    rig.bones.forEach((b, i) => expect(b.parent).toBeLessThan(i));
  });

  it('has six limbs: two wings on the back, two forelegs on the chest, two hind legs on the pelvis', () => {
    const { wings, forelegs, hindlegs, spine, chest, pelvis } = rig.idx;
    expect(wings.length).toBe(2);
    expect(forelegs.length).toBe(2);
    expect(hindlegs.length).toBe(2);
    for (let side = 0; side < 2; side++) {
      expect(rig.bones[wings[side].humerus].parent).toBe(spine);
      expect(rig.bones[forelegs[side].scapula].parent).toBe(chest);
      expect(rig.bones[hindlegs[side].thigh].parent).toBe(pelvis);
      expect(wings[side].fingers.length).toBe(3);
    }
  });

  it('keeps the forelegs independent of the wings', () => {
    const wingBones = rig.idx.wings.flatMap((w) => [w.humerus, w.forearm, w.hand, ...w.fingers.flat()]);
    const foreBones = rig.idx.forelegs.flatMap((f) => [f.scapula, f.humerus, f.forearm, f.hand, f.toes]);
    for (const f of foreBones) for (const w of wingBones) {
      expect(descendsFrom(f, w)).toBe(false);
      expect(descendsFrom(w, f)).toBe(false);
    }
  });

  it('is mirror-symmetric, with the midline bones on x = 0', () => {
    const byName = new Map(rig.bones.map((b) => [b.name, b]));
    for (const b of rig.bones) {
      if (b.name.endsWith('L')) {
        const r = byName.get(b.name.slice(0, -1) + 'R')!;
        expect(r).toBeDefined();
        expect(r.pos.x).toBeCloseTo(-b.pos.x, 9);
        expect(r.pos.y).toBeCloseTo(b.pos.y, 9);
        expect(r.pos.z).toBeCloseTo(b.pos.z, 9);
        expect(rig.bones[r.parent].name.replace(/R$/, 'L')).toBe(rig.bones[b.parent].name);
      } else if (!b.name.endsWith('R')) {
        expect(b.pos.x).toBe(0);
      }
    }
  });

  it('stands on all four feet at standHeight', () => {
    const ground = -S.standHeight + rig.props.foreleg.sole;
    expect(rig.foreleg.ball.y).toBeCloseTo(ground, 9);
    expect(rig.hindleg.ball.y).toBeCloseTo(-S.standHeight + rig.props.hindleg.sole, 9);
    for (const side of [0, 1]) {
      expect(pos(rig.idx.forelegs[side].toes).y).toBeCloseTo(ground, 9);
      expect(pos(rig.idx.hindlegs[side].toes).y).toBeCloseTo(ground, 9);
    }
  });

  it('spreads the wings flat at their roots to exactly the wingspan', () => {
    for (const p of [rig.elbow, rig.wrist, rig.knuckle, ...rig.fingerTips]) expect(p.y).toBeCloseTo(rig.wingRoot.y, 9);
    expect(rig.fingerTips[0].x).toBeCloseTo(S.wingspan / 2, 9);
  });

  it('roots the wings mid-back: above the body, behind the forelegs and the neck, ahead of the hips', () => {
    const st = rig.plan.station(rig.plan.sAtZ(rig.wingRoot.z));
    expect(rig.wingRoot.y).toBeGreaterThan(st.center.y + 0.6 * st.upper);
    expect(rig.wingRoot.x).toBeLessThan(rig.foreleg.top.x);
    expect(rig.wingRoot.z).toBeLessThan(rig.foreleg.top.z);
    expect(rig.wingRoot.z).toBeGreaterThan(rig.hindleg.top.z);
    // Sheet C: the roots sit well behind the neck's base, with clear back between.
    expect(rig.neckBase.z - rig.wingRoot.z).toBeGreaterThan(1.2);
  });

  it('runs the membrane to the flank just ahead of the hind legs, never to a leg', () => {
    expect(rig.trailRoot.z).toBeGreaterThan(rig.hindleg.top.z);
    expect(rig.trailRoot.z).toBeLessThan(rig.wingRoot.z);
    expect(rig.trailRoot.y).toBeGreaterThan(rig.hindleg.top.y);
  });

  it('puts the seat on the back between the neck base and the wing roots', () => {
    expect(rig.seat.x).toBe(0);
    expect(rig.seat.z).toBeLessThan(rig.neckBase.z);
    expect(rig.seat.z).toBeGreaterThan(rig.wingRoot.z);
    const st = rig.plan.station(rig.plan.sAtZ(rig.seat.z));
    expect(rig.seat.y).toBeGreaterThan(st.center.y + st.upper);
  });
});

describe('dragon proportions against side view C (±5%, joints within 0.15 m)', () => {
  const headPos = pos(rig.idx.head);
  const neckArc = chainLength([...rig.idx.neck.map(pos), headPos]);
  const tailArc = chainLength([...rig.idx.tail.map(pos), rig.tailTip]);
  const depthAt = (z: number) => {
    const st = rig.plan.station(rig.plan.sAtZ(z));
    return st.upper + st.lower;
  };
  const ground = -S.standHeight;

  // These lengths are the shape's own parameters, built back from the bones: the check is that the
  // parameters carry the sheet's readings. The joint-by-joint checks below test the shape.
  it('carries the sheet’s lengths: head 1.53 m, neck 2.23 m, torso 5.0 m, tail 11.8 m, standing 3.4 m', () => {
    nearReading(rig.snout.distanceTo(headPos), SHEET_C.head);
    nearReading(neckArc, SHEET_C.neckArc);
    nearReading(S.torsoLength, SHEET_C.torso);
    nearReading(tailArc, SHEET_C.tailArc);
    nearReading(-rig.foreleg.ball.y + rig.props.foreleg.sole, SHEET_C.standHeight);
  });

  it('is 2.3 m deep at the chest and 2.2 m at the middle', () => {
    nearReading(depthAt(0.1 * S.torsoLength), SHEET_C.chestDepth);
    nearReading(depthAt(0), SHEET_C.midDepth);
  });

  it('follows the sheet’s neck and tail joint by joint', () => {
    const neck = [...rig.idx.neck.map(pos), headPos];
    const tail = [...rig.idx.tail.map(pos), rig.tailTip];
    neck.forEach((p, i) => nearJoint(p, { z: SHEET_C.neck[i][0], y: SHEET_C.neck[i][1] }));
    tail.forEach((p, i) => nearJoint(p, { z: SHEET_C.tail[i][0], y: SHEET_C.tail[i][1] }));
  });

  it('keeps the body plan from folding where the upright neck meets the torso', () => {
    // Behind the neck's base the centre line only runs back, and the back's line between the
    // shoulders and the haunch stays within 10% of its height at the middle.
    const { keyS, marks } = rig.plan;
    const p = new Vector3();
    let prev = Infinity;
    for (let s = keyS[marks.neckBase]; s <= rig.plan.length; s += 0.02) {
      expect(rig.plan.point(s, p).z).toBeLessThanOrEqual(prev + 1e-9);
      prev = p.z;
    }
    const mid = rig.plan.surface(rig.plan.sAtZ(0), 0, new Vector3()).y;
    for (let s = keyS[marks.shoulder]; s <= keyS[marks.rear]; s += 0.05) {
      nearReading(rig.plan.surface(s, 0, p).y, mid, 0.1);
    }
  });

  it('measures 17.8 m from the nose to the tail tip and 5.5 m from the nose to the hips', () => {
    nearReading(rig.snout.z - rig.tailTip.z, SHEET_C.noseToTailTip);
    nearReading(rig.snout.z - rig.hindleg.top.z, SHEET_C.noseToHip);
  });

  it('carries the head on a swan neck: skull joint and snout where the sheet draws them', () => {
    nearJoint(headPos, SHEET_C.at.head);
    nearJoint(rig.snout, SHEET_C.at.snout);
    nearJoint(rig.tailTip, SHEET_C.at.tailTip);
  });

  it('roots the wings where the sheet does, 1.25 m behind the withers', () => {
    nearJoint(rig.wingRoot, SHEET_C.at.wingRoot);
  });

  it('stands on the sheet’s legs: joints in place, foreleg elbow to toes 2.6 m, hind foot 1.8 m', () => {
    nearJoint(rig.foreleg.top, SHEET_C.at.shoulder);
    nearJoint(rig.foreleg.mid, SHEET_C.at.elbow);
    nearJoint(rig.foreleg.low, SHEET_C.at.wrist);
    nearJoint(rig.hindleg.top, SHEET_C.at.hip);
    nearJoint(rig.hindleg.mid, SHEET_C.at.knee);
    nearJoint(rig.hindleg.low, SHEET_C.at.ankle);
    const F = rig.props.foreleg;
    const H = rig.props.hindleg;
    nearReading(F.lower + F.foot + F.toe, SHEET_C.foreElbowToToes);
    nearReading(H.foot + H.toe, SHEET_C.hindAnkleToToes);
    nearReading(H.upper, SHEET_C.hipToKnee);
    expect(rig.foreleg.ball.y - F.sole).toBeCloseTo(ground, 9);
  });

  it('builds the wing from the Meshy body’s bones, spreading about the dragon’s length', () => {
    const W = rig.props.wing;
    nearReading(W.humerus, MESHY_WING.humerus);
    nearReading(W.forearm, MESHY_WING.forearm);
    nearReading(W.hand, MESHY_WING.hand);
    W.fingers.forEach(([a, b], f) => nearReading(a + b, MESHY_WING.fingers[f]));
    // The kit: the span is about the whole length, nose to tail tip along the body.
    const along = chainLength([rig.snout, headPos, ...[...rig.idx.neck].reverse().map(pos), pos(rig.idx.chest), pos(rig.idx.root), ...rig.idx.tail.map(pos), rig.tailTip]);
    nearReading(S.wingspan / along, 1, 0.1);
  });

  it('keeps render 08’s size: its body readings agree with the rig on average within 2%', () => {
    const ratios = [
      rig.snout.distanceTo(headPos) / RENDER_08.head,
      neckArc / RENDER_08.neckArc,
      S.torsoLength / RENDER_08.torso,
      tailArc / RENDER_08.tailArc,
      depthAt(0.1 * S.torsoLength) / RENDER_08.chestDepth,
    ];
    nearReading(Math.exp(ratios.reduce((a, r) => a + Math.log(r), 0) / ratios.length), 1, 0.02);
  });
});
