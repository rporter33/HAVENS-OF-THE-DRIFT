// The white dragon's driver at rest (gate G12b): its own, with no flight model and no player pose.
// It holds render 08's resting pose (pose.ts) and lays the idle life over it:
//   breathing   the rib cage swells sideways on the breath bone, the back and wings lift a little
//   blinking    unhurried outer-lid blinks, now and then a double, at times fixed by a seed
//   looking     the head follows a target (the player or the camera) inside a cone, the turn shared
//               down the neck, on a slow critically damped spring; outside the cone it looks ahead
//   whiskers    verlet strands hanging from the lip (whiskers.ts)
//   wings       the folded wings ride the breath and now and then lift and settle again
//   tail        a slow wave travels down it along the platform, and now and then the end flicks,
//               as a resting cat's does
//
// Frame-rate independent, as the wyvern's tail (wyvern/anim/tail.ts): the look spring and the
// whiskers step at a fixed 120 Hz from an accumulator, the target interpolated to each step's own
// time, and are drawn between their last two steps at the frame's time (a constant one-step lag).
// Everything else is a function of that same drawn time, and the timed events (blinks, wing
// settles) are laid out ahead by a seeded hash rather than rolled per frame. 30, 60, 144 Hz, steady
// or jittery, show the same motion.
//
// All offsets are rotations about the dragon's own axes at a joint, so the turn of a joint carries
// everything beyond it (the neck's yaw turns the head; the tail's yaw keeps it on the platform).

import { Quaternion, Vector3 } from 'three';
import { DEG, TAU, clamp, smoothstep } from '../../core/math';
import { Spring, noise1 } from '../wyvern/ik';
import { dragonRig, type DragonRigDef } from './rig';
import { bindPose, restingPose, type DragonModelPose, type DragonPose } from './pose';
import type { DragonStrand } from './parts';
import { WhiskerStrands } from './whiskers';

/** The idle's tuning. Angles in radians, rates in Hz, times in seconds. */
export const IDLE = {
  /** A large animal at rest breathes slowly: about eight breaths a minute. */
  breathRate: 0.13,
  /** The breath bone's swell (fraction), and how much the back rises with it (m). */
  breathAmp: 0.035,
  breathLift: 0.012,
  look: {
    /** The cone: how far the head turns to either side, up and down from its rest gaze. */
    yawMax: 55 * DEG,
    pitchUp: 16 * DEG,
    pitchDown: 22 * DEG,
    /** Past the cone the head gives up and looks ahead again, fully by the second angle. */
    fade: [95 * DEG, 135 * DEG] as const,
    /** The rest gaze's elevation (a little below level). */
    restElevation: -6 * DEG,
    /** The spring (rad/s): an elder turns its head unhurriedly. */
    omega: 1.8,
    /** The turn shared down the neck (neck0 .. neck5, then the head); each sums to 1. */
    yawShare: [0.05, 0.07, 0.1, 0.12, 0.14, 0.16, 0.36],
    pitchShare: [0.04, 0.05, 0.07, 0.1, 0.14, 0.2, 0.4],
    /** With no target the gaze wanders this far, slowly. */
    wander: [14 * DEG, 4 * DEG] as const,
  },
  blink: { first: 2.2, min: 3.5, span: 4.5, close: 0.07, hold: 0.06, open: 0.13, double: 0.15, doubleGap: 0.36 },
  wing: {
    /** Settles: the first, then every min .. min + span seconds. */
    first: 6,
    min: 9,
    span: 8,
    /** How far a settle lifts the wing (about the body's long axis) and opens the fingers. */
    lift: 5 * DEG,
    open: 4 * DEG,
    /** The wings' rise with each breath. */
    breath: 0.6 * DEG,
  },
  tail: {
    /**
     * A slow wave along the platform, base to tip (Robert, 2026-10-19: "the tail should also be
     * moving a bit more"): the yaw each joint swings (growing toward the tip), the tip's lift, the
     * wave's rate (Hz) and its lag per joint (rad), so the swing travels down the tail.
     */
    yaw: [0, 0.6, 1.2, 2, 3.2, 4.6, 6.2, 8, 10, 12].map((d) => d * DEG),
    lift: [0, 0, 0, 0, 0, 0.4, 1, 2, 3.4, 5].map((d) => d * DEG),
    rate: 0.2,
    lag: 0.45,
    /** Now and then the end flicks, as a resting cat's does: the first, then every min .. min + span s. */
    flick: { first: 4.5, min: 7, span: 6, yaw: [0, 0, 0, 0, 0, 1.5, 3.5, 6, 9.5, 14].map((d) => d * DEG), period: 1.3, decay: 0.9 },
  },
};

