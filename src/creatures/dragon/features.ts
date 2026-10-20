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
/**
 * Claw shape: the share of the site's length kept and its bounds (m), the largest base radius (m),
 * the base's share of the toe end's radius and of the claw's length (a talon, slender), how far back
 * into the toe it starts, its curl and its sideways press; and at most how many a foot (render 08's
 * four toes), at least how far apart (m), how far back from the frontmost toe end one may be (m), and
 * how much each splays with its toe.
 */
export const CLAW = { length: 1, minLength: 0.16, maxLength: 0.27, maxRadius: 0.07, base: 1.1, slender: 0.34, sink: 0.24, curl: 0.34, press: 0.82, perFoot: 4, apart: 0.14, behind: 0.3, splay: 0.35 };
/** A small fragment of fitted claw this close (m) to a claw goes with it, rather than becoming hide. */
export const CLAW_FRAGMENT = 0.12;
/** Claw resolution per LOD: [sides, rings]. */
export const CLAW_RES: [number, number][] = [
  [8, 6],
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

/**
 * The holes the given dropped vertices (the fitted claws) leave in the body, as ordered loops of body
 * vertex indices round each rim. The fit duplicates a vertex wherever regions meet, so edges are
 * matched by position: an edge only one kept triangle uses, near a dropped vertex, is on a rim.
 */
export function clawHoles(body: DragonBodyAsset, dropped: Uint8Array): number[][] {
  const P = body.position;
  const key = (v: number) => `${Math.round(P[v * 3] * 2000)},${Math.round(P[v * 3 + 1] * 2000)},${Math.round(P[v * 3 + 2] * 2000)}`;
  const gone: Vector3[] = [];
  for (let v = 0; v < dropped.length; v++) if (dropped[v]) gone.push(new Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]));
  if (!gone.length) return [];
  const near = (v: number) => {
    const x = P[v * 3];
    const y = P[v * 3 + 1];
    const z = P[v * 3 + 2];
    for (const g of gone) if ((g.x - x) ** 2 + (g.y - y) ** 2 + (g.z - z) ** 2 < 0.08 * 0.08) return true;
    return false;
  };
  const count = new Map<string, number>();
  const rep = new Map<string, number>();
  const tris = body.index[0];
  for (let i = 0; i < tris.length; i += 3) {
    const t = [tris[i], tris[i + 1], tris[i + 2]];
    if (dropped[t[0]] && dropped[t[1]] && dropped[t[2]]) continue;
    for (let k = 0; k < 3; k++) {
      const a = key(t[k]);
      const b = key(t[(k + 1) % 3]);
      if (a === b) continue;
      const e = a < b ? `${a}|${b}` : `${b}|${a}`;
      count.set(e, (count.get(e) ?? 0) + 1);
      if (!rep.has(a)) rep.set(a, t[k]);
    }
  }
  const adj = new Map<string, string[]>();
  for (const [e, c] of count) {
    if (c !== 1) continue;
    const [a, b] = e.split('|');
    if (!near(rep.get(a)!) || !near(rep.get(b)!)) continue;
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  }
  const seen = new Set<string>();
  const loops: number[][] = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop: string[] = [];
    let cur = start;
    let prev = '';
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      loop.push(cur);
      const next = (adj.get(cur) ?? []).find((n) => n !== prev && !seen.has(n));
      prev = cur;
      cur = next ?? '';
    }
    if (loop.length >= 3) loops.push(loop.map((k) => rep.get(k)!));
  }
  return loops;
}

