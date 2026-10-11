// The rider's skinned body: torso, neck, arms, hands, legs, boots, head and face, all lofted
// procedurally in bind space and weighted to the rig. Outfits color and inflate these surfaces
// through an OutfitStyle and add their own garment pieces (outfits.ts).

import { Color, Quaternion, Vector3 } from 'three';
import type { RiderGarmentSlot, RiderLook } from '../../core/types';
import { B, bindPositions, type BoneName, type RigDims } from './rig';
import { SkinBuilder, sk, sk2, type RingSpec, type SkinSpec } from './meshKit';
import type { RiderPalette } from './palette';
import { mixSrgb } from './palette';
import type { ClothSpec } from './accessories';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export type Side = 1 | -1; // +1 = left (+X), −1 = right

/** How an outfit colors and shapes the base body. Angles: θ = 0 at +X (left), π/2 front. */
export interface OutfitStyle {
  torso: {
    color(y: number, th: number, p: Vector3): Color;
    inflate(y: number, th: number): number;
    /** Heights (bind y) of crisp horizontal color/inflation edges. */
    bounds: number[];
    surface?: 'linen' | 'leather';
  };
  /** s = meters down the arm from the shoulder joint. */
  arm: { color(s: number, th: number, side: Side): Color; inflate(s: number): number; bounds: number[]; surface?: 'linen' | 'leather' };
  /** s = meters down the leg from the hip joint. */
  leg: { color(s: number, th: number, side: Side): Color; inflate(s: number): number; bounds: number[]; gatherHem?: number; clothEnd?: number; bootStart?: number };
  modular?: boolean;
  hand: Color;
  /** Glove cuff color if gloved. */
  cuff?: Color;
  foot: { color: Color; sole: Color };
  extras(ctx: BodyCtx, part?: RiderGarmentSlot): void;
  /** Face builder; normal rider models use the shared refined sculpt. */
  head?(ctx: BodyCtx): void;
  /** Body surface builders. Outfit colors, inflation and garments remain independent. */
  shape?: {
    upperBody(ctx: BodyCtx, style: OutfitStyle): void;
    hand(ctx: BodyCtx, style: OutfitStyle, side: Side): void;
    foot(ctx: BodyCtx, style: OutfitStyle, side: Side): void;
    leg?(ctx: BodyCtx, style: OutfitStyle, side: Side): void;
  };
}

export interface BodyCtx {
  b: SkinBuilder;
  d: RigDims;
  bp: Record<BoneName, Vector3>;
  look: RiderLook;
  pal: RiderPalette;
  /** Local cloth panels collected by garment builders; never duplicate the static panels. */
  garmentCloth: ClothSpec[];
  legStyle?: OutfitStyle['leg'];
  /** Torso surface (bind space) for garments that hug it. */
  torsoAt(y: number): TorsoSection;
  /** Leg radius at s meters below the hip joint. */
  legAt(s: number): { rx: number; rf: number; rb: number };
  armAt(s: number): { rx: number; rz: number };
  /** Head geometry for hair and headgear (bind space). */
  head: HeadInfo;
}

export interface TorsoSection {
  rx: number;
  /** Front depth. */
  rf: number;
  /** Back depth. */
  rb: number;
  cz: number;
}

export interface HeadInfo {
  /** Cranium center. */
  center: Vector3;
  radii: Vector3;
  /** Surface point in direction (unit) from the center, before face deformation. */
  surface(dir: Vector3, out: Vector3, inflate?: number): Vector3;
}

// --- Profiles ---------------------------------------------------------------------------------

/** Cubic Hermite through keyed rows [x, v1, v2, ...]; returns column `col` at x. */
export function hermite(keys: readonly (readonly number[])[], x: number, col: number): number {
  const n = keys.length;
  if (x <= keys[0][0]) return keys[0][col];
  if (x >= keys[n - 1][0]) return keys[n - 1][col];
  let i = 0;
  while (i < n - 2 && x > keys[i + 1][0]) i++;
  const x0 = keys[i][0];
  const x1 = keys[i + 1][0];
  const h = x1 - x0;
  const t = (x - x0) / h;
  const v0 = keys[i][col];
  const v1 = keys[i + 1][col];
  const slope = (a: number, b: number) => (keys[b][col] - keys[a][col]) / (keys[b][0] - keys[a][0]);
  const m0 = i > 0 ? 0.5 * (slope(i - 1, i) + slope(i, i + 1)) : slope(i, i + 1);
  const m1 = i + 2 < n ? 0.5 * (slope(i, i + 1) + slope(i + 1, i + 2)) : slope(i, i + 1);
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * h * m1;
}

