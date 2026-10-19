// Procedural animation: turns a WyvernPose (plus time) into local bone rotations every frame.
//
// This file is the core: the skeleton state (local rotations, forward kinematics), the signals
// every layer shares (air/ground blends, spread, flap, flare, stall, g-load, bank, exertion,
// landing time), and the orchestration. The layers live in anim/:
//
//   anim/flight.ts  the beat's heave and chest lift, the lean into a roll; wing flight poses (glide,
//                   a heavy flap cycle, tuck, flare, stall buffet, bank asymmetry where the outer
//                   wing works harder, fingers bending under the air load); legs in the air
//   anim/ground.ts  the gait (feet planted in world space), its bob, sway and roll, the landing
//                   settle and brace, the takeoff crouch; the folded stance (two-bone IK where the
//                   wing knuckles are front feet and the fingers fold back along the flank); leg IK
//   anim/life.ts    stretch-and-bask, blinks, the nictitating membrane, rib breathing, shuffle and
//                   yawn; the neck (a posture per state, trailing the heave on a spring) and the
//                   head (aimed at lookTarget, held level); jaw, fans, forked-tongue flicks
//   anim/tail.ts    a verlet chain in world space carried by the body: a counterweight
//
// Order each frame: core signals → ground gait → life signals → flight trunk → ground trunk →
// trunk bones (summed here) → neck and head → tail → wings (flight pose blended with the ground
// pose, then the stance IK) → legs → contacts → uniforms. Layers talk only through AnimFrame
// (anim/frame.ts), one writer per signal.
//
// Weight: amplitudes and spring rates scale with the breed's heft (its mass): the ironback
// heaves, lags and settles slowest, the skimmer quickest — but all of them are big animals.
// Everything is smoothed with springs. No allocations per frame (scalar math in the hot loops).

import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { TerrainQuery, WyvernCueKind, WyvernPose } from '../../core/types';
import { DEG, clamp, clamp01, damp } from '../../core/math';
import { BREEDS } from '../../flight/breeds';
import type { RigDef } from './rig';
import { Spring, mirrorQuat, noise1 } from './ik';
import { W, WING_CHANNELS, blendPose, type WingPose } from './wingPoses';
import type { WyvernUniforms } from './materials';
import type { Bone } from 'three';
import { AnimFrame, LEFT, UP } from './anim/frame';
import { FlightLayer } from './anim/flight';
import { GroundLayer, type GroundTerrain } from './anim/ground';
import type { Gait } from './gait';
import { LifeLayer, type IdleCue } from './anim/life';
import { TailLayer } from './anim/tail';
import { STAND_PELVIS_PITCH } from './anim/groundPoses';

export { STAND_PELVIS_PITCH, STAND_ROOT_PITCH } from './anim/groundPoses';

/** 0 (lightest breed) … 1 (heaviest), from the breed's mass. */
export function heftOf(mass: number): number {
  return clamp01((mass - 470) / 450);
}

/** One-shot behaviour cues (WyvernPose.cue or Wyvern.cue); see core/types.ts WyvernCueKind. */
export type WyvernCue = WyvernCueKind;

// Scratch (module-level: the animator never re-enters).
const _q = new Quaternion();
const _qi = new Quaternion();
const _v = new Vector3();
const _e = new Euler();

export class WyvernAnimator {
  readonly rig: RigDef;
  readonly n: number;
  readonly parent: number[];
  /** Bone offsets from their parents (bind). */
  readonly offset: Vector3[];
  /** Local rotations (output). */
  readonly local: Quaternion[];
  /** Model-space (body frame) rotations and positions after FK. */
  readonly modelQ: Quaternion[];
  readonly modelP: Vector3[];
  /** Root bone translation offset (body space). */
  readonly rootOffset = new Vector3();
  breathScale = 1;
  /** 0 (lightest breed) … 1 (heaviest). Scales amplitudes and spring rates. */
  readonly heft: number;
  /** The signals the layers share this frame. */
  readonly frame = new AnimFrame();
  /** The body's world transform this frame, its inverse, and world up in the body frame. */
  readonly posW = new Vector3();
  readonly qW = new Quaternion();
  readonly qWInv = new Quaternion();
  readonly upM = new Vector3();
  /** Ground height under the body (from the pose), the fallback for foot placement. */
  groundRef = 0;
  /**
   * The wing-fold helpers' transforms (left, right; body frame, affine): Wyvern composes each onto
   * its helper's rest hold (the blend of the inner panel's bones), so the folded membrane
   * contracts beside the arm. Identity unless the wings are folded on the ground.
   */
  readonly foldXform: [Matrix4, Matrix4] = [new Matrix4(), new Matrix4()];

