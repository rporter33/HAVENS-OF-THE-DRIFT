// Flight layer of the wyvern animator: what the wings and the beat do to the body in the air.
//
//   flightTrunk       heave (the downstroke lifts the chest and saddle, the recovery lets them
//                     sink), the chest pitching with the beat, the lean into a roll, the flare's
//                     pitch, the stick's leads (the head into a turn, the tail's rudder) and the
//                     per-frame wing prelude (the roll's initiation, turn asymmetry, air load)
//   flightWingPose    one wing's flight pose as joint channels: glide, tuck and flare blended,
//                     the heavy flap cycle (the outer wing of a turn takes the bigger stroke), g-load
//                     and turn adjustments, the roll-in (the inner wing flexes, the outer reaches),
//                     stall buffet, the fingers bending under the air load
//   flightLegWeights  legs tucked at speed, dangling when slow and swinging with the body's
//                     fore-aft acceleration, reaching for the ground on approach, pushing off
//   flightUniforms    trailing-edge flutter, ripple and the membrane billow per wing
//
// Outputs for other layers through AnimFrame: heave, chestLift, lean, spineAir/chestAir/pelvisAir,
// spreadAir, legTuck/legReach/legPush/legSwing, and the cross-stream leads lookLead and tailSteer
// (B3) and hover (0 until B7). Methods take no number arguments (see frame.ts).

import { Vector3 } from 'three';
import { DEG, TAU, clamp, clamp01, smoothstep } from '../../../core/math';
import { BREEDS } from '../../../flight/breeds';
import { FLIGHT_TUNING, deriveFlight } from '../../../flight/FlightModel';
import { SIDE_SIGN } from '../rig';
import { Bouncy, Spring, noise1 } from '../ik';
import {
  BACKWING_STYLES,
  FLAP_STYLES,
  HOVER_STYLES,
  FLARE,
  GLIDE,
  TUCK,
  W,
  WING_CHANNELS,
  adjustPose,
  blendPose,
  flapPoseAt,
  loadPose,
  strokeLoad,
  strokePlaneMean,
  wingAdjust,
  type FlapStyle,
  type WingPose,
} from '../wingPoses';
import type { WyvernUniforms } from '../materials';
import type { WyvernAnimator } from '../animator';
import { FWD, type AnimFrame } from './frame';
import { FOLDED } from './groundPoses';

const _v = new Vector3();

/**
 * The roll stick's follower (a critically damped spring, rad/s): the stick's lead over it, the
 * roll's initiation, holds for a moment and dies away into the sustained turn over 0.4 s.
 */
const ROLL_OMEGA = 6;
/**
 * The inner wing's flex at full roll stick: elbow forward, wrist back (degrees; the recovery
 * stroke's M-fold is 34/46 at its deepest, which shortens the span by a tenth), and the wing
 * finger's outer phalanx curled back. Since A13 the span lives in that spar (the arm, hand and
 * finger bundle are sized to the body), so the elbow and wrist alone shorten the wing less than
 * they did (the harrier's inner wing 0.86 of the outer's, not 0.84); curling the spar 12° makes
 * the flex a sixth again (0.83) on every breed.
 */
const INNER_FORE = 42;
const INNER_HAND = 58;
const INNER_TIP = 12;
/**
 * The living glide (B4): per wing, two octaves of smooth value noise (GLIDE_HZ) on the shoulder's
 * elevation and twist, the span trim at the wrist and the tips (degrees at full weight), and every
 * RESETTLE_MIN..MAX s a resettle of both wings (the shoulders lift and settle back).
 */
