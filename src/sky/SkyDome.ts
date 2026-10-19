// The sky dome: a stylized, physically-inspired gradient keyed by the palette, the sun disk and
// its halo, a moon with soft glow, twinkling stars and a faint milky way at night, high cirrus
// (thickening to an overcast deck) drifting with the wind, and lightning glow in storms.
//
// The horizon is seamless by construction: above it, the sky is fogged with the same height fog
// as the world integrated to infinity; below it, the dome draws the far cloud sea with the same
// shading and fog as the real one. Both converge to the fog color at the horizon.

import {
  BackSide,
  Color,
  Matrix3,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type Scene,
  type Texture,
} from 'three';
import { readDebugParams } from '../debug/params';
import { FOG_PARS_GLSL } from '../render/painterly';
import { globalUniforms } from '../render/uniforms';
import { CLOUD_SHADE_GLSL, FAR_SEA_GLSL, NOISE_GLSL, RAMP_GLSL } from './glsl';

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + position * 1000.0, 1.0);
  gl_Position = p.xyww;
}
`;

/** A star's radius on screen in pixels (its visible core is about half of it). */
export const STAR_R_PX = 1.8;
/** Rank (0 brightest .. 1 faintest) below which a coarse-layer star glints when glints are on. */
export const STAR_GLINT_K = 0.22;
/**
 * The starfield look. 0, the default: classic, crisp round points. 1: glinting, the brightest
 * stars framed by fine sky-locked square brackets (the "little squares" the old shader drew by
 * accident on some GPUs). Anything between scales the brackets. Overridden by ?starglints=.
 */
export const STAR_GLINTS = 0;

export const DOME_FRAGMENT = /* glsl */ `
${FOG_PARS_GLSL}
${NOISE_GLSL}
${RAMP_GLSL}
${CLOUD_SHADE_GLSL}
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uHorizonSun;
uniform vec3 uSunDisk;
uniform vec3 uBeltColor;
uniform vec3 uTrueSunDir;
uniform vec3 uMoonDir;
uniform float uGlow;
uniform float uBelt;
uniform float uStars;
uniform float uMoonLight;
uniform float uCirrus;
uniform float uDeck;
uniform vec2 uCloudOffset;
uniform vec2 uWindDir;
uniform mat3 uStarRot;
uniform float uSeaY;
uniform float uSeaMean01;
uniform sampler2D uSeaTex;
uniform vec2 uScrollMacro;
${FAR_SEA_GLSL}
uniform vec3 uFlashDir;
uniform float uStarGlints;
// 0..1 how much of the boundary's cloud rampart shows on the horizon.
uniform float uRampart;
varying vec3 vDir;

const float SUN_R = 0.022;
const float MOON_R = 0.036;
/** 6/π: one over the mean of (1+u²+v²)^-1.5 over a cube face (see starLayer). */
const float STAR_AREA_NORM = ${(6 / Math.PI).toFixed(6)};
/** A star's radius on screen (px). */
const float STAR_R_PX = ${STAR_R_PX.toFixed(2)};
/** Stars brighter than this rank (0 brightest .. 1 faintest) of the coarse layer can glint. */
const float STAR_GLINT_K = ${STAR_GLINT_K.toFixed(2)};
/** The milky way's frame: the pole of its great circle, normalize(0.35, 0.25, 0.9), and two axes in its plane. */
const vec3 MW_POLE = vec3(0.350878, 0.250627, 0.902258);
const vec3 MW_E1 = vec3(-0.932005, 0.0, 0.362446);
const vec3 MW_E2 = vec3(0.090839, -0.968084, 0.233586);

