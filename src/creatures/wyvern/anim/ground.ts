// Ground layer of the wyvern animator: wing-walking on the hind feet and the folded wrists.
//
//   gait           feet planted in world space by gait.ts (on the gameplay walker's gait clock,
//                  corrective steps while standing), and the landing brace
//   groundTrunk    the trunk driven by the feet (the pendulum's rise and fall, the roll over the
//                  stance feet, the spine's sway from where the feet are, a dip at each footfall),
//                  the body lowered to its lowest feet on uneven ground, the landing settle (dip)
//                  and the takeoff crouch
//   touchdown      plant the feet where they are and kick the settle spring
//   groundWingPose the FK wing pose on the ground: folded, the settle and shuffle, raised for the
//                  takeoff, spread to bask
//   applyWingIK    the folded stance: wrists planted as front feet by two-bone IK, the hand and
//                  fingers folded back up along the forearm and the flank
//   applyLegs      flight leg poses (FK, weights from the flight layer) blended with ground IK to
//                  the planted feet
//   contacts       where the feet are (for the next touchdown, footstep FX and contact shadows)
//
// Methods take no number arguments (see frame.ts).

import { Quaternion, Vector3 } from 'three';
import type { GroundHit, TerrainQuery } from '../../../core/types';
import { DEG, TAU, clamp, clamp01, smoothstep } from '../../../core/math';
import { SIDE_SIGN, innerTrailRoot, type RigDef } from '../rig';
import { Bouncy, aimRotation, solveTwoBoneAt } from '../ik';
import { armScale } from '../parts/wings';
import { Gait, type GaitContext } from '../gait';
import { gaitProfile, runBlendAt, type GaitProfile } from '../../../core/gait';
import { FLAP_STYLES, WING_CHANNELS, blendPose, flapPose, type WingPose } from '../wingPoses';
import type { WyvernAnimator } from '../animator';
import { BASK, FOLDED, KNEEL, SETTLE } from './groundPoses';
import { FWD, LEFT, UP, bump, type AnimFrame } from './frame';

/**
 * Leg bone directions (pelvis space, left leg) for the flight poses, one row of 12 per bone
 * (thigh, shin, metatarsus): tucked, dangling, reaching for the ground, pushing off (xyz each).
 */
const LEG_POSES = new Float64Array([
  0.06, -0.5, -0.86, 0.1, -0.86, 0.48, 0.14, -0.62, 0.78, 0.05, -0.92, -0.38,
  0.0, 0.25, -0.97, 0.02, -0.82, -0.56, 0.03, -0.97, 0.24, 0.0, -0.94, -0.33,
  0.0, -0.18, -0.98, 0.0, -0.9, 0.22, 0.0, -0.94, 0.32, 0.0, -0.8, -0.6,
]);

// Scratch (module-level: the animator never re-enters).
const _q = new Quaternion();
const _v = new Vector3();
const _v2 = new Vector3();
const _v3 = new Vector3();
const _v4 = new Vector3();
const _v5 = new Vector3();
const _hum = new Vector3();
const _fore = new Vector3();
const _ref = new Vector3();
const _handD = new Vector3();
const _fd = new Vector3();
const _lv = new Vector3();
const _outG = new Vector3();
const _tv1 = new Vector3();
const _tv2 = new Vector3();
const _tv3 = new Vector3();
const _tv4 = new Vector3();
const _qr = new Quaternion();
const _gn = new Vector3();
const _q2 = new Quaternion();
const _qa = new Float64Array(4);
const _ax = new Vector3();
const _ec = new Vector3();
const _eu = new Vector3();
const _ev = new Vector3();
const _et = new Vector3();
const _cp = new Vector3();
const _cd = new Vector3();
const _cs = new Vector3();
/** The posed hind leg's capsules for the wing's clearance: thigh, shin (a, b, ra, rb; body frame). */
const _leg = [new Vector3(), new Vector3(), new Vector3()];

/**
 * The folded stance (applyWingIK), as fractions: where the wrist plants, the elbow's pole, how
 * the hand and fingers bundle along the forearm, and how the outer finger segments rise.
 */
export const FOLD = {
  /** Wrist rest spot: in from the elbow's line (× standHeight) and ahead of the shoulder (× forearm). */
  wristIn: 0.03,
  wristFwd: 0.06,
  /**
   * Where the elbow tucks: behind the shoulder (× humerus), down the flank (× the body's depth
   * below its centreline), clear of the flank (× the elbow's radius), and no narrower than this
   * share of the shoulders' half-width (the track the forefeet stand on).
   */
  elbowBack: 0.55,
  elbowLow: 0.5,
  elbowClear: 1.0,
  minTrack: 0.6,
  /** How far the humerus's dorsal face turns up from out (its flat blade lies lower on the flank). */
  humRefUp: 1,
  /** Hand direction offsets from straight up the forearm (out, back; negative out = in toward the body). */
  handOut: -0.05,
  handBack: 0.08,
  /** Finger inner segments: out and back offsets from up the forearm, and the step per finger. */
  fingerOut: -0.2,
  fingerOutStep: 0,
  fingerBack: 0.1,
  fingerBackStep: 0.06,
  /**
   * Where the inner fingers' outer segments' tips ride: their height as a share of the body's
   * upper half-height above its centreline at the elbow (the middle finger, the step per finger
   * in), within this pitch range above level (rad; the wingtip spar's too).
   */
  tipH: 0.35,
  tipHStep: 0.25,
  riseMin: 0.15,
  riseMax: 1.25,
  /**
   * The fold helpers (A2): the inner panel's interior is drawn toward the folded arm, scaled about
   * a point on the elbow's inner face: across (x), up and down (y) and fore and aft (z).
   */
  helperX: 0.2,
  helperY: 0.75,
  helperZ: 0.6,
  /** ...across about this share of the shoulders' half-width at most. */
  helperFlank: 1,
  /** The wingtip spar's tip rides at the croup's height, in over it to this share of its half-width (0 = the midline). */
  tipIn: 0.8,
  /**
   * The hind feet stand this far ahead of the bind leg's ball (× standHeight; negative: behind it,
   * under the haunch): the knee then stays behind the folded elbow and its membrane.
   */
  hindFwd: -0.08,
  /** Outer finger segments turned out from straight back (rad). */
  tipOut: 0.04,
  /** The finger bundle's clearance from the flank (× the arm's radius scale: a finger's thickness). */
  fingerClear: 0.12,
  /**
   * How much the finger bundle holds its own line (body up, leaning back by bundleLean) rather than
   * following the forearm as it swings through a stride (0 = always along the forearm).
   */
  bundleHold: 0.6,
  bundleLean: 0.35,
  /**
   * The folded arm keeps off the hind leg as it strides (Robert, 2026-10-18: no wing through the
   * hind legs while walking): the elbow swings out about the shoulder-to-wrist line, as far as
   * elbowSwingMax (rad), until the arm clears the posed thigh and shin by legClear (× standHeight).
   * It swings out quickly (swingOut, 1/s) and settles back slowly (swingIn).
   */
  legClear: 0.03,
  /** The folded arm's effective radius for that clearance (× the arm scale): tube plus membrane bundle. */
  armBundle: 0.45,
  /** The same for a folded finger's outer segment (× the arm scale): the spar and the membrane along it. */
  fingerBundle: 0.25,
  /** The forefoot's track: outside the hind foot's by this share of the thigh's radius (plus the forearm's). */
  foreOutside: 0.5,
  foreOutStand: 0.2,
  elbowSwingMax: 1.3,
  swingOut: 60,
  swingIn: 5,
  /** A wall closer than this to the folded elbow's surface (m) draws the wing in, by at most wallMax. */
  wallReach: 0.25,
  wallMax: 0.35,
};

/** What the ground layer asks of the terrain: the ground under a foot, and optionally walls. */
export type GroundTerrain = Pick<TerrainQuery, 'groundAt'> & Partial<Pick<TerrainQuery, 'distance'>>;

export class GroundLayer {
  private readonly a: WyvernAnimator;
  private readonly f: AnimFrame;
  private readonly rig: RigDef;
  private readonly terrain?: GroundTerrain;
  readonly gait: Gait;
  /** The breed's gait (core/gait.ts): its timing, the trunk's gains, the slope tilt. */
  readonly profile: GaitProfile;
  /** Where each foot is now (world): hind feet under the ball of the foot, fore at the claw. */
  readonly footWorld: Vector3[] = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
  private readonly gaitCtx: GaitContext;
  /** The landing settle: the body sinks into the legs and springs back. */
  private readonly dip: Bouncy;
  private readonly wingRestDir: Vector3[][];
  private readonly legRestDir: Vector3[][];
  private readonly fwdG = new Vector3();
  private readonly flapTmp = new Float32Array(WING_CHANNELS);
  /** Leg pose weights this frame: tuck, reach, push, side sign, fatigue, swing (see legDir). */
  private readonly legW = new Float64Array(6);
  /** This frame's weight of the folded-stance wing IK. */
  private ikW = 0;
  /** Toe curl for setEulerAt (x, y, z). */
  private readonly toeAng = new Float64Array(3);
  /** Two-bone lengths for solveTwoBoneAt: humerus, forearm, thigh, shin. */
  private readonly lens: Float64Array;
  /** The feet that came down this frame (bit i: foot i; see Gait.contacts). */
  private footfalls = 0;
  /** 0..1 how much the gait's trunk terms are on (eases in and out as the gait starts and stops). */
  private moveW = 0;
  /**
   * The uneven-ground drop at the hind end and at the fore end (m, eased: a foot planting on a
   * step doesn't jolt the body), and how much lower each limb's root needed to be in the last IK
   * for its planted foot to stay in reach (LH, RH, LF, RF; m, negative when it reached with room).
   */
  private readonly dropH = new Bouncy(14, 1);
  private readonly dropF = new Bouncy(14, 1);
  private readonly need = new Float64Array([-1, -1, -1, -1]);
  /** The hind and fore rest spots' distance apart (m, body frame z): the uneven-ground pitch's lever. */
  private readonly footSpan: number;
  /** ...and the fore rest spots' z (body frame). */
  private readonly foreZ: number;