const GLIDE_HZ0 = 0.35;
const GLIDE_HZ1 = 0.9;
const GLIDE_AMP = new Float64Array([1.5, 1.2, 2.5, 3]);
/** Value noise spends most of its time inside half its range: ×1.6 makes those its typical swing. */
const GLIDE_GAIN = 1.6;
const RESETTLE_FIRST = 2.5;
const RESETTLE_MIN = 5;
const RESETTLE_MAX = 9;
const RESETTLE_UP = 0.5;
const RESETTLE_DOWN = 0.8;
const RESETTLE_EL = 4;
/** Rising air at a wingtip loads that wing (load per m/s): a thermal's edge lifts one tip first. */
const GUST_LOAD = 0.12;
/**
 * The launch (B6): over the first LAUNCH_UNFOLD s after the wrists leave the ground (frame.launchT,
 * C6) the wings sweep out of the fold into the first downstroke, and the first LAUNCH_BEATS beats
 * are labored (the deepest strokes, the tips low past the ground).
 */
const LAUNCH_UNFOLD = 0.12;
const LAUNCH_BEATS = 2;
/**
 * The pull-out (B7): the hands and fingers stay swept back after a dive while the arms open,
 * (HAND_TUCK × how fast and how hard it is pulling), and follow the arms HAND_LAG s behind.
 */
const HAND_TUCK = 0.6;
const HAND_LAG = 0.12;
/**
 * Hover (B7, B7b): full below HOVER_FULL × the breed's stall speed, gone by HOVER_NONE ×. Flare
 * and flap held, the flight model hangs at 0.9–1.25 × stall speed (1.1 × on average, every
 * breed), so the whole beat stays a hover. Braking with the flaps from cruise (1.6 × and up)
 * never reads as one, and without the flare there is no hover at all.
 */
const HOVER_FULL = 1.2;
const HOVER_NONE = 1.55;
/** First channel of the hand group (hand, fingers, claw); before it, the humerus and forearm. */
const HAND_CH = W.handEl;

/** The tail's rudder at full yaw (rad per segment), and its spring (overshoots about 0.25 s). */
const RUDDER = 0.12;
const RUDDER_OMEGA = 12;
const RUDDER_ZETA = 0.45;
/**
 * A ghost's rudder is read from its yaw acceleration (controls). The flight model's rudder changes
 * the yaw rate by at most authorityMax × the breed's yawAuthority per second, so a change faster
 * than BUMP_ACCEL × the breed's cannot be the stick (a knock off a wall, a jump between a
 * recording's samples, a kinematic test rig) and reads as no rudder, as does the settling of the
 * animator's smoothed rate after it (0.1 s): for BUMP_HOLD s after the last such change.
 */
const BUMP_ACCEL = 2 * FLIGHT_TUNING.authorityMax;
const BUMP_HOLD = 0.4;
/**
 * The bond's anticipatory lean at full strength (WyvernPose.anticipate ±1): the spine's roll into
 * the coming bank (rad), and the head's lead into it (as lookLead, rad).
 */
const ANTICIPATE_LEAN = 0.12;
const ANTICIPATE_LOOK = 0.4;