  readonly flight: FlightLayer;
  readonly ground: GroundLayer;
  readonly life: LifeLayer;
  readonly tail: TailLayer;

  // Smoothed core signals
  private time = 0;
  private initialized = false;
  private readonly lastPos = new Vector3();
  private readonly lastQ = new Quaternion();
  private readonly lastVel = new Vector3();
  private airW = 1;
  private legAirW = 1;
  private spreadVis = 1;
  private gLoad = 1;
  private bank = 0;
  private prevAirborne = true;
  private prevVelY = 0;
  private contactId = 0;
  private contactReset = 0;
  private stallT = 0;
  private readonly spineYaw = new Spring(5);
  /** 0..1 how hard it has been working lately (flapping); decays while gliding or resting. */
  exertion = 0;
  /** Seconds since touchdown and how hard it was (0..1). */
  private landT = 99;
  private landImpact = 0;
  /** The last WyvernPose.cue id acted on. */
  private lastCueId = 0;

  // Wings
  private readonly wingFK: [WingPose, WingPose] = [new Float32Array(WING_CHANNELS), new Float32Array(WING_CHANNELS)];
  private readonly tmpPose = new Float32Array(WING_CHANNELS);
  /** Trunk Euler angles this frame: root, spine, chest, pelvis (x, y, z each). */
  private readonly trunkAng = new Float64Array(12);

  /**
   * `terrain`: ground under the feet (groundAt) and, for the player's own wyvern, the solids' distance
   * field (distance) so the folded wings keep off walls; ghosts and showcase stand-ins pass none.
   */
  constructor(rig: RigDef, terrain?: GroundTerrain) {
    this.rig = rig;
    this.heft = heftOf(BREEDS[rig.props.breed].mass);
    const B = rig.bones;
    this.n = B.length;
    this.parent = B.map((b) => b.parent);
    this.offset = B.map((b) => (b.parent >= 0 ? b.pos.clone().sub(B[b.parent].pos) : b.pos.clone()));
    this.local = B.map(() => new Quaternion());
    this.modelQ = B.map(() => new Quaternion());
    this.modelP = B.map((b) => b.pos.clone());
    for (let i = 0; i < this.n; i++) this.local[i].identity();
    const f = this.frame;
    f.sh = rig.props.standHeight;
    f.heft = this.heft;
    this.flight = new FlightLayer(this);
    this.ground = new GroundLayer(this, terrain);
    this.life = new LifeLayer(this);
    this.tail = new TailLayer(this);
  }

  /** Keep phases and smoothed state across a look rebuild (same breed). */
  copyStateFrom(o: WyvernAnimator): void {
    this.time = o.time;
    this.airW = o.airW;
    this.legAirW = o.legAirW;
    this.spreadVis = o.spreadVis;
    this.prevAirborne = o.prevAirborne;
    this.exertion = o.exertion;
    // A rebuilt look must not replay the last cue.
    this.lastCueId = o.lastCueId;
    this.life.copyStateFrom(o.life);
  }

  /**
   * Debug captures only (?view=wyvern blink= nict= tongue=): start an idle event on the next
   * update through its own timer, so it plays exactly like a natural one; or, with `event` null,
   * hold every natural idle event off for `hold` seconds so only cued ones play.
   */
  cueIdle(event: IdleCue | null, hold = 0): void {
    this.life.cueIdle(event, hold);
  }

  /** Play a one-shot behaviour now (see WyvernCue). */
  cue(kind: WyvernCue): void {
    // 'display' shows the wings through the stretch-and-bask for now (C10 gives it its own
    // display); 'present' is a no-op until C10.
    if (kind === 'display') this.life.startBask();
    else if (kind === 'greet') this.life.startGreet();
  }

  /** The ground gait (feet, phase, timing): the capture harness labels walk strips with it. */
  get gait(): Gait {
    return this.ground.gait;
  }

  /** How far the tongue is slid out (m, along the head). */
  get tongueExt(): number {
    return this.life.tongueExt;
  }