// y (medium, m), rx, front depth, back depth, center z
const TORSO_KEYS = [
  [0.83, 0.07, 0.055, 0.055, -0.004],
  [0.86, 0.13, 0.082, 0.09, -0.006],
  [0.9, 0.158, 0.096, 0.112, -0.006],
  [0.96, 0.163, 0.098, 0.106, -0.002],
  [1.02, 0.151, 0.096, 0.088, 0.002],
  [1.09, 0.139, 0.092, 0.08, 0.004],
  [1.16, 0.147, 0.1, 0.084, 0.003],
  [1.235, 0.162, 0.11, 0.09, 0],
  [1.3, 0.166, 0.106, 0.094, -0.004],
  [1.36, 0.162, 0.094, 0.092, -0.01],
  [1.4, 0.138, 0.078, 0.084, -0.014],
  [1.43, 0.098, 0.062, 0.068, -0.016],
  [1.455, 0.062, 0.05, 0.056, -0.012],
] as const;

// s below the hip joint (m), rx, front, back
const LEG_KEYS = [
  [-0.07, 0.078, 0.08, 0.084],
  [0.0, 0.086, 0.088, 0.094],
  [0.1, 0.082, 0.085, 0.086],
  [0.22, 0.071, 0.074, 0.07],
  [0.34, 0.059, 0.063, 0.056],
  [0.42, 0.054, 0.059, 0.05],
  [0.5, 0.054, 0.053, 0.066],
  [0.58, 0.05, 0.048, 0.064],
  [0.68, 0.042, 0.042, 0.046],
  [0.78, 0.036, 0.037, 0.037],
  [0.84, 0.034, 0.035, 0.035],
] as const;

// s below the shoulder joint (m), rx, rz
const ARM_KEYS = [
  [-0.035, 0.04, 0.042],
  [0.03, 0.046, 0.048],
  [0.14, 0.044, 0.047],
  [0.24, 0.04, 0.043],
  [0.28, 0.037, 0.04],
  [0.34, 0.04, 0.041],
  [0.42, 0.033, 0.035],
  [0.5, 0.025, 0.031],
  [0.535, 0.022, 0.03],
] as const;

/** Sample positions from a..b every `step`, plus a pair straddling each boundary for crisp edges. */
export function stops(a: number, b: number, step: number, bounds: readonly number[], eps = 0.0016): number[] {
  const out: number[] = [];
  const n = Math.max(1, Math.round(Math.abs(b - a) / step));
  for (let i = 0; i <= n; i++) out.push(a + ((b - a) * i) / n);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  for (const v of bounds) {
    if (v - eps <= lo || v + eps >= hi) continue;
    out.push(v - eps, v + eps);
  }
  out.sort((x, y) => (b >= a ? x - y : y - x));
  // Drop near-duplicates that aren't boundary pairs.
  const res: number[] = [];
  for (const v of out) {
    const last = res[res.length - 1];
    if (last !== undefined && Math.abs(v - last) < eps * 0.5) continue;
    const isPair = bounds.some((bb) => Math.abs(Math.abs(v - bb) - eps) < 1e-9);
    if (last !== undefined && !isPair && Math.abs(v - last) < step * 0.35) {
      const lastIsPair = bounds.some((bb) => Math.abs(Math.abs(last - bb) - eps) < 1e-9);
      if (lastIsPair) continue;
    }
    res.push(v);
  }
  return res;
}

// --- Builder ----------------------------------------------------------------------------------