  /** Reused terrain query result. */
  private readonly hit: GroundHit = { y: 0, normal: new Vector3(), islandId: -1, surface: 'grass' };
  /**
   * Per side and finger: the angle (about the bind wing normal) that turns the finger's bind
   * direction onto straight back (a little out), which closes the fan in the fold.
   */
  private readonly fanClose = new Float64Array(6);
  /** The finger segments' lengths (inner, outer). */
  private readonly fingerA: Float64Array;
  private readonly fingerB: Float64Array;
  /**
   * The torso's cross-sections for clearance checks (bind, every ~0.1 m from the neck base to the
   * tail base): z, centre height, half-width, upper and lower half-heights, squareness (6 each).
   */
  private readonly torso: Float64Array;
  /** torsoClear's result: how far a point must move out to clear the flank (m, 0 when clear). */
  private readonly clear = new Float64Array(1);
  /** outerAim's result: an outer finger segment's pitch and yaw (rad). */
  private readonly aim = new Float64Array(2);
  /** The croup: the torso's top over the hips (body frame y) and its half-width there. */
  private readonly croup = new Float64Array(2);
  /** Where the folded fingertips stop short of the thigh: its front (z) and its top (y), body frame. */
  private readonly hipGuard = new Float64Array(2);
  /** This frame's guard per side (z, y): the bind guard, or the posed knee's front if it is further forward. */
  private readonly legGuard = new Float64Array(4);
  /** Per side: the folded elbow's swing out about the shoulder-to-wrist line clearing the hind leg (rad, smoothed). */
  private readonly elbowSwing = new Float64Array(2);
  private readonly thighR: number;
  /** How far out the forefeet's track moves while striding (m; see FOLD.foreOutside). */
  private readonly foreOut: number;
  /** 0 standing to 1 striding, quick: the forefeet's first steps already land outside. */
  private outW = 0;
  /** The body's centreline height and upper half-height at the folded elbow. */
  private readonly flankMid = new Float64Array(2);
  /** Where the folded elbow tucks against the flank (left side, body frame). */
  private readonly elbowAt = new Vector3();
  /** The shoulders' half-width (the body's widest, seen from the front). */
  private readonly flankX: number;
  /** The arm's radius scale (parts/wings.ts armScale). */
  private readonly armR: number;
  /** The breed's standing metatarsus angle from vertical (BreedShape.legAngles). */
  private readonly metaAngle: number;
  /** The forefeet's standing rest spots (body frame; the gait's are moved from these by the kneel). */
  private readonly foreRest: [Vector3, Vector3];
  /** How far the body lowers at a full kneel (m): until the keel nearly touches the ground. */
  private readonly kneelDepth: number;
  /** Which side the rider is on for the kneel: +1 the wyvern's left … −1 its right (smoothed). */
  private kneelSide = 1;
  /**
   * How far each folded wing is drawn in against the body because a wall or rock face is at the
   * elbow (m, smoothed; left, right). Only with a terrain that has a distance field.
   */
  readonly wallPull = new Float64Array(2);
  /**
   * Per side (12 each), for trailRoll: the innermost finger's bind direction (3); the offset of
   * the inner panel's trailing-edge midpoint from that finger's outer joint, across the finger (3);
   * that offset along the finger; the midpoint's bind x; the trailing root's bind x; the outer
   * segment's length.
   */
  private readonly trailBind = new Float64Array(24);

  constructor(a: WyvernAnimator, terrain?: GroundTerrain) {
    this.a = a;
    this.f = a.frame;
    this.rig = a.rig;
    this.terrain = terrain;
    const rig = a.rig;
    const heft = a.heft;
    this.lens = new Float64Array([rig.props.arm.humerus, rig.props.arm.forearm, rig.props.leg.thigh, rig.props.leg.shin]);
    // Heavier bodies settle slower and bounce less.
    this.dip = new Bouncy(8.5 - 2.5 * heft, 0.42 + 0.1 * heft);
    const B = rig.bones;
    const dirOf = (i: number, b: Vector3) => b.clone().sub(B[i].pos).normalize();
    this.wingRestDir = [0, 1].map((side) => {
      const w = rig.idx.wings[side];
      const m = (v: Vector3) => new Vector3(v.x * SIDE_SIGN[side], v.y, v.z);
      return [
        dirOf(w.humerus, m(rig.elbow)),
        dirOf(w.forearm, m(rig.wrist)),
        dirOf(w.hand, m(rig.knuckle)),
        dirOf(w.fingers[0][0], m(rig.fingerTips[0])),
        dirOf(w.fingers[1][0], m(rig.fingerTips[1])),
        dirOf(w.fingers[2][0], m(rig.fingerTips[2])),
      ];
    });
    for (let side = 0; side < 2; side++) {
      const r = this.wingRestDir[side];
      for (let f = 0; f < 3; f++) {
        // Angle about +Y from finger f's bind direction to straight back (0, 0, -1), turned out from
        // the body by FOLD.tipOut (both in the bind plane).
        const d = r[3 + f];
        const o = FOLD.tipOut * SIDE_SIGN[side];
        const tx = Math.sin(o);
        const tz = -Math.cos(o);
        const ang = Math.atan2(d.z * tx - d.x * tz, d.x * tx + d.z * tz);
        this.fanClose[side * 3 + f] = ang;
      }
    }
    this.armR = armScale(rig);
    {
      // The inner panel's trailing edge (parts/wings.ts, sector C): a scalloped line from the
      // flank root to finger 2's tip, its middle drawn in toward the wrist.
      const trail0 = innerTrailRoot(rig.props, rig.plan);
      for (let side = 0; side < 2; side++) {
        const sx = SIDE_SIGN[side];
        const w = rig.idx.wings[side];
        const trail = new Vector3(trail0.x * sx, trail0.y, trail0.z);
        const tip = new Vector3(rig.fingerTips[2].x * sx, rig.fingerTips[2].y, rig.fingerTips[2].z);
        const wr = new Vector3(rig.wrist.x * sx, rig.wrist.y, rig.wrist.z);
        const mid = trail.clone().lerp(tip, 0.5);
        const inward = wr.clone().sub(mid);
        inward.y = 0;
        inward.normalize();
        mid.addScaledVector(inward, (rig.props.shape.wing.scallopInner ?? rig.props.shape.wing.scallop) * 1.2 * trail.distanceTo(tip));
        const m2 = rig.bones[w.fingers[2][1]].pos;
        const d = this.wingRestDir[side][5];
        const off = mid.clone().sub(m2);
        const along = off.dot(d);
        const perp = off.clone().addScaledVector(d, -along);
        this.trailBind.set([d.x, d.y, d.z, perp.x, perp.y, perp.z, along, mid.x, trail.x, tip.distanceTo(m2)], side * 12);
      }
    }
    this.metaAngle = rig.props.shape.legAngles.meta;
    this.fingerA = new Float64Array(rig.props.arm.fingers.map((f) => f[0]));
    this.fingerB = new Float64Array(rig.props.arm.fingers.map((f) => f[1]));
    {
      const plan = rig.plan;
      const s0 = plan.keyS[plan.marks.neckBase];
      const s1 = plan.keyS[plan.marks.tailBase];
      const n = Math.max(8, Math.round((s1 - s0) / 0.1));
      const t = new Float64Array((n + 1) * 6);
      for (let i = 0; i <= n; i++) {
        const st = plan.station(s0 + ((s1 - s0) * i) / n);
        t.set([st.center.z, st.center.y, st.halfWidth, st.upper, st.lower, st.squareness], i * 6);
      }
      this.torso = t;
      {
        const st = plan.station(plan.sAtZ(rig.props.hip[2]));
        this.croup[0] = st.center.y + st.upper;
        this.croup[1] = st.halfWidth;
      }
      const R = rig.props.shape.thighRadius;
      this.hipGuard[0] = rig.props.hip[2] + 1.1 * R;
      this.hipGuard[1] = rig.props.hip[1] + 1.1 * R;
    }
    this.thighR = rig.props.shape.thighRadius;
    this.legRestDir = [0, 1].map((side) => {
      const l = rig.idx.legs[side];
      const m = (v: Vector3) => new Vector3(v.x * SIDE_SIGN[side], v.y, v.z);
      return [dirOf(l.thigh, m(rig.knee)), dirOf(l.shin, m(rig.ankle)), dirOf(l.meta, m(rig.ball)), FWD.clone()];
    });

    // Gait rest spots (body space, on the ground plane).
    const P = rig.props;
    const sh = P.standHeight;
    const hipX = P.hip[0];
    const restHind = (side: number) => new Vector3(hipX * 1.08 * SIDE_SIGN[side], -sh, rig.ball.z + FOLD.hindFwd * sh);
    // The folded elbow rests against the flank below and behind the shoulder, the forearm's
    // surface just clear of the body there; the wrist plants under it, a little in and ahead.
    {
      const hum = P.arm.humerus;
      const ez = P.shoulder[2] - FOLD.elbowBack * hum;
      const st = rig.plan.station(rig.plan.sAtZ(ez));
      const ey = st.center.y - FOLD.elbowLow * st.lower;
      const ty = Math.min(1, Math.abs(ey - st.center.y) / st.lower);
      const flank = st.halfWidth * Math.pow(Math.max(0, 1 - Math.pow(ty, st.squareness)), 1 / st.squareness);
      this.flankX = rig.plan.station(rig.plan.keyS[rig.plan.marks.shoulder]).halfWidth;
      const track = FOLD.minTrack * this.flankX;
      this.elbowAt.set(Math.max(flank, track) + FOLD.elbowClear * 0.17 * armScale(rig), ey, ez);
      this.flankMid[0] = st.center.y;
      this.flankMid[1] = st.upper;
    }
    const restFore = (side: number) => new Vector3((this.elbowAt.x - FOLD.wristIn * sh) * SIDE_SIGN[side], -sh, P.shoulder[2] + FOLD.wristFwd * P.arm.forearm);
    // Striding, the forefeet plant outside the hind feet's track (as a pterosaur's hands printed
    // outside its feet), so the forearm passes outside the striding knee and shin (Robert,
    // 2026-10-18: no wing through the hind legs). Standing they keep the tucked fold.
    this.foreOut = Math.max(0, hipX * 1.08 + FOLD.foreOutside * P.shape.thighRadius + 0.2 * armScale(rig) - (this.elbowAt.x - FOLD.wristIn * sh));
    this.gait = new Gait([restHind(0), restHind(1), restFore(0), restFore(1)]);
    this.foreRest = [restFore(0), restFore(1)];
    this.profile = gaitProfile(rig.props.breed);
    this.footSpan = Math.max(0.5 * sh, restFore(0).z - restHind(0).z);
    this.foreZ = restFore(0).z;
    {
      // The kneel's depth: the torso's lowest point under the kneel's pitch, down to a clearance.
      const plan = rig.plan;
      const s0 = plan.keyS[plan.marks.neckBase];
      const s1 = plan.keyS[plan.marks.tailBase];
      const pa = this.profile.standPitch + KNEEL.pitch;
      let low = 0;
      for (let k = 0; k <= 40; k++) {
        const st = plan.station(s0 + ((s1 - s0) * k) / 40);
        const y = st.center.y - st.lower;
        low = Math.min(low, y * Math.cos(pa) - st.center.z * Math.sin(pa));
      }
      this.kneelDepth = clamp(sh + low - KNEEL.clear * sh, KNEEL.minDepth * sh, KNEEL.maxDepth * sh);
    }
    this.gaitCtx = {
      dt: 0,
      toWorld: (m, out) => out.copy(m).applyQuaternion(a.qW).add(a.posW),
      groundAt: (x, z, y, n) => this.groundHeight(x, z, y, n),
      fallbackY: 0.5,
      velocity: new Vector3(),
      yawRate: 0,
      standHeight: sh,
      runBlend: 0,
      overreach: 0,
      profile: this.profile,
      phase: undefined,
      moving: false,
      groundKey: 0.5,
    };
  }