  /** Seconds the stretch-and-bask takes. */
  get baskDuration(): number {
    return this.life.baskDuration;
  }

  /** 0..1 how folded the wings are on the ground. */
  get fold(): number {
    return this.frame.fold;
  }

  /** Air load on each wing (left, right). */
  get wingLoad(): readonly number[] {
    return this.flight.wingLoad;
  }

  // --- Hierarchy helpers (the layers' API) ----------------------------------------------------

  /** Forward kinematics for one bone from its parent and local rotation. */
  fk(i: number): void {
    const p = this.parent[i];
    if (p < 0) {
      this.modelQ[i].copy(this.local[i]);
      this.modelP[i].copy(this.offset[i]).add(this.rootOffset);
      return;
    }
    this.modelQ[i].multiplyQuaternions(this.modelQ[p], this.local[i]);
    this.modelP[i].copy(this.offset[i]).applyQuaternion(this.modelQ[p]).add(this.modelP[p]);
  }

  /** A bone's pivot after its parent changed (refreshes its FK). */
  pivot(i: number): Vector3 {
    this.fk(i);
    return this.modelP[i];
  }

  /**
   * Blend weight for setModelBlend (set once, then pose several bones with it): the weight travels
   * in a field because a double passed into a call the JIT doesn't inline is boxed on the heap.
   */
  blend = 0.5;

  /** setModel at this.blend. */
  setModelBlend(i: number, q: Quaternion): void {
    const p = this.parent[i];
    _qi.copy(this.modelQ[p]).invert().multiply(q);
    const weight = this.blend;
    if (weight >= 1) this.local[i].copy(_qi);
    else if (weight > 0) this.local[i].slerp(_qi, weight);
    this.fk(i);
  }

  /** Set a bone's model-space rotation (local derived from the parent), with FK. */
  setModel(i: number, q: Quaternion, weight = 1): void {
    const p = this.parent[i];
    _qi.copy(this.modelQ[p]).invert().multiply(q);
    if (weight >= 1) this.local[i].copy(_qi);
    else if (weight > 0) this.local[i].slerp(_qi, weight);
    this.fk(i);
  }

  /**
   * Set a bone's local rotation from Euler angles (radians, YXZ order) read from `angles` at
   * `at`, `at + 1`, `at + 2` (x pitch, y yaw, z roll), with FK. The angles travel in an array, not
   * as arguments: a double passed into a call the JIT doesn't inline is boxed on the heap, and
   * this runs a dozen times a frame per wyvern.
   */
  setEulerAt(i: number, angles: Float64Array, at: number): void {
    _e.set(angles[at], angles[at + 1], angles[at + 2], 'YXZ');
    this.local[i].setFromEuler(_e);
    this.fk(i);
  }

  /** World → body frame (this frame's transform). */
  toModel(world: Vector3, out: Vector3): Vector3 {
    return out.copy(world).sub(this.posW).applyQuaternion(this.qWInv);
  }

  /** Body frame → world (this frame's transform). */
  toWorld(model: Vector3, out: Vector3): Vector3 {
    return out.copy(model).applyQuaternion(this.qW).add(this.posW);
  }

  // --- Main ------------------------------------------------------------------------------------