export function makeBodyCtx(b: SkinBuilder, d: RigDims, look: RiderLook, pal: RiderPalette, headShape = shapeHead): BodyCtx {
  const bp = bindPositions(d);
  const torsoAt = (y: number): TorsoSection => {
    const ym = y / d.h;
    const wk = 0.55 * d.w + 0.45 * d.g;
    return {
      rx: hermite(TORSO_KEYS, ym, 1) * wk,
      rf: hermite(TORSO_KEYS, ym, 2) * d.g,
      rb: hermite(TORSO_KEYS, ym, 3) * d.g,
      cz: hermite(TORSO_KEYS, ym, 4),
    };
  };
  const legAt = (s: number) => {
    const sm = s / d.h;
    return { rx: hermite(LEG_KEYS, sm, 1) * d.g, rf: hermite(LEG_KEYS, sm, 2) * d.g, rb: hermite(LEG_KEYS, sm, 3) * d.g };
  };
  const armAt = (s: number) => {
    const sm = s / d.h;
    const gk = 0.3 + 0.7 * d.g;
    return { rx: hermite(ARM_KEYS, sm, 1) * gk, rz: hermite(ARM_KEYS, sm, 2) * gk };
  };
  const hc = bp.head.clone().add(new Vector3(0, 0.1 * d.h, 0.016));
  const hr = d.head.clone();
  const head: HeadInfo = {
    center: hc,
    radii: hr,
    surface(dir, out, inflate = 0) {
      const u = dir.clone().normalize();
      headShape(u);
      return out.set(u.x * (hr.x + inflate), u.y * (hr.y + inflate), u.z * (hr.z + inflate)).add(hc);
    },
  };
  return { b, d, bp, look, pal, torsoAt, legAt, armAt, head, garmentCloth: [] };
}

/** Sculpt the unit cranium sphere into a soft stylized head: tapered jaw, rounded back. */
export function shapeHead(u: Vector3): void {
  const k = smooth(0.15, -1, u.y);
  u.x *= 1 - 0.36 * Math.pow(k, 1.25);
  if (u.z < 0) u.z *= 1 - 0.32 * k;
  else u.z *= 1 - 0.06 * k;
  // A slightly fuller back of the skull and a flatter face plane for the features.
  if (u.z < 0 && u.y > -0.4) u.z *= 1.05;
  if (u.z > 0.55) u.z = 0.55 + (u.z - 0.55) * 0.8;
  // Soft cheeks.
  const ch = Math.exp(-((Math.abs(u.x) - 0.55) ** 2 + (u.y + 0.3) ** 2 + (u.z - 0.7) ** 2) / 0.06);
  u.x *= 1 + 0.06 * ch;
  u.z *= 1 + 0.03 * ch;
  // Chin.
  const chin = Math.exp(-(u.x * u.x + (u.y + 0.92) ** 2 + (u.z - 0.4) ** 2) / 0.05);
  u.z += 0.05 * chin;
}

export function buildBody(ctx: BodyCtx, style: OutfitStyle): void {
  ctx.legStyle = style.leg;
  if (style.shape) style.shape.upperBody(ctx, style);
  else { buildTorso(ctx, style); buildNeck(ctx); }
  for (const side of [1, -1] as const) {
    if (style.shape) style.shape.hand(ctx, style, side);
    else { buildArm(ctx, style, side); buildHand(ctx, style, side); }
    (style.shape?.leg ?? buildLeg)(ctx, style, side);
    (style.shape?.foot ?? buildFoot)(ctx, style, side);
  }
  (style.head ?? buildHead)(ctx);
  style.extras(ctx);
}

export function torsoSkin(ctx: BodyCtx, y: number, p: Vector3): SkinSpec {
  const h = ctx.d.h;
  if (y < 0.99 * h) return sk(B.hips);
  if (y < 1.1 * h) return sk2(B.hips, B.spine, smooth(0.99 * h, 1.1 * h, y));
  if (y < 1.22 * h) return sk2(B.spine, B.chest, smooth(1.1 * h, 1.22 * h, y));
  // Shoulders follow the clavicles a little, the collar follows the neck.
  const clav = p.x > 0 ? B.clavL : B.clavR;
  const ax = Math.abs(p.x);
  const wc = 0.55 * smooth(1.3 * h, 1.4 * h, y) * smooth(0.07 * ctx.d.w, 0.17 * ctx.d.w, ax);
  const wn = 0.45 * smooth(1.43 * h, 1.46 * h, y);
  const wch = 1 - wc - wn;
  return wn > 0 ? [B.chest, wch, clav, wc, B.neck, wn] : [B.chest, wch, clav, wc];
}

