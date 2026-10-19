// The white dragon's fitted body (gate G12a): the Meshy body fitted in Blender to this module's
// skeleton by scripts/blender/dragon_meshy_fit.py. Nothing loads it at runtime yet; G12b's showcase
// will. The file is a GLB in the game's bind space (body frame, +Z forward, +Y up, metres) and in the
// layout of the Harrier trial (G3b): one vertex set and two primitives (0 = body and wing bones,
// 1 = membranes). JOINTS_0 indexes mesh.extras.jointNames, so the body binds by name to the rig's own
// skeleton; _AMAT, _AUV2 and _AEXTRA are the hide shader's aMat, aUv2 and aExtra. The extras also
// carry the provenance and the fit report.
//
// The distance models (white-dragon-lod1.glb, -lod2.glb) are the same layout, decimated from LOD0 by
// the fit script's make_lod; the parts (white-dragon-parts.glb, parts.ts) share the attributes.

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

/**
 * Triangle budgets per LOD (gate G12a), from the model budgets guide (Art and Assets/Guides/
 * model-budgets): the bare body, the parts' allowance above it, and the ceiling with the parts on.
 * LOD0 is the guide's six-limb dragon (16,000 to 20,000 bare, 2,000 to 4,000 for parts, 24,000 in
 * all). LOD1 and LOD2 keep the dragon inside the guide's medium and far ceilings for a creature with
 * all its gear (6,000 and 1,500, the wyverns' LOD1 and LOD2 ceilings in wyvern/parts/res.ts). Far
 * off only the horns remain.
 */
export const DRAGON_LOD_BUDGETS = [
  { bare: [16000, 20000], parts: [2000, 4000], equipped: 24000 },
  { bare: [4000, 5000], parts: [0, 1000], equipped: 6000 },
  { bare: [1000, 1300], parts: [0, 200], equipped: 1500 },
] as const;

interface GltfJson {
  accessors: { bufferView: number; componentType: number; count: number; type: string }[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
  meshes: { name?: string; primitives: { attributes: Record<string, number>; indices: number; material?: number }[]; extras?: Record<string, unknown> }[];
  asset?: { extras?: Record<string, unknown> };
}

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** The JSON chunk and an accessor reader for the subset of glTF the dragon's Blender scripts write
 * (one buffer, tightly packed views; float, uint16 and uint32 components). */
export function readGlb(buffer: ArrayBuffer, what: string): { json: GltfJson; read(i: number): Float32Array | Uint16Array | Uint32Array } {
  const dv = new DataView(buffer);
  if (dv.getUint32(0, true) !== 0x46546c67) throw Error(`${what}: not a GLB`);
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
    throw Error(`${what}: component type ${a.componentType}`);
  };
  return { json, read };
}

/** Parse the fitted body or one of its distance models. */
export function parseDragonBody(buffer: ArrayBuffer): DragonBodyAsset {
  const { json, read } = readGlb(buffer, 'Dragon body');
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
