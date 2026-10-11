// Saddles and tack. Every saddle sits behind the shoulder girdle, over the ribcage near the center
// of mass (see SEAT_Z in rig.ts), just behind the withers, on the same raised frame, like a camel's
// or an elephant's: two padded bars along the back either side of the spine carry a narrow seat
// above it, with side flaps falling from the seat's edges, so a rider straddles a horse-width seat
// (knees in, thighs near vertical) on a back up to 2 m across. The frame stands as tall as the
// rider's straddle needs on each breed (TACK.straddle): the knees grip its flaps just above the hide.
//
// The tack (A12, the dragon expert's final form). The wings are bat-like, the membrane roots along
// the flank from the shoulder to the hip, so no girth can go round the barrel: the harness loops
// round the FRONT, like a backpack's sternum Y over the shoulders, never under the arms:
//   - the Y yoke: two thick padded shoulder straps from the saddle's front rings forward over the
//     withers, ahead of and above the wing roots, meeting at a padded sternum plate low on the chest;
//   - the Y's stem back along the belly midline to its anchor: a padded ventral plate under the
//     rump, tied to the saddle's back rings by two straps round the hindquarters behind the
//     membrane's trailing root and the thighs (a breeching). The client's choice between this and
//     a waist strap behind a membrane root cut short at mid-flank went by captures (r2-a/cmp): the
//     waist strap reads as the belly girth the expert ruled out and shrinks the inner wing in
//     flight, while this keeps the bat-like planform whole;
//   - a saddle blanket under every saddle, a little larger than the frame;
//   - a thick neck rope round the base of the neck (the reins: nothing goes on the head), its rein
//     bight hooked over the pommel horn where the hands hold it ('ropeL', 'ropeR');
//   - a small grab strap on the pommel ('grab'), and stirrups under the straddling rider's feet
//     ('stirrupL', 'stirrupR').
// Everything that lies on the body is fitted to the hide (parts/body.ts Hide) from the breed's body
// plan, so the fit follows BreedShape (keel, shoulder, torso widths) with no per-breed numbers. The
// yoke rides the trunk (chest and spine) only: neither the neck nor the wingbeat stretches it.
// Rigid hardware (the frame, pommel, stirrups, rings, bags) rides the spine bone, which also carries
// the saddle anchor, so the rider and the seat move as one.
//
// Shading contract (materials.ts): straps and padding REGION.leather, buckles and rings
// REGION.metal, the blanket REGION.cloth; on every tack vertex aExtra.w is the across-strap
// coordinate (0 at an edge … 1 on the centre line) and quilted padding (the yoke's shoulder straps,
// the sternum and ventral plates) carries ZONE.quilt in aExtra.z.

import { Vector3 } from 'three';
import { clamp, smoothstep } from '../../../core/math';
import { GeoBuilder, MREGION, REGION, Skin, ZONE, ellipsoid, tube } from '../builder';
import { innerTrailRoot, type RigDef } from '../rig';
import type { BodyStation as Station } from '../rig';
import { Hide } from './body';
import { leaf, spike, strip } from './shape';
import { RES, sides, tackN, type Res } from './res';

/** Hand and foot holds on the tack (Wyvern.socket). */
export type TackHold = 'ropeL' | 'ropeR' | 'grab' | 'stirrupL' | 'stirrupR';

/** The tack's fit: every per-breed difference comes from the body plan, not from these. */
export const TACK = {
  /** The yoke's shoulder straps: thick padded leather (m). */
  yoke: { width: 0.2, thick: 0.05 },
  /** The stem and the anchor's straps (m). */
  stem: { width: 0.1, thick: 0.03 },
  /** The sternum plate: half-width and half-height (× the breed's scale) and padding (m). */
  plate: { halfWidth: 0.36, halfHeight: 0.32, thick: 0.08 },
  /** Straps float this far over the hide (m). */
  gap: 0.014,
  /** The membrane's trailing root and the thighs stay this far ahead of the rump straps (m). */
  rumpClear: 0.22,
  /** The neck rope's loop and its rein bight: radii (m). */
  rope: 0.03,
  rein: 0.018,
  /** The dorsal frill stands at most `height` (m) within `radius` (m) of the pommel and of the
   * neck rope's crossing (door-keeping 10: a parameter, not per-breed code). */
  frillClear: { radius: 0.6, height: 0.08 },
  /**
   * The default rider's straddle (rider/rig.ts, the average build) and E's targets: knees 0.30 m
   * from the midline and slightly forward, thighs within 35 degrees of vertical, the knee (radius
   * `legR`) clear of the blanketed hide. The frame stands as tall as that needs.
   */
  straddle: { kneeX: 0.3, kneeFwd: 0.1, hipX: 0.092, hipDrop: 0.065, thigh: 0.42, shin: 0.41, legR: 0.075, ankleY: 0.075, foot: 0.25 },
  /** Blanket thickness over the hide (m). */
  blanket: 0.05,
  /**
   * The seated foot (E's target): the shin from the knee (direction, unnormalised: out, down, back),
   * the iron's tread from the ankle (the foot pitched toes-down), and its clearance of the hide (m).
   */
  // The ball of a forward-facing boot is ahead of the ankle (+Z), even when toes-down.
  stirrup: { shin: [0.12, -0.1, -0.38] as const, tread: [0.01, -0.07, 0.06] as const, treadClear: 0.07 },
};

export interface SaddleInfo {
  /** Seat (rider's hips), body space bind. */
  seat: Vector3;
  /** Half-width of the body where the rider's thighs grip (m). */
  halfWidth: number;
  /** Where the hands hold, in saddle space (+Z forward, +Y up): between the two hand holds. */
  grip: Vector3;
  /** Half the distance between the two hand holds (m; the ropeL/ropeR sockets). */
  gripSpread: number;
  /**
   * The barrel under the seat, in saddle space: a superellipse cross-section centred `cy` below
   * the seat (negative), half-width `rx` and upper half-height `ry` (blanket included), exponent
   * `sq`. The rider wraps its lower legs around it (knees in at the saddle, shins down the ribs).
   */
  flank: SaddleFlank;
  /** Hand and foot holds (body space, bind) and the bone each rides (see Wyvern.socket). */
  holds: Record<TackHold, { pos: Vector3; bone: number }>;
  /**
   * The tack's straps for fit checks: each a run of vertex indices along the strap's top centre
   * line (stretch), and the vertex range of the yoke and its anchor (clearance from the wings).
   */
  straps: { name: string; line: number[] }[];
  tackRange: [number, number];
  /** Render-only vertex ranges for direct rider/flap and foot/iron fit checks. */
  fitRanges: { flaps: [number, number][]; irons: [number, number][] };
}

export interface SaddleFlank {
  cy: number;
  rx: number;
  ry: number;
  sq: number;
}

interface ShellOpts {
  s0: number;
  s1: number;
  th0: number;
  th1: number;
  ns: number;
  nt: number;
  top: (u: number, v: number) => number;
  bottom: number;
  region: (u: number, v: number, rim: boolean) => number;
  /** Skin at an arc length along the body (body-hugging parts follow the body's own weights). */
  skin: (s: number) => Skin;
  /** Raise the top straight up rather than along the hide's normal (a level seat on a sloping back). */
  level?: boolean;
}

const UP = new Vector3(0, 1, 0);

