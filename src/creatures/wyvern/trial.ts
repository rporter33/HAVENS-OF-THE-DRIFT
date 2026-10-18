// Dev-only trial (gate G3b, Q38): the Harrier's body from the Meshy model, fitted in Blender to this
// rig by scripts/blender/harrier_meshy_fit.py. Only `?wyvernTrial=meshy` loads it; a normal build
// never fetches the file and keeps the procedural Harrier.
//
// The file is a GLB in the game's bind space (body frame, +Z forward, +Y up): one vertex set and two
// primitives (0 = body, 1 = membranes). JOINTS_0 indexes mesh.extras.jointNames; the trial binds by
// name to the rig's own skeleton, so the animator, IK, sockets and collision are the procedural
// wyvern's. _AMAT, _AUV2 and _AEXTRA are the shader's aMat, aUv2 and aExtra. The extras also carry
// how far the fit moved the saddle (seatShift) and the eyes (eye), so the rider and the eye shader
// follow the new surface.

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
export function trialInfo(rig: RigDef, base: WyvernMeshInfo, asset: WyvernTrialAsset): WyvernMeshInfo {
  const byName = new Map(rig.bones.map((b, i) => [b.name, i]));
  const remap = asset.jointNames.map((n) => {
    const i = byName.get(n);
    if (i === undefined) throw Error(`Wyvern trial: bone ${n} is not in the ${rig.props.breed} rig`);
    return i;
  });
  const joints = new Uint16Array(asset.joints.length);
  for (let i = 0; i < joints.length; i++) joints[i] = asset.weights[i] > 0 ? remap[asset.joints[i]] : 0;
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(asset.position.slice(), 3));
  g.setAttribute('normal', new Float32BufferAttribute(asset.normal.slice(), 3));
  g.setAttribute('skinIndex', new Uint16BufferAttribute(joints, 4));
  g.setAttribute('skinWeight', new Float32BufferAttribute(asset.weights.slice(), 4));
  g.setAttribute('aMat', new Float32BufferAttribute(asset.mat.slice(), 4));
  g.setAttribute('aUv2', new Float32BufferAttribute(asset.uv2.slice(), 2));
  g.setAttribute('aExtra', new Float32BufferAttribute(asset.extra.slice(), 4));
  const [i0, i1] = asset.index;
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
  const eye = asset.eye;
  const eyeCenter = eye ? eye.cNew.clone().add(base.eyeCenter.clone().sub(eye.cOld).multiplyScalar(eye.scale)) : base.eyeCenter.clone();
  const eyeRadius = eye ? base.eyeRadius * eye.scale : base.eyeRadius;
  base.geometry.dispose();
  const ao = finishGeometry(rig, g, saddle.seat);
  return {
    geometry: g,
    ao,
    lod: 0,
    triangles: all.length / 3,
    vertices: asset.position.length / 3,
    eyeCenter,
    eyeAxis: base.eyeAxis.clone(),
    eyeRadius,
    membraneArea: base.membraneArea,
    saddle,
  };
}
