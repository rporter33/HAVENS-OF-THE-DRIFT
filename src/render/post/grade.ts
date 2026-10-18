// The one full-resolution post pass: scene + bloom → speed blur or sharpening → exposure,
// saturation, contrast, lift/gain → cloud veil, flash, vignette, fade → ACES tone map → sRGB →
// dither. It draws straight to the canvas, so three's tone mapping and output-colorspace chunks
// apply here (the scene itself renders linear HDR into a half-float target).

import { Color, DataTexture, Matrix4, RGBAFormat, ShaderMaterial, Vector2 } from 'three';
import { POST_VERTEX } from './quad';
import { SSAO_UPSAMPLE_GLSL } from './ssao';

const BLACK = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat);
BLACK.needsUpdate = true;

export function gradeUniforms() {
  return {
    tDiffuse: { value: null as unknown },
    /** Seconds, wrapped (drives the cloud veil grain and the dither pattern). */
    uTime: { value: 0 },
    uExposure: { value: 1.0 },
    uSaturation: { value: 1.08 },
    uContrast: { value: 1.04 },
    uLift: { value: new Color(0.0, 0.0, 0.0) },
    uGain: { value: new Color(1.0, 1.0, 1.0) },
    uVignette: { value: 0.32 },
    /** 0..1 radial speed blur (dives). */
    uSpeedBlur: { value: 0 },
    /** 0..1 full-screen fade to uFadeColor (respawn, transitions). */
    uFade: { value: 0 },
    uFadeColor: { value: new Color(0.92, 0.95, 1.0) },
    /** 0..1 additive flash (ring passed, collectible). */
    uFlash: { value: 0 },
    uFlashColor: { value: new Color(1.0, 0.9, 0.6) },
    /** 0..1 white-out when flying through a cloud. */
    uCloudVeil: { value: 0 },
    uCloudColor: { value: new Color(0.9, 0.93, 0.97) },
    /** The bloom chain's summed halo (half resolution) and how much of it to add. */
    tBloom: { value: BLACK as unknown },
    uBloomStrength: { value: 0 },
    /** Scene texel size, for the sharpening taps. */
    uTexel: { value: new Vector2(1, 1) },
    /** 0..1 contrast-limited sharpening, raised when the canvas is upscaled by the browser. */
    uSharpen: { value: 0 },
    /** Dither amplitude in 8-bit steps (hides banding in sky gradients and night fog). */
    uDither: { value: 1 },
    /** 1 = FXAA on the scene (quality levels without MSAA). */
    uFxaa: { value: 0 },
    /** Saturation boost weighted toward muted colors (0 = off). */
    uVibrance: { value: 0 },
    /** Screen-space AO (post/ssao.ts): half-res result, scene depth, and how much of it applies. */
    tAO: { value: BLACK as unknown },
    tDepth: { value: BLACK as unknown },
    uAOTexel: { value: new Vector2(1, 1) },
    uAOStrength: { value: 0 },
    /** Look development (render/look.ts aoDebug): show the AO alone. */
    uAODebug: { value: 0 },
    uProjInv: { value: new Matrix4() },
    uNear: { value: 0.5 },
    uFar: { value: 7000 },
  };
}

export type GradeUniforms = ReturnType<typeof gradeUniforms>;

const FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform float uTime, uExposure, uSaturation, uContrast, uVignette, uSpeedBlur, uFade, uFlash, uCloudVeil;
uniform float uBloomStrength, uSharpen, uDither, uFxaa, uVibrance;
uniform vec2 uTexel;
uniform vec3 uLift, uGain, uFadeColor, uFlashColor, uCloudColor;
varying vec2 vUv;
uniform float uAOStrength, uAODebug;
${SSAO_UPSAMPLE_GLSL}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// Interleaved gradient noise: a stable, blue-ish pattern for dithering.
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

// Unsharp mask limited to the 4-neighbourhood's range: crisper edges after upscaling, no halos.
vec3 sharpen(vec3 col, vec2 uv) {
  vec3 n = texture2D(tDiffuse, uv + vec2(0.0, uTexel.y)).rgb;
  vec3 s = texture2D(tDiffuse, uv - vec2(0.0, uTexel.y)).rgb;
  vec3 e = texture2D(tDiffuse, uv + vec2(uTexel.x, 0.0)).rgb;
  vec3 w = texture2D(tDiffuse, uv - vec2(uTexel.x, 0.0)).rgb;
  vec3 mn = min(col, min(min(n, s), min(e, w)));
  vec3 mx = max(col, max(max(n, s), max(e, w)));
  vec3 sharp = col + (col - 0.25 * (n + s + e + w)) * (2.0 * uSharpen);
  return clamp(sharp, mn, mx);
}

