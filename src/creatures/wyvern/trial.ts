// Dev-only trial (gate G3b, Q38): the Harrier's body from the Meshy model, fitted in Blender to this
// rig by scripts/blender/harrier_meshy_fit.py. Only `?wyvernTrial=meshy` loads it; a normal build
// never fetches the file and keeps the procedural Harrier.
//
// The file is a GLB in the game's bind space (body frame, +Z forward, +Y up): one vertex set and two
// primitives (0 = body, 1 = membranes). JOINTS_0 indexes mesh.extras.jointNames; the trial binds by
// name to the rig's own skeleton, so the animator, IK, sockets and collision are the procedural
// wyvern's. _AMAT, _AUV2 and _AEXTRA are the shader's aMat, aUv2 and aExtra. The extras also carry
// how far the fit moved the saddle (seatShift), so the rider follows the new surface.
//
// The head is the game's own (Robert, 2026-10-18): the file carries no skull, and the procedural
// build's head (skull, jaw, eyes, teeth, tongue, horns, cheek fans: everything riding the head's
// bones) is merged in, so the wyvernHead and horn cosmetics and the glowing eyes work on the trial.
// So are the wing membranes and finger spars (G3c, Q40): the file's copies were fitted against the
// rig of the day, and the game's wings now run deeper (proportions.ts WING_DEPTH); taking them
// from the build keeps the trial's wings the game's, whatever their cut.

import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Vector3 } from 'three';
import type { BreedId } from '../../core/types';
import type { RigDef } from './rig';
import { finishGeometry, type WyvernMeshInfo } from './geometry';

export type WyvernTrialSelection = 'meshy';

export interface WyvernTrialAsset {
  breed: BreedId;
  position: Float32Array;
  normal: Float32Array;
  joints: Uint16Array;
  weights: Float32Array;
  mat: Float32Array;
  uv2: Float32Array;
  extra: Float32Array;
  index: [Uint32Array, Uint32Array];
  jointNames: string[];
  seatShift: Vector3;
  eye: { scale: number; cOld: Vector3; cNew: Vector3 } | null;
  provenance: Record<string, unknown>;
}

interface GltfJson {
  accessors: { bufferView: number; componentType: number; count: number; type: string }[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
  meshes: { primitives: { attributes: Record<string, number>; indices: number }[]; extras?: Record<string, unknown> }[];
}

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** Parse the trial GLB (our own writer's subset of glTF: one buffer, tightly packed views). */
export function parseWyvernTrial(buffer: ArrayBuffer, breed: BreedId = 'harrier'): WyvernTrialAsset {
  const dv = new DataView(buffer);
  if (dv.getUint32(0, true) !== 0x46546c67) throw Error('Wyvern trial: not a GLB');
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLen))) as GltfJson;
  const binStart = 20 + jsonLen + 8;
  const read = (i: number) => {
    const a = json.accessors[i];
    const v = json.bufferViews[a.bufferView];
    const n = a.count * COMPONENTS[a.type];
    const off = binStart + (v.byteOffset ?? 0);
    const bytes = buffer.slice(off, off + v.byteLength);
    if (a.componentType === 5126) return new Float32Array(bytes, 0, n);
    if (a.componentType === 5123) return new Uint16Array(bytes, 0, n);
    if (a.componentType === 5125) return new Uint32Array(bytes, 0, n);
    throw Error(`Wyvern trial: component type ${a.componentType}`);
  };
  const mesh = json.meshes[0];
  const [p0, p1] = mesh.primitives;
  const at = p0.attributes;
  const ex = (mesh.extras ?? {}) as {
    jointNames?: string[];
    seatShift?: number[];
    eye?: { scale: number; cOld: number[] | null; cNew: number[] | null };
    provenance?: Record<string, unknown>;
  };
  if (!ex.jointNames) throw Error('Wyvern trial: no jointNames');
  const v3 = (a?: number[] | null) => (a ? new Vector3(a[0], a[1], a[2]) : new Vector3());
  return {
    breed,
    position: read(at.POSITION) as Float32Array,
    normal: read(at.NORMAL) as Float32Array,
    joints: read(at.JOINTS_0) as Uint16Array,
    weights: read(at.WEIGHTS_0) as Float32Array,
    mat: read(at._AMAT) as Float32Array,
    uv2: read(at._AUV2) as Float32Array,
    extra: read(at._AEXTRA) as Float32Array,
    index: [read(p0.indices) as Uint32Array, read(p1.indices) as Uint32Array],
    jointNames: ex.jointNames,
    seatShift: v3(ex.seatShift),
    eye: ex.eye?.cOld && ex.eye.cNew ? { scale: ex.eye.scale, cOld: v3(ex.eye.cOld), cNew: v3(ex.eye.cNew) } : null,
    provenance: ex.provenance ?? {},
  };
}