/** A shell lying on the hide between two arc lengths and girth angles, with a rim. */
function shell(b: GeoBuilder, hide: Hide, o: ShellOpts, res: Res): void {
  // Coarser shells (and the coarser body under them) cut deeper chords: float them a little
  // higher so the hide never pokes through.
  const lift = res.tack === 2 ? 0 : res.tack === 1 ? 0.025 : 0.045;
  const top0 = o.top;
  o = { ...o, ns: tackN(res, o.ns, 2), nt: tackN(res, o.nt, 2), top: (u, v) => top0(u, v) + lift, bottom: o.bottom + lift };
  const p = new Vector3();
  const n = new Vector3();
  const top: number[][] = [];
  const bot: number[][] = [];
  b.begin(0);
  for (let i = 0; i <= o.ns; i++) {
    const u = i / o.ns;
    const s = o.s0 + (o.s1 - o.s0) * u;
    const rt: number[] = [];
    const rb: number[] = [];
    const sk = o.skin(s);
    for (let j = 0; j <= o.nt; j++) {
      const v = j / o.nt;
      const th = o.th0 + (o.th1 - o.th0) * v;
      hide.point(s, th, p, n);
      const rim = i === 0 || j === 0 || i === o.ns || j === o.nt;
      const base = p.clone();
      rt.push(b.vertex(p.copy(base).addScaledVector(o.level ? UP : n, o.top(u, v)), sk, { region: o.region(u, v, rim) }, u, v));
      rb.push(b.vertex(p.copy(base).addScaledVector(n, o.bottom), sk, { region: o.region(u, v, true) }, u, v));
    }
    top.push(rt);
    bot.push(rb);
  }
  for (let i = 0; i < o.ns; i++) {
    for (let j = 0; j < o.nt; j++) {
      b.quad(top[i][j], top[i][j + 1], top[i + 1][j + 1], top[i + 1][j]);
      b.quad(bot[i][j], bot[i + 1][j], bot[i + 1][j + 1], bot[i][j + 1]);
    }
  }
  // Rim around the four edges.
  const ring: [number, number][] = [];
  for (let j = 0; j < o.nt; j++) ring.push([0, j]);
  for (let i = 0; i < o.ns; i++) ring.push([i, o.nt]);
  for (let j = o.nt; j > 0; j--) ring.push([o.ns, j]);
  for (let i = o.ns; i > 0; i--) ring.push([i, 0]);
  for (let k = 0; k < ring.length; k++) {
    const [i0, j0] = ring[k];
    const [i1, j1] = ring[(k + 1) % ring.length];
    b.quad(top[i0][j0], bot[i0][j0], bot[i1][j1], top[i1][j1]);
  }
  b.end();
}

/** Is `q` (body space) inside the body's cross-section at station `st` (blanket included)? */
function insideBody(st: Station, q: Vector3): boolean {
  const dy = q.y - st.center.y;
  const h = dy >= 0 ? st.upper : st.lower;
  const t = Math.abs(dy) / (h + 0.03);
  if (t >= 1) return false;
  const w = (st.halfWidth + 0.03) * Math.pow(1 - Math.pow(t, st.squareness), 1 / st.squareness);
  return Math.abs(q.x - st.center.x) < w;
}

// ---------------------------------------------------------------------------------------------
// Tack helpers: paths over the hide, padded straps and plates, brass hardware, rope
// ---------------------------------------------------------------------------------------------

/** A point on the hide (arc length along the body plan, girth angle; see Hide). */
interface HidePt {
  s: number;
  th: number;
}

const cr = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const t2 = t * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t2 * t);
};

/** A smooth path over the hide through control points (Catmull-Rom in hide coordinates), about `step` m apart. */
function hidePath(hide: Hide, ctrl: HidePt[], step: number): HidePt[] {
  // Unwrap the girth angle so the path never swings the long way round the body.
  ctrl = ctrl.map((c) => ({ ...c }));
  for (let i = 1; i < ctrl.length; i++) {
    while (ctrl[i].th - ctrl[i - 1].th > Math.PI) ctrl[i].th -= Math.PI * 2;
    while (ctrl[i].th - ctrl[i - 1].th < -Math.PI) ctrl[i].th += Math.PI * 2;
  }
  const out: HidePt[] = [];
  const a = new Vector3();
  const c = new Vector3();
  for (let i = 0; i < ctrl.length - 1; i++) {
    hide.point(ctrl[i].s, ctrl[i].th, a);
    hide.point(ctrl[i + 1].s, ctrl[i + 1].th, c);
    const n = Math.max(1, Math.round(a.distanceTo(c) / step));
    const p0 = ctrl[Math.max(0, i - 1)];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let j = 0; j < n; j++) out.push({ s: cr(p0.s, p1.s, p2.s, p3.s, j / n), th: cr(p0.th, p1.th, p2.th, p3.th, j / n) });
  }
  out.push({ ...ctrl[ctrl.length - 1] });
  return out;
}

interface BandOpts {
  width: number;
  thick: number;
  region: number;
  /** Quilted padding (ZONE.quilt, a fuller bulge). */
  quilt?: boolean;
  skin: (p: HidePt) => Skin;
  /** Taper the width at either end (fraction of the length) into a ring or plate. */
  taper?: [number, number];
  /** Extra float over the hide along the strap (u = 0..1), e.g. where it overlaps another. */
  lift?: (u: number) => number;
}

const _q = new Vector3();
const _hn = new Vector3();
const _ex: [number, number, number, number] = [1, 0, 0, 0];

/**
 * A padded strap lying on the hide along a path: a band `width` wide whose top bulges `thick`
 * over the hide (fuller in the middle), its edges falling to the hide. Every across-vertex is laid
 * on the hide itself, so the band wraps the body's curve. Returns the top centre line's vertices.
 */