/**
 * A point on the (optionally inflated) torso surface at height y and angle θ, with an approximate
 * outward normal. Matches the torso loft's superellipse section.
 */
export function torsoPoint(ctx: BodyCtx, y: number, th: number, inflate: number, out: Vector3, outN?: Vector3): Vector3 {
  const t = ctx.torsoAt(y);
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  const e = 2.25;
  const ux = Math.sign(cs) * Math.pow(Math.abs(cs), 2 / e);
  const uz = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / e);
  const rz = sn < 0 ? t.rb : t.rf;
  const m = 1 + inflate / Math.max(0.05, t.rx);
  out.set(ux * t.rx * m, y, t.cz + uz * rz * m);
  if (outN) outN.set(cs / t.rx, 0, sn / rz).normalize();
  return out;
}

function buildTorso(ctx: BodyCtx, style: OutfitStyle): void {
  const { b, d } = ctx;
  const y0 = 0.83 * d.h;
  const y1 = 1.455 * d.h;
  const rings: RingSpec[] = [];
  for (const y of stops(y0, y1, 0.028 * d.h, style.torso.bounds)) {
    const t = ctx.torsoAt(y);
    rings.push({
      c: new Vector3(0, y, t.cz),
      ax: X,
      ay: Z,
      rx: t.rx,
      ry: t.rf,
      ryBack: t.rb,
      exp: 2.25,
      radial: (th) => 1 + style.torso.inflate(y, th) / Math.max(0.05, t.rx),
      skin: (_th, _i, p) => torsoSkin(ctx, y, p),
      color: (th, _i, p) => style.torso.color(y, th, p),
    });
  }
  b.loft(rings, 26, { capStart: true, capEnd: false });
}

function buildNeck(ctx: BodyCtx): void {
  const { b, d, pal } = ctx;
  const rings: RingSpec[] = [];
  const ya = 1.4 * d.h;
  const yb = 1.61 * d.h;
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const y = ya + ((yb - ya) * i) / n;
    const r = (0.047 + 0.006 * smooth(1.5 * d.h, 1.4 * d.h, y)) * (0.4 + 0.6 * d.g);
    const skin: SkinSpec =
      y < 1.45 * d.h ? sk2(B.chest, B.neck, smooth(1.4 * d.h, 1.45 * d.h, y)) : sk2(B.neck, B.head, smooth(1.5 * d.h, 1.58 * d.h, y));
    rings.push({ c: new Vector3(0, y, -0.012 + 0.012 * smooth(1.45 * d.h, 1.6 * d.h, y)), ax: X, ay: Z, rx: r, ry: r * 1.06, skin, color: pal.skin });
  }
  b.loft(rings, 14);
}

function armSkin(d: RigDims, s: number, side: Side): SkinSpec {
  const up = side > 0 ? B.upperArmL : B.upperArmR;
  const fo = side > 0 ? B.foreArmL : B.foreArmR;
  const ha = side > 0 ? B.handL : B.handR;
  const e = d.upperArm;
  if (s < e - 0.04) return sk(up);
  if (s < e + 0.04) return sk2(up, fo, smooth(e - 0.04, e + 0.04, s));
  const w = d.upperArm + d.foreArm;
  return sk2(fo, ha, 0.35 * smooth(w - 0.03, w, s));
}

function buildArm(ctx: BodyCtx, style: OutfitStyle, side: Side): void {
  const { b, d, bp } = ctx;
  const S = side > 0 ? bp.upperArmL : bp.upperArmR;
  const len = d.upperArm + d.foreArm;
  const rings: RingSpec[] = [];
  for (const s of stops(-0.035 * d.h, len, 0.03, style.arm.bounds)) {
    const a = ctx.armAt(s);
    const inf = style.arm.inflate(s);
    rings.push({
      c: new Vector3(S.x, S.y - s, S.z),
      ax: X,
      ay: Z,
      rx: a.rx + inf,
      ry: a.rz + inf,
      skin: armSkin(d, s, side),
      color: (th) => style.arm.color(s, th, side),
    });
  }
  b.loft(rings, 12, { capStart: true, capEnd: true, capBulge: 0.3 });
  // Shoulder ball: a sphere at the joint, so it stays put whichever way the arm turns.
  const sh = ctx.armAt(0.03);
  const r = (sh.rx + style.arm.inflate(0)) * 1.04;
  b.ellipsoid(
    new Vector3(S.x - side * 0.004, S.y - 0.008, S.z - 0.004),
    new Vector3(r * 1.0, r * 1.1, r * 1.02),
    sk(side > 0 ? B.upperArmL : B.upperArmR),
    (u) => style.arm.color(-0.02 + 0.02 * u.y, Math.atan2(u.z, side * u.x), side),
    { lat: 8, lon: 12 },
  );
}