export async function loadWyvernTrial(selection: WyvernTrialSelection): Promise<WyvernTrialAsset> {
  if (selection !== 'meshy') throw Error(`Wyvern trial: unknown selection ${selection}`);
  const url = new URL('../../assets/wyvern-trial/harrier-meshy.glb', import.meta.url);
  const res = await fetch(url.href);
  if (!res.ok) throw Error(`Wyvern trial: ${res.status} for ${url.href}`);
  return parseWyvernTrial(await res.arrayBuffer());
}

/**
 * The procedural build's info with the trial body in place of its geometry: same rig, skeleton,
 * sockets and saddle hardware, the seat and holds moved by the fit's seat shift, the eye moved and
 * scaled with the eyeballs. The procedural geometry is disposed.
 */
/** Bones whose vertices make up the head the procedural build supplies to the trial. */
const HEAD_BONES = ['head', 'jaw', 'gular', 'tongue0', 'tongue1', 'fanL', 'fanR'];

export function trialInfo(rig: RigDef, base: WyvernMeshInfo, asset: WyvernTrialAsset): WyvernMeshInfo {
  const byName = new Map(rig.bones.map((b, i) => [b.name, i]));
  const remap = asset.jointNames.map((n) => {
    const i = byName.get(n);
    if (i === undefined) throw Error(`Wyvern trial: bone ${n} is not in the ${rig.props.breed} rig`);
    return i;
  });
  const joints = new Uint16Array(asset.joints.length);
  for (let i = 0; i < joints.length; i++) joints[i] = asset.weights[i] > 0 ? remap[asset.joints[i]] : 0;
  // From the procedural build: the head (body-group triangles whose every vertex rides mostly on a
  // head bone), the finger spars (likewise on a finger bone) and every membrane triangle. The
  // file's own finger spars and membranes are left out.
  const fingerBones = new Set(rig.idx.wings.flatMap((w) => w.fingers.flat()));
  const head = basePart(base, boneSet(rig, HEAD_BONES), fingerBones);
  const nT = asset.position.length / 3;
  const nH = head.verts.length;
  const cat = (a: ArrayLike<number>, attr: string, k: number, Ctor: Float32ArrayConstructor | Uint16ArrayConstructor) => {
    const src = base.geometry.getAttribute(attr).array;
    const out = new Ctor((nT + nH) * k);
    out.set(a as ArrayLike<number>);
    for (let i = 0; i < nH; i++) for (let c = 0; c < k; c++) out[(nT + i) * k + c] = src[head.verts[i] * k + c];
    return out;
  };
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(cat(asset.position, 'position', 3, Float32Array), 3));
  g.setAttribute('normal', new Float32BufferAttribute(cat(asset.normal, 'normal', 3, Float32Array), 3));
  g.setAttribute('skinIndex', new Uint16BufferAttribute(cat(joints, 'skinIndex', 4, Uint16Array), 4));
  g.setAttribute('skinWeight', new Float32BufferAttribute(cat(asset.weights, 'skinWeight', 4, Float32Array), 4));
  g.setAttribute('aMat', new Float32BufferAttribute(cat(asset.mat, 'aMat', 4, Float32Array), 4));
  g.setAttribute('aUv2', new Float32BufferAttribute(cat(asset.uv2, 'aUv2', 2, Float32Array), 2));
  // aExtra.x carries the procedural build's AO by now: its own base value is restored below.
  g.setAttribute('aExtra', new Float32BufferAttribute(cat(asset.extra, 'aExtra', 4, Float32Array), 4));
  const exH = g.getAttribute('aExtra');
  for (let i = 0; i < nH; i++) exH.setX(nT + i, base.ao.base[head.verts[i]]);
  // The file's body without its finger spars.
  const t0 = withoutBones(asset.index[0], asset.joints, asset.weights, new Set(asset.jointNames.flatMap((n, i) => (fingerBones.has(byName.get(n) ?? -1) ? [i] : []))));
  const i0 = new Uint32Array(t0.length + head.tris.length);
  i0.set(t0);
  for (let i = 0; i < head.tris.length; i++) i0[t0.length + i] = nT + head.tris[i];
  const i1 = Uint32Array.from(head.membrane, (v) => nT + v);
  const all = new Uint32Array(i0.length + i1.length);
  all.set(i0);
  all.set(i1, i0.length);
  g.setIndex(new BufferAttribute(all, 1));
  g.addGroup(0, i0.length, 0);
  g.addGroup(i0.length, i1.length, 1);
  g.computeBoundingSphere();

  const shift = asset.seatShift;
  const s = base.saddle;
  const holds = Object.fromEntries(
    Object.entries(s.holds).map(([k, h]) => [k, { pos: h.pos.clone().add(shift), bone: h.bone }]),
  ) as typeof s.holds;
  // Vertex-index fit data belong to the procedural mesh; the trial has none.
  const saddle = { ...s, seat: s.seat.clone().add(shift), holds, straps: [], tackRange: [0, 0] as [number, number], fitRanges: { flaps: [], irons: [] } };
  // The game's own eyes (an older trial file that fitted the eyes into a Meshy skull carries eye).
  const eye = nH > 0 ? null : asset.eye;
  const eyeCenter = eye ? eye.cNew.clone().add(base.eyeCenter.clone().sub(eye.cOld).multiplyScalar(eye.scale)) : base.eyeCenter.clone();
  const eyeRadius = eye ? base.eyeRadius * eye.scale : base.eyeRadius;
  base.geometry.dispose();
  const ao = finishGeometry(rig, g, saddle.seat);
  return {
    geometry: g,
    ao,
    lod: 0,
    triangles: all.length / 3,
    vertices: nT + nH,
    eyeCenter,
    eyeAxis: base.eyeAxis.clone(),
    eyeRadius,
    membraneArea: base.membraneArea,
    saddle,
  };
}