function band(b: GeoBuilder, hide: Hide, path: HidePt[], o: BandOpts, res: Res): number[] {
  // The near LOD has a padded section (edges falling to the hide); the mid LOD a flat ribbon.
  const NA = res.tack === 2 ? (o.quilt ? 4 : 2) : 1;
  const edges = res.tack === 2;
  const pts: Vector3[] = [];
  const nrm: Vector3[] = [];
  for (const h of path) {
    const n = new Vector3();
    pts.push(hide.point(h.s, h.th, new Vector3(), n));
    nrm.push(n);
  }
  const N = path.length;
  const line: number[] = [];
  const rings: number[][] = [];
  const t = new Vector3();
  const side = new Vector3();
  const hp = { s: 0, th: 0 };
  const fs = new Vector3();
  const ft = new Vector3();
  let len = 0;
  const zone = o.quilt ? ZONE.quilt : 0;
  b.begin(0);
  for (let i = 0; i < N; i++) {
    if (i > 0) len += pts[i].distanceTo(pts[i - 1]);
    t.subVectors(pts[Math.min(N - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    side.crossVectors(nrm[i], t).normalize();
    const u = i / (N - 1);
    const tp = o.taper ?? [0, 0];
    const w = o.width * (tp[0] > 0 ? 0.55 + 0.45 * smoothstep(0, tp[0], u) : 1) * (tp[1] > 0 ? 0.55 + 0.45 * smoothstep(1, 1 - tp[1], u) : 1);
    const skin = o.skin(path[i]);
    const ring: number[] = [];
    const lift = o.lift ? o.lift(u) : 0;
    hide.frame(path[i].s, path[i].th, fs, ft);
    const at = (a: number, top: boolean) => {
      // Across the strap along the hide (the side offset carried into hide coordinates).
      Hide.toHide(path[i].s, path[i].th, fs, ft, _q.copy(side).multiplyScalar((a * w) / 2), hp);
      hide.point(hp.s, hp.th, _q, _hn);
      const bulge = o.quilt ? 0.5 + 0.5 * Math.sqrt(Math.max(0, 1 - a * a)) : 0.8 + 0.2 * Math.sqrt(Math.max(0, 1 - a * a));
      _q.addScaledVector(_hn, lift + (top ? TACK.gap + o.thick * bulge : TACK.gap * 0.4));
      _ex[0] = top ? 1 : 0.75;
      _ex[1] = 0;
      _ex[2] = zone;
      _ex[3] = top ? 1 - Math.abs(a) : 0;
      return b.vertex(_q, skin, { region: o.region, extra: _ex }, len, a);
    };
    if (edges) ring.push(at(-1, false));
    for (let k = 0; k <= NA; k++) {
      const v = at(-1 + (2 * k) / NA, true);
      ring.push(v);
      if (k === Math.floor(NA / 2)) line.push(v);
    }
    if (edges) ring.push(at(1, false));
    rings.push(ring);
  }
  for (let i = 0; i < N - 1; i++) {
    const A = rings[i];
    const B = rings[i + 1];
    for (let k = 0; k < A.length - 1; k++) b.quad(A[k], B[k], B[k + 1], A[k + 1]);
  }
  // End caps (where a strap meets a ring or a plate edge-on).
  for (const [r, flip] of edges
    ? ([
        [rings[0], true],
        [rings[N - 1], false],
      ] as const)
    : []) {
    for (let k = 1; k < r.length - 2; k++) (flip ? b.tri(r[0], r[k + 1], r[k]) : b.tri(r[0], r[k], r[k + 1]));
  }
  b.end();
  return line;
}

/**
 * A padded plate on the hide: a rounded shield (half-width `hw` across, `hv` up the plate toward
 * `up`, pointed a little at the bottom) around a hide point, its quilted top bulging `thick`.
 */
function plate(b: GeoBuilder, hide: Hide, c: HidePt, up: Vector3, hw: number, hv: number, thick: number, skin: Skin, res: Res): void {
  const NR = res.tack === 2 ? 4 : 1;
  const NP = res.tack === 2 ? 16 : 8;
  const center = hide.point(c.s, c.th, new Vector3(), new Vector3());
  const n = new Vector3();
  hide.point(c.s, c.th, center, n);
  const V = up.clone().addScaledVector(n, -up.dot(n)).normalize();
  const U = new Vector3().crossVectors(V, n).normalize();
  const hp = { s: 0, th: 0 };
  const fs = new Vector3();
  const ft = new Vector3();
  hide.frame(c.s, c.th, fs, ft);
  const at = (x: number, y: number, h: number, ao: number, across: number) => {
    Hide.toHide(c.s, c.th, fs, ft, _q.set(0, 0, 0).addScaledVector(U, x).addScaledVector(V, y), hp);
    hide.point(hp.s, hp.th, _q, _hn);
    _q.addScaledVector(_hn, TACK.gap + h);
    _ex[0] = ao;
    _ex[1] = 0;
    _ex[2] = ZONE.quilt;
    _ex[3] = across;
    return b.vertex(_q, skin, { region: REGION.leather, extra: _ex }, x, y);
  };
  // A rounded shield: a squarish top where the straps come in, tapering to a blunt point below.
  const outline = (phi: number): [number, number] => {
    const cs = Math.cos(phi);
    const sn = Math.sin(phi);
    const top = sn >= 0;
    const x = hw * Math.sign(cs) * Math.pow(Math.abs(cs), top ? 0.7 : 1) * (top ? 1 : 1 - 0.25 * Math.abs(sn));
    return [x, (top ? hv : hv * 1.2) * Math.sign(sn) * Math.pow(Math.abs(sn), top ? 0.7 : 1.2)];
  };
  b.begin(0);
  const mid = at(0, 0, thick, 1, 1);
  const rings: number[][] = [];
  for (let r = 1; r <= NR; r++) {
    const f = r / NR;
    const ring: number[] = [];
    for (let j = 0; j < NP; j++) {
      const [x, y] = outline((j / NP) * Math.PI * 2);
      ring.push(at(x * f, y * f, thick * (0.45 + 0.55 * Math.sqrt(Math.max(0, 1 - f * f * f))), 1, 1 - f));
    }
    rings.push(ring);
  }
  const rim: number[] = [];
  for (let j = 0; j < NP; j++) {
    const [x, y] = outline((j / NP) * Math.PI * 2);
    rim.push(at(x, y, -TACK.gap * 0.6, 0.75, 0));
  }
  // Counter-clockwise seen from outside: (U, V, n) is right-handed.
  for (let j = 0; j < NP; j++) b.tri(mid, rings[0][j], rings[0][(j + 1) % NP]);
  const all = [...rings, rim];
  for (let r = 0; r < all.length - 1; r++)
    for (let j = 0; j < NP; j++) {
      const k = (j + 1) % NP;
      b.quad(all[r][j], all[r + 1][j], all[r + 1][k], all[r][k]);
    }
  b.end();
}

/**
 * A strap lying on the belly or the back that rides the hide's own weights (so the hide never
 * comes through it), with brass keepers where it crosses `cuts` (arc lengths), as on a real
 * harness. Named `name` in `straps`.
 */
function keptBand(
  b: GeoBuilder,
  hide: Hide,
  path: HidePt[],
  cuts: number[],
  width: number,
  skinAt: (h: HidePt) => Skin,
  name: string,
  straps: { name: string; line: number[] }[],
  res: Res,
): void {
  const line = band(b, hide, path, { width, thick: TACK.stem.thick, region: REGION.leather, skin: skinAt }, res);
  straps.push({ name, line });
  if (res.tack < 2) return;
  const n = new Vector3();
  for (const c of cuts)
    for (let i = 3; i < path.length - 3; i++) {
      if ((path[i - 1].s - c) * (path[i].s - c) > 0) continue;
      const kp = hide.point(path[i].s, path[i].th, new Vector3(), n);
      const kt = hide.point(path[i + 1].s, path[i + 1].th, new Vector3()).sub(kp).normalize();
      buckleAt(b, kp.addScaledVector(n, TACK.gap + TACK.stem.thick * 0.9), kt, n, width / 2, skinAt(path[i]), res);
      break;
    }
}

/** A closed loop of brass rod (rings, buckles) through `pts`, in its own part. */
function brass(b: GeoBuilder, pts: Vector3[], r: number, skin: Skin, res: Res): void {
  const loop = [...pts, pts[0]];
  b.begin(0);
  tube(b, {
    points: loop,
    radii: loop.map(() => r),
    segments: res.tack === 2 ? 4 : 3,
    hint: new Vector3().subVectors(pts[1], pts[0]).cross(new Vector3().subVectors(pts[2], pts[0])).normalize(),
    skin: () => skin,
    mat: () => ({ region: REGION.metal, extra: [1, 0, 0, 0.5] }),
  });
  b.end();
}

/** A D-ring standing on a strap's end: its straight bar along `across`, the bow out along `out`. */
function dRing(b: GeoBuilder, c: Vector3, across: Vector3, out: Vector3, size: number, skin: Skin, res: Res): void {
  const pts: Vector3[] = [];
  const NB = res.tack === 2 ? 7 : 3;
  pts.push(c.clone().addScaledVector(across, -size));
  for (let i = 1; i < NB; i++) {
    const a = Math.PI * (i / NB);
    pts.push(c.clone().addScaledVector(across, -size * Math.cos(a)).addScaledVector(out, size * 1.1 * Math.sin(a)));
  }
  pts.push(c.clone().addScaledVector(across, size));
  brass(b, pts, 0.016, skin, res);
}

/** A rectangular buckle frame lying across a strap's top (centre `c`, along `t`, normal `n`). */
function buckleAt(b: GeoBuilder, c: Vector3, t: Vector3, n: Vector3, halfWidth: number, skin: Skin, res: Res): void {
  if (res.tack < 2) return;
  const side = new Vector3().crossVectors(n, t).normalize();
  const hl = 0.045;
  const pts = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, w]) => c.clone().addScaledVector(t, a * hl).addScaledVector(side, w * (halfWidth + 0.012)).addScaledVector(n, 0.012));
  brass(b, pts, 0.012, skin, res);
}

/** A rope (round, braided leather) along `pts`, open or closed. */
function rope(b: GeoBuilder, pts: Vector3[], r: number, skin: (i: number) => Skin, res: Res, closed: boolean): void {
  const path = closed ? [...pts, pts[0]] : pts;
  b.begin(0);
  tube(b, {
    points: path,
    radii: path.map(() => r),
    segments: res.tack === 2 ? 6 : 4,
    hint: new Vector3(0, 1, 0),
    skin: (i) => skin(i % pts.length),
    mat: (_i, cu) => ({ region: REGION.leather, extra: [1, 0, 0, 0.55 + 0.45 * cu] }),
    capStart: !closed,
    capEnd: !closed,
  });
  b.end();
}

/** The raised saddle frame shared by every saddle (A9; see the header). */
const FRAME = {
  /** Half-width of the seat at the top (m) and where the thighs grip (SaddleInfo.halfWidth). */
  seatHalfWidth: 0.16,
  gripHalfWidth: 0.28,
  /** Girth angle of the bars' centrelines and their padding (m). */
  barTh: 0.35,
  barThick: 0.08,
  /** Flaps lie inside the knees, rather than following the thigh centreline through the leg. */
  flapTilt: -8 * (Math.PI / 180),
  flapLen: 0.56,
  flapThick: 0.025,
};

/**
 * The straddle the frame is built for (TACK.straddle): the seat height above the back's top at
 * which the knee clears the blanketed hide, and where the seated rider's foot then rests (the
 * shin hugging the barrel), all on the left (the right mirrors x). Body space, bind.
 */
function straddleFit(rig: RigDef, hide: Hide): StraddleFit {
  let f = fitCache.get(rig);
  if (!f) fitCache.set(rig, (f = solveStraddle(rig, hide)));
  return f;
}
interface StraddleFit {
  above: number;
  knee: Vector3;
  ankle: Vector3;
  tread: Vector3;
}
const fitCache = new WeakMap<RigDef, StraddleFit>();