vec3 skyGradient(vec3 d) {
  float h = clamp(d.y, 0.0, 1.0);
  // The horizon color holds only the lowest few degrees (the chase camera sees the sky up to about
  // 15 degrees above the horizon, and the targets keep it blue there: G3c).
  vec3 col = mix(uSkyZenith, uSkyHorizon, pow(1.0 - h, 3.4));
  // Toward the sun the low sky warms (dawn gold, sunset fire).
  vec2 dh = normalize(d.xz + vec2(1e-5, 0.0));
  vec2 sh = normalize(uTrueSunDir.xz + vec2(1e-5, 0.0));
  float az = dot(dh, sh) * 0.5 + 0.5;
  float sunUp = smoothstep(-0.28, 0.0, uTrueSunDir.y);
  float sunSide = pow(az, 2.2) * pow(1.0 - h, 2.6) * sunUp;
  col = mix(col, uHorizonSun, clamp(sunSide * uGlow, 0.0, 1.0));
  // Twilight: the Belt of Venus (pink) above the earth's shadow (deep blue) opposite the sun.
  float anti = pow(1.0 - az, 1.6);
  float belt = smoothstep(0.0, 0.07, h) * (1.0 - smoothstep(0.1, 0.34, h));
  col = mix(col, uBeltColor, anti * belt * uBelt * 0.75);
  float shade = 1.0 - smoothstep(0.0, 0.06, h);
  col = mix(col, uSkyZenith * 0.85, anti * shade * uBelt * 0.45);
  // Halo around the sun.
  float cs = max(dot(d, uTrueSunDir), 0.0);
  col += uHorizonSun * uGlow * sunUp * (pow(cs, 9.0) * 0.32 + pow(cs, 90.0) * 0.55);
  return col;
}

// Stars sit in the cells of a grid on each face of a cube around the sky. Everything a star
// needs to know about the screen comes in as jx, jy: how far the face uv moves per pixel along x
// and y, worked out exactly from the view direction's derivatives in main(). Nothing in here
// takes a derivative itself: an empty cell returns early, and derivatives after a branch like
// that are undefined (some GPUs drew each star's cell as a little square outline).
vec3 starLayer(vec2 uv, vec2 jx, vec2 jy, float face, float cells, float seed, float density, float glints) {
  vec2 g = uv * cells;
  vec2 cell = floor(g);
  vec2 f = fract(g);
  vec2 id = cell + vec2(face * 517.0 + seed, seed * 3.1);
  float h = dwHash12(id);
  // A cell near a face's rim covers less sky than one at its middle (by (1+u²+v²)^-1.5, mean π/6
  // over the face): weight the odds so stars are as dense per steradian everywhere on the cube.
  vec2 cu = (cell + 0.5) / cells;
  float w = 1.0 + dot(cu, cu);
  density *= inversesqrt(w * w * w) * STAR_AREA_NORM;
  if (h > density) return vec3(0.0);
  vec2 pos = 0.2 + 0.6 * dwHash22(id + 7.7);
  // Cells per pixel along screen x (gx) and y (gy); the star's offset in pixels solves
  // [gx gy] p = f - pos, so the star is round on screen wherever it sits on the cube.
  vec2 gx = jx * cells;
  vec2 gy = jy * cells;
  float det = gx.x * gy.y - gy.x * gx.y;
  det = abs(det) > 1e-12 ? det : 1e-12;
  vec2 o = f - pos;
  vec2 p = vec2(gy.y * o.x - gy.x * o.y, gx.x * o.y - gx.y * o.x) / det;
  float dist = length(p);
  // A crisp point of the same few pixels at any resolution, FOV or face; zoomed right in (photo
  // mode) it grows with the sky, as a few hundredths of its cell.
  float r = max(STAR_R_PX, 0.03 * inversesqrt(abs(det)));
  float core = smoothstep(r, 0.0, dist);
  core *= core;
  // Magnitudes: a handful of bright stars, a crowd of faint ones.
  float k = h / density;
  float bright = 0.12 + 2.6 * pow(1.0 - k, 7.0);
  // Faint stars twinkle harder (the eye catches them flickering in and out).
  float tw = 1.0 - (0.25 + 0.45 * k) * (0.5 + 0.5 * sin(uTime * (1.3 + 3.5 * fract(h * 91.7)) + h * 40.0));
  vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.86, 0.7), fract(h * 53.3));
  float lum = core * bright * tw;
  // Optional glints (uStarGlints): the brightest stars' own cells drawn as fine, sky-locked
  // square brackets, broken into dashes that are re-dealt as the star twinkles: the look of the
  // old derivative bug, on purpose and the same on every GPU.
  if (glints > 0.0 && k < STAR_GLINT_K) {
    // Pixels across one cell along its u and v.
    float pxU = 1.0 / max(length(vec2(gx.x, gy.x)), 1e-6);
    float pxV = 1.0 / max(length(vec2(gx.y, gy.y)), 1e-6);
    float ex = min(f.x, 1.0 - f.x) * pxU;
    float ey = min(f.y, 1.0 - f.y) * pxV;
    float ring = 1.0 - smoothstep(0.35, 1.0, min(ex, ey));
    // Which side the pixel is on, and four segments along it: the end ones make the corner
    // brackets (nearly always lit), the middle ones come and go.
    bool vert = ex < ey;
    float side = vert ? step(0.5, f.x) : 2.0 + step(0.5, f.y);
    float seg = floor((vert ? f.y : f.x) * 4.0);
    float beat = floor(uTime * (0.6 + 1.2 * fract(h * 17.3)) + h * 9.0);
    float deal = dwHash12(id * 1.37 + vec2(side * 4.0 + seg, beat));
    float corner = seg < 0.5 || seg > 2.5 ? 1.0 : 0.0;
    ring *= step(mix(0.55, 0.15, corner), deal);
    float glint = smoothstep(STAR_GLINT_K, STAR_GLINT_K * 0.4, k) * tw * tw;
    lum += ring * glint * glints * 0.8 * bright / (0.6 + bright);
  }
  return tint * lum;
}

