// The wyvern's skeleton and body plan in the bind pose.
//
// Every bone's rest rotation is the identity: bones differ only by their pivot positions, which
// are given in body (model) space. That keeps the animator simple — a rotation that aims a bone
// from its bind direction to a new direction is directly its model-space rotation.
//
// Bind pose: torso level, neck rising at `neckRise`, head looking straight ahead, tail straight
// back with a slight droop, wings fully spread flat at shoulder height, legs in their natural
// standing bend with the soles at y = -standHeight.
//
// The body plan is the centerline the body/neck/tail tube is lofted along, plus its
// cross-section profile; the model builder, saddle and cosmetics all place themselves on it.

import { Vector3 } from 'three';
import { clamp, lerp, smoothstep } from '../../core/math';
import { azDir, computeProportions, type HeadId, type WyvernProportions } from './proportions';
import { keyed } from './parts/shape';
import type { BreedId } from '../../core/types';

export interface BoneDef {
  name: string;
  parent: number;
  /** Pivot in body space (bind pose). */
  pos: Vector3;
}

export interface WingIdx {
  humerus: number;
  forearm: number;
  hand: number;
  claw: number;
  /** [proximal, distal] bones of fingers 0 (wingtip) .. 2 (innermost). */
  fingers: [number, number][];
}

export interface LegIdx {
  thigh: number;
  shin: number;
  meta: number;
  toes: number;
}

export interface RigIndex {
  root: number;
  spine: number;
  chest: number;
  breath: number;
  pelvis: number;
  neck: number[];
  head: number;
  jaw: number;
  /** Forked tongue on the jaw floor: [base, fork]. Retracted inside the closed mouth at rest. */
  tongue: [number, number];
  fans: [number, number];
  tail: number[];
  wings: [WingIdx, WingIdx];
  legs: [LegIdx, LegIdx];
  /**
   * Fold helpers [left, right] (children of the chest, at the centroid of the inner membrane
   * panel): the inner panel's interior is partly skinned to them so the animator can contract
   * and pleat the folded wing against the flank. Rest (bind) = no change. Driven by stream C.
   */
  fold: [number, number];
  /**
   * Throat (gular) bone: a child of the jaw on the throat floor, carrying the throat skin
   * behind the jaw's rami, for gular pumping and panting. Rest (bind) = no change.
   */
  gular: number;
}

/** A point on the body tube's centerline with its cross-section. */
export interface BodyStation {
  s: number;
  center: Vector3;
  /** Unit tangent pointing toward the tail. */
  tangent: Vector3;
  /** Unit "up" of the cross-section (dorsal direction). */
  up: Vector3;
  /** Unit side (+X, left). */
  side: Vector3;
  halfWidth: number;
  /** Half height above / below the centerline. */
  upper: number;
  lower: number;
  /** Superellipse exponent (2 = ellipse, larger = boxier). */
  squareness: number;
}

export const SIDE_SIGN = [1, -1] as const;

/** Half-width (m) of the window the body tube's section frames are smoothed over. */
const TANGENT_WINDOW = 0.45;

export const NECK_BONES = 6;
/**
 * Saddle seat along the torso (fraction of torso length ahead of the body center): over the
 * ribcage a little ahead of the center of mass, well behind the shoulder joints (0.3).
 */
export const SEAT_Z = 0.08;

/**
 * Forked tongue along the head (fractions of head length from the head pivot): its base, where
 * it forks, the tips at rest (inside the snout, which ends at 1.0) and how far a flick slides it
 * out.
 */
export const TONGUE = { base: 0.3, fork: 0.74, tip: 0.92, reach: 0.5 } as const;
export const TAIL_BONES = 10;

export interface RigDef {
  props: WyvernProportions;
  bones: BoneDef[];
  idx: RigIndex;
  plan: BodyPlan;
  /** Bind positions (left side; mirror x for the right). */
  elbow: Vector3;
  wrist: Vector3;
  knuckle: Vector3;
  fingerTips: Vector3[];
  knee: Vector3;
  ankle: Vector3;
  ball: Vector3;
  /** Snout tip / mouth in head-bone space is `mouth - head pivot`. */
  mouth: Vector3;
  /** Body-space positions of the left eye center and its radius. */
  eye: Vector3;
  eyeRadius: number;
  /** Saddle seat (where the rider's hips rest) and the body's half-width there. */
  seat: Vector3;
  seatHalfWidth: number;
  /** Tail tip (end of the last tail bone). */
  tailTip: Vector3;
}

