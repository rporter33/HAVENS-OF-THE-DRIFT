// A small kit for building procedural skinned meshes: lofts (rings swept along a path), ellipsoids
// and rounded boxes, each vertex carrying a vertex color, an emissive "glow" amount and up to four
// bone weights. Everything for one rider goes into one geometry (one draw call); normals are
// smoothed per part so separate pieces keep crisp silhouettes where they overlap.

import { BufferAttribute, BufferGeometry, Color, Quaternion, Vector3 } from 'three';
import { mixLinear, recipeOf, scaleLinear, type ColorRecipe } from './palette';
import { proofUV, type ProofSurface } from './proofMaterials';

/** Up to four [bone, weight] pairs; weights are normalized on write. */
export type SkinSpec = readonly number[];

export const sk = (bone: number): SkinSpec => [bone, 1];
/** Blend from bone a (t = 0) to bone b (t = 1). */
export const sk2 = (a: number, b: number, t: number): SkinSpec => {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return u <= 0 ? [a, 1] : u >= 1 ? [b, 1] : [a, 1 - u, b, u];
};

export type ColorFn = (theta: number, ringIndex: number, p: Vector3) => Color;
export type SkinFn = (theta: number, ringIndex: number, p: Vector3) => SkinSpec;

export interface RingSpec {
  /** Ring center. */
  c: Vector3;
  /** Ring axes; θ = 0 points along ax, θ = π/2 along ay. */
  ax: Vector3;
  ay: Vector3;
  rx: number;
  ry: number;
  skin: SkinSpec | SkinFn;
  color: Color | ColorFn;
  glow?: number;
  /** Superellipse exponent: 2 = ellipse, larger = boxier. */
  exp?: number;
  /** Radius multiplier by angle (bumps, asymmetric profiles). */
  radial?: (theta: number) => number;
  /** Extra offset applied along ay for θ in the back half (asymmetric depth): ry for sinθ < 0. */
  ryBack?: number;
  /** Proof-only tile for a ring in a mixed cloth/skin loft. */
  surface?: ProofSurface;
}

const _p = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _n = new Vector3();
const _c3 = new Vector3();
const _d3 = new Vector3();

export class SkinBuilder {
  constructor(private readonly textured = false) {}
  private U: number[] = [];
  private S: number[] = [];
  private materialSurface: ProofSurface = 'neutral';
  /** Component-local UVs, confined to a shared padded tile. Legacy builders stay unchanged. */
  surface(kind: ProofSurface, draw: () => void): void {
    const previous = this.materialSurface;
    this.materialSurface = kind;
    try { draw(); } finally { this.materialSurface = previous; }
  }
  private P: number[] = [];
  private N: number[] = [];
  private C: number[] = [];
  private G: number[] = [];
  private SI: number[] = [];
  private SW: number[] = [];
  private I: number[] = [];
  /** Per vertex: how its color derives from the look (null = constant), for in-place recolors. */
  readonly recipes: (ColorRecipe | null)[] = [];
  private partV = 0;
  private partI = 0;

  get vertexCount(): number {
    return this.P.length / 3;
  }

  /** Start a new smoothing group. */
  begin(): void {
    this.partV = this.vertexCount;
    this.partI = this.I.length;
  }