vec3 stars(vec3 d, vec3 dDx, vec3 dDy) {
  vec3 s = uStarRot * d;
  vec3 sx = uStarRot * dDx;
  vec3 sy = uStarRot * dDy;
  vec3 a = abs(s);
  vec2 uv;
  vec2 jx;
  vec2 jy;
  float face;
  // The face, its uv (the direction divided by its major axis) and the uv's exact screen-space
  // derivative (quotient rule): a pixel's worth of uv on both sides of a seam, where a finite
  // difference (fwidth) straddles two faces' coordinates and jumps by a whole face.
  if (a.x > a.y && a.x > a.z) {
    uv = s.yz / a.x;
    face = s.x > 0.0 ? 0.0 : 1.0;
    float m = sign(s.x);
    jx = (sx.yz - uv * m * sx.x) / a.x;
    jy = (sy.yz - uv * m * sy.x) / a.x;
  } else if (a.y > a.z) {
    uv = s.xz / a.y;
    face = s.y > 0.0 ? 2.0 : 3.0;
    float m = sign(s.y);
    jx = (sx.xz - uv * m * sx.y) / a.y;
    jy = (sy.xz - uv * m * sy.y) / a.y;
  } else {
    uv = s.xy / a.z;
    face = s.z > 0.0 ? 4.0 : 5.0;
    float m = sign(s.z);
    jx = (sx.xy - uv * m * sx.z) / a.z;
    jy = (sy.xy - uv * m * sy.z) / a.z;
  }
  // The milky way: a soft clumpy band along a tilted great circle. Its noise is laid out in the
  // band's own frame, the way around the circle times a radius that grows across the band (an
  // annulus in noise space): one continuous sheet, with no cube seam to cut it.
  float band = dot(s, MW_POLE);
  float mw = exp(-band * band / 0.035);
  vec3 col = vec3(0.0);
  if (mw > 0.004) {
    vec2 around = vec2(dot(s, MW_E1), dot(s, MW_E2)) * inversesqrt(max(1.0 - band * band, 1e-4));
    vec2 q = around * (4.0 + 3.0 * band);
    float clumps = dwFbm5(q + vec2(13.0, 5.0));
    float dust = smoothstep(0.45, 0.75, dwFbm3(q * 2.25 - vec2(5.0, 11.0)));
    col = vec3(0.30, 0.34, 0.58) * mw * (0.2 + 0.8 * clumps) * (1.0 - 0.65 * dust) * 0.38;
  }
  col += starLayer(uv, jx, jy, face, 55.0, 1.0, 0.035 + 0.05 * mw, uStarGlints);
  col += starLayer(uv, jx, jy, face, 140.0, 2.0, 0.012 + 0.07 * mw, 0.0) * 0.5;
  return col;
}