  update(dtIn: number, pose: WyvernPose, uniforms?: WyvernUniforms): void {
    const f = this.frame;
    // (Before signals() marks the animator initialized: a new animator, e.g. after a breed change,
    // takes the pose's current cue as already played.)
    if (pose.cue && pose.cue.id !== this.lastCueId) {
      this.lastCueId = pose.cue.id;
      if (this.initialized) this.cue(pose.cue.kind);
    }
    this.signals(dtIn, pose);
    const I = this.rig.idx;

    if (f.touchdown) this.ground.touchdown();
    this.landT += f.dt;
    f.landT = this.landT;
    this.life.lifeSignals();
    this.ground.gaitUpdate();

    // --- Trunk: the flight and ground terms, summed ------------------------------------------------
    this.flight.flightTrunk();
    this.ground.groundTrunk();
    const { sh, buffet, stretch, bask, breath, breathAmp, groundW } = f;
    // The stretch rises onto straightened legs; breathing barely lifts the body (the ribs swing
    // out sideways instead).
    // (Noise only while there is a buffet: a double passed to a call the JIT doesn't inline is
    // boxed on the heap.)
    const shake = buffet > 0;
    this.rootOffset.set(
      (shake ? buffet * 0.03 * sh * noise1(this.stallT * 9, 1) : 0) + f.gaitShift,
      f.heave + f.gaitBob + f.dipV + f.kneelDrop + f.groundDrop + breath * breathAmp * 0.025 * sh + (shake ? buffet * 0.04 * sh * noise1(this.stallT * 8, 2) : 0) + stretch * 0.04 * sh,
      0,
    );
    const turnBend = clamp(f.om.y * (f.airborne ? 0.16 : 0.3), -0.22, 0.22);
    const spineYaw = this.spineYaw.step(turnBend + f.gaitSway, f.dt);
    // Settle: the landing dip pitches the nose down a little and the body rocks back up.
    // Stretching and basking, the chest lifts (nose up).
    const rootPitch = groundW * this.ground.profile.standPitch + f.gaitPitch - f.dipPitch - stretch * 0.08 - bask * 0.035 + f.kneelPitch + f.groundPitch;
    const rootRoll = (buffet > 0 ? buffet * 0.05 * noise1(this.stallT * 7, 3) : 0) + f.gaitRoll + f.kneelRoll;
    const lean = f.lean;
    const e = this.trunkAng;
    e[0] = rootPitch;
    e[1] = 0;
    e[2] = rootRoll;
    e[3] = f.spineAir + f.crouchPitch - stretch * 0.03;
    e[4] = spineYaw * 0.6;
    e[5] = lean;
    e[6] = f.chestAir;
    e[7] = spineYaw * 0.5;
    e[8] = lean * 0.5 + f.turnLean + f.chestRoll;
    // The stretch lifts the tail root level with the back.
    // Kneeling, the hindquarters go down level while the chest dips nose-first.
    e[9] = f.pelvisAir + stretch * 0.05 + groundW * STAND_PELVIS_PITCH - f.kneelPitch;
    e[10] = -spineYaw * 0.55;
    e[11] = -lean * 0.6 + f.pelvisRoll;
    this.setEulerAt(I.root, e, 0);
    this.setEulerAt(I.spine, e, 3);
    this.setEulerAt(I.chest, e, 6);
    this.breathScale = 1 + breath * breathAmp;
    this.local[I.breath].identity();
    this.fk(I.breath);
    this.setEulerAt(I.pelvis, e, 9);

    // --- Neck, head, jaw, tongue; tail ------------------------------------------------------------
    this.life.neckHead();
    this.tail.updateTail();

    // --- Legs (before the wings: the folded arm keeps clear of the hind leg as posed) ---------------
    this.flight.flightLegWeights();
    this.ground.applyLegs();

    // --- Wings: the flight pose blended with the ground pose, then the stance IK ------------------
    for (let side = 0; side < 2; side++) {
      const wp = this.wingFK[side];
      this.flight.flightWingPose(side, wp);
      const groundFK = this.tmpPose;
      this.ground.groundWingPose(groundFK);
      blendPose(wp, groundFK, groundW, wp);
      this.applyWingFK(side, wp);
      this.ground.applyWingIK(side);
    }
    this.ground.foldHelpers();

    // --- Contacts -------------------------------------------------------------------------------
    this.ground.contacts();

    if (uniforms) {
      this.life.lifeUniforms(uniforms);
      this.flight.flightUniforms(uniforms);
    }

    this.prevAirborne = f.airborne;
    this.prevVelY = pose.velocity.y;
    this.lastPos.copy(pose.position);
    this.lastQ.copy(pose.orientation);
    this.lastVel.copy(pose.velocity);
    this.initialized = true;
  }

