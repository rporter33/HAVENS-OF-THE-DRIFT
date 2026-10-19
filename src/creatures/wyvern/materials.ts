// Wyvern materials. All are MeshToonMaterial (the shared soft toon ramp) patched by
// applyPainterly (rim light + height fog) and then by the shader code below:
//
//   body      region colors (skin, horn, claws, eyes, mouth, saddle leather/metal/cloth/wood,
//             armor plates) and the procedural skin patterns, computed per fragment from the
//             bind-pose (body-space) position, so markings stay glued to the animated body.
//             The hide reads at every distance through a detail ladder (keeled scales, then
//             rings of scale rows and paravertebral scutes, then soft mottling, each faded to
//             its own mean), a countershaded back with a darker spine, and each breed's own
//             markings on its natural coat. DW_DETAIL (0..2) drops the fine layers for LODs.
//   membrane  wings, sails, fans, fins and feathers: veins, darker trailing edges, a fluttering
//             trailing edge, and the signature backlight: when the sun is behind a membrane as
//             seen from the camera, light glows through it (fake subsurface transmission).
//   ghost     race ghosts: translucent bluish-white fresnel, no shadows.
//
// Colors and pattern switches are uniforms, so a color/pattern change is a uniform update rather
// than a rebuild.

import {
  NormalBlending,
  Color,
  DoubleSide,
  FrontSide,
  MeshToonMaterial,
  Vector2,
  Vector3,
  type IUniform,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { WyvernLook } from '../../core/types';
import { PAINTERLY_RIM_GLSL, applyPainterly, toonRamp } from '../../render/painterly';
import { creatureUniforms, globalUniforms } from '../../render/uniforms';
import { CREATURE_LIGHT, CREATURE_LIGHT_BLOCK, CREATURE_LIGHT_PARS, CREATURE_TOON_PARS, RELIEF_APPLY, RELIEF_PARS } from './shading/light';

export const PATTERN_IDS: Record<string, number> = {
  plain: 0,
  saddleback: 1,
  stripes: 2,
  dapple: 3,
  ember: 4,
  starfield: 5,
  gilded: 6,
};

/** Breed ids as the body shader knows them (uBreed): each breed's natural markings. */
export const BREED_INDEX: Record<string, number> = {
  harrier: 0,
  skimmer: 1,
  galewing: 2,
  ironback: 3,
};

/** Uniforms shared by the body and membrane materials of one wyvern. */
export interface WyvernUniforms {
  uPrimary: IUniform<Color>;
  uSecondary: IUniform<Color>;
  uBelly: IUniform<Color>;
  uMembrane: IUniform<Color>;
  uEyes: IUniform<Color>;
  uSaddle: IUniform<Color>;
  uCloth: IUniform<Color>;
  uHorn: IUniform<Color>;
  uPattern: IUniform<number>;
  /** Breed index (BREED_INDEX): which natural markings the coat carries. */
  uBreed: IUniform<number>;
  uEyeCenter: IUniform<Vector3>;
  uEyeAxis: IUniform<Vector3>;
  uEyeRadius: IUniform<number>;
  uBlink: IUniform<number>;
  /**
   * 0..1 sweep of the nictitating membrane: a translucent inner eyelid drawn sideways across the
   * eye from its front corner (separate from the outer lids, `uBlink`).
   */
  uNictitate: IUniform<number>;
  /**
   * 0..1 the lower lid rising (reptiles close the eye mostly from below; D5 shades it, the life
   * layer drives it). 0 until then.
   */
  uBlinkLower: IUniform<number>;
  /** Membrane flutter amplitude (m) and speed (rad/s), from airspeed. */
  uFlutter: IUniform<number>;
  uFlutterRate: IUniform<number>;
  /** Wind ripple strength for sails/fans (0..1). */
  uRipple: IUniform<number>;
  /** Scale of the body (patterns are authored for a ~3.3 m torso). */
  uBodyScale: IUniform<number>;
  /**
   * Membrane billow under the air load (m at the panel's middle), left wing in x, right in y:
   * + bows the membrane up like a filled sail (power stroke, g-load), − lets it sag (recovery).
   */
  uWingLoad: IUniform<Vector2>;
  /** 0..1 how folded the wings are on the ground: bunched membranes read darker and denser. */
  uFold: IUniform<number>;
  /**
   * 0..1 dark contour where the surface turns away from the camera, so pale palettes keep a
   * silhouette against white cloud. 1 for the player's mount, 0 for ghosts and showroom extras.
   */
  uContour: IUniform<number>;
}

/**
 * A number uniform with its own hidden class: plain `{ value }` literals share one shape with the
 * colour and vector uniforms, so a number stored in them is boxed on the heap every frame.
 */
class ScalarUniform implements IUniform<number> {
  // Initialized with a non-integer so the field holds an unboxed double from the start.
  value = 0.5;
  constructor(v: number) {
    this.value = v;
  }
}
const num = (v: number): IUniform<number> => new ScalarUniform(v);

export function createWyvernUniforms(): WyvernUniforms {
  return {
    uPrimary: { value: new Color() },
    uSecondary: { value: new Color() },
    uBelly: { value: new Color() },
    uMembrane: { value: new Color() },
    uEyes: { value: new Color() },
    uSaddle: { value: new Color() },
    uCloth: { value: new Color() },
    uHorn: { value: new Color() },
    uPattern: num(0),
    uBreed: num(0),
    uEyeCenter: { value: new Vector3() },
    uEyeAxis: { value: new Vector3(1, 0, 0) },
    uEyeRadius: num(0.1),
    uBlink: num(0),
    uNictitate: num(0),
    uBlinkLower: num(0),
    uFlutter: num(0),
    uFlutterRate: num(20),
    uRipple: num(0),
    uBodyScale: num(1),
    uWingLoad: { value: new Vector2() },
    uFold: num(0),
    uContour: num(1),
  };
}

const _c = new Color();

/**
 * Highest linear luminance a look's hide colors may have. Pale picks stay pale but leave the
 * lit hide room under the bloom threshold (a cream belly at 0.72 bloomed into a white tube at
 * golden hour). 0.55 is about HSL lightness 0.74 for a warm cream.
 */
export const BELLY_MAX_LUMINANCE = 0.55;
export const SCALES_MAX_LUMINANCE = 0.6;
/** The saddle pad's undyed linen (G3, target renders 01 and 07) and its luminance ceiling. */
export const LINEN_PAD = '#d9c9a8';
export const CLOTH_MAX_LUMINANCE = 0.4;

/** Linear (Rec. 709) luminance of a linear color. */
export function luminance(c: Color): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/** Scale a linear color down (hue and saturation kept) so its luminance is at most `max`. */
export function capLuminance(c: Color, max: number): Color {
  const l = luminance(c);
  return l > max ? c.multiplyScalar(max / l) : c;
}

/** Write a look's colors into the uniforms (cheap; no rebuild). */
export function applyLookUniforms(u: WyvernUniforms, look: WyvernLook): void {
  capLuminance(u.uPrimary.value.set(look.primary), SCALES_MAX_LUMINANCE);
  capLuminance(u.uSecondary.value.set(look.secondary), SCALES_MAX_LUMINANCE);
  capLuminance(u.uBelly.value.set(look.belly), BELLY_MAX_LUMINANCE);
  u.uMembrane.value.set(look.membrane);
  u.uEyes.value.set(look.eyes);
  u.uSaddle.value.set(look.saddleColor);
  // Saddle cloth: an undyed linen pad under the leather, as on the target renders (G3), warmed a
  // little toward the saddle color. Its luminance is capped (a near-white band on top of the back
  // caught the light like a glowing strip).
  capLuminance(u.uCloth.value.set(LINEN_PAD).lerp(_c.set(look.saddleColor), 0.14), CLOTH_MAX_LUMINANCE);
  // Horn: a bone color nudged toward the secondary scales.
  u.uHorn.value.set('#d9c9a6').lerp(_c.set(look.secondary), 0.18);
  u.uPattern.value = PATTERN_IDS[look.pattern] ?? 0;
  u.uBreed.value = BREED_INDEX[look.breed] ?? 0;
}

// ---------------------------------------------------------------------------------------------
// GLSL
// ---------------------------------------------------------------------------------------------

const NOISE_GLSL = /* glsl */ `
float dwHash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
vec3 dwHash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float dwVnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(dwHash13(i), dwHash13(i + vec3(1, 0, 0)), f.x), mix(dwHash13(i + vec3(0, 1, 0)), dwHash13(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(dwHash13(i + vec3(0, 0, 1)), dwHash13(i + vec3(1, 0, 1)), f.x), mix(dwHash13(i + vec3(0, 1, 1)), dwHash13(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
// Cellular noise: x = distance to the nearest feature, y = to the second nearest, z = cell id.
vec3 dwCells(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  float id = 0.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = dwHash33(i + g);
    vec3 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = dwHash13(i + g + 7.7); }
    else if (d < d2) { d2 = d; }
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}
`;

const DETAIL_DEFAULT = /* glsl */ `
#ifndef DW_DETAIL
#define DW_DETAIL 2
#endif
`;

const BODY_PARS_FRAG = /* glsl */ `${DETAIL_DEFAULT}
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uBelly;
uniform vec3 uMembrane;
uniform vec3 uEyes;
uniform vec3 uSaddle;
uniform vec3 uCloth;
uniform vec3 uHorn;
uniform float uPattern;
// Breed (0 harrier, 1 skimmer, 2 galewing, 3 ironback): its natural markings.
uniform float uBreed;
uniform vec3 uEyeCenter;
uniform vec3 uEyeAxis;
uniform float uEyeRadius;
uniform float uBlink;
uniform float uNictitate;
uniform float uBodyScale;
uniform float uContour;
varying vec3 vBodyPos;
varying vec4 vMat;
varying vec2 vUv2;
flat varying float vRegion;
${NOISE_GLSL}

// Scales: the nearest scale centre in a jittered grid (feature points kept to the middle half
// of each cell, so a 2x2x2 search finds it: 8 lookups instead of 27). xyz: offset from the
// fragment to that centre; w: how far inside the scale (0 at the crevice to the next one).
vec4 dwScaleCell(vec3 p, out vec3 r2) {
  vec3 i = floor(p - 0.5);
  vec3 f = p - i;
  float d1 = 8.0;
  float d2 = 8.0;
  vec3 r1 = vec3(0.0);
  r2 = vec3(1.0);
  for (int z = 0; z <= 1; z++)
  for (int y = 0; y <= 1; y++)
  for (int x = 0; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 r = g + 0.25 + 0.5 * dwHash33(i + g) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; r2 = r1; d1 = d; r1 = r; }
    else if (d < d2) { d2 = d; r2 = r; }
  }
  return vec4(r1, sqrt(d2) - sqrt(d1));
}

// Derivative of smoothstep(a, b, x) with respect to x.
float dwDss(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return 6.0 * t * (1.0 - t) / (b - a);
}

// Returns albedo; writes the emissive part and a "gold" mask for the glint.
vec3 dwWyvernAlbedo(out vec3 emit, out float gold) {
  emit = vec3(0.0);
  gold = 0.0;
  int region = int(vRegion + 0.5);
  // How much of the rim a region takes (dwRimScale, shading/light.ts): full on the hide, little
  // on the saddle's leather, cloth and gold (thin edges flare like a light source), the eye and
  // the keratin of claws and teeth; the belly is masked below by anatomy.
  dwRimScale = region == 5 ? 0.15 : (region >= 4 && region <= 7) || region == 11 ? 0.3 : region == 2 ? 0.5 : region == 9 || region == 13 ? 0.25 : 1.0;
  // Painterly chroma (shading/light.ts): the hide and the tack lose the saturation the warm light
  // adds; eyes, horn, claws, gold and glass keep theirs.
  dwChroma = region == 0 || region == 8 ? ${CREATURE_LIGHT.hideChroma.toFixed(4)} : region == 4 || region == 6 || region == 11 ? ${CREATURE_LIGHT.tackChroma.toFixed(4)} : 1.0;
  vec3 bp = vBodyPos / uBodyScale;
  // Footprint of a pixel in body space (body-scale units): every pattern below fades to its own
  // mean as its features shrink toward a pixel, so nothing sparkles and nothing drifts in value.
  vec3 bpw = fwidth(bp);
  float fp = length(bpw);
#if DW_DETAIL >= 1
  float n1 = dwVnoise(bp * 2.3);
  float n2 = dwVnoise(bp * 6.1 + 3.1);
#else
  // Far (LOD2) and 'low': no value noise at all (16 hashes a fragment); its mean instead.
  float n1 = 0.5;
  float n2 = 0.5;
#endif
  float n1f = 1.0 - smoothstep(0.12, 0.3, fp);
  float n2f = 1.0 - smoothstep(0.05, 0.12, fp);
  // Scale coordinates, faded out by their on-screen frequency so they never shimmer at range.
  // On the body tube: along it (rows ~13 cm) and around it (40 rows, so smaller on the neck and
  // in rings down the tail); elsewhere a granular 3D cell.
  vec2 tq = vec2(vUv2.x / (0.13 * uBodyScale), (vMat.w - 2.0) * 20.0);
  dwTq = tq;
  dwReliefTq = vec2(0.0);
  dwReliefBp = vec3(0.0);
  dwThin = 0.0;
  vec2 tw = fwidth(tq);
  float ft = length(tw);
  float tubeFade = 1.0 - smoothstep(0.16, 0.42, ft);
  vec3 sq = bp * vec3(11.0, 11.0, 8.0);
  float scaleFade = 1.0 - smoothstep(0.16, 0.4, length(bpw * vec3(11.0, 11.0, 8.0)));
  if (region == 0 || region == 8) {
    float belly = vMat.y;
    float dorsal = vMat.z;
    float s = vUv2.x / uBodyScale;
    bool onTube = vMat.w > 0.5;
    // Angle from the spine on the tube (0 on the spine, 0.5 mid-flank, 1 under the belly); its
    // seam runs under the belly, so features keyed to it are kept to the back and flanks.
    float ang = abs(vMat.w - 2.0);
    float angW = tw.y / 20.0;
    int pat = int(uPattern + 0.5);
    int breed = int(uBreed + 0.5);
    // Countershading: the back a full value step under the flanks (dorsal 0.47 of the way to the
    // secondary), and a darker stripe down the spine.
    vec3 col = mix(uPrimary, uSecondary, dorsal * 0.47);
    float spine = onTube ? (1.0 - smoothstep(0.035 - angW, 0.085 + angW, ang)) * smoothstep(0.6, 0.9, dorsal) : smoothstep(0.88, 1.0, dorsal);
    col *= 1.0 - 0.16 * spine;
    // Painterly value variation: soft mottling (~40 cm) that holds to the chase camera and a
    // finer grain, each faded to its mean by footprint.
    col *= 1.0 + 0.14 * (n1 - 0.5) * n1f + 0.08 * (n2 - 0.5) * n2f;
    // The darkest coat tone: saddleback mantles and the breeds' markings.
    // G3: a step lighter than before (0.62): from the chase camera the target renders read the
    // back as a darker green, not near-black.
    vec3 mantle = min(uSecondary, 0.75 * uPrimary);
    if (pat == 1) {
      // Saddleback: a dark mantle over the shoulders and back, ragged edge.
      float along = smoothstep(-1.9, -1.2, bp.z) * (1.0 - smoothstep(1.2, 2.2, bp.z));
      float m = smoothstep(0.38, 0.55, dorsal * 0.85 + 0.2 * along + 0.18 * (n1 - 0.5) + 0.08 * (n2 - 0.5) * n2f + 0.12 * along - 0.12);
      m *= 1.0 - belly;
      // The mantle stays on the back (G3): on the wing-arms and legs it read as a near-black slab
      // from the side, where the target renders keep the limbs in the coat's own green.
      m *= onTube ? 1.0 : 0.3;
      col = mix(col, mantle * (0.92 + 0.16 * (n2 - 0.5) * n2f), m * (0.6 + 0.4 * along));
      // The mantle continues as a stripe down the tail.
      float tailStripe = smoothstep(0.62, 0.8, dorsal + 0.1 * (n2 - 0.5) * n2f) * smoothstep(-1.9, -2.6, bp.z);
      col = mix(col, mantle, tailStripe * 0.85);
      // Each breed's own markings on its natural coat, keyed to the anatomy (body space), bold
      // enough to read as shapes from the chase camera.
      if (breed == 0) {
        // Harrier: dark chevrons pointing forward down the back, closing into bands on the tail.
        float cv = (bp.z + 1.1 * abs(bp.x)) / 0.62;
        float cw = (bpw.z + 1.1 * bpw.x) / 0.62;
        float fc = fract(cv);
        float bar = smoothstep(0.0, 0.07 + cw, fc) * (1.0 - smoothstep(0.3, 0.37 + cw, fc));
        bar = mix(0.3, bar, 1.0 - smoothstep(0.25, 0.5, cw));
        float wv = onTube ? smoothstep(0.3, 0.75, dorsal) * (1.0 - smoothstep(0.9, 1.4, bp.z)) * smoothstep(-6.8, -3.2, bp.z) : 0.0;
        col = mix(col, mantle * 0.7, bar * wv * 0.6);
      } else if (breed == 1) {
        // Skimmer: a pale stripe along each flank from the jaw down the tail.
        float st = smoothstep(0.34 - angW, 0.39 + angW, ang) * (1.0 - smoothstep(0.47 - angW, 0.52 + angW, ang));
        st *= onTube ? smoothstep(-7.5, -3.5, bp.z) : 0.0;
        col = mix(col, mix(uBelly, uPrimary, 0.25), st * 0.85);
      } else if (breed == 2) {
        // Galewing: dark bars across the arm, the wing's leading edge (like a falcon's), and a
        // pale stripe down the side of the throat.
        if (!onTube && vUv2.x > 19.5) {
          float a = (vUv2.x - 20.0) / uBodyScale;
          float bv = a / 0.42;
          float bw = tw.x * 0.13 / 0.42;
          float fb = fract(bv);
          float bar = smoothstep(0.0, 0.08 + bw, fb) * (1.0 - smoothstep(0.42, 0.5 + bw, fb));
          bar = mix(0.45, bar, 1.0 - smoothstep(0.25, 0.5, bw));
          col = mix(col, mantle * 0.7, bar * smoothstep(0.4, 0.9, a) * 0.85);
        }
        float st = smoothstep(0.42 - angW, 0.46 + angW, ang) * (1.0 - smoothstep(0.54 - angW, 0.59 + angW, ang));
        st *= onTube ? smoothstep(1.05, 1.5, bp.z) : 0.0;
        col = mix(col, uBelly, st * 0.85);
      }
    } else if (pat == 2) {
      // Tiger stripes across the body, tapering down the flanks.
      float wob = 0.55 * (n1 - 0.5) + 0.25 * (n2 - 0.5);
      float band = 0.5 + 0.5 * sin(s * 4.2 + wob * 3.0);
      float bwd = fwidth(band);
      float thr = mix(0.98, 0.62, clamp(dorsal * 1.15 + 0.15, 0.0, 1.0));
      float stripe = smoothstep(thr - 0.04 - bwd, thr + 0.02 + bwd, band) * (1.0 - smoothstep(0.2, 0.6, belly));
      col = mix(col, uSecondary * 0.8, stripe);
    } else if (pat == 3) {
      // Dapple: bold rounded blotches like a dappled horse — big dark ones ringed a shade
      // darker, smaller pale ones between — readable from the chase camera.
      float side = (1.0 - 0.85 * belly) * (0.65 + 0.35 * dorsal);
      vec3 c = dwCells(bp * 1.6 + n1 * 0.45);
      float cw = fp * 1.6;
      float dark = (1.0 - smoothstep(0.26 - cw, 0.4 + cw, c.x)) * step(0.4, c.z);
      float ring = smoothstep(0.18, 0.3, c.x) * (1.0 - smoothstep(0.32, 0.4 + cw, c.x)) * step(0.4, c.z) * (1.0 - smoothstep(0.08, 0.2, cw));
#if DW_DETAIL >= 1
      vec3 c2 = dwCells(bp * 3.0 + 2.0 + n2 * 0.4);
      float light = (1.0 - smoothstep(0.14, 0.26 + fp * 3.0, c2.x)) * step(0.45, c2.z) * (1.0 - dark);
      light = mix(0.07, light, 1.0 - smoothstep(0.1, 0.25, fp * 3.0));
#else
      float light = 0.07 * (1.0 - dark);
#endif
      vec3 spot = mix(uSecondary, uPrimary * 0.5, 0.25);
      col = mix(col, spot * 0.9, dark * side * 0.92);
      col = mix(col, spot * 0.62, ring * side * 0.5);
      col = mix(col, mix(uPrimary, uBelly, 0.75) * 1.15, light * side * 0.85);
    } else if (pat == 4) {
      // Ember veins: a dark hide split by thin glowing seams that brighten after dusk. The seams
      // widen with their on-screen size and fade to their mean glow, so they never sparkle.
      vec3 c = dwCells(bp * 1.5 + vec3(n1 * 0.7));
      float e1 = c.y - c.x;
      float ew = fwidth(e1);
      float seam = 1.0 - smoothstep(0.012, 0.05 + 1.5 * ew, e1);
      seam = mix(seam, 0.16, smoothstep(0.08, 0.2, fp * 1.5));
#if DW_DETAIL >= 1
      vec3 c2 = dwCells(bp * 3.4 + 5.0);
      float e2 = c2.y - c2.x;
      float fine = (1.0 - smoothstep(0.008, 0.03 + 1.5 * fwidth(e2), e2)) * 0.6 * step(0.5, c2.z);
      fine = mix(fine, 0.03, smoothstep(0.06, 0.15, fp * 3.4));
#else
      float fine = 0.03;
#endif
      float v = max(seam, fine) * (1.0 - belly * 0.7);
      col = mix(col * 0.5, uSecondary * 0.45, 0.5);
      float flick = 0.8 + 0.2 * sin(uTime * 1.3 + c.z * 30.0);
      vec3 ember = mix(vec3(1.0, 0.38, 0.08), vec3(1.0, 0.7, 0.25), c.z);
      col = mix(col, ember * 0.75, v * 0.7);
      emit += ember * v * (0.12 + 1.8 * uNight) * flick;
    } else if (pat == 5) {
      // Starfield: pale freckles, densest along the back, twinkling a little at night; the
      // freckles fade to their mean as they shrink toward a pixel.
      vec3 c = dwCells(bp * 4.1);
      float r = 0.13 + 0.12 * c.z;
      float star = (1.0 - smoothstep(r, r + 0.04 + fp * 4.1, c.x)) * step(0.35 - 0.35 * dorsal, c.z);
      star = mix(star, 0.06, smoothstep(0.08, 0.2, fp * 4.1));
#if DW_DETAIL >= 1
      vec3 c2 = dwCells(bp * 9.0 + 4.0);
      float star2 = (1.0 - smoothstep(0.1, 0.15 + fp * 9.0, c2.x)) * step(0.3, c2.z) * (0.55 + 0.45 * dorsal);
      star = max(star, mix(star2, 0.0, smoothstep(0.08, 0.2, fp * 9.0)));
#endif
      col = mix(col * 0.72, uSecondary * 0.8, 0.35 * dorsal);
      // Pale, never white: a day-lit freckle near 1.0 read as a spark.
      vec3 pale = min(mix(uBelly, vec3(1.0), 0.7) * 1.4, vec3(0.6));
      col = mix(col, pale, star * (1.0 - belly));
      emit += pale * star * (1.0 - belly) * uNight * 0.9 * (0.7 + 0.3 * sin(uTime * 2.0 + c.z * 40.0));
    }
    // Gilded: the free edges of the keeled scales themselves catch gold (one scale language),
    // a gold sheen of the same mean where the scales are too small to draw.
    float gilt = pat == 6 ? smoothstep(0.1, 0.7, dorsal + 0.3 * (1.0 - belly) - 0.2) : 0.0;
    float giltRim = 0.07;
    // Gold on the free edges of the fine scales up close, on the rear edges of the scale rings
    // further out, a sheen of the same mean beyond.
    float fineRim = 0.07;
    float ringRim = 0.12;
    if (region == 0 && onTube) {
      // Keeled dorsal scales on the body: staggered rows of overlapping scales running nose to
      // tail, each a round-tipped shield whose free rear edge overlaps the next, a raised keel
      // down its middle (strongest along the back); they flatten down the flanks and give way
      // to the broad ventral scutes.
#if DW_DETAIL >= 2
      if (tubeFade > 0.001) {
        float row = floor(tq.y);
        float along = tq.x + 0.5 * mod(row, 2.0);
        vec2 f = vec2(fract(tq.y) - 0.5, fract(along));
        // A lanceolate free edge: rounded at the shoulders, coming to a soft point.
        float d = (1.0 - 0.62 * pow(abs(2.0 * f.x), 1.5)) - f.y;
        // Line widths grow with the on-screen size of a scale, so the crevices stay soft lines
        // instead of breaking into dots.
        float aa = max(tw.x, tw.y * 2.0 * abs(f.x));
        float inside = smoothstep(-aa, aa, d);
        float gap = 1.0 - smoothstep(0.0, 0.07 + 1.5 * aa, abs(d));
        float side = (1.0 - smoothstep(0.0, 0.06 + 1.5 * tw.y, 0.5 - abs(f.x))) * inside;
        float keelW = smoothstep(0.15, 0.7, dorsal);
        float keel = (1.0 - smoothstep(0.0, 0.08 + 1.5 * tw.y, abs(f.x))) * smoothstep(0.1, 0.55, f.y) * inside * keelW;
        float rear = smoothstep(0.05, 0.9, f.y) * inside;
        float w = tubeFade * (1.0 - smoothstep(0.2, 0.55, belly));
        float shade = (1.0 - 0.24 * max(gap, 0.6 * side)) * mix(0.9, 1.06, rear) + 0.14 * keel;
        // Normalised to its mean (0.935): as the scales fade out the hide keeps its value.
        col *= mix(1.0, shade * 1.0695, w);
        fineRim = gap * smoothstep(0.25, 0.75, f.y) * 1.25;
        // Relief (shading/light.ts RELIEF_APPLY): the analytic gradient of a smooth height:
        // each scale rises toward its free edge, keeled down the middle, dropping into the
        // crevice at the edge and the seam between rows. u across the row, v along it.
        float ar = 0.08 + 2.0 * aa;
        float ri = smoothstep(-ar, ar, d);
        float rdi = dwDss(-ar, ar, d);
        float ke = keelW * exp(-f.x * f.x / 0.0121);
        float kv = smoothstep(0.1, 0.6, f.y);
        float rk = ke * kv;
        float top = 0.45 * f.y + 0.6 * rk + 0.2;
        float dDu = -1.86 * sqrt(abs(2.0 * f.x)) * sign(f.x);
        float sw = 0.08 + 1.5 * tw.y;
        float hv = ri * (0.45 + 0.6 * ke * dwDss(0.1, 0.6, f.y)) - top * rdi;
        float hu = ri * 0.6 * rk * (-2.0 * f.x / 0.0121) + top * rdi * dDu - 0.3 * dwDss(0.5 - sw, 0.5, abs(f.x)) * sign(f.x);
        float wr = w * (1.0 - smoothstep(0.08, 0.2, ft));
        dwReliefTq = wr * vec2(hv, hu);
      }
#endif
#if DW_DETAIL >= 1
      // Detail ladder: as the scales drop under a few pixels they merge into rings three rows
      // long (the whorls of a lizard's tail, about 5% in value), which in turn give way to the
      // mottling above; each layer normalised to its mean.
      {
        float fb = fract(tq.x / 3.0);
        float bwd = tw.x / 3.0;
        // A ramp rising to each block's rear edge, the drop anti-aliased; mean 0.5.
        float blk = smoothstep(0.1, 0.9, fb) * (1.0 - smoothstep(0.96 - 1.5 * bwd, 1.0, fb));
        ringRim = mix(smoothstep(0.8, 0.92, fb) * (1.0 - smoothstep(0.96 - 1.5 * bwd, 1.0, fb)), 0.12, smoothstep(0.15, 0.35, bwd));
        float bandW = (1.0 - tubeFade) * (1.0 - smoothstep(0.15, 0.35, bwd)) * (1.0 - smoothstep(0.2, 0.55, belly));
        col *= 1.0 + 0.1 * (blk - 0.48) * bandW;
      }
      // Paravertebral scutes: two rows of enlarged keeled scutes either side of the spine (about
      // 40 cm, as on monitors and crocodilians), pale keels down their middles. A faint grouping
      // under the fine scales up close, the main structure of the back from the chase camera.
      // (The ironback's osteoderms are geometry and take this role.)
      if (breed != 3) {
        vec2 mq = vec2(tq.x / 3.0, tq.y / 2.0);
        vec2 mw = tw / vec2(3.0, 2.0);
        float mrow = floor(mq.y);
        float stag = 0.5 * mod(mrow, 2.0);
        vec2 mf = vec2(fract(mq.y) - 0.5, fract(mq.x + stag));
        float h = dwHash13(vec3(mrow, floor(mq.x + stag), 3.7));
        float ex = abs(mf.x) * 2.0;
        float aw = 2.0 * max(mw.x, mw.y);
        float groove = smoothstep(0.8 - aw, 0.97 + aw, max(ex, abs(mf.y - 0.5) * 2.0));
        float keel = (1.0 - smoothstep(0.0, 0.14 + aw, ex)) * smoothstep(0.15, 0.85, mf.y);
        float rear = smoothstep(0.1, 0.95, mf.y);
        float mv = ((0.94 + 0.12 * h) * (1.0 - 0.3 * groove) * (0.94 + 0.1 * rear) + 0.14 * keel) * 1.0770;
        float rows = (1.0 - smoothstep(3.3, 4.0, abs(tq.y))) * smoothstep(0.55, 0.85, dorsal) * (1.0 - smoothstep(1.35, 1.75, bp.z)) * smoothstep(-4.8, -2.8, bp.z);
        float mW = rows * mix(1.0, 0.3, tubeFade) * (1.0 - smoothstep(0.25, 0.5, aw));
        col *= mix(1.0, mv, mW);
      }
#endif
      giltRim = mix(ringRim, fineRim, tubeFade);
    }
#if DW_DETAIL >= 2
    else if (region == 0 && scaleFade > 0.001) {
      // Head and limbs: small granular scales, softer.
      vec3 r2;
      vec4 cv = dwScaleCell(sq, r2);
      float w = scaleFade * (1.0 - smoothstep(0.2, 0.6, belly));
      float gap = 1.0 - smoothstep(0.0, 0.1, cv.w);
      col *= mix(1.0, (1.0 - 0.16 * gap) * mix(0.95, 1.03, smoothstep(-0.35, 0.35, cv.z)) * 1.0363, w);
      giltRim = mix(0.07, gap * 0.8, scaleFade);
      // Relief: domed scales sloping back (z) into crevices between cells; analytic gradient in
      // the cell lattice, carried to body space.
      vec3 dw = cv.xyz / max(length(cv.xyz), 1e-4) - r2 / max(length(r2), 1e-4);
      vec3 gq = vec3(0.0, 0.0, -0.3 * dwDss(-0.35, 0.35, cv.z)) + 0.5 * dwDss(0.0, 0.2, cv.w) * dw;
      float wr = w * (1.0 - smoothstep(0.08, 0.2, length(bpw * vec3(11.0, 11.0, 8.0))));
      dwReliefBp = wr * gq * vec3(11.0, 11.0, 8.0) / uBodyScale;
    }
#endif
    if (pat == 6) {
      vec3 goldCol = vec3(0.86, 0.66, 0.27);
      col *= 0.9;
      col = mix(col, goldCol, clamp(giltRim, 0.0, 1.0) * gilt * 0.9);
      gold = giltRim * gilt;
    }
    // Belly: a soft painterly boundary and faint transverse scutes. The pale ventral side takes
    // little rim (it faces down and away; a bright rim there read as a glowing tube).
    float bm = smoothstep(0.32, 0.68, belly + 0.18 * (n1 - 0.5));
    dwRimScale *= mix(1.0, 0.3, smoothstep(0.3, 0.7, belly));
    // Thin flesh for the subsurface terminator: the throat and the end of the tail.
    dwThin = max(0.9 * smoothstep(0.3, 0.7, belly) * smoothstep(1.1, 1.6, bp.z), 0.7 * smoothstep(-4.2, -5.2, bp.z));
    // Ventral scutes: broad transverse plates (~38 cm on a 3.3 m torso), each a face rising to
    // its free rear edge and a dark groove where the next one tucks under. Lines widen with their
    // on-screen size and fade to the plates' mean value, so they never alias or drift in value.
    float scF = s * 2.6;
    float scW = tw.x * 0.13 * 2.6;
    float scR = fract(scF);
    float scGroove = 1.0 - smoothstep(0.0, 0.05 + 1.5 * scW, min(scR, 1.0 - scR) - 0.01);
    float scFace = smoothstep(0.05, 0.85, scR);
    float scShade = (1.0 - 0.3 * scGroove) * (0.9 + 0.12 * scFace);
    scShade = mix(0.946, scShade, 1.0 - smoothstep(0.12, 0.4, scW));
    col = mix(col, uBelly * scShade * (1.0 + 0.12 * (n2 - 0.5) * n2f), bm);
    if (region == 8) {
      // Osteoderms: bony scutes in the secondary tone, their keels worn pale like old bone (the
      // ironback's signature, read from the chase camera), the rims shading down into the gaps
      // between them (aUv2.x: 0 on the keel, 1 at the rim).
      vec3 plate = mix(uSecondary, uPrimary, 0.3) * (0.93 + 0.14 * (n2 - 0.5) * n2f);
      float kw = fwidth(vUv2.x);
      plate = mix(plate, mix(uHorn, plate, 0.3), (1.0 - smoothstep(0.0, 0.3 + kw, vUv2.x)) * 0.8);
      plate *= 1.0 - 0.3 * smoothstep(0.75 - kw, 1.0, vUv2.x);
      col = plate;
    }
    return col;
  }
  if (region == 1) {
    // Horn: darker at the base, pale toward the tip, with faint growth rings.
    float t = vUv2.x;
    // A pale bone over most of its length (the target renders' horns and dorsal spines read as
    // pale ridges); only the root takes the mantle's tone.
    vec3 base = mix(uHorn * 0.62, uSecondary * 0.7, 0.3);
    vec3 c = mix(base, uHorn * 1.08, smoothstep(0.0, 0.55, t));
    c *= 0.92 + 0.08 * sin(t * 40.0);
    return c;
  }
  if (region == 9) {
    // Claws: dark keratin as on monitors and crocodilians, a worn horn tone at the base going
    // near-black at the tips (never the palest thing on the animal: an ivory near 0.9 read as LED
    // sparks at every foot, and even a mid horn out-shone the hide in the foot close-ups).
    return mix(vec3(0.22, 0.185, 0.14), vec3(0.09, 0.077, 0.068), smoothstep(0.3, 0.95, vUv2.x));
  }
  if (region == 13) {
    // Teeth: a dull, stained enamel, kept under the hide's value.
    return vec3(0.5, 0.46, 0.38) * (0.92 + 0.12 * (n2 - 0.5));
  }
  if (region == 2) {
    // Eye: glowing iris, slit pupil, dark limbus, eyelid when blinking.
    vec3 p = vBodyPos;
    vec3 axis = uEyeAxis;
    if (p.x < 0.0) { p.x = -p.x; }
    vec3 e = (p - uEyeCenter) / uEyeRadius;
    float d = dot(normalize(e), axis);
    vec3 up = normalize(vec3(0.0, 1.0, 0.0) - axis * axis.y);
    vec3 fw = normalize(cross(axis, up));
    float ey = dot(e, up);
    if (ey > 1.0 - 2.1 * uBlink) return mix(uPrimary, uSecondary, 0.4) * 0.85;
    float ex = dot(e, fw);
    float iris = smoothstep(0.25, 0.45, d);
    float pupil = (1.0 - smoothstep(0.1, 0.17, abs(ex) / max(0.25, 1.0 - abs(ey) * 0.85))) * smoothstep(0.55, 0.7, d);
    vec3 c = mix(uEyes * 0.25, uEyes * (0.85 + 0.35 * smoothstep(0.6, 0.95, d)), iris);
    c = mix(c, vec3(0.02, 0.015, 0.02), pupil);
    float hl = smoothstep(0.93, 0.97, dot(normalize(e), normalize(axis + up * 0.55 + fw * 0.35)));
    // Nictitating membrane: a milky, translucent inner lid sweeping back across the eye from its
    // front corner (ex = +1), its leading edge a touch denser.
    float nf = 1.0 - 2.25 * uNictitate;
    float nm = uNictitate > 0.001 ? smoothstep(nf - 0.05, nf + 0.02, ex) : 0.0;
    float nEdge = nm * (1.0 - smoothstep(nf + 0.02, nf + 0.16, ex));
    c = mix(c, mix(vec3(0.72, 0.8, 0.86), c, 0.35), nm * (0.42 + 0.3 * nEdge));
    c = mix(c, vec3(1.0), hl * (1.0 - 0.5 * nm));
    // The eyes glow by day too, a little brighter than before G3 (Robert, 2026-10-18: the glowing
    // eyes are part of the charm), and fully after dusk.
    emit += uEyes * iris * (1.0 - pupil) * (0.3 + 0.7 * uNight) * (1.0 - 0.75 * nm);
    return c;
  }
  if (region == 3) return vec3(0.32, 0.09, 0.11);
  if (region == 4) return uSaddle * (0.9 + 0.12 * n2);
  if (region == 5) {
    // Brass/gold fittings (linear albedo: a deep warm gold, not a light source).
    gold = 1.0;
    return vec3(0.55, 0.37, 0.12) * (0.9 + 0.15 * n2);
  }
  if (region == 6) return uCloth * (0.94 + 0.08 * n2);
  if (region == 7) return vec3(0.42, 0.26, 0.15) * (0.85 + 0.2 * dwVnoise(vec3(vBodyPos.x * 3.0, vBodyPos.y * 40.0, vBodyPos.z * 3.0)));
  if (region == 10) {
    emit += vec3(1.0, 0.72, 0.35) * (0.15 + 1.4 * uNight);
    return vec3(1.0, 0.85, 0.55);
  }
  if (region == 11) return mix(vec3(0.82, 0.76, 0.64), uCloth, 0.25) * (0.9 + 0.1 * n2);
  if (region == 12) {
    // Forked tongue: a dusky violet-rose, darker toward the prongs.
    return mix(vec3(0.55, 0.17, 0.34), vec3(0.26, 0.09, 0.24), smoothstep(0.4, 1.0, vUv2.x)) * (0.9 + 0.15 * n2);
  }
  return uPrimary;
}
`;

/**
 * Capture-harness ID matte (scripts/dragon-capture.mjs): compiled only when the harness sets the
 * DW_MATTE define on a material for one extra pass, never in play. Writes the non-emissive light
 * after fog (what the bloom prefilter thresholds), the emissive part, a coverage tag and the
 * region, so the harness can report the hide's brightest pixel against the bloom threshold.
 */
function matteOut(region: string): string {
  return /* glsl */ `
#ifdef DW_MATTE
  {
    vec3 dwMl = dwApplyFog(dwMatteLit, vDwWorldPos, cameraPosition);
    float dwMlL = dot(dwMl, vec3(0.2126, 0.7152, 0.0722));
    float dwMlE = max(0.0, dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722)) - dwMlL);
    gl_FragColor = vec4(dwMlL, dwMlE, -1000.0, ${region});
  }
#endif`;
}

const MEMBRANE_PARS_FRAG = /* glsl */ `${DETAIL_DEFAULT}
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uMembrane;
uniform vec3 uSaddle;
uniform vec3 uCloth;
uniform float uBodyScale;
uniform float uFold;
uniform float uContour;
varying vec3 vBodyPos;
varying vec4 vMat;
varying vec2 vUv2;
flat varying float vRegion;
varying float vDwUp;
${NOISE_GLSL}

// Albedo of membranes; also returns how much light passes through (0..1).
vec3 dwMembraneAlbedo(out float trans) {
  int region = int(vRegion + 0.5);
  float thin = vMat.y;
  float edge = vMat.z;
#if DW_DETAIL >= 1
  float n = dwVnoise(vBodyPos * 3.0 / uBodyScale);
#else
  float n = 0.5;
#endif
  if (region == 0) {
    // Wing membrane: veins fanning from the knuckle, skin-toned near the bones, a darker hem.
    float v = vUv2.y;
    float t = vUv2.x;
    float fv = fract(v * 3.0 + 0.06 * sin(t * 9.0 + v * 4.0));
    float vw = fwidth(v * 3.0);
    float vein = (1.0 - smoothstep(0.0, 0.045 + 1.5 * vw, min(fv, 1.0 - fv))) * smoothstep(0.08, 0.3, t);
    // Veins fade to their mean as they shrink toward a pixel (no crawl at range).
    vein = mix(vein, 0.1, smoothstep(0.08, 0.2, vw));
    float bw = fwidth(v);
    float bone = 1.0 - smoothstep(0.0, 0.07 + 1.5 * bw, min(fract(v), 1.0 - fract(v)));
    vec3 c = uMembrane * (0.92 + 0.12 * n);
    c = mix(c, mix(uMembrane, uSecondary, 0.6) * 0.8, vein * 0.55);
    c = mix(c, mix(uPrimary, uSecondary, 0.5), (1.0 - thin) * 0.45);
    c = mix(c, uSecondary * 0.7, smoothstep(0.93, 1.0, edge) * 0.6);
    // The finger struts: a darker band along each bone, so the fan of the hand reads from behind.
    c = mix(c, mix(uSecondary, uMembrane, 0.3) * 0.7, bone * 0.55);
    // The upper face is darker and duller than the underside (bats, pterosaurs): the wing reads
    // as a shape from the chase camera, and the backlit glow stands out against it.
    // G3: only a little darker now; the target renders show the upper face as a warm, lit amber,
    // and the dark struts and hem keep the shape readable against cloud.
    float top = smoothstep(0.15, 0.6, gl_FrontFacing ? vDwUp : -vDwUp);
    float cl = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(c, mix(vec3(cl), c, 0.95) * 0.93, top);
    trans = clamp(thin * (1.0 - 0.75 * vein) * (1.0 - bone * 0.5), 0.0, 1.0);
    // Folded on the ground the membrane bunches into deep pleats along the bones: darker, banded
    // light and shade, little light through.
    float pleat = 0.5 + 0.5 * sin(vUv2.y * 25.13 + vUv2.x * 3.0);
    // G3: shallower than before; the target renders keep a folded wing a lit amber.
    c *= 1.0 - uFold * (0.12 + 0.06 * vein + 0.16 * pleat * thin);
    trans *= 1.0 - 0.5 * uFold;
    return c;
  }
  if (region == 1) {
    // Feather: secondary at the root, membrane color toward the tip, a pale shaft.
    float t = vUv2.x;
    float shaft = 1.0 - smoothstep(0.02, 0.08, abs(vUv2.y));
    vec3 c = mix(uSecondary, uMembrane, smoothstep(0.2, 0.95, t));
    c = mix(c, uMembrane * 0.6, smoothstep(0.8, 1.0, t) * 0.5);
    c = mix(c, vec3(0.92, 0.88, 0.8), shaft * 0.6);
    c *= 0.92 + 0.1 * n;
    trans = 0.65 * (1.0 - shaft);
    return c;
  }
  if (region == 2) {
    // Fin / sail webbing with rays (thin skin: a warm terminator where light wraps into it).
    dwThin = 0.6;
    float ray = 1.0 - smoothstep(0.0, 0.12, abs(fract(vUv2.y) - 0.5) * 2.0 - 0.85);
    vec3 c = uMembrane * (0.9 + 0.12 * n);
    c = mix(c, mix(uSecondary, uMembrane, 0.3) * 0.8, ray * 0.6);
    c = mix(c, uSecondary * 0.75, smoothstep(0.85, 1.0, edge) * 0.5);
    trans = thin * (1.0 - 0.6 * ray);
    return c;
  }
  // Canopy cloth.
  trans = 0.55;
  return uCloth * (0.92 + 0.1 * n);
}
`;

const VERT_PARS = /* glsl */ `
uniform float uTime;
attribute vec4 aMat;
attribute vec2 aUv2;
// x: baked ambient occlusion (ao.ts), read by the creature light (shading/light.ts).
attribute vec4 aExtra;
varying float vDwAO;
varying vec3 vBodyPos;
varying vec4 vMat;
varying vec2 vUv2;
// The region id must not be interpolated: across a triangle joining two regions (leather and
// cloth, 4 and 6) it would pass through the ids between (5, gold) and paint a glinting seam.
flat varying float vRegion;
// Membranes: the bind-pose normal's up component (which face of the skin is its upper side).
varying float vDwUp;
uniform float uFlutter;
uniform float uFlutterRate;
uniform float uRipple;
uniform vec2 uWingLoad;
uniform float uFold;
uniform float uBodyScale;
`;

const VERT_BEGIN = /* glsl */ `
vDwAO = aExtra.x;
vBodyPos = position;
vMat = aMat;
vUv2 = aUv2;
vRegion = aMat.x;
`;

const MEMBRANE_VERT_BEGIN = /* glsl */ `
vDwAO = aExtra.x;
vBodyPos = position;
vMat = aMat;
vUv2 = aUv2;
vRegion = aMat.x;
vDwUp = normal.y;
{
  // Trailing-edge flutter (speed) plus a slow wind ripple for sails and fans.
  float ph = uTime * uFlutterRate - aUv2.x * 9.0 + aUv2.y * 5.0;
  float f = aMat.w * (uFlutter * sin(ph) + uFlutter * 0.4 * sin(ph * 2.3 + 1.7));
  float r = aMat.w * uRipple * 0.08 * sin(uTime * 3.1 - position.z * 2.4 + position.y * 1.3);
  transformed += objectNormal * (f + r);
  // Wing membranes bow under the air load like a filled sail: most in the middle of each panel
  // (aMat.y, 0 at the bones), up along the bind pose's dorsal axis, per wing.
  if (aMat.x < 0.5) {
    float load = position.x > 0.0 ? uWingLoad.x : uWingLoad.y;
    transformed.y += load * aMat.y * (1.0 - 0.35 * aMat.y);
    // Folded, the skin gathers into pleats running along the bones (an accordion across v).
    transformed.y += uFold * 0.045 * uBodyScale * aMat.y * sin(aUv2.y * 25.13 + aUv2.x * 3.0);
  }
}
`;

/** Uniforms and vertex attributes every wyvern material shares (the ghost shell included). */
function patchShared(shader: WebGLProgramParametersWithUniforms, u: WyvernUniforms): void {
  Object.assign(shader.uniforms, u, creatureUniforms, { uTime: globalUniforms.uTime, uNight: globalUniforms.uNight });
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_PARS);
}