// cm, ang: the cosine of and angle to the moon; aa: the disk's edge width (from main()).
vec3 moon(vec3 d, float cm, float ang, float aa, inout vec3 col) {
  if (cm < 0.0) return vec3(0.0);
  // The face (and its noise) only where the disk is: most of the sky pays for the glow alone.
  if (ang < MOON_R * 1.6) {
    float disk = smoothstep(MOON_R + aa, MOON_R - aa, ang);
    vec3 right = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)) + vec3(1e-5, 0.0, 0.0));
    vec3 up = cross(right, uMoonDir);
    vec2 mp = vec2(dot(d, right), dot(d, up)) / MOON_R;
    float maria = dwFbm3(mp * 1.6 + vec2(3.1, 7.4));
    float limb = sqrt(max(0.0, 1.0 - dot(mp, mp)));
    vec3 face = vec3(0.92, 0.95, 1.0) * mix(0.62, 1.0, smoothstep(0.36, 0.6, maria)) * (0.7 + 0.3 * limb);
    // Seen in daylight the moon is a pale wash; at night it is the brightest thing in the sky,
    // but kept below the bloom threshold's blow-out so its face still reads.
    col = mix(col, face * mix(0.42, 0.62, uMoonLight), disk * mix(0.25, 1.0, uMoonLight));
  }
  vec3 glow = vec3(0.55, 0.65, 1.0) * (pow(cm, 2500.0) * 0.25 + pow(cm, 60.0) * 0.1 + pow(cm, 6.0) * 0.05);
  return glow * uMoonLight;
}

vec4 highClouds(vec3 d) {
  if (d.y <= 0.0) return vec4(0.0);
  // The +0.35 keeps the projection from crushing fibres into a vanishing point on the horizon
  // (they read as searchlight beams at night).
  vec2 p = d.xz / (d.y + 0.35);
  vec2 w = uWindDir;
  vec2 q = vec2(dot(p, w), dot(p, vec2(-w.y, w.x)));
  // Cirrus: patches of fine fibres combed along the wind, with gentle bends.
  vec2 cq = q * vec2(0.96, 2.9) + vec2(uCloudOffset.x * 1.6, 0.0);
  cq.y += 0.45 * dwVnoise(cq * vec2(0.35, 0.5) + 3.0);
  float n = dwFbm5(cq * 0.7);
  float fibre = dwFbm3(vec2(cq.x * 0.9, cq.y * 6.5) + 11.0);
  float sheet = smoothstep(0.5 - 0.22 * uCirrus, 0.78 - 0.12 * uCirrus, n);
  // Break the fibres into separate patches so no streak runs unbroken across the sky.
  float patches = smoothstep(0.3, 0.62, dwVnoise(q * 1.3 + vec2(7.0, 2.0)));
  float wisp = sheet * patches * mix(0.35, 1.0, smoothstep(0.3, 0.75, fibre)) * (0.22 + 0.68 * uCirrus);
  // At night the wisps are barely there: a faint veil, not pale rays on a dark sky.
  wisp *= 1.0 - 0.75 * uStars;
  // Overcast deck: broad billows that close up as cover rises.
  float cover = 0.0;
  float m = 0.0;
  if (uDeck > 0.001) {
    vec2 dq = q * 0.55 + vec2(uCloudOffset.x * 0.5, 4.0);
    m = dwFbm5(dq);
    cover = smoothstep(1.02 - uDeck, 1.25 - uDeck * 0.95, m + 0.12 * n) * smoothstep(0.0, 0.25, uDeck);
  }
  // Wisps thin out toward the horizon; a closed deck runs right down to it.
  float a = max(wisp * 0.8 * smoothstep(0.04, 0.3, d.y), cover * smoothstep(-0.02, 0.08, d.y));
  float cs = max(dot(d, uTrueSunDir), 0.0);
  float sunUp = smoothstep(-0.25, 0.02, uTrueSunDir.y);
  vec3 lit = mix(uCloudShade, uCloudLit, 0.55 + 0.45 * smoothstep(0.4, 0.9, n));
  lit = mix(lit, uCloudShade * 1.15, 0.6 * uStars);
  // Wisps near the sun catch its fire; at twilight they stay lit after the ground goes dark.
  lit += uHorizonSun * (pow(cs, 5.0) * 0.9 + 0.25 * (1.0 - d.y)) * uGlow * sunUp;
  // The deck's underside is darker where it is thickest.
  lit = mix(lit, uCloudShade * 0.95, cover * smoothstep(0.55, 1.0, m) * uDeck * 0.8);
  return vec4(lit, clamp(a, 0.0, 1.0));
}