/** The fixed step (s; the physics rate), and the most steps one frame takes (0.1 s). */
const SIM_RATE = 120;
const H = 1 / SIM_RATE;
const MAX_STEPS = 12;

export interface DragonIdleOptions {
  /** Seeds the blinks and wing settles (a stored number, never random at runtime). */
  seed?: number;
  /** The whiskers' strands (parts.ts), or none. */
  strands?: DragonStrand[] | null;
  /** Cued blinks at these times; any cue holds the natural ones off. */
  blinks?: number[];
  /** Hold the idle still: the bare pose, whiskers hanging at rest (pose captures). */
  still?: boolean;
  /** The bind pose instead of the resting one (standing, wings spread; implies still). */
  bind?: boolean;
}

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const DOWN = new Vector3(0, -1, 0);

const _q = new Quaternion();
const _q2 = new Quaternion();
const _qi = new Quaternion();
const _v = new Vector3();
const _axis = new Vector3();
const _tgt = new Vector3();

/** A seeded hash of an integer to [0, 1). */
function hash(k: number, seed: number): number {
  const s = Math.sin(k * 12.9898 + seed * 78.233 + 0.5) * 43758.5453;
  return s - Math.floor(s);
}

/** A timed event stream: starts laid out ahead by the seeded hash (or given as cues). */
class Events {
  private k = 0;
  private next: number;
  last = -1e9;
  constructor(
    private readonly gap: (k: number) => number,
    first: number,
    private readonly cues: number[] | null,
  ) {
    this.next = cues ? (cues.length ? cues[0] : Infinity) : first;
  }
  /** Advance to time t (monotonic): the latest start at or before t is `last`. */
  advance(t: number): void {
    while (t >= this.next) {
      this.last = this.next;
      this.k++;
      this.next = this.cues ? (this.k < this.cues.length ? this.cues[this.k] : Infinity) : this.next + this.gap(this.k);
    }
  }
  get index(): number {
    return this.k;
  }
}

export class DragonIdle {
  readonly rig: DragonRigDef;
  readonly rest: DragonPose;
  /** The drawn pose: local rotations and the root's position (dragon frame). */
  readonly pose: DragonPose;
  /** The drawn pose's model transforms (dragon frame). */
  readonly model: DragonModelPose;
  /** The breath bone's scale. */
  readonly breathScale = new Vector3(1, 1, 1);
  /** Outer lids, 0 open .. 1 shut. */
  blink = 0;
  /** The whiskers, and where to draw them between their last two steps. */
  readonly whiskers: WhiskerStrands | null;
  whiskerBlend = 1;
  /** The frame's time, and the time the pose is drawn at (one step behind). */
  time = 0;
  drawnTime = -H;
  /** The look's drawn yaw and pitch (rad, from the rest gaze). */
  lookYaw = 0;
  lookPitch = 0;