// FXAA for targets without MSAA: the edge-walking variant (Lottes' FXAA 3.11 quality preset, as
// written up by Catlike Coding; three's FXAAShader is the same algorithm). It only ever blends a
// pixel with its neighbour across the edge, never diagonally, so small bright lanterns and
// stars keep their shape. Luma and the final blend use compressed values (c / (1 + max(c))),
// so HDR highlights behave like display values instead of bleeding into their neighbours.
vec3 fxIn(vec3 c) { return c / (1.0 + max(c.r, max(c.g, c.b))); }
vec3 fxOut(vec3 c) { return c / max(1.0 - max(c.r, max(c.g, c.b)), 1e-3); }
float fxL(vec3 c) { return sqrt(dot(fxIn(c), vec3(0.299, 0.587, 0.114))); }
float fxLAt(vec2 uv) { return fxL(texture2D(tDiffuse, uv).rgb); }

vec3 fxaa(vec3 colM, vec2 uv) {
  vec2 t = uTexel;
  float m = fxL(colM);
  float n = fxLAt(uv + vec2(0.0, t.y));
  float e = fxLAt(uv + vec2(t.x, 0.0));
  float s = fxLAt(uv - vec2(0.0, t.y));
  float w = fxLAt(uv - vec2(t.x, 0.0));
  float hi = max(max(max(max(n, e), s), w), m);
  float lo = min(min(min(min(n, e), s), w), m);
  float contrast = hi - lo;
  // Flat areas (most of the screen) stop here.
  if (contrast < max(0.0312, 0.063 * hi)) return colM;
  float ne = fxLAt(uv + t);
  float nw = fxLAt(uv + vec2(-t.x, t.y));
  float se = fxLAt(uv + vec2(t.x, -t.y));
  float sw = fxLAt(uv - t);

  // Sub-pixel blend: how much the centre differs from its neighbourhood.
  float f = (2.0 * (n + e + s + w) + ne + nw + se + sw) / 12.0;
  f = smoothstep(0.0, 1.0, clamp(abs(f - m) / contrast, 0.0, 1.0));
  float pixelBlend = f * f;

  // Edge orientation and which side the contrast is on.
  float horizontal = abs(n + s - 2.0 * m) * 2.0 + abs(ne + se - 2.0 * e) + abs(nw + sw - 2.0 * w);
  float vertical = abs(e + w - 2.0 * m) * 2.0 + abs(ne + nw - 2.0 * n) + abs(se + sw - 2.0 * s);
  bool isH = horizontal >= vertical;
  float pL = isH ? n : e;
  float nL = isH ? s : w;
  float pG = abs(pL - m);
  float nG = abs(nL - m);
  float stepLen = isH ? t.y : t.x;
  float opposite = pL;
  float gradient = pG;
  if (pG < nG) { stepLen = -stepLen; opposite = nL; gradient = nG; }

  // Walk along the edge both ways to find its ends.
  vec2 uvEdge = uv;
  vec2 edgeStep;
  if (isH) { uvEdge.y += stepLen * 0.5; edgeStep = vec2(t.x, 0.0); }
  else { uvEdge.x += stepLen * 0.5; edgeStep = vec2(0.0, t.y); }
  float edgeL = (m + opposite) * 0.5;
  float gThreshold = gradient * 0.25;
  float steps[6] = float[6](1.0, 1.5, 2.0, 2.0, 2.0, 4.0);
  vec2 puv = uvEdge + edgeStep;
  float pDelta = fxLAt(puv) - edgeL;
  bool pEnd = abs(pDelta) >= gThreshold;
  for (int i = 1; i < 6 && !pEnd; i++) {
    puv += edgeStep * steps[i];
    pDelta = fxLAt(puv) - edgeL;
    pEnd = abs(pDelta) >= gThreshold;
  }
  if (!pEnd) puv += edgeStep * 8.0;
  vec2 nuv = uvEdge - edgeStep;
  float nDelta = fxLAt(nuv) - edgeL;
  bool nEnd = abs(nDelta) >= gThreshold;
  for (int i = 1; i < 6 && !nEnd; i++) {
    nuv -= edgeStep * steps[i];
    nDelta = fxLAt(nuv) - edgeL;
    nEnd = abs(nDelta) >= gThreshold;
  }
  if (!nEnd) nuv -= edgeStep * 8.0;
  float pDist = isH ? puv.x - uv.x : puv.y - uv.y;
  float nDist = isH ? uv.x - nuv.x : uv.y - nuv.y;
  float shortest = min(pDist, nDist);
  bool deltaSign = pDist <= nDist ? pDelta >= 0.0 : nDelta >= 0.0;
  float edgeBlend = deltaSign == (m - edgeL >= 0.0) ? 0.0 : 0.5 - shortest / (pDist + nDist);

  float blend = max(pixelBlend, edgeBlend);
  vec2 other = uv + (isH ? vec2(0.0, stepLen) : vec2(stepLen, 0.0));
  return fxOut(mix(fxIn(colM), fxIn(texture2D(tDiffuse, other).rgb), blend));
}