// The world's edge (G3c, Q40): seen from inside the Drift, the boundary is a rampart of stacked
// cumulus banks all round the horizon, three tiers deep (the farthest tallest and most hazed), so
// every island sees where the Drift ends. The storm wall itself (BoundaryWall.ts) takes over as
// a flyer comes within 2 km of it. Heads on heads along the crown (cauliflower), lit from the
// top down, warm on the sun's side.
float rpHash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
// Rounded heads along the horizon: u 0..1 around it, cells domes, each jittered in place,
// width and height (periodic, so there is no seam behind you). Returns the crown height and,
// in side, where across its head the point is (-1 left edge .. 1 right edge).
float rpHeads(float u, float cells, float seed, out float side) {
  float x = u * cells;
  float i = floor(x);
  float h = 0.0;
  side = 0.0;
  for (int k = -1; k <= 1; k++) {
    float j = i + float(k);
    float jw = mod(j, cells);
    float c = j + 0.25 + 0.5 * rpHash(jw + seed);
    float r = 0.6 + 0.7 * rpHash(jw + seed + 17.0);
    float amp = 0.35 + 0.65 * rpHash(jw + seed + 31.0);
    float q = (x - c) / r;
    float hk = amp * sqrt(max(0.0, 1.0 - q * q));
    if (hk > h) { h = hk; side = q; }
  }
  return h;
}
vec4 rampLayer(vec3 d, float u, float base, float amp, float cells, float seed, float sunSide) {
  float sBig, sSmall;
  float big = rpHeads(u, cells, seed, sBig);
  float small = rpHeads(u, cells * 3.3, seed + 5.0, sSmall);
  float crown = base + amp * (0.8 * big + 0.32 * small * big);
  float a = 1.0 - smoothstep(crown - 0.003, crown + 0.0012, d.y);
  // Lit from the top down and from the sun's side of each head: crowns in the sun's color,
  // flanks and the foot in the cloud shade.
  float t = clamp(d.y / max(crown, 1e-3), 0.0, 1.0);
  float lit = smoothstep(0.2, 1.0, t) * (0.72 + 0.28 * small);
  lit = clamp(lit + 0.3 * (sBig * 0.7 + sSmall * 0.3) * sunSide * smoothstep(0.1, 0.6, t), 0.0, 1.0);
  // Billows inside the bank (folds a little darker than the bulges).
  float puff = dwFbm3(vec2(u * cells * 9.0, d.y * 260.0) + seed);
  lit *= 0.82 + 0.3 * puff;
  vec2 sh = normalize(uTrueSunDir.xz + vec2(1e-5, 0.0));
  float toward = pow(max(dot(normalize(d.xz + vec2(1e-5, 0.0)), sh), 0.0), 2.0) * smoothstep(-0.1, 0.2, uTrueSunDir.y);
  vec3 col = mix(uCloudShade * 0.66, uCloudLit * 1.04, lit);
  col += uHorizonSun * toward * uGlow * 0.25 * lit;
  return vec4(col, a);
}