function solveStraddle(rig: RigDef, hide: Hide): StraddleFit {
  const D = TACK.straddle;
  const plan = rig.plan;
  const dx = D.kneeX - D.hipX;
  const dz = D.kneeFwd;
  const dy = Math.sqrt(D.thigh * D.thigh - dx * dx - dz * dz);
  const sc = plan.sAtZ(rig.seat.z);
  const topY = hide.point(sc, 0, new Vector3()).y;
  const sk = plan.sAtZ(rig.seat.z + dz);
  const p = new Vector3();
  // Clearance sampling must never overwrite the point being tested along the shin.
  const shinSample = new Vector3();
  const hp = { s: 0, th: 0 };
  /**
   * Distance from a point to the blanketed hide, in the section that holds the point (the body's
   * sections lean with its curve), from 0 to 1.6 rad round; inside < 0.
   */
  const clearOf = (q: Vector3) => {
    const s = hide.project(q, sk, hp).s;
    if (insideBody(plan.station(s), q)) return -1;
    let d = Infinity;
    for (let i = 0; i <= 48; i++) {
      hide.point(s, (i / 48) * 1.6, p);
      d = Math.min(d, p.distanceTo(q));
    }
    return d - TACK.blanket;
  };
  const knee = new Vector3(D.kneeX, 0, rig.seat.z + dz);
  // Lowest seat whose knee clears the hide by the knee's radius (+1 cm): bisection on the height.
  let lo = 0.1;
  let hi = 0.8;
  for (let k = 0; k < 24; k++) {
    const mid = 0.5 * (lo + hi);
    knee.y = topY + mid - D.hipDrop - dy;
    if (clearOf(knee) > D.legR + 0.01) hi = mid;
    else lo = mid;
  }
  const above = hi;
  knee.y = topY + above - D.hipDrop - dy;
  // The jockey's (or a dragon rider's) seat: the knee bent about 90 degrees, the shin running back
  // along the top of the barrel, the foot behind and a little outboard of the knee (E's target),
  // swung out just enough to clear the blanketed hide.
  const D2 = TACK.stirrup;
  const dir = new Vector3();
  const ankle = new Vector3();
  const tread = new Vector3();
  const place = (out: number) => {
    dir.set(D2.shin[0] + out, D2.shin[1], D2.shin[2]).normalize();
    ankle.copy(knee).addScaledVector(dir, D.shin);
    tread.copy(ankle).add(_q.set(D2.tread[0], D2.tread[1], D2.tread[2]));
    let d = clearOf(tread) - D2.treadClear;
    for (let t = 0.35; t <= 1.001; t += 0.13) d = Math.min(d, clearOf(shinSample.copy(knee).addScaledVector(dir, t * D.shin)) - (D.legR * 0.8 + 0.01));
    return d;
  };
  let o0 = 0;
  let o1 = 0.8;
  if (place(0) < 0) {
    for (let k = 0; k < 20; k++) {
      const mid = 0.5 * (o0 + o1);
      if (place(mid) >= 0) o1 = mid;
      else o0 = mid;
    }
    place(o1);
  }
  return { above, knee, ankle, tread };
}

