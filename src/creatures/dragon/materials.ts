// The dragon's materials (gate G12b): the wyvern hide shader (wyvern/materials.ts) and its regions,
// painted with a flight's palette (look.ts). The wyvern module is imported, not edited. Two small
// patches go into the dragon's own programs, after the wyvern's, by exact text (they throw if the
// text moves, like the creature light's own patch):
//   - plates: the wyvern's back is countershaded, darkened 0.47 of the way toward the secondary
//     colour by the dorsal channel. The fit bakes the white flight's powder-blue plates into that
//     channel (scripts/blender/dragon_meshy_fit.py), so the dragon mixes most of the way: the plates
//     read in the flight's accent, as render 08 has them.
//   - claws: the wyvern's are a fixed dark keratin; the dragon's take the palette's slate.
//
// Palette to uniforms: hide → primary, plates → secondary, belly, membrane and eyes as named, and
// horns → the horn region (horns, spines, fin rays and the tail fin). The hide's and belly's
// luminance caps are the wyvern's (bloom safety); a palette change is a uniform update.

import { Color, type MeshToonMaterial, type WebGLProgramParametersWithUniforms } from 'three';
import {
  BELLY_MAX_LUMINANCE,
  SCALES_MAX_LUMINANCE,
  capLuminance,
  createBodyMaterial,
  createMembraneMaterial,
  type WyvernUniforms,
} from '../wyvern/materials';
import type { DragonPalette } from './look';

/** How far the dorsal channel (the baked plate mask) mixes the hide toward the plates' colour. */
export const PLATE_MIX = 0.9;

/** The dragon's own uniforms, beside the wyvern's. */
export interface DragonShadeUniforms {
  uDwPlateMix: { value: number };
  uDwClaws: { value: Color };
}

export function createDragonShadeUniforms(): DragonShadeUniforms {
  return { uDwPlateMix: { value: PLATE_MIX }, uDwClaws: { value: new Color() } };
}

export const PLATE_LINE = 'vec3 col = mix(uPrimary, uSecondary, dorsal * 0.47);';
export const CLAW_LINE = 'return mix(vec3(0.22, 0.185, 0.14), vec3(0.09, 0.077, 0.068), smoothstep(0.3, 0.95, vUv2.x));';

function swap(src: string, from: string, to: string): string {
  if (!src.includes(from)) throw new Error(`dragon materials: the hide shader no longer has "${from}"`);
  return src.replace(from, to);
}

/** The dragon's patch of the wyvern body shader's fragment source. */
export function patchDragonBody(frag: string): string {
  let f = swap(frag, '#include <common>', '#include <common>\nuniform float uDwPlateMix;\nuniform vec3 uDwClaws;');
  f = swap(f, PLATE_LINE, 'vec3 col = mix(uPrimary, uSecondary, dorsal * uDwPlateMix);');
  // Slate claws with a little of the hide's grain (the fit gives claws no distance along them).
  f = swap(f, CLAW_LINE, 'return uDwClaws * (0.92 + 0.12 * (n2 - 0.5));');
  return f;
}

function wrap(m: MeshToonMaterial, extra: DragonShadeUniforms, patchFrag: ((f: string) => string) | null, key: string): MeshToonMaterial {
  const inner = m.onBeforeCompile.bind(m);
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    inner(shader, renderer);
    Object.assign(shader.uniforms, extra);
    if (patchFrag) shader.fragmentShader = patchFrag(shader.fragmentShader);
  };
  m.customProgramCacheKey = ((prev) => () => prev() + key)(m.customProgramCacheKey.bind(m));
  m.userData.dwDragon = key;
  return m;
}

/** The body (opaque) and membrane materials at a shading detail (2 close, 1 mid, 0 far). */
export function createDragonMaterials(u: WyvernUniforms, extra: DragonShadeUniforms, detail: 0 | 1 | 2): [MeshToonMaterial, MeshToonMaterial] {
  return [
    wrap(createBodyMaterial(u, { detail }), extra, patchDragonBody, '-dragon-body'),
    wrap(createMembraneMaterial(u, { detail }), extra, null, '-dragon-membrane'),
  ];
}

/** Write a palette into the uniforms (cheap; no rebuild). */
export function applyDragonPalette(u: WyvernUniforms, extra: DragonShadeUniforms, p: DragonPalette): void {
  capLuminance(u.uPrimary.value.set(p.hide), SCALES_MAX_LUMINANCE);
  capLuminance(u.uSecondary.value.set(p.plates), SCALES_MAX_LUMINANCE);
  capLuminance(u.uBelly.value.set(p.belly), BELLY_MAX_LUMINANCE);
  u.uMembrane.value.set(p.membrane);
  u.uEyes.value.set(p.eyes);
  u.uHorn.value.set(p.horns);
  extra.uDwClaws.value.set(p.claws);
  // The plain coat: the flight plates are the dorsal channel, not one of the wyverns' patterns.
  u.uPattern.value = 0;
  u.uBreed.value = 0;
}
