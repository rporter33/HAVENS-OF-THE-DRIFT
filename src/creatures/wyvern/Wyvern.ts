// The wyvern: a procedurally built SkinnedMesh (body + membranes, two draw calls) on a 58-bone
// skeleton, posed every frame by the procedural animator from the player's WyvernPose.
//
// setLook() only touches uniforms when colors or the pattern change; a breed or a shape cosmetic
// (horns, frill, tail tip, saddle) rebuilds the geometry (and, for a breed, the skeleton) and
// disposes the old resources.

import { Bone, Group, Matrix4, Object3D, Skeleton, SkinnedMesh, Sphere, Vector3, type Material } from 'three';
import type { QualityLevel, WyvernCueKind, WyvernLook, WyvernPose } from '../../core/types';
import type { QualityProfile } from '../../render/quality';
import type { WyvernRenderable } from '../../game/contracts';
import type { TerrainQuery } from '../../core/types';
import { rigFor, type RigDef } from './rig';
import { headStyleId } from './proportions';
import { aoJob, applyAO, buildWyvernGeometry, type WyvernMeshInfo } from './geometry';
import { cachedAO, requestAO } from './ao';
import { armScale, foldRest, type FoldRest } from './parts/wings';
import type { TackHold } from './parts/saddle';
import {
  applyLookUniforms,
  createBodyMaterial,
  createGhostMaterial,
  createMembraneMaterial,
  createWyvernUniforms,
  type WyvernUniforms,
} from './materials';
import { WyvernAnimator } from './animator';
import { loadWyvernTrial, trialInfo, type WyvernTrialAsset, type WyvernTrialSelection } from './trial';

export interface WyvernOptions {
  /** Render as a translucent race ghost. */
  ghost?: boolean;
  /** Optional terrain for per-foot ground placement (falls back to pose.groundY). */
  terrain?: Pick<TerrainQuery, 'groundAt'>;
  /** Dev-only G3b trial body (`?wyvernTrial=meshy`): the Harrier's fitted Meshy body; other breeds unchanged. */
  trial?: WyvernTrialSelection;
}

const _m = new Matrix4();
const _v = new Vector3();
const _mInv = new Matrix4();
const _acc = new Float64Array(16);
const _gInv = new Matrix4();
const _fold = new Matrix4();
const X_AXIS = new Vector3(1, 0, 0);
/** The forearm's radius about half way down (× the arm scale; parts/wings.ts). */
const FOREARM_STEP_R = 0.16;

/**
 * Attachment points on the wyvern (world space, see Wyvern.socket): the seat (the saddle origin),
 * the pommel (where the rider's hand grips, at the top of the pommel horn), the steps on each
 * forearm a mounting rider puts a foot on (on the top face of the forearm, 55% of the way from the
 * elbow to the wrist; outward when the wing is folded), and the tack's holds (parts/saddle.ts):
 * the neck rope where each hand holds it (its rein bight hooked over the pommel horn), the grab
 * strap across the pommel's front, and the stirrup irons' treads under the straddling rider's feet.
 */
export type WyvernSocket = 'seat' | 'pommel' | 'stepL' | 'stepR' | TackHold;

export class Wyvern implements WyvernRenderable {
  readonly group = new Group();
  readonly saddle = new Object3D();
  readonly uniforms: WyvernUniforms = createWyvernUniforms();
  private look: WyvernLook;
  private readonly ghost: boolean;
  private readonly terrain: WyvernOptions['terrain'];
  private materials: Material[];
  private mesh: SkinnedMesh | null = null;
  private skeleton: Skeleton | null = null;
  private bones: Bone[] = [];
  private rig!: RigDef;
  private info!: WyvernMeshInfo;
  private animator!: WyvernAnimator;
  private shapeKey = '';
  /** Graphics quality (LOD caps and shading detail follow it once the LOD chain lands). */
  private quality: QualityLevel = 'high';
  private tipOffset = new Vector3();
  /** The fold helpers' rest blend, flattened for the per-frame hold (see holdFoldHelpers). */
  private foldHold = { start: new Int32Array(3), bone: new Int32Array(0), weight: new Float64Array(0), offset: new Float64Array(0) };
  /** The forearm steps (WyvernSocket stepL/R) in each forearm bone's space. */
  private stepOffset: [Vector3, Vector3] = [new Vector3(), new Vector3()];
  /** The tack's holds: the bone each rides and the hold in that bone's space. */
  private holdBone: Partial<Record<TackHold, number>> = {};
  private holdOffset: Partial<Record<TackHold, Vector3>> = {};
  private mouthOffset = new Vector3();
  private trialAsset: WyvernTrialAsset | null = null;
  /** The G3b trial body's load state (debug captures and tests read it). */
  readonly trialState: { selection?: WyvernTrialSelection; status: 'off' | 'loading' | 'ready' | 'failed'; error?: string } = { status: 'off' };

