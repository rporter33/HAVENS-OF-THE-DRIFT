// The white dragon's geometry per LOD (gate G12b): the fitted body (asset.ts) and the look's part
// pieces (parts.ts), bound by joint name to the rig's own skeleton (rig.ts).
//
// One skinned geometry per LOD, in two groups as the wyvern's: 0 opaque (the body, the wing bones
// and every rigid piece), 1 membrane (the wing membranes and the cheek fins' web). The whiskers are
// their own plain geometry. They hang as verlet strands (whiskers.ts) and are deformed on the CPU
// from their strand coordinates, so they cost no bones.
//
// The fitted body leaves the breath bone unweighted (the fit maps only bones with a segment;
// skeleton.ts). The rib cage's breathing comes from weights derived here from the bind positions:
// part of the trunk's spine, chest and pelvis weight moves to the breath bone over the flanks and
// belly between the shoulders and the hips. The breath bone is a leaf and rests like the spine, so
// at rest nothing moves.

import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Vector3 } from 'three';
import { smoothstep } from '../../core/math';
import type { DragonBodyAsset } from './asset';
import type { DragonPartPiece, DragonStrand } from './parts';
import type { DragonRigDef } from './rig';

export interface DragonWhiskerGeometry {
  geometry: BufferGeometry;
  /** Bind positions and normals (body space). */
  rest: Float32Array;
  restNormal: Float32Array;
  /** Per vertex (strand, along: 0 at the root .. 1 at the tip). */
  strand: Float32Array;
  strands: DragonStrand[];
  triangles: number;
}

export interface DragonLodGeometry {
  lod: number;
  /** Body and rigid pieces, skinned to the rig (skinIndex holds rig bone indices). */
  geometry: BufferGeometry;
  triangles: number;
  whiskers: DragonWhiskerGeometry | null;
  /** The left eye from the body's eye region: center, outward axis and radius for the hide shader. */
  eye: { center: Vector3; axis: Vector3; radius: number };
  /** Pieces included, by name. */
  pieces: string[];
  /** Membrane triangles turned to face the way their normals do (see orientToNormals). */
  reoriented: number;
  /** Vertices that came with no normal and were given their faces' (see repairNormals). */
  renormaled: number;
}

/** Map a file's joint names onto the rig's bone indices; every name must be a rig bone. */
export function jointRemap(rig: DragonRigDef, names: string[], what: string): Uint16Array {
  const byName = new Map(rig.bones.map((b, i) => [b.name, i]));
  return Uint16Array.from(names, (n) => {
    const i = byName.get(n);
    if (i === undefined) throw Error(`${what}: joint ${n} is not a bone of the dragon rig`);
    return i;
  });
}

/**
 * Turn every triangle whose winding disagrees with its vertices' normals (in place); returns how many.
 * The membranes are double-sided, and the hide shader tells their upper face from their underside by
 * which face the camera sees: a triangle wound against its normals shows the paler underside from
 * above. The decimated distance models have a few (LOD2's trailing edge, found in G12a: 9 of 314
 * membrane triangles, 2.8% of its area), so the membrane is put right here rather than in the file.
 */
export function orientToNormals(position: Float32Array, normal: Float32Array, index: Uint32Array): number {
  let turned = 0;
  for (let i = 0; i < index.length; i += 3) {
    const p = index[i] * 3;
    const q = index[i + 1] * 3;
    const r = index[i + 2] * 3;
    const ax = position[q] - position[p];
    const ay = position[q + 1] - position[p + 1];
    const az = position[q + 2] - position[p + 2];
    const bx = position[r] - position[p];
    const by = position[r + 1] - position[p + 1];
    const bz = position[r + 2] - position[p + 2];
    const fx = ay * bz - az * by;
    const fy = az * bx - ax * bz;
    const fz = ax * by - ay * bx;
    const nx = normal[p] + normal[q] + normal[r];
    const ny = normal[p + 1] + normal[q + 1] + normal[r + 1];
    const nz = normal[p + 2] + normal[q + 2] + normal[r + 2];
    if (fx * nx + fy * ny + fz * nz < 0) {
      const t = index[i + 1];
      index[i + 1] = index[i + 2];
      index[i + 2] = t;
      turned++;
    }
  }
  return turned;
}

