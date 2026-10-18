// Sculpted rock forms: signed-distance solids for the capability sites (layout.ts RockFormDef).
//
// One function, `sdf`, is the rock. Collision, landing, the distance field and the mesh
// (mesh/rockFormMesh.ts extracts its zero surface) all read it, so what you see is what you hit.
// The gameplay-critical surfaces are exact and carry no noise: the crag's top plane (its slope is
// the landing test) and the keyhole's chamber and cracks (their widths and the chamber's length
// are the snap-roll test). Everything else is weathered with low-frequency lumps and ledges so the
// forms read as the same carved, sedimentary rock as the spires and arches.

import { Vector3 } from 'three';
import { smoothstep } from '../core/math';
import { noise3, type Noise3 } from '../core/noise';
import type { CragDef, KeyholeDef, RockFormDef } from './layout';

/** sqrt(a² + b²) without Math.hypot's argument-list allocation (this runs per collision probe). */
const hyp = (a: number, b: number): number => Math.sqrt(a * a + b * b);

/** Polynomial smooth max (rounds the edge where two surfaces meet over about k metres). */
function smax(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

/** Signed distance to a box of half extents (bx, by, bz) with edges rounded by r. */
function roundedBox(x: number, y: number, z: number, bx: number, by: number, bz: number, r: number): number {
  const qx = Math.abs(x) - bx + r;
  const qy = Math.abs(y) - by + r;
  const qz = Math.abs(z) - bz + r;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const oz = Math.max(qz, 0);
  return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

/** Signed distance to a rectangle of half extents (bx, by) with corners rounded by r. */
function roundedRect(x: number, y: number, bx: number, by: number, r: number): number {
  const qx = Math.abs(x) - bx + r;
  const qy = Math.abs(y) - by + r;
  return hyp(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * How far the sdf may overstate the true distance (the weathering's slope adds to the field's
 * gradient): distance() scales by this so sphere tracing never steps through rock.
 */
const LIPSCHITZ = 0.75;

/** The crag top's edge rounding (m) and the keyhole's lip rounding (m). */
const CRAG_RIM = 0.7;
const KEYHOLE_LIP = 0.5;
/** How far the crag's axis drifts uphill per metre below the top: the top overhangs its fall line. */
const CRAG_LEAN = 0.24;
/** The keyhole islet: its top's edge rounding, and how far its underside hangs (× height). */
const ISLET_BROW = 7;
const ISLET_TAIL = 0.95;
/** The keyhole's top: ground you can land on, down to this far below the top face (m). */
const ISLET_TOP_BAND = 8;

/** Horizontal reach from (def.x, def.z) and vertical extent of a rock form, weathering included. */
export function rockFormBounds(def: RockFormDef): { radius: number; minY: number; maxY: number } {
  if (def.kind === 'crag') {
    // The pillar's widest reach with its lean, plus the weathering; the top plane rises uphill by
    // tan(slope) × the top radius.
    let reach = def.topRadius;
    for (let h = 0; h <= def.depth; h += 2) reach = Math.max(reach, cragRadiusAt(def, h) + CRAG_LEAN * h);
    return { radius: reach + 4, minY: def.y - def.depth - 1, maxY: def.y + Math.tan(def.slope) * def.topRadius + 2 };
  }
  return {
    radius: hyp(def.width / 2, def.chamber / 2 + def.wall) + 6,
    minY: def.y - def.height / 2 - def.height * ISLET_TAIL - 8,
    maxY: def.y + def.height / 2 + 6,
  };
}

/** The crag pillar's radius `h` metres below its top center (no weathering). */
function cragRadiusAt(d: CragDef, h: number): number {
  if (h <= 0) return d.topRadius;
  const belly = d.depth * 0.32;
  if (h <= belly) return d.topRadius + (d.bellyRadius - d.topRadius) * smoothstep(0, 1, h / belly);
  if (h >= d.depth) return 0;
  return d.bellyRadius * Math.pow((d.depth - h) / (d.depth - belly), 0.8);
}

/** Polynomial smooth min (blends two solids over about k metres). */
function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export class RockFormShape {
  readonly def: RockFormDef;
  /** Bounding sphere (world). */
  readonly center: Vector3;
  readonly boundRadius: number;
  /** Horizontal reach from (def.x, def.z), and the vertical extent (world). */
  readonly maxRadius: number;
  readonly minY: number;
  readonly maxY: number;
  /** Unit horizontal axes: `fwd` along yaw (downhill / the passage), `side` across it. */
  readonly fwd: Vector3;
  readonly side: Vector3;
  private readonly n: Noise3;

  constructor(def: RockFormDef) {
    this.def = def;
    this.fwd = new Vector3(Math.sin(def.yaw), 0, Math.cos(def.yaw));
    this.side = new Vector3(Math.cos(def.yaw), 0, -Math.sin(def.yaw));
    this.n = noise3(def.seed);
    const bounds = rockFormBounds(def);
    this.maxRadius = bounds.radius;
    this.minY = bounds.minY;
    this.maxY = bounds.maxY;
    this.center = new Vector3(def.x, (this.minY + this.maxY) / 2, def.z);
    this.boundRadius = hyp(this.maxRadius, (this.maxY - this.minY) / 2);
  }

  /** Signed distance to the rock at (x, y, z), negative inside (approximate away from the surface). */
  sdf(x: number, y: number, z: number): number {
    const d = this.def;
    // Local frame: u along fwd, v up, w across (side).
    const dx = x - d.x;
    const dz = z - d.z;
    const u = dx * this.fwd.x + dz * this.fwd.z;
    const w = dx * this.side.x + dz * this.side.z;
    const v = y - d.y;
    return d.kind === 'crag' ? this.crag(d, u, v, w, x, y, z) : this.keyhole(d, u, v, w, x, y, z);
  }

  private crag(d: CragDef, u: number, v: number, w: number, x: number, y: number, z: number): number {
    // The top: one plane through the top center, falling along fwd at `slope`. Exact (no noise).
    const s = Math.sin(d.slope);
    const c = Math.cos(d.slope);
    const plane = u * s + v * c;
    // The pillar: a solid of revolution about an axis leaning back under the top (so the top
    // overhangs its fall line), weathered on its flanks.
    const h = Math.max(0, -v);
    const r = hyp(u + CRAG_LEAN * h, w);
    let side = r - cragRadiusAt(d, h);
    if (-v > d.depth) side = Math.max(side, -v - d.depth);
    // Weathering fades in below the top so the landing plane and its rim stay true.
    const below = smoothstep(1.5, 6, -plane);
    // (Lumps only: strata ledges would make small flat shelves, and nothing near the perch may be
    // flatter than its top.)
    if (below > 0) side -= below * this.weather(x, y, z, 1, false);
    return smax(side, plane, CRAG_RIM);
  }

  private keyhole(d: KeyholeDef, u: number, v: number, w: number, x: number, y: number, z: number): number {
    const halfLen = d.chamber / 2 + d.wall;
    const A = d.width / 2;
    const B = d.height / 2;
    // The mass: an islet like the rest of the Archway Reach. A block with a rounded brow and a flat
    // top, over an underside that tapers to a point (an elliptical cone under the block's footprint).
    const body = roundedBox(w, v, u, A, B, halfLen, ISLET_BROW);
    const tail = d.height * ISLET_TAIL;
    const apex = -B - tail;
    const S = Math.min(A, halfLen);
    const r = hyp(w / A, u / halfLen) * S;
    let cone = v <= apex ? hyp(r, apex - v) : (r - S * Math.pow(Math.min(1, (v - apex) / tail), 0.75)) * 0.7;
    // Capped a little way into the block, so it adds only the underside.
    cone = Math.max(cone, v + B - 6);
    let mass = smin(body, cone, 6);
    // Weathered everywhere but the turf on top.
    mass -= this.weather(x, y, z, 1.6, true) * (1 - smoothstep(B - 5, B - 1, v));
    // The chamber (exact): where the bank reversal happens. Its end walls are planes, so the
    // reversal window is the same wherever the wings sweep; only its cross-section is rounded.
    const section = roundedRect(w, v, d.chamberWidth / 2, d.chamberHeight / 2, Math.min(d.chamberWidth, d.chamberHeight) * 0.3);
    const chamber = Math.max(section, Math.abs(u) - d.chamber / 2);
    // The cracks (exact): stadium cross-sections through each wall, tilted ±crackAngle. In the
    // cross-section, w is the rider's left (+) and v up; a bank of +a (rolled right) lifts the
    // left wing, so the entry crack rises toward +w.
    // Each crack runs from outside to the chamber's middle, so its end lies deep in open air (an
    // end inside the wall plane would leave a phantom surface where crack and chamber meet).
    const entry = Math.max(this.crack(d, w, v, d.crackAngle), u);
    const exit = Math.max(this.crack(d, w, v, -d.crackAngle), -u);
    let sd = smax(mass, -chamber, KEYHOLE_LIP);
    sd = smax(sd, -entry, KEYHOLE_LIP);
    return smax(sd, -exit, KEYHOLE_LIP);
  }

  /** Signed distance (in the cross-section) to a crack tilted `a` from horizontal. */
  private crack(d: KeyholeDef, w: number, v: number, a: number): number {
    const along = w * Math.cos(a) + v * Math.sin(a);
    const across = -w * Math.sin(a) + v * Math.cos(a);
    return hyp(Math.max(Math.abs(along) - (d.crackLength - d.crackWidth) / 2, 0), across) - d.crackWidth / 2;
  }

  /**
   * Weathering (m pushed outward): broad lumps, then sedimentary ledges that step the flanks
   * the way the spires' strata do. `scale` sizes the whole pattern to the form.
   */
  private weather(x: number, y: number, z: number, scale: number, ledges: boolean): number {
    const n = this.n;
    const k = 1 / scale;
    const lumps = 1.3 * n(x * 0.045 * k, y * 0.06 * k, z * 0.045 * k) + 0.45 * n(x * 0.16 * k, y * 0.2 * k, z * 0.16 * k);
    if (!ledges) return lumps * scale;
    // Ledges: a soft sawtooth in height, its phase wandering so the bands aren't level rings.
    const band = (y + 5 * n(x * 0.015, 7.1, z * 0.015)) * 0.26 * k;
    // Each band swells slowly and falls away over its last fifth: continuous, so the field (and
    // the collision it gives) has no steps.
    const f = band - Math.floor(band);
    const ledge = 0.35 * (f < 0.8 ? smoothstep(0, 0.8, f) : 1 - smoothstep(0.8, 1, f));
    return (lumps + ledge) * scale;
  }

  /** Conservative distance to the rock (never more than the true distance): for sphere tracing. */
  distance(p: Vector3): number {
    const bound = p.distanceTo(this.center) - this.boundRadius;
    if (bound > 5) return bound;
    return this.sdf(p.x, p.y, p.z) * LIPSCHITZ;
  }

  /** Outward surface normal at (x, y, z) by central differences of the sdf. */
  normal(x: number, y: number, z: number, out: Vector3, e = 0.12): Vector3 {
    out.set(
      this.sdf(x + e, y, z) - this.sdf(x - e, y, z),
      this.sdf(x, y + e, z) - this.sdf(x, y - e, z),
      this.sdf(x, y, z + e) - this.sdf(x, y, z - e),
    );
    const l = out.length();
    return l > 1e-9 ? out.multiplyScalar(1 / l) : out.set(0, 1, 0);
  }

  /**
   * Ground you can stand on (TerrainQuery.groundAt's rule: at or below fromY + 2). The crag: only
   * its top plane, inside its rounded rim, with the plane's exact height and normal; its flanks
   * and rim are collision only, like the arches (a smooth crest would otherwise offer a flat line
   * to land on, and the perch's slope is the whole point). The keyhole: its turf top, like any islet.
   */
  groundAt(x: number, z: number, fromY: number, outNormal: Vector3): number | null {
    const d = this.def;
    if (d.kind === 'keyhole') return this.isletTop(d, x, z, fromY, outNormal);
    const dx = x - d.x;
    const dz = z - d.z;
    if (hyp(dx, dz) > d.topRadius - CRAG_RIM * 1.5) return null;
    const u = dx * this.fwd.x + dz * this.fwd.z;
    const y = d.y - Math.tan(d.slope) * u;
    if (y > fromY + 2) return null;
    const s = Math.sin(d.slope);
    outNormal.set(this.fwd.x * s, Math.cos(d.slope), this.fwd.z * s);
    return y;
  }


  /** The keyhole islet's top surface at (x, z): sphere-traced down from fromY + 2 within the top band. */
  private isletTop(d: KeyholeDef, x: number, z: number, fromY: number, outNormal: Vector3): number | null {
    if (hyp(x - d.x, z - d.z) > this.maxRadius) return null;
    const floor = d.y + d.height / 2 - ISLET_TOP_BAND;
    let y = Math.min(fromY + 2, this.maxY);
    // Starting inside the rock means the top is above fromY + 2: not this query's ground.
    if (y < floor || this.sdf(x, y, z) < 0) return null;
    for (let i = 0; i < 200 && y >= floor; i++) {
      const s = this.sdf(x, y, z);
      if (s < 0.02) {
        let lo = y - 0.2;
        let hi = y + 0.1;
        for (let k = 0; k < 20 && this.sdf(x, lo, z) >= 0; k++) lo -= 0.2;
        for (let k = 0; k < 14; k++) {
          const mid = (lo + hi) / 2;
          if (this.sdf(x, mid, z) < 0) lo = mid;
          else hi = mid;
        }
        this.normal(x, hi, z, outNormal);
        return outNormal.y >= 0.5 ? hi : null;
      }
      y -= Math.max(s * LIPSCHITZ, 0.05);
    }
    return null;
  }
}