export function buildSaddle(b: GeoBuilder, rig: RigDef, id: string, res: Res = RES[0]): SaddleInfo {
  const plan = rig.plan;
  const S = rig.props.shape;
  const sc = plan.sAtZ(rig.seat.z);
  const st = plan.station(sc);
  // Rigid hardware rides the spine bone (like the anchor); body-hugging parts take the body's skin.
  const skin = Skin.of(rig.idx.spine);
  const hide = new Hide(rig);
  const chain = hide.chain;
  const hug = (s: number) => chain.skin(s);
  // The top of the back (the hide's dorsal ridge included).
  const topY = hide.point(sc, 0, new Vector3()).y;
  const scale = clamp(S.torsoHalfWidth / 0.8, 0.75, 1.25);
  const m = (x: number) => x * scale;
  // The frame stands as tall as the rider's straddle needs on this breed's back (knees in at the
  // top of the back, thighs near vertical): the seat (the rider's hips) `fit.above` over the top.
  const fit = straddleFit(rig, hide);
  /** How much taller than the A9 frame this one stands (each saddle's seat offset over its lift). */
  let rise = 0;
  // The thighs grip the raised seat's flaps, not the back: a horse-like straddle on any breed.
  const halfWidth = FRAME.gripHalfWidth;
  const seat = new Vector3(0, topY + fit.above, rig.seat.z);
  // Hands on the neck rope where it hooks over the pommel (set below).
  const grip = new Vector3(0, 0.2, 0.42);
  const fitRanges: SaddleInfo['fitRanges'] = { flaps: [], irons: [] };
  const p = new Vector3();
  const n = new Vector3();

  /** The seat's girth angle for a half-width at the top of the back (bisection on the plan). */
  const thAtX = (x: number) => {
    let lo = 0;
    let hi = Math.PI / 2;
    for (let k = 0; k < 20; k++) {
      const mid = 0.5 * (lo + hi);
      hide.point(sc, mid, p, n);
      if (Math.abs(p.x) < x) lo = mid;
      else hi = mid;
    }
    return 0.5 * (lo + hi);
  };
  const thSeat = thAtX(FRAME.seatHalfWidth);
  /**
   * The raised frame: padded bars either side of the spine, a narrow seat block `lift` above the
   * back (cantle behind, pommel horn in front, a dish for the rider) and side flaps falling from
   * its edges along the thighs down to the hide. Returns the pommel's top (body space).
   */
  const frame = (opts: { lift: number; len: number; cantle: number; pommel: number; seatRegion: number; flapRegion: number; trim: number; barRegion: number }) => {
    const o = { ...opts, lift: opts.lift + rise };
    // Padded bars.
    for (const sx of [1, -1]) {
      shell(b, hide, {
        s0: sc - m(o.len * 0.6),
        s1: sc + m(o.len * 0.55),
        th0: sx * (FRAME.barTh - 0.09),
        th1: sx * (FRAME.barTh + 0.09),
        ns: 6,
        nt: 2,
        top: (u, v) => FRAME.barThick * (0.75 + 0.25 * Math.sin(Math.PI * u)) * (0.8 + 0.2 * Math.sin(Math.PI * v)),
        bottom: 0,
        region: () => o.barRegion,
        skin: hug,
      }, res);
    }
    // Seat block on the spine between the bars.
    shell(b, hide, {
      s0: sc - m(o.len * 0.5),
      s1: sc + m(o.len * 0.46),
      th0: -thSeat,
      th1: thSeat,
      ns: 8,
      nt: 4,
      top: (u, v) => {
        const a = Math.abs(2 * v - 1);
        return o.lift + o.cantle * smoothstep(0.62, 1, u) * (1 - 0.5 * a) + o.pommel * smoothstep(0.32, 0, u) * (1 - 0.7 * a) - 0.025 * Math.sin(Math.PI * u) - 0.05 * a * a;
      },
      bottom: 0,
      region: (_u, _v, rim) => (rim ? o.trim : o.seatRegion),
      skin: hug,
      level: true,
    }, res);
    // Side flaps turn slightly inward from the seat, beneath the rider's legs, to the hide.
    for (const sx of res.tack > 0 ? [1, -1] : []) {
      const flapStart = b.vertexCount;
      const NZ = tackN(res, 4, 2);
      const top: Vector3[] = [];
      const bot: Vector3[] = [];
      const out = new Vector3(sx * Math.sin(FRAME.flapTilt), -Math.cos(FRAME.flapTilt), 0);
      for (let i = 0; i <= NZ; i++) {
        const u = i / NZ;
        const sz = sc - m(o.len * 0.36) + m(o.len * 0.68) * u;
        hide.point(sz, sx * thSeat, p, n);
        const t0 = p.clone().addScaledVector(UP, o.lift - 0.04 + (res.tack === 2 ? 0.045 : 0.025));
        // Down to the hide (a little into it), at most FRAME.flapLen; rounded lower corners.
        const st2 = plan.station(sz);
        let len = 0;
        const q = new Vector3();
        while (len < FRAME.flapLen) {
          q.copy(t0).addScaledVector(out, len);
          if (insideBody(st2, q)) break;
          len += 0.01;
        }
        len = Math.min(FRAME.flapLen, len + 0.03) * (0.82 + 0.18 * Math.sin(Math.PI * u));
        top.push(t0);
        bot.push(t0.clone().addScaledVector(out, len));
      }
      const nOut = new Vector3(Math.cos(FRAME.flapTilt) * sx, Math.sin(FRAME.flapTilt), 0);
      b.begin(0);
      const rows: number[][] = [];
      for (const [layer, d] of [
        [0, FRAME.flapThick],
        [1, 0],
      ] as const) {
        const rt: number[] = [];
        const rb: number[] = [];
        for (let i = 0; i <= NZ; i++) {
          const rim = i === 0 || i === NZ;
          rt.push(b.vertex(top[i].clone().addScaledVector(nOut, d), skin, { region: o.flapRegion, extra: [1, 0, 0, 0.5] }, i / NZ, 0));
          rb.push(b.vertex(bot[i].clone().addScaledVector(nOut, d), skin, { region: rim || layer === 0 ? o.trim : o.flapRegion, extra: [1, 0, 0, 0] }, i / NZ, 1));
        }
        rows.push(rt, rb);
      }
      const [ot, ob, it, ib] = rows;
      for (let i = 0; i < NZ; i++) {
        const quadOut = (a: number, b2: number, c: number, d: number) => (sx > 0 ? b.quad(a, b2, c, d) : b.quad(d, c, b2, a));
        quadOut(ot[i], ob[i], ob[i + 1], ot[i + 1]);
        quadOut(it[i + 1], ib[i + 1], ib[i], it[i]);
        // Lower edge.
        quadOut(ob[i], ib[i], ib[i + 1], ob[i + 1]);
      }
      // Front and back edges.
      for (const [i, f] of [
        [0, 1],
        [NZ, -1],
      ] as const) {
        if (sx * f > 0) b.quad(ot[i], it[i], ib[i], ob[i]);
        else b.quad(ob[i], ib[i], it[i], ot[i]);
      }
      b.end();
      fitRanges.flaps.push([flapStart, b.vertexCount]);
    }
    // Pommel horn rising from the seat's front.
    const sP = sc - m(o.len * 0.44);
    hide.point(sP, 0, p, n);
    const pBase = p.clone().addScaledVector(UP, o.lift + o.pommel * 0.7);
    const pTop = pBase.clone().add(new Vector3(0, 0.15, 0.05));
    if (res.tack > 0) {
      b.begin(0);
      spike(b, [pBase.clone().addScaledVector(UP, -0.06), pBase.clone().lerp(pTop, 0.6), pTop], 0.05, skin, { region: o.seatRegion }, sides(res, 6), new Vector3(0, 0, 1), 1, 0.4);
      if (res.tack === 2) ellipsoid(b, pTop.clone().add(new Vector3(0, 0.01, 0.01)), new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1), [0.055, 0.035, 0.055], () => skin, () => ({ region: REGION.metal }), 4, 8);
      b.end();
    }
    return { pTop, pBase, front: sc - m(o.len * 0.6), back: sc + m(o.len * 0.55), lift: o.lift };
  };
  /** Stirrups: leathers from the bars down the flank, the irons under the straddling rider's feet. */
  const stirrups = (barS: number, lift: number) => {
    if (res.tack === 0) return;
    for (const sx of [1, -1]) {
      const tread = fit.tread.clone();
      tread.x *= sx;
      // The leather hangs from the bar beside the seat, a little ahead of the knee's line.
      hide.point(barS, sx * (FRAME.barTh + 0.06), p, n);
      const top = p.clone().addScaledVector(n, 0.05).addScaledVector(UP, Math.min(0.12, lift * 0.3));
      const eye = tread.clone().add(new Vector3(0, 0.2, 0));
      const midL = top.clone().lerp(eye, 0.5).add(new Vector3(0.05 * sx, 0, 0));
      b.begin(0);
      spike(b, res.tack === 2 ? [top, top.clone().lerp(midL, 0.5), midL, midL.clone().lerp(eye, 0.5), eye] : [top, midL, eye], 0.03, skin, { region: REGION.leather, extra: [1, 0, 0, 0.5] }, sides(res, 4), new Vector3(sx, 0, 0), 0.35, 0);
      b.end();
      // The iron spans ACROSS the foot. A fore/aft hoop slices through the instep even when
      // the ankle reaches its socket. Keep the existing tread centre/18 mm rod contact.
      const NR = tackN(res, 12, 5);
      const ring = [tread.clone().add(new Vector3(-0.075, 0, 0)), tread.clone().add(new Vector3(0.075, 0, 0))];
      for (let i = 0; i <= NR; i++) {
        const a = (i / NR) * Math.PI;
        ring.push(tread.clone().add(new Vector3(Math.cos(a) * 0.075, 0.1 + Math.sin(a) * 0.1, 0)));
      }
      const ironStart = b.vertexCount;
      brass(b, ring, 0.018, skin, res);
      fitRanges.irons.push([ironStart, b.vertexCount]);
    }
  };
  const blanket = (len: number, wide: number, trim: number) =>
    shell(b, hide, {
      s0: sc - m(len * 0.55),
      s1: sc + m(len * 0.45),
      th0: -wide,
      th1: wide,
      ns: 10,
      nt: 12,
      top: (u, v) => 0.045 + 0.01 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v),
      bottom: -0.02,
      region: (u, v, rim) => (rim || u < 0.06 || u > 0.94 || v < 0.05 || v > 0.95 ? trim : REGION.cloth),
      skin: hug,
    }, res);

  let built: ReturnType<typeof frame>;
  /** The racing saddle's neck handles (left, right), where its rider's hands hold. */
  const handles: Vector3[] = [];
  switch (id) {
    case 'racing': {
      // A light seat on the frame; the rider lies along the neck and holds two neck handles.
      if (res.tack > 0) blanket(1.0, 0.85, REGION.leather);
      rise = fit.above - 0.3;
      built = frame({ lift: 0.25, len: 0.85, cantle: 0.09, pommel: 0.02, seatRegion: REGION.leather, flapRegion: REGION.leather, trim: REGION.cloth, barRegion: REGION.leather });
      // Racing stripe down the middle of the seat.
      shell(b, hide, {
        s0: sc - m(0.4),
        s1: sc + m(0.36),
        th0: -0.06,
        th1: 0.06,
        ns: 6,
        nt: 1,
        top: (u) => 0.265 + rise + 0.09 * smoothstep(0.62, 1, u) * 0.92,
        bottom: 0.23 + rise,
        region: () => REGION.cloth,
        skin: hug,
      }, res);
      for (const sx of res.tack > 0 ? [1, -1] : []) {
        const base = new Vector3(0.17 * sx * scale, 0, rig.seat.z + m(0.62));
        const s = plan.sAtZ(base.z);
        plan.surface(s, 0.35 * sx, p, n);
        base.copy(p);
        // Tall enough to reach from the raised seat.
        const tip = base.clone().add(new Vector3(0.04 * sx, 0.5 + rise, 0.12));
        b.begin(0);
        spike(b, [base.clone().addScaledVector(n, -0.05), base.clone().lerp(tip, 0.6), tip], 0.03, skin, { region: REGION.metal }, sides(res, 5), new Vector3(1, 0, 0), 1, 0);
        const g0 = tip.clone().add(new Vector3(-0.02 * sx, -0.02, -0.02));
        spike(b, [g0, g0.clone().add(new Vector3(0.09 * sx, 0, 0)), g0.clone().add(new Vector3(0.14 * sx, 0, 0))], 0.035, skin, { region: REGION.leather, extra: [1, 0, 0, 0.5] }, sides(res, 6), new Vector3(0, 1, 0), 1, 0);
        b.end();
        // The jockey's hands hold the handles, not the rope.
        handles.push(g0.clone().add(new Vector3(0.09 * sx, 0, 0)));
      }
      seat.y = topY + 0.3 + rise;
      grip.set(0, 0.48 + rise + (topY - seat.y), m(0.72));
      stirrups(sc + m(0.08), built.lift);
      break;
    }
    case 'royal': {
      // Carved howdah: blanket with gold trim, the frame in carved wood with a gilt rim and a
      // cushion on the seat, a back, posts and a canopy.
      if (res.tack > 0) blanket(1.9, 1.25, REGION.metal);
      rise = fit.above - 0.34;
      built = frame({ lift: 0.22, len: 1.05, cantle: 0.06, pommel: 0.12, seatRegion: REGION.wood, flapRegion: REGION.cloth, trim: REGION.metal, barRegion: REGION.wood });
      // Cushion.
      if (res.tack > 0) shell(b, hide, {
        s0: sc - m(0.38),
        s1: sc + m(0.3),
        th0: -thSeat * 0.9,
        th1: thSeat * 0.9,
        ns: 4,
        nt: 3,
        top: (u, v) => 0.29 + rise + 0.04 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v),
        bottom: 0.2 + rise,
        region: () => REGION.cloth,
        skin: hug,
      }, res);
      // Backrest.
      const backS = sc + m(0.52);
      const bst = plan.station(backS);
      const backBase = bst.center.clone().addScaledVector(bst.up, bst.upper + 0.3 + rise);
      b.begin(0);
      leaf(
        b,
        backBase.clone().add(new Vector3(0, 0.32, -0.02)),
        new Vector3(1, 0, 0),
        new Vector3(0, 1, 0),
        new Vector3(0, 0, 1),
        Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return [Math.cos(a) * 0.42, Math.sin(a) * (Math.sin(a) > 0 ? 0.42 : 0.3)] as [number, number];
        }),
        0.05,
        () => skin,
        (_t, f) => ({ region: f > 0.8 ? REGION.metal : REGION.wood }),
        res.tack === 2 ? 3 : 1,
      );
      b.end();
      // Posts, finials and the canopy.
      seat.y = topY + 0.34 + rise;
      const posts: Vector3[] = [];
      const H = 1.75;
      for (const [fx, fz] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ] as const) {
        const s = sc + m(fz > 0 ? -0.55 : 0.58);
        plan.surface(s, 0.62 * fx, p, n);
        const base = p.clone().addScaledVector(n, 0.05);
        const top = new Vector3(base.x * 0.95, seat.y + H, base.z);
        posts.push(top);
        b.begin(0);
        spike(b, res.tack > 0 ? [base.clone().addScaledVector(n, -0.06), base.clone().lerp(top, 0.5), top] : [base.clone().addScaledVector(n, -0.06), top], 0.045, skin, { region: REGION.wood }, sides(res, 6), new Vector3(0, 0, 1), 1, 0);
        if (res.tack > 0) spike(b, [top.clone(), top.clone().add(new Vector3(0, 0.12, 0)), top.clone().add(new Vector3(0, 0.26, 0))], 0.06, skin, { region: REGION.metal }, sides(res, 6));
        b.end();
      }
      // Canopy: a shallow dome over the posts, scalloped hem.
      b.begin(1);
      const [p00, p10, p01, p11] = [posts[1], posts[0], posts[3], posts[2]]; // (−x,front) (+x,front) (−x,back) (+x,back)
      const grid: number[][] = [];
      const NX = tackN(res, 6, 2);
      const NZ = tackN(res, 6, 2);
      for (let i = 0; i <= NZ; i++) {
        const row: number[] = [];
        for (let j = 0; j <= NX; j++) {
          const u = j / NX;
          const w = i / NZ;
          const a = p00.clone().lerp(p10, u);
          const c2 = p01.clone().lerp(p11, u);
          p.lerpVectors(a, c2, w);
          p.x *= 1.12;
          p.y += 0.28 * Math.sin(Math.PI * u) * Math.sin(Math.PI * w) + 0.05;
          const edge = i === 0 || i === NZ || j === 0 || j === NX;
          if (edge && (i + j) % 2 === 1 && res.tack === 2) p.y -= 0.1;
          row.push(b.vertex(p, skin, { region: MREGION.canopy, belly: 0.6, dorsal: edge ? 1 : 0, flutter: edge ? 0.4 : 0.1 }, u, w));
        }
        grid.push(row);
      }
      for (let i = 0; i < NZ; i++) for (let j = 0; j < NX; j++) b.quad(grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]);
      b.end();
      // Tassels from the corners.
      b.begin(1);
      for (const top of res.tack === 2 ? posts : []) {
        const a = top.clone().add(new Vector3(top.x > 0 ? 0.08 : -0.08, 0.02, 0));
        const pts = [a, a.clone().add(new Vector3(0, -0.2, 0)), a.clone().add(new Vector3(0, -0.42, 0))];
        const side = [new Vector3(0, 0, 1), new Vector3(0, 0, 1), new Vector3(0, 0, 1)];
        strip(b, pts, side, [0.03, 0.05, 0.07], () => skin, (_i, t) => ({ region: MREGION.canopy, belly: 0.5, dorsal: 1, flutter: t }), 1);
      }
      b.end();
      stirrups(sc + m(0.08), built.lift);
      break;
    }
    case 'nomad':
    case 'rider':
    default: {
      // The blanket stops short in front, so the pommel sits just behind the withers.
      if (res.tack > 0) blanket(1.35, 1.12, REGION.leather);
      const nomad = id === 'nomad';
      rise = fit.above - (nomad ? 0.31 : 0.3);
      built = frame({ lift: nomad ? 0.26 : 0.25, len: 1.0, cantle: 0.16, pommel: 0.08, seatRegion: REGION.leather, flapRegion: REGION.leather, trim: REGION.leather, barRegion: REGION.cloth });
      seat.y = topY + (nomad ? 0.31 : 0.3) + rise;
      stirrups(sc + m(0.08), built.lift);
      if (id === 'nomad' && res.tack > 0) {
        // Bedroll across the back behind the cantle.
        const bs = sc + m(0.72);
        const bst = plan.station(bs);
        const c0 = bst.center.clone().addScaledVector(bst.up, bst.upper + 0.17);
        b.begin(0);
        const roll: Vector3[] = [];
        for (let i = 0; i <= 6; i++) roll.push(c0.clone().add(new Vector3(-0.58 + (1.16 * i) / 6, -0.05 * Math.pow((i - 3) / 3, 2) * 2, 0)));
        spike(b, roll, 0.17, skin, { region: REGION.wool }, sides(res, 12), new Vector3(0, 1, 0), 1, 0);
        b.end();
        for (const x of res.tack === 2 ? [-0.32, 0.32] : []) {
          b.begin(0);
          const ring: Vector3[] = [];
          for (let i = 0; i <= 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            ring.push(c0.clone().add(new Vector3(x, Math.cos(a) * 0.185, Math.sin(a) * 0.185)));
          }
          spike(b, ring, 0.025, skin, { region: REGION.leather, extra: [1, 0, 0, 0.5] }, 4, new Vector3(1, 0, 0), 1, 0);
          b.end();
        }
        // Saddlebags hanging from the frame's flanks, behind the stirrups.
        for (const sx of [1, -1]) {
          plan.surface(sc + m(0.62), 1.32 * sx, p, n);
          const ss = plan.station(sc + m(0.62));
          const u = ss.tangent.clone().addScaledVector(n, -ss.tangent.dot(n)).normalize();
          const v = new Vector3().crossVectors(n, u).normalize();
          const bag = p.clone().addScaledVector(n, 0.16);
          b.begin(0);
          leaf(
            b,
            bag,
            u,
            v,
            n,
            Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              const r = 1 / Math.pow(Math.pow(Math.abs(Math.cos(a)), 4) + Math.pow(Math.abs(Math.sin(a)), 4), 0.25);
              return [Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.26] as [number, number];
            }),
            0.17,
            () => skin,
            (_t, f) => ({ region: f > 0.85 ? REGION.metal : REGION.leather }),
            res.tack === 2 ? 3 : 1,
            0.4,
          );
          b.end();
          if (sx > 0 && res.tack === 2) {
            // A lantern hanging off the left bag.
            const hook = bag.clone().addScaledVector(n, 0.2).addScaledVector(u, -0.3);
            const lamp = hook.clone().add(new Vector3(0.02, -0.3, 0));
            b.begin(0);
            spike(b, [hook, hook.clone().lerp(lamp, 0.5), lamp.clone().add(new Vector3(0, 0.12, 0))], 0.012, skin, { region: REGION.metal }, 4, new Vector3(1, 0, 0), 1, 0);
            ellipsoid(b, lamp, new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1), [0.07, 0.1, 0.07], () => skin, () => ({ region: REGION.glass }), 6, 8);
            spike(b, [lamp.clone().add(new Vector3(0, 0.08, 0)), lamp.clone().add(new Vector3(0, 0.15, 0)), lamp.clone().add(new Vector3(0, 0.2, 0))], 0.075, skin, { region: REGION.metal }, 6);
            b.end();
          }
        }
      }
      break;
    }
  }
  const tackStart = b.vertexCount;
  const tack = buildTack(b, rig, hide, built, res);
  const tackEnd = b.vertexCount;
  // The hands hold the neck rope where it hooks over the pommel (racing: the neck handles).
  if (handles.length === 2) {
    tack.holds.ropeL = { pos: handles[0], bone: rig.idx.spine };
    tack.holds.ropeR = { pos: handles[1], bone: rig.idx.spine };
  }
  grip.copy(tack.holds.ropeL!.pos).add(tack.holds.ropeR!.pos).multiplyScalar(0.5).sub(seat);
  const gripSpread = 0.5 * Math.abs(tack.holds.ropeL!.pos.x - tack.holds.ropeR!.pos.x);
  // The stirrup treads ride the spine bone with the anchor.
  for (const h of ['stirrupL', 'stirrupR'] as const) {
    const t = fit.tread.clone();
    if (h === 'stirrupR') t.x = -t.x;
    tack.holds[h] = { pos: t, bone: rig.idx.spine };
  }
  // The barrel the legs wrap (blanket included), as seen by the rider: the blanketed hide itself
  // (the frame stands tall enough that the knees grip its flaps just above the back).
  const rx = st.halfWidth + TACK.blanket;
  const ry = st.upper + TACK.blanket;
  const flank: SaddleFlank = { cy: st.center.y - seat.y, rx, ry, sq: st.squareness };
  return { seat, halfWidth, grip, gripSpread, flank, holds: tack.holds as SaddleInfo['holds'], straps: tack.straps, tackRange: [tackStart, tackEnd], fitRanges };
}