/**
 * Give every vertex without a normal (zero length) the area-weighted normal of the triangles it is in;
 * returns how many. The fitted body has three at the closed wing-root cut, at every LOD, and the cheek
 * fins six: a zero normal normalizes to NaN in the shader, which the bloom spreads into a white
 * spot with a black core.
 */
export function repairNormals(position: Float32Array, normal: Float32Array, lists: ArrayLike<number>[]): number {
  const n = position.length / 3;
  const bad = new Uint8Array(n);
  let count = 0;
  for (let v = 0; v < n; v++) {
    if (!(Math.hypot(normal[v * 3], normal[v * 3 + 1], normal[v * 3 + 2]) > 1e-6)) {
      bad[v] = 1;
      normal[v * 3] = normal[v * 3 + 1] = normal[v * 3 + 2] = 0;
      count++;
    }
  }
  if (!count) return 0;
  for (const index of lists) {
    for (let i = 0; i < index.length; i += 3) {
      const a = index[i];
      const b = index[i + 1];
      const c = index[i + 2];
      if (!bad[a] && !bad[b] && !bad[c]) continue;
      const ax = position[b * 3] - position[a * 3];
      const ay = position[b * 3 + 1] - position[a * 3 + 1];
      const az = position[b * 3 + 2] - position[a * 3 + 2];
      const bx = position[c * 3] - position[a * 3];
      const by = position[c * 3 + 1] - position[a * 3 + 1];
      const bz = position[c * 3 + 2] - position[a * 3 + 2];
      const fx = ay * bz - az * by;
      const fy = az * bx - ax * bz;
      const fz = ax * by - ay * bx;
      for (const v of [a, b, c]) {
        if (!bad[v]) continue;
        normal[v * 3] += fx;
        normal[v * 3 + 1] += fy;
        normal[v * 3 + 2] += fz;
      }
    }
  }
  for (let v = 0; v < n; v++) {
    if (!bad[v]) continue;
    const l = Math.hypot(normal[v * 3], normal[v * 3 + 1], normal[v * 3 + 2]);
    // A vertex in no triangle draws nothing; any unit vector will do.
    if (l > 1e-12) for (let k = 0; k < 3; k++) normal[v * 3 + k] /= l;
    else normal[v * 3 + 1] = 1;
  }
  return count;
}

/** The breath weights' shape: how much of the trunk's weight the rib cage takes, by bind position. */
export const BREATH = {
  /** Along the torso (fraction of its length): rising from the hips, full over the ribs, gone at the shoulders. */
  z: [-0.36, -0.2, 0.12, 0.28] as const,
  /** Most of a vertex's trunk weight the breath bone takes. */
  share: 0.75,
};

const TRUNK = new Set(['spine', 'chest', 'pelvis']);

/** Move part of each rib-cage vertex's trunk weight to the breath bone (in place). Vertices with
 * all four influences in use give the breath bone their smallest trunk slot. */
