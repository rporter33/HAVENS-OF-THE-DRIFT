// Creature light: how the wyvern's hide and membranes take light, as GLSL chunks the creature
// materials (materials.ts) splice in. The world's painterly patch (render/painterly.ts) stays as
// it is; these replace, for creatures only:
//
//   the painterly lift   render/painterly.ts PAINTERLY_RIM_GLSL, swapped by exact text for
//                        CREATURE_LIGHT_BLOCK: a soft sun-and-sky wrap fill with form (the
//                        painterly lift is flat over the whole surface: its fresnel term is 1
//                        on every front face), a true fresnel rim that is strongest against
//                        the sun, the camera rig's kick and rim lights, the highlight shoulder
//                        and the ink contour;
//   the highlight        a soft knee under the palette's bloom threshold on all non-emissive
//   shoulder             light, so the hide never blooms (emissive eyes, embers, lanterns and
//                        the membrane's transmitted glow are added after it and still do).

/** Uniforms and globals the creature light reads (declared once, before main). */
export const CREATURE_LIGHT_PARS = /* glsl */ `
uniform float uDwBloomT;
uniform vec3 uKickDir;
uniform vec3 uKickColor;
uniform float uKickI;
uniform vec3 uRimDir;
uniform vec3 uRimColor;
uniform float uRimI;
// Per-fragment shaping set by the albedo pass: how much of the rim (anatomy: little on the
// belly, claws and saddle gear) and of the fill a fragment takes.
float dwRimScale = 1.0;
float dwFillScale = 1.0;
// How much of the lit color's chroma a fragment keeps (the albedo pass lowers it on the hide and
// the tack; membranes, eyes and emissive keep theirs).
float dwChroma = 1.0;
`;

/** Luminance weights (Rec. 709, linear). */
const LUMA = 'vec3(0.2126, 0.7152, 0.0722)';

/**
 * Tuning of the creature light. The fill keeps the painterly lift's warm, sun-tinted energy
 * (what makes a wyvern sit in the golden world) but gives it a terminator; pale albedos are
 * capped in it, since a cream belly under a flat lift is what bloomed into a neon tube.
 */
export const CREATURE_LIGHT = {
  /** Fill strength relative to the painterly lift. */
  fill: 0.78,
  /** Fill on the side away from the sun, as a fraction of the sunlit side. */
  fillFloor: 0.24,
  /** Albedo luminance the fill sees at most (pale bellies take the fill of a mid tone). */
  fillAlbedoCap: 0.4,
  /** Fresnel rim gain on a hue-normalised tint (luminance 0.35 for any albedo above 0.3). */
  rimGain: 1.7,
  /** Shoulder: knee and ceiling below the bloom threshold, slope at the knee. */
  kneeBelow: 0.16,
  ceilingBelow: 0.05,
  kneeSlope: 0.3,
  /** Ink contour where the surface turns away (pale palettes keep an outline on white cloud). */
  contour: 0.34,
  /**
   * Chroma the lit hide keeps (G3). Warm golden-hour light, the hue-true rim and the grade's
   * saturation pushed a moss palette to emerald and brown leather to orange; the target renders
   * keep the hide muted and let the membranes, eyes and sky carry the color.
   */
  hideChroma: 0.7,
  /** Chroma the lit tack (leather, saddle cloth, wool) keeps. */
  tackChroma: 0.78,
} as const;

const f = (x: number) => x.toFixed(4);

/**
 * Replaces the painterly lift (spliced where PAINTERLY_RIM_GLSL was, right before
 * opaque_fragment). Splits off the emissive part, lights the rest, shoulders it under the bloom
 * threshold, inks the silhouette and puts the emissive back on top.
 */