export class FlightLayer {
  private readonly a: WyvernAnimator;
  private readonly f: AnimFrame;
  /** The breed's wingbeat: stroke shape, fold, tip flex and downstroke fraction. */
  private readonly style: FlapStyle;
  /** Where the stroke plane sits on average (rad of shoulder sweep, − = forward). */
  private readonly planeMean: number;
  /** wingPoses.bodyClock's constants for this style: a / 2π, D / 2 and sin(πD). */
  private readonly clockK: number;
  private readonly clockC: number;
  private readonly clockS: number;
  /**
   * Air load on each wing (left, right), smoothed: bends the fingers, billows the membrane. A soft
   * spring (18 rad/s): the sail fills just after the arm starts to drive.
   */
  private readonly loadSpring: [Spring, Spring] = [new Spring(18), new Spring(18)];
  readonly wingLoad = [0, 0];
  private readonly flapSide = new Float32Array(WING_CHANNELS);
  /** The breed's backwing stroke (B5) and the scratch pose it is sampled into. */
  private readonly backStyle: FlapStyle;
  private readonly flapBack = new Float32Array(WING_CHANNELS);
  /** The landing flare this frame (0..1, the last metres of an approach) and its backwing weight. */
  private landFlare = 0;
  private backW = 0;
  /** The breed's hover stroke (B7), its scratch pose, and this frame's hover weight. */
  private readonly hoverStyle: FlapStyle;
  private readonly flapHover = new Float32Array(WING_CHANNELS);
  private hoverW = 0;
  /** The hands' own tuck (the pull-out keeps them swept back, a moment behind the arms). */
  private handTuck = 0;
  private readonly tuckPose = new Float32Array(WING_CHANNELS);
  /** adjustPose's inputs for the wing being posed (a record: no doubles through call arguments). */
  private readonly adj = wingAdjust();
  private readonly legSwing = new Bouncy(5, 0.35);
  /** The breed's top roll rate (rad/s) and yaw authority (rad/s²): a ghost's stick is estimated against them. */
  private readonly maxRollRate: number;
  private readonly yawAuthority: number;
  /** The airspeeds (m/s) the hover is full below and gone above (HOVER_FULL/NONE × stall speed). */
  private readonly hoverFull: number;
  private readonly hoverNone: number;
  /**
   * The stick this frame (pose.control, or estimated from the body's motion for a ghost) and the
   * roll stick's slow follower (ROLL_OMEGA): stick − follower is the roll's initiation, which
   * dies away under a held stick and swings the other way on the roll-out.
   */
  private ctlRoll = 0;
  private ctlYaw = 0;
  /** Seconds since a ghost's yaw rate last changed faster than its rudder could (BUMP_ACCEL). */
  private bumpT = 99;
  private readonly rollSlow = new Spring(ROLL_OMEGA);
  /** The previous frame's smoothed body rates (for a ghost's angular acceleration). */
  private readonly prevOm = new Vector3();
  /** The tail's rudder: follows the stick and overshoots briefly on the roll-out. */
  private readonly rudder = new Bouncy(RUDDER_OMEGA, RUDDER_ZETA);
  /** The living glide this frame: [side × 4] humEl, humTw, handSw, tips (radians, weighted). */
  private readonly glideLife = new Float64Array(8);
  /**
   * The resettle: seconds of gliding so far (its own clock, which only runs in a glide), when the
   * next one starts on it, how many so far, and this frame's lift (rad).
   */
  private glideT = 0;
  private resettleAt = RESETTLE_FIRST;
  private resettleN = 0;
  private resettle = 0;
  // This frame's wing prelude (flightTrunk → flightWingPose).
  private asymBase = 0;
  private rollInit = 0;
  private glideLoad = 0;
  private beatLoad = 0;
  /** The beat as the wing is posed (flapPoseAt's input): the phase, and the labor (fatigue or launch). */
  private readonly beat = { phase: 0, fatigue: 0 };
  /** This beat's amplitude and the right wing's phase lag (pose.beatAmp / sideLag: a tired beat). */
  private beatAmp = 1;
  private sideLag = 0;
  /** Launch beats still to labor through, and last frame's launch clock and beat phase. */
  private launchBeats = 0;
  private prevLaunchT = 99;
  private prevPhase = 0;

  constructor(a: WyvernAnimator) {
    this.a = a;
    this.f = a.frame;
    this.style = FLAP_STYLES[a.rig.props.breed];
    this.backStyle = BACKWING_STYLES[a.rig.props.breed];
    this.hoverStyle = HOVER_STYLES[a.rig.props.breed];
    this.planeMean = strokePlaneMean(this.style);
    const D = this.style.down;
    this.clockS = Math.sin(Math.PI * D);
    this.clockK = ((0.5 - D) * Math.PI) / this.clockS / TAU;
    this.clockC = 0.5 * D;
    this.maxRollRate = BREEDS[a.rig.props.breed].maxRollRate;
    this.yawAuthority = BREEDS[a.rig.props.breed].yawAuthority;
    const vStall = deriveFlight(BREEDS[a.rig.props.breed]).vStall;
    this.hoverFull = HOVER_FULL * vStall;
    this.hoverNone = HOVER_NONE * vStall;
  }

  /** The bond's anticipatory lean this frame (pose.anticipate, −1..1, + = right), in the air only. */
  private anticipate(): number {
    const f = this.f;
    return clamp(f.pose.anticipate ?? 0, -1, 1) * f.airW;
  }

