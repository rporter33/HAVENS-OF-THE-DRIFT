// Garment building blocks shared by the outfits: belts and bands that hug the torso, straps laid
// over the body, skirt panels that follow the legs, collars, studs and buttons.

import { Color, Quaternion, Vector3 } from 'three';
import { B } from './rig';
import { sk, sk2, type RingSpec, type SkinSpec } from './meshKit';
import { torsoPoint, torsoSkin, type BodyCtx, type Side } from './body';
import {legPoint} from './legFit';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** A ring band around the torso between heights y0 < y1 (belts, hems, sashes). */
export function torsoBand(
  ctx: BodyCtx,
  y0: number,
  y1: number,
  inflate: number,
  color: Color | ((th: number, y: number) => Color),
  opts: { seg?: number; bulge?: number } = {},
): void {
  const rings: RingSpec[] = [];
  const n = 3;
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n;
    const t = ctx.torsoAt(y);
    const bulge = (opts.bulge ?? 0.3) * Math.sin((i / n) * Math.PI) * 0.01;
    const m = 1 + (inflate + bulge) / Math.max(0.05, t.rx);
    rings.push({
      c: new Vector3(0, y, t.cz),
      ax: X,
      ay: Z,
      rx: t.rx * m,
      ry: t.rf * m,
      ryBack: t.rb * m,
      exp: 2.25,
      skin: (_th, _i, p) => torsoSkin(ctx, y, p),
      color: typeof color === 'function' ? (th) => color(th, y) : color,
    });
  }
  ctx.b.loft(rings, 26, { capStart: false, capEnd: false });
  // Close the band's ends with thin lips so it reads as a separate layer.
  for (const [y, k] of [
    [y0, -1],
    [y1, 1],
  ] as const) {
    const t = ctx.torsoAt(y);
    const lip: RingSpec[] = [0, 1].map((j) => {
      const m = 1 + (j === 0 ? inflate : 0.0005) / Math.max(0.05, t.rx);
      return {
        c: new Vector3(0, y + k * 0.0004 * j, t.cz),
        ax: X,
        ay: Z,
        rx: t.rx * m,
        ry: t.rf * m,
        ryBack: t.rb * m,
        exp: 2.25,
        skin: (_th: number, _i: number, p: Vector3) => torsoSkin(ctx, y, p),
        color: typeof color === 'function' ? (th: number) => color(th, y) : color,
      };
    });
    ctx.b.loft(lip, 26);
  }
}

export interface StrapPoint {
  p: Vector3;
  n: Vector3;
  skin: SkinSpec;
}

/** A flat strap laid along surface points (each with an outward normal and skin weights). */
export function strap(ctx: BodyCtx, pts: StrapPoint[], halfW: number, halfT: number, color: Color | ((t: number) => Color), glow = 0): void {
  const rings: RingSpec[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)].p;
    const b = pts[Math.min(pts.length - 1, i + 1)].p;
    const tan = new Vector3().subVectors(b, a).normalize();
    const n = pts[i].n.clone().addScaledVector(tan, -pts[i].n.dot(tan)).normalize();
    const bi = new Vector3().crossVectors(tan, n).normalize();
    const t = i / Math.max(1, pts.length - 1);
    rings.push({
      c: pts[i].p.clone().addScaledVector(n, halfT),
      ax: n,
      ay: bi,
      rx: halfT,
      ry: halfW,
      exp: 3,
      skin: pts[i].skin,
      color: typeof color === 'function' ? color(t) : color,
      glow,
    });
  }
  ctx.b.loft(rings, 8, { capStart: true, capEnd: true, capBulge: 0.02 });
}