/**
 * The creature light's declarations and toon ramp, for the lit body and membrane (after
 * applyPainterly has declared the sun, fog and world-position inputs they read).
 */
function patchLit(shader: WebGLProgramParametersWithUniforms, u: WyvernUniforms): void {
  patchShared(shader, u);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + CREATURE_LIGHT_PARS)
    .replace('#include <lights_toon_pars_fragment>', CREATURE_TOON_PARS + RELIEF_PARS);
}

/**
 * Swap the painterly lift for the creature light (shading/light.ts). Exact-text: if the
 * painterly patch ever changes, this throws at compile time instead of silently shipping the
 * flat lift (and its bloom) again.
 */
function creatureLight(frag: string): string {
  if (!frag.includes(PAINTERLY_RIM_GLSL)) throw new Error('wyvern materials: the painterly rim block was not found');
  return frag.replace(PAINTERLY_RIM_GLSL, CREATURE_LIGHT_BLOCK);
}

/**
 * Material options: `detail` 2 (close: full shading) … 0 (far: the cheapest pattern path), set
 * per LOD and quality (DW_DETAIL):
 *   2  everything: the keeled and granular scales and their relief, macro scutes, the detail
 *      ladder, both octaves of the cellular patterns;
 *   1  mid distance (LOD1): no fine scales or relief (they are faded out there anyway);
 *   0  far and quality 'low' (LOD2): also no value noise, macro scutes, ladder bands or second
 *      pattern octaves: countershading, mantle, markings and the first pattern octave.
 * Each level is its own program: create every material a wyvern may use at construction, so the
 * boot shader warm-up compiles them.
 */