  /**
   * The stick: the player's (pose.control), or for a ghost (no control recorded) an estimate from
   * the body's motion: the roll stick commands a roll rate, so the rate plus a lead of its
   * acceleration over the breed's top rate; the rudder from the yaw acceleration alone over the
   * breed's yaw authority (a coordinated turn's steady yaw rate is not rudder). Then the roll's
   * initiation and the rudder.
   */
  private controls(): void {
    const f = this.f;
    const ctl = f.pose.control;
    const om = f.om;
    const dt = f.dt;
    if (ctl) {
      this.ctlRoll = clamp(ctl.roll, -1, 1);
      this.ctlYaw = clamp(ctl.yaw, -1, 1);
    } else if (dt > 1e-5) {
      // Body frame: +z rolls right, +y yaws left.
      const az = f.teleport ? 0 : (om.z - this.prevOm.z) / dt;
      const ay = f.teleport ? 0 : (om.y - this.prevOm.y) / dt;
      // A yaw rate changing faster than the rudder could change it is not the rudder (BUMP_ACCEL).
      if (Math.abs(ay) > BUMP_ACCEL * this.yawAuthority) this.bumpT = 0;
      else this.bumpT += dt;
      this.ctlRoll = clamp((om.z + 0.25 * az) / this.maxRollRate, -1, 1);
      this.ctlYaw = this.bumpT < BUMP_HOLD ? 0 : clamp(-ay / this.yawAuthority, -1, 1);
    }
    this.prevOm.copy(om);
    const air = f.airW;
    if (f.teleport) {
      this.rollSlow.reset(this.ctlRoll);
      this.rudder.reset(0);
    }
    // (dt 0 is a no-op: the follower and the rudder spring only move with time.)
    const slow = dt > 0 ? this.rollSlow.step(this.ctlRoll, dt) : this.rollSlow.value;
    this.rollInit = (this.ctlRoll - slow) * air * f.spreadAir;
    // The head turns into the turn first (the rope shortened on that side), then the body banks:
    // the life layer adds lookLead to the look yaw (+ = toward the body's left, like lookYaw).
    // Anticipating a known bank (the bond), it looks into it before the stick goes over.
    f.lookLead = -(0.5 * this.ctlYaw + 0.35 * this.ctlRoll) * air - this.anticipate() * ANTICIPATE_LOOK;
    // The tail rudder (+ = toward the body's left): a right yaw swings the tail's tip right (a
    // rudder pushed right yaws the nose right), a little with the roll too, so a roll-out lets it
    // swing through center and back (the spring's overshoot, about a quarter second).
    const steer = -RUDDER * clamp(this.ctlYaw + 0.4 * this.ctlRoll, -1, 1) * air;
    f.tailSteer = dt > 0 ? this.rudder.step(steer, dt) : this.rudder.value;
  }