/** Strap points across the torso surface along a path of (y, θ) pairs, densified. */
export function torsoPath(ctx: BodyCtx, path: [number, number][], lift: number, density = 0.03): StrapPoint[] {
  const out: StrapPoint[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [y0, t0] = path[i];
    const [y1, t1] = path[i + 1];
    const p0 = torsoPoint(ctx, y0, t0, lift, new Vector3());
    const p1 = torsoPoint(ctx, y1, t1, lift, new Vector3());
    const n = Math.max(1, Math.ceil(p0.distanceTo(p1) / density));
    for (let k = 0; k < n + (i === path.length - 2 ? 1 : 0); k++) {
      const f = k / n;
      const y = y0 + (y1 - y0) * f;
      const th = t0 + (t1 - t0) * f;
      const p = new Vector3();
      const nn = new Vector3();
      torsoPoint(ctx, y, th, lift, p, nn);
      out.push({ p, n: nn, skin: torsoSkin(ctx, y, p) });
    }
  }
  return out;
}

/**
 * A thick panel hugging the torso (vests, breastplates, bibs). θ range may vary with height
 * (th0/th1 are functions of v, 0 at the top) for shaped edges like a V-neck.
 */
export function torsoPanel(
  ctx: BodyCtx,
  o: {
    th0: (v: number) => number;
    th1: (v: number) => number;
    yTop: number;
    yBot: number;
    inflate: number;
    thickness: number;
    folds?: number;
    cols?: number;
    rows?: number;
    color: (u: number, v: number, inner: boolean) => Color;
  },
): void {
  ctx.b.sheet(
    o.cols ?? 7,
    o.rows ?? 6,
    (u, v, p, n) => {
      const y = o.yTop + (o.yBot - o.yTop) * v;
      const th = o.th0(v) + (o.th1(v) - o.th0(v)) * u;
      const fold = (o.folds ?? 0) * Math.sin(v * Math.PI) * Math.cos(u * Math.PI * 4 + v * 2);
      torsoPoint(ctx, y, th, o.inflate + o.thickness + fold, p, n);
    },
    o.thickness,
    (u, v) => {
      const y = o.yTop + (o.yBot - o.yTop) * v;
      const th = o.th0(v) + (o.th1(v) - o.th0(v)) * u;
      return torsoSkin(ctx, y, torsoPoint(ctx, y, th, 0, new Vector3()));
    },
    o.color,
  );
}

/** A small rounded stud/button sitting on a surface. */
export function stud(ctx: BodyCtx, p: Vector3, n: Vector3, r: number, color: Color, skin: SkinSpec, flat = 0.45, glow = 0): void {
  const q = new Quaternion().setFromUnitVectors(Z, n.clone().normalize());
  ctx.b.ellipsoid(p.clone().addScaledVector(n, r * flat * 0.5), new Vector3(r, r, r * flat), skin, color, { rot: q, lat: 5, lon: 8, glow });
}

/** A rounded box (pouch, buckle, badge) sitting on a surface. */
export function block(ctx: BodyCtx, p: Vector3, n: Vector3, up: Vector3, size: Vector3, color: Color, skin: SkinSpec, glow = 0): void {
  const nn = n.clone().normalize();
  const side = new Vector3().crossVectors(up, nn).normalize();
  const upv = new Vector3().crossVectors(nn, side).normalize();
  const c = p.clone().addScaledVector(nn, size.z * 0.5);
  ctx.b.loft([0,.07,.18,.82,.93,1].map(t=>{
    const round=t===0||t===1?.72:t===.07||t===.93?.96:1;
    return {c:c.clone().addScaledVector(upv,size.y*(.5-t)),ax:side,ay:nn,
      rx:size.x*.5*round,ry:size.z*.5*round,exp:3,skin,color,glow};
  }),12,{capStart:true,capEnd:true,capBulge:.01});
}

export interface PanelOpts {
  /** Angle range around the body (θ = 0 left, π/2 front, π right, 3π/2 back). */
  th0: number;
  th1: number;
  yTop: number;
  yBot: number;
  /** Extra radius at the top (to sit over the belt/torso). */
  inflate: number;
  /** Outward flare per meter of drop. */
  flare: number;
  thickness: number;
  /** How much the hem follows the thighs (front panels more than back). */
  follow?: number;
  /** Soft hem turn; all hanging textiles have rounded corners by default. */
  roundHem?: number;
  /** Broad rest folds, with small defaults for hanging textiles. */
  folds?: number;
  hemSlope?: number;
  cols?: number;
  rows?: number;
  /** Armor plates retain rig-driven support; hanging textile panels use localized cloth. */
  rigid?: boolean;
  color(u: number, v: number, inner: boolean): Color;
}