export function addBreathWeights(rig: DragonRigDef, position: Float32Array, joints: Uint16Array, weights: Float32Array, count: number): number {
  const T = rig.props.shape.torsoLength;
  const breath = rig.idx.breath;
  const trunk = new Set(rig.bones.flatMap((b, i) => (TRUNK.has(b.name) ? [i] : [])));
  const [z0, z1, z2, z3] = BREATH.z;
  let moved = 0;
  for (let v = 0; v < count; v++) {
    const z = position[v * 3 + 2] / T;
    const along = smoothstep(z0, z1, z) * (1 - smoothstep(z2, z3, z));
    if (along <= 0) continue;
    let t = 0;
    let free = -1;
    let smallest = -1;
    for (let k = 0; k < 4; k++) {
      const w = weights[v * 4 + k];
      const j = joints[v * 4 + k];
      if (!(w > 0)) {
        if (free < 0) free = k;
      } else if (trunk.has(j)) {
        t += w;
        if (smallest < 0 || w < weights[v * 4 + smallest]) smallest = k;
      }
    }
    if (t <= 0) continue;
    const take = BREATH.share * along * t;
    if (take < 1e-4) continue;
    // Take it from the trunk slots in proportion; the breath bone gets a free slot or the smallest.
    for (let k = 0; k < 4; k++) if (weights[v * 4 + k] > 0 && trunk.has(joints[v * 4 + k])) weights[v * 4 + k] *= 1 - take / t;
    if (free >= 0) {
      joints[v * 4 + free] = breath;
      weights[v * 4 + free] = take;
    } else {
      // No free slot: the smallest trunk slot becomes the breath bone's, keeping what it had left.
      weights[v * 4 + smallest] += take;
      joints[v * 4 + smallest] = breath;
    }
    moved++;
  }
  return moved;
}

/** The body's left eye region (aMat.x = 2, x > 0): center, mean normal and extent. */
function eyeOf(body: DragonBodyAsset, rig: DragonRigDef): { center: Vector3; axis: Vector3; radius: number } {
  const c = new Vector3();
  const nrm = new Vector3();
  const pts: Vector3[] = [];
  const n = body.position.length / 3;
  for (let v = 0; v < n; v++) {
    if (Math.round(body.mat[v * 4]) !== 2 || body.position[v * 3] <= 0) continue;
    const p = new Vector3(body.position[v * 3], body.position[v * 3 + 1], body.position[v * 3 + 2]);
    pts.push(p);
    c.add(p);
    nrm.x += body.normal[v * 3];
    nrm.y += body.normal[v * 3 + 1];
    nrm.z += body.normal[v * 3 + 2];
  }
  if (!pts.length) return { center: rig.eye.clone(), axis: new Vector3(1, 0, 0), radius: rig.eyeRadius };
  c.multiplyScalar(1 / pts.length);
  const axis = nrm.normalize();
  let r = 0;
  for (const p of pts) r = Math.max(r, p.distanceTo(c));
  // The shader's eyeball: a sphere whose front cap is the eye patch. Its center sits behind the
  // patch along the axis, so the patch's middle reads as the pupil and its rim as the iris's edge.
  const radius = Math.max(0.05, r * 0.9);
  return { center: c.addScaledVector(axis, -0.75 * radius), axis, radius };
}

/**
 * Build one LOD: the body and the given pieces (all of the same LOD), bound to the rig by name.
 * Pieces with strand coordinates (the whiskers) go to the whisker geometry; the rest are merged into
 * the skinned geometry, opaque triangles in group 0 and membrane in group 1.
 */