  /**
   * The living glide: a gliding wing is never still. Each wing trims on its own (two octaves of
   * smooth value noise per channel, written out here rather than calling ik.noise1 sixteen times a
   * frame: a double passed to or returned from a call the JIT doesn't inline is boxed), less on
   * the heavy breeds, the tips by the style's glideTips; and every 5–9 s both shoulders lift and
   * settle back (the resettle). Only while gliding: weight airW·(1 − flap)(1 − tuck)(1 − flare).
   */
  private glide(): void {
    const f = this.f;
    const t = f.time;
    const out = this.glideLife;
    const w = f.airW * (1 - f.flap) * (1 - f.tuck) * (1 - f.flare) * f.spreadAir;
    if (w <= 1e-4) {
      out.fill(0);
    } else {
      const amp = w * (1 - 0.5 * f.heft) * DEG;
      for (let k = 0; k < 8; k++) {
        let v = 0;
        for (let o = 0; o < 2; o++) {
          // Value noise at this octave: lattice hash at i and i + 1, smoothstep between.
          const x = t * (o === 0 ? GLIDE_HZ0 : GLIDE_HZ1) + k * 7.31 + o * 3.7;
          const i = Math.floor(x);
          const u = x - i;
          const seed = k * 2 + o + 1;
          const s0 = Math.sin((i + seed * 17.13) * 127.1 + seed * 311.7) * 43758.5453;
          const s1 = Math.sin((i + 1 + seed * 17.13) * 127.1 + seed * 311.7) * 43758.5453;
          const h0 = (s0 - Math.floor(s0)) * 2 - 1;
          const h1 = (s1 - Math.floor(s1)) * 2 - 1;
          v += (o === 0 ? 0.6 : 0.4) * (h0 + (h1 - h0) * u * u * (3 - 2 * u));
        }
        const ch = k & 3;
        out[k] = v * GLIDE_AMP[ch] * amp * (ch === 3 ? this.style.glideTips : 1) * GLIDE_GAIN;
      }
    }
    // The resettle, on the glide's own clock: the first a moment into a glide (the wings settle
    // after the last beat), then every 5–9 s (apart by a hash of the count: deterministic). A beat,
    // a tuck or the ground starts the clock again.
    if (f.teleport || w < 0.3) {
      this.glideT = 0;
      this.resettleN = 0;
      this.resettleAt = RESETTLE_FIRST;
    } else {
      this.glideT += f.dt;
    }
    const since = this.glideT - this.resettleAt;
    if (since >= RESETTLE_UP + RESETTLE_DOWN) {
      this.resettleN++;
      const h = Math.sin(this.resettleN * 12.9898) * 43758.5453;
      this.resettleAt = this.glideT + RESETTLE_MIN + (RESETTLE_MAX - RESETTLE_MIN) * (h - Math.floor(h)) - (RESETTLE_UP + RESETTLE_DOWN);
    }
    const r = since < 0 ? 0 : since < RESETTLE_UP ? smoothstep(0, RESETTLE_UP, since) : 1 - smoothstep(RESETTLE_UP, RESETTLE_UP + RESETTLE_DOWN, since);
    this.resettle = r * RESETTLE_EL * DEG * w;
  }

  /**
   * The launch: a launch (frame.launchT restarting, C6) is followed by LAUNCH_BEATS labored beats,
   * counted as the beat's phase wraps; the posed beat's labor is the larger of that and fatigue.
   */
  private launch(): void {
    const f = this.f;
    const lt = f.launchT;
    if (lt < LAUNCH_UNFOLD && lt < this.prevLaunchT) this.launchBeats = LAUNCH_BEATS;
    if (this.launchBeats > 0 && f.phase < this.prevPhase - 0.5) this.launchBeats--;
    if (!f.airborne && lt >= LAUNCH_UNFOLD) this.launchBeats = 0;
    this.prevLaunchT = lt;
    this.prevPhase = f.phase;
    this.beat.phase = f.phase;
    this.beat.fatigue = this.launchBeats > 0 ? 1 : f.fatigue;
    const pose = f.pose;
    this.beatAmp = pose.beatAmp ?? 1;
    this.sideLag = pose.sideLag ?? 0;
  }

