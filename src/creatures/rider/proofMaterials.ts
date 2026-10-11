// C02/M01 development proof only. Shared procedural atlases; no network assets or PBR change.
import { DataTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import type { QualityLevel } from '../../core/types';

export type ProofSurface = 'neutral' | 'linen' | 'scale' | 'leather' | 'bronze';
export type ProofMaps = 'color' | 'normal' | 'off';
export const PROOF_ATLAS_SIZE = 1024;
export type ProofAtlasSize = 1024 | 2048 | 3072 | 4096;
/** Low keeps the integrated-graphics fallback. No extra draw calls or texture per dye. */
export function proofTextureSize(level?: QualityLevel, highSize: 3072 | 4096 = 3072, maxTextureSize = Infinity): ProofAtlasSize {
  const requested = !level || level === 'low' ? 1024 : level === 'medium' ? 2048 : level === 'ultra' ? 4096 : highSize;
  return ([4096, 3072, 2048, 1024] as const).find(size => size <= requested && size <= maxTextureSize) ?? 1024;
}
// Four reusable 480px tiles with 16px borders; neutral surfaces sample the white center margin.
const TILE: Record<ProofSurface, [number, number]> = {
  neutral: [0.5, 0.5], linen: [0, 0], scale: [0.5, 0], leather: [0, 0.5], bronze: [0.5, 0.5],
};
export function proofUV(surface: ProofSurface, u: number, v: number): [number, number] {
  if (surface === 'neutral') return [0.5, 0.5];
  const [x, y] = TILE[surface];
  return [x + (16 + u * 480) / 1024, y + (16 + v * 480) / 1024];
}

function height(surface: ProofSurface, u: number, v: number): number {
  const tau = Math.PI * 2;
  if (surface === 'linen') {
    const warp = Math.cos(u * tau * 96), weft = Math.cos(v * tau * 96);
    return .32 * warp + .28 * weft + .18 * warp * weft + .08 * Math.sin((u + v) * tau * 9);
  }
  if (surface === 'scale') return .12 * Math.sin(u * tau * 31 + Math.sin(v * tau * 13)) * Math.sin(v * tau * 27)
    + .22 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
  if (surface === 'leather') return .24 * Math.sin(u * tau * 57 + Math.sin(v * tau * 31) * 1.4)
    * Math.cos(v * tau * 53 + Math.sin(u * tau * 19)) + .13 * Math.cos((u - v) * tau * 9);
  return .12 * Math.sin(u * tau * 41) * Math.sin(v * tau * 37) + .08 * Math.cos((u + v) * tau * 5);
}

/** M01 studies are lit illustrations, not UV maps. These dye-neutral tiles reproduce their
 * weave, grain, quiet wear and patina without baking the illustration's directional lighting. */
function albedo(surface: ProofSurface, u: number, v: number, h: number): number {
  const tau = Math.PI * 2;
  const mottle = Math.sin(u * tau * 3 + Math.sin(v * tau * 2)) * Math.cos(v * tau * 4 + u * 3);
  const edge = Math.exp(-Math.min(u, 1 - u, v, 1 - v) * 48);
  if (surface === 'linen') {
    const hem = v > .965 ? .5 + .5 * Math.cos(u * tau * 64) : 0;
    return 238 + 14 * h + 4 * mottle - 10 * hem;
  }
  if (surface === 'scale') return 232 + 11 * h + 8 * mottle - 13 * v ** 5 + 9 * edge;
  if (surface === 'leather') return 224 + 27 * h + 13 * mottle + 14 * edge;
  return 236 + 9 * h + 10 * mottle - 17 * Math.max(0, -mottle) ** 3;
}

interface ProofAtlas { color: DataTexture; readonly normal: DataTexture }
const atlases = new Map<ProofAtlasSize, ProofAtlas>();
function texture(data: Uint8Array, size: ProofAtlasSize, normal: boolean): DataTexture {
  const t = new DataTexture(data, size, size);
  if (!normal) t.colorSpace = SRGBColorSpace;
  t.generateMipmaps = true; t.minFilter = LinearMipmapLinearFilter;
  // Better oblique fabric/scale sampling at the dedicated-GPU tiers. Three clamps this
  // requested value to the driver's supported anisotropy without extra texture copies.
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = size === 1024 ? 2 : size === 2048 ? 4 : size === 3072 ? 8 : 16;
  t.needsUpdate = true;
  t.name = `C02 M01 ${size / 1024}K ${normal ? 'optional tangent normal' : 'dye-neutral material'} atlas`;
  return t;
}
function pixels(size: ProofAtlasSize, normal: boolean): Uint8Array {
  const data = new Uint8Array(size * size * 4), half = size / 2, pad = size / 64, tile = half - pad * 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const surface: ProofSurface = y < half ? x < half ? 'linen' : 'scale' : x < half ? 'leather' : 'bronze';
    // Extend the edge into tile padding. No baked light, hue or directional shadow in base color.
    const u = Math.min(1, Math.max(0, ((x % half) - pad) / tile));
    const v = Math.min(1, Math.max(0, ((y % half) - pad) / tile));
    if (normal) {
      // Fixed UV-space relief: resolution changes sampling, not the apparent bump strength.
      const nx = -(height(surface, u + 1 / 480, v) - height(surface, u - 1 / 480, v)) * .55;
      const ny = -(height(surface, u, v + 1 / 480) - height(surface, u, v - 1 / 480)) * .55;
      const z = 1 / Math.sqrt(1 + nx * nx + ny * ny);
      data[i] = Math.round((nx * z * .5 + .5) * 255);
      data[i + 1] = Math.round((ny * z * .5 + .5) * 255);
      data[i + 2] = Math.round((z * .5 + .5) * 255);
    } else {
      const tone = Math.max(0, Math.min(255, Math.round(albedo(surface, u, v, height(surface, u, v)))));
      data[i] = data[i + 1] = data[i + 2] = tone;
    }
    data[i + 3] = 255;
    // Neutral cross through the center: old parts, skin and hair have exactly neutral response.
    if (Math.abs(x - half) <= size / 128 || Math.abs(y - half) <= size / 128) {
      data[i] = data[i + 1] = normal ? 128 : 255; data[i + 2] = 255;
    }
  }
  return data;
}
export function proofAtlas(size: ProofAtlasSize = PROOF_ATLAS_SIZE): ProofAtlas {
  const cached = atlases.get(size);
  if (cached) return cached;
  let normal: DataTexture | undefined;
  const atlas = { color: texture(pixels(size, false), size, false),
    // Color-only previews do not allocate/generate/upload a normal atlas.
    get normal() { return normal ??= texture(pixels(size, true), size, true); } };
  atlases.set(size, atlas);
  return atlas;
}
