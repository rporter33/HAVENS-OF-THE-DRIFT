// The white dragon's resting pose (gate G12b): render 08's sphinx (docs/art/targets/
// 08-sleek-dragon-elder.png). It lies on its belly, with the forelegs stretched forward along the
// platform and the hind legs folded under. The tail curls round its left side, the head is held
// high, and the wings are folded and half raised.
//
// The pose is written as directions in the dragon's own frame: the body frame of rig.ts (+Z forward,
// +Y up, +X left), with the origin on the platform under the body center. Each bone is aimed so its
// bind segment (skeleton.ts) points along its direction, its parent already posed. The local
// rotations follow from that, so the pose doesn't depend on how the bind pose bends. Left first; the
// right mirrors x, except the tail, which curls to the left only.
//
// Bind rotations are the identity (rig.ts), so a bone's model transform is its parent's carried to
// its pivot and turned by its local rotation, and a vertex's skinned position is the weighted sum of
// MQ·(p − pivot) + MP over its bones (dragonSkin below; the GPU does the same).

import { Quaternion, Vector3 } from 'three';
import { DEG } from '../../core/math';
import { aimRotation } from '../wyvern/ik';
import { dragonRig, type DragonRigDef } from './rig';
import { dragonBindSkeleton } from './skeleton';

type V3 = [number, number, number];

/** Render 08's resting pose, as numbers. Angles in degrees; directions need not be unit length. */
export const RESTING = {
  /** The body center above the platform (m): the belly's lowest point just touches it. */
  rootHeight: 1.0,
  /** The trunk's pitch (degrees, + nose up): the chest rides a little higher than the haunches. */
  rootPitch: 3,
  /**
   * Each neck segment's rise above the body's horizontal, base to skull, in the body's midplane:
   * the approved sheet's upright S (82, 94, 91, 78, 61, 39) leaned a little forward at the base, as
   * render 08 carries it.
   */
  neckRise: [58, 70, 78, 72, 52, 26],
  /** The head's nose-down pitch (degrees; the bind head is 17.6°): near level, as in render 08. */
  headPitch: 9,
  /** Forelegs stretched forward along the platform: humerus, forearm, paw, toes. */
  foreleg: {
    humerus: [0.3, -0.47, 0.83] as V3,
    forearm: [0.03, 0.02, 1] as V3,
    paw: [0, -0.39, 0.92] as V3,
    toes: [0, -0.18, 0.98] as V3,
  },
  /** Hind legs folded under: the knee forward and out, the shin back, the foot flat and forward. */
  hindleg: {
    thigh: [0.38, -0.08, 0.92] as V3,
    shin: [0.05, -0.178, -0.98] as V3,
    meta: [0.1, -0.03, 1] as V3,
    toes: [0.04, -0.2, 0.98] as V3,
  },
  /**
   * The tail lying on the platform: each joint's heading (degrees from straight back, + toward the
   * left), base to tip, curling round the left side and forward, and each joint's height above the
   * platform (m) so the tail's underside rests on it; the tip lifts at the end, as render 08's fin.
   */
  tailHeading: [10, 34, 66, 100, 134, 166, 194, 220, 242, 258],
  /** Heights of the joints after the first (tail1 .. tail9) and of the tip; the first is where the
   * haunch puts it. */
  tailHeight: [0.52, 0.45, 0.36, 0.29, 0.25, 0.2, 0.15, 0.11, 0.1, 0.24],
  /**
   * Wings folded and half raised, as render 08's sail: the arm raised near upright and leaning out
   * a little, the wrist held high, and the fingers fanned back and down from it toward the haunch
   * with the membrane between them. Raised over the back like this the wing's dorsal side (up in the
   * bind pose) faces in toward the body; it's taken from the forearm and the leading finger.
   */
  wing: {
    humerus: [0.6, 0.7, -0.25] as V3,
    forearm: [0.2, 0.92, 0.3] as V3,
    hand: [0.12, 0.1, -0.99] as V3,
    fingers: [
      [
        [0.1, -0.56, -0.82],
        [0.08, -0.66, -0.75],
      ],
      [
        [0.1, -0.76, -0.64],
        [0.08, -0.84, -0.54],
      ],
      [
        [0.08, -0.9, -0.42],
        [0.06, -0.95, -0.3],
      ],
    ] as [V3, V3][],
  },
};