/** A hole's centre, mean radius and the flesh's skin round it (rig bone indices, top four). */
function holeShape(body: DragonBodyAsset, rig: DragonRigDef, loop: number[]): { center: Vector3; radius: number; joints: number[]; weights: number[] } {
  const byName = new Map(rig.bones.map((b, i) => [b.name, i]));
  const P = (v: number) => new Vector3(body.position[v * 3], body.position[v * 3 + 1], body.position[v * 3 + 2]);
  const center = new Vector3();
  for (const v of loop) center.add(P(v));
  center.multiplyScalar(1 / loop.length);
  let radius = 0;
  for (const v of loop) radius += P(v).distanceTo(center) / loop.length;
  const skin: Skin = new Map();
  for (const v of loop) {
    for (let k = 0; k < 4; k++) {
      const w = body.weights[v * 4 + k];
      if (!(w > 0)) continue;
      const bone = byName.get(body.jointNames[body.joints[v * 4 + k]])!;
      skin.set(bone, (skin.get(bone) ?? 0) + w);
    }
  }
  const top = [...skin.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = top.reduce((s, [, w]) => s + w, 0);
  return { center, radius, joints: top.map(([b]) => b), weights: top.map(([, w]) => w / sum) };
}

/** The fitted feet's claw clusters, each with the bone that carries it. */
function footClusters(body: DragonBodyAsset): { verts: number[]; bone: string }[] {
  const out: { verts: number[]; bone: string }[] = [];
  for (const g of clawClusters(body)) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (body.weights[g[0] * 4 + k] > body.weights[g[0] * 4 + best]) best = k;
    const bone = body.jointNames[body.joints[g[0] * 4 + best]];
    if (FOOT.test(bone)) out.push({ verts: g, bone });
  }
  return out;
}

/**
 * Which fitted foot claw clusters go (as a vertex mask): the claws, and the small fragments of claw
 * beside them, which would otherwise stand out of the toe's end as slivers of hide.
 */
export function footClawMask(body: DragonBodyAsset, near?: (p: Vector3) => boolean, min = CLAW_MIN_VERTS): Uint8Array {
  const mask = new Uint8Array(body.position.length / 3);
  const P = (v: number) => new Vector3(body.position[v * 3], body.position[v * 3 + 1], body.position[v * 3 + 2]);
  const clusters = footClusters(body);
  const centroid = (g: number[]) => g.reduce((c, v) => c.add(P(v)), new Vector3()).multiplyScalar(1 / g.length);
  const big = clusters.filter((c) => c.verts.length >= min && (!near || near(centroid(c.verts))));
  for (const c of big) for (const v of c.verts) mask[v] = 1;
  for (const c of clusters) {
    if (big.includes(c)) continue;
    const m = centroid(c.verts);
    if (big.some((b) => b.verts.some((v) => P(v).distanceTo(m) < CLAW_FRAGMENT))) for (const v of c.verts) mask[v] = 1;
  }
  return mask;
}

/**
 * The claw sites of the fitted body (LOD0): one at each toe's end where a fitted claw was, at the
 * centre of the hole it leaves, its skin the flesh's round the rim, pointing out along the toe and
 * toward the fitted claw's own tip, its length that claw's. At most four a foot, as render 08's: the
 * frontmost toe ends, a toe's width apart.
 */
export function clawSites(body: DragonBodyAsset, rig: DragonRigDef): ClawSite[] {
  const P = (v: number) => new Vector3(body.position[v * 3], body.position[v * 3 + 1], body.position[v * 3 + 2]);
  const mask = footClawMask(body);
  const owner = new Map<number, number[]>();
  for (const c of footClusters(body)) for (const v of c.verts) if (mask[v]) owner.set(v, c.verts);
  const candidates: (ClawSite & { foot: true; key: string; reach: number })[] = [];
  for (const loop of clawHoles(body, mask)) {
    const h = holeShape(body, rig, loop);
    const bone = rig.bones[h.joints[0]].name;
    if (!FOOT.test(bone)) continue;
    // The fitted claw this hole belonged to: the one with the dropped vertex nearest its centre.
    let nearest = -1;
    for (const v of owner.keys()) if (nearest < 0 || P(v).distanceTo(h.center) < P(nearest).distanceTo(h.center)) nearest = v;
    if (nearest < 0) continue;
    let tip = h.center.clone();
    for (const v of owner.get(nearest)!) if (P(v).distanceTo(h.center) > tip.distanceTo(h.center)) tip = P(v);
    const side = bone.endsWith('L') ? 'L' : 'R';
    const fore = /^fore/.test(bone);
    const a = rig.bones.find((b) => b.name === (fore ? `forepaw${side}` : `meta${side}`))!.pos;
    const toes = rig.bones.findIndex((x) => x.name === (fore ? `foretoes${side}` : `toes${side}`));
    const b = rig.bones[toes].pos;
    const forward = b.clone().sub(a).normalize();
    // Out along the toe: the toes point forward in the bind pose; each claw splays a little with its
    // toe (its sideways offset from the foot), then curls down (buildClaws).
    const splay = h.center.clone().sub(a);
    splay.y = 0;
    splay.z = Math.max(0, splay.z);
    const dir = new Vector3(0, 0, 1).addScaledVector(splay.normalize(), CLAW.splay).normalize();
    candidates.push({
      base: h.center,
      dir,
      length: Math.min(CLAW.maxLength, Math.max(CLAW.minLength, tip.distanceTo(h.center))),
      radius: Math.min(CLAW.maxRadius, Math.max(0.018, h.radius)),
      // On the toe bone, so the claw follows the toes (the rim's own skin can lean on the foot's
      // long bone, which the resting pose turns from upright to flat).
      joints: [toes],
      weights: [1],
      foot: true,
      key: `${fore ? 'fore' : 'hind'}${side}`,
      reach: h.center.clone().sub(a).dot(forward),
    });
  }
  const sites: ClawSite[] = [];
  for (const key of new Set(candidates.map((c) => c.key))) {
    const kept: ClawSite[] = [];
    const front = candidates.filter((x) => x.key === key).sort((x, y) => y.reach - x.reach);
    for (const c of front) {
      if (kept.length >= CLAW.perFoot) break;
      // Only the toes' ends: holes well back from the frontmost (on the side of the paw) are capped only.
      if (c.reach < front[0].reach - CLAW.behind) continue;
      if (kept.some((k) => k.base.distanceTo(c.base) < CLAW.apart)) continue;
      kept.push({ base: c.base, dir: c.dir, length: c.length, radius: c.radius, joints: c.joints, weights: c.weights, foot: true });
    }
    sites.push(...kept);
  }
  return sites;
}