  /** After a teleport: the settle starts from rest (the gait re-plants in gait()). */
  reset(): void {
    this.dip.reset();
    this.dropH.reset();
    this.dropF.reset();
    this.need.fill(-1);
  }

  /**
   * The ground a foot can stand on under (x, z): its height, the normal written into `n`; NaN when
   * there is none within reach of the body's own ground (a deck over the void, a cliff's foot, the
   * top of a wall), so the gait steps back onto ground that is.
   */
  private groundHeight(x: number, z: number, y: number, n: Vector3): number {
    const ref = this.a.groundRef;
    if (!this.terrain) {
      n.set(0, 1, 0);
      return ref;
    }
    const g = this.terrain.groundAt(x, z, y, this.hit);
    if (!g || Math.abs(g.y - ref) > 0.8 * this.f.sh) return NaN;
    n.copy(g.normal);
    return g.y;
  }

  /**
   * Touchdown: plant the feet where they are and absorb the impact — the body sinks into the legs
   * (knees flex through the leg IK), pitches forward a touch and springs back.
   */
  touchdown(): void {
    const f = this.f;
    this.dip.velocity -= clamp(f.sink, f.pose.touchdown ? 0 : 1.5, 10) * (0.24 + 0.08 * f.heft) * (f.sh / 2.6);
    this.gaitCtx.standHeight = f.sh;
    this.gait.plantAt(this.footWorld, this.gaitCtx);
  }

  /** The landing brace, and the gait: plant feet in world space. */
  gaitUpdate(): void {
    const f = this.f;
    const pose = f.pose;
    const { airborne, heft } = f;
    // Wings held up and half open for balance while the weight comes down, then folded.
    f.brace = airborne ? 0 : f.landImpact * bump(f.landT, 0, 0.06, 0.3 + 0.25 * heft, 1.0 + 0.3 * heft);
    if (!airborne || f.legAirW < 0.99) {
      const c = this.gaitCtx;
      c.dt = f.dt;
      c.velocity.copy(pose.velocity);
      c.velocity.y = 0;
      c.yawRate = f.om.y;
      c.standHeight = f.sh;
      c.groundKey = this.a.groundRef;
      c.fallbackY = this.a.groundRef;
      const gs = Math.sqrt(c.velocity.x * c.velocity.x + c.velocity.z * c.velocity.z);
      c.runBlend = runBlendAt(this.profile, gs);
      c.moving = !f.takeoffCrouch && (gs > 0.35 || Math.abs(f.om.y) > 0.35);
      // One clock: the feet follow the walker's, so each comes down on its footstep.
      c.phase = pose.gaitPhase;
      // The kneel brings the forefeet forward along the ground (the rider's side a little wider),
      // stepping as a pair.
      this.kneelRest();
      c.foreTogether = f.kneel > 0.02;
      // Feet the last IK couldn't reach (beyond what the body's drop already gave them), in the
      // walk (the bound's hind feet leave the ground at full stretch: that is its push-off).
      const nd = this.need;
      const over = c.runBlend < 0.5 ? 0.01 * f.sh : Infinity;
      c.overreach = (nd[0] > over ? 1 : 0) | (nd[1] > over ? 2 : 0) | (nd[2] > over ? 4 : 0) | (nd[3] > over ? 8 : 0);
      // Setting off, a forefoot still on the standing fold's track (inside the stride's) steps out
      // first, before the hind leg on its side swings past the folded arm.
      if (c.moving && f.kneel < 0.02) {
        for (let side = 0; side < 2; side++) {
          const foot = this.gait.feet[2 + side];
          if (foot.swinging) continue;
          const x = this.a.toModel(foot.plant, _v).x * SIDE_SIGN[side];
          if (x < Math.abs(this.gait.rest[2 + side].x) - 0.5 * this.foreOut) c.overreach |= 4 << side;
        }
      }
      if (f.teleport) this.gait.reset(c);
      this.footfalls = this.gait.update(c);
    } else this.footfalls = 0;
    f.runBlend = this.gaitCtx.runBlend;
    f.gaitPhase = this.gait.phase;
    f.moving = this.gaitCtx.moving && !airborne;
  }

  /** The forefeet's rest spots for this frame's kneel, and which side the rider is on. */
  private kneelRest(): void {
    const f = this.f;
    const k = f.kneel;
    // The rider's side from where the head is looking (their head while mounting).
    const lt = this.a.toModel(f.pose.lookTarget, _v);
    const toward = lt.x > 0.25 ? 1 : lt.x < -0.25 ? -1 : this.kneelSide > 0 ? 1 : -1;
    this.kneelSide += (toward - this.kneelSide) * clamp01(f.dt * 3);
    const fwd = KNEEL.fwd * this.rig.props.arm.forearm * k;
    this.outW += ((this.gaitCtx.moving ? 1 : 0) - this.outW) * clamp01(f.dt * 12);
    for (let side = 0; side < 2; side++) {
      const sx = SIDE_SIGN[side];
      const near = clamp01(this.kneelSide * sx);
      const r = this.gait.rest[2 + side];
      const b = this.foreRest[side];
      r.x = b.x + sx * ((KNEEL.out + KNEEL.nearOut * near) * k + this.foreOut * (FOLD.foreOutStand + (1 - FOLD.foreOutStand) * this.outW) * (1 - k));
      r.y = b.y;
      r.z = b.z + fwd;
    }
  }

