import { SEA_MACRO_TILE } from './cloudTextures';

// GLSL shared by the sky's shaders: cheap hash noise, the painterly light ramp, and the cloud
// shading model used by both the cloud sea and the sky dome's far-field sea (so the two meet at
// the horizon without a seam).

/** Hash + value noise + fbm. Inputs should stay within a few thousand units for precision. */
export const NOISE_GLSL = /* glsl */ `
float dwHash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 dwHash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float dwVnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = dwHash12(i);
  float b = dwHash12(i + vec2(1.0, 0.0));
  float c = dwHash12(i + vec2(0.0, 1.0));
  float d = dwHash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// Rotating each octave hides the value-noise grid.
const mat2 DW_OCT = mat2(1.6, 1.2, -1.2, 1.6);
float dwFbm3(vec2 p) {
  float s = 0.5 * dwVnoise(p); p = DW_OCT * p;
  s += 0.25 * dwVnoise(p); p = DW_OCT * p;
  s += 0.125 * dwVnoise(p);
  return s / 0.875;
}
float dwFbm5(vec2 p) {
  float s = 0.5 * dwVnoise(p); p = DW_OCT * p;
  s += 0.25 * dwVnoise(p); p = DW_OCT * p;
  s += 0.125 * dwVnoise(p); p = DW_OCT * p;
  s += 0.0625 * dwVnoise(p); p = DW_OCT * p;
  s += 0.03125 * dwVnoise(p);
  return s / 0.96875;
}
`;

/**
 * The painterly light ramp: the same four soft bands as the shared toon ramp
 * (render/painterly.ts), with adjustable softness so clouds read as brushwork.
 */
export const RAMP_GLSL = /* glsl */ `
float dwSoftRamp(float x, float w) {
  float v = 0.32;
  v += 0.23 * smoothstep(0.25 - w, 0.25 + w, x);
  v += 0.25 * smoothstep(0.5 - w, 0.5 + w, x);
  v += 0.20 * smoothstep(0.75 - w, 0.75 + w, x);
  return v;
}
`;

/**
 * Cloud-top shading shared by the cloud sea and the dome's far field. Needs uSunDir and
 * uSunColor (from FOG_PARS_GLSL) plus the cloud uniforms declared here.
 */
export const CLOUD_SHADE_GLSL = /* glsl */ `
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform vec3 uFlashPos;
uniform float uFlash;
// 0..1 share of the light that is direct sun (or moon): an overcast lid turns it into soft,
// even skylight and the clouds lose their modelling.
uniform float uCloudDirect;

// Painter's cheat: cloud forms are shaded by a key light no higher than ~33°, so midday billows
// keep their modelling instead of going flat white under a high sun.
vec3 dwCloudLightDir() {
  vec3 L = uSunDir;
  float h = length(L.xz);
  if (L.y > 0.55 && h > 1e-3) L = vec3(L.x / h * 0.835, 0.55, L.z / h * 0.835);
  return L;
}

// n: surface normal, h01: height within the cloud layer (0 deep trough .. 1 crest),
// cavity: local convexity (-: crevice, +: bulge), shadow: 0..1 sun visibility, rd: view direction.
vec3 dwCloudShade(vec3 n, float h01, float cavity, float shadow, vec3 rd) {
  vec3 L = dwCloudLightDir();
  float ndl = dot(n, L);
  // Clouds scatter: wrap the light past the terminator, then band it softly like brushwork.
  // (G3c: less wrap and a darker floor than before, so flanks turned from the sun and the
  // crevices between heads go a clear cool blue-grey, as in the target renders.)
  float wrap = clamp(ndl * 0.62 + 0.24, 0.0, 1.0);
  float band = mix(0.06, 1.0, (dwSoftRamp(wrap, 0.13) - 0.32) / 0.68);
  float ao = mix(0.36, 1.0, smoothstep(0.05, 0.85, h01)) * clamp(1.0 + cavity * 2.2, 0.38, 1.15);
  // Skylight reaches the tops; flanks and crevices see less of it. Under a grey lid the sky is
  // the light, so it brightens as the direct share falls.
  float sky = ao * (0.55 + 0.45 * max(n.y, 0.0));
  float direct = band * shadow * uCloudDirect * mix(0.62, 1.0, h01) * clamp(1.0 + cavity, 0.55, 1.1);
  // The sunlit tops take the sun's color, not the sky's: the blue skylight gives way where the
  // direct light is strong (G3c: tops warm, hollows cool).
  vec3 col = uCloudShade * sky * (1.0 + 0.5 * (1.0 - uCloudDirect)) * (1.0 - 0.5 * direct);
  col += uCloudLit * sky * (1.0 - uCloudDirect) * 0.45;
  col += (uCloudLit - uCloudShade * 0.2) * direct * 1.3;
  // Silver lining: looking toward the light, the thin silhouettes of crests glow.
  float toward = pow(max(dot(rd, uSunDir), 0.0), 6.0);
  float rim = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 2.5);
  col += uCloudLit * toward * (0.1 + 1.4 * rim) * shadow * uCloudDirect;
  return col;
}

// Lightning lighting a cloud field from inside: a broad glow around the strike.
vec3 dwFlashGlow(vec3 p) {
  if (uFlash <= 0.001) return vec3(0.0);
  float d = length(p.xz - uFlashPos.xz);
  return vec3(0.75, 0.8, 1.0) * uFlash * (1.6 * exp(-d / 700.0) + 0.12 * exp(-d / 3500.0));
}
`;

/**
 * The cloud sea too far away for its billows to resolve: flat-lit tops whose brightness follows
 * the big swell. The marched sea fades into this with distance and the dome's far field draws
 * exactly this, so the two meet at the far plane without a seam at any draw distance.
 * Needs CLOUD_SHADE_GLSL plus uSeaTex, uScrollMacro and uSeaMean01.
 */
export const FAR_SEA_GLSL = /* glsl */ `
vec3 dwFarSea(vec3 hit, vec3 rd) {
  float swell = textureLod(uSeaTex, hit.xz / ${SEA_MACRO_TILE.toFixed(1)} + uScrollMacro, 2.0).g;
  float h01 = mix(uSeaMean01 * 0.8, min(1.0, uSeaMean01 * 1.25), swell);
  return dwCloudShade(vec3(0.0, 1.0, 0.0), h01, 0.0, 0.88, rd);
}
`;