function buildHand(ctx: BodyCtx, style: OutfitStyle, side: Side): void {
  const { b, d, bp } = ctx;
  const sfx = side > 0 ? 'L' : 'R';
  const W = bp[`hand${sfx}`];
  const K = bp[`fingers${sfx}`];
  const F2 = bp[`fingers2${sfx}`];
  const hand = B[`hand${sfx}`];
  const f1 = B[`fingers${sfx}`];
  const f2 = B[`fingers2${sfx}`];
  const g = 0.5 + 0.5 * d.g;
  const color = style.hand;
  // Palm: thin across X (palm faces the body), wide front-to-back.
  const palm: RingSpec[] = [];
  const pk = [
    [0, 0.02, 0.026],
    [0.25, 0.019, 0.036],
    [0.6, 0.018, 0.04],
    [1, 0.016, 0.039],
  ];
  for (const [t, rx, rz] of pk) {
    palm.push({ c: new Vector3(W.x + side * 0.002, W.y - t * (W.y - K.y), W.z + 0.004 * t), ax: X, ay: Z, rx: rx * g, ry: rz * g, exp: 2.6, skin: sk(hand), color });
  }
  b.loft(palm, 12, { capStart: true });
  // Fingers as one soft block (two segments so it curls).
  const fl = d.finger1 + d.finger2;
  const fk = [
    [0, 0.0155, 0.039],
    [0.35, 0.0145, 0.037],
    [0.55, 0.013, 0.035],
    [1, 0.011, 0.03],
  ];
  const fing: RingSpec[] = [];
  for (const [t, rx, rz] of fk) {
    const y = K.y - t * fl;
    const sp = y > F2.y + 0.008 ? sk(f1) : y > F2.y - 0.008 ? sk2(f1, f2, smooth(F2.y + 0.008, F2.y - 0.008, y)) : sk(f2);
    fing.push({
      c: new Vector3(K.x, y, K.z),
      ax: X,
      ay: Z,
      rx: rx * g,
      ry: rz * g,
      exp: 2.4,
      // Shallow grooves between the fingers on the back and palm.
      radial: (th) => 1 - 0.05 * Math.pow(Math.abs(Math.cos(th)), 4) * (0.5 + 0.5 * Math.cos(Math.sin(th) * Math.PI * 4)),
      skin: sp,
      color,
    });
  }
  b.loft(fing, 16, { capEnd: true, capBulge: 0.7 });
  // Thumb.
  const T = bp[`thumb${sfx}`];
  const dir = new Vector3(-side * 0.35, -0.72, 0.6).normalize();
  const th = B[`thumb${sfx}`];
  const tr: RingSpec[] = [];
  for (const [t, r] of [
    [-0.012, 0.014],
    [0.02, 0.0135],
    [0.045, 0.012],
    [0.06, 0.0105],
  ]) {
    tr.push({ c: T.clone().addScaledVector(dir, t), ax: X, ay: new Vector3().crossVectors(dir, X).normalize(), rx: r * g, ry: r * g * 0.92, skin: sk(th), color });
  }
  const ax = new Vector3().crossVectors(Y, dir).normalize();
  for (const r of tr) {
    r.ax = ax;
    r.ay = new Vector3().crossVectors(dir, ax).normalize();
  }
  b.loft(tr, 10, { capStart: true, capEnd: true, capBulge: 0.6 });
  if (style.cuff) {
    const a = ctx.armAt(d.upperArm + d.foreArm - 0.02);
    const fo = B[`foreArm${sfx}`];
    const cr: RingSpec[] = [];
    for (const [t, k] of [
      [-0.03, 1.28],
      [0.005, 1.32],
      [0.012, 1.0],
    ]) {
      cr.push({ c: new Vector3(W.x, W.y + 0.02 - t * 1.4, W.z), ax: X, ay: Z, rx: a.rx * k + 0.004, ry: a.rz * k + 0.004, skin: sk2(fo, hand, 0.6), color: style.cuff });
    }
    b.loft(cr, 12);
  }
}