  /**
   * The trunk, driven by the feet (a monitor lizard's walk): it rises over each hind foot at
   * mid-stance and sinks between them (an inverted pendulum), rolls over the feet that are down
   * (the swinging side's hip and shoulder hike to lift the leg) and shifts toward the side with
   * more of them down, bends its spine sideways with where the feet are (concave on the side whose
   * fore and hind feet are closest) while the neck turns back against it, and dips at each
   * footfall. On uneven ground it lowers to its lowest feet. Then the landing dip and the takeoff
   * crouch.
   */
  groundTrunk(): void {
    const f = this.f;
    const a = this.a;
    const { moving, runBlend, gaitPhase, heft, sh } = f;
    const P = this.profile;
    const gait = this.gait;
    const feet = gait.feet;
    this.moveW += ((moving ? 1 : 0) - this.moveW) * clamp01(f.dt * 4);
    const mw = this.moveW * f.groundW;
    // Support (1 planted … 0 mid-swing) per foot: LH, RH, LF, RF.
    const sLH = 1 - feet[0].airborne;
    const sRH = 1 - feet[1].airborne;
    const sLF = 1 - feet[2].airborne;
    const sRF = 1 - feet[3].airborne;
    f.pelvisRoll = P.pelvisRoll * (sRH - sLH) * f.groundW;
    f.chestRoll = P.chestRoll * (sRF - sLF) * f.groundW;
    f.gaitShift = 0.02 * sh * clamp(sLH + sLF - sRH - sRF, -1, 1) * f.groundW;
    // The pendulum: highest with one hind foot at mid-stance, lowest in the hind double support.
    const st = gait.stance;
    const pend = Math.max(st[0] >= 0 ? Math.sin(Math.PI * st[0]) : 0, st[1] >= 0 ? Math.sin(Math.PI * st[1]) : 0);
    f.gaitBob = mw * sh * (-0.01 + 0.022 * pend);
    // Footfalls: a hind foot takes the weight with a dip, a fore foot with less.
    const ff = this.footfalls;
    if (ff !== 0 && f.groundW > 0.5) {
      const k = 0.25 + 0.35 * heft;
      if (ff & 1) this.dip.velocity -= k;
      if (ff & 2) this.dip.velocity -= k;
      if (ff & 4) this.dip.velocity -= 0.6 * k;
      if (ff & 8) this.dip.velocity -= 0.6 * k;
    }
    const dipV = this.dip.step(0, f.dt);
    f.dipV = dipV;
    // The spine's sideways bend from the feet's fore-aft split (each foot's z from its rest spot,
    // body frame): (right fore − right hind) − (left fore − left hind), at most about 1.4 stance
    // lengths in the walk, nothing in the bound (each pair moves together).
    const r = gait.rest;
    const zLH = a.toModel(feet[0].pos, _v).z - r[0].z;
    const zRH = a.toModel(feet[1].pos, _v).z - r[1].z;
    const zLF = a.toModel(feet[2].pos, _v).z - r[2].z;
    const zRF = a.toModel(feet[3].pos, _v).z - r[3].z;
    const span = 1.4 * gait.duty * gait.cycleLen;
    const flex = clamp((zRF - zRH - (zLF - zLH)) / Math.max(0.2 * sh, span), -1, 1);
    f.gaitSway = mw * P.spineYaw * flex;
    // The chest turns 1.1× the sway (spine and chest bones); the neck takes back headCounter of it.
    f.gaitNeckYaw = (-P.headCounter * 1.1 * f.gaitSway) / this.rig.idx.neck.length;
    // Settle: the landing dip pitches the nose down a little and the body rocks back up.
    f.gaitPitch = moving ? -0.03 * runBlend * Math.sin(gaitPhase * Math.PI * 4) : 0;
    f.dipPitch = (dipV / sh) * (0.5 + 0.2 * heft);
    f.gaitRoll = 0;
    // Uneven ground: the body lowers and pitches so each end's lowest planted foot stays in reach
    // (the hind end by dH, the fore by dF): it drops to its lowest feet, never hanging a straight
    // leg in the air. Flat ground, or a slope the body's own tilt takes, asks nothing.
    // (Each end's drop as last applied, plus how much more its limbs asked for in last frame's IK.)
    const lim = 0.45 * sh;
    const need = this.need;
    // (The chest is quick to lower and slow to rise again: walking down a steep slope it stays
    // down along it rather than bobbing up between the forefeet's reaches.)
    const tH = f.groundW * clamp(this.dropH.value + Math.max(need[0], need[1]), 0, lim);
    const tF = f.groundW * clamp(this.dropF.value + Math.max(need[2], need[3]), 0, lim);
    this.dropF.omega = tF > this.dropF.value ? 14 : 4;
    const dH = this.dropH.step(tH, f.dt);
    const dF = this.dropF.step(tF, f.dt);
    const tilt = (dH - dF) / this.footSpan;
    f.groundDrop = -(dF + this.foreZ * tilt);
    f.groundPitch = -tilt;
    f.crouchPitch = f.takeoffCrouch ? -0.08 * f.openAmt : 0;
    // The kneel: down nose-first to a belly-down couch, rolled toward the rider.
    const kn = f.kneel * f.groundW;
    f.kneelDrop = -this.kneelDepth * kn;
    f.kneelPitch = KNEEL.pitch * kn;
    f.kneelRoll = -KNEEL.roll * kn * this.kneelSide;
    // Turning on the ground, the chest leans into the turn (3° at a full turn).
    f.turnLean = f.groundW * clamp(-0.05 * f.om.y, -3 * DEG, 3 * DEG);
    // The folded-stance wing IK weight for this frame: knuckles on the ground as front feet
    // (lifted off them to shuffle, brace or bask).
    this.ikW = f.groundW * (1 - f.openAmt) * (1 - f.shuffle * 0.65) * (1 - 0.85 * f.brace) * (1 - f.bask);
  }

  /** The ground FK wing pose (settle/shuffle/brace, raised for the takeoff, spread to bask). */
  groundWingPose(out: WingPose): void {
    const f = this.f;
    if (f.takeoffCrouch) blendPose(SETTLE, flapPose(0, 0, this.flapTmp, FLAP_STYLES[this.rig.props.breed]), f.openAmt, out);
    else blendPose(FOLDED, SETTLE, clamp01(f.openAmt * 1.4 + f.shuffle * 0.8 + f.brace), out);
    if (f.bask > 0.001) blendPose(out, BASK, f.bask, out);
  }