interface FrameInfo {
  /** The pommel horn's top and base (body space). */
  pTop: Vector3;
  pBase: Vector3;
  /** Arc lengths of the bars' front and back ends. */
  front: number;
  back: number;
  lift: number;
}

/** The hand holds (body space, bind; every LOD alike): the rope where it hooks over the pommel, the grab strap. */
function tackHolds(rig: RigDef, hide: Hide, f: FrameInfo): Partial<Record<TackHold, { pos: Vector3; bone: number }>> {
  void hide;
  const holdL = f.pTop.clone().add(new Vector3(0.1, -0.02, 0.05));
  return {
    ropeL: { pos: holdL, bone: rig.idx.spine },
    ropeR: { pos: holdL.clone().setX(-holdL.x), bone: rig.idx.spine },
    grab: { pos: f.pBase.clone().add(new Vector3(0, 0.07, 0.12)), bone: rig.idx.spine },
  };
}

/** The hide coordinates of the pommel's station and the neck rope's dorsal crossing (frill clearance). */
export function tackClearance(rig: RigDef): Vector3[] {
  const hide = new Hide(rig);
  const fit = straddleFit(rig, hide);
  const plan = rig.plan;
  const scale = clamp(rig.props.shape.torsoHalfWidth / 0.8, 0.75, 1.25);
  const sc = plan.sAtZ(rig.seat.z);
  const pommel = hide.point(sc - 0.44 * scale, 0, new Vector3());
  pommel.y += fit.above;
  const r = ropeLoop(rig, hide);
  return [pommel, hide.point(r.s + r.dorsal, 0, new Vector3())];
}