export function legSkin(d: RigDims, s: number, side: Side): SkinSpec {
  const th = side > 0 ? B.thighL : B.thighR;
  const sh = side > 0 ? B.shinL : B.shinR;
  const ft = side > 0 ? B.footL : B.footR;
  const k = d.thigh;
  // Spread pelvis influence over the hip instead of dropping 45% at a single ring.
  // Scale the field with the build, preserving the original upper attachment weight.
  if (s < 0.05 * d.h) return sk2(B.hips, th, 0.55 + 0.45 * smooth(-0.02 * d.h, 0.05 * d.h, s));
  if (s < k - 0.05) return sk(th);
  if (s < k + 0.05) return sk2(th, sh, smooth(k - 0.05, k + 0.05, s));
  const L = d.thigh + d.shin;
  return sk2(sh, ft, 0.3 * smooth(L - 0.05, L, s));
}

function buildLeg(ctx: BodyCtx, style: OutfitStyle, side: Side): void {
  const { b, d, bp } = ctx;
  const J = side > 0 ? bp.thighL : bp.thighR;
  const L = d.thigh + d.shin;
  const rings: RingSpec[] = [];
  for (const s of stops(-0.07 * d.h, L - 0.012, 0.035, style.leg.bounds)) {
    const r = ctx.legAt(s);
    const inf = style.leg.inflate(s);
    // The knee drifts slightly forward of the bone line; the shin sits straight.
    const z = 0.004 * Math.sin(Math.min(1, Math.max(0, s / d.thigh)) * Math.PI);
    rings.push({
      c: new Vector3(J.x - side * 0.006 * smooth(0, d.thigh, s), J.y - s, J.z + z),
      ax: X,
      ay: Z,
      rx: r.rx + inf,
      ry: r.rf + inf,
      ryBack: r.rb + inf,
      skin: legSkin(d, s, side),
      color: (th) => style.leg.color(s, th, side),
    });
  }
  b.loft(rings, 14, { capStart: true, capEnd: true, capBulge: 0.2 });
}

function buildFoot(ctx: BodyCtx, style: OutfitStyle, side: Side): void {
  const { b, d, bp } = ctx;
  const A = side > 0 ? bp.footL : bp.footR;
  const ft = side > 0 ? B.footL : B.footR;
  const toe = side > 0 ? B.toeL : B.toeR;
  const toeZ = side > 0 ? bp.toeL.z : bp.toeR.z;
  const g = 0.6 + 0.4 * d.g;
  const fl = d.footLen;
  // z along the foot (from the ankle), center y, half width, half height above center.
  const keys = [
    [-0.06, 0.05, 0.03, 0.03],
    [-0.05, 0.05, 0.038, 0.045],
    [-0.02, 0.055, 0.044, 0.058],
    [0.03, 0.055, 0.047, 0.06],
    [0.08, 0.044, 0.049, 0.044],
    [0.13, 0.035, 0.05, 0.034],
    [0.165, 0.032, 0.047, 0.03],
    [0.19, 0.03, 0.036, 0.024],
    [0.198, 0.028, 0.02, 0.016],
  ];
  const rings: RingSpec[] = [];
  for (const [z, cy, hw, hh] of keys) {
    const zz = (z * fl) / 0.25;
    const skin = zz < toeZ - 0.035 ? sk(ft) : zz < toeZ + 0.01 ? sk2(ft, toe, smooth(toeZ - 0.035, toeZ + 0.01, zz)) : sk(toe);
    rings.push({
      c: new Vector3(A.x - side * 0.004 * (zz / 0.2), cy * d.h, A.z + zz),
      ax: X,
      ay: Y,
      rx: hw * g,
      ry: hh * d.h,
      ryBack: cy * d.h,
      exp: 2.6,
      skin,
      color: (th) => (Math.sin(th) < -0.55 ? style.foot.sole : style.foot.color),
    });
  }
  b.loft(rings, 14, { capStart: true, capEnd: true, capBulge: 0.3 });
}