  constructor(look: WyvernLook, opts: WyvernOptions = {}) {
    this.ghost = !!opts.ghost;
    this.terrain = opts.terrain;
    this.look = { ...look };
    this.saddle.name = 'saddle';
    this.materials = this.ghost
      ? [createGhostMaterial(this.uniforms, false), createGhostMaterial(this.uniforms, true)]
      : [createBodyMaterial(this.uniforms), createMembraneMaterial(this.uniforms)];
    if (this.ghost) this.uniforms.uContour.value = 0;
    this.rebuild();
    if (opts.trial && !this.ghost) void this.loadTrial(opts.trial);
  }

  private async loadTrial(selection: WyvernTrialSelection): Promise<void> {
    this.trialState.selection = selection;
    this.trialState.status = 'loading';
    try {
      const asset = await loadWyvernTrial(selection);
      this.trialAsset = asset;
      if (this.look.breed === asset.breed) this.rebuild();
      this.trialState.status = 'ready';
    } catch (error) {
      this.trialAsset = null;
      this.trialState.status = 'failed';
      this.trialState.error = String(error);
    }
  }

  /** True while the G3b trial body stands in for the procedural one. */
  get trialActive(): boolean {
    return !!this.trialAsset && this.look.breed === this.trialAsset.breed;
  }

  /** Triangle and bone counts of the current build (for budgets and tests). */
  get stats(): { triangles: number; vertices: number; bones: number; membraneArea: number } {
    return { triangles: this.info.triangles, vertices: this.info.vertices, bones: this.bones.length, membraneArea: this.info.membraneArea };
  }

  get rigDef(): RigDef {
    return this.rig;
  }

  get skinnedMesh(): SkinnedMesh | null {
    return this.mesh;
  }

  setLook(look: WyvernLook): void {
    this.look = { ...look };
    const key = shapeKeyOf(look);
    if (key !== this.shapeKey) this.rebuild();
    else applyLookUniforms(this.uniforms, look);
  }

  update(dt: number, pose: WyvernPose): void {
    this.group.position.copy(pose.position);
    this.group.quaternion.copy(pose.orientation);
    this.animator.update(dt, pose, this.uniforms);
    this.animator.apply(this.bones);
    this.group.updateMatrixWorld(true);
    this.holdFoldHelpers();
  }

  getWingtips(outLeft: Vector3, outRight: Vector3): void {
    const w = this.rig.idx.wings;
    const l = this.bones[w[0].fingers[0][1]];
    const r = this.bones[w[1].fingers[0][1]];
    outLeft.copy(this.tipOffset).applyMatrix4(l.matrixWorld);
    outRight.set(-this.tipOffset.x, this.tipOffset.y, this.tipOffset.z).applyMatrix4(r.matrixWorld);
  }

  getHead(out: Vector3): Vector3 {
    return out.copy(this.mouthOffset).applyMatrix4(this.bones[this.rig.idx.head].matrixWorld);
  }

  /**
   * The saddle origin (the seat, where the rider's hips rest — the same point as `saddle`) in the
   * wyvern's body frame (+Z forward, +Y up, origin at WyvernPose.position) while it stands at
   * rest. The player state uses it to line mount and dismount up with the seat exactly. Changes
   * with the breed and the saddle cosmetic (read it again after setLook).
   */
  seatOffset(out: Vector3): Vector3 {
    // The seat rides the spine bone; standing at rest the trunk's only rotation is the root's
    // pitch about the body origin.
    return out.copy(this.info.saddle.seat).applyAxisAngle(X_AXIS, this.animator.standPitch);
  }

