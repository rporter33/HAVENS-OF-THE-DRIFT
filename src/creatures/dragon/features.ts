// The white dragon's built features (G12b, Robert 2026-10-19: "the wings need a little bit more of a
// pass about their static mesh and then also the claws"; the eyes "a little more definition"). Made
// at load from the game's own skeleton and the fitted body, so the G12a files stay as they are:
//
//   membrane  one clean sheet per wing in three panels, as the wyverns' wings are built
//             (wyvern/parts/wings.ts): A and B between the fingers, out from the knuckle to a
//             scalloped trailing edge; C from the arm and the inner finger to the flank. The fitted
//             body's membrane is two thin faces that decimation left uneven; posed, they cross and
//             facet. Skinned across each panel (A, B: between the two fingers' segments; C: the arm
//             and inner finger, falling to the spine toward the flank), so folded it stays one sheet
//             and its root stays on the flank.
//   fingers   the wing's three fingers as tapered bones from the knuckle to the tip, a little
//             swollen at the joint, in the plates' blue (render 08's powder-blue wing bones). The
//             fitted fingers carried torn fringes of the old membrane; their flesh gives way to these.
//             A small claw at each tip, and render 08's hooked thumb claw at the wrist.
//   claws     a curved, laterally pressed slate claw on each of the feet's claw sites (the larger
//             clusters of the fit's claw region), its base sunk over the site and its skin the
//             flesh's around it. The fit's own claws were flat facets; its small stray patches (dark
//             texture on the toes' tops) become hide.
//   eyes      an almond eyeball in each eye, standing a little proud of the skin round the fitted
//             eye patch, the hide shader's eye region over it (iris, slit pupil, lids); the dark lid
//             line round it is the shader's (materials.ts).
//
// Attributes follow the wyvern builder's conventions (wyvern/builder.ts): membranes aMat = (wing,
// thin, edge, flutter) and aUv2 = (along, across + panel); claws aMat.x = 9, aUv2.x 0 at the base to
// 1 at the tip; the eye aMat.x = 2.

import { Vector3 } from 'three';
import { smoothstep } from '../../core/math';
import type { DragonBodyAsset } from './asset';
import type { DragonRigDef } from './rig';

/** A built piece in the parts' layout (parts.ts): joints index the rig's bones. */
export interface BuiltPiece {
  piece: string;
  position: Float32Array;
  normal: Float32Array;
  joints: Uint16Array;
  weights: Float32Array;
  mat: Float32Array;
  uv2: Float32Array;
  extra: Float32Array;
  /** [opaque, membrane] triangle lists. */
  index: [Uint32Array, Uint32Array];
}

type Skin = Map<number, number>;

/** Accumulates one piece's vertices and triangles. */
class Builder {
  private p: number[] = [];
  private n: number[] = [];
  private j: number[] = [];
  private w: number[] = [];
  private m: number[] = [];
  private u: number[] = [];
  private tri: [number[], number[]] = [[], []];

  get count(): number {
    return this.p.length / 3;
  }

  vertex(pos: Vector3, skin: Skin, mat: [number, number, number, number], uv: [number, number]): number {
    this.p.push(pos.x, pos.y, pos.z);
    this.n.push(0, 0, 0);
    // The four heaviest bones, renormalized.
    const top = [...skin.entries()].filter(([, w]) => w > 1e-5).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
    for (let k = 0; k < 4; k++) {
      this.j.push(top[k]?.[0] ?? 0);
      this.w.push(top[k] ? top[k][1] / sum : 0);
    }
    this.m.push(...mat);
    this.u.push(...uv);
    return this.count - 1;
  }

  setNormal(i: number, v: Vector3): void {
    this.n[i * 3] = v.x;
    this.n[i * 3 + 1] = v.y;
    this.n[i * 3 + 2] = v.z;
  }

  triangle(group: 0 | 1, a: number, b: number, c: number): void {
    this.tri[group].push(a, b, c);
  }