  /**
   * Folded stance: the wrist (with its pad and digits) is a front foot planted by the gait under
   * the shoulder; humerus + forearm reach it by two-bone IK with the elbow tucked back against the
   * flank, so the arm hangs from the shoulder like a bird's or a bat's (never a crocodile's
   * sideways elbow). The hand folds back up along the forearm and the fingers run on up its inner
   * side in a tight bundle; their outer segments fold back along the flank, the fan closed in the
   * wing's own plane, the wingtip finger riding highest. Every bone keeps its dorsal face turned
   * out, so the membrane lies along the body in a narrow pleated bundle rather than standing out as
   * a panel; the innermost finger's roll keeps the inner panel's trailing edge in to the flank
   * (trailRoll) and the fold helpers draw its interior in (foldHelpers). Blended over the FK pose
   * by this frame's IK weight.
   */
  applyWingIK(side: number): void {
    const weight = this.ikW;
    if (!(weight > 0.001)) return;
    const a = this.a;
    a.blend = weight;
    const rig = this.rig;
    const sh = this.f.sh;
    const w = rig.idx.wings[side];
    const sx = SIDE_SIGN[side];
    const rest = this.wingRestDir[side];
    const up = a.upM;
    const T = FOLD;
    // (Scalar arithmetic in place of three.js calls taking computed numbers: in a function this
    // size the JIT may not inline them, and every double passed would be boxed on the heap.)
    const fwdG = this.fwdG.copy(FWD);
    fwdG.x -= up.x * up.z;
    fwdG.y -= up.y * up.z;
    fwdG.z -= up.z * up.z;
    fwdG.normalize();
    // Out from the body (this side), level with the ground.
    const outG = _outG;
    outG.x = LEFT.x * sx;
    outG.y = LEFT.y * sx;
    outG.z = LEFT.z * sx;
    // Wrist target (model space) from the planted foot, the claws resting on the ground.
    const foot = this.gait.feet[2 + side];
    const Wt = a.toModel(foot.pos, _v3);
    const lift = 0.07 * sh;
    Wt.x += up.x * lift;
    Wt.y += up.y * lift;
    Wt.z += up.z * lift;
    const S = _v2.copy(a.modelP[w.humerus]);
    // Pole: level toward the elbow's tuck against the flank, back and a little out from the
    // shoulder (a bird's or bat's arm hanging from the shoulder, never a crocodile's sideways
    // elbow). Level, so it never lines up with the near-vertical shoulder-to-wrist line as the
    // forefoot swings through a stride.
    // The elbow lies on a circle about the shoulder-to-wrist line (the bone lengths fix it); the
    // pole picks the point on it whose distance out from the body is the tuck point's, behind the
    // line: however long the arm for its height, the elbow tucks against the flank and the extra
    // fold goes back along the body, never out sideways.
    this.elbowPole(side, S, Wt, fwdG, outG, _v4);
    const E = _v5;
    this.reachNeed(2 + side, S, Wt, 0.98 * (this.lens[0] + this.lens[1]));
    solveTwoBoneAt(S, this.lens, 0, Wt, _v4, E);
    // The hind leg, as posed this frame: the elbow swings out to clear it, and the folded fingers
    // keep ahead of its knee.
    this.legCapsules(side);
    this.clearElbow(side, S, Wt, E, outG);
    // A wall at the elbow: tuck the wing in against the body (next frame's pole, smoothed).
    this.wallProbe(side, E);
    const hum = _hum.subVectors(E, S);
    const fore = _fore.subVectors(Wt, E);
    // Every wing bone keeps its dorsal face turned out from the body: the membrane between them
    // then lies along the flank instead of standing out from it as a panel.
    // (The humerus's flat deltopectoral blade turns a little up, keeping its crest low on the flank.)
    _fd.x = outG.x + up.x * T.humRefUp;
    _fd.y = outG.y + up.y * T.humRefUp;
    _fd.z = outG.z + up.z * T.humRefUp;
    aimRotation(rest[0], UP, hum, _fd, _q);
    a.setModelBlend(w.humerus, _q);
    aimRotation(rest[1], UP, fore, outG, _q);
    a.setModelBlend(w.forearm, _q);
    // Up the forearm from the wrist.
    const back = _handD.subVectors(E, Wt).normalize();
    // The hand folds back up along the forearm, behind and just inside it.
    _fd.x = back.x + outG.x * T.handOut + fwdG.x * -T.handBack;
    _fd.y = back.y + outG.y * T.handOut + fwdG.y * -T.handBack;
    _fd.z = back.z + outG.z * T.handOut + fwdG.z * -T.handBack;
    _fd.normalize();
    aimRotation(rest[2], UP, _fd, outG, _q);
    a.setModelBlend(w.hand, _q);
    // The finger bundle rises from the knuckle up the forearm's line as it stands, but only partly
    // follows the forearm's swing through a stride: a reaching or trailing forefoot would otherwise
    // sweep the folded fingers into the chest or back over the thigh.
    const hold = T.bundleHold;
    const bx = back.x * (1 - hold) + (up.x - fwdG.x * T.bundleLean) * hold;
    const by = back.y * (1 - hold) + (up.y - fwdG.y * T.bundleLean) * hold;
    const bz = back.z * (1 - hold) + (up.z - fwdG.z * T.bundleLean) * hold;
    for (let f = 0; f < 3; f++) {
      // Inner segment: up beside the forearm, bundled on its inner side and a little behind it.
      const out = T.fingerOut + T.fingerOutStep * f;
      const behind = -T.fingerBack - T.fingerBackStep * f;
      _fd.x = bx + outG.x * out + fwdG.x * behind;
      _fd.y = by + outG.y * out + fwdG.y * behind;
      _fd.z = bz + outG.z * out + fwdG.z * behind;
      _fd.normalize();
      // Kept out of the body: where the segment ends (its outer joint) must clear the torso by the
      // finger's own thickness, or the bundle swings out to clear it.
      const kn = a.pivot(w.fingers[f][0]);
      const la = this.fingerA[f];
      // (Along it too: a kneeling body comes down onto the bundle.) The swing out it takes, as a
      // push at the segment's end.
      let need = 0;
      for (let q = 1; q <= 3; q++) {
        const u = q / 3;
        _tv1.x = kn.x + _fd.x * la * u;
        _tv1.y = kn.y + _fd.y * la * u;
        _tv1.z = kn.z + _fd.z * la * u;
        this.torsoClear(_tv1, side);
        need = Math.max(need, this.clear[0] / u);
      }
      this.clear[0] = need;
      // ...and it stays ahead of the thigh below the thigh's top, however far a trailing forefoot
      // carries the knuckle back.
      const behindHip = this.legGuard[side * 2] - _tv1.z;
      const fwdNeed = _tv1.y < this.legGuard[side * 2 + 1] && behindHip > 0 ? behindHip / la : 0;
      if (this.clear[0] > 0 || fwdNeed > 0) {
        const k = this.clear[0] / la;
        _fd.x += outG.x * k + fwdG.x * fwdNeed;
        _fd.y += outG.y * k + fwdG.y * fwdNeed;
        _fd.z += outG.z * k + fwdG.z * fwdNeed;
        _fd.normalize();
      }
      // ...and clear of the hind leg as posed this frame: leaning forward and out until it is.
      {
        const fr = T.fingerBundle * this.armR;
        const margin = T.legClear * this.f.sh;
        _tv4.copy(kn).addScaledVector(_fd, la);
        const move = this.moveW;
        for (let k = 0; k < 8 && move > 0.001 && this.legClearance(kn, _tv4, fr) < margin; k++) {
          _fd.addScaledVector(fwdG, 0.12 * move).addScaledVector(outG, 0.08 * move).normalize();
          _tv4.copy(kn).addScaledVector(_fd, la);
        }
      }
      // ...and the outer segment it carries runs back along the flank from its end without passing
      // into the body there: where that segment's first half would, the bundle leans out (the long
      // wingtip spar then rides back along the flank, not turned out across the silhouette).
      for (let pass = 0; pass < 2; pass++) {
        _tv4.x = kn.x + _fd.x * la;
        _tv4.y = kn.y + _fd.y * la;
        _tv4.z = kn.z + _fd.z * la;
        this.outerAim(side, f, _tv4);
        this.outerDir(side, f, this.aim[0], this.aim[1], _tv3);
        const lb = this.fingerB[f];
        let root = 0;
        for (let q = 1; q <= 3; q++) {
          const u = 0.17 * q;
          _tv1.x = _tv4.x + _tv3.x * lb * u;
          _tv1.y = _tv4.y + _tv3.y * lb * u;
          _tv1.z = _tv4.z + _tv3.z * lb * u;
          this.torsoClear(_tv1, side);
          root = Math.max(root, this.clear[0]);
        }
        if (!(root > 0)) break;
        const k = root / la;
        _fd.x += outG.x * k;
        _fd.y += outG.y * k;
        _fd.z += outG.z * k;
        _fd.normalize();
      }
      aimRotation(rest[3 + f], UP, _fd, outG, _q);
      a.setModelBlend(w.fingers[f][0], _q);
      // Outer segment: folded back along the flank, tips toward the tail. The fan closes in the
      // wing's own plane (each finger turned about the bind normal onto the innermost finger's
      // line, so the panels between them collapse like a closing fan instead of twisting), then
      // pitches up about the body's side axis: the inner panel's trailing edge, which hangs between
      // the flank and this finger, then runs straight from its root to the fingertip instead of
      // bowing out from the body.
      // Pitched up just enough to bring the tip to its height on the flank, and over the thigh.
      const pv = a.pivot(w.fingers[f][1]);
      const lb = this.fingerB[f];
      this.outerAim(side, f, pv);
      const rise = this.aim[0];
      const sxh = Math.sin(rise * 0.5);
      const cxh = Math.cos(rise * 0.5);
      let yaw = this.aim[1];
      for (let pass = 0; pass < 2; pass++) {
        const syh = Math.sin(yaw * 0.5);
        const cyh = Math.cos(yaw * 0.5);
        const qa = _qa;
        qa[0] = sxh * cyh;
        qa[1] = cxh * syh;
        qa[2] = sxh * syh;
        qa[3] = cxh * cyh;
        _q.fromArray(qa);
        if (pass === 1) break;
        // Its back half clears the flank too: turned out from it as far as it needs.
        _tv3.copy(rest[3 + f]).applyQuaternion(_q);
        let turn = 0;
        for (let q = 2; q <= 4; q++) {
          const d = lb * q * 0.25;
          _tv1.x = pv.x + _tv3.x * d;
          _tv1.y = pv.y + _tv3.y * d;
          _tv1.z = pv.z + _tv3.z * d;
          this.torsoClear(_tv1, side);
          if (this.clear[0] > 0) turn = Math.max(turn, Math.atan2(this.clear[0], d));
        }
        if (!(turn > 0)) break;
        // (Turning about +Y by +a swings a backward-pointing tip toward -X.)
        yaw -= sx * Math.min(0.35, turn);
      }
      // ...and over the hind leg as posed this frame: pitched up until the segment, and the
      // membrane folded along it, clear the striding thigh and shin.
      {
        const fr = T.fingerBundle * this.armR;
        const margin = T.legClear * this.f.sh;
        _tv3.copy(rest[3 + f]).applyQuaternion(_q);
        _tv4.copy(pv).addScaledVector(_tv3, lb);
        const move = this.moveW;
        if (move > 0.001 && this.legClearance(pv, _tv4, fr) < margin) {
          const yaw0 = yaw;
          // Pitched up first (over the haunch), then turned out if pitching alone cannot clear it.
          let r2 = rise;
          let clear = false;
          for (let k = 0; k < 8 && !clear; k++) {
            r2 += 0.09;
            this.outerDir(side, f, r2, yaw, _tv3);
            _tv4.copy(pv).addScaledVector(_tv3, lb);
            clear = this.legClearance(pv, _tv4, fr) >= margin;
          }
          for (let k = 0; k < 6 && !clear; k++) {
            yaw -= sx * 0.08;
            this.outerDir(side, f, r2, yaw, _tv3);
            _tv4.copy(pv).addScaledVector(_tv3, lb);
            clear = this.legClearance(pv, _tv4, fr) >= margin;
          }
          // (Eased in with the stride: none standing.)
          r2 = rise + (r2 - rise) * move;
          yaw = yaw0 + (yaw - yaw0) * move;
          const s2 = Math.sin(r2 * 0.5);
          const c2 = Math.cos(r2 * 0.5);
          const syh = Math.sin(yaw * 0.5);
          const cyh = Math.cos(yaw * 0.5);
          _qa[0] = s2 * cyh;
          _qa[1] = c2 * syh;
          _qa[2] = s2 * syh;
          _qa[3] = c2 * cyh;
          _q.fromArray(_qa);
        }
      }
      if (f === 2) this.trailRoll(side, _q);
      a.setModelBlend(w.fingers[f][1], _q);
    }
    // Claws point forward along the ground (along its slope).
    const gn = this.groundNormal(foot.normal, foot.airborne);
    const fn = FWD.x * gn.x + FWD.y * gn.y + FWD.z * gn.z;
    _fd.x = FWD.x - gn.x * fn - gn.x * 0.25 + LEFT.x * (0.2 * sx);
    _fd.y = FWD.y - gn.y * fn - gn.y * 0.25 + LEFT.y * (0.2 * sx);
    _fd.z = FWD.z - gn.z * fn - gn.z * 0.25 + LEFT.z * (0.2 * sx);
    _fd.normalize();
    aimRotation(FWD, UP, _fd, gn, _q);
    a.setModelBlend(w.claw, _q);
  }