  private readonly seed: number;
  private readonly still: boolean;
  private acc = 0;
  private stepT = 0;
  private readonly yaw: Spring;
  private readonly pitch: Spring;
  private yawA = 0;
  private yawB = 0;
  private pitchA = 0;
  private pitchB = 0;
  private readonly targetPrev = new Vector3();
  private readonly targetCur = new Vector3();
  private hasTarget = false;
  private hadTarget = false;
  private readonly blinks: Events;
  private readonly settles: Events;
  private readonly flicks: Events;
  /** The rest eye point (dragon frame), where the look is measured from. */
  private readonly eye = new Vector3();
  /** Scratch: per-bone offsets (model frame) and a step's own model pose. */
  private readonly off: Quaternion[];
  private readonly offSet: Uint8Array;
  private readonly stepModel: DragonModelPose;
  private readonly stepPose: DragonPose;
  private readonly headBind: Vector3;

  constructor(rig: DragonRigDef = dragonRig(), opts: DragonIdleOptions = {}) {
    this.rig = rig;
    this.seed = opts.seed ?? 1;
    this.still = !!opts.still || !!opts.bind;
    this.rest = opts.bind ? bindPose(rig) : restingPose(rig);
    const n = rig.bones.length;
    const mkPose = (): DragonPose => ({ rootPos: this.rest.rootPos.clone(), local: this.rest.local.map((q) => q.clone()) });
    const mkModel = (): DragonModelPose => ({ p: rig.bones.map(() => new Vector3()), q: rig.bones.map(() => new Quaternion()) });
    this.pose = mkPose();
    this.stepPose = mkPose();
    this.model = mkModel();
    this.stepModel = mkModel();
    this.off = rig.bones.map(() => new Quaternion());
    this.offSet = new Uint8Array(n);
    this.yaw = new Spring(IDLE.look.omega);
    this.pitch = new Spring(IDLE.look.omega);
    const B = IDLE.blink;
    const W = IDLE.wing;
    this.blinks = new Events((k) => (hash(k, this.seed) > 1 - B.double ? B.doubleGap : B.min + B.span * hash(k + 101, this.seed)), B.first, opts.blinks ? [...opts.blinks].sort((a, b) => a - b) : null);
    this.settles = new Events((k) => W.min + W.span * hash(k + 503, this.seed), W.first, null);
    const TF = IDLE.tail.flick;
    this.flicks = new Events((k) => TF.min + TF.span * hash(k + 907, this.seed), TF.first, null);
    this.headBind = rig.bones[rig.idx.head].pos.clone();
    // Rest eye: the eye point carried by the resting head.
    this.compose(0, 0, 0, this.stepPose, this.stepModel, false);
    const hi = rig.idx.head;
    this.eye.copy(rig.eye).sub(this.headBind).applyQuaternion(this.stepModel.q[hi]).add(this.stepModel.p[hi]);
    this.whiskers = opts.strands && opts.strands.length ? new WhiskerStrands(opts.strands) : null;
    this.whiskers?.reset(this.headBind, this.stepModel.p[hi], this.stepModel.q[hi]);
    this.compose(this.drawnTime, 0, 0, this.pose, this.model, true);
    // Let the whiskers fall and settle before the first frame is drawn.
    if (this.whiskers) for (let i = 0; i < 4 * SIM_RATE; i++) this.whiskers.step(H, -4 + i * H, this.headBind, this.stepModel.p[hi], this.stepModel.q[hi], DOWN);
  }

  /** The rest eye point (dragon frame). */
  get eyePoint(): Vector3 {
    return this.eye;
  }

