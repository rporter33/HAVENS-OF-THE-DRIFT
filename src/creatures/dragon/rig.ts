// The dragon's skeleton and body plan in the bind pose (gate G12a). The game owns this skeleton, as
// it owns the wyverns' (Q38): the Meshy body is fitted to it in Blender, never the other way round.
//
// Conventions are the wyvern rig's (wyvern/rig.ts): every bone's rest rotation is the identity and
// bones differ only by their pivots, given in body space; left first, the right mirrors x.
//
// Bind pose, matching the reference sheet's: torso level, neck rising at `neckRise`, head level,
// tail straight back with a slight droop, wings spread flat at the height of their roots, all four
// legs in their natural standing bend with the soles at y = -standHeight.
//
// Six limbs within the wyverns' 64-bone budget (the bone texture stays 16x16): the wyvern's 58
// bones less the tongue (the mouth stays closed at rest) and the wing claws (the thumb claw rides
// the hand: a dragon never walks on its wings), plus a five-bone foreleg on each side.

import { Vector3 } from 'three';
import { lerp } from '../../core/math';
import { BodyPlan, SIDE_SIGN, TAIL_BONES, tailTaper } from '../wyvern/rig';
import { azDir } from '../wyvern/proportions';
import { computeDragonProportions, type DragonProportions } from './proportions';

export interface DragonBoneDef {
  name: string;
  parent: number;
  /** Pivot in body space (bind pose). */
  pos: Vector3;
}

export interface DragonWingIdx {
  humerus: number;
  forearm: number;
  hand: number;
  /** [proximal, distal] bones of fingers 0 (wingtip) .. 2 (innermost). */
  fingers: [number, number][];
}

export interface ForelegIdx {
  scapula: number;
  humerus: number;
  forearm: number;
  hand: number;
  toes: number;
}

export interface HindlegIdx {
  thigh: number;
  shin: number;
  meta: number;
  toes: number;
}

export interface DragonRigIndex {
  root: number;
  spine: number;
  chest: number;
  breath: number;
  pelvis: number;
  neck: number[];
  head: number;
  jaw: number;
  /** Cheek fins [left, right]. */
  fans: [number, number];
  tail: number[];
  wings: [DragonWingIdx, DragonWingIdx];
  forelegs: [ForelegIdx, ForelegIdx];
  hindlegs: [HindlegIdx, HindlegIdx];
  /** Fold helpers [left, right] at the inner membrane panel's centroid, as the wyvern's. */
  fold: [number, number];
  gular: number;
}

/** Bind positions of a weight-bearing chain (left side; mirror x for the right). */
export interface LegPoints {
  /** Shoulder or hip joint. */
  top: Vector3;
  /** Elbow or knee. */
  mid: Vector3;
  /** Wrist or ankle. */
  low: Vector3;
  /** Where the toes meet the foot. */
  ball: Vector3;
}

export interface DragonRigDef {
  props: DragonProportions;
  bones: DragonBoneDef[];
  idx: DragonRigIndex;
  plan: BodyPlan;
  /** Bind positions, left side. */
  wingRoot: Vector3;
  elbow: Vector3;
  wrist: Vector3;
  knuckle: Vector3;
  fingerTips: Vector3[];
  /** Where the membrane's trailing edge meets the flank. */
  trailRoot: Vector3;
  neckBase: Vector3;
  foreleg: LegPoints;
  hindleg: LegPoints;
  mouth: Vector3;
  eye: Vector3;
  eyeRadius: number;
  /** Seat on the back (where a rider's hips would rest), between the neck base and the wing roots. */
  seat: Vector3;
  seatHalfWidth: number;
  tailTip: Vector3;
}

export const DRAGON_NECK_BONES = 6;
export const DRAGON_TAIL_BONES = TAIL_BONES;

let cached: DragonRigDef | null = null;

/** The (immutable) dragon rig, built once and shared. */
export function dragonRig(): DragonRigDef {
  return (cached ??= buildDragonRig());
}