  /** Heave, chest lift and lean, the flare's trunk pitch, and this frame's wing prelude. */
  flightTrunk(): void {
    const f = this.f;
    const { flap, airW, phase, heft, sh, flare, tuck, om } = f;
    // The beat's shared clock for the body (wingPoses.bodyClock, inlined): 0 at the top of the
    // stroke, 0.25 at the power peak (D/2), 0.5 at the bottom (phase D, the 'flap' event), 0.75
    // mid-recovery. The flight model's power stroke peaks at 0.25 on it, and so do the membrane
    // load and the chest's pitch, whatever the breed's downstroke fraction: the surge is felt while
    // the wing is visibly half way down. Unlike strokePhase its rate has no corners, so the body
    // never changes speed in an instant at the top or the bottom (which kicked the tail into a
    // flick and jolted the neck's spring every beat).
    const p = phase - Math.floor(phase);
    const sp = p + this.clockK * (Math.sin(TAU * (p - this.clockC)) + this.clockS);
    // Heave: the downstroke lifts the chest and saddle, the recovery lets them sink. The body
    // rises fastest just after the power peak and is highest just after the bottom of the stroke
    // (the lift lags the force).
    const heaveAmp = (0.05 + 0.035 * heft) * sh;
    f.heave = flap * airW * heaveAmp * -Math.cos((sp - 0.08) * TAU);
    // The wings drive the chest: it pitches up on the downstroke and leads the roll into a turn.
    const chestLift = -flap * airW * (0.05 + 0.03 * heft) * Math.sin((sp - 0.02) * TAU);
    f.chestLift = chestLift;
    f.lean = clamp(f.bank * 0.1 + om.z * 0.1, -0.22, 0.22) * airW + this.anticipate() * ANTICIPATE_LEAN;
    // Landing (B5): the last metres of an approach (feet within 1.6·sh of the ground, coming
    // down) the chest and spine pitch up a further 10° and a flaring beat becomes a backwing.
    const feet = f.height - sh;
    this.landFlare = f.airborne && f.pose.velocity.y < 0.5 ? smoothstep(1.6 * sh, 0.4 * sh, feet) : 0;
    this.backW = this.landFlare * smoothstep(0.3, 0.6, flare);
    const landPitch = this.landFlare * flare * airW;
    f.spineAir = chestLift - flare * 0.06 * airW - 0.1 * landPitch;
    f.chestAir = chestLift * 0.6 - flare * 0.04 - 0.075 * landPitch;
    f.pelvisAir = flare * 0.05 * airW - tuck * 0.02;
    // Wing prelude. Turning: the outer (rising) wing reaches and works harder, the inner one
    // unloads.
    this.asymBase = clamp(om.z * 0.55 - om.y * 0.35 + f.bank * 0.35, -1, 1) * airW;
    const spreadAir = (1 - tuck) * (1 - flare * 0.5);
    f.spreadAir = spreadAir;
    // Air load: lift at 1 g holds a gentle camber; g-load and the power stroke bow the membrane up
    // and bend the fingers, the recovery stroke lets them go slack.
    this.glideLoad = 0.3 * clamp(f.gLoad, 0, 3) * spreadAir;
    this.beatLoad = flap * strokeLoad(phase, this.style) * (1 + 0.25 * heft);
    // The stick: the roll's initiation, the head's lead and the tail's rudder (B3).
    this.controls();
    // The living glide (B4).
    this.glide();
    // The launch strokes (B6).
    this.launch();
    // Hover (B7): flared and beating slowly enough to hang in the air (not the last metres to
    // the ground, which beat the backwing). Published for the tail's air brake.
    this.hoverW = flare * flap * (1 - smoothstep(this.hoverFull, this.hoverNone, f.speed)) * (1 - this.backW) * airW;
    f.hover = this.hoverW;
    // The pull-out: the hands follow the arms' tuck a moment behind, and stay swept back pulling
    // out of a fast dive while the arms open.
    const pull = HAND_TUCK * smoothstep(30, 45, f.speed) * clamp01((f.gLoad - 1) / 2) * airW;
    const handTarget = Math.max(tuck, pull);
    this.handTuck = f.teleport ? handTarget : this.handTuck + (handTarget - this.handTuck) * (1 - Math.exp(-f.dt / HAND_LAG));
  }