const _q = new Quaternion();

function buildHead(ctx: BodyCtx): void {
  const { b, pal, head } = ctx;
  const hb = sk(B.head);
  const blushAt = (u: Vector3) => Math.exp(-((Math.abs(u.x) - 0.52) ** 2 * 3 + (u.y + 0.3) ** 2 * 3 + (u.z - 0.78) ** 2) / 0.05);
  b.ellipsoid(head.center, head.radii, hb, (u) => mixSrgb(pal.skin, pal.blush, 0.9 * blushAt(u)), {
    lat: 14,
    lon: 22,
    deform: shapeHead,
  });
  const n = new Vector3();
  const p = new Vector3();
  const place = (x: number, y: number, out: Vector3, outN: Vector3, inflate = 0) => {
    // Find the surface point whose deformed x/y lands near (x, y) on the front of the face.
    const dir = new Vector3(x, y, Math.sqrt(Math.max(0.05, 1 - x * x - y * y)));
    head.surface(dir, out, inflate);
    const e = 0.02;
    const a = head.surface(new Vector3(x + e, y, dir.z), new Vector3(), inflate);
    const c = head.surface(new Vector3(x, y + e, dir.z), new Vector3(), inflate);
    outN.crossVectors(a.sub(out), c.sub(out)).normalize();
    if (outN.z < 0) outN.negate();
    return out;
  };
  // Eyes: tall dark ovals with a catch light.
  for (const s of [1, -1]) {
    place(s * 0.37, -0.05, p, n);
    _q.setFromUnitVectors(Z, n);
    const tilt = new Quaternion().setFromAxisAngle(Z, s * 0.08);
    const rot = _q.clone().multiply(tilt);
    b.ellipsoid(p.clone().addScaledVector(n, -0.004), new Vector3(0.0165, 0.0215, 0.009), hb, pal.eye, { rot, lat: 6, lon: 10 });
    const shine = p.clone().addScaledVector(n, 0.003).add(new Vector3(s * 0.005, 0.008, 0));
    b.ellipsoid(shine, new Vector3(0.0048, 0.0052, 0.003), hb, pal.eyeShine, { rot, lat: 4, lon: 6, glow: 0.15 });
    // Brow.
    const bi = place(s * 0.17, 0.2, new Vector3(), new Vector3(), 0.002);
    const bo = place(s * 0.5, 0.18, new Vector3(), new Vector3(), 0.001);
    const bm = place(s * 0.34, 0.235, new Vector3(), new Vector3(), 0.003);
    b.loft(
      [bi, bm, bo].map((c, i) => ({
        c,
        ax: new Vector3(0, 1, 0),
        ay: n.clone(),
        rx: [0.0042, 0.0046, 0.0028][i],
        ry: 0.0028,
        skin: hb,
        color: pal.brow,
      })),
      6,
      { capStart: true, capEnd: true },
    );
    // Ear.
    const ear = head.surface(new Vector3(s, -0.12, -0.08), new Vector3());
    b.ellipsoid(ear.add(new Vector3(-s * 0.004, 0, 0)), new Vector3(0.011, 0.027, 0.019), hb, pal.skinShade, {
      rot: new Quaternion().setFromAxisAngle(Y, s * 0.25),
      lat: 6,
      lon: 8,
    });
  }
  // Nose.
  place(0, -0.3, p, n);
  b.ellipsoid(p.clone().addScaledVector(n, 0.004).add(new Vector3(0, -0.002, 0)), new Vector3(0.0115, 0.017, 0.0125), hb, mixSrgb(pal.skin, pal.blush, 0.35), {
    rot: new Quaternion().setFromAxisAngle(X, -0.35),
    lat: 6,
    lon: 10,
  });
  // Mouth: a small soft line.
  place(0, -0.58, p, n);
  b.ellipsoid(p.clone().addScaledVector(n, -0.001), new Vector3(0.013, 0.0032, 0.004), hb, pal.lip, { lat: 4, lon: 8 });
}
