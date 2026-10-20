// The dragon's materials (gate G12b): the wyvern hide shader (wyvern/materials.ts) and its regions,
// painted with a flight's palette (look.ts). The wyvern module is imported, not edited. Two small
// patches go into the dragon's own programs, after the wyvern's, by exact text (they throw if the
// text moves, like the creature light's own patch):
//   - plates: the wyvern's back is countershaded, darkened 0.47 of the way toward the secondary
//     colour by the dorsal channel. The fit bakes the white flight's powder-blue plates into that
//     channel (scripts/blender/dragon_meshy_fit.py), so the dragon mixes most of the way: the plates
//     read in the flight's accent, as render 08 has them.
//   - claws: the wyvern's are a fixed dark keratin; the dragon's take the palette's slate, a
//     little lighter at the base and darker to the tip (features.ts gives the built claws their
//     distance along, aUv2.x).
//   - the eye: the built eyeball is a flattened almond (features.ts), so the eye region measures it
//     in its own stretch; and a dark lid line round it on the hide, in its frame, so the eye stands
//     out (Robert, 2026-10-19).
//
// Palette to uniforms: hide → primary, plates → secondary, belly, membrane and eyes as named, and
// horns → the horn region (horns, spines, fin rays and the tail fin). The hide's and belly's
// luminance caps are the wyvern's (bloom safety); a palette change is a uniform update.

import { Color, Vector3, type MeshToonMaterial, type WebGLProgramParametersWithUniforms } from 'three';
import {
  BELLY_MAX_LUMINANCE,
  SCALES_MAX_LUMINANCE,
  capLuminance,
  createBodyMaterial,
  createMembraneMaterial,
  type WyvernUniforms,
} from '../wyvern/materials';
import type { DragonPalette } from './look';
import { EYE } from './features';

/** How far the dorsal channel (the baked plate mask) mixes the hide toward the plates' colour. */
export const PLATE_MIX = 0.9;

/** The lid line round the eye: where it starts and ends (the eyeball's rim is near 0.9 in its own
 * ellipse coordinates, features.ts EYE) and how dark it is. */
export const LID = { from: 0.8, to: 1.22, strength: 0.8 };

/** The dragon's own uniforms, beside the wyvern's. */
export interface DragonShadeUniforms {
  uDwPlateMix: { value: number };
  uDwClaws: { value: Color };
  /** The eyeball's frame across its axis and its stretch: along the head, up and out (features.ts EYE). */
  uDwEyeFw: { value: Vector3 };
  uDwEyeUp: { value: Vector3 };
  uDwEyeShape: { value: Vector3 };
  /** 0 without the built eyeball (no lid line), 1 with it. */
  uDwEyeLid: { value: number };
}

export function createDragonShadeUniforms(): DragonShadeUniforms {
  return {
    uDwPlateMix: { value: PLATE_MIX },
    uDwClaws: { value: new Color() },
    uDwEyeFw: { value: new Vector3(0, 0, 1) },
    uDwEyeUp: { value: new Vector3(0, 1, 0) },
    uDwEyeShape: { value: new Vector3(EYE.long, EYE.tall, EYE.depth) },
    uDwEyeLid: { value: 1 },
  };
}

export const PLATE_LINE = 'vec3 col = mix(uPrimary, uSecondary, dorsal * 0.47);';
export const EYE_LINE = 'vec3 e = (p - uEyeCenter) / uEyeRadius;';
export const CLAW_LINE = 'return mix(vec3(0.22, 0.185, 0.14), vec3(0.09, 0.077, 0.068), smoothstep(0.3, 0.95, vUv2.x));';

function swap(src: string, from: string, to: string): string {
  if (!src.includes(from)) throw new Error(`dragon materials: the hide shader no longer has "${from}"`);
  return src.replace(from, to);
}

/** The dragon's patch of the wyvern body shader's fragment source. */
export function patchDragonBody(frag: string): string {
  let f = swap(
    frag,
    '#include <common>',
    '#include <common>\nuniform float uDwPlateMix;\nuniform vec3 uDwClaws;\nuniform vec3 uDwEyeFw;\nuniform vec3 uDwEyeUp;\nuniform vec3 uDwEyeShape;\nuniform float uDwEyeLid;',
  );
  f = swap(f, PLATE_LINE, 'vec3 col = mix(uPrimary, uSecondary, dorsal * uDwPlateMix);');
  // Slate claws: lighter at the base, darker to the tip, with a little of the hide's grain.
  f = swap(f, CLAW_LINE, 'return mix(uDwClaws * 1.2, uDwClaws * 0.55, smoothstep(0.1, 1.0, vUv2.x)) * (0.94 + 0.12 * (n2 - 0.5));');
  // The built eyeball is an ellipsoid (features.ts EYE): measured in its own stretch, its surface is
  // the unit sphere the eye region's iris, pupil and lids are drawn on.
  f = swap(f, EYE_LINE, EYE_LINE + '\n    if (uDwEyeLid > 0.5) e = uEyeAxis * (dot(e, uEyeAxis) / uDwEyeShape.z) + uDwEyeFw * (dot(e, uDwEyeFw) / uDwEyeShape.x) + uDwEyeUp * (dot(e, uDwEyeUp) / uDwEyeShape.y);');
  f = swap(f, 'void main() {', LID_GLSL + '\nvoid main() {');
  f = swap(f, 'diffuseColor.rgb = dwWyvernAlbedo(dwEmit, dwGold);', 'diffuseColor.rgb = dwDragonLid(dwWyvernAlbedo(dwEmit, dwGold));');
  return f;
}

/** The lid line on the hide round each eyeball, in the eyeball's own (mirrored) frame. */
const LID_GLSL = /* glsl */ `
vec3 dwDragonLid(vec3 col) {
  if (uDwEyeLid < 0.5 || int(vRegion + 0.5) != 0) return col;
  vec3 p = vBodyPos;
  if (p.x < 0.0) p.x = -p.x;
  vec3 q = (p - uEyeCenter) / uEyeRadius;
  float ez = dot(q, uEyeAxis);
  float rho = length(vec2(dot(q, uDwEyeFw) / uDwEyeShape.x, dot(q, uDwEyeUp) / uDwEyeShape.y));
  float w = fwidth(rho);
  float ring = smoothstep(${LID.from.toFixed(3)} - w, ${(LID.from + 0.12).toFixed(3)}, rho) * (1.0 - smoothstep(${(LID.to - 0.14).toFixed(3)}, ${LID.to.toFixed(3)} + w, rho));
  ring *= smoothstep(-0.4, 0.2, ez) * (1.0 - smoothstep(1.4, 2.0, abs(ez)));
  return mix(col, vec3(0.07, 0.075, 0.09), ${LID.strength.toFixed(3)} * ring);
}
`;

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