vec4 rampart(vec3 d) {
  if (d.y > 0.14 || uRampart <= 0.001) return vec4(0.0);
  float az = atan(d.z, d.x);
  float u = az / 6.2831853 + 0.5;
  // Which side of a head faces the sun (+1: the right-hand side as seen from here).
  float sunAz = atan(uTrueSunDir.z, uTrueSunDir.x);
  float sunSide = -sin(sunAz - az);
  vec4 far = rampLayer(d, u, 0.026, 0.085, 46.0, 3.0, sunSide);
  vec4 mid = rampLayer(d, u, 0.011, 0.052, 71.0, 11.0, sunSide);
  vec4 near = rampLayer(d, u, 0.002, 0.036, 109.0, 23.0, sunSide);
  vec3 fogC = mix(uFogColor, uFogSunColor, pow(max(dot(d, uSunDir), 0.0), 6.0) * (1.0 - 0.7 * uNight));
  vec3 col = mix(far.rgb, fogC, 0.48);
  float a = far.a;
  col = mix(col, mix(mid.rgb, fogC, 0.32), mid.a);
  a = max(a, mid.a);
  col = mix(col, mix(near.rgb, fogC, 0.2), near.a);
  a = max(a, near.a);
  // The foot sinks into the haze over the far cloud sea: no hard line at the horizon.
  col = mix(fogC, col, smoothstep(0.0, 0.012, d.y));
  return vec4(col, a * uRampart);
}

vec3 haze(vec3 col, vec3 d) {
  // The world's height fog, integrated to infinity along the view ray: matches dwApplyFog.
  float b = uFogHeightFalloff;
  float a = uFogDensity * exp(-max(cameraPosition.y - uFogBaseY, 0.0) * b);
  float ry = max(d.y, 1e-4);
  float fog = 1.0 - exp(-a / (ry * b));
  float sunAmt = max(dot(d, uSunDir), 0.0);
  vec3 fogCol = mix(uFogColor, uFogSunColor, pow(sunAmt, 6.0) * (1.0 - 0.7 * uNight));
  return mix(col, fogCol, fog);
}