export const CREATURE_LIGHT_BLOCK = /* glsl */ `
        vec3 dwLit = max(outgoingLight - totalEmissiveRadiance, vec3(0.0));
        {
          vec3 dwVv = normalize(vViewPosition);
          float dwNV = clamp(dot(normal, dwVv), 0.0, 1.0);
          vec3 dwSunV = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
          float dwNL = dot(normal, dwSunV);
          vec3 dwTint = mix(uSunColor, vec3(0.55, 0.65, 0.9), 0.35);
          float dwAlb = dot(diffuseColor.rgb, ${LUMA});
          float dwStr = uRimStrength * uDwRim;
          // Sun-and-sky wrap fill: the world's painterly lift with a terminator.
          vec3 dwFillAlb = diffuseColor.rgb * min(1.0, ${f(CREATURE_LIGHT.fillAlbedoCap)} / max(dwAlb, 1e-3));
          float dwWrap = ${f(CREATURE_LIGHT.fillFloor)} + ${f(1 - CREATURE_LIGHT.fillFloor)} * smoothstep(-0.55, 0.95, dwNL);
          dwLit += dwFillAlb * dwTint * (dwStr * 1.6 * ${f(CREATURE_LIGHT.fill)} * dwFillScale) * dwWrap;
          // Rim: a true fresnel edge, strongest with the sun behind the wyvern (contre-jour), in
          // the skin's hue at a fixed value so pale skin does not flare.
          float dwF1 = 1.0 - dwNV;
          float dwFres = dwF1 * dwF1 * dwF1;
          vec3 dwVw = normalize(vDwWorldPos - cameraPosition);
          float dwBack = 0.35 + 0.65 * smoothstep(-0.1, 0.7, dot(dwVw, uSunDir));
          vec3 dwHue = diffuseColor.rgb / max(0.3, dwAlb) * 0.35;
          dwLit += dwFres * dwStr * dwRimScale * dwBack * dwTint * dwHue * ${f(CREATURE_LIGHT.rimGain)};
          // Camera-rig kick (a soft wrap light) and directional rim (camera/creatureLight.ts).
          dwLit += diffuseColor.rgb * uKickColor * (uKickI * smoothstep(-0.1, 0.6, dot(normal, uKickDir)));
          dwLit += uRimColor * dwHue * (uRimI * dwRimScale * (1.0 - dwNV) * (1.0 - dwNV) * max(0.0, dot(normal, uRimDir)));
          // Painterly chroma: the hide and tack keep their hue but not the saturation the warm
          // light piles on (dwChroma, set per region by the albedo pass).
          dwLit = mix(vec3(dot(dwLit, ${LUMA})), dwLit, dwChroma);
          // Highlight shoulder: a soft knee just under the bloom threshold; never above it.
          float dwL = dot(dwLit, ${LUMA});
          float dwKnee = uDwBloomT - ${f(CREATURE_LIGHT.kneeBelow)};
          float dwRoom = ${f(CREATURE_LIGHT.kneeBelow - CREATURE_LIGHT.ceilingBelow)};
          if (dwL > dwKnee) dwLit *= (dwKnee + dwRoom * (1.0 - exp(-(dwL - dwKnee) * ${f(CREATURE_LIGHT.kneeSlope)} / dwRoom))) / dwL;
          // Ink contour where the surface turns away from the camera.
          float dwInk = 1.0 - uContour * ${f(CREATURE_LIGHT.contour)} * smoothstep(0.55, 0.95, 1.0 - dwNV);
          dwLit *= dwInk;
          outgoingLight = dwLit + totalEmissiveRadiance * dwInk;
        }
        #ifdef DW_MATTE
        vec3 dwMatteLit = dwLit;
        #endif
        `;

/** The shoulder as a function (tests, and the matte report's expectations). */
export function shoulder(lum: number, threshold: number): number {
  const knee = threshold - CREATURE_LIGHT.kneeBelow;
  const room = CREATURE_LIGHT.kneeBelow - CREATURE_LIGHT.ceilingBelow;
  if (lum <= knee) return lum;
  return knee + room * (1 - Math.exp((-(lum - knee) * CREATURE_LIGHT.kneeSlope) / room));
}

/**
 * The toon ramp: replaces three's lights_toon_pars_fragment in the creature materials. An
 * analytic ramp (no gradientMap fetch) with more steps across the lit half, so forms turn:
 * shadow 0.28, a terminator step, then 0.62 / 0.80 / 0.92 / 1.0. Each step is a smoothstep as
 * wide as 1.5 pixels of the ramp coordinate (never under 0.015): band edges stay soft lines
 * instead of breaking into dotted stairs on cylinders.
 */
export const RAMP = {
  shadow: 0.28,
  /** [edge in dotNL*0.5+0.5, step up] */
  steps: [
    [0.47, 0.2],
    [0.56, 0.14],
    [0.66, 0.18],
    [0.76, 0.12],
    [0.86, 0.08],
  ] as [number, number][],
};

/** The ramp value at ramp coordinate x (no anti-aliasing), for tests. */
export function toonRampValue(x: number): number {
  let v = RAMP.shadow;
  for (const [e, s] of RAMP.steps) if (x >= e) v += s;
  return v;
}

const rampGlsl = () => RAMP.steps.map(([e, s]) => `${f(s)} * smoothstep(${f(e)} - w, ${f(e)} + w, x)`).join(' + ');