  /**
   * Roll the innermost finger's outer segment about its own axis so the inner panel's trailing
   * edge runs straight out from the flank to the fingertip. That edge is skinned partly to the body
   * (which keeps its bind, spread-wing position) and partly to this bone, so any other roll bows its
   * middle out from the flank — the "slab". `q` (the segment's model rotation, its direction already
   * set) is rolled in place; the roll that keeps the dorsal face turning outward wins.
   */
  private trailRoll(side: number, q: Quaternion): void {
    const k = side * 12;
    const B = this.trailBind;
    const sx = SIDE_SIGN[side];
    // d' = q·d (the finger's direction), u = q·q⊥ (the bind edge midpoint's offset across it).
    const d = _tv1.set(B[k], B[k + 1], B[k + 2]).applyQuaternion(q);
    const u = _tv2.set(B[k + 3], B[k + 4], B[k + 5]).applyQuaternion(q);
    const wv = _tv3.crossVectors(d, u);
    const qd = B[k + 6];
    const pMidX = B[k + 7];
    const trailX = B[k + 8];
    const tipLen = B[k + 9];
    // The finger's pivot and tip (model frame; the tip doesn't depend on the roll).
    const m2 = this.a.modelP[this.rig.idx.wings[side].fingers[2][1]];
    const tipX = m2.x + d.x * tipLen;
    // x of the bind midpoint carried by this bone, so the edge's middle sits half-way across.
    const c = trailX + tipX - pMidX - m2.x - qd * d.x;
    const A = u.x;
    const Bv = wv.x;
    const R = Math.sqrt(A * A + Bv * Bv);
    const base = Math.atan2(Bv, A);
    let psi = base;
    if (R > 1e-6) {
      const r = c / R;
      if (r >= 1) psi = base;
      else if (r <= -1) psi = base + Math.PI;
      else {
        // Two rolls satisfy it: keep the one whose dorsal face (q·UP rolled) points out more.
        const ac = Math.acos(r);
        const up0 = _tv4.copy(UP).applyQuaternion(q);
        // Dorsal x after rolling by ±ac about d (Rodrigues; only x is needed).
        const dn = d.x * (d.x * up0.x + d.y * up0.y + d.z * up0.z);
        const cx = d.y * up0.z - d.z * up0.y;
        const p1 = base + ac;
        const p2 = base - ac;
        const x1 = up0.x * Math.cos(p1) + cx * Math.sin(p1) + dn * (1 - Math.cos(p1));
        const x2 = up0.x * Math.cos(p2) + cx * Math.sin(p2) + dn * (1 - Math.cos(p2));
        psi = x1 * sx >= x2 * sx ? p1 : p2;
      }
    }
    const sh = Math.sin(psi * 0.5);
    const qa = _qa;
    qa[0] = d.x * sh;
    qa[1] = d.y * sh;
    qa[2] = d.z * sh;
    qa[3] = Math.cos(psi * 0.5);
    q.premultiply(_qr.fromArray(qa));
  }

  /**
   * The folded elbow's pole (into `out`): toward the point on the elbow's circle (about the
   * shoulder-to-wrist line, its radius set by the bone lengths) that stands out from the body by
   * the tuck point's distance (less any wall pull), on the circle's back half. When no point is
   * that far in or out, the nearest one.
   */
  private elbowPole(side: number, S: Vector3, W: Vector3, fwdG: Vector3, outG: Vector3, out: Vector3): void {
    const L = this.lens;
    const h = L[0];
    const f = L[1];
    let nx = W.x - S.x;
    let ny = W.y - S.y;
    let nz = W.z - S.z;
    const dist = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= dist;
    ny /= dist;
    nz /= dist;
    const d = clamp(dist, Math.abs(h - f) * 1.001 + 1e-4, (h + f) * 0.9995);
    const ca = (h * h - f * f + d * d) / (2 * d);
    const rr = Math.sqrt(Math.max(0, h * h - ca * ca));
    // u: back, perpendicular to the line; v: across it, toward this side's outside.
    let ux = -fwdG.x;
    let uy = -fwdG.y;
    let uz = -fwdG.z;
    const un = ux * nx + uy * ny + uz * nz;
    ux -= nx * un;
    uy -= ny * un;
    uz -= nz * un;
    const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    let vx = ny * uz - nz * uy;
    let vy = nz * ux - nx * uz;
    let vz = nx * uy - ny * ux;
    if (vx * outG.x + vy * outG.y + vz * outG.z < 0) {
      vx = -vx;
      vy = -vy;
      vz = -vz;
    }
    // Out from the body along outG: the circle's centre's, and its spokes'.
    const cOut = (S.x + nx * ca) * outG.x + (S.y + ny * ca) * outG.y + (S.z + nz * ca) * outG.z;
    const A = rr * (ux * outG.x + uy * outG.y + uz * outG.z);
    const B = rr * (vx * outG.x + vy * outG.y + vz * outG.z);
    const target = this.elbowAt.x - this.wallPull[side] - cOut;
    const R = Math.sqrt(A * A + B * B);
    const phi = Math.atan2(B, A);
    let th = phi;
    if (R > 1e-6) {
      const r = target / R;
      if (r >= 1) th = phi;
      else if (r <= -1) th = phi + Math.PI;
      else {
        // Of the two, the one further back (cos θ larger along u).
        const ac = Math.acos(r);
        th = Math.cos(phi + ac) >= Math.cos(phi - ac) ? phi + ac : phi - ac;
      }
    }
    const c = Math.cos(th);
    const sn = Math.sin(th);
    out.x = ux * c + vx * sn;
    out.y = uy * c + vy * sn;
    out.z = uz * c + vz * sn;
  }

  /**
   * Environment awareness for the folded wing (C16): the distance from the elbow (body frame `E`)
   * to the nearest solid; within reach, the wing is drawn in toward the body (wallPull, eased),
   * and lets go again in open ground. One distance query per wing per frame, and only for a
   * wyvern given a terrain with a distance field (the player's own).
   */
  private wallProbe(side: number, E: Vector3): void {
    const t = this.terrain;
    const f = this.f;
    let target = 0;
    if (t && t.distance) {
      const r = 0.17 * this.armR;
      const d = t.distance(this.a.toWorld(E, _tv4)) - r;
      target = d < FOLD.wallReach ? Math.min(FOLD.wallMax, FOLD.wallReach - d) : 0;
    }
    const w = this.wallPull;
    w[side] += (target - w[side]) * clamp01(f.dt * 6);
  }

  /**
   * How far a body-frame point on `side` must move out from the body to clear the torso's flank by
   * a finger's thickness (into this.clear[0]; 0 when clear). The trunk is taken as the root carries
   * it (the spine's small bends ignored).
   */
  private torsoClear(p: Vector3, side: number): void {
    const a = this.a;
    // Into the root's frame.
    const rq = a.modelQ[this.rig.idx.root];
    const rp = a.modelP[this.rig.idx.root];
    _tv2.subVectors(p, rp).applyQuaternion(_qr.copy(rq).invert());
    const T = this.torso;
    const n = T.length / 6;
    // Nearest section by z (they are in order, front to back).
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(T[i * 6] - _tv2.z);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    const o = best * 6;
    const dy = _tv2.y - T[o + 1];
    const hv = dy > 0 ? T[o + 3] : T[o + 4];
    const sq = T[o + 5];
    const ty = Math.min(1, Math.abs(dy) / hv);
    const width = bd > 0.3 ? 0 : T[o + 2] * Math.pow(Math.max(0, 1 - Math.pow(ty, sq)), 1 / sq);
    const need = width + FOLD.fingerClear * this.armR - _tv2.x * SIDE_SIGN[side];
    this.clear[0] = need > 0 && width > 0 ? need : 0;
  }

  /**
   * The hind leg on this side as posed this frame (legs are applied before the wings): thigh and
   * shin capsules into _leg (hip, knee, ankle), and this frame's finger guard: the bind guard, or
   * the knee's front when a stride carries it further forward.
   */
  private legCapsules(side: number): void {
    const a = this.a;
    const l = this.rig.idx.legs[side];
    _leg[0].copy(a.pivot(l.thigh));
    _leg[1].copy(a.pivot(l.shin));
    _leg[2].copy(a.pivot(l.meta));
    const R = this.thighR;
    this.legGuard[side * 2] = Math.max(this.hipGuard[0], _leg[1].z + 0.6 * R);
    this.legGuard[side * 2 + 1] = this.hipGuard[1];
  }