  /**
   * Debug captures only: restart the procedural animation from rest (fresh springs, timers and
   * gait, as after a build), so a re-staged showcase does not depend on what was staged before.
   */
  resetAnimation(): void {
    this.animator = new WyvernAnimator(this.rig, this.terrain);
  }

  /** Debug captures only: cue an idle event now, or hold natural ones off (see WyvernAnimator.cueIdle). */
  cueIdle(event: 'blink' | 'nictitate' | 'tongue' | null, hold = 0): void {
    this.animator.cueIdle(event, hold);
  }

  /** Play a one-shot behaviour (the Stable's display, the title's present; see WyvernCueKind). */
  cue(kind: WyvernCueKind): void {
    this.animator.cue(kind);
  }

  /** Graphics quality changed: LOD caps, shading detail and shadows follow it. */
  setQuality(q: QualityProfile): void {
    this.quality = q.level;
  }

  /** The current graphics quality level. */
  get qualityLevel(): QualityLevel {
    return this.quality;
  }

  /**
   * The four ground contacts (left hind, right hind, left wrist, right wrist; world) where the gait
   * has planted them, and how firmly each is down (1 planted … 0 lifted or in the air), as of the
   * last update: footstep FX and contact shadows. Returns how many were written.
   */
  footContacts(outPos: Vector3[], outW: { [i: number]: number }): number {
    return this.animator.footContacts(outPos, outW);
  }

  /** Where foot i (LH, RH, LF, RF) will land, or stands (world): its footstep belongs there. */
  footLanding(i: number, out: Vector3): Vector3 {
    return this.animator.footLanding(i, out);
  }

  /** The body's heave from the wingbeat this frame (m, + up): cameras can ride part of it. */
  bodyHeave(): number {
    return this.animator.heave;
  }

  /** World position of an attachment point (see WyvernSocket), as of the last update; null if unknown. */
  socket(name: WyvernSocket, out: Vector3): Vector3 | null {
    if (!this.bones.length) return null;
    if (name === 'seat') return this.saddle.getWorldPosition(out);
    if (name === 'pommel') {
      const grip = this.saddle.userData.gripOffset as Vector3 | undefined;
      if (!grip) return null;
      this.saddle.updateWorldMatrix(true, false);
      return out.copy(grip).applyMatrix4(this.saddle.matrixWorld);
    }
    if (name !== 'stepL' && name !== 'stepR') {
      const bone = this.holdBone[name];
      const off = this.holdOffset[name];
      if (bone === undefined || !off) return null;
      const b = this.bones[bone];
      b.updateWorldMatrix(true, false);
      return out.copy(off).applyMatrix4(b.matrixWorld);
    }
    // A step on the top (dorsal, outward when folded) face of the forearm, a little over half
    // way down from the elbow: where a mounting rider plants a foot.
    const side = name === 'stepL' ? 0 : 1;
    const fore = this.bones[this.rig.idx.wings[side].forearm];
    fore.updateWorldMatrix(true, false);
    return out.copy(this.stepOffset[side]).applyMatrix4(fore.matrixWorld);
  }

  dispose(): void {
    this.disposeMesh();
    for (const m of this.materials) m.dispose();
    this.group.removeFromParent();
  }

  // --- Internals ----------------------------------------------------------------------------------

