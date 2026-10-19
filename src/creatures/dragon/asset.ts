// The white dragon's fitted body (gate G12a): the Meshy body fitted in Blender to this module's
// skeleton by scripts/blender/dragon_meshy_fit.py. Nothing loads it at runtime yet; G12b's showcase
// will. The file is a GLB in the game's bind space (body frame, +Z forward, +Y up, metres) and in the
// layout of the Harrier trial (G3b): one vertex set and two primitives (0 = body and wing bones,
// 1 = membranes). JOINTS_0 indexes mesh.extras.jointNames, so the body binds by name to the rig's own
// skeleton; _AMAT, _AUV2 and _AEXTRA are the hide shader's aMat, aUv2 and aExtra. The extras also
// carry the provenance and the fit report.

export interface DragonBodyAsset {
  position: Float32Array;
  normal: Float32Array;
  joints: Uint16Array;
  weights: Float32Array;
  mat: Float32Array;
  uv2: Float32Array;
  extra: Float32Array;
  /** Triangle lists: [body and wing bones, membranes]. */
  index: [Uint32Array, Uint32Array];
  jointNames: string[];
  provenance: Record<string, unknown>;
  fit: Record<string, unknown>;
}

interface GltfJson {
  accessors: { bufferView: number; componentType: number; count: number; type: string }[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
  meshes: { primitives: { attributes: Record<string, number>; indices: number }[]; extras?: Record<string, unknown> }[];
}

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** Parse the fitted body (the fit script's subset of glTF: one buffer, tightly packed views). */
export function parseDragonBody(buffer: ArrayBuffer): DragonBodyAsset {
  const dv = new DataView(buffer);
  if (dv.getUint32(0, true) !== 0x46546c67) throw Error('Dragon body: not a GLB');
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
    throw Error(`Dragon body: component type ${a.componentType}`);
  };
  const mesh = json.meshes[0];
  const [p0, p1] = mesh.primitives;
  const at = p0.attributes;
  const ex = (mesh.extras ?? {}) as { jointNames?: string[]; provenance?: Record<string, unknown>; fit?: Record<string, unknown> };
  if (!ex.jointNames) throw Error('Dragon body: no jointNames');
  return {
    position: read(at.POSITION) as Float32Array,
    normal: read(at.NORMAL) as Float32Array,
    joints: read(at.JOINTS_0) as Uint16Array,
    weights: read(at.WEIGHTS_0) as Float32Array,
    mat: read(at._AMAT) as Float32Array,
    uv2: read(at._AUV2) as Float32Array,
    extra: read(at._AEXTRA) as Float32Array,
    index: [read(p0.indices) as Uint32Array, read(p1.indices) as Uint32Array],
    jointNames: ex.jointNames,
    provenance: ex.provenance ?? {},
    fit: ex.fit ?? {},
  };
}