// ---------------------------------------------------------------------------------------------
// Body plan
// ---------------------------------------------------------------------------------------------

interface PlanKey {
  p: Vector3;
  hw: number;
  hu: number;
  hl: number;
  sq: number;
}

/**
 * The lofted body: a Catmull-Rom centerline from inside the skull to the tail tip with a
 * cross-section profile interpolated between keys.
 */
export class BodyPlan {
  /** Arc-length positions (m) of each key along the centerline. */
  readonly keyS: number[] = [];
  readonly length: number;
  /** Named key indices for the parts of the tube. */
  readonly marks: { neckTop: number; neckBase: number; shoulder: number; chest: number; mid: number; rear: number; tailBase: number; tip: number };
  private keys: PlanKey[];
  private samples: Vector3[] = [];
  private sampleS: number[] = [];

  constructor(keys: PlanKey[], marks: BodyPlan['marks']) {
    this.keys = keys;
    this.marks = marks;
    // Dense polyline of the spline for arc-length lookups.
    const pts = keys.map((k) => k.p);
    const SUB = 24;
    let s = 0;
    const prev = new Vector3();
    for (let i = 0; i < pts.length - 1; i++) {
      for (let j = 0; j < SUB; j++) {
        const p = catmull(pts, i, j / SUB, new Vector3());
        if (this.samples.length) s += p.distanceTo(prev);
        if (j === 0) this.keyS.push(s);
        this.samples.push(p);
        this.sampleS.push(s);
        prev.copy(p);
      }
    }
    const last = pts[pts.length - 1].clone();
    s += last.distanceTo(prev);
    this.keyS.push(s);
    this.samples.push(last);
    this.sampleS.push(s);
    this.length = s;
  }

  /** Centerline point at arc length s. */
  point(s: number, out: Vector3): Vector3 {
    const ss = this.sampleS;
    s = clamp(s, 0, this.length);
    let lo = 0;
    let hi = ss.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (ss[m] <= s) lo = m;
      else hi = m;
    }
    const t = ss[hi] > ss[lo] ? (s - ss[lo]) / (ss[hi] - ss[lo]) : 0;
    return out.lerpVectors(this.samples[lo], this.samples[hi], t);
  }

  /** Full cross-section frame at arc length s. */
  station(s: number): BodyStation {
    const center = this.point(s, new Vector3());
    // Cross-sections face a tangent smoothed over about a body radius: where the centreline
    // bends tighter than the section is deep (neck base, shoulders, throat), sections normal to
    // the local tangent would fan out and fold the inner side of the bend over itself.
    const e = TANGENT_WINDOW;
    const a = this.point(Math.max(0, s - e), new Vector3());
    const b = this.point(Math.min(this.length, s + e), new Vector3());
    const tangent = b.sub(a).normalize();
    const side = new Vector3(1, 0, 0);
    const up = new Vector3().crossVectors(side, tangent).normalize();
    // Re-orthogonalize side (the centerline lies in the YZ plane, so this is exact).
    side.crossVectors(tangent, up).normalize();
    const k = this.profile(s);
    return { s, center, tangent, up, side, halfWidth: k.hw, upper: k.hu, lower: k.hl, squareness: k.sq };
  }

  /** Interpolated cross-section at arc length s (Catmull-Rom across keys). */
  profile(s: number): { hw: number; hu: number; hl: number; sq: number } {
    const ks = this.keyS;
    let i = 0;
    while (i < ks.length - 2 && ks[i + 1] <= s) i++;
    const t = clamp((s - ks[i]) / Math.max(1e-6, ks[i + 1] - ks[i]), 0, 1);
    const f = (sel: (k: PlanKey) => number) => {
      const k = this.keys;
      const p0 = sel(k[Math.max(0, i - 1)]);
      const p1 = sel(k[i]);
      const p2 = sel(k[i + 1]);
      const p3 = sel(k[Math.min(k.length - 1, i + 2)]);
      return Math.max(0, catmullScalar(p0, p1, p2, p3, t));
    };
    return { hw: f((k) => k.hw), hu: f((k) => k.hu), hl: f((k) => k.hl), sq: f((k) => k.sq) };
  }

  /** Surface point at arc length s and girth angle theta (0 = dorsal, +π/2 = left flank). */
  surface(s: number, theta: number, out: Vector3, outNormal?: Vector3): Vector3 {
    const st = this.station(s);
    return surfacePoint(st, theta, out, outNormal);
  }

  /** Arc length where the centerline passes body-space z (searching the torso and tail). */
  sAtZ(z: number): number {
    const ss = this.sampleS;
    const from = this.keyS[this.marks.neckBase];
    let best = from;
    let bestD = Infinity;
    for (let i = 0; i < ss.length; i++) {
      if (ss[i] < from) continue;
      const d = Math.abs(this.samples[i].z - z);
      if (d < bestD) {
        bestD = d;
        best = ss[i];
      }
    }
    return best;
  }
}