  /** How far the arm segment p→q clears the posed hind leg (m; negative: into it). */
  private legClearance(p: Vector3, q: Vector3, armR: number): number {
    const R = this.thighR;
    let best = 1e9;
    for (let c = 0; c < 2; c++) {
      const A = _leg[c];
      const B = _leg[c + 1];
      const ra = c === 0 ? 0.9 * R : 0.45 * R;
      const rb = c === 0 ? 0.5 * R : 0.3 * R;
      _cd.subVectors(B, A);
      const L2 = _cd.lengthSq();
      for (let i = 0; i <= 8; i++) {
        _cp.lerpVectors(p, q, i / 8);
        const t = L2 > 1e-12 ? clamp01(_cs.subVectors(_cp, A).dot(_cd) / L2) : 0;
        _cs.copy(A).addScaledVector(_cd, t);
        const d = _cp.distanceTo(_cs) - (ra + (rb - ra) * t) - armR;
        if (d < best) best = d;
      }
    }
    return best;
  }

  /**
   * Swing the folded elbow E out about the shoulder (S) to wrist (W) line, both fixed, until the
   * humerus and forearm clear the posed hind leg (FOLD.legClear); smoothed per side. The elbow's
   * circle about that line is the one the bone lengths allow, so the two-bone solution stays exact.
   */
  private clearElbow(side: number, S: Vector3, W: Vector3, E: Vector3, outG: Vector3): void {
    const T = FOLD;
    _ax.subVectors(W, S);
    const L = _ax.length();
    if (L < 1e-6) return;
    _ax.multiplyScalar(1 / L);
    _ec.copy(S).addScaledVector(_ax, _cs.subVectors(E, S).dot(_ax));
    _eu.subVectors(E, _ec);
    const r = _eu.length();
    if (r < 1e-4) return;
    _eu.multiplyScalar(1 / r);
    _ev.crossVectors(_ax, _eu);
    if (_ev.dot(outG) < 0) _ev.negate();
    // The arm's reach toward the leg: its tube and the folded membrane bundled on its inner side.
    const armR = T.armBundle * this.armR;
    const margin = T.legClear * this.f.sh;
    const clear = (th: number) => {
      _et.copy(_ec).addScaledVector(_eu, r * Math.cos(th)).addScaledVector(_ev, r * Math.sin(th));
      return Math.min(this.legClearance(S, _et, armR), this.legClearance(_et, W, armR)) - margin;
    };
    // Only striding: standing, kneeling and basking keep their own measured-clean folds.
    const move = this.moveW;
    let target = 0;
    if (move > 0.001 && clear(0) < 0) {
      let bestTh = 0;
      let bestC = -1e9;
      target = NaN;
      for (let k = 1; k <= 14 && Number.isNaN(target); k++) {
        const th = (k / 14) * T.elbowSwingMax;
        const c = clear(th);
        if (c >= 0) target = th;
        else if (c > bestC) {
          bestC = c;
          bestTh = th;
        }
      }
      if (Number.isNaN(target)) target = bestTh;
      target *= move;
    }
    const cur = this.elbowSwing[side];
    const rate = target > cur ? T.swingOut : T.swingIn;
    const th = cur + (target - cur) * clamp01(this.f.dt * rate);
    this.elbowSwing[side] = th;
    if (th !== 0) E.copy(_ec).addScaledVector(_eu, r * Math.cos(th)).addScaledVector(_ev, r * Math.sin(th));
  }

  /**
   * Where finger f's outer segment points from its inner joint `pv` (body frame), as a pitch up
   * and a yaw (rad, into aim[0] and aim[1]; see outerDir). The wingtip spar aims its tip at the
   * croup's height, in over its side, however long it is: it rises back along the flank like a
   * resting pterosaur's wing finger and reads above the hips, never across the haunch. The others fold back along the flank (the fan closed),
   * pitched up to their tips' heights there, and steeper still if a tip would reach back over the
   * thigh below its top: the folded fingertips ride ahead of or above the hind leg, never into it.
   */
  private outerAim(side: number, f: number, pv: Vector3): void {
    const T = FOLD;
    const lb = this.fingerB[f];
    if (f === 0) {
      const dx = SIDE_SIGN[side] * T.tipIn * this.croup[1] - pv.x;
      const dy = this.croup[0] - pv.y;
      const h2 = lb * lb - dx * dx - dy * dy;
      // (Too short to get there: as far back as it reaches toward it.)
      const dz = -Math.sqrt(Math.max(0.04 * lb * lb, h2));
      const n = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const ux = dx / n;
      this.aim[0] = clamp(Math.atan2(dy / n, -dz / n), T.riseMin, T.riseMax);
      const r = this.wingRestDir[side][3];
      this.aim[1] = Math.atan2(ux, -Math.sqrt(Math.max(0, 1 - ux * ux))) - Math.atan2(r.x, r.z);
      return;
    }
    const tipY = this.flankMid[0] + (T.tipH - T.tipHStep * (f - 1)) * this.flankMid[1];
    const sinR = (tipY - pv.y) / lb;
    let rise = sinR >= 1 ? T.riseMax : sinR <= -1 ? T.riseMin : clamp(Math.asin(sinR), T.riseMin, T.riseMax);
    const hipZ = this.legGuard[side * 2];
    if (pv.y + Math.sin(rise) * lb < this.legGuard[side * 2 + 1] && pv.z - Math.cos(rise) * lb < hipZ) {
      const c = (pv.z - hipZ) / lb;
      rise = Math.max(rise, c >= 1 ? 0 : c <= -1 ? Math.PI * 0.5 : Math.min(Math.PI * 0.5, Math.acos(c)));
    }
    this.aim[0] = rise;
    this.aim[1] = this.fanClose[side * 3 + f];
  }

  /** Finger f's outer segment direction (body frame) at pitch `rise` and fan yaw `yaw`. */
  private outerDir(side: number, f: number, rise: number, yaw: number, out: Vector3): Vector3 {
    const sxh = Math.sin(rise * 0.5);
    const cxh = Math.cos(rise * 0.5);
    const syh = Math.sin(yaw * 0.5);
    const cyh = Math.cos(yaw * 0.5);
    _qa[0] = sxh * cyh;
    _qa[1] = cxh * syh;
    _qa[2] = sxh * syh;
    _qa[3] = cxh * cyh;
    return out.copy(this.wingRestDir[side][3 + f]).applyQuaternion(_q2.fromArray(_qa));
  }

  /**
   * The fold helpers' transforms this frame (body frame, composed onto their rest hold by
   * Wyvern): with the wings folded on the ground the inner panel's interior is drawn in toward the
   * folded arm, so the membrane bunches into a narrow pleated bundle beside it instead of
   * standing out from the flank as a sheet. Identity in the air.
   */
  foldHelpers(): void {
    const a = this.a;
    const fold = this.f.fold;
    const T = FOLD;
    const r = 0.17 * this.armR;
    for (let side = 0; side < 2; side++) {
      const e = a.foldXform[side].elements;
      if (!(fold > 0.001)) {
        e[0] = e[5] = e[10] = e[15] = 1;
        e[1] = e[2] = e[3] = e[4] = e[6] = e[7] = e[8] = e[9] = e[11] = e[12] = e[13] = e[14] = 0;
        continue;
      }
      const sx = SIDE_SIGN[side];
      // About the folded elbow (fore and aft, up and down), and across about the elbow's inner
      // face or the shoulders' flank, whichever is further out (never drawn into the body).
      const el = a.modelP[this.rig.idx.wings[side].forearm];
      const px = sx * Math.max(el.x * sx - r, this.flankX * T.helperFlank);
      const kx = 1 + (T.helperX - 1) * fold;
      const ky = 1 + (T.helperY - 1) * fold;
      const kz = 1 + (T.helperZ - 1) * fold;
      e[0] = kx;
      e[5] = ky;
      e[10] = kz;
      e[15] = 1;
      e[1] = e[2] = e[3] = e[4] = e[6] = e[7] = e[8] = e[9] = e[11] = 0;
      e[12] = (1 - kx) * px;
      e[13] = (1 - ky) * el.y;
      e[14] = (1 - kz) * el.z;
    }
  }

  /** Both legs: the flight poses (FK) blended with ground IK to the planted feet. */
  applyLegs(): void {
    const legAirW = this.f.legAirW;
    for (let side = 0; side < 2; side++) {
      this.applyLegFK(side);
      if (legAirW < 0.999) this.applyLegIK(side);
    }
  }

  /** Contact points for the next touchdown (hind: under the ball of the foot, fore: knuckle). */
  contacts(): void {
    const a = this.a;
    const I = this.rig.idx;
    for (let side = 0; side < 2; side++) {
      a.toWorld(a.modelP[I.legs[side].toes], this.footWorld[side]);
      a.toWorld(a.modelP[I.wings[side].claw], this.footWorld[2 + side]);
    }
  }