export interface WyvernMaterialOptions {
  detail?: 0 | 1 | 2;
}

function detailOf(opts: WyvernMaterialOptions): 0 | 1 | 2 {
  const d = opts.detail ?? 2;
  return d <= 0 ? 0 : d >= 2 ? 2 : 1;
}

/** Opaque toon body with region colors and patterns. */
export function createBodyMaterial(u: WyvernUniforms, opts: WyvernMaterialOptions = {}): MeshToonMaterial {
  const detail = detailOf(opts);
  const m = new MeshToonMaterial({ side: FrontSide });
  m.defines = { DW_DETAIL: detail };
  applyPainterly(m, {
    rim: 1.1,
    onBeforeCompile: (shader) => {
      patchLit(shader, u);
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BEGIN);
      shader.fragmentShader = creatureLight(shader.fragmentShader)
        .replace('void main() {', BODY_PARS_FRAG + '\nvoid main() {')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + matteOut('vRegion + 1.0'))
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n#if DW_DETAIL >= 2\n' + RELIEF_APPLY + '\n#endif')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec3 dwEmit;
          float dwGold;
          diffuseColor.rgb = dwWyvernAlbedo(dwEmit, dwGold);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += dwEmit;
          if (dwGold > 0.0) {
            // Gold catches the sun: a small, tight glint on the sunlit side only (a broad sheen
            // here read as a glowing light source in daylight).
            vec3 gL = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
            vec3 gV = normalize(vViewPosition);
            vec3 gH = normalize(gL + gV);
            float nh = max(dot(normal, gH), 0.0);
            float g = pow(nh, 80.0) * 0.55 * smoothstep(0.0, 0.25, dot(normal, gL));
            totalEmissiveRadiance += vec3(1.0, 0.82, 0.5) * uSunColor * g * dwGold * (1.0 - uNight);
          }`,
        );
    },
  });
  m.customProgramCacheKey = ((prev) => () => prev() + '-wyvern-body-d' + detail)(m.customProgramCacheKey.bind(m));
  m.userData.dwWyvern = 'body';
  return m;
}

/** Double-sided membrane with the backlit glow. */
export function createMembraneMaterial(u: WyvernUniforms, opts: WyvernMaterialOptions = {}): MeshToonMaterial {
  const detail = detailOf(opts);
  const m = new MeshToonMaterial({ side: DoubleSide, shadowSide: DoubleSide });
  m.defines = { DW_DETAIL: detail };
  applyPainterly(m, {
    rim: 0.6,
    onBeforeCompile: (shader) => {
      patchLit(shader, u);
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + MEMBRANE_VERT_BEGIN);
      const idx = shader.fragmentShader.lastIndexOf('#include <opaque_fragment>');
      let frag = shader.fragmentShader;
      frag =
        frag.slice(0, idx) +
        /* glsl */ `
        {
          // Light through the membrane: looking toward the sun, or the far side is sunlit.
          vec3 mV = normalize(vDwWorldPos - cameraPosition);
          vec3 mN = normalize(inverseTransformDirection(normal, viewMatrix));
          float toward = pow(max(dot(mV, uSunDir), 0.0), 3.0);
          float back = max(dot(-mN, uSunDir), 0.0);
          float sunUp = smoothstep(-0.08, 0.12, uSunDir.y);
          // Saturate toward the membrane's own hue (thin skin glows deeper than it looks lit).
          vec3 glowCol = pow(uMembrane, vec3(1.45)) * 1.9 + vec3(0.04, 0.02, 0.0);
          vec3 glow = glowCol * uSunColor * (back * 0.55 + toward * 2.0) * dwTrans * sunUp;
          outgoingLight += glow * 0.85;
        }
        ` +
        frag.slice(idx);
      shader.fragmentShader = creatureLight(frag)
        .replace('void main() {', MEMBRANE_PARS_FRAG + '\nvoid main() {')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + matteOut('vRegion + 21.0'))
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float dwTrans;
          diffuseColor.rgb = dwMembraneAlbedo(dwTrans);`,
        );
    },
  });
  m.customProgramCacheKey = ((prev) => () => prev() + '-wyvern-membrane-d' + detail)(m.customProgramCacheKey.bind(m));
  m.userData.dwWyvern = 'membrane';
  return m;
}