export const CREATURE_TOON_PARS = /* glsl */ `
varying vec3 vViewPosition;
uniform vec3 uSkyZenith;
struct ToonMaterial {
  vec3 diffuseColor;
};
// 0..1 thin flesh (throat, frill, tail end) set by the albedo: light wraps into it warm and red.
float dwThin = 0.0;
float dwToonRamp(float x) {
  float w = max(0.015, 1.5 * fwidth(x));
#if defined(DW_DETAIL) && DW_DETAIL < 1
  // Far (LOD2) and 'low': shadow, terminator and full light only.
  return ${f(RAMP.shadow)} + ${f(RAMP.steps[0][1] + RAMP.steps[1][1])} * smoothstep(${f(RAMP.steps[0][0])} - w, ${f(RAMP.steps[0][0])} + w, x) + ${f(1 - RAMP.shadow - RAMP.steps[0][1] - RAMP.steps[1][1])} * smoothstep(${f(RAMP.steps[2][0])} - w, ${f(RAMP.steps[3][0])} + w, x);
#else
  return ${f(RAMP.shadow)} + ${rampGlsl()};
#endif
}
void RE_Direct_Toon(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight) {
  float dotNL = dot(geometryNormal, directLight.direction);
  vec3 irradiance = directLight.color * dwToonRamp(dotNL * 0.5 + 0.5);
#if !defined(DW_DETAIL) || DW_DETAIL >= 1
  // Subsurface terminator: a warm red band where the light wraps into thin skin.
  float t = (dotNL - 0.05) / 0.16;
  irradiance += directLight.color * vec3(1.0, 0.42, 0.28) * (0.22 * dwThin * exp(-t * t));
#endif
  reflectedLight.directDiffuse += irradiance * BRDF_Lambert(material.diffuseColor);
}
void RE_IndirectDiffuse_Toon(const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight) {
  // The sky's fill is cooler on the side away from the sun, and weaker looking into the sun
  // (that energy goes to the rim: contre-jour reads as a silhouette with a hot edge).
  vec3 dwSunV = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
  float dwShade = 1.0 - smoothstep(-0.2, 0.35, dot(geometryNormal, dwSunV));
  vec3 dwSky = clamp(uSkyZenith / max(dot(uSkyZenith, ${LUMA}), 1e-3), 0.0, 2.5);
  vec3 dwCool = mix(vec3(1.0), dwSky, 0.25 * dwShade);
  float dwToward = smoothstep(0.2, 0.7, dot(normalize(vDwWorldPos - cameraPosition), uSunDir));
  reflectedLight.indirectDiffuse += irradiance * dwCool * (1.0 - 0.3 * dwToward) * BRDF_Lambert(material.diffuseColor);
}
#define RE_Direct RE_Direct_Toon
#define RE_IndirectDiffuse RE_IndirectDiffuse_Toon
`;

/**
 * Micro-relief as a detail-light factor on the albedo, never through the toon ramp (a bumped
 * normal flips neighbouring pixels across band edges: 2x2 stipple and dotted terminators). The
 * albedo pass leaves the analytic height gradient of the scales in dwReliefTq (per unit of the
 * scale-row coordinates dwTq) and dwReliefBp (per metre of bind-pose body space); the chain rule
 * through the smooth screen derivatives of those coordinates gives the height change per pixel,
 * three's derivative-bump formula gives the tilted normal, and its turn toward the sun scales
 * the albedo. Spliced after normal_fragment_maps, outside any branch (derivatives).
 */
export const RELIEF_PARS = /* glsl */ `
vec2 dwTq = vec2(0.0);
vec2 dwReliefTq = vec2(0.0);
vec3 dwReliefBp = vec3(0.0);
`;

export const RELIEF_APPLY = /* glsl */ `
{
  vec3 dwSp = -vViewPosition;
  vec3 dwDpx = dFdx(dwSp);
  vec3 dwDpy = dFdy(dwSp);
  float dwHx = 0.012 * (dot(dwReliefTq, dFdx(dwTq)) + dot(dwReliefBp, dFdx(vBodyPos)));
  float dwHy = 0.012 * (dot(dwReliefTq, dFdy(dwTq)) + dot(dwReliefBp, dFdy(vBodyPos)));
  vec3 dwR1 = cross(dwDpy, normal);
  vec3 dwR2 = cross(normal, dwDpx);
  float dwDet = dot(dwDpx, dwR1);
  vec3 dwGrad = sign(dwDet) * (dwHx * dwR1 + dwHy * dwR2);
  vec3 dwNb = normalize(abs(dwDet) * normal - dwGrad);
  vec3 dwDn = dwNb - normal;
  vec3 dwSunR = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
  vec3 dwUpR = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float dwLitR = smoothstep(-0.15, 0.4, dot(normal, dwSunR));
  float dwDetail = 1.0 + 1.2 * dot(dwDn, dwSunR) * dwLitR + 0.35 * dot(dwDn, dwUpR);
  diffuseColor.rgb *= clamp(dwDetail, 0.72, 1.28);
}
`;

/**
 * The camera rig's kick and rim for the rider's toon material (rider/model.ts), so mount and
 * rider are lit as one subject. Spliced before opaque_fragment, after the painterly patch.
 */
export const RIDER_RIG_LIGHT = /* glsl */ `
{
  vec3 dwVv = normalize(vViewPosition);
  float dwNV = clamp(dot(normal, dwVv), 0.0, 1.0);
  float dwAlb = dot(diffuseColor.rgb, ${LUMA});
  vec3 dwHue = diffuseColor.rgb / max(0.3, dwAlb) * 0.35;
  outgoingLight += diffuseColor.rgb * uKickColor * (uKickI * smoothstep(-0.1, 0.6, dot(normal, uKickDir)));
  outgoingLight += uRimColor * dwHue * (uRimI * (1.0 - dwNV) * (1.0 - dwNV) * max(0.0, dot(normal, uRimDir)));
}
`;