export function buildDragonLod(rig: DragonRigDef, body: DragonBodyAsset, pieces: DragonPartPiece[], lod: number): DragonLodGeometry {
  const rigid = pieces.filter((p) => !p.strand);
  const strands = pieces.filter((p) => p.strand);
  const nB = body.position.length / 3;
  let n = nB;
  for (const p of rigid) n += p.position.length / 3;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const ji = new Uint16Array(n * 4);
  const jw = new Float32Array(n * 4);
  const mat = new Float32Array(n * 4);
  const uv2 = new Float32Array(n * 2);
  const ex = new Float32Array(n * 4);
  const tri: [number[], number[]] = [[], []];
  let base = 0;
  const put = (src: { position: Float32Array; normal: Float32Array; joints: Uint16Array; weights: Float32Array; mat: Float32Array; uv2: Float32Array; extra: Float32Array; index: [Uint32Array, Uint32Array]; jointNames: string[] }, what: string) => {
    const k = src.position.length / 3;
    const remap = jointRemap(rig, src.jointNames, what);
    pos.set(src.position, base * 3);
    nor.set(src.normal, base * 3);
    for (let i = 0; i < k * 4; i++) {
      const w = src.weights[i];
      ji[base * 4 + i] = w > 0 ? remap[src.joints[i]] : 0;
      jw[base * 4 + i] = w > 0 ? w : 0;
    }
    mat.set(src.mat, base * 4);
    uv2.set(src.uv2, base * 2);
    ex.set(src.extra, base * 4);
    for (let g = 0; g < 2; g++) for (const i of src.index[g]) tri[g].push(base + i);
    base += k;
  };
  put(body, `Dragon body LOD${lod}`);
  const membrane = Uint32Array.from(tri[1]);
  const reoriented = orientToNormals(pos, nor, membrane);
  tri[1] = Array.from(membrane);
  addBreathWeights(rig, pos, ji, jw, nB);
  for (const p of rigid) put(p, `Dragon part ${p.piece} LOD${lod}`);

  const renormaled = repairNormals(pos, nor, tri);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('skinIndex', new Uint16BufferAttribute(ji, 4));
  g.setAttribute('skinWeight', new Float32BufferAttribute(jw, 4));
  g.setAttribute('aMat', new Float32BufferAttribute(mat, 4));
  g.setAttribute('aUv2', new Float32BufferAttribute(uv2, 2));
  g.setAttribute('aExtra', new Float32BufferAttribute(ex, 4));
  const all = new Uint32Array(tri[0].length + tri[1].length);
  all.set(tri[0]);
  all.set(tri[1], tri[0].length);
  g.setIndex(new BufferAttribute(all, 1));
  g.addGroup(0, tri[0].length, 0);
  g.addGroup(tri[0].length, tri[1].length, 1);
  g.computeBoundingSphere();

  return {
    lod,
    geometry: g,
    triangles: all.length / 3,
    whiskers: strands.length ? whiskerGeometry(strands) : null,
    eye: eyeOf(body, rig),
    pieces: pieces.map((p) => p.piece),
    reoriented,
    renormaled,
  };
}

/** The whisker pieces as one plain geometry with their strand coordinates. */
function whiskerGeometry(pieces: DragonPartPiece[]): DragonWhiskerGeometry {
  let n = 0;
  for (const p of pieces) n += p.position.length / 3;
  const rest = new Float32Array(n * 3);
  const restNormal = new Float32Array(n * 3);
  const strand = new Float32Array(n * 2);
  const mat = new Float32Array(n * 4);
  const uv2 = new Float32Array(n * 2);
  const ex = new Float32Array(n * 4);
  const index: number[] = [];
  const strands: DragonStrand[] = [];
  let base = 0;
  for (const p of pieces) {
    const k = p.position.length / 3;
    // Strand indices are per piece; renumber them into this geometry's strand list.
    const offset = strands.length;
    strands.push(...p.strands);
    rest.set(p.position, base * 3);
    restNormal.set(p.normal, base * 3);
    for (let v = 0; v < k; v++) {
      strand[(base + v) * 2] = p.strand![v * 2] + offset;
      strand[(base + v) * 2 + 1] = p.strand![v * 2 + 1];
    }
    mat.set(p.mat, base * 4);
    uv2.set(p.uv2, base * 2);
    ex.set(p.extra, base * 4);
    for (const i of p.index[0]) index.push(base + i);
    base += k;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(rest.slice(), 3));
  g.setAttribute('normal', new Float32BufferAttribute(restNormal.slice(), 3));
  g.setAttribute('aMat', new Float32BufferAttribute(mat, 4));
  g.setAttribute('aUv2', new Float32BufferAttribute(uv2, 2));
  g.setAttribute('aExtra', new Float32BufferAttribute(ex, 4));
  g.setIndex(index);
  g.addGroup(0, index.length, 0);
  return { geometry: g, rest, restNormal, strand, strands, triangles: index.length / 3 };
}