  /**
   * Until the animator drives the wing-fold helpers (stream C, C3), hold each at its rest blend
   * (parts/wings.ts foldRest): the linear blend of the skinning matrices of the bones the inner
   * membrane panel hangs from, averaged over the panel by the helper's weight. Linear blend
   * skinning is linear in the bone matrices, so this is the same kind of blend the panel's own
   * weights make (not a rigid average, which would bow the sheet when the arm folds). World
   * matrices must be current; the helpers' are written here (their local matrix stays relative
   * to the chest, so anything re-deriving world matrices later keeps the hold).
   */
  private holdFoldHelpers(): void {
    const B = this.bones;
    const F = this.foldHold;
    _mInv.copy(B[this.rig.idx.chest].matrixWorld).invert();
    const G = this.group.matrixWorld;
    _gInv.copy(G).invert();
    const acc = _acc;
    for (let side = 0; side < 2; side++) {
      acc.fill(0);
      for (let i = F.start[side]; i < F.start[side + 1]; i++) {
        // This bone's skinning matrix carried to the helper's bind pivot: M · T(pivot − bone).
        const e = B[F.bone[i]].matrixWorld.elements;
        const w = F.weight[i];
        const ox = F.offset[i * 3];
        const oy = F.offset[i * 3 + 1];
        const oz = F.offset[i * 3 + 2];
        for (let k = 0; k < 12; k++) acc[k] += e[k] * w;
        acc[12] += (e[0] * ox + e[4] * oy + e[8] * oz + e[12]) * w;
        acc[13] += (e[1] * ox + e[5] * oy + e[9] * oz + e[13]) * w;
        acc[14] += (e[2] * ox + e[6] * oy + e[10] * oz + e[14]) * w;
        acc[15] += e[15] * w;
      }
      const fold = B[this.rig.idx.fold[side]];
      const mw = fold.matrixWorld.elements;
      for (let k = 0; k < 16; k++) mw[k] = acc[k];
      // The animator's fold (stream C, C3), a body-frame transform composed onto the rest hold.
      _fold.multiplyMatrices(G, this.animator.foldXform[side]).multiply(_gInv);
      fold.matrixWorld.premultiply(_fold);
      fold.matrix.multiplyMatrices(_mInv, fold.matrixWorld);
    }
  }

