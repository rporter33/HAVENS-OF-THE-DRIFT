// Assembles the whole wyvern mesh for a rig, a look and a level of detail: body, head, limbs,
// wings and every cosmetic part, into one indexed BufferGeometry with two groups (0 = body,
// 1 = membranes). Every LOD of a rig skins to the same skeleton (bone indices are the rig's).

import type { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { analyticAO, type AOJob } from './ao';
import type { WyvernLook } from '../../core/types';
import { GeoBuilder, REGION } from './builder';
import type { RigDef } from './rig';
import { buildBody } from './parts/body';
import { buildHead, type HeadInfo } from './parts/head';
import { buildLegs } from './parts/legs';
import { buildWings, type WingInfo } from './parts/wings';
import { buildFrill, buildHorns, buildPlates, buildTailTip } from './parts/cosmetics';
import { buildSaddle, type SaddleInfo } from './parts/saddle';
import { RES, type Lod } from './parts/res';

export type { Lod } from './parts/res';

export interface WyvernMeshInfo {
  geometry: BufferGeometry;
  /**
   * Ambient occlusion (A10): what the part builders wrote into aExtra.x (a strap's underside, a
   * plate's rim), the vertices the field covers (the opaque body's), and the field applied now
   * (the analytic fallback until the bake replaces it; see ao.ts and applyAO).
   */
  ao: { base: Float32Array; mask: Uint8Array; field: Float32Array };
  lod: Lod;
  triangles: number;
  vertices: number;
  eyeCenter: Vector3;
  eyeAxis: Vector3;
  eyeRadius: number;
  membraneArea: number;
  saddle: SaddleInfo;
}

interface BaseParts {
  builder: GeoBuilder;
  head: HeadInfo;
  wings: WingInfo;
}

/** The parts that only depend on the breed, built once per rig and LOD and copied for each look. */
const baseCache = new WeakMap<RigDef, (BaseParts | undefined)[]>();

function baseParts(rig: RigDef, lod: Lod): BaseParts {
  let list = baseCache.get(rig);
  if (!list) baseCache.set(rig, (list = []));
  let base = list[lod];
  if (!base) {
    const res = RES[lod];
    const builder = new GeoBuilder();
    buildBody(builder, rig, res);
    const head = buildHead(builder, rig, res);
    buildLegs(builder, rig, res);
    const wings = buildWings(builder, rig, res);
    base = list[lod] = { builder, head, wings };
  }
  return base;
}

export function buildWyvernGeometry(rig: RigDef, look: WyvernLook, lod: Lod = 0): WyvernMeshInfo {
  const res = RES[lod];
  const base = baseParts(rig, lod);
  const b = base.builder.snapshot();
  const head = base.head;
  const wings = base.wings;
  if (rig.props.shape.plates) buildPlates(b, rig, look, res);
  buildHorns(b, rig, head, look.horns, res);
  buildFrill(b, rig, head, look.frill, look.saddle, res);
  buildTailTip(b, rig, look.tail, res);
  const saddle = buildSaddle(b, rig, look.saddle, res);
  const geometry = b.build();
  const ao = finishGeometry(rig, geometry, saddle.seat);
  return {
    geometry,
    ao,
    lod,
    triangles: b.triangleCount,
    vertices: b.vertexCount,
    eyeCenter: head.eyeCenter,
    eyeAxis: head.eyeAxis,
    eyeRadius: head.eyeRadius,
    membraneArea: wings.membraneArea,
    saddle,
  };
}

/**
 * Ambient occlusion for a built geometry: the analytic fallback now, over the opaque body's
 * vertices, multiplied into aExtra.x. Shared by the procedural build and the G3b trial body.
 */
export function finishGeometry(rig: RigDef, geometry: BufferGeometry, seat: Vector3): WyvernMeshInfo['ao'] {
  const ex = geometry.getAttribute('aExtra');
  const nv = ex.count;
  const aoBase = new Float32Array(nv);
  for (let v = 0; v < nv; v++) aoBase[v] = ex.getX(v);
  // The hide, the plates and the tack take the field (not the eyes, teeth, claws or horns).
  const mask = new Uint8Array(nv);
  const idx = geometry.index!.array;
  const g0 = geometry.groups[0];
  const mat = geometry.getAttribute('aMat');
  const shaded = new Set<number>([REGION.skin, REGION.plate, REGION.leather, REGION.cloth, REGION.wood, REGION.wool]);
  for (let i = g0.start; i < g0.start + g0.count; i++) if (shaded.has(Math.round(mat.getX(idx[i])))) mask[idx[i]] = 1;
  const field = analyticAO(rig, geometry.getAttribute('position').array, geometry.getAttribute('normal').array, mask, seat, new Float32Array(nv));
  const ao = { base: aoBase, mask, field };
  writeAO(geometry, ao);
  return ao;
}

/** Write the AO field (times the builders' own values) into aExtra.x. */
function writeAO(geometry: BufferGeometry, ao: WyvernMeshInfo['ao']): void {
  const ex = geometry.getAttribute('aExtra') as BufferAttribute;
  for (let v = 0; v < ex.count; v++) ex.setX(v, ao.base[v] * ao.field[v]);
  ex.needsUpdate = true;
}

/** Replace the AO field (e.g. with the bake) on a built geometry. */
export function applyAO(info: WyvernMeshInfo, field: Float32Array): void {
  info.ao.field = field;
  writeAO(info.geometry, info.ao);
}

/** The bake's input for a built geometry: bind positions and normals, the body's triangles, the mask. */
export function aoJob(info: WyvernMeshInfo): AOJob {
  const g = info.geometry;
  const idx = g.index!.array;
  const g0 = g.groups[0];
  return {
    pos: new Float32Array(g.getAttribute('position').array),
    nrm: new Float32Array(g.getAttribute('normal').array),
    // Occluders: the shaded body's own triangles (teeth, claws and eyes hardly shade the hide).
    tris: new Uint32Array(Array.prototype.slice.call(idx, g0.start, g0.start + g0.count).filter((_v: number, i: number, a: number[]) => {
      const t = i - (i % 3);
      return info.ao.mask[a[t]] && info.ao.mask[a[t + 1]] && info.ao.mask[a[t + 2]];
    })),
    mask: info.ao.mask.slice(),
  };
}