  /**
   * Advance by dt seconds of frame time. `target` (dragon frame) is what the head follows: the player
   * or the camera; null lets the gaze wander.
   */
  update(dt: number, target: Vector3 | null): void {
    if (!(dt >= 0)) dt = 0;
    dt = Math.min(dt, MAX_STEPS * H);
    this.targetPrev.copy(this.targetCur);
    this.hadTarget = this.hasTarget;
    if (target) this.targetCur.copy(target);
    this.hasTarget = !!target;
    if (this.hasTarget && !this.hadTarget) this.targetPrev.copy(this.targetCur);
    const t0 = this.time;
    this.time += dt;
    this.acc += dt;
    const hi = this.rig.idx.head;
    let steps = 0;
    while (this.acc >= H && steps < MAX_STEPS) {
      this.stepT += H;
      this.acc -= H;
      steps++;
      // The target at this step's own time within the frame.
      const f = dt > 0 ? clamp((this.stepT - t0) / dt, 0, 1) : 1;
      const [ty, tp] = this.lookAngles(f);
      this.yawA = this.yawB;
      this.pitchA = this.pitchB;
      this.yawB = this.yaw.step(ty, H);
      this.pitchB = this.pitch.step(tp, H);
      if (this.whiskers) {
        this.compose(this.stepT - H, this.yawB, this.pitchB, this.stepPose, this.stepModel, false);
        this.whiskers.step(H, this.stepT, this.headBind, this.stepModel.p[hi], this.stepModel.q[hi], DOWN);
      }
    }
    if (steps === MAX_STEPS) this.acc = Math.min(this.acc, H * 0.999);
    const blend = this.acc / H;
    this.whiskerBlend = blend;
    this.drawnTime = this.stepT - H + blend * H;
    this.lookYaw = this.yawA + (this.yawB - this.yawA) * blend;
    this.lookPitch = this.pitchA + (this.pitchB - this.pitchA) * blend;
    this.compose(this.drawnTime, this.lookYaw, this.lookPitch, this.pose, this.model, true);
  }

  /** The look's target angles (yaw, pitch from the rest gaze) at blend f of this frame. */
  private lookAngles(f: number): [number, number] {
    const L = IDLE.look;
    if (this.still) return [0, 0];
    if (!this.hasTarget) {
      const t = this.stepT;
      return [L.wander[0] * noise1(t * 0.07, 31), L.wander[1] * noise1(t * 0.05, 37)];
    }
    _tgt.lerpVectors(this.targetPrev, this.targetCur, f).sub(this.eye);
    const yaw = Math.atan2(_tgt.x, _tgt.z);
    const elev = Math.atan2(_tgt.y, Math.hypot(_tgt.x, _tgt.z));
    // Outside the cone the head looks ahead again: fully past the fade's far edge.
    const w = 1 - smoothstep(L.fade[0], L.fade[1], Math.abs(yaw));
    return [clamp(yaw, -L.yawMax, L.yawMax) * w, clamp(elev - L.restElevation, -L.pitchDown, L.pitchUp) * w];
  }