  /** Area-weighted normals from the triangles, for vertices without one set; `orient` flips each to agree. */
  smoothNormals(orient?: (i: number, n: Vector3) => boolean): void {
    const acc = new Float64Array(this.p.length);
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    for (const list of this.tri) {
      for (let t = 0; t < list.length; t += 3) {
        const [i, k, l] = [list[t], list[t + 1], list[t + 2]];
        a.fromArray(this.p, i * 3);
        b.fromArray(this.p, k * 3).sub(a);
        c.fromArray(this.p, l * 3).sub(a);
        b.cross(c);
        for (const v of [i, k, l]) {
          acc[v * 3] += b.x;
          acc[v * 3 + 1] += b.y;
          acc[v * 3 + 2] += b.z;
        }
      }
    }
    const nv = new Vector3();
    for (let i = 0; i < this.count; i++) {
      if (this.n[i * 3] !== 0 || this.n[i * 3 + 1] !== 0 || this.n[i * 3 + 2] !== 0) continue;
      nv.set(acc[i * 3], acc[i * 3 + 1], acc[i * 3 + 2]).normalize();
      if (nv.lengthSq() < 0.5) nv.set(0, 1, 0);
      if (orient && orient(i, nv)) nv.negate();
      this.setNormal(i, nv);
    }
  }

  /** Turn each triangle to face the way its vertices' normals do. */
  windToNormals(): void {
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const n = new Vector3();
    for (const list of this.tri) {
      for (let t = 0; t < list.length; t += 3) {
        a.fromArray(this.p, list[t] * 3);
        b.fromArray(this.p, list[t + 1] * 3).sub(a);
        c.fromArray(this.p, list[t + 2] * 3).sub(a);
        b.cross(c);
        n.set(0, 0, 0);
        for (let k = 0; k < 3; k++) n.add(new Vector3().fromArray(this.n, list[t + k] * 3));
        if (b.dot(n) < 0) [list[t + 1], list[t + 2]] = [list[t + 2], list[t + 1]];
      }
    }
  }

  done(piece: string): BuiltPiece {
    const n = this.count;
    const extra = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) extra[i * 4] = 1;
    return {
      piece,
      position: Float32Array.from(this.p),
      normal: Float32Array.from(this.n),
      joints: Uint16Array.from(this.j),
      weights: Float32Array.from(this.w),
      mat: Float32Array.from(this.m),
      uv2: Float32Array.from(this.u),
      extra,
      index: [Uint32Array.from(this.tri[0]), Uint32Array.from(this.tri[1])],
    };
  }
}

// ---------------------------------------------------------------------------------------------
// Membranes
// ---------------------------------------------------------------------------------------------

/** Membrane resolution per LOD: [along, across] for the finger panels and the inner panel. */
export const MEMBRANE_RES: { fingers: [number, number]; inner: [number, number] }[] = [
  { fingers: [16, 6], inner: [14, 10] },
  { fingers: [8, 3], inner: [7, 5] },
  { fingers: [4, 2], inner: [4, 3] },
];

/** How deep the trailing edge scallops between finger tips (fraction of the gap), as the wyverns'. */
export const SCALLOP = 0.18;
/** The membrane's thinness at its thinnest (the hide shader's light through it): a large animal's
 * wing is thicker than a wyvern's, and at 1 the backlit sheet glowed white. */
export const MEMBRANE_THIN = 0.55;

/** A polyline with its arc length, sampled at a fraction of the length. */
class Line {
  readonly len: number[] = [0];
  constructor(readonly pts: Vector3[]) {
    for (let i = 1; i < pts.length; i++) this.len.push(this.len[i - 1] + pts[i].distanceTo(pts[i - 1]));
  }
  get total(): number {
    return this.len[this.len.length - 1];
  }
  /** The point at fraction f of the length, and which segment (and how far along it) it falls on. */
  at(f: number, out: Vector3): { seg: number; along: number } {
    const s = Math.min(1, Math.max(0, f)) * this.total;
    let i = 0;
    while (i < this.pts.length - 2 && this.len[i + 1] < s) i++;
    const along = Math.min(1, Math.max(0, (s - this.len[i]) / Math.max(1e-9, this.len[i + 1] - this.len[i])));
    out.lerpVectors(this.pts[i], this.pts[i + 1], along);
    return { seg: i, along };
  }
  /** Fraction of the length at the start of segment i. */
  joint(i: number): number {
    return this.len[i] / this.total;
  }
}