  /**
   * How much lower limb root `root` must be for its target `tip` (body frame) to sit at reach
   * `R` (m; negative: how much it could rise and still reach), written into this.need[i]; a foot
   * late in its swing asks it of where it will land, one early in it nothing.
   */
  private reachNeed(i: number, root: Vector3, tip: Vector3, R: number): void {
    const up = this.a.upM;
    const foot = this.gait.feet[i];
    let dx = tip.x - root.x;
    let dy = tip.y - root.y;
    let dz = tip.z - root.z;
    if (foot.swinging) {
      // Through the later part of a swing, where it will land (so the body is lowered in time).
      if (foot.s < (i < 2 ? 0.5 : 0.25)) {
        this.need[i] = -this.f.sh;
        return;
      }
      if (i < 2) {
        // The ankle over the landing spot as the foot will stand there (heel down: the swing's
        // lifted heel would overstate it).
        const G = this.rig.props.leg;
        const q = this.a.toModel(foot.target, _gn);
        const fz = up.z;
        const b = (G.meta * Math.sin(this.metaAngle)) / Math.sqrt(Math.max(1e-9, 1 - fz * fz));
        const u = G.sole + G.meta * Math.cos(this.metaAngle);
        dx = q.x + up.x * u + up.x * fz * b - root.x;
        dy = q.y + up.y * u + up.y * fz * b - root.y;
        dz = q.z + up.z * u + (up.z * fz - 1) * b - root.z;
      } else {
        const d = _gn.subVectors(foot.target, foot.pos).applyQuaternion(this.a.qWInv);
        dx += d.x;
        dy += d.y;
        dz += d.z;
      }
    }
    const dUp = dx * up.x + dy * up.y + dz * up.z;
    const h2 = dx * dx + dy * dy + dz * dz - dUp * dUp;
    this.need[i] = -dUp - Math.sqrt(Math.max(0, R * R - h2));
  }

  /**
   * A foot's ground normal in the body frame (into _gn), blended back to up by `lift` (0..1, the
   * foot's airborne share).
   */
  private groundNormal(n: Vector3, lift: number): Vector3 {
    const up = this.a.upM;
    const g = _gn.copy(n).applyQuaternion(this.a.qWInv);
    g.x += (up.x - g.x) * lift;
    g.y += (up.y - g.y) * lift;
    g.z += (up.z - g.z) * lift;
    return g.normalize();
  }

  /**
   * The four ground contacts (LH, RH, LF, RF; world) as the gait plants them, and how firmly each
   * is down (1 planted … 0 lifted or in the air). Returns how many were written.
   */
  footContacts(outPos: Vector3[], outW: { [i: number]: number }): number {
    const groundW = this.f.groundW;
    const n = Math.min(4, outPos.length);
    for (let i = 0; i < n; i++) {
      const foot = this.gait.feet[i];
      outPos[i].copy(foot.pos);
      outW[i] = groundW * (1 - foot.airborne);
    }
    return n;
  }

  // --- Legs --------------------------------------------------------------------------------------

  /**
   * Blend a leg bone direction (pelvis space, left; mirrored) from the four poses in LEG_POSES
   * (row 0 thigh, 1 shin, 2 meta), with this frame's weights in `legW`.
   */
  private legDir(out: Vector3, row: number): Vector3 {
    const P = LEG_POSES;
    const g = this.legW;
    const tuckAmt = g[0];
    const dangle = 1 - tuckAmt;
    const o = row * 12;
    // The dangling pose swings with the body (legSwing) and droops when tired.
    const dy = P[o + 4] - (row === 0 ? 0.05 * g[4] : 0);
    const dz = P[o + 5] - g[5] * (row === 2 ? 0.5 : 1);
    out.set(P[o] * tuckAmt + P[o + 3] * dangle, P[o + 1] * tuckAmt + dy * dangle, P[o + 2] * tuckAmt + dz * dangle);
    out.lerp(_lv.set(P[o + 6], P[o + 7], P[o + 8]), g[1]);
    out.lerp(_lv.set(P[o + 9], P[o + 10], P[o + 11]), g[2]);
    out.x *= g[3];
    return out.normalize();
  }

  private applyLegFK(side: number): void {
    const a = this.a;
    const f = this.f;
    const l = this.rig.idx.legs[side];
    const rest = this.legRestDir[side];
    const pq = a.modelQ[a.parent[l.thigh]];
    const g = this.legW;
    const tuckAmt = f.legTuck;
    const reach = f.legReach;
    const push = f.legPush;
    g[0] = tuckAmt;
    g[1] = reach;
    g[2] = push;
    g[3] = SIDE_SIGN[side];
    g[4] = f.fatigue;
    // Dangling legs swing back and forth with the body's fore-aft acceleration.
    g[5] = f.legSwing * (1 - tuckAmt);
    const thigh = this.legDir(_v, 0);
    const shin = this.legDir(_v2, 1);
    const meta = this.legDir(_v3, 2);
    thigh.applyQuaternion(pq);
    shin.applyQuaternion(pq);
    meta.applyQuaternion(pq);
    const lat = _ref.copy(LEFT).applyQuaternion(pq);
    aimRotation(rest[0], LEFT, thigh, lat, _q);
    a.setModel(l.thigh, _q);
    aimRotation(rest[1], LEFT, shin, lat, _q);
    a.setModel(l.shin, _q);
    aimRotation(rest[2], LEFT, meta, lat, _q);
    a.setModel(l.meta, _q);
    // Toes: curled while tucked or dangling, spread forward when reaching.
    const curl = (0.9 * tuckAmt + 0.55 * (1 - tuckAmt)) * (1 - reach) * (1 - push * 0.5) - 0.15 * reach;
    const e = this.toeAng;
    e[0] = curl;
    e[1] = 0;
    e[2] = 0;
    a.setEulerAt(l.toes, e, 0);
  }

  private applyLegIK(side: number): void {
    const a = this.a;
    const rig = this.rig;
    a.blend = 1 - this.f.legAirW;
    const l = rig.idx.legs[side];
    const G = rig.props.leg;
    const rest = this.legRestDir[side];
    const foot = this.gait.feet[side];
    const up = a.upM;
    // (Scalar arithmetic in place of three.js calls taking computed numbers; see applyWingIK.)
    const fwdG = this.fwdG.copy(FWD);
    fwdG.x -= up.x * up.z;
    fwdG.y -= up.y * up.z;
    fwdG.z -= up.z * up.z;
    fwdG.normalize();
    // The ground's normal under the foot (body frame), easing back to up as the foot lifts.
    const gn = this.groundNormal(foot.normal, foot.airborne);
    // Ball of the foot above the planted sole.
    const sole = G.sole;
    const ball = a.toModel(foot.pos, _v);
    ball.x += gn.x * sole;
    ball.y += gn.y * sole;
    ball.z += gn.z * sole;
    // Metatarsus leans forward at the breed's own angle (near flat on the ironback); more when the
    // heel lifts during a swing. Late in a stance the heel rises for the push-off (the metatarsus
    // stands up toward vertical, the ankle toward the hip): the leg reaches its stride's end. (Only
    // as far as the leg is stretched: a foot planted up a slope behind it keeps its heel down.)
    const st = this.gait.stance[side];
    const heel = st > 0.5 ? 0.8 * this.metaAngle * smoothstep(0.5, 1, st) * this.moveW * smoothstep(-0.15 * this.f.sh, 0, this.need[side]) : 0;
    const ang = this.metaAngle + (KNEEL.metaFlat - this.metaAngle) * this.f.kneel + foot.airborne * 0.5 - heel;
    const ca = -Math.cos(ang);
    const sa = Math.sin(ang);
    const metaDir = _v3;
    metaDir.x = up.x * ca + fwdG.x * sa;
    metaDir.y = up.y * ca + fwdG.y * sa;
    metaDir.z = up.z * ca + fwdG.z * sa;
    const ml = -G.meta;
    const ankle = _v4;
    ankle.x = ball.x + metaDir.x * ml;
    ankle.y = ball.y + metaDir.y * ml;
    ankle.z = ball.z + metaDir.z * ml;
    const hip = a.modelP[l.thigh];
    const out = 0.12 * SIDE_SIGN[side];
    const pole = _v5;
    pole.x = fwdG.x + LEFT.x * out;
    pole.y = fwdG.y + LEFT.y * out;
    pole.z = fwdG.z + LEFT.z * out;
    const knee = _hum;
    this.reachNeed(side, hip, ankle, 0.98 * (G.thigh + G.shin));
    solveTwoBoneAt(hip, this.lens, 2, ankle, pole, knee);
    const lat = _ref.copy(LEFT).applyQuaternion(a.modelQ[a.parent[l.thigh]]);
    aimRotation(rest[0], LEFT, _fore.subVectors(knee, hip), lat, _q);
    a.setModelBlend(l.thigh, _q);
    aimRotation(rest[1], LEFT, _fore.subVectors(ankle, a.pivot(l.shin)), lat, _q);
    a.setModelBlend(l.shin, _q);
    aimRotation(rest[2], LEFT, _fore.subVectors(ball, a.pivot(l.meta)), lat, _q);
    a.setModelBlend(l.meta, _q);
    // Toes flat on the ground in stance (along its slope), pointing down as the foot lifts.
    const down = -0.9 * foot.airborne;
    const fn = FWD.x * gn.x + FWD.y * gn.y + FWD.z * gn.z;
    _fd.x = FWD.x - gn.x * fn + gn.x * down;
    _fd.y = FWD.y - gn.y * fn + gn.y * down;
    _fd.z = FWD.z - gn.z * fn + gn.z * down;
    _fd.normalize();
    aimRotation(FWD, UP, _fd, gn, _q);
    a.setModelBlend(l.toes, _q);
  }

}