  /** The pose at time t with the look at (yaw, pitch): locals, root and FK into `pose` and `model`. */
  private compose(t: number, yaw: number, pitch: number, pose: DragonPose, model: DragonModelPose, outputs: boolean): void {
    const rig = this.rig;
    const { idx } = rig;
    const live = !this.still;
    const breath = live ? Math.sin(TAU * IDLE.breathRate * t) : 0;
    this.offSet.fill(0);
    const set = (i: number, q: Quaternion) => {
      if (this.offSet[i]) this.off[i].premultiply(q);
      else this.off[i].copy(q);
      this.offSet[i] = 1;
    };
    // The look, shared down the neck: a yaw about the dragon's up at each joint, then a pitch about
    // its side turned by the yaw so far. A breath nods the head a little.
    const L = IDLE.look;
    const chain = [...idx.neck, idx.head];
    let yawSoFar = 0;
    for (let k = 0; k < chain.length; k++) {
      const y = yaw * L.yawShare[k];
      yawSoFar += y;
      _q.setFromAxisAngle(Y, y);
      _axis.copy(X).applyAxisAngle(Y, yawSoFar);
      const p = -(pitch * L.pitchShare[k]) - (k >= 4 ? breath * 0.15 * DEG : 0);
      _q2.setFromAxisAngle(_axis, p);
      set(chain[k], _q2.multiply(_q));
    }
    // Wings: the breath and the settles lift each about the body's long axis at the root and open
    // the fingers a little.
    const W = IDLE.wing;
    let settleL = 0;
    let settleR = 0;
    if (live) {
      this.settles.advance(t);
      const tau = t - this.settles.last;
      const s = tau < 0.6 ? smoothstep(0, 0.6, tau) : Math.exp(-(tau - 0.6) * 1.8) * Math.cos((tau - 0.6) * 5.2);
      const which = this.settles.index % 3;
      settleL = which !== 2 ? s : 0;
      settleR = which !== 1 ? s : 0;
    }
    for (let side = 0; side < 2; side++) {
      const sgn = side === 0 ? 1 : -1;
      const sv = side === 0 ? settleL : settleR;
      const w = idx.wings[side];
      _q.setFromAxisAngle(Z, sgn * (W.lift * sv + W.breath * breath));
      set(w.humerus, _q);
      if (sv !== 0) {
        // The fingers open about the wrist's up.
        _q.setFromAxisAngle(Y, -sgn * W.open * sv);
        for (const [a] of w.fingers) set(a, _q);
      }
    }
    // The tail: a slow wave travelling down it along the platform, the end lifting a little, and
    // now and then a flick of the end.
    if (live) {
      const T = IDLE.tail;
      const F = T.flick;
      this.flicks.advance(t);
      const side = this.flicks.index % 2 === 0 ? 1 : -1;
      idx.tail.forEach((b, i) => {
        if (T.yaw[i] === 0 && T.lift[i] === 0 && F.yaw[i] === 0) return;
        const ti = t - (i * T.lag) / (TAU * T.rate);
        const sway = 0.65 * noise1(ti * T.rate, 41) + 0.35 * Math.sin(ti * T.rate * TAU);
        const lift = 0.5 + 0.5 * noise1(ti * T.rate * 0.7, 43);
        // The flick reaches each joint a little later than the one before it.
        const tau = t - this.flicks.last - i * 0.05;
        const flick = tau > 0 ? Math.sin((TAU * tau) / F.period) * Math.exp(-tau / F.decay) : 0;
        _q.setFromAxisAngle(Y, T.yaw[i] * sway + side * F.yaw[i] * flick);
        _q2.setFromAxisAngle(X, -T.lift[i] * lift);
        set(b, _q.multiply(_q2));
      });
    }
    // Forward kinematics with the offsets at each joint: M_i = O_i · M_parent · L_i.
    const n = rig.bones.length;
    pose.rootPos.copy(this.rest.rootPos);
    pose.rootPos.y += IDLE.breathLift * breath;
    for (let i = 0; i < n; i++) {
      const b = rig.bones[i];
      const Lq = this.rest.local[i];
      if (b.parent < 0) {
        model.p[i].copy(pose.rootPos);
        model.q[i].copy(Lq);
        if (this.offSet[i]) model.q[i].premultiply(this.off[i]);
        pose.local[i].copy(model.q[i]);
        continue;
      }
      const mp = model.q[b.parent];
      model.p[i].subVectors(b.pos, rig.bones[b.parent].pos).applyQuaternion(mp).add(model.p[b.parent]);
      model.q[i].multiplyQuaternions(mp, Lq);
      if (this.offSet[i]) {
        model.q[i].premultiply(this.off[i]);
        pose.local[i].copy(_qi.copy(mp).invert()).multiply(model.q[i]);
      } else pose.local[i].copy(Lq);
    }
    if (!outputs) return;
    const a = IDLE.breathAmp * breath;
    this.breathScale.set(1 + a * 1.2, 1 + a * 0.3, 1 + a * 0.08);
    this.blink = live ? this.blinkAt(t) : 0;
  }

  /** The lids at time t. */
  private blinkAt(t: number): number {
    const B = IDLE.blink;
    this.blinks.advance(t);
    const tau = t - this.blinks.last;
    if (tau < 0 || tau > B.close + B.hold + B.open) return 0;
    if (tau < B.close) return smoothstep(0, B.close, tau);
    if (tau < B.close + B.hold) return 1;
    return 1 - smoothstep(B.close + B.hold, B.close + B.hold + B.open, tau);
  }
}
