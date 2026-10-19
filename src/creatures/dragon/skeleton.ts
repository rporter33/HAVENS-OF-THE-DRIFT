// The dragon's bind skeleton as plain data for Blender (gate G12a), the way G3b exported the
// Harrier's: scripts/dragon-export-skeleton.mjs writes it as JSON, and
// scripts/blender/dragon_meshy_fit.py builds the armature from it and fits the Meshy body to it.
//
// Body frame as the rig's: +Z forward, +Y up, +X left, metres, origin at the body center. Blender
// takes (x, -z, y), so the head faces -Y and the creature's left is +X there, as on the Meshy body.
//
// `points` names every joint the fit maps the Meshy body onto, plus the ends the chains run to
// (snout, toe tips, finger tips, tail tip). `segments` gives each weighted bone the two points its
// span runs between; the fit maps the Meshy body bone by bone from its own landmarks of the same
// names onto these. Bones without a segment (root, breath, jaw, cheek fins, fold helpers, gular)
// take no weight from the fitted body.

import { Vector3 } from 'three';
import { dragonRig, type DragonRigDef } from './rig';

export type Vec3 = [number, number, number];

export interface DragonBindBone {
  name: string;
  parent: string | null;
  /** Pivot (body space). */
  head: Vec3;
  /** Where the bone points: its segment's end, or a short stub for the bones without one. */
  tail: Vec3;
}

export interface DragonBindStation {
  /** Arc length along the body plan from inside the skull (m). */
  s: number;
  center: Vec3;
  halfWidth: number;
  upper: number;
  lower: number;
}

export interface DragonBindSkeleton {
  version: 1;
  frame: string;
  bones: DragonBindBone[];
  points: Record<string, Vec3>;
  segments: Record<string, [string, string]>;
  /** The soles' height (body space); the feet stand on it. */
  ground: number;
  wingspan: number;
  /** Chest front to rump; the torso's depth (back to belly) at the body center, and how much of it
   * lies below the center (m). */
  torso: { length: number; depth: number; below: number };
  /** The body plan's cross-sections, for reference: the Meshy body, not the plan, sets the girth. */
  plan: DragonBindStation[];
}

const SIDES = ['L', 'R'] as const;
const round = (v: Vector3): Vec3 => [r6(v.x), r6(v.y), r6(v.z)];
const r6 = (x: number) => Math.round(x * 1e6) / 1e6 + 0;

/** Named points (left side first; the right mirrors x). */
function points(rig: DragonRigDef): Record<string, Vector3> {
  const P: Record<string, Vector3> = {};
  const pos = (i: number) => rig.bones[i].pos.clone();
  const { idx } = rig;
  P.root = pos(idx.root);
  P.chest = pos(idx.chest);
  idx.neck.forEach((b, i) => (P[`neck${i}`] = pos(b)));
  P.head = pos(idx.head);
  P.snout = rig.snout.clone();
  idx.tail.forEach((b, i) => (P[`tail${i}`] = pos(b)));
  P.tailtip = rig.tailTip.clone();
  P.seat = rig.seat.clone();
  P.mouth = rig.mouth.clone();
  const F = rig.props.foreleg;
  const H = rig.props.hindleg;
  SIDES.forEach((s, side) => {
    const m = (v: Vector3) => (side === 0 ? v.clone() : new Vector3(-v.x, v.y, v.z));
    const f = idx.forelegs[side];
    const h = idx.hindlegs[side];
    const w = idx.wings[side];
    P[`scapula${s}`] = pos(f.scapula);
    P[`shoulder${s}`] = pos(f.humerus);
    P[`elbow${s}`] = pos(f.forearm);
    P[`wrist${s}`] = pos(f.hand);
    P[`foreball${s}`] = pos(f.toes);
    P[`foretip${s}`] = pos(f.toes).add(new Vector3(0, 0, F.toe));
    P[`hip${s}`] = pos(h.thigh);
    P[`knee${s}`] = pos(h.shin);
    P[`ankle${s}`] = pos(h.meta);
    P[`ball${s}`] = pos(h.toes);
    P[`toetip${s}`] = pos(h.toes).add(new Vector3(0, 0, H.toe));
    P[`wingroot${s}`] = pos(w.humerus);
    P[`wingelbow${s}`] = pos(w.forearm);
    P[`wingwrist${s}`] = pos(w.hand);
    P[`knuckle${s}`] = pos(w.fingers[0][0]);
    for (let k = 0; k < 3; k++) {
      P[`f${k}mid${s}`] = pos(w.fingers[k][1]);
      P[`f${k}tip${s}`] = m(rig.fingerTips[k]);
    }
    P[`trail${s}`] = m(rig.trailRoot);
    P[`eye${s}`] = m(rig.eye);
  });
  return P;
}