/** A superellipse cross-section point. Writes the (approximate) outward normal if asked. */
export function surfacePoint(st: BodyStation, theta: number, out: Vector3, outNormal?: Vector3): Vector3 {
  const c = Math.cos(theta);
  const sn = Math.sin(theta);
  const e = 2 / st.squareness;
  const y = Math.sign(c) * Math.pow(Math.abs(c), e) * (c >= 0 ? st.upper : st.lower);
  const x = Math.sign(sn) * Math.pow(Math.abs(sn), e) * st.halfWidth;
  out.copy(st.center).addScaledVector(st.up, y).addScaledVector(st.side, x);
  if (outNormal) {
    // Normal of the ellipse through the same angle (good enough for placement).
    outNormal
      .set(0, 0, 0)
      .addScaledVector(st.up, c / Math.max(1e-3, c >= 0 ? st.upper : st.lower))
      .addScaledVector(st.side, sn / Math.max(1e-3, st.halfWidth))
      .normalize();
  }
  return out;
}

function catmullScalar(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function catmull(pts: Vector3[], i: number, t: number, out: Vector3): Vector3 {
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(pts.length - 1, i + 2)];
  return out.set(
    catmullScalar(p0.x, p1.x, p2.x, p3.x, t),
    catmullScalar(p0.y, p1.y, p2.y, p3.y, t),
    catmullScalar(p0.z, p1.z, p2.z, p3.z, t),
  );
}

// ---------------------------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------------------------

const v = (a: [number, number, number] | number[]) => new Vector3(a[0], a[1], a[2]);

/** Tail radius over its length (fraction of the base radius at arc-length fraction t). */
export function tailTaper(t: number): number {
  return Math.max(0.06, keyed(TAIL_TAPER, t));
}
const TAIL_TAPER: [number, number][] = [
  [0, 1],
  [0.25, 0.86],
  [0.6, 0.45],
  [1, 0.06],
];

const rigCache = new Map<string, RigDef>();

/**
 * The (immutable) rig for a breed wearing a head style (wyvernHead; default the breed's own), built
 * once and shared. A head style moves only the head's own joints (jaw, tongue, gular, fans, mouth).
 */
export function rigFor(breed: BreedId, headStyle: HeadId = breed): RigDef {
  const key = `${breed}|${headStyle}`;
  let r = rigCache.get(key);
  if (!r) {
    r = buildRig(breed, headStyle);
    rigCache.set(key, r);
  }
  return r;
}