void main() {
  vec3 d = normalize(vDir);
  // Every screen-space derivative is taken here, before anything branches: inside a branch some
  // pixels of a 2x2 quad may have left, and what a GPU reads from them is undefined.
  vec3 dDx = dFdx(d);
  vec3 dDy = dFdy(d);
  float sunAng = acos(clamp(dot(d, uTrueSunDir), -1.0, 1.0));
  float sunAA = fwidth(sunAng) * 1.5 + 1e-5;
  float moonCos = dot(d, uMoonDir);
  float moonAng = acos(clamp(moonCos, -1.0, 1.0));
  float moonAA = fwidth(moonAng) * 1.5 + 1e-5;
  vec3 col;
  if (d.y >= 0.0) {
    col = skyGradient(d);
    vec4 hc = highClouds(d);
    // Stars only cost anything once they are out.
    if (uStars > 0.003) col += stars(d, dDx, dDy) * uStars * (1.0 - hc.a);
    vec3 moonGlow = moon(d, moonCos, moonAng, moonAA, col);
    col = mix(col, hc.rgb, hc.a);
    col += moonGlow * (1.0 - 0.7 * hc.a);
    col = haze(col, d);
    vec4 rp = rampart(d);
    col = mix(col, rp.rgb, rp.a);
    // The sun disk punches through the haze (reddened by the palette) but not the deck, and it
    // sets behind the boundary's cloud banks.
    float disk = smoothstep(SUN_R + sunAA, SUN_R - sunAA, sunAng);
    float low = mix(0.45, 1.0, smoothstep(0.0, 0.15, d.y));
    col += uSunDisk * disk * 9.0 * low * (1.0 - hc.a * 0.92) * (1.0 - rp.a);
  } else {
    // Below the horizon: the far cloud sea, flat-shaded like the mipmapped real one.
    float t = (uSeaY - cameraPosition.y) / d.y;
    if (t > 0.0) {
      vec3 hit = cameraPosition + d * min(t, 1e6);
      col = dwFarSea(hit, d) + dwFlashGlow(hit);
      col = dwApplyFog(col, hit, cameraPosition);
    } else {
      col = mix(uFogColor, uCloudShade, 0.4);
    }
  }
  // Distant lightning lights the sky around the strike.
  float fl = max(dot(d, uFlashDir), 0.0);
  col += vec3(0.7, 0.75, 1.0) * uFlash * (pow(fl, 10.0) * 1.4 + pow(fl, 2.0) * 0.12 + 0.03);
  gl_FragColor = vec4(col, 1.0);
}
`;

export interface DomeUniforms {
  uHorizonSun: { value: Color };
  uSunDisk: { value: Color };
  uBeltColor: { value: Color };
  uTrueSunDir: { value: Vector3 };
  uMoonDir: { value: Vector3 };
  uGlow: { value: number };
  uBelt: { value: number };
  uStars: { value: number };
  uMoonLight: { value: number };
  uCirrus: { value: number };
  uDeck: { value: number };
  uCloudOffset: { value: Vector2 };
  uWindDir: { value: Vector2 };
  uStarRot: { value: Matrix3 };
  uSeaY: { value: number };
  uSeaMean01: { value: number };
  uSeaTex: { value: Texture };
  uScrollMacro: { value: Vector2 };
  uFlashDir: { value: Vector3 };
  /** 0 classic stars .. 1 glinting (see STAR_GLINTS). */
  uStarGlints: { value: number };
  /** 0..1 the boundary's cloud rampart on the horizon (G3c). */
  uRampart: { value: number };
  uCloudLit: { value: Color };
  uCloudShade: { value: Color };
  uFlashPos: { value: Vector3 };
  uFlash: { value: number };
  uCloudDirect: { value: number };
}

export class SkyDome {
  readonly mesh: Mesh;
  readonly uniforms: DomeUniforms;

  /** Cloud uniforms are shared with the cloud sea so both shade identically. */
  constructor(
    scene: Scene,
    shared: Pick<DomeUniforms, 'uCloudLit' | 'uCloudShade' | 'uFlashPos' | 'uFlash' | 'uCloudDirect' | 'uSeaTex' | 'uScrollMacro' | 'uSeaMean01'>,
  ) {
    this.uniforms = {
      uHorizonSun: { value: new Color() },
      uSunDisk: { value: new Color() },
      uBeltColor: { value: new Color() },
      uTrueSunDir: { value: new Vector3(0, 1, 0) },
      uMoonDir: { value: new Vector3(0, -1, 0) },
      uGlow: { value: 0 },
      uBelt: { value: 0 },
      uStars: { value: 0 },
      uMoonLight: { value: 0 },
      uCirrus: { value: 0.3 },
      uDeck: { value: 0 },
      uCloudOffset: { value: new Vector2() },
      uWindDir: { value: new Vector2(1, 0) },
      uStarRot: { value: new Matrix3() },
      uSeaY: { value: 0 },
      uFlashDir: { value: new Vector3(1, 0, 0) },
      uStarGlints: { value: readDebugParams().starGlints ?? STAR_GLINTS },
      uRampart: { value: 1 },
      ...shared,
    };
    const material = new ShaderMaterial({
      name: 'DriftwingSkyDome',
      side: BackSide,
      depthWrite: false,
      depthTest: true,
      uniforms: { ...globalUniforms, ...this.uniforms },
      vertexShader: VERTEX,
      fragmentShader: DOME_FRAGMENT,
    });
    this.mesh = new Mesh(new SphereGeometry(1, 64, 32), material);
    this.mesh.name = 'skyDome';
    this.mesh.frustumCulled = false;
    // Drawn after every opaque object: the dome sits on the far plane, so wherever an island or
    // the cloud sea already covers the pixel the depth test rejects it before it is shaded.
    this.mesh.renderOrder = 100;
    scene.add(this.mesh);
  }
}
