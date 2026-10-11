// The rider: a procedural skinned character (model.ts) animated procedurally (animator.ts), with
// verlet cloth for scarves, capes, coat tails and hair (clothRig.ts).
//
// Each frame the Rider works out an "anchor" frame and places its group there: on foot, upright
// at hip height above pose.position facing pose.yaw; mounted, the wyvern's saddle (hips at its
// origin). Mounting and dismounting blend between the two over the transition, and any remaining
// jump (e.g. the saddle being somewhere other than where the player state thinks the seat is) is
// absorbed by a short decaying offset, so the rider never pops.

import { Group, Matrix4, Quaternion, Vector3, type Object3D } from 'three';
import type { GameEvents, RiderLook, RiderPose, TerrainQuery } from '../../core/types';
import type { EventBus } from '../../core/events';
import type { RiderRenderable } from '../../game/contracts';
import type { QualityProfile } from '../../render/quality';
import { PLAYER_TUNING } from '../../player/tuning';
import { buildRiderModel, recolorRiderModel, riderMaterial, type RiderModel } from './model';
import { riderShapeKey } from './palette';
import { RiderAnimator, type AnimContext, type SaddleFlank } from './animator';
import { ClothRig, type ClothLod } from './clothRig';
import type { ColliderName } from './accessories';
import type { Capsule, Cloth } from './cloth';
import { B } from './rig';
import type { RiderProof } from './proof';
import { riderClothSpecs } from './wardrobeModel';
import { proofTextureSize, type ProofMaps } from './proofMaterials';

const P = PLAYER_TUNING;

export interface RiderOptions {
  /** Explicit C02 study selection; never stored in RiderLook or save data. */
  proof?: RiderProof;
  proofMaps?: ProofMaps;
  /** High-only comparison; Low/Medium retain their fixed memory budgets. */
  proofHighSize?: 3072 | 4096;
  proofTextureLimit?: number;
  /** Ground for foot placement on slopes (optional: flat at pose.position otherwise). */
  terrain?: Pick<TerrainQuery, 'groundAt'>;
  /**
   * The wyvern's saddle, known even while on foot so mounting can blend into it before the player
   * state flips to mounted. Optional: the last saddle passed to update() is remembered anyway.
   */
  saddle?: Object3D;
  /** Existing wyvern tack sockets, in world space. Missing holds retain the flank-fit pose. */
  socket?: (name: 'stirrupL' | 'stirrupR', out: Vector3) => Vector3 | null;
  /** Event bus for touchdown jolts. */
  events?: EventBus<GameEvents>;
  /** Graphics quality: cloth detail and shadows (see also setQuality). */
  quality?: QualityProfile;
}