/** Each weighted bone's span, as [from, to] point names. */
export function dragonSegments(rig: DragonRigDef = dragonRig()): Record<string, [string, string]> {
  const seg: Record<string, [string, string]> = {
    spine: ['root', 'chest'],
    chest: ['chest', 'neck0'],
    pelvis: ['root', 'tail0'],
    head: ['head', 'snout'],
  };
  const nNeck = rig.idx.neck.length;
  const nTail = rig.idx.tail.length;
  for (let i = 0; i < nNeck; i++) seg[`neck${i}`] = [`neck${i}`, i + 1 < nNeck ? `neck${i + 1}` : 'head'];
  for (let i = 0; i < nTail; i++) seg[`tail${i}`] = [`tail${i}`, i + 1 < nTail ? `tail${i + 1}` : 'tailtip'];
  for (const s of SIDES) {
    seg[`scapula${s}`] = [`scapula${s}`, `shoulder${s}`];
    seg[`humerus${s}`] = [`shoulder${s}`, `elbow${s}`];
    seg[`forearm${s}`] = [`elbow${s}`, `wrist${s}`];
    seg[`forepaw${s}`] = [`wrist${s}`, `foreball${s}`];
    seg[`foretoes${s}`] = [`foreball${s}`, `foretip${s}`];
    seg[`thigh${s}`] = [`hip${s}`, `knee${s}`];
    seg[`shin${s}`] = [`knee${s}`, `ankle${s}`];
    seg[`meta${s}`] = [`ankle${s}`, `ball${s}`];
    seg[`toes${s}`] = [`ball${s}`, `toetip${s}`];
    seg[`wingHumerus${s}`] = [`wingroot${s}`, `wingelbow${s}`];
    seg[`wingForearm${s}`] = [`wingelbow${s}`, `wingwrist${s}`];
    seg[`wingHand${s}`] = [`wingwrist${s}`, `knuckle${s}`];
    for (let k = 0; k < 3; k++) {
      seg[`finger${k}a${s}`] = [`knuckle${s}`, `f${k}mid${s}`];
      seg[`finger${k}b${s}`] = [`f${k}mid${s}`, `f${k}tip${s}`];
    }
  }
  return seg;
}

/** Display stubs (body space, from the pivot) for the bones the fit doesn't weight. */
function stub(name: string, rig: DragonRigDef): Vector3 {
  const S = rig.props.shape;
  const hh = S.torsoHalfHeight;
  const L = S.headLength;
  const x = name.endsWith('R') ? -1 : 1;
  // Along the head, which pitches nose-down.
  const fwd = new Vector3(0, -Math.sin(S.headPitch), Math.cos(S.headPitch));
  switch (name.replace(/[LR]$/, '')) {
    case 'root':
      return new Vector3(0, -0.4 * hh, 0);
    case 'breath':
      return new Vector3(0, -0.3 * hh, 0);
    case 'jaw':
      return fwd.multiplyScalar(0.6 * L);
    case 'fan':
      return fwd.multiplyScalar(-0.15 * L).add(new Vector3(0.15 * L * x, 0, 0));
    case 'fold':
      return new Vector3(0, 0.2 * hh, 0);
    case 'gular':
      return fwd.multiplyScalar(0.3 * L);
    default:
      throw Error(`dragon skeleton: no segment or stub for ${name}`);
  }
}

export function dragonBindSkeleton(rig: DragonRigDef = dragonRig()): DragonBindSkeleton {
  const P = points(rig);
  const segments = dragonSegments(rig);
  const bones = rig.bones.map((b) => {
    const seg = segments[b.name];
    const tail = seg ? P[seg[1]] : b.pos.clone().add(stub(b.name, rig));
    return { name: b.name, parent: b.parent < 0 ? null : rig.bones[b.parent].name, head: round(b.pos), tail: round(tail) };
  });
  const mid = rig.plan.station(rig.plan.sAtZ(0));
  const plan: DragonBindStation[] = [];
  const n = 96;
  for (let i = 0; i <= n; i++) {
    const st = rig.plan.station((i / n) * rig.plan.length);
    plan.push({ s: r6(st.s), center: round(st.center), halfWidth: r6(st.halfWidth), upper: r6(st.upper), lower: r6(st.lower) });
  }
  return {
    version: 1,
    frame: 'game body frame: +Z forward, +Y up, +X left, metres, origin at the body center (Blender: x, -z, y)',
    bones,
    points: Object.fromEntries(Object.entries(P).map(([k, v]) => [k, round(v)])),
    segments,
    ground: r6(-rig.props.shape.standHeight),
    wingspan: rig.props.shape.wingspan,
    torso: { length: rig.props.shape.torsoLength, depth: r6(mid.upper + mid.lower), below: r6(mid.lower) },
    plan,
  };
}