export function buildRig(breed: BreedId, headStyle: HeadId = breed): RigDef {
  const P = computeProportions(breed, headStyle);
  const S = P.shape;
  const T = S.torsoLength;
  const bones: BoneDef[] = [];
  const add = (name: string, parent: number, pos: Vector3) => {
    bones.push({ name, parent, pos: pos.clone() });
    return bones.length - 1;
  };

  const root = add('root', -1, new Vector3());
  const spine = add('spine', root, new Vector3(0, 0, 0));
  const chestPos = new Vector3(0, 0.12 * S.torsoHalfHeight, 0.18 * T);
  const chest = add('chest', spine, chestPos);
  const breath = add('breath', spine, new Vector3(0, -0.25 * S.torsoHalfHeight, -0.02 * T));
  const pelvis = add('pelvis', root, new Vector3(0, 0, 0));

  // Neck: six equal segments rising from the top front of the torso.
  const neckBase = new Vector3(0, 0.36 * S.torsoHalfHeight, 0.4 * T);
  const neckDir = new Vector3(0, Math.sin(S.neckRise), Math.cos(S.neckRise));
  const seg = S.neckLength / NECK_BONES;
  const neck: number[] = [];
  let parent = chest;
  for (let i = 0; i < NECK_BONES; i++) {
    parent = add(`neck${i}`, parent, neckBase.clone().addScaledVector(neckDir, seg * i));
    neck.push(parent);
  }
  const headPos = neckBase.clone().addScaledVector(neckDir, S.neckLength);
  const head = add('head', parent, headPos);
  const L = S.headLength;
  const jaw = add('jaw', head, headPos.clone().add(new Vector3(0, -0.5 * S.headHalfHeight, 0.08 * L)));
  // Tongue: lies along the jaw floor just under the mouth line, wholly inside the closed mouth;
  // the animator slides the base bone forward to flick it out through the front (lingual notch).
  const tongue0 = add('tongue0', jaw, headPos.clone().add(new Vector3(0, -0.44 * S.headHalfHeight, TONGUE.base * L)));
  const tongue1 = add('tongue1', tongue0, headPos.clone().add(new Vector3(0, -0.46 * S.headHalfHeight, TONGUE.fork * L)));
  const fans: [number, number] = [
    add('fanL', head, headPos.clone().add(new Vector3(0.75 * S.headHalfWidth, -0.15 * S.headHalfHeight, -0.02 * L))),
    add('fanR', head, headPos.clone().add(new Vector3(-0.75 * S.headHalfWidth, -0.15 * S.headHalfHeight, -0.02 * L))),
  ];

  // Tail: segments shrink toward the tip so the whip end bends smoothly.
  const tailBase = new Vector3(0, 0.1 * S.torsoHalfHeight, -0.56 * T);
  const droop = 5 * (Math.PI / 180);
  const tailDir = new Vector3(0, -Math.sin(droop), -Math.cos(droop));
  const ratio = 0.92;
  let norm = 0;
  for (let i = 0; i < TAIL_BONES; i++) norm += Math.pow(ratio, i);
  const tail: number[] = [];
  parent = pelvis;
  const tp = tailBase.clone();
  for (let i = 0; i < TAIL_BONES; i++) {
    parent = add(`tail${i}`, parent, tp);
    tail.push(parent);
    tp.addScaledVector(tailDir, (S.tailLength * Math.pow(ratio, i)) / norm);
  }
  const tailTip = tp.clone();

  // Wings (left first; the right mirrors x).
  const A = P.arm;
  const Wd = S.wing;
  const shoulder = v(P.shoulder);
  const elbow = shoulder.clone().add(v(azDir(Wd.azHumerus)).multiplyScalar(A.humerus));
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
  const mirror = (p: Vector3, side: number) => new Vector3(p.x * SIDE_SIGN[side], p.y, p.z);
  const wings = [0, 1].map((side) => {
    const n = side === 0 ? 'L' : 'R';
    const humerus = add(`humerus${n}`, chest, mirror(shoulder, side));
    const forearm = add(`forearm${n}`, humerus, mirror(elbow, side));
    const hand = add(`hand${n}`, forearm, mirror(wrist, side));
    const claw = add(`claw${n}`, hand, mirror(wrist, side));
    const fingers: [number, number][] = [];
    for (let f = 0; f < 3; f++) {
      const a = add(`finger${f}a${n}`, hand, mirror(knuckle, side));
      const b = add(`finger${f}b${n}`, a, mirror(fingerMid[f], side));
      fingers.push([a, b]);
    }
    return { humerus, forearm, hand, claw, fingers } as WingIdx;
  }) as [WingIdx, WingIdx];

  // Legs: standing bend in the leg's vertical plane.
  const G = P.leg;
  const hip = v(P.hip);
  const legDir = (a: number) => new Vector3(0, -Math.cos(a), Math.sin(a));
  const knee = hip.clone().addScaledVector(legDir(S.legAngles.thigh), G.thigh);
  const ankle = knee.clone().addScaledVector(legDir(S.legAngles.shin), G.shin);
  const ball = ankle.clone().addScaledVector(legDir(S.legAngles.meta), G.meta);
  const legs = [0, 1].map((side) => {
    const n = side === 0 ? 'L' : 'R';
    const thigh = add(`thigh${n}`, pelvis, mirror(hip, side));
    const shin = add(`shin${n}`, thigh, mirror(knee, side));
    const meta = add(`meta${n}`, shin, mirror(ankle, side));
    const toes = add(`toes${n}`, meta, mirror(ball, side));
    return { thigh, shin, meta, toes } as LegIdx;
  }) as [LegIdx, LegIdx];

  // Body plan: centerline keys from inside the skull to the tail tip.
  const hw = S.torsoHalfWidth;
  const hh = S.torsoHalfHeight;
  const nk = (i: number) => bones[neck[i]].pos;
  // The neck's mass sits at its base, flowing into the shoulders; the upper neck stays lean.
  const neckR = (t: number) => lerp(S.neckTopRadius, S.neckBaseRadius, Math.pow(t, 2.2));
  const keys: PlanKey[] = [];
  keys.push({ p: headPos.clone().add(new Vector3(0, -0.05 * S.headHalfHeight, 0.18 * L)), hw: 0.7 * S.neckTopRadius, hu: 0.85 * S.neckTopRadius, hl: 0.85 * S.neckTopRadius, sq: 2 });
  keys.push({ p: headPos.clone(), hw: S.neckTopRadius * 0.95, hu: S.neckTopRadius * 1.05, hl: S.neckTopRadius * 1.08, sq: 2 });
  const neckTopKey = keys.length - 1;
  for (let i = NECK_BONES - 1; i >= 1; i--) {
    const t = 1 - i / NECK_BONES;
    const r = neckR(t);
    // A loose throat (gular) pouch one segment behind the jaw.
    keys.push({ p: nk(i).clone(), hw: r * 0.95, hu: r, hl: r * 1.12 * (i === NECK_BONES - 1 ? 1.35 : 1), sq: 2 });
  }
  keys.push({ p: nk(0).clone().add(new Vector3(0, -0.08 * hh, -0.02 * T)), hw: S.neckBaseRadius * 1.18, hu: S.neckBaseRadius * 1.05, hl: S.neckBaseRadius * 1.6, sq: 2.1 });
  const neckBaseKey = keys.length - 1;
  // Shoulder girdle: the flight muscles make the shoulders the broadest, deepest part of the
  // body (as in every bird, bat and pterosaur), with the sternal keel deepest under them; the
  // ribcage behind narrows a little, and the belly rises toward the hips like a flier's waist.
  // (The centreline rides high here so it bends gently out of the neck base: a sharp bend would
  // fan the cross-sections and fold the back over itself. Top and keel line are what matter.)
  keys.push({ p: new Vector3(0, 0.17 * hh, 0.3 * T), hw: hw * 1.12, hu: hh * 0.91, hl: hh * 1.14 + S.keel * 1.3, sq: 2.4 });
  const shoulderKey = keys.length - 1;
  keys.push({ p: new Vector3(0, 0.06 * hh, 0.14 * T), hw: hw * 1.05, hu: hh * 0.92, hl: hh + S.keel, sq: 2.25 });
  const chestKey = keys.length - 1;
  keys.push({ p: new Vector3(0, 0.0, 0.0), hw: hw * 0.94, hu: hh * 0.95, hl: hh * 0.92 + S.keel * 0.3, sq: 2.25 });
  const midKey = keys.length - 1;
  // Hindquarters: the thigh muscles blend into a massive tail root (the caudofemoralis that
  // drives the legs), and the tail stays thick through its first quarter, then flattens side to
  // side into a crocodilian rudder, taller than it is wide.
  keys.push({ p: new Vector3(0, 0.02 * hh, -0.3 * T), hw: hw * 0.95, hu: hh * 0.86, hl: hh * 0.8, sq: 2.2 });
  const rearKey = keys.length - 1;
  keys.push({ p: tailBase.clone(), hw: S.tailBaseRadius * 1.22, hu: S.tailBaseRadius * 1.08, hl: S.tailBaseRadius, sq: 2.05 });
  const tailBaseKey = keys.length - 1;
  // Bone positions are spaced by a geometric ratio, so key the profile by arc length (t).
  for (let i = 1; i < TAIL_BONES; i++) {
    const t = (tailBase.distanceTo(bones[tail[i]].pos)) / S.tailLength;
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

  // Fold helpers: appended after every other bone so existing indices stay put.
  const foldC = innerPanelCentroid(P, shoulder, elbow, wrist, knuckle, fingerTips[2], plan, T);
  const fold: [number, number] = [add('foldL', chest, mirror(foldC, 0)), add('foldR', chest, mirror(foldC, 1))];
  const gular = add('gular', jaw, headPos.clone().add(new Vector3(0, -0.8 * S.headHalfHeight, 0.1 * L)));

  // Seat: behind the shoulder girdle, over the ribcage near the center of mass — where a horse
  // saddle sits behind the withers. Not over the wing roots: the flight muscles anchor there and
  // heave with every beat (a bumpy ride). The spine bone carries it.
  const seatZ = SEAT_Z * T;
  const sSeat = plan.sAtZ(seatZ);
  const st = plan.station(sSeat);
  const seat = new Vector3(0, st.center.y + st.upper + 0.06 * hh, seatZ);

  const mouth = headPos.clone().add(new Vector3(0, -0.35 * S.headHalfHeight, 0.98 * L));
  const eyeRadius = S.eye * L;
  const eye = headPos.clone().add(new Vector3(0.78 * S.headHalfWidth, 0.42 * S.headHalfHeight, 0.4 * L));

  return {
    props: P,
    bones,
    idx: { root, spine, chest, breath, pelvis, neck, head, jaw, tongue: [tongue0, tongue1], fans, tail, wings, legs, fold, gular },
    plan,
    elbow,
    wrist,
    knuckle,
    fingerTips,
    knee,
    ankle,
    ball,
    mouth,
    eye,
    eyeRadius,
    seat,
    seatHalfWidth: st.halfWidth,
    tailTip,
  };
}

/** Where the inner panel's trailing edge meets the flank (left side, body space). */
export function innerTrailRoot(P: WyvernProportions, plan: BodyPlan): Vector3 {
  const trailZ = P.shape.wing.trailZ * P.shape.torsoLength;
  const st = plan.station(plan.sAtZ(trailZ));
  return new Vector3(st.halfWidth * 0.9, st.center.y + 0.35 * st.upper, trailZ);
}

/** Area centroid of the inner membrane panel (left; shoulder, arm, finger 2 tip, flank root). */
function innerPanelCentroid(P: WyvernProportions, sh: Vector3, el: Vector3, wr: Vector3, kn: Vector3, tip2: Vector3, plan: BodyPlan, T: number): Vector3 {
  void T;
  const poly = [sh, el, wr, kn, tip2, innerTrailRoot(P, plan)];
  // Fan triangulation from the first corner, area-weighted.
  const c = new Vector3();
  let area = 0;
  const ab = new Vector3();
  const ac = new Vector3();
  for (let i = 1; i < poly.length - 1; i++) {
    const a = ab.subVectors(poly[i], poly[0]).cross(ac.subVectors(poly[i + 1], poly[0])).length() / 2;
    c.addScaledVector(poly[0], a / 3).addScaledVector(poly[i], a / 3).addScaledVector(poly[i + 1], a / 3);
    area += a;
  }
  return c.multiplyScalar(1 / Math.max(1e-9, area));
}

/** Humerus radius along the bone (× the arm scale k): the deltopectoral mass near the shoulder. */
export const HUMERUS_R: [number, number][] = [
  [0, 0.345],
  [0.25, 0.33],
  [0.5, 0.26],
  [0.75, 0.2],
  [1, 0.17],
];

/** The arm's radius scale (m): every arm, hand and digit radius is a multiple of it. */
export function armScale(rig: RigDef): number {
  const S = rig.props.shape;
  return 1.25 * Math.sqrt(S.torsoHalfWidth / 0.74) * (S.armBulk ?? 1);
}

/** Radius of the humerus where it leaves the shoulder (m). */
export function humerusRootRadius(rig: RigDef): number {
  return HUMERUS_R[0][1] * armScale(rig);
}

/** Smooth 0..1 ramp used by builders for blending weights. */
export const ramp = (a: number, b: number, x: number) => smoothstep(a, b, x);