function clothLod(q: QualityProfile | undefined, highSize?: 3072 | 4096, textureLimit?: number): ClothLod {
  if (!q) return { detail: 1, shadows: true, proofAtlasSize: 1024 };
  // Increase only the drawn surface subdivisions. The cloth particles, contacts, tethers
  // and fixed-step solver stay identical across quality levels.
  return { detail: q.level === 'low' ? 0.5 : q.level === 'medium' ? 1 : q.level === 'high' ? 4 / 3 : 2, shadows: q.shadows,
    proofAtlasSize: proofTextureSize(q.level, highSize, textureLimit) };
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// Scratch.
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _v = new Vector3();
const _v2 = new Vector3();
const _fq = new Quaternion();
const _iq = new Quaternion();
const _sq = new Quaternion();
const _fp = new Vector3();
const _sp = new Vector3();
const _m = new Matrix4();
const UP = new Vector3(0, 1, 0);

interface ColliderDef {
  name: ColliderName;
  bone: number;
  a: Vector3;
  b: Vector3;
}

export class Rider implements RiderRenderable {
  /** Render-only sockets, resolved against the current rig after animation and model rebuilds. */
  equipmentFrame(socket: 'bracer' | 'harness' | 'waist', out: Matrix4): Matrix4 {
    const { bones, dims } = this.model.rig;
    out.copy(bones[socket === 'bracer' ? B.foreArmL : socket === 'waist' ? B.hips : B.chest].matrixWorld);
    return out.scale(_v.set(socket === 'bracer' ? dims.g : dims.w, dims.h, dims.g));
  }

  readonly group = new Group();
  private model: RiderModel;
  private animator: RiderAnimator;
  private cloth: ClothRig;
  private look: RiderLook;
  private readonly opts: RiderOptions;
  private saddleRef: Object3D | null;
  private readonly capsules: Record<ColliderName, Capsule>;
  private colliderDefs: ColliderDef[] = [];
  private time = 0;
  // Anchor state.
  private anchorW = 0;
  private mountW = 0;
  private readonly lastPos = new Vector3();
  private readonly lastQuat = new Quaternion();
  private readonly offPos = new Vector3();
  private readonly offQuat = new Quaternion();
  private readonly anchorVel = new Vector3();
  private hasLast = false;
  private lastMounted = false;
  private lastAction = '';
  // Cloth frame.
  private readonly origin = new Vector3();
  private readonly frameVel = new Vector3();
  private readonly dv = new Vector3();
  private clothFresh = true;
  // Ride motion (the saddle's own movement, felt through the seat).
  private readonly saddlePos = new Vector3();
  private readonly saddleVel = new Vector3();
  private readonly saddleAcc = new Vector3();
  private readonly rideOffset = new Vector3();
  private readonly rideVel = new Vector3();
  private ridePitch = 0;
  private ridePitchVel = 0;
  private haveSaddlePos = false;
  private jolt = 0;
  private readonly ctx: AnimContext;
  private readonly stirrupPoints = [new Vector3(), new Vector3()] as const;
  private readonly stirrups: [Vector3 | null, Vector3 | null] = [null, null];
  private readonly anchorInverse = new Matrix4();
  private readonly unsub: (() => void)[] = [];
  private lod: ClothLod = { detail: 1, shadows: true };

  constructor(look: RiderLook, opts: RiderOptions = {}) {
    this.opts = opts;
    this.look = { ...look };
    this.saddleRef = opts.saddle ?? null;
    this.lod = clothLod(opts.quality, opts.proofHighSize, opts.proofTextureLimit);
    this.model = buildRiderModel(this.look, { proof: opts.proof, maps: opts.proofMaps, atlasSize: this.lod.proofAtlasSize });
    this.group.add(this.model.mesh);
    this.animator = new RiderAnimator(this.model.rig);
    const cap = (): Capsule => ({ ax: 0, ay: -1e4, az: 0, bx: 0, by: -1e4, bz: 0, r: 0.01 });
    this.capsules = {
      chest: cap(),
      belly: cap(),
      shoulders: cap(),
      armL: cap(),
      armR: cap(),
      foreArmL: cap(),
      foreArmR: cap(),
      thighL: cap(),
      thighR: cap(),
      shinL: cap(),
      shinR: cap(),
      head: cap(),
      neck: cap(),
      mount: cap(),
    };
    this.defineColliders();
    this.lod = clothLod(opts.quality, opts.proofHighSize, opts.proofTextureLimit);
    this.cloth = this.makeCloth();
    const ground = (x: number, z: number, nearY: number) => {
      const g = this.opts.terrain?.groundAt(x, z, nearY + 0.6);
      return g && Math.abs(g.y - nearY) < 0.9 ? g.y : nearY;
    };
    this.ctx = {
      mountW: 0,
      anchor: this.group.matrixWorld,
      halfWidth: 0.55,
      grip: new Vector3(0, 0.35, 0.45),
      flank: null,
      rideOffset: this.rideOffset,
      ridePitch: 0,
      ground,
      snapped: true,
      standHeight: this.model.rig.dims.hipsY,
    };
    if (opts.events) {
      this.unsub.push(
        opts.events.on('touchdown', (e) => {
          this.jolt = Math.max(this.jolt, Math.min(1, e.impact / 8));
        }),
      );
    }
  }

  setLook(look: RiderLook): void {
    const sameShape = riderShapeKey(look) === riderShapeKey(this.look);
    this.look = { ...look };
    if (sameShape) {
      // Colors only (every swatch click in the Stable): retint in place, no rebuild.
      recolorRiderModel(this.model, this.look);
      this.cloth.recolor(this.look);
      return;
    }
    const old = this.model;
    this.group.remove(old.mesh);
    old.geometry.dispose();
    this.model = buildRiderModel(this.look, { proof: this.opts.proof, maps: this.opts.proofMaps, atlasSize: this.lod.proofAtlasSize });
    this.group.add(this.model.mesh);
    this.animator.setRig(this.model.rig);
    old.rig.skeleton.dispose();
    this.cloth.dispose();
    this.defineColliders();
    this.cloth = this.makeCloth();
    this.ctx.standHeight = this.model.rig.dims.hipsY;
    this.clothFresh = true;
  }

  /** Optional: follow graphics quality changes (cloth detail, cloth shadows). */
  setQuality(q: QualityProfile): void {
    this.lod = clothLod(q, this.opts.proofHighSize, this.opts.proofTextureLimit);
    if (this.model.textured) this.model.mesh.material = riderMaterial(this.opts.proofMaps ?? 'color', this.lod.proofAtlasSize);
    const states = this.model.textured ? new Map(this.cloth.pieces.map(pc => [pc.spec.name, pc.cloth])) : undefined;
    this.cloth.dispose();
    this.cloth = this.makeCloth(states);
    if (!states) this.clothFresh = true;
  }

  private makeCloth(states?: ReadonlyMap<string, Cloth>): ClothRig {
    const specs = riderClothSpecs(this.model.ctx, this.model.proof);
    return new ClothRig(specs, this.model.rig.bindPos, this.group, this.capsules,
      this.model.textured ? { ...this.lod, proofMaps: this.opts.proofMaps ?? 'color' } : this.lod,
      this.opts.terrain ? (x, _y, z) => {
        const ground = this.opts.terrain!.groundAt(x, z, this.origin.y - this.model.rig.dims.hipsY + .3);
        // Reject an overhead ledge/deck; the same terrain query supplies walking and foot IK.
        return ground && ground.y < this.origin.y + .2 ? ground.y : null;
      } : undefined, states);
  }

  private defineColliders(): void {
    const d = this.model.rig.dims;
    const bp = this.model.rig.bindPos;
    const h = this.model.ctx.head;
    const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
    const g = d.g;
    this.colliderDefs = [
      { name: 'chest', bone: B.chest, a: v(0.08 * d.w, 1.27 * d.h, 0.005), b: v(-0.08 * d.w, 1.27 * d.h, 0.005) },
      { name: 'belly', bone: B.hips, a: v(0.075 * d.w, 1.0 * d.h, 0.005), b: v(-0.075 * d.w, 1.0 * d.h, 0.005) },
      { name: 'shoulders', bone: B.chest, a: bp[B.upperArmL].clone().add(v(-0.02, 0.015, -0.01)), b: bp[B.upperArmR].clone().add(v(0.02, 0.015, -0.01)) },
      { name: 'armL', bone: B.upperArmL, a: bp[B.upperArmL].clone(), b: bp[B.foreArmL].clone() },
      { name: 'armR', bone: B.upperArmR, a: bp[B.upperArmR].clone(), b: bp[B.foreArmR].clone() },
      { name: 'foreArmL', bone: B.foreArmL, a: bp[B.foreArmL].clone(), b: bp[B.handL].clone() },
      { name: 'foreArmR', bone: B.foreArmR, a: bp[B.foreArmR].clone(), b: bp[B.handR].clone() },
      { name: 'thighL', bone: B.thighL, a: bp[B.thighL].clone().add(v(0, -0.03, 0)), b: bp[B.shinL].clone() },
      { name: 'thighR', bone: B.thighR, a: bp[B.thighR].clone().add(v(0, -0.03, 0)), b: bp[B.shinR].clone() },
      { name: 'shinL', bone: B.shinL, a: bp[B.shinL].clone(), b: bp[B.footL].clone() },
      { name: 'shinR', bone: B.shinR, a: bp[B.shinR].clone(), b: bp[B.footR].clone() },
      { name: 'head', bone: B.head, a: h.center.clone().add(v(0, 0.02, -0.01)), b: h.center.clone().add(v(0, -0.03, 0.0)) },
      { name: 'neck', bone: B.neck, a: bp[B.neck].clone(), b: bp[B.head].clone() },
    ];
    const r: Record<string, number> = {
      chest: 0.11 * g,
      belly: 0.105 * g,
      shoulders: 0.06 * g,
      armL: 0.055 * g,
      armR: 0.055 * g,
      foreArmL: 0.045 * g,
      foreArmR: 0.045 * g,
      thighL: 0.088 * g,
      thighR: 0.088 * g,
      shinL: 0.062 * g,
      shinR: 0.062 * g,
      head: Math.max(h.radii.x, h.radii.z) + 0.02,
      neck: 0.06 * g,
    };
    for (const def of this.colliderDefs) this.capsules[def.name].r = r[def.name];
  }

  update(dt: number, pose: RiderPose, saddle: Object3D | null): void {
    dt = Math.min(0.1, Math.max(0, dt));
    this.time += dt;
    if (saddle) this.saddleRef = saddle;
    const sad = saddle ?? this.saddleRef;
    const action = pose.action;
    const t = pose.actionTime;

    // --- Which frame are we in? ---
    let anchorTarget = pose.mounted ? 1 : 0;
    let mountTarget = anchorTarget;
    let exact = false;
    if (action === 'mount') {
      const tm = t / P.mountTime;
      mountTarget = smooth(0.42, 0.9, tm);
      anchorTarget = sad ? smooth(0.48, 0.86, tm) : pose.mounted ? 1 : 0;
      exact = true;
      if (this.lastAction !== 'mount' && sad) this.animator.mountSide = this.sideOf(sad, pose) >= 0 ? 1 : -1;
    } else if (action === 'dismount') {
      const td = t / P.dismountTime;
      mountTarget = 1 - smooth(0.06, 0.6, td);
      anchorTarget = sad ? 1 - smooth(0.0, 0.45, td) : 0;
      exact = true;
      if (this.lastAction !== 'dismount' && sad) this.animator.dismountSide = this.dismountSideOf(sad, pose);
    }
    if (!sad) anchorTarget = 0;
    if (exact) {
      this.anchorW = anchorTarget;
      this.mountW = mountTarget;
    } else {
      const k = 1 - Math.exp(-12 * dt);
      this.anchorW += (anchorTarget - this.anchorW) * k;
      this.mountW += (mountTarget - this.mountW) * k;
      if (Math.abs(this.anchorW - anchorTarget) < 0.002) this.anchorW = anchorTarget;
      if (Math.abs(this.mountW - mountTarget) < 0.002) this.mountW = mountTarget;
    }

    // Foot frame: hips above pose.position (which, while hopping off, starts at the seat).
    const hipsY = this.model.rig.dims.hipsY;
    const lift = action === 'dismount' ? smooth(0, 1, t / P.dismountTime) : 1;
    _fp.copy(pose.position).addScaledVector(UP, hipsY * lift);
    _fq.setFromAxisAngle(UP, pose.yaw);
    // Saddle frame.
    if (sad && this.anchorW > 0) {
      sad.updateWorldMatrix(true, false);
      sad.matrixWorld.decompose(_sp, _sq, _s);
      const ud = sad.userData as { halfWidth?: number; gripOffset?: Vector3; flank?: SaddleFlank };
      this.ctx.halfWidth = typeof ud.halfWidth === 'number' ? ud.halfWidth : 0.55;
      if (ud.gripOffset) this.ctx.grip.copy(ud.gripOffset);
      this.ctx.flank = ud.flank ?? null;
    }
    _p.copy(_fp);
    _q.copy(_fq);
    if (sad && this.anchorW > 0) {
      _p.lerp(_sp, this.anchorW);
      _q.slerp(_sq, this.anchorW);
    }

    // --- Continuity: teleports cut, small discontinuities are absorbed ---
    let snapped = !this.hasLast;
    if (this.hasLast && dt > 0) {
      const step = _v.subVectors(_p, this.lastPos);
      const jump = step.length();
      // What the anchor's own recent motion predicts (pose.velocity can lag interpolation).
      const expected = Math.max(pose.velocity.length(), this.anchorVel.length()) * dt;
      if (jump > Math.max(6, expected * 3 + 3)) snapped = true;
      else {
        const attachChanged = pose.mounted !== this.lastMounted;
        const err = _v2.copy(step).addScaledVector(this.anchorVel, -dt).length();
        // Mount/dismount blend their frames exactly; elsewhere a sudden step (a seat that
        // isn't where the player state put it, a stair) is absorbed instead of popping.
        if (attachChanged || (!exact && err > 0.15)) {
          // Keep the rendered pose where it was (plus the expected motion); decay the difference.
          this.offPos.copy(this.group.position).addScaledVector(pose.velocity, dt).sub(_p);
          this.offQuat.copy(this.group.quaternion).multiply(_iq.copy(_q).invert());
        }
      }
    }
    if (snapped) {
      this.offPos.set(0, 0, 0);
      this.offQuat.identity();
      this.anchorVel.copy(pose.velocity);
    } else if (this.hasLast && dt > 0) {
      _v.subVectors(_p, this.lastPos).divideScalar(dt);
      if (_v.lengthSq() < 400 * 400) this.anchorVel.lerp(_v, 1 - Math.exp(-15 * dt));
    }
    this.lastPos.copy(_p);
    this.lastQuat.copy(_q);
    this.lastMounted = pose.mounted;
    this.hasLast = true;
    const decay = Math.exp(-dt / 0.085);
    this.offPos.multiplyScalar(decay);
    this.offQuat.slerp(IDENTITY, 1 - decay);
    this.group.position.copy(_p).add(this.offPos);
    this.group.quaternion.copy(this.offQuat).multiply(_q);
    this.group.scale.set(1, 1, 1);
    this.group.updateMatrixWorld(true);

    // --- Ride motion from the saddle ---
    this.updateRide(dt, sad, pose.mounted && sad !== null, snapped);

    // --- Pose the skeleton ---
    const ctx = this.ctx;
    ctx.mountW = this.mountW;
    ctx.anchor = this.group.matrixWorld;
    ctx.snapped = snapped;
    ctx.ridePitch = this.ridePitch;
    // Wyvern has already updated this frame. Resolve its current tack, including look rebuilds,
    // into the current rider anchor rather than storing a stale saddle-relative offset.
    this.anchorInverse.copy(ctx.anchor).invert();
    for (let i = 0; i < 2; i++) {
      const hold = sad ? this.opts.socket?.(i === 0 ? 'stirrupL' : 'stirrupR', this.stirrupPoints[i]) : null;
      this.stirrups[i] = hold ? this.stirrupPoints[i].copy(hold).applyMatrix4(this.anchorInverse) : null;
    }
    ctx.stirrups = this.stirrups;
    this.animator.update(dt, pose, ctx);

    // --- Cloth ---
    const bones = this.model.rig.bones;
    bones[B.hips].getWorldPosition(this.origin);
    this.updateColliders(sad);
    if (this.clothFresh || snapped) {
      this.cloth.reset(bones, this.model.rig.bindPos, this.origin);
      this.frameVel.copy(pose.velocity);
      this.clothFresh = false;
      this.dv.set(0, 0, 0);
    } else {
      this.dv.subVectors(pose.velocity, this.frameVel);
      if (this.dv.length() > 15) this.dv.setLength(15);
      this.frameVel.add(this.dv);
    }
    this.cloth.update(dt, bones, this.origin, this.dv, pose.airflow, this.time);
    this.lastAction = action;
  }

  /** +1 if the saddle is to the rider's left. */
  private sideOf(sad: Object3D, pose: RiderPose): number {
    sad.getWorldPosition(_v);
    _v.sub(pose.position);
    // Rider's left = (cos yaw, 0, −sin yaw).
    return _v.x * Math.cos(pose.yaw) - _v.z * Math.sin(pose.yaw);
  }

  /** Which side the rider hops off to: away from the saddle toward pose.position's travel. */
  private dismountSideOf(sad: Object3D, pose: RiderPose): number {
    sad.updateWorldMatrix(true, false);
    _m.copy(sad.matrixWorld).invert();
    _v.copy(pose.position).applyMatrix4(_m);
    return _v.x >= 0 ? 1 : -1;
  }

  private updateRide(dt: number, sad: Object3D | null, mounted: boolean, snapped: boolean): void {
    if (!mounted || !sad || dt <= 0) {
      this.haveSaddlePos = false;
      this.rideOffset.multiplyScalar(Math.exp(-6 * dt));
      this.ridePitch *= Math.exp(-6 * dt);
      return;
    }
    sad.getWorldPosition(_v);
    if (!this.haveSaddlePos || snapped || _v.distanceTo(this.saddlePos) > 8) {
      this.saddlePos.copy(_v);
      this.saddleVel.set(0, 0, 0);
      this.saddleAcc.set(0, 0, 0);
      this.haveSaddlePos = true;
      return;
    }
    const vel = _v2.subVectors(_v, this.saddlePos).divideScalar(dt);
    this.saddlePos.copy(_v);
    // Smooth the velocity, then differentiate for acceleration.
    const prev = _s.copy(this.saddleVel);
    this.saddleVel.lerp(vel, 1 - Math.exp(-25 * dt));
    const acc = prev.subVectors(this.saddleVel, prev).divideScalar(dt);
    this.saddleAcc.lerp(acc, 1 - Math.exp(-20 * dt));
    // Into the saddle's frame.
    sad.getWorldQuaternion(_q).invert();
    const aL = _v.copy(this.saddleAcc).applyQuaternion(_q);
    // Inertia: the body lags the seat. Touchdowns add a jolt.
    const target = _v2.set(-aL.x * 0.0025, -aL.y * 0.0035 - this.jolt * 0.12, -aL.z * 0.003);
    target.clampLength(0, 0.09);
    const w = 13;
    const z = 0.42;
    this.rideVel.addScaledVector(_s.subVectors(target, this.rideOffset), w * w * dt).multiplyScalar(Math.exp(-2 * z * w * dt));
    this.rideOffset.addScaledVector(this.rideVel, dt);
    this.rideOffset.clampLength(0, 0.12);
    const pitchTarget = Math.max(-0.3, Math.min(0.3, -aL.z * 0.012)) + this.jolt * 0.25;
    this.ridePitchVel += (pitchTarget - this.ridePitch) * w * w * dt;
    this.ridePitchVel *= Math.exp(-2 * z * w * dt);
    this.ridePitch += this.ridePitchVel * dt;
    this.jolt = Math.max(0, this.jolt - dt * 4);
  }

  private updateColliders(sad: Object3D | null): void {
    const bones = this.model.rig.bones;
    const bp = this.model.rig.bindPos;
    const o = this.origin;
    for (const def of this.colliderDefs) {
      const c = this.capsules[def.name];
      const m = bones[def.bone].matrixWorld;
      const base = bp[def.bone];
      _v.subVectors(def.a, base).applyMatrix4(m).sub(o);
      c.ax = _v.x;
      c.ay = _v.y;
      c.az = _v.z;
      _v.subVectors(def.b, base).applyMatrix4(m).sub(o);
      c.bx = _v.x;
      c.by = _v.y;
      c.bz = _v.z;
    }
    // The wyvern's back under the saddle, only while (nearly) seated: the barrel when the saddle
    // describes it (a cape drapes over the real back), else a capsule under the grip width.
    const mc = this.capsules.mount;
    if (sad && this.anchorW > 0.5) {
      const fl = this.ctx.flank;
      const r = fl ? Math.min(fl.rx, -fl.cy - 0.08) : this.ctx.halfWidth;
      const cy = fl ? fl.cy : -0.12 - r;
      const m = sad.matrixWorld;
      _v.set(0, cy, 0.9).applyMatrix4(m).sub(o);
      mc.ax = _v.x;
      mc.ay = _v.y;
      mc.az = _v.z;
      _v.set(0, cy + 0.02, -3.2).applyMatrix4(m).sub(o);
      mc.bx = _v.x;
      mc.by = _v.y;
      mc.bz = _v.z;
      mc.r = r;
    } else {
      mc.ay = mc.by = -1e4;
      mc.r = 0.01;
    }
  }

  dispose(): void {
    for (const u of this.unsub) u();
    this.unsub.length = 0;
    this.cloth.dispose();
    this.group.removeFromParent();
    this.model.geometry.dispose();
    this.model.rig.skeleton.dispose();
  }
}

const IDENTITY = new Quaternion();