/** The neck rope's loop: its station at the flanks and the offsets of its dorsal and ventral points. */
function ropeLoop(rig: RigDef, hide: Hide): { s: number; dorsal: number; ventral: number } {
  void rig;
  return { s: hide.collar().ropeS, dorsal: 0.13, ventral: -0.08 };
}

/**
 * The tack (A12; see the header): the Y yoke, its stem and anchor, the neck rope and its rein
 * bight, the pommel's grab strap. Returns the hand holds and the straps' centre lines.
 */
function buildTack(b: GeoBuilder, rig: RigDef, hide: Hide, f: FrameInfo, res: Res) {
  const holds: Partial<Record<TackHold, { pos: Vector3; bone: number }>> = {};
  const straps: { name: string; line: number[] }[] = [];
  const plan = rig.plan;
  const P = rig.props;
  const S = P.shape;
  const k = plan.keyS;
  const mk = plan.marks;
  const scale = clamp(S.torsoHalfWidth / 0.8, 0.75, 1.25);
  const spine = Skin.of(rig.idx.spine);
  const chestC = 0.5 * (k[mk.neckBase] + k[mk.chest]);
  const neckBones = new Set(rig.idx.neck);
  /** Trunk-rigid: the spine chain, the neck's share carried by the chest (the neck never pulls it). */
  const trunk = (h: HidePt) => hide.chain.skin(Math.max(h.s, chestC));
  /** The hide's own weights with the neck's share on the chest (the belly breathes under the stem). */
  const belly = (h: HidePt) => {
    const src = hide.skin(Math.max(h.s, chestC), h.th);
    const out = new Skin();
    for (let i = 0; i < src.bones.length; i++) out.add(neckBones.has(src.bones[i]) ? rig.idx.chest : src.bones[i], src.weights[i]);
    return out;
  };
  if (res.tack === 0) return { holds: tackHolds(rig, hide, f), straps };
  const step = res.tack === 2 ? 0.09 : 0.24;
  const yk = hide.collar();
  const p = new Vector3();
  const n = new Vector3();
  const hp: HidePt = { s: 0, th: 0 };

  // --- The sternum plate, low on the chest ahead of the wing roots --------------------------------
  const sP = yk.sPlate;
  const plateC: HidePt = { s: sP, th: Math.PI };
  const plateHW = TACK.plate.halfWidth * scale;
  const plateHV = TACK.plate.halfHeight * scale;
  const pc = hide.point(sP, Math.PI, new Vector3(), n);
  const pn = n.clone();
  // Up the plate: toward the yoke's shoulder points (up the chest, toward the neck).
  const fPt = hide.point(yk.course[2].s, yk.course[2].th, new Vector3());
  const up = new Vector3(0, fPt.y, fPt.z).sub(pc);
  const V = up.clone().addScaledVector(pn, -up.dot(pn)).normalize();
  const U = new Vector3().crossVectors(V, pn).normalize();
  if (res.tack > 0) plate(b, hide, plateC, up, plateHW, plateHV, TACK.plate.thick * Math.sqrt(scale), trunk(plateC), res);
  /** A point on the plate's outline (local x across, y up the plate), as hide coordinates. */
  const onPlate = (x: number, y: number): HidePt => {
    p.copy(pc).addScaledVector(U, x).addScaledVector(V, y);
    return { ...hide.project(p, sP, hp) };
  };

  // --- The yoke's shoulder straps: front rings → over the withers → ahead of the wing root → plate ---
  const T = S.torsoLength;
  for (const sx of [1, -1]) {
    const ring: HidePt = { s: f.front + 0.02, th: sx * (FRAME.barTh + 0.12) };
    const withers: HidePt = { s: plan.sAtZ(P.shoulder[2] - 0.08 * T), th: sx * 0.36 };
    const corner = onPlate(sx * 0.62 * plateHW, 0.55 * plateHV);
    const path = hidePath(hide, [ring, withers, ...yk.course.map((c) => ({ s: c.s, th: sx * c.th })), corner], step);
    const line = band(b, hide, path, { width: TACK.yoke.width * Math.sqrt(scale), thick: TACK.yoke.thick, region: REGION.leather, quilt: true, skin: trunk, taper: [0.08, 0] }, res);
    straps.push({ name: sx > 0 ? 'yokeL' : 'yokeR', line });
    if (res.tack === 2) {
      // The D-ring on the bar's front end the strap is buckled to.
      hide.point(ring.s, ring.th, p, n);
      const st = plan.station(ring.s);
      dRing(b, p.clone().addScaledVector(n, TACK.gap + 0.02), new Vector3().crossVectors(n, st.tangent).normalize(), st.tangent.clone().negate().addScaledVector(n, 0.8).normalize(), 0.035, trunk(ring), res);
      // A buckle a hand's width down the strap from the ring.
      const bi = Math.min(path.length - 2, 2);
      const bp = hide.point(path[bi].s, path[bi].th, new Vector3(), n);
      const bt = hide.point(path[bi + 1].s, path[bi + 1].th, new Vector3()).sub(bp).normalize();
      buckleAt(b, bp.addScaledVector(n, TACK.gap + TACK.yoke.thick), bt, n, (TACK.yoke.width * Math.sqrt(scale)) / 2, trunk(path[bi]), res);
    }
  }
  if (res.tack === 2) {
    // A brass boss where the Y meets.
    b.begin(0);
    const boss = pc.clone().addScaledVector(pn, TACK.gap + TACK.plate.thick * Math.sqrt(scale) + 0.01);
    ellipsoid(b, boss, U, pn, V, [0.085 * scale, 0.035, 0.085 * scale], () => trunk(plateC), () => ({ region: REGION.metal, extra: [1, 0, 0, 0.5] }), 3, 10);
    b.end();
  }

  // --- The stem: from the plate's foot back along the belly midline to the anchor ---------------
  const foot = onPlate(0, -1.1 * plateHV);
  const trail = innerTrailRoot(P, plan);
  const anchorZ = Math.min(trail.z, P.hip[2] - S.thighRadius) - TACK.rumpClear;
  const sV = plan.sAtZ(anchorZ);
  const vHW = 0.14 * scale;
  const vHV = 0.12 * scale;
  const vc: HidePt = { s: sV, th: Math.PI };
  const vp = hide.point(sV, Math.PI, new Vector3(), n);
  const vn = n.clone();
  const vUp = new Vector3(0, 0, 1);
  const vV = vUp.clone().addScaledVector(vn, -vUp.dot(vn)).normalize();
  const vU = new Vector3().crossVectors(vV, vn).normalize();
  const onVentral = (x: number, y: number): HidePt => {
    p.copy(vp).addScaledVector(vU, x).addScaledVector(vV, y);
    return { ...hide.project(p, sV, hp) };
  };
  {
    const ctrl: HidePt[] = [foot, { s: k[mk.shoulder] + 0.15, th: Math.PI }, { s: k[mk.chest], th: Math.PI }, { s: k[mk.mid], th: Math.PI }];
    if (sV > k[mk.rear]) ctrl.push({ s: k[mk.rear], th: Math.PI });
    ctrl.push(onVentral(0, 0.9 * vHV));
    const path = hidePath(hide, ctrl.filter((c, i) => i === 0 || i === ctrl.length - 1 || (c.s > foot.s + 0.1 && c.s < sV - 0.1)), step * 1.6);
    // The stem rides the belly's own hide (so it breathes and flexes with it), through keepers.
    keptBand(b, hide, path, [k[mk.chest], k[mk.mid], k[mk.rear]], TACK.stem.width * Math.sqrt(scale), belly, 'stem', straps, res);
  }
  // --- The anchor: a padded ventral plate under the rump, tied to the saddle's back rings by two
  // straps round the hindquarters, behind the membrane's root and the thighs (a breeching) --------
  if (res.tack > 0) plate(b, hide, vc, vUp, vHW, vHV, TACK.plate.thick * 0.8 * Math.sqrt(scale), belly(vc), res);
  for (const sx of [1, -1]) {
    const start = onVentral(sx * 0.7 * vHW, -0.3 * vHV);
    const ctrl: HidePt[] = [
      start,
      { s: sV + 0.02, th: sx * 2.25 },
      { s: sV, th: sx * 1.5 },
      { s: sV - 0.1, th: sx * 0.95 },
      { s: sV - 0.45, th: sx * 0.6 },
      { s: 0.5 * (sV - 0.45 + f.back), th: sx * 0.52 },
      { s: f.back - 0.02, th: sx * (FRAME.barTh + 0.12) },
    ];
    const path = hidePath(hide, ctrl, step * 1.4);
    // Keepers where the strap leaves the rump for the back, and over the loins.
    keptBand(b, hide, path, [sV - 0.3, k[mk.mid] + 0.3], TACK.stem.width * Math.sqrt(scale), belly, sx > 0 ? 'rumpL' : 'rumpR', straps, res);
    if (res.tack === 2) {
      const ring = ctrl[ctrl.length - 1];
      hide.point(ring.s, ring.th, p, n);
      const st = plan.station(ring.s);
      dRing(b, p.clone().addScaledVector(n, TACK.gap + 0.02), new Vector3().crossVectors(n, st.tangent).normalize(), st.tangent.clone().addScaledVector(n, 0.8).normalize(), 0.035, trunk(ring), res);
    }
  }

  // --- The neck rope: a thick loop round the base of the neck, ahead of the yoke ----------------
  const rl = ropeLoop(rig, hide);
  const NL = res.tack === 2 ? 22 : 10;
  const loop: Vector3[] = [];
  const loopSkin: Skin[] = [];
  for (let i = 0; i < NL; i++) {
    const th = (i / NL) * Math.PI * 2;
    const s = rl.s + 0.5 * (rl.dorsal + rl.ventral) + 0.5 * (rl.dorsal - rl.ventral) * Math.cos(th);
    hide.point(s, th, p, n);
    loop.push(p.clone().addScaledVector(n, TACK.gap + TACK.rope));
    loopSkin.push(hide.skin(s, th));
  }
  if (res.tack > 0) rope(b, loop, TACK.rope, (i) => loopSkin[i], res, true);
  // The rein bight: from the loop's top back over the withers, hooked over the pommel horn where
  // the hands hold it (near LOD only: a finger-thick rope).
  const pTop = f.pTop;
  Object.assign(holds, tackHolds(rig, hide, f));
  const holdL = holds.ropeL!.pos;
  const holdR = holds.ropeR!.pos;
  if (res.tack === 2) {
    const iL = Math.round(NL * (0.35 / (Math.PI * 2)));
    const iR = NL - iL;
    const sMid = 0.5 * (rl.s + rl.dorsal + plan.sAtZ(pTop.z));
    const pts: Vector3[] = [];
    const sk: Skin[] = [];
    const add = (q: Vector3, w: Skin) => {
      pts.push(q.clone());
      sk.push(w);
    };
    add(loop[iL], loopSkin[iL]);
    hide.point(sMid, 0.26, p, n);
    add(p.clone().addScaledVector(n, 0.07), trunk({ s: sMid, th: 0.26 }));
    add(holdL.clone().add(new Vector3(0.01, 0.0, 0.08)), spine);
    add(holdL, spine);
    add(pTop.clone().add(new Vector3(0.05, -0.04, -0.035)), spine);
    add(pTop.clone().add(new Vector3(0, -0.035, -0.06)), spine);
    add(pTop.clone().add(new Vector3(-0.05, -0.04, -0.035)), spine);
    add(holdR, spine);
    add(holdR.clone().add(new Vector3(-0.01, 0.0, 0.08)), spine);
    hide.point(sMid, -0.26, p, n);
    add(p.clone().addScaledVector(n, 0.07), trunk({ s: sMid, th: -0.26 }));
    add(loop[iR], loopSkin[iR]);
    // Smooth it (Catmull-Rom), each sample taking its nearest key's weights.
    const fine: Vector3[] = [];
    const fineSkin: Skin[] = [];
    const sub = 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const a0 = pts[Math.max(0, i - 1)];
      const a1 = pts[i];
      const a2 = pts[i + 1];
      const a3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let j = 0; j < sub; j++) {
        const t = j / sub;
        fine.push(new Vector3(cr(a0.x, a1.x, a2.x, a3.x, t), cr(a0.y, a1.y, a2.y, a3.y, t), cr(a0.z, a1.z, a2.z, a3.z, t)));
        fineSkin.push(t < 0.5 ? sk[i] : sk[i + 1]);
      }
    }
    fine.push(pts[pts.length - 1]);
    fineSkin.push(sk[sk.length - 1]);
    rope(b, fine, TACK.rein, (i) => fineSkin[i], res, false);
  }

  // --- The grab strap: a short padded handle across the pommel's front ---------------------------
  if (res.tack === 2) {
    const g: Vector3[] = [];
    const NG = res.tack === 2 ? 8 : 4;
    for (let i = 0; i <= NG; i++) {
      const a = Math.PI * (i / NG);
      g.push(f.pBase.clone().add(new Vector3(-0.08 * Math.cos(a), 0.02 + 0.05 * Math.sin(a), 0.045 + 0.075 * Math.sin(a))));
    }
    b.begin(0);
    tube(b, {
      points: g,
      radii: g.map(() => [0.012, 0.024] as [number, number]),
      segments: res.tack === 2 ? 6 : 4,
      hint: new Vector3(0, 0, 1),
      skin: () => spine,
      mat: (_i, cu) => ({ region: REGION.leather, extra: [1, 0, 0, 1 - Math.abs(cu)] }),
      capStart: true,
      capEnd: true,
    });
    b.end();
  }
  return { holds, straps };
}