  /** The core signals: blends, spread, flap, flare, stall, g-load, bank, exertion, touchdown. */
  private signals(dtIn: number, pose: WyvernPose): void {
    const f = this.frame;
    const dt = clamp(dtIn, 0, 0.1);
    const sh = f.sh;
    const heft = this.heft;
    f.pose = pose;
    f.dt = dt;
    this.time += dt;
    f.time = this.time;
    this.posW.copy(pose.position);
    this.qW.copy(pose.orientation);
    this.qWInv.copy(pose.orientation).invert();
    this.upM.copy(UP).applyQuaternion(this.qWInv);

    const contact = pose.touchdown;
    const teleport = !this.initialized || this.lastPos.distanceToSquared(pose.position) > 40 * 40
      || (contact !== undefined && contact.reset !== this.contactReset);
    f.teleport = teleport;
    if (teleport) {
      this.lastPos.copy(pose.position);
      this.lastQ.copy(pose.orientation);
      this.lastVel.copy(pose.velocity);
      this.airW = pose.airborne ? 1 : 0;
      this.legAirW = this.airW;
      this.spreadVis = pose.wingSpread;
      this.prevAirborne = pose.airborne;
      this.tail.reset();
      this.ground.reset();
      this.life.reset();
      this.landT = 99;
      this.landImpact = 0;
    }

    // Body angular velocity: the physics value when given, else derived (ghost playback).
    const av = pose.angularVelocity;
    if (av.x * av.x + av.y * av.y + av.z * av.z > 1e-8) {
      _v.copy(av);
    } else if (dt > 1e-5 && !teleport) {
      _q.copy(this.lastQ).invert().multiply(pose.orientation);
      if (_q.w < 0) _q.set(-_q.x, -_q.y, -_q.z, -_q.w);
      const s = Math.sqrt(Math.max(0, 1 - _q.w * _q.w));
      const ang = 2 * Math.acos(clamp(_q.w, -1, 1));
      if (s > 1e-6) _v.set(_q.x / s, _q.y / s, _q.z / s).multiplyScalar(ang / dt);
      else _v.set(0, 0, 0);
    } else _v.set(0, 0, 0);
    const k = 1 - Math.exp(-10 * dt);
    f.om.lerp(_v, k);
    const om = f.om;

    // Linear acceleration (world) for inertial effects.
    const accel = f.accel.copy(pose.velocity).sub(this.lastVel).multiplyScalar(dt > 1e-5 ? 1 / dt : 0);
    const a2 = accel.x * accel.x + accel.y * accel.y + accel.z * accel.z;
    if (a2 > 2500) accel.multiplyScalar(50 / Math.sqrt(a2));

    // Air/ground blends.
    const airborne = pose.airborne;
    f.airborne = airborne;
    f.touchdown = !airborne && !teleport && (contact ? contact.id !== this.contactId : this.prevAirborne);
    if (contact) {
      this.contactId = contact.id;
      this.contactReset = contact.reset;
    }
    this.airW = damp(this.airW, airborne ? 1 : 0, airborne ? 6 : 12, dt);
    this.legAirW = damp(this.legAirW, airborne ? 1 : 0, airborne ? 7 : 22, dt);
    const airW = this.airW;
    f.airW = airW;
    f.groundW = 1 - airW;
    f.legAirW = this.legAirW;
    const spreadRate = airborne ? 12 : pose.wingSpread > this.spreadVis ? 9 : 3.2;
    this.spreadVis = damp(this.spreadVis, pose.wingSpread, spreadRate, dt);
    f.spreadVis = this.spreadVis;
    f.openAmt = clamp01((this.spreadVis - 0.22) / 0.78);
    const tuck = airborne ? clamp01((1 - this.spreadVis) / 0.72) : 0;
    f.tuck = tuck;
    const flap = clamp01(pose.flapStrength) * (1 - tuck * 0.85);
    f.flap = flap;
    f.phase = pose.flapPhase;
    f.flare = clamp01(pose.flare);
    const stall = clamp01(pose.stall);
    f.stall = stall;
    const fatigue = clamp01(pose.fatigue);
    f.fatigue = fatigue;
    const speed = pose.airspeed;
    f.speed = speed;
    const gTarget = airborne ? clamp(1 + (speed * -om.x) / 9.81 + (1 - Math.cos(this.bank)) * 0.3, -1, 6) : 1;
    this.gLoad = damp(this.gLoad, gTarget, 5, dt);
    f.gLoad = this.gLoad;
    _v.copy(LEFT).applyQuaternion(this.qW);
    this.bank = damp(this.bank, Math.asin(clamp(_v.y, -1, 1)), 8, dt);
    f.bank = this.bank;
    this.stallT += dt * (1 + stall * 2);
    f.stallT = this.stallT;
    f.buffet = stall * airW;
    if (pose.groundY !== null) this.groundRef = pose.groundY;
    else this.groundRef = pose.position.y - sh;
    f.height = pose.groundY !== null ? pose.position.y - pose.groundY : Infinity;
    f.takeoffCrouch = !airborne && pose.gait === 'takeoff';
    f.kneel = clamp01(pose.kneel ?? 0);

    // Exertion: builds while beating hard (a long climb), drains slowly while gliding and faster
    // at rest on the ground. Drives the labored breathing afterwards.
    if (flap > 0.05 && airborne) this.exertion += dt * flap * (0.07 + 0.03 * heft) * (1 - this.exertion);
    else this.exertion = Math.max(0, this.exertion - dt * (airborne ? 0.035 : 0.06));
    f.exertion = this.exertion;
    f.effort = Math.max(fatigue, this.exertion * 0.85);

    // Touchdown: how hard it came down (the ground layer plants the feet and kicks the settle).
    if (f.touchdown) {
      const sink = Math.max(0, contact ? contact.impact : -this.prevVelY);
      f.sink = sink;
      this.landT = 0;
      this.landImpact = contact ? clamp01(sink / 8) : Math.max(0.35, clamp01(sink / 8));
    }
    f.landImpact = this.landImpact;
  }