  /** One wing's flight pose (`side` 0 left, 1 right) into `out`. */
  flightWingPose(side: number, out: WingPose): void {
    const f = this.f;
    const { tuck, flare, flap, buffet, airW } = f;
    const sgn = SIDE_SIGN[side];
    const asym = this.asymBase * sgn;
    // Tucked: the arm with the tuck, the hand and fingers with their own (the pull-out). The
    // hand's own tuck is measured against the body, not the forearm: where it is more tucked than
    // the arm, it keeps the sweep back the arm has given up, so the hand-wings stay swept back
    // along the body while the wrists open (an M from above).
    blendPose(GLIDE, TUCK, tuck, out);
    const handTuck = this.handTuck;
    if (handTuck > tuck + 1e-4) {
      blendPose(GLIDE, TUCK, handTuck, this.tuckPose);
      for (let c = HAND_CH; c < WING_CHANNELS; c++) out[c] = this.tuckPose[c];
      out[W.handSw] += (TUCK[W.humSw] + TUCK[W.foreSw]) * (handTuck - tuck);
    }
    blendPose(out, FLARE, flare * (1 - tuck), out);
    if (flap > 0.001) {
      // A tired wyvern's right wing trails the left a little (pose.sideLag, B7).
      const beat = this.beat;
      beat.phase = side === 1 ? f.phase - this.sideLag : f.phase;
      const fp = flapPoseAt(beat, this.flapSide, this.style);
      // The outer wing of a turn takes the bigger stroke; a tired beat a smaller one (beatAmp).
      const amp = clamp(1 + 0.3 * asym, 0.72, 1.32) * this.beatAmp;
      fp[W.humEl] *= amp;
      fp[W.foreEl] *= amp;
      fp[W.handEl] *= amp;
      // Flaring beats reach 16° forward of the shoulder's neutral (the stroke plane already sits
      // part of the way there: the flare adds the rest rather than stacking on it)...
      const backW = this.backW;
      if (flare > 0) {
        fp[W.humSw] += (-16 * DEG - this.planeMean) * flare * (1 - backW);
        fp[W.humTw] += -14 * DEG * flare * (1 - backW);
      }
      // ...and over the last metres to the ground they are backwing strokes, beating against the
      // sink in front of the body.
      if (backW > 0.001) blendPose(fp, flapPoseAt(beat, this.flapBack, this.backStyle), backW, fp);
      // Hovering, the stroke plane lies back 45°: a figure of eight in front of the body.
      const hoverW = this.hoverW;
      if (hoverW > 0.001) blendPose(fp, flapPoseAt(beat, this.flapHover, this.hoverStyle), hoverW, fp);
      blendPose(out, fp, flap, out);
    }
    // The living glide: each wing trims on its own, the tips most; the resettle lifts both.
    const gl = this.glideLife;
    const k = side * 4;
    out[W.humEl] += gl[k] + this.resettle;
    out[W.humTw] += gl[k + 1];
    out[W.handSw] += gl[k + 2];
    out[W.f0bEl] += gl[k + 3];
    out[W.f1bEl] += 0.8 * gl[k + 3];
    out[W.f2bEl] += 0.6 * gl[k + 3];
    // (Noise only while there is a buffet: a double passed to a call the JIT doesn't inline is
    // boxed on the heap.)
    const shake = buffet > 0;
    const bf = shake ? buffet * noise1(f.stallT * 9 + side * 7.3, 10 + side) : 0;
    const bt = shake ? buffet * noise1(f.stallT * 11 + side * 3.1, 20 + side) : 0;
    const adj = this.adj;
    adj.gLoad = f.gLoad;
    adj.asym = asym;
    adj.buffet = bf + buffet * 0.4 * sgn * Math.sin(f.stallT * 1.7);
    adj.buffetTw = bt;
    adj.spread = f.spreadAir;
    adjustPose(out, adj);
    // Rolling in (B3): the stick asks first and the wings answer before the body has banked.
    // The inner wing half-folds (elbow forward, wrist back, hand and tips down), shortening its
    // span; the outer one reaches forward and up with its leading edge raised. It dies away into
    // the sustained turn's asymmetry (adjustPose) over 0.4 s, and swings the other way on the
    // roll-out.
    const init = this.rollInit * sgn;
    if (init > 0) {
      out[W.humTw] -= 10 * init * DEG;
      out[W.humEl] += 6 * init * DEG;
      out[W.humSw] -= 6 * init * DEG;
    } else if (init < 0) {
      // The inner wing flexes at the elbow and wrist (deeper than the recovery's M-fold, for a
      // moment) and curls its wingtip spar back: its span shortens by a sixth while the outer one
      // stays fully spread.
      const m = -init;
      out[W.foreSw] -= INNER_FORE * m * DEG;
      out[W.handSw] += INNER_HAND * m * DEG;
      out[W.handEl] -= 8 * m * DEG;
      out[W.f0bEl] -= 6 * m * DEG;
      out[W.f1bEl] -= 6 * m * DEG;
      out[W.f2bEl] -= 6 * m * DEG;
      out[W.f0bSw] += INNER_TIP * m * DEG;
    }
    // Rising air under a wingtip loads that wing before the body rolls (a thermal's edge).
    const gust = f.pose.gust;
    const tipAir = gust ? (side === 0 ? gust.l : gust.r) : 0;
    const loadT = airW * ((this.glideLoad + this.beatLoad) * (1 + 0.35 * clamp(asym, -1, 1)) + GUST_LOAD * clamp(tipAir, -4, 8) * f.spreadAir);
    const load = this.loadSpring[side].step(loadT, f.dt);
    this.wingLoad[side] = load;
    loadPose(out, load * f.spreadAir);
    // Launch: the wrists have just left the ground, and the wings sweep out of the fold into the
    // first downstroke (not before: they stay folded through the crouch and the vault).
    const lt = f.launchT;
    if (lt < LAUNCH_UNFOLD) blendPose(FOLDED, out, smoothstep(0, LAUNCH_UNFOLD, lt), out);
  }