/** Caps over the holes (fans from each rim to its centre, facing out), in the hide, as a piece. */
export function buildToeCaps(body: DragonBodyAsset, rig: DragonRigDef, loops: number[][]): BuiltPiece {
  const b = new Builder();
  const P = (v: number) => new Vector3(body.position[v * 3], body.position[v * 3 + 1], body.position[v * 3 + 2]);
  const byName = new Map(rig.bones.map((bn, i) => [bn.name, i]));
  for (const loop of loops) {
    const h = holeShape(body, rig, loop);
    const out = h.center.clone().sub(rig.bones[h.joints[0]].pos).normalize();
    const centre = b.vertex(h.center, new Map(h.joints.map((j, k) => [j, h.weights[k]])), [0, 0, 0, 0], [0, 0]);
    b.setNormal(centre, out);
    const rim = loop.map((v) => {
      const skin: Skin = new Map();
      for (let k = 0; k < 4; k++) {
        const w = body.weights[v * 4 + k];
        if (w > 0) skin.set(byName.get(body.jointNames[body.joints[v * 4 + k]])!, w);
      }
      const i = b.vertex(P(v), skin, [0, 0, 0, 0], [body.uv2[v * 2], body.uv2[v * 2 + 1]]);
      b.setNormal(i, out);
      return i;
    });
    for (let k = 0; k < rim.length; k++) b.triangle(0, centre, rim[k], rim[(k + 1) % rim.length]);
  }
  b.windToNormals();
  return b.done('toeCaps');
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
      const rad = Math.min(s.radius * CLAW.base, CLAW.slender * L) * Math.pow(1 - t, 0.9);
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

/**
 * The eyeball: its radius (m); its stretch along the head, up, and out along its axis (flattened, so
 * it bulges little: Robert, 2026-10-19, "bulging a little less"); and how deep its center sits below
 * the skin, in radii. The opening's rim is where the skin cuts it (sink / depth sets its size); the
 * eye stands (depth − sink) radii proud of the skin.
 */
export const EYE = { radius: 0.085, long: 1.45, tall: 0.8, depth: 0.5, sink: 0.22 };
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
        .addScaledVector(ax, R * EYE.depth * Math.cos(theta))
        .addScaledVector(fw, R * EYE.long * st * Math.cos(phi))
        .addScaledVector(up, R * EYE.tall * st * Math.sin(phi));
    };
    const normalAt = (theta: number, phi: number) => {
      const st = Math.sin(theta);
      return new Vector3()
        .addScaledVector(ax, Math.cos(theta) / (R * EYE.depth))
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