/**
 * The outer envelope a skirt hangs on: the hips above the crotch, then a hull around both legs
 * that flares outward.
 */
export function skirtSection(ctx: BodyCtx, y: number, yTop: number, flare: number): { rx: number; rf: number; rb: number; cz: number } {
  const d = ctx.d;
  const hipY = 0.94 * d.h;
  const t = ctx.torsoAt(Math.max(y, hipY));
  const drop = Math.max(0, Math.min(yTop, hipY) - y);
  const s = ctx.bp.thighL.y - y;
  const leg = ctx.legAt(Math.max(0, s));
  const legX = ctx.bp.thighL.x + leg.rx + 0.02;
  return {
    rx: Math.max(t.rx + flare * drop, legX + flare * drop * 0.6),
    rf: Math.max(t.rf + flare * drop * 0.8, leg.rf + 0.03 + flare * drop * 0.5),
    rb: Math.max(t.rb + flare * drop * 0.8, leg.rb + 0.025 + flare * drop * 0.5),
    cz: t.cz,
  };
}

/** A skirt panel (coat front, tunic, robe, tabard) that hangs from the waist and follows the legs. */
export function skirtPanel(ctx: BodyCtx, o: PanelOpts): void {
  const cols = o.cols ?? 6;
  const rows = o.rows ?? 6;
  const follow = o.follow ?? 0.75;
  const moving = !o.rigid;
  const e = moving ? 2 : 2.25;
  const sample = (u: number, v: number, p: Vector3, n: Vector3) => {
      const th = o.th0 + (o.th1 - o.th0) * u;
      const round = o.roundHem ?? (moving ? .022 * ctx.d.h : 0);
      const corner = round * (Math.exp(-u * 16) + Math.exp(-(1 - u) * 16)) * smooth(.65, 1, v);
      const y = o.yTop + (o.yBot - o.yTop) * v + corner + (o.hemSlope ?? 0) * (u - .5) * v;
      const s = skirtSection(ctx, y, o.yTop, o.flare);
      if (moving) {
        // Meet the actual bodice at the waist before easing over the hips/thighs.
        const root = ctx.torsoAt(o.yTop), t = smooth(0, .35, v);
        s.rx = root.rx + (s.rx - root.rx) * t;
        s.rf = root.rf + (s.rf - root.rf) * t;
        s.rb = root.rb + (s.rb - root.rb) * t;
      }
      const cs = Math.cos(th);
      const sn = Math.sin(th);
      const ux = Math.sign(cs) * Math.pow(Math.abs(cs), 2 / e);
      const uz = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / e);
      const rz = sn < 0 ? s.rb : s.rf;
      const fold = (o.folds ?? (moving ? .007 * ctx.d.h : 0)) * Math.sin(v * Math.PI * .8) * Math.cos(u * Math.PI * 6 + v * 1.8);
      const m = 1 + (o.inflate + o.thickness + fold) / Math.max(0.05, s.rx);
      p.set(ux * s.rx * m, y, s.cz + uz * rz * m);
      n.set(cs / s.rx, 0.15, sn / rz).normalize();
    };
  const skin = (u: number, v: number): SkinSpec => {
      const th = o.th0 + (o.th1 - o.th0) * u;
      const cs = Math.cos(th);
      const sn = Math.sin(th);
      const k = (sn < 0 ? follow * 0.6 : follow) * Math.pow(smooth(0, 1, v), 0.6);
      const left = Math.min(1, Math.max(0, 0.5 + cs / 1.2));
      const wl = k * left;
      const wr = k * (1 - left);
      const wh = 1 - wl - wr;
      return [B.hips, wh, B.thighL, wl, B.thighR, wr];
    };
  if (moving) {
    const rest: Vector3[] = [], anchorBone: number[] = [], guideSkin: SkinSpec[] = [];
    const C = cols + 1, R = rows + 1;
    for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
      const u = i / cols, v = j / rows, p = new Vector3();
      sample(u, v, p, new Vector3()); rest.push(p);
      anchorBone.push(j === 0 ? B.hips : -1); guideSkin.push(skin(u, v));
    }
    ctx.garmentCloth.push({name: `garment-${ctx.look.outfit}-${ctx.garmentCloth.length}`, cols:C, rows:R, rest, anchorBone, guideSkin,
      config:{drag:.55,dragTangent:.12,dragQuad:.25,damping:4,bend:.65,iterations:5,radius:.009,
        flutter:7,flutterHz:2.2,dragLow:.6,flutterFloor:.12,contactFriction:.2,poseStiffness:85,poseRadius:.07*ctx.d.h},
      colliders:['belly','thighL','thighR','shinL','shinR','mount'],
      render:{kind:'sheet',color:o.color(.5,.5,false),trim:o.color(.5,.98,false),pattern:'garment',subdiv:2,proofLinen:true,colorAt:(u,v)=>o.color(u,v,false)}});
    return;
  }
  ctx.b.sheet(cols, rows, sample, o.thickness, skin, o.color);
}