  /** Close the current smoothing group: compute area-weighted smooth normals for it. */
  end(): void {
    const v0 = this.partV;
    const v1 = this.vertexCount;
    const P = this.P;
    const N = this.N;
    for (let v = v0; v < v1; v++) N[v * 3] = N[v * 3 + 1] = N[v * 3 + 2] = 0;
    for (let i = this.partI; i < this.I.length; i += 3) {
      const a = this.I[i] * 3;
      const b = this.I[i + 1] * 3;
      const c = this.I[i + 2] * 3;
      _a.set(P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]);
      _b.set(P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]);
      _n.crossVectors(_a, _b);
      for (const k of [a, b, c]) {
        N[k] += _n.x;
        N[k + 1] += _n.y;
        N[k + 2] += _n.z;
      }
    }
    for (let v = v0; v < v1; v++) {
      _n.set(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]);
      if (_n.lengthSq() < 1e-20) _n.set(0, 1, 0);
      _n.normalize();
      N[v * 3] = _n.x;
      N[v * 3 + 1] = _n.y;
      N[v * 3 + 2] = _n.z;
    }
    this.partV = this.vertexCount;
    this.partI = this.I.length;
  }

  vertex(p: Vector3, color: Color, skin: SkinSpec, glow = 0, uv: readonly number[] = [.5, .5], surface = this.materialSurface): number {
    this.P.push(p.x, p.y, p.z);
    this.N.push(0, 1, 0);
    this.C.push(color.r, color.g, color.b);
    this.recipes.push(recipeOf(color) ?? null);
    this.G.push(glow);
    if (this.textured) {
      this.U.push(...proofUV(surface, uv[0], uv[1]));
      this.S.push(['neutral', 'linen', 'scale', 'leather', 'bronze'].indexOf(surface));
    }
    let sum = 0;
    for (let k = 1; k < skin.length; k += 2) sum += skin[k];
    for (let k = 0; k < 4; k++) {
      const has = k * 2 < skin.length;
      this.SI.push(has ? skin[k * 2] : 0);
      this.SW.push(has ? skin[k * 2 + 1] / (sum || 1) : 0);
    }
    return this.vertexCount - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.I.push(a, b, c);
  }

  /** Position of vertex i (into out). */
  pos(i: number, out: Vector3): Vector3 {
    return out.set(this.P[i * 3], this.P[i * 3 + 1], this.P[i * 3 + 2]);
  }

  /** Quad a-b-c-d (in order around its edge), wound so its face normal agrees with `facing`. */
  quadFacing(a: number, b: number, c: number, d: number, facing: Vector3): void {
    this.pos(a, _p);
    this.pos(b, _a).sub(_p);
    this.pos(c, _b).sub(_p);
    _n.crossVectors(_a, _b);
    if (_n.dot(facing) >= 0) {
      this.tri(a, b, c);
      this.tri(a, c, d);
    } else {
      this.tri(a, c, b);
      this.tri(a, d, c);
    }
  }

  /**
   * A thick sheet: a (cols+1)×(rows+1) grid of outer points with an inner skin `thickness`
   * behind it, closed at the edges. `at(u, v, outPoint, outNormal)` gives the outer surface.
   */
  sheet(
    cols: number,
    rows: number,
    at: (u: number, v: number, p: Vector3, n: Vector3) => void,
    thickness: number,
    skin: (u: number, v: number) => SkinSpec,
    color: (u: number, v: number, inner: boolean) => Color,
    glow = 0,
  ): void {
    this.begin();
    const p = new Vector3();
    const n = new Vector3();
    const W = cols + 1;
    const outer = this.vertexCount;
    const normals: Vector3[] = [];
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        at(i / cols, j / rows, p, n);
        normals.push(n.clone());
        this.vertex(p, color(i / cols, j / rows, false), skin(i / cols, j / rows), glow, [i / cols, j / rows]);
      }
    }
    const inner = this.vertexCount;
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        at(i / cols, j / rows, p, n);
        p.addScaledVector(n, -thickness);
        this.vertex(p, color(i / cols, j / rows, true), skin(i / cols, j / rows), glow, [i / cols, j / rows]);
      }
    }
    const neg = new Vector3();
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * W + i;
        const nn = normals[k];
        this.quadFacing(outer + k, outer + k + 1, outer + k + 1 + W, outer + k + W, nn);
        this.quadFacing(inner + k, inner + k + 1, inner + k + 1 + W, inner + k + W, neg.copy(nn).negate());
      }
    }
    // Edges: facing away from the sheet's middle.
    const mid = new Vector3();
    this.pos(outer + Math.floor(rows / 2) * W + Math.floor(cols / 2), mid);
    const edge = (k0: number, k1: number) => {
      this.pos(outer + k0, _c3).add(this.pos(outer + k1, _d3)).multiplyScalar(0.5).sub(mid);
      this.quadFacing(outer + k0, outer + k1, inner + k1, inner + k0, _c3);
    };
    for (let i = 0; i < cols; i++) {
      edge(i, i + 1);
      edge(rows * W + i, rows * W + i + 1);
    }
    for (let j = 0; j < rows; j++) {
      edge(j * W, (j + 1) * W);
      edge(j * W + cols, (j + 1) * W + cols);
    }
    this.end();
  }

  /**
   * Sweep rings into a closed tube (no seam). Caps close the ends with a small dome so tube ends
   * read as rounded. Winding is chosen so faces point outward whichever way the path runs.
   */
  loft(rings: RingSpec[], seg: number, opts: { capStart?: boolean; capEnd?: boolean; capBulge?: number } = {}): void {
    this.begin();
    const base = this.vertexCount;
    const seam = this.textured && (this.materialSurface !== 'neutral' || rings.some(r => r.surface && r.surface !== 'neutral'));
    const stride = seg + (seam ? 1 : 0);
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      const e = r.exp ?? 2;
      for (let j = 0; j < stride; j++) {
        const th = (j / seg) * Math.PI * 2;
        const cs = Math.cos(th);
        const sn = Math.sin(th);
        const ux = Math.sign(cs) * Math.pow(Math.abs(cs), 2 / e);
        const uy = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / e);
        const m = r.radial ? r.radial(th) : 1;
        const ry = sn < 0 && r.ryBack !== undefined ? r.ryBack : r.ry;
        _p.copy(r.c).addScaledVector(r.ax, ux * r.rx * m).addScaledVector(r.ay, uy * ry * m);
        const col = typeof r.color === 'function' ? r.color(th, i, _p) : r.color;
        const s = typeof r.skin === 'function' ? r.skin(th, i, _p) : r.skin;
        this.vertex(_p, col, s, r.glow ?? 0, [j / seg, i / Math.max(1, rings.length - 1)], r.surface ?? this.materialSurface);
      }
    }
    // Orientation: does ax × ay point along the path?
    const d = _a.copy(rings[Math.min(1, rings.length - 1)].c).sub(rings[0].c);
    if (d.lengthSq() < 1e-12) d.copy(rings[rings.length - 1].c).sub(rings[0].c);
    const flip = _b.crossVectors(rings[0].ax, rings[0].ay).dot(d) < 0;
    for (let i = 0; i < rings.length - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const a = base + i * stride + j;
        const b = base + i * stride + (seam ? j + 1 : (j + 1) % seg);
        const c = a + stride;
        const dd = b + stride;
        if (!flip) {
          this.tri(a, b, c);
          this.tri(b, dd, c);
        } else {
          this.tri(a, c, b);
          this.tri(b, c, dd);
        }
      }
    }
    const cap = (ri: number, dir: number) => {
      const r = rings[ri];
      const axis = _n.crossVectors(r.ax, r.ay).normalize().multiplyScalar(flip ? -1 : 1);
      const bulge = (opts.capBulge ?? 0.5) * Math.min(r.rx, r.ry) * dir;
      _p.copy(r.c).addScaledVector(axis, bulge);
      const col = typeof r.color === 'function' ? r.color(0, ri, _p) : r.color;
      const s = typeof r.skin === 'function' ? r.skin(0, ri, _p) : r.skin;
      const center = this.vertex(_p, col, s, r.glow ?? 0);
      const start = base + ri * stride;
      for (let j = 0; j < seg; j++) {
        const a = start + j;
        const b = start + (seam ? j + 1 : (j + 1) % seg);
        // dir < 0 (start cap) faces backward along the path.
        if ((dir < 0) !== flip) this.tri(center, b, a);
        else this.tri(center, a, b);
      }
    };
    if (opts.capStart) cap(0, -1);
    if (opts.capEnd) cap(rings.length - 1, 1);
    this.end();
    if (seam) for (let i = 0; i < rings.length; i++) {
      const a = (base + i * stride) * 3, b = a + seg * 3;
      _n.set(this.N[a] + this.N[b], this.N[a + 1] + this.N[b + 1], this.N[a + 2] + this.N[b + 2]).normalize();
      for (const k of [a, b]) { this.N[k] = _n.x; this.N[k + 1] = _n.y; this.N[k + 2] = _n.z; }
    }
  }

  /**
   * UV ellipsoid centered at c with radii r, optionally rotated, optionally deformed. `deform`
   * receives the unit-sphere point (and may edit it) before scaling.
   */
  ellipsoid(
    c: Vector3,
    r: Vector3,
    skin: SkinSpec | ((unit: Vector3) => SkinSpec),
    color: Color | ((unit: Vector3) => Color),
    opts: { rot?: Quaternion; lat?: number; lon?: number; deform?: (unit: Vector3) => void; glow?: number | ((unit: Vector3) => number) } = {},
  ): void {
    this.begin();
    const lat = opts.lat ?? 8;
    const lon = opts.lon ?? 12;
    const base = this.vertexCount;
    const u = new Vector3();
    const emit = (x: number, y: number, z: number, uv: readonly number[] = [.5, .5]) => {
      u.set(x, y, z);
      const col = typeof color === 'function' ? color(u) : color;
      const s = typeof skin === 'function' ? skin(u) : skin;
      const g = typeof opts.glow === 'function' ? opts.glow(u) : opts.glow ?? 0;
      if (opts.deform) opts.deform(u);
      _p.set(u.x * r.x, u.y * r.y, u.z * r.z);
      if (opts.rot) _p.applyQuaternion(opts.rot);
      _p.add(c);
      return this.vertex(_p, col, s, g, uv);
    };
    const top = emit(0, 1, 0);
    for (let i = 1; i < lat; i++) {
      const phi = (i / lat) * Math.PI;
      const y = Math.cos(phi);
      const s = Math.sin(phi);
      for (let j = 0; j < lon; j++) {
        const th = (j / lon) * Math.PI * 2;
        emit(Math.sin(th) * s, y, Math.cos(th) * s, [j / lon, i / lat]);
      }
    }
    const bottom = emit(0, -1, 0);
    const ring = (i: number, j: number) => base + 1 + (i - 1) * lon + (j % lon);
    for (let j = 0; j < lon; j++) this.tri(top, ring(1, j), ring(1, j + 1));
    for (let i = 1; i < lat - 1; i++) {
      for (let j = 0; j < lon; j++) {
        const a = ring(i, j);
        const b = ring(i, j + 1);
        const cc = ring(i + 1, j);
        const d = ring(i + 1, j + 1);
        this.tri(a, cc, b);
        this.tri(b, cc, d);
      }
    }
    for (let j = 0; j < lon; j++) this.tri(bottom, ring(lat - 1, j + 1), ring(lat - 1, j));
    this.end();
  }

  /** A rounded box between two points (a straight loft with a boxy superellipse section). */
  bar(
    from: Vector3,
    to: Vector3,
    ax: Vector3,
    halfW: number,
    halfH: number,
    skin: SkinSpec,
    color: Color,
    opts: { exp?: number; seg?: number; glow?: number; caps?: boolean } = {},
  ): void {
    const dir = new Vector3().subVectors(to, from).normalize();
    const x = ax.clone().addScaledVector(dir, -ax.dot(dir)).normalize();
    const y = new Vector3().crossVectors(dir, x).normalize();
    const exp = opts.exp ?? 5;
    const ring = (c: Vector3): RingSpec => ({ c, ax: x, ay: y, rx: halfW, ry: halfH, skin, color, exp, glow: opts.glow });
    this.loft([ring(from.clone()), ring(to.clone())], opts.seg ?? 8, { capStart: opts.caps ?? true, capEnd: opts.caps ?? true, capBulge: 0.05 });
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.P), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.N), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.C), 3));
    g.setAttribute('glow', new BufferAttribute(new Float32Array(this.G), 1));
    g.setAttribute('skinIndex', new BufferAttribute(new Uint16Array(this.SI), 4));
    g.setAttribute('skinWeight', new BufferAttribute(new Float32Array(this.SW), 4));
    if (this.textured) {
      g.setAttribute('uv', new BufferAttribute(new Float32Array(this.U), 2));
      g.setAttribute('c02Surface', new BufferAttribute(new Float32Array(this.S), 1));
    }
    const n = this.vertexCount;
    g.setIndex(n > 65535 ? new BufferAttribute(new Uint32Array(this.I), 1) : new BufferAttribute(new Uint16Array(this.I), 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** Parse a "#rrggbb" look color (to linear). */
export function col(hex: string): Color {
  return new Color(hex);
}

/** Mix two colors into a new one. */
export function mixCol(a: Color, b: Color | string, t: number): Color {
  return mixLinear(a, typeof b === 'string' ? new Color(b) : b, t);
}

/** Scale a color's brightness (in linear space) into a new one. */
export function shade(a: Color, k: number): Color {
  return scaleLinear(a, k);
}
