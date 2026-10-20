// The white elder's parts as geometry (gate G12a): white-dragon-parts.glb, built in Blender by
// scripts/blender/dragon_parts.py on the fitted body and skinned to named bones of this module's
// skeleton. Nothing loads it at runtime yet; G12b's showcase will.
//
// One mesh per piece and LOD, in the body GLB's bind space and attributes (asset.ts). A catalog
// option may have several pieces (the fin crest is the cheek fins and the spines) or none (the plate
// pattern is shading only). No piece adds a bone: the horns and whiskers ride the head, the cheek
// fins the cheek-fin bones, the spines and tail fin the neck and tail as the hide does. The whiskers
// also carry strand coordinates (_ASTRAND: strand, 0 at the root .. 1 at the tip) and their rest
// nodes, so G12b can hang them as verlet strands like the tail.

import { readGlb } from './asset';
import type { DragonPartSlot } from './look';

export type Vec3 = [number, number, number];

export interface DragonStrand {
  name: string;
  /** The bone the root rides. */
  bone: string;
  /** Rest length (m). */
  length: number;
  /** Rest nodes in body space, root first. */
  nodes: Vec3[];
}

export interface DragonPartPiece {
  slot: DragonPartSlot;
  /** The catalog option (catalog.ts) the piece belongs to. */
  option: string;
  piece: string;
  lod: number;
  position: Float32Array;
  normal: Float32Array;
  joints: Uint16Array;
  weights: Float32Array;
  mat: Float32Array;
  uv2: Float32Array;
  extra: Float32Array;
  /** Per vertex (strand, along) on the whiskers; null on the other pieces. */
  strand: Float32Array | null;
  /** Triangle lists: [opaque, membrane]; either may be empty. */
  index: [Uint32Array, Uint32Array];
  jointNames: string[];
  strands: DragonStrand[];
}

export interface DragonPartsAsset {
  pieces: DragonPartPiece[];
  provenance: Record<string, unknown>;
}

/** Parse the parts GLB. */
export function parseDragonParts(buffer: ArrayBuffer): DragonPartsAsset {
  const { json, read } = readGlb(buffer, 'Dragon parts');
  const pieces = json.meshes.map((mesh): DragonPartPiece => {
    const ex = (mesh.extras ?? {}) as {
      part?: { slot: DragonPartSlot; option: string; piece: string; lod: number };
      jointNames?: string[];
      strands?: DragonStrand[];
    };
    if (!ex.part || !ex.jointNames) throw Error(`Dragon parts: ${mesh.name} has no part or jointNames`);
    const at = mesh.primitives[0].attributes;
    const index: [Uint32Array, Uint32Array] = [new Uint32Array(0), new Uint32Array(0)];
    for (const p of mesh.primitives) index[p.material === 1 ? 1 : 0] = read(p.indices) as Uint32Array;
    return {
      ...ex.part,
      position: read(at.POSITION) as Float32Array,
      normal: read(at.NORMAL) as Float32Array,
      joints: read(at.JOINTS_0) as Uint16Array,
      weights: read(at.WEIGHTS_0) as Float32Array,
      mat: read(at._AMAT) as Float32Array,
      uv2: read(at._AUV2) as Float32Array,
      extra: read(at._AEXTRA) as Float32Array,
      strand: at._ASTRAND === undefined ? null : (read(at._ASTRAND) as Float32Array),
      index,
      jointNames: ex.jointNames,
      strands: ex.strands ?? [],
    };
  });
  return { pieces, provenance: (json.asset?.extras?.provenance as Record<string, unknown>) ?? {} };
}

/** Triangles in a piece (both groups). */
export function pieceTriangles(p: DragonPartPiece): number {
  return (p.index[0].length + p.index[1].length) / 3;
}