/**
 * The generic ghost shell (Wyvern {ghost: true}): a translucent bluish-white fresnel. Races dress
 * the ghost in RaceGhost's own glass materials (depth prepass, outline) over this; the shell is
 * what showcases and anything else that asks for a ghost see.
 */
export function createGhostMaterial(u: WyvernUniforms, membrane: boolean): MeshToonMaterial {
  const m = new MeshToonMaterial({
    gradientMap: toonRamp(),
    side: membrane ? DoubleSide : FrontSide,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    premultipliedAlpha: true,
  });
  m.onBeforeCompile = (shader) => {
    patchShared(shader, u);
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n' + (membrane ? MEMBRANE_VERT_BEGIN : VERT_BEGIN),
    );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vBodyPos;\nvarying vec4 vMat;\nvarying vec2 vUv2;')
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        {
          vec3 gV = normalize(vViewPosition);
          // pow() of a negative base is undefined (a NaN-black core at grazing fan vertices):
          // clamp it. Stacked inner layers converge to the colour, so cap it (no white flare).
          float gF = pow(clamp(1.0 - abs(dot(normal, gV)), 0.0, 1.0), 2.2);
          float band = 0.5 + 0.5 * sin(vBodyPos.z * 3.0 - uTime * 4.0);
          vec3 gc = min(mix(vec3(0.42, 0.66, 1.0), vec3(0.9, 0.96, 1.0), gF) * (1.15 + 0.25 * band), vec3(0.95));
          float a = clamp(${membrane ? '0.2' : '0.16'} + 0.62 * gF + 0.06 * band, 0.0, 0.85);
          gl_FragColor = vec4(gc * a, a);
        }`,
      );
  };
  m.customProgramCacheKey = () => `wyvern-ghost-${membrane}`;
  return m;
}