/** Distance from p to segment ab. */
function segDist(p: Vector3, a: Vector3, b: Vector3): number {
  const ab = new Vector3().subVectors(b, a);
  const t = Math.min(1, Math.max(0, new Vector3().subVectors(p, a).dot(ab) / Math.max(1e-12, ab.lengthSq())));
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

/** Both wings' membranes at a LOD (bind pose, body space), skinned to the rig. */
export function buildMembranes(rig: DragonRigDef, lod: number): BuiltPiece {
  const R = MEMBRANE_RES[Math.min(2, Math.max(0, lod))];
  const b = new Builder();
  const { idx } = rig;
  const mirror = (v: Vector3, side: number) => (side === 0 ? v.clone() : new Vector3(-v.x, v.y, v.z));
  for (let side = 0; side < 2; side++) {
    const w = idx.wings[side];
    const pos = (i: number) => rig.bones[i].pos;
    const root = pos(w.humerus);
    const elbow = pos(w.forearm);
    const wrist = pos(w.hand);
    const knuckle = pos(w.fingers[0][0]);
    const tips = rig.fingerTips.map((t) => mirror(t, side));
    const fingers = [0, 1, 2].map((k) => new Line([knuckle, pos(w.fingers[k][1]), tips[k]]));
    /** Finger k's skin at fraction f along it, scaled by `share`, into s; the segments blend near the joint. */
    const fingerSkin = (k: number, f: number, share: number, s: Skin) => {
      const j = fingers[k].joint(1);
      const toB = smoothstep(j - 0.06, j + 0.06, f);
      const [a, bb] = w.fingers[k];
      s.set(a, (s.get(a) ?? 0) + share * (1 - toB));
      s.set(bb, (s.get(bb) ?? 0) + share * toB);
    };
    const p = new Vector3();
    const fa = new Vector3();
    const fb = new Vector3();
    const groupStart = b.count;

    // A and B: between fingers k and k + 1, out from the knuckle to the scalloped trailing edge.
    for (let sec = 0; sec < 2; sec++) {
      const [nt, nv] = R.fingers;
      const grid: number[][] = [];
      for (let i = 0; i <= nt; i++) {
        const row: number[] = [];
        for (let jv = 0; jv <= nv; jv++) {
          const t = i / nt;
          const v = jv / nv;
          // The scallop: mid-panel the trailing edge falls back toward the knuckle.
          const reach = 1 - SCALLOP * Math.sin(Math.PI * v);
          const f = t * reach;
          fingers[sec].at(f, fa);
          fingers[sec + 1].at(f, fb);
          p.lerpVectors(fa, fb, v);
          const skin: Skin = new Map();
          fingerSkin(sec, f, 1 - v, skin);
          fingerSkin(sec + 1, f, v, skin);
          const thin = MEMBRANE_THIN * Math.pow(t, 0.6) * Math.sin(Math.PI * v);
          row.push(b.vertex(p, skin, [0, thin, t, t * t * (0.35 + 0.65 * Math.sin(Math.PI * v))], [t, v + sec]));
        }
        grid.push(row);
      }
      quads(b, grid, 1);
    }

    // C: from the arm and the inner finger to the flank. A Coons patch over the four edges: the
    // inner finger (knuckle → tip), the arm (knuckle → wrist → elbow → root), the flank (root → the
    // trailing root) and the trailing edge (tip → trailing root, scalloped toward the elbow).
    const trail = mirror(rig.trailRoot, side);
    const arm = new Line([knuckle, wrist, elbow, root]);
    const flank = new Line([root, trail]);
    const tip2 = tips[2];
    const inward = elbow.clone().sub(tip2.clone().lerp(trail, 0.5));
    inward.y = 0;
    inward.normalize();
    const sag = SCALLOP * 1.2 * tip2.distanceTo(trail);
    const edgeAt = (u: number, out: Vector3) => out.lerpVectors(tip2, trail, u).addScaledVector(inward, sag * Math.sin(Math.PI * u));
    const [nt, nu] = R.inner;
    const c0 = new Vector3();
    const c1 = new Vector3();
    const d0 = new Vector3();
    const d1 = new Vector3();
    const wingBones = [
      [w.humerus, root, elbow],
      [w.forearm, elbow, wrist],
      [w.hand, wrist, knuckle],
      [w.fingers[2][0], knuckle, pos(w.fingers[2][1])],
      [w.fingers[2][1], pos(w.fingers[2][1]), tip2],
    ] as const;
    const grid: number[][] = [];
    for (let i = 0; i <= nt; i++) {
      const row: number[] = [];
      for (let ju = 0; ju <= nu; ju++) {
        const s = i / nt;
        const u = ju / nu;
        fingers[2].at(s, c0);
        flank.at(s, c1);
        arm.at(u, d0);
        edgeAt(u, d1);
        // Coons: the two rulings less the bilinear of the corners.
        p.copy(c0)
          .multiplyScalar(1 - u)
          .addScaledVector(c1, u)
          .addScaledVector(d0, 1 - s)
          .addScaledVector(d1, s)
          .addScaledVector(knuckle, -(1 - s) * (1 - u))
          .addScaledVector(tip2, -s * (1 - u))
          .addScaledVector(root, -(1 - s) * u)
          .addScaledVector(trail, -s * u);
        // Skin: the wing bones by nearness (smooth over the regular grid), giving way to the spine
        // toward the flank; the arm's own edge (s = 0) stays the arm's.
        const skin: Skin = new Map();
        const body = Math.pow(u, 1.5) * smoothstep(0, 0.35, s);
        let total = 0;
        const near: [number, number][] = wingBones.map(([bone, a, bb]) => {
          const wgt = 1 / Math.pow(segDist(p, a, bb) + 0.05, 3);
          total += wgt;
          return [bone, wgt];
        });
        for (const [bone, wgt] of near) skin.set(bone, (skin.get(bone) ?? 0) + ((1 - body) * wgt) / total);
        skin.set(idx.spine, body);
        const thin = MEMBRANE_THIN * Math.pow(Math.sin(Math.PI * u), 0.8) * smoothstep(0, 0.25, s);
        row.push(b.vertex(p, skin, [0, thin, s, s * s * 0.5 * Math.sin(Math.PI * u)], [s, 2 + u]));
      }
      grid.push(row);
    }
    quads(b, grid, 1);
    // The dorsal side (bind +Y) is the upper face, as the hide shader reads it.
    const first = groupStart;
    b.smoothNormals((i, n) => i >= first && n.y < 0);
  }
  b.windToNormals();
  return b.done('membrane');
}

/** Two triangles per grid cell into `group`. */
function quads(b: Builder, grid: number[][], group: 0 | 1): void {
  for (let i = 0; i < grid.length - 1; i++) {
    for (let j = 0; j < grid[i].length - 1; j++) {
      const a = grid[i][j];
      const c = grid[i + 1][j];
      const d = grid[i + 1][j + 1];
      const e = grid[i][j + 1];
      b.triangle(group, a, c, d);
      b.triangle(group, a, d, e);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Fingers
// ---------------------------------------------------------------------------------------------

/** Finger bones: radius at the knuckle and the tip (m), the joint's swelling, the leading finger's
 * extra girth, and the resolution per LOD ([sides, rings]). */
export const FINGER = { root: 0.075, tip: 0.022, joint: 0.18, leading: 1.12, res: [[8, 14], [5, 6], [3, 3]] as [number, number][] };
/** The claws at the finger tips and the thumb claw at the wrist: length and base radius (m). */
export const WING_CLAWS = { tip: { length: 0.17, radius: 0.026 }, thumb: { length: 0.42, radius: 0.065 } };

/** Both wings' finger bones at a LOD (bind pose, body space), skinned along each finger's two bones. */
export function buildFingers(rig: DragonRigDef, lod: number): BuiltPiece {
  const [sides, rings] = FINGER.res[Math.min(2, Math.max(0, lod))];
  const b = new Builder();
  const { idx } = rig;
  const mirror = (v: Vector3, side: number) => (side === 0 ? v.clone() : new Vector3(-v.x, v.y, v.z));
  const p = new Vector3();
  const q = new Vector3();
  const up = new Vector3();
  const across = new Vector3();
  const nrm = new Vector3();
  for (let side = 0; side < 2; side++) {
    const w = idx.wings[side];
    const knuckle = rig.bones[w.fingers[0][0]].pos;
    // How far out the arm the knuckle is (the hide shader's wing coordinate, 20 + distance).
    const out = rig.bones[w.humerus].pos.distanceTo(rig.bones[w.forearm].pos) + rig.bones[w.forearm].pos.distanceTo(rig.bones[w.hand].pos) + rig.bones[w.hand].pos.distanceTo(knuckle);
    for (let k = 0; k < 3; k++) {
      const [ba, bb] = w.fingers[k];
      const mid = rig.bones[bb].pos;
      const tip = mirror(rig.fingerTips[k], side);
      const line = new Line([knuckle, mid, tip]);
      const jf = line.joint(1);
      const girth = k === 0 ? FINGER.leading : 1;
      const rowsIdx: number[][] = [];
      for (let r = 0; r <= rings; r++) {
        const f = r / rings;
        const { seg } = line.at(f, p);
        const dir = (seg === 0 ? mid.clone().sub(knuckle) : tip.clone().sub(mid)).normalize();
        // A frame across the bone: "up" is the wing's dorsal side (bind +Y).
        up.set(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
        across.crossVectors(dir, up).normalize();
        const swell = 1 + FINGER.joint * Math.exp(-Math.pow((f - jf) / 0.05, 2));
        const rad = (FINGER.root + (FINGER.tip - FINGER.root) * f) * swell * girth;
        const toB = smoothstep(jf - 0.05, jf + 0.05, f);
        const skin: Skin = new Map([
          [ba, 1 - toB],
          [bb, toB],
        ]);
        const row: number[] = [];
        for (let i = 0; i < sides; i++) {
          const a = (i / sides) * Math.PI * 2;
          nrm.copy(up).multiplyScalar(Math.cos(a)).addScaledVector(across, Math.sin(a));
          q.copy(p).addScaledVector(nrm, rad);
          // Region 0 hide in the plates' blue (the dorsal channel), out along the arm.
          const v = b.vertex(q, skin, [0, 0, 1, 0], [20 + out + f * line.total, Math.cos(a)]);
          b.setNormal(v, nrm);
          row.push(v);
        }
        rowsIdx.push(row);
      }
      for (let r = 0; r < rings; r++) {
        for (let i = 0; i < sides; i++) {
          const a = rowsIdx[r][i];
          const c = rowsIdx[r][(i + 1) % sides];
          const d = rowsIdx[r + 1][(i + 1) % sides];
          const e = rowsIdx[r + 1][i];
          b.triangle(0, a, c, d);
          b.triangle(0, a, d, e);
        }
      }
    }
  }
  b.windToNormals();
  return b.done('fingers');
}

/** The wing claws as claw sites: a small one at each finger tip, and the thumb's hook at the wrist. */
export function wingClawSites(rig: DragonRigDef): ClawSite[] {
  const sites: ClawSite[] = [];
  const { idx } = rig;
  for (let side = 0; side < 2; side++) {
    const w = idx.wings[side];
    const sx = side === 0 ? 1 : -1;
    for (let k = 0; k < 3; k++) {
      const mid = rig.bones[w.fingers[k][1]].pos;
      const tip = rig.fingerTips[k].clone();
      if (side === 1) tip.x = -tip.x;
      const dir = tip.clone().sub(mid).normalize();
      sites.push({ base: tip, dir, length: WING_CLAWS.tip.length, radius: WING_CLAWS.tip.radius, joints: [w.fingers[k][1]], weights: [1], foot: false });
    }
    // The thumb: from the knuckle, forward along the leading edge and a little out and up.
    const knuckle = rig.bones[w.fingers[0][0]].pos;
    sites.push({
      base: knuckle.clone(),
      dir: new Vector3(0.35 * sx, 0.25, 1).normalize(),
      length: WING_CLAWS.thumb.length,
      radius: WING_CLAWS.thumb.radius,
      joints: [w.hand],
      weights: [1],
      foot: false,
    });
  }
  return sites;
}

// ---------------------------------------------------------------------------------------------
// Claws
// ---------------------------------------------------------------------------------------------

/** One claw site on the fitted body: where its base sits, where it points, and the flesh's skin there. */
export interface ClawSite {
  base: Vector3;
  /** Unit direction base → tip. */
  dir: Vector3;
  length: number;
  radius: number;
  joints: number[];
  weights: number[];
  /** Whether it is on a foot (curls down) or a wing finger. */
  foot: boolean;
}

/** Clusters of the fit's claw region with at least this many vertices are claws; smaller are stray. */
export const CLAW_MIN_VERTS = 12;
/** Claw shape: the length kept of the site's and its bounds (m), the widest a single fitted claw is (m),
 * the base's share of the site's radius, how far back it sinks, its curl and its sideways press. */
export const CLAW = { length: 0.9, minLength: 0.14, maxLength: 0.32, maxRadius: 0.06, width: 0.3, base: 1.3, sink: 0.25, curl: 0.3, press: 0.72 };
/** Claw resolution per LOD: [sides, rings]. */
export const CLAW_RES: [number, number][] = [
  [6, 5],
  [4, 3],
  [3, 1],
];

const FOOT = /^(forepaw|foretoes|meta|toes)[LR]$/;

/** Connected clusters of the body's claw-region vertices (aMat.x = 9) over its opaque triangles. */
export function clawClusters(body: DragonBodyAsset): number[][] {
  const n = body.position.length / 3;
  const claw = (v: number) => Math.round(body.mat[v * 4]) === 9;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const tris = body.index[0];
  for (let i = 0; i < tris.length; i += 3) {
    if (claw(tris[i]) && claw(tris[i + 1]) && claw(tris[i + 2])) {
      parent[find(tris[i + 1])] = find(tris[i]);
      parent[find(tris[i + 2])] = find(tris[i]);
    }
  }
  const groups = new Map<number, number[]>();
  for (let v = 0; v < n; v++) {
    if (!claw(v)) continue;
    const r = find(v);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(v);
  }
  return [...groups.values()];
}

/** The claw sites of the fitted body (LOD0): every claw cluster big enough to be a claw. */
export function clawSites(body: DragonBodyAsset, rig: DragonRigDef): ClawSite[] {
  const n = body.position.length / 3;
  const P = (v: number) => new Vector3(body.position[v * 3], body.position[v * 3 + 1], body.position[v * 3 + 2]);
  const byName = new Map(rig.bones.map((b, i) => [b.name, i]));
  // Hide vertices by position: a claw vertex at the same place as a hide vertex is on the base ring.
  const key = (p: Vector3) => `${Math.round(p.x * 2000)},${Math.round(p.y * 2000)},${Math.round(p.z * 2000)}`;
  const hide = new Set<string>();
  for (let v = 0; v < n; v++) if (Math.round(body.mat[v * 4]) !== 9) hide.add(key(P(v)));
  const sites: ClawSite[] = [];
  // A cluster wider than one claw is two fitted claws run together: split it in two, by distance
  // from its two farthest-apart vertices, until each part is one claw wide.
  const parts: number[][] = [];
  const split = (g: number[], depth: number) => {
    let a = g[0];
    let bb = g[0];
    let far = 0;
    for (const u of g) for (const v of g) if (P(u).distanceTo(P(v)) > far) [a, bb, far] = [u, v, P(u).distanceTo(P(v))];
    if (far <= CLAW.width || depth >= 2) {
      parts.push(g);
      return;
    }
    const A = P(a);
    const B = P(bb);
    split(g.filter((v) => P(v).distanceTo(A) <= P(v).distanceTo(B)), depth + 1);
    split(g.filter((v) => P(v).distanceTo(A) > P(v).distanceTo(B)), depth + 1);
  };
  for (const g of clawClusters(body)) if (g.length >= CLAW_MIN_VERTS) split(g, 0);
  for (const g of parts) {
    if (g.length < CLAW_MIN_VERTS / 2) continue;
    const ring = g.filter((v) => hide.has(key(P(v))));
    const rim = ring.length >= 3 ? ring : g;
    const base = new Vector3();
    for (const v of rim) base.add(P(v));
    base.multiplyScalar(1 / rim.length);
    let tip = P(g[0]);
    for (const v of g) if (P(v).distanceTo(base) > tip.distanceTo(base)) tip = P(v);
    let radius = 0;
    for (const v of rim) radius = Math.max(radius, P(v).distanceTo(base));
    // The flesh's skin around the base: the ring's weights averaged.
    const skin: Skin = new Map();
    for (const v of rim) {
      for (let k = 0; k < 4; k++) {
        const wgt = body.weights[v * 4 + k];
        if (!(wgt > 0)) continue;
        const bone = byName.get(body.jointNames[body.joints[v * 4 + k]])!;
        skin.set(bone, (skin.get(bone) ?? 0) + wgt);
      }
    }
    const top = [...skin.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
    const sum = top.reduce((s, [, w]) => s + w, 0);
    const main = top[0][0];
    if (!FOOT.test(rig.bones[main].name)) continue;
    // Along the toe: out from the foot bone's pivot through the base, turned a little toward the
    // fitted claw's own tip.
    const along = base.clone().sub(rig.bones[main].pos).normalize();
    const own = tip.clone().sub(base).normalize();
    const dir = along.multiplyScalar(0.65).addScaledVector(own, 0.35).normalize();
    const length = Math.min(CLAW.maxLength, Math.max(CLAW.minLength, tip.distanceTo(base)));
    sites.push({
      base,
      dir,
      length,
      radius: Math.min(CLAW.maxRadius, Math.max(0.02, radius)),
      joints: top.map(([b]) => b),
      weights: top.map(([, w]) => w / sum),
      foot: true,
    });
  }
  return sites;
}

/** The claws at a LOD from their sites (bind pose, body space). */
export function buildClaws(sites: ClawSite[], lod: number): BuiltPiece {
  const [sides, rings] = CLAW_RES[Math.min(2, Math.max(0, lod))];
  const b = new Builder();
  const down = new Vector3(0, -1, 0);
  const c = new Vector3();
  const tan = new Vector3();
  const side = new Vector3();
  const up = new Vector3();
  const q = new Vector3();
  for (const s of sites) {
    const L = Math.max(CLAW.minLength, s.length * CLAW.length);
    // Curl toward the ground (feet) or along the wing's underside (fingers): the part of "down"
    // across the claw.
    const bend = down.clone().addScaledVector(s.dir, -down.dot(s.dir));
    if (bend.lengthSq() < 1e-6) bend.set(0, 0, 1).addScaledVector(s.dir, -s.dir.z);
    bend.normalize();
    const skin: Skin = new Map(s.joints.map((j, k) => [j, s.weights[k]]));
    // The base sits a little back inside the toe (or finger), so its opening is covered.
    const start = s.base.clone().addScaledVector(s.dir, -CLAW.sink * L);
    const span = L * (1 + CLAW.sink);
    const center = (t: number, out: Vector3) => out.copy(start).addScaledVector(s.dir, span * t).addScaledVector(bend, CLAW.curl * span * t * t);
    const ringIdx: number[][] = [];
    for (let r = 0; r <= rings; r++) {
      const t = r / (rings + 1);
      center(t, c);
      // The tangent of the curve, and a frame across it: "up" against the curl, "side" across.
      tan.copy(s.dir).addScaledVector(bend, 2 * CLAW.curl * t).normalize();
      up.copy(bend).negate().addScaledVector(tan, bend.dot(tan)).normalize();
      side.crossVectors(tan, up).normalize();
      const rad = s.radius * CLAW.base * Math.pow(1 - t, 0.85);
      const row: number[] = [];
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        // Round at the base (it covers the fitted claw's opening), pressed from the side beyond it.
        const press = 1 + (CLAW.press - 1) * smoothstep(0.15, 0.5, t);
        q.copy(c).addScaledVector(up, Math.cos(a) * rad).addScaledVector(side, Math.sin(a) * rad * press);
        const i = b.vertex(q, skin, [9, 0, 0, 0], [t, 0]);
        b.setNormal(i, new Vector3().copy(up).multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a) / press).normalize());
        row.push(i);
      }
      ringIdx.push(row);
    }
    for (let r = 0; r < rings; r++) {
      for (let k = 0; k < sides; k++) {
        const a = ringIdx[r][k];
        const bb = ringIdx[r][(k + 1) % sides];
        const cc = ringIdx[r + 1][(k + 1) % sides];
        const d = ringIdx[r + 1][k];
        b.triangle(0, a, bb, cc);
        b.triangle(0, a, cc, d);
      }
    }
    // A cap closes the base, so a claw seen end-on from behind shows no opening.
    center(0, c);
    const capI = b.vertex(c, skin, [9, 0, 0, 0], [0, 0]);
    b.setNormal(capI, s.dir.clone().negate());
    for (let k = 0; k < sides; k++) b.triangle(0, ringIdx[0][(k + 1) % sides], ringIdx[0][k], capI);
    center(1, c);
    const tipI = b.vertex(c, skin, [9, 0, 0, 0], [1, 0]);
    b.setNormal(tipI, tan);
    const last = ringIdx[rings];
    for (let k = 0; k < sides; k++) b.triangle(0, last[k], last[(k + 1) % sides], tipI);
  }
  b.windToNormals();
  return b.done('claws');
}

// ---------------------------------------------------------------------------------------------
// Eyes
// ---------------------------------------------------------------------------------------------

/** The eyeball: its radius (m), its stretch along the head and up, and how deep its center sits. */
export const EYE = { radius: 0.085, long: 1.45, tall: 0.8, sink: 0.45 };
/** Eye resolution per LOD: [around, rings]; none far off. */
export const EYE_RES: ([number, number] | null)[] = [[16, 6], [8, 3], null];

/** The left eye's frame (body space): center of the eyeball, outward axis, forward and up across it. */
export interface EyeFrame {
  center: Vector3;
  axis: Vector3;
  forward: Vector3;
  up: Vector3;
}

/**
 * The eyeball's frame from the body's eye patch (its center and outward normal; the skin's level
 * round it, when known, sets how far out it sits) and the head's pitch.
 */
export function eyeFrame(patch: { center: Vector3; axis: Vector3; skin?: number }, rig: DragonRigDef): EyeFrame {
  const pitch = rig.props.shape.headPitch;
  const fwdHead = new Vector3(0, -Math.sin(pitch), Math.cos(pitch));
  const axis = patch.axis.clone().normalize();
  const forward = fwdHead.addScaledVector(axis, -fwdHead.dot(axis)).normalize();
  const up = new Vector3().crossVectors(forward, axis).normalize();
  if (up.y < 0) up.negate();
  return { center: patch.center.clone().addScaledVector(axis, (patch.skin ?? 0) - EYE.sink * EYE.radius), axis, forward, up };
}

/** Both eyeballs at a LOD (the front half of an almond ellipsoid each), rigid on the head. */
export function buildEyes(frame: EyeFrame, rig: DragonRigDef, lod: number): BuiltPiece | null {
  const res = EYE_RES[Math.min(2, Math.max(0, lod))];
  if (!res) return null;
  const [around, rings] = res;
  const b = new Builder();
  const skin: Skin = new Map([[rig.idx.head, 1]]);
  const R = EYE.radius;
  for (let side = 0; side < 2; side++) {
    const m = (v: Vector3) => (side === 0 ? v.clone() : new Vector3(-v.x, v.y, v.z));
    const c = m(frame.center);
    const ax = m(frame.axis);
    const fw = m(frame.forward);
    const up = m(frame.up);
    const point = (theta: number, phi: number) => {
      // theta from the axis (0 at the pole) to a little past the equator; phi around.
      const st = Math.sin(theta);
      return c
        .clone()
        .addScaledVector(ax, R * Math.cos(theta))
        .addScaledVector(fw, R * EYE.long * st * Math.cos(phi))
        .addScaledVector(up, R * EYE.tall * st * Math.sin(phi));
    };
    const normalAt = (theta: number, phi: number) => {
      const st = Math.sin(theta);
      return new Vector3()
        .addScaledVector(ax, Math.cos(theta) / R)
        .addScaledVector(fw, (st * Math.cos(phi)) / (R * EYE.long))
        .addScaledVector(up, (st * Math.sin(phi)) / (R * EYE.tall))
        .normalize();
    };
    const pole = b.vertex(point(0, 0), skin, [2, 0, 0, 0], [0, 0]);
    b.setNormal(pole, normalAt(0, 0));
    const rows: number[][] = [];
    const thetaMax = Math.PI * 0.62;
    for (let r = 1; r <= rings; r++) {
      const theta = (r / rings) * thetaMax;
      const row: number[] = [];
      for (let k = 0; k < around; k++) {
        const phi = (k / around) * Math.PI * 2;
        const i = b.vertex(point(theta, phi), skin, [2, 0, 0, 0], [0, 0]);
        b.setNormal(i, normalAt(theta, phi));
        row.push(i);
      }
      rows.push(row);
    }
    for (let k = 0; k < around; k++) b.triangle(0, pole, rows[0][k], rows[0][(k + 1) % around]);
    for (let r = 0; r < rows.length - 1; r++) {
      for (let k = 0; k < around; k++) {
        const a = rows[r][k];
        const bb = rows[r][(k + 1) % around];
        const cc = rows[r + 1][(k + 1) % around];
        const d = rows[r + 1][k];
        b.triangle(0, a, d, cc);
        b.triangle(0, a, cc, bb);
      }
    }
  }
  b.windToNormals();
  return b.done('eyes');
}