export interface DragonPose {
  /** The root bone's position in the dragon's frame (origin on the platform under the body center). */
  rootPos: Vector3;
  /** Local rotation of every bone, in rig order. */
  local: Quaternion[];
}

/** Every bone's model-space pivot and rotation for a pose (dragon frame), in rig order. */
export interface DragonModelPose {
  p: Vector3[];
  q: Quaternion[];
}

const X = new Vector3(1, 0, 0);
const UP = new Vector3(0, 1, 0);

/** Each bone's bind segment (pivot to end, body space), from the skeleton export. */
export function bindSpans(rig: DragonRigDef = dragonRig()): { head: Vector3; tail: Vector3 }[] {
  const sk = dragonBindSkeleton(rig);
  return sk.bones.map((b) => ({ head: new Vector3(...b.head), tail: new Vector3(...b.tail) }));
}

/** Render 08's resting pose on the dragon's own skeleton. */
export function restingPose(rig: DragonRigDef = dragonRig()): DragonPose {
  const R = RESTING;
  const n = rig.bones.length;
  const spans = bindSpans(rig);
  const { idx } = rig;
  const aims = new Map<number, { dir: Vector3; ref: Vector3; restRef: Vector3 }>();
  const v = (a: V3, side = 0) => new Vector3(side === 0 ? a[0] : -a[0], a[1], a[2]).normalize();
  const aim = (bone: number, dir: Vector3, ref: Vector3, restRef = ref) => aims.set(bone, { dir, ref, restRef });

  // The neck in the body's midplane, the head near level.
  const pitch = R.rootPitch * DEG;
  idx.neck.forEach((b, i) => {
    const a = R.neckRise[i] * DEG + pitch;
    aim(b, new Vector3(0, Math.sin(a), Math.cos(a)), X);
  });
  const hp = -R.headPitch * DEG;
  aim(idx.head, new Vector3(0, Math.sin(hp), Math.cos(hp)), X);

  // Legs, each in its own plane with the hinge kept across the body.
  for (let side = 0; side < 2; side++) {
    const f = idx.forelegs[side];
    const F = R.foreleg;
    aim(f.humerus, v(F.humerus, side), X);
    aim(f.forearm, v(F.forearm, side), X);
    aim(f.hand, v(F.paw, side), X);
    aim(f.toes, v(F.toes, side), X);
    const h = idx.hindlegs[side];
    const H = R.hindleg;
    aim(h.thigh, v(H.thigh, side), X);
    aim(h.shin, v(H.shin, side), X);
    aim(h.meta, v(H.meta, side), X);
    aim(h.toes, v(H.toes, side), X);
    // Wings: aimed with the dorsal side (bind +Y) turned to the wing's posed normal, the forearm
    // crossed with the leading finger (as the bind pose's arm crossed with its finger is +Y),
    // mirrored for the right wing.
    const w = idx.wings[side];
    const W = R.wing;
    const nl = new Vector3(...W.forearm).normalize().cross(new Vector3(...W.fingers[0][0]).normalize()).normalize();
    const nrm = side === 0 ? nl : new Vector3(-nl.x, nl.y, nl.z);
    aim(w.humerus, v(W.humerus, side), nrm, UP);
    aim(w.forearm, v(W.forearm, side), nrm, UP);
    aim(w.hand, v(W.hand, side), nrm, UP);
    for (let k = 0; k < 3; k++) {
      aim(w.fingers[k][0], v(W.fingers[k][0], side), nrm, UP);
      aim(w.fingers[k][1], v(W.fingers[k][1], side), nrm, UP);
    }
  }

  // The tail: joint positions on the platform from the headings and heights, then aimed. Its root
  // rides the haunch (the pelvis keeps the trunk's pitch).
  const rootQ = new Quaternion().setFromAxisAngle(X, -pitch);
  const rootPos = new Vector3(0, R.rootHeight, 0);
  const base = rig.bones[idx.tail[0]].pos.clone().sub(rig.bones[idx.root].pos).applyQuaternion(rootQ).add(rootPos);
  const tailDirs = tailDirections(rig, spans, base.y);
  idx.tail.forEach((b, i) => aim(b, tailDirs[i], UP));

  const local = solve(rig, spans, rootQ, aims);
  return { rootPos, local: local.slice(0, n) };
}