void main() {
  vec2 uv = vUv;
  vec3 col = texture2D(tDiffuse, uv).rgb;
  if (uSpeedBlur > 0.001) {
    vec2 dir = uv - 0.5;
    float r = length(dir);
    float amt = uSpeedBlur * smoothstep(0.12, 0.7, r) * 0.06;
    vec3 acc = col;
    for (int i = 1; i < 8; i++) {
      acc += texture2D(tDiffuse, uv - dir * amt * float(i) / 7.0).rgb;
    }
    col = acc / 8.0;
  } else if (uFxaa > 0.5) {
    col = fxaa(col, uv);
  } else if (uSharpen > 0.001) {
    col = sharpen(col, uv);
  }
  if (uAOStrength > 0.0) {
    float ao = dwAO(uv);
    col *= mix(1.0, ao, uAOStrength);
    if (uAODebug > 0.5) col = vec3(ao * 0.6);
    if (uAODebug > 1.5) col = vec3(fract(texture2D(tAO, uv).g / 20.0) * 0.6, fract(-dwViewZ(texture2D(tDepth, uv).x) / 20.0) * 0.6, 0.0);
  }
  if (uBloomStrength > 0.0) col += texture2D(tBloom, uv).rgb * uBloomStrength;
  col *= uExposure;
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, uSaturation);
  if (uVibrance != 0.0) {
    float cMax = max(col.r, max(col.g, col.b));
    float cSat = (cMax - min(col.r, min(col.g, col.b))) / max(cMax, 1e-4);
    col = max(mix(vec3(luma), col, 1.0 + uVibrance * (1.0 - cSat)), 0.0);
  }
  // Contrast around mid-grey, applied in linear HDR before tone mapping.
  col = max(col, 0.0);
  col = (col - 0.18) * uContrast + 0.18;
  col = max(col, 0.0);
  col = col * uGain + uLift * (1.0 - clamp(luma, 0.0, 1.0));
  col = mix(col, uCloudColor * (0.9 + 0.1 * hash(uv * 3.0 + uTime)), uCloudVeil);
  col += uFlashColor * uFlash;
  // Vignette.
  vec2 v = uv - 0.5;
  float vig = 1.0 - uVignette * smoothstep(0.25, 0.85, length(v * vec2(1.1, 1.0)) * 1.25);
  col *= vig;
  col = mix(col, uFadeColor, uFade);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // Triangular dither of about one 8-bit step, animated so it reads as fine grain, not a pattern.
  vec2 fc = gl_FragCoord.xy + vec2(fract(uTime * 7.0) * 61.0, fract(uTime * 3.0) * 37.0);
  float d = ign(fc) + ign(fc + vec2(17.0, 29.0)) - 1.0;
  gl_FragColor.rgb += d * uDither / 255.0;
}
`;

export function gradeMaterial(uniforms: GradeUniforms): ShaderMaterial {
  return new ShaderMaterial({
    name: 'DriftwingGrade',
    uniforms: uniforms as unknown as ShaderMaterial['uniforms'],
    vertexShader: POST_VERTEX,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
  });
}
