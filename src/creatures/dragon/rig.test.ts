import { describe, expect, it } from 'vitest';
import { dragonRig, type DragonRigDef } from './rig';

const rig: DragonRigDef = dragonRig();
const S = rig.props.shape;
const pos = (i: number) => rig.bones[i].pos;

/** Within ±15% of a reading on render 08 (the readings are listed in proportions.ts). */
const nearReading = (value: number, reading: number) => {
  expect(value).toBeGreaterThanOrEqual(reading * 0.85);
  expect(value).toBeLessThanOrEqual(reading * 1.15);
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
    // Render 08: the roots sit well behind the withers, with clear back between.
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

describe('dragon proportions against render 08 (provisional, ±15%)', () => {
  const L = S.headLength;
  const noseToTail = rig.plan.length + 0.8 * L;
  const noseToHip = rig.plan.sAtZ(rig.hindleg.top.z) + 0.8 * L;

  it('head ≈ 1.5 m, neck ≈ 2.65 m, chest front to rump ≈ 5.6 m, tail ≈ 11 m', () => {
    nearReading(L, 1.5);
    nearReading(S.neckLength, 2.65);
    nearReading(S.torsoLength, 5.6);
    nearReading(S.tailLength, 11);
  });

  it('the tail is about a third longer than nose to hips, and the span about the whole length', () => {
    nearReading(S.tailLength / noseToHip, 1.3);
    nearReading(S.wingspan / noseToTail, 1);
  });

  it('wing forearm ≈ 2.5 m and leading finger ≈ 6 m', () => {
    nearReading(rig.props.wing.forearm, 2.5);
    nearReading(rig.props.wing.fingers[0][0] + rig.props.wing.fingers[0][1], 6);
  });

  it('forelimb elbow to toes ≈ 2.0 m, hind foot ≈ 1.4 m', () => {
    const F = rig.props.foreleg;
    const H = rig.props.hindleg;
    nearReading(F.lower + F.foot + F.toe, 2.0);
    nearReading(H.foot + H.toe, 1.4);
  });

  it('lying down, the back is about 1.9 m above the platform at the elder', () => {
    // Belly on the ground: the body's depth at the chest is the back's height.
    const st = rig.plan.station(rig.plan.sAtZ(0.15 * S.torsoLength));
    nearReading(st.upper + st.lower, 1.9);
  });
});