  private disposeMesh(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.removeFromParent();
      this.mesh = null;
    }
    if (this.skeleton) {
      this.skeleton.dispose();
      this.skeleton = null;
    }
    if (this.bones.length) {
      this.bones[0].removeFromParent();
      this.bones = [];
    }
  }

  private rebuild(): void {
    const look = this.look;
    const breedChanged = !this.rig || this.rig.props.breed !== look.breed;
    this.disposeMesh();
    // A head style moves the head's own joints: its own rig (same bones, same order).
    const rig0 = rigFor(look.breed, headStyleId(look.breed, look.head));
    this.rig = rig0;
    const rig = this.rig;
    this.info = buildWyvernGeometry(rig, look);
    const trial = this.trialAsset && look.breed === this.trialAsset.breed ? this.trialAsset : null;
    if (trial) this.info = trialInfo(rig, this.info, trial);
    this.foldHold = flattenFoldRest(rig, foldRest(rig));
    this.shapeKey = shapeKeyOf(look);
    // The baked ambient occlusion replaces the analytic fallback when it lands (cached per shape).
    const info = this.info;
    const aoKey = `${this.shapeKey}|${info.lod}${trial ? '|trial' : ''}`;
    const baked = cachedAO(aoKey);
    if (baked) applyAO(info, baked);
    else
      requestAO(aoKey, aoJob(info))?.then((ao) => {
        if (this.info === info) applyAO(info, ao);
      });

    // Bones: identity rest rotations, positions relative to the parent.
    const bones: Bone[] = rig.bones.map((d) => {
      const b = new Bone();
      b.name = d.name;
      return b;
    });
    const inverses: Matrix4[] = [];
    rig.bones.forEach((d, i) => {
      const b = bones[i];
      if (d.parent >= 0) {
        bones[d.parent].add(b);
        b.position.subVectors(d.pos, rig.bones[d.parent].pos);
      } else b.position.copy(d.pos);
      inverses.push(new Matrix4().makeTranslation(-d.pos.x, -d.pos.y, -d.pos.z));
    });
    // The fold helpers' matrices are written whole (a blend, see holdFoldHelpers), not composed.
    for (const i of rig.idx.fold) bones[i].matrixAutoUpdate = false;
    this.bones = bones;
    this.group.add(bones[0]);
    this.skeleton = new Skeleton(bones, inverses);

    const mesh = new SkinnedMesh(this.info.geometry, this.materials);
    mesh.bind(this.skeleton, _m.identity());
    const S = rig.props.shape;
    mesh.boundingSphere = new Sphere(new Vector3(0, 0, -0.5), Math.max(rig.props.wingspan, S.neckLength + S.torsoLength + S.tailLength + S.headLength) * 0.62);
    mesh.castShadow = !this.ghost;
    mesh.receiveShadow = !this.ghost;
    mesh.renderOrder = this.ghost ? 5 : 0;
    this.mesh = mesh;
    this.group.add(mesh);

    // Saddle anchor rides on the spine bone (over the ribcage), like the saddle's hardware.
    const spine = bones[rig.idx.spine];
    spine.add(this.saddle);
    this.saddle.position.copy(this.info.saddle.seat).sub(rig.bones[rig.idx.spine].pos);
    this.saddle.quaternion.identity();
    this.saddle.userData.halfWidth = this.info.saddle.halfWidth;
    this.saddle.userData.gripOffset = this.info.saddle.grip.clone();
    this.saddle.userData.gripSpread = this.info.saddle.gripSpread;
    this.saddle.userData.flank = { ...this.info.saddle.flank };

    // Tack holds: bind positions carried into their bones' spaces (rest rotations are identity).
    this.holdBone = {};
    this.holdOffset = {};
    for (const [name, h] of Object.entries(this.info.saddle.holds) as [TackHold, { pos: Vector3; bone: number }][]) {
      this.holdBone[name] = h.bone;
      this.holdOffset[name] = h.pos.clone().sub(rig.bones[h.bone].pos);
    }

    // Forearm steps: on the forearm's top surface (bind: the wing spread flat, dorsal = +Y).
    for (let side = 0; side < 2; side++) {
      const fi = rig.idx.wings[side].forearm;
      const elbow = rig.bones[fi].pos;
      const wrist = rig.bones[rig.idx.wings[side].hand].pos;
      this.stepOffset[side]
        .lerpVectors(elbow, wrist, 0.55)
        .add(_v.set(0, FOREARM_STEP_R * armScale(rig), 0))
        .sub(elbow);
    }

    // Wingtip: end of the distal wingtip finger, in that bone's space. Mouth: in head space.
    const fb = rig.idx.wings[0].fingers[0][1];
    this.tipOffset.subVectors(rig.fingerTips[0], rig.bones[fb].pos);
    this.mouthOffset.subVectors(rig.mouth, rig.bones[rig.idx.head].pos);

    this.uniforms.uEyeCenter.value.copy(this.info.eyeCenter);
    this.uniforms.uEyeAxis.value.copy(this.info.eyeAxis);
    this.uniforms.uEyeRadius.value = this.info.eyeRadius;
    this.uniforms.uBodyScale.value = S.torsoLength / 3.3;
    applyLookUniforms(this.uniforms, look);

    const prev = this.animator;
    this.animator = new WyvernAnimator(rig, this.terrain);
    if (prev && !breedChanged) this.animator.copyStateFrom(prev);
  }
}

function shapeKeyOf(look: WyvernLook): string {
  return `${look.breed}|${look.head}|${look.horns}|${look.frill}|${look.tail}|${look.saddle}`;
}

/** FoldRest as flat typed arrays: per side a run of (bone, weight, offset to the helper's pivot). */
function flattenFoldRest(rig: RigDef, rest: FoldRest) {
  const n = rest[0].length + rest[1].length;
  const out = { start: new Int32Array(3), bone: new Int32Array(n), weight: new Float64Array(n), offset: new Float64Array(n * 3) };
  let i = 0;
  for (let side = 0; side < 2; side++) {
    out.start[side] = i;
    const pivot = rig.bones[rig.idx.fold[side]].pos;
    for (const { bone, weight } of rest[side]) {
      out.bone[i] = bone;
      out.weight[i] = weight;
      _v.subVectors(pivot, rig.bones[bone].pos);
      out.offset[i * 3] = _v.x;
      out.offset[i * 3 + 1] = _v.y;
      out.offset[i * 3 + 2] = _v.z;
      i++;
    }
  }
  out.start[2] = i;
  return out;
}