function boneSet(rig: RigDef, names: string[]): Set<number> {
  return new Set(names.map((n) => rig.bones.findIndex((b) => b.name === n)).filter((i) => i >= 0));
}

/** True when most of vertex v's skin weight (of `k` influences per vertex) is on `bones`. */
function mostlyOn(v: number, idx: ArrayLike<number>, w: ArrayLike<number>, bones: Set<number>): boolean {
  let s = 0;
  for (let k = 0; k < 4; k++) if (bones.has(idx[v * 4 + k])) s += w[v * 4 + k];
  return s > 0.5;
}

/** A triangle list without the triangles whose every vertex rides mostly on `bones`. */
function withoutBones(tris: Uint32Array, joints: ArrayLike<number>, weights: ArrayLike<number>, bones: Set<number>): Uint32Array {
  const out: number[] = [];
  for (let i = 0; i < tris.length; i += 3) {
    const a = tris[i], b = tris[i + 1], c = tris[i + 2];
    if (mostlyOn(a, joints, weights, bones) && mostlyOn(b, joints, weights, bones) && mostlyOn(c, joints, weights, bones)) continue;
    out.push(a, b, c);
  }
  return Uint32Array.from(out);
}

/**
 * Parts of a built geometry for the trial: its vertices (indices into it), the body-group
 * triangles riding mostly on the head bones or the finger bones (re-indexed onto that list), and
 * all of its membrane triangles (likewise).
 */
function basePart(base: WyvernMeshInfo, heads: Set<number>, fingers: Set<number>): { verts: number[]; tris: number[]; membrane: number[] } {
  const g = base.geometry;
  const si = g.getAttribute('skinIndex').array;
  const sw = g.getAttribute('skinWeight').array;
  const n = g.getAttribute('position').count;
  const idx = g.index!.array;
  const map = new Int32Array(n).fill(-1);
  const verts: number[] = [];
  const take = (v: number) => {
    if (map[v] < 0) {
      map[v] = verts.length;
      verts.push(v);
    }
    return map[v];
  };
  const tris: number[] = [];
  const [g0, g1] = g.groups;
  for (let i = g0.start; i < g0.start + g0.count; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    const on = (bones: Set<number>) => mostlyOn(a, si, sw, bones) && mostlyOn(b, si, sw, bones) && mostlyOn(c, si, sw, bones);
    if (!on(heads) && !on(fingers)) continue;
    tris.push(take(a), take(b), take(c));
  }
  const membrane: number[] = [];
  for (let i = g1.start; i < g1.start + g1.count; i++) membrane.push(take(idx[i]));
  return { verts, tris, membrane };
}