  /** Write the pose into the bones. */
  apply(bones: Bone[]): void {
    for (let i = 0; i < this.n; i++) bones[i].quaternion.copy(this.local[i]);
    const r = this.rig.idx.root;
    bones[r].position.copy(this.offset[r]).add(this.rootOffset);
    const br = bones[this.rig.idx.breath];
    // Rib breathing: the flanks swell sideways, the belly a little, hardly any lift.
    const b = this.breathScale - 1;
    br.scale.set(1 + b * 1.2, 1 + b * 0.3, 1 + b * 0.08);
    // The tongue slides out along the jaw (its bones are at rest otherwise).
    const t0 = this.rig.idx.tongue[0];
    bones[t0].position.copy(this.offset[t0]);
    bones[t0].position.z += this.life.tongueExt;
  }

  /** Model-space bone positions/rotations (after update), for tests and debugging. */
  boneModel(i: number, outP: Vector3, outQ?: Quaternion): Vector3 {
    if (outQ) outQ.copy(this.modelQ[i]);
    return outP.copy(this.modelP[i]);
  }

  /**
   * The four ground contacts (LH, RH, LF, RF; world) and how firmly each is down (1 planted … 0
   * lifted or airborne): for footstep FX and contact shadows. Returns how many were written.
   */
  footContacts(outPos: Vector3[], outW: { [i: number]: number }): number {
    return this.ground.footContacts(outPos, outW);
  }

  /** Where foot i will land, or stands (world; see Gait.landing). */
  footLanding(i: number, out: Vector3): Vector3 {
    return this.ground.gait.landing(i, out);
  }

  /** The standing root pitch (rad, − = nose up): the breed's GaitProfile.standPitch. */
  get standPitch(): number {
    return this.ground.profile.standPitch;
  }

  /** The body's heave from the wingbeat this frame (m, + up). */
  get heave(): number {
    return this.frame.heave;
  }

  // --- Wing FK ---------------------------------------------------------------------------------

  private applyWingFK(side: number, p: WingPose): void {
    const w = this.rig.idx.wings[side];
    this.wingJoint(side, w.humerus, p, W.humEl, W.humSw, W.humTw);
    this.wingJoint(side, w.forearm, p, W.foreEl, W.foreSw, W.foreTw);
    this.wingJoint(side, w.hand, p, W.handEl, W.handSw, W.handTw);
    this.wingJoint(side, w.claw, p, W.clawEl, W.clawSw, -1);
    for (let f = 0; f < 3; f++) {
      this.wingJoint(side, w.fingers[f][0], p, W.f0El + f * 3, W.f0Sw + f * 3, W.f0Tw + f * 3);
      this.wingJoint(side, w.fingers[f][1], p, W.f0bEl + f * 2, W.f0bSw + f * 2, -1);
    }
  }

  /**
   * One wing joint from the pose's channels (left convention, mirrored for the right wing). Takes
   * channel indices rather than angles: numbers passed into a call the JIT doesn't inline get
   * boxed, every joint, every frame.
   */
  private wingJoint(side: number, bone: number, p: WingPose, iEl: number, iSw: number, iTw: number): void {
    _e.set(iTw >= 0 ? p[iTw] : 0, p[iSw], p[iEl], 'ZYX');
    _q.setFromEuler(_e);
    if (side === 1) mirrorQuat(_q, _q);
    this.local[bone].copy(_q);
    this.fk(bone);
  }
}