export function buildDragonRig(P: DragonProportions = computeDragonProportions()): DragonRigDef {
  const S = P.shape;
  const T = S.torsoLength;
  const hh = S.torsoHalfHeight;
  const hw = S.torsoHalfWidth;
  const bones: DragonBoneDef[] = [];
  const add = (name: string, parent: number, pos: Vector3) => {
    bones.push({ name, parent, pos: pos.clone() });
    return bones.length - 1;
  };
  const v = (a: [number, number, number]) => new Vector3(a[0], a[1], a[2]);
  const mirror = (p: Vector3, side: number) => new Vector3(p.x * SIDE_SIGN[side], p.y, p.z);
  const sideName = (side: number) => (side === 0 ? 'L' : 'R');

  const root = add('root', -1, new Vector3());
  const spine = add('spine', root, new Vector3());
  const chest = add('chest', spine, new Vector3(0, 0.12 * hh, 0.18 * T));
  const breath = add('breath', spine, new Vector3(0, -0.25 * hh, -0.02 * T));
  const pelvis = add('pelvis', root, new Vector3());

  // Neck: equal segments rising from the top front of the torso.
  const neckBase = new Vector3(0, 0.36 * hh, 0.4 * T);
  const neckDir = new Vector3(0, Math.sin(S.neckRise), Math.cos(S.neckRise));
  const seg = S.neckLength / DRAGON_NECK_BONES;
  const neck: number[] = [];
  let parent = chest;
  for (let i = 0; i < DRAGON_NECK_BONES; i++) {
    parent = add(`neck${i}`, parent, neckBase.clone().addScaledVector(neckDir, seg * i));
    neck.push(parent);
  }
  const headPos = neckBase.clone().addScaledVector(neckDir, S.neckLength);
  const head = add('head', parent, headPos);
  const L = S.headLength;
  const jaw = add('jaw', head, headPos.clone().add(new Vector3(0, -0.5 * S.headHalfHeight, 0.08 * L)));
  const fans: [number, number] = [0, 1].map((side) =>
    add(`fan${sideName(side)}`, head, headPos.clone().add(new Vector3(0.75 * S.headHalfWidth * SIDE_SIGN[side], -0.15 * S.headHalfHeight, -0.02 * L))),
  ) as [number, number];

  // Tail: segments shrink toward the tip so the long tail curls smoothly at rest.
  const tailBase = new Vector3(0, 0.1 * hh, -0.56 * T);
  const droop = 5 * (Math.PI / 180);
  const tailDir = new Vector3(0, -Math.sin(droop), -Math.cos(droop));
  const ratio = 0.92;
  let norm = 0;
  for (let i = 0; i < DRAGON_TAIL_BONES; i++) norm += Math.pow(ratio, i);
  const tail: number[] = [];
  parent = pelvis;
  const tp = tailBase.clone();
  for (let i = 0; i < DRAGON_TAIL_BONES; i++) {
    parent = add(`tail${i}`, parent, tp);
    tail.push(parent);
    tp.addScaledVector(tailDir, (S.tailLength * Math.pow(ratio, i)) / norm);
  }
  const tailTip = tp.clone();

  // Wings, rooted on the back behind the forelegs and spread flat at the roots' height.
  const A = P.wing;
  const Wd = S.wing;
  const wingRoot = v(P.wingRoot);
  const elbow = wingRoot.clone().add(v(azDir(Wd.azHumerus)).multiplyScalar(A.humerus));
  const wrist = elbow.clone().add(v(azDir(Wd.azForearm)).multiplyScalar(A.forearm));
  const knuckle = wrist.clone().add(v(azDir(Wd.azHand)).multiplyScalar(A.hand));
  const fingerMid: Vector3[] = [];
  const fingerTips: Vector3[] = [];
  for (let f = 0; f < 3; f++) {
    const d = v(azDir(Wd.azFingers[f]));
    const mid = knuckle.clone().addScaledVector(d, A.fingers[f][0]);
    fingerMid.push(mid);
    fingerTips.push(mid.clone().addScaledVector(d, A.fingers[f][1]));
  }
  const wings = [0, 1].map((side) => {
    const n = sideName(side);
    const humerus = add(`wingHumerus${n}`, spine, mirror(wingRoot, side));
    const forearm = add(`wingForearm${n}`, humerus, mirror(elbow, side));
    const hand = add(`wingHand${n}`, forearm, mirror(wrist, side));
    const fingers: [number, number][] = [];
    for (let f = 0; f < 3; f++) {
      const a = add(`finger${f}a${n}`, hand, mirror(knuckle, side));
      const b = add(`finger${f}b${n}`, a, mirror(fingerMid[f], side));
      fingers.push([a, b]);
    }
    return { humerus, forearm, hand, fingers } as DragonWingIdx;
  }) as [DragonWingIdx, DragonWingIdx];

  // Legs: each standing bend lies in the leg's vertical plane.
  const legDir = (a: number) => new Vector3(0, -Math.cos(a), Math.sin(a));
  const chain = (top: Vector3, c: { upper: number; lower: number; foot: number }, a: { upper: number; lower: number; foot: number }): LegPoints => {
    const mid = top.clone().addScaledVector(legDir(a.upper), c.upper);
    const low = mid.clone().addScaledVector(legDir(a.lower), c.lower);
    const ball = low.clone().addScaledVector(legDir(a.foot), c.foot);
    return { top, mid, low, ball };
  };
  const fore = chain(v(P.foreShoulder), P.foreleg, S.foreleg.angles);
  const hind = chain(v(P.hip), P.hindleg, S.hindleg.angles);
  const scapulaTop = v(P.scapula);
  const forelegs = [0, 1].map((side) => {
    const n = sideName(side);
    const scapula = add(`scapula${n}`, chest, mirror(scapulaTop, side));
    const humerus = add(`humerus${n}`, scapula, mirror(fore.top, side));
    const forearm = add(`forearm${n}`, humerus, mirror(fore.mid, side));
    const hand = add(`forepaw${n}`, forearm, mirror(fore.low, side));
    const toes = add(`foretoes${n}`, hand, mirror(fore.ball, side));
    return { scapula, humerus, forearm, hand, toes } as ForelegIdx;
  }) as [ForelegIdx, ForelegIdx];
  const hindlegs = [0, 1].map((side) => {
    const n = sideName(side);
    const thigh = add(`thigh${n}`, pelvis, mirror(hind.top, side));
    const shin = add(`shin${n}`, thigh, mirror(hind.mid, side));
    const meta = add(`meta${n}`, shin, mirror(hind.low, side));
    const toes = add(`toes${n}`, meta, mirror(hind.ball, side));
    return { thigh, shin, meta, toes } as HindlegIdx;
  }) as [HindlegIdx, HindlegIdx];

  // Body plan: centerline keys from inside the skull to the tail tip. A deep chest, a sleek waist
  // and a thick tail root that tapers into the long tail (render 08).
  const nk = (i: number) => bones[neck[i]].pos;
  const neckR = (t: number) => lerp(S.neckTopRadius, S.neckBaseRadius, Math.pow(t, 2.2));
  const keys: { p: Vector3; hw: number; hu: number; hl: number; sq: number }[] = [];
  keys.push({ p: headPos.clone().add(new Vector3(0, -0.05 * S.headHalfHeight, 0.18 * L)), hw: 0.7 * S.neckTopRadius, hu: 0.85 * S.neckTopRadius, hl: 0.85 * S.neckTopRadius, sq: 2 });
  keys.push({ p: headPos.clone(), hw: S.neckTopRadius * 0.95, hu: S.neckTopRadius * 1.05, hl: S.neckTopRadius * 1.08, sq: 2 });
  const neckTopKey = keys.length - 1;
  for (let i = DRAGON_NECK_BONES - 1; i >= 1; i--) {
    const r = neckR(1 - i / DRAGON_NECK_BONES);
    keys.push({ p: nk(i).clone(), hw: r * 0.95, hu: r, hl: r * 1.12, sq: 2 });
  }
  keys.push({ p: nk(0).clone().add(new Vector3(0, -0.08 * hh, -0.02 * T)), hw: S.neckBaseRadius * 1.15, hu: S.neckBaseRadius, hl: S.neckBaseRadius * 1.5, sq: 2.1 });
  const neckBaseKey = keys.length - 1;
  keys.push({ p: new Vector3(0, 0.1 * hh, 0.32 * T), hw: hw * 1.08, hu: hh * 0.9, hl: hh * 1.1 + S.keel * 1.2, sq: 2.3 });
  const shoulderKey = keys.length - 1;
  keys.push({ p: new Vector3(0, 0.04 * hh, 0.15 * T), hw: hw * 1.04, hu: hh * 0.93, hl: hh + S.keel, sq: 2.25 });
  const chestKey = keys.length - 1;
  keys.push({ p: new Vector3(0, 0, 0), hw: hw * 0.92, hu: hh * 0.92, hl: hh * 0.85, sq: 2.2 });
  const midKey = keys.length - 1;
  keys.push({ p: new Vector3(0, 0.02 * hh, -0.3 * T), hw: hw * 0.98, hu: hh * 0.88, hl: hh * 0.82, sq: 2.2 });
  const rearKey = keys.length - 1;
  keys.push({ p: tailBase.clone(), hw: S.tailBaseRadius * 1.2, hu: S.tailBaseRadius * 1.08, hl: S.tailBaseRadius, sq: 2.05 });
  const tailBaseKey = keys.length - 1;
  for (let i = 1; i < DRAGON_TAIL_BONES; i++) {
    const t = tailBase.distanceTo(bones[tail[i]].pos) / S.tailLength;
    const r = S.tailBaseRadius * tailTaper(t);
    keys.push({ p: bones[tail[i]].pos.clone(), hw: r * (1.05 - 0.35 * t), hu: r * (1 + 0.3 * t), hl: r * (0.95 + 0.2 * t), sq: 2 });
  }
  const tipR = S.tailBaseRadius * 0.05;
  keys.push({ p: tailTip.clone(), hw: tipR, hu: tipR, hl: tipR, sq: 2 });
  const plan = new BodyPlan(keys, {
    neckTop: neckTopKey,
    neckBase: neckBaseKey,
    shoulder: shoulderKey,
    chest: chestKey,
    mid: midKey,
    rear: rearKey,
    tailBase: tailBaseKey,
    tip: keys.length - 1,
  });

  // The membrane's trailing edge meets the upper flank just ahead of the hind legs; the fold
  // helpers sit at the inner panel's centroid, as the wyvern's do.
  const trailZ = S.wing.trailZ * T;
  const trailSt = plan.station(plan.sAtZ(trailZ));
  const trailRoot = new Vector3(0.75 * trailSt.halfWidth, trailSt.center.y + 0.6 * trailSt.upper, trailZ);
  const foldC = panelCentroid([wingRoot, elbow, wrist, knuckle, fingerTips[2], trailRoot]);
  const fold: [number, number] = [add('foldL', spine, mirror(foldC, 0)), add('foldR', spine, mirror(foldC, 1))];
  const gular = add('gular', jaw, headPos.clone().add(new Vector3(0, -0.8 * S.headHalfHeight, 0.1 * L)));

  const seatZ = S.seatZ * T;
  const seatSt = plan.station(plan.sAtZ(seatZ));
  const seat = new Vector3(0, seatSt.center.y + seatSt.upper + 0.06 * hh, seatZ);

  const mouth = headPos.clone().add(new Vector3(0, -0.35 * S.headHalfHeight, 0.98 * L));
  const eye = headPos.clone().add(new Vector3(0.78 * S.headHalfWidth, 0.42 * S.headHalfHeight, 0.4 * L));

  return {
    props: P,
    bones,
    idx: { root, spine, chest, breath, pelvis, neck, head, jaw, fans, tail, wings, forelegs, hindlegs, fold, gular },
    plan,
    wingRoot,
    elbow,
    wrist,
    knuckle,
    fingerTips,
    trailRoot,
    neckBase,
    foreleg: fore,
    hindleg: hind,
    mouth,
    eye,
    eyeRadius: S.eye * L,
    seat,
    seatHalfWidth: seatSt.halfWidth,
    tailTip,
  };
}

/** Area centroid of a planar-ish polygon by fan triangulation from its first corner. */
function panelCentroid(poly: Vector3[]): Vector3 {
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  let area = 0;
  for (let i = 1; i < poly.length - 1; i++) {
    const a = ab.subVectors(poly[i], poly[0]).cross(ac.subVectors(poly[i + 1], poly[0])).length() / 2;
    c.addScaledVector(poly[0], a / 3).addScaledVector(poly[i], a / 3).addScaledVector(poly[i + 1], a / 3);
    area += a;
  }
  return c.multiplyScalar(1 / Math.max(1e-9, area));
}