/** Directions of the tail's segments (dragon frame) that put its joints at RESTING's headings and
 * heights, from the tail root's height. */
function tailDirections(rig: DragonRigDef, spans: { head: Vector3; tail: Vector3 }[], baseHeight: number): Vector3[] {
  const R = RESTING;
  let y = baseHeight;
  return rig.idx.tail.map((b, i) => {
    const len = spans[b].head.distanceTo(spans[b].tail);
    const dy = Math.max(-len * 0.95, Math.min(len * 0.95, R.tailHeight[i] - y));
    y += dy;
    const h = Math.sqrt(len * len - dy * dy);
    const a = R.tailHeading[i] * DEG;
    return new Vector3(Math.sin(a) * h, dy, -Math.cos(a) * h).normalize();
  });
}

const _qi = new Quaternion();

/** Local rotations from model-space aims: parents first (rig order), each aimed bone's model
 * rotation taking its bind segment onto its direction; the others keep their parent's. */
function solve(rig: DragonRigDef, spans: { head: Vector3; tail: Vector3 }[], rootQ: Quaternion, aims: Map<number, { dir: Vector3; ref: Vector3; restRef: Vector3 }>): Quaternion[] {
  const n = rig.bones.length;
  const MQ: Quaternion[] = [];
  const local: Quaternion[] = [];
  const restDir = new Vector3();
  for (let i = 0; i < n; i++) {
    const p = rig.bones[i].parent;
    const parentQ = p < 0 ? new Quaternion() : MQ[p];
    const a = aims.get(i);
    let W: Quaternion;
    if (i === rig.idx.root) W = rootQ.clone();
    else if (a) {
      restDir.subVectors(spans[i].tail, spans[i].head).normalize();
      W = aimRotation(restDir, a.restRef, a.dir, a.ref, new Quaternion());
    } else W = parentQ.clone();
    MQ.push(W);
    local.push(_qi.copy(parentQ).invert().multiply(W).clone());
  }
  return local;
}

/** The bind pose standing on the platform: every rotation the identity, the soles on y = 0, the
 * wings spread flat (for looking at the LODs as the fit built them). */
export function bindPose(rig: DragonRigDef = dragonRig()): DragonPose {
  return { rootPos: new Vector3(0, rig.props.shape.standHeight, 0), local: rig.bones.map(() => new Quaternion()) };
}

/** Forward kinematics: every bone's model pivot and rotation (dragon frame) for a pose. Bone scale
 * is left out: only the breath bone scales, and nothing hangs from it. */
export function modelPose(rig: DragonRigDef, pose: DragonPose, out?: DragonModelPose): DragonModelPose {
  const n = rig.bones.length;
  const o = out ?? { p: rig.bones.map(() => new Vector3()), q: rig.bones.map(() => new Quaternion()) };
  for (let i = 0; i < n; i++) {
    const b = rig.bones[i];
    if (b.parent < 0) {
      o.p[i].copy(pose.rootPos);
      o.q[i].copy(pose.local[i]);
    } else {
      o.p[i].subVectors(b.pos, rig.bones[b.parent].pos).applyQuaternion(o.q[b.parent]).add(o.p[b.parent]);
      o.q[i].multiplyQuaternions(o.q[b.parent], pose.local[i]);
    }
  }
  return o;
}

/** Linear blend skinning on the CPU (tests and checks): the posed positions of a skinned vertex set
 * whose joints index the rig's bones. */
export function dragonSkin(rig: DragonRigDef, model: DragonModelPose, position: Float32Array, joints: ArrayLike<number>, weights: ArrayLike<number>, out = new Float32Array(position.length)): Float32Array {
  const p = new Vector3();
  const t = new Vector3();
  const n = position.length / 3;
  for (let v = 0; v < n; v++) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let k = 0; k < 4; k++) {
      const w = weights[v * 4 + k];
      if (!(w > 0)) continue;
      const j = joints[v * 4 + k];
      p.set(position[v * 3], position[v * 3 + 1], position[v * 3 + 2]).sub(rig.bones[j].pos);
      t.copy(p).applyQuaternion(model.q[j]).add(model.p[j]);
      x += w * t.x;
      y += w * t.y;
      z += w * t.z;
    }
    out[v * 3] = x;
    out[v * 3 + 1] = y;
    out[v * 3 + 2] = z;
  }
  return out;
}