/** A collar ring around the neck base: height h above the shoulders, flaring outward by `flare`. */
export function collar(
  ctx: BodyCtx,
  opts: { h: number; r0: number; flare: number; thick: number; color: Color; inner?: Color; open?: number; bumpy?: number; y0?: number },
): void {
  const d = ctx.d;
  const y0 = opts.y0 ?? 1.41 * d.h;
  const rings: RingSpec[] = [];
  const n = 4;
  const open = opts.open ?? 0;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const y = y0 + opts.h * f;
    const r = opts.r0 + opts.flare * f * f;
    const bump = opts.bumpy ?? 0;
    rings.push({
      c: new Vector3(0, y, -0.016 + 0.006 * f),
      ax: X,
      ay: Z,
      rx: r * (1.15 - 0.15 * f),
      ry: r,
      // Open at the front: pinch the radius in so the collar parts under the chin.
      radial: (th) => {
        const front = Math.max(0, Math.sin(th));
        const o = open * Math.pow(front, 6) * f;
        return 1 - o + bump * 0.06 * Math.sin(th * 13 + i * 1.7) * Math.sin(th * 7);
      },
      skin: y < 1.45 * d.h ? sk2(B.chest, B.neck, 0.35 * f) : sk2(B.chest, B.neck, 0.35 + 0.3 * f),
      color: opts.color,
    });
  }
  // Outer wall up, then the inner wall back down (a hollow collar with thickness).
  const inner = rings
    .slice()
    .reverse()
    .map((r) => ({ ...r, rx: r.rx - opts.thick, ry: r.ry - opts.thick, color: opts.inner ?? opts.color }));
  ctx.b.loft([...rings, ...inner], 22);
}

/** Points along the arm surface (outer side) for stripes and straps. */
export function armPath(ctx: BodyCtx, side: Side, s0: number, s1: number, th: number, lift: number, step = 0.03): StrapPoint[] {
  const d = ctx.d;
  const S = side > 0 ? ctx.bp.upperArmL : ctx.bp.upperArmR;
  const out: StrapPoint[] = [];
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  const up = side > 0 ? B.upperArmL : B.upperArmR;
  const fo = side > 0 ? B.foreArmL : B.foreArmR;
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    const a = ctx.armAt(s);
    const nn = new Vector3(Math.cos(th), 0, Math.sin(th));
    const p = new Vector3(S.x + nn.x * (a.rx + lift), S.y - s, S.z + nn.z * (a.rz + lift));
    const e = d.upperArm;
    out.push({ p, n: nn, skin: s < e - 0.04 ? sk(up) : s < e + 0.04 ? sk2(up, fo, smooth(e - 0.04, e + 0.04, s)) : sk(fo) });
  }
  return out;
}

/** Points along the leg surface. */
export function legPath(ctx: BodyCtx, side: Side, s0: number, s1: number, th: number, lift: number, step = 0.035): StrapPoint[] {
  const out: StrapPoint[] = [];
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    out.push(legPoint(ctx,s,th,side,lift));
  }
  return out;
}

export { X, Y, Z, smooth };