  /** Leg weights in the air: tucked, reaching, pushing off; the dangling legs' swing. */
  flightLegWeights(): void {
    const f = this.f;
    const pose = f.pose;
    const { airborne, sh, speed, accel } = f;
    // The hind legs reach for the ground from 3.5·sh up on an approach.
    const approach = airborne && pose.velocity.y < 0.5 ? 1 - smoothstep(sh * 1.4, sh * 3.5, f.height) : 0;
    const reach = clamp01(Math.max(f.flare, approach * smoothstep(26, 14, speed)));
    const push = airborne && pose.gait === 'takeoff' ? 1 - smoothstep(0.15, 0.55, pose.gaitTime) : 0;
    f.legReach = reach;
    f.legPush = push;
    f.legTuck = clamp01(smoothstep(15, 24, speed) + f.tuck) * (1 - reach) * (1 - push);
    // Dangling legs swing with the body's fore-aft acceleration and trail the wingbeat's heave.
    _v.copy(FWD).applyQuaternion(this.a.qW);
    const fwdAcc = accel.x * _v.x + accel.y * _v.y + accel.z * _v.z;
    f.legSwing = this.legSwing.step(clamp(-fwdAcc * 0.012 + (f.heave / sh) * 0.9, -0.4, 0.4), f.dt);
  }

  /** Trailing-edge flutter and ripple, and the membrane billow per wing. */
  flightUniforms(u: WyvernUniforms): void {
    const f = this.f;
    const { sh, speed, airW, tuck, flap, buffet, bask, spreadAir } = f;
    // Trailing-edge flutter: airspeed, the power stroke's ripple, stall buffet, a breeze on the
    // spread membranes while basking.
    // At dive speeds the spread trailing edge luffs (0.1 m at 55 m/s), more with the wings
    // half-tucked; the rate stays low enough (3–8 Hz) that a 60 fps frame never aliases it.
    u.uFlutter.value = sh * (0.008 + 0.04 * smoothstep(25, 60, speed)) * (1 + 0.5 * tuck) * airW + 0.008 * sh * flap * airW + buffet * 0.03 + bask * 0.004 * sh;
    u.uFlutterRate.value = TAU * clamp(3 + 0.08 * speed, 3, 8) * (1 - bask) + 6 * bask;
    u.uRipple.value = 0.4 + 0.6 * smoothstep(5, 35, speed);
    // Membrane billow per wing (m at full load).
    const billow = 0.022 * this.a.rig.props.wingspan;
    const wl = u.uWingLoad.value;
    wl.x = this.wingLoad[0] * billow * spreadAir;
    wl.y = this.wingLoad[1] * billow * spreadAir;
  }
}
