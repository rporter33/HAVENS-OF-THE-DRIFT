// The ground-cover shader: a MeshToonMaterial (so grass takes the same sun, sky light, shadows,
// rim and fog as everything else) whose vertex stage builds each blade from instance data:
//
//   - root-to-tip curvature, lean and per-tuft yaw,
//   - wind: a rolling wave front across the meadow plus per-blade flicker (uWind / uGust / uTime),
//   - trampling: blades bend away from the rider (uPlayerPos) and the wyvern,
//   - distance LOD: instances thin out smoothly by rank and the survivors widen to keep coverage,
//     then everything shrinks away at the edge of the grass radius,
//   - lighting normal = terrain normal nudged by the blade's bend, so wind waves show as moving
//     light across the field.
// The fragment stage adds root shading, backlit translucency and (flowers) a night glow.

import { Color, DoubleSide, MeshToonMaterial, Vector4 } from 'three';
import { LOOK } from '../../../render/look';
import { applyPainterly, toonRamp } from '../../../render/painterly';
import { SWAY_GLSL } from '../materials';

export interface FieldUniforms {
  uDwRadius: { value: number };
  /** Second trampler (the wyvern): xyz + radius. */
  uDwBend: { value: Vector4 };
}

const COMMON_VERTEX = /* glsl */ `
uniform float uTime;
uniform vec3 uWind;
uniform float uGust;
uniform vec3 uPlayerPos;
uniform float uDwRadius;
uniform vec4 uDwBend;
attribute vec4 aPos;
attribute vec4 aShape;
attribute vec4 aBase;
attribute vec4 aTip;
varying float vDwT;
varying float vDwGlow;
${SWAY_GLSL}

vec3 dwSrgb(vec3 c) { return pow(c, vec3(2.2)); }

// Fraction of instances kept at a distance (mirrors keepFraction() in fieldChunk.ts).
float dwKeep(float d) { return clamp(pow(16.0 / max(d, 1.0), 1.15), 0.07, 1.0); }

// Unit push away from a trampler, fading with horizontal and vertical distance.
vec2 dwPush(vec3 root, vec3 c, float r) {
  vec2 a = root.xz - c.xz;
  float d = length(a);
  float k = (1.0 - smoothstep(r * 0.25, r, d)) * (1.0 - smoothstep(r * 0.6, r * 1.6, abs(root.y - c.y)));
  return d > 1e-3 ? a / d * k : vec2(0.0);
}

vec2 dwWindBend(vec3 root, float seed) {
  vec2 wd = dwWindDir();
  float ws = dwWindStrength();
  // A broad wave rolling downwind plus a slower cross-wave, so gusts sweep the meadow.
  float wave = sin(dot(root.xz, wd) * 0.17 - uTime * 2.2) * 0.5 + 0.5;
  wave = wave * wave;
  float cross = sin(dot(root.xz, vec2(-wd.y, wd.x)) * 0.05 + uTime * 0.7) * 0.5 + 0.5;
  float flick = sin(uTime * 4.7 + seed * 37.0 + dot(root.xz, vec2(1.3, 1.7))) * 0.07;
  return wd * (0.1 + (0.45 * wave + 0.15 * cross) * (0.6 + uGust)) * ws * 0.75 + vec2(-wd.y, wd.x) * flick;
}
`;

const GRASS_VERTEX_PARS = /* glsl */ `
${COMMON_VERTEX}
attribute vec4 aBlade;
vec3 dwPos;
`;

// Runs in place of <beginnormal_vertex> (first in main), computing position and normal together.
const GRASS_BUILD = /* glsl */ `
vec3 objectNormal;
{
  float t = position.y;
  float yaw = aPos.w;
  float cy = cos(yaw);
  float sy = sin(yaw);
  vec2 rootOff = vec2(cy * position.x - sy * position.z, sy * position.x + cy * position.z) * aShape.y;
  vec3 root = vec3(aPos.x + rootOff.x, aPos.y - 0.05, aPos.z + rootOff.y);
  float dist = distance(root, cameraPosition);
  float keep = dwKeep(dist);
  float vis = clamp((keep * 1.25 - aShape.z) / max(keep * 0.25, 0.004), 0.0, 1.0);
  float edge = 1.0 - smoothstep(uDwRadius * 0.78, uDwRadius, dist);
  float H = aShape.x * aBlade.y * vis * edge;
  float widen = mix(1.0, 2.8, smoothstep(10.0, uDwRadius * 0.9, dist));
  float heatherW = step(1.0, aShape.w);
  // Heather sprigs keep their width up to rounded tips; grass blades taper to a point.
  float W = aBlade.w * aShape.y * widen * (1.0 - pow(t, 1.5) * mix(0.92, 0.4, heatherW));
  float ba = aBlade.z + yaw;
  vec2 across = vec2(cos(ba), sin(ba));
  vec2 facing = vec2(-across.y, across.x);
  vec2 outward = dot(rootOff, rootOff) > 1e-8 ? normalize(rootOff) : facing;
  float heather = step(1.0, aShape.w);
  float seed = fract(aShape.w);
  // Heather splays into a low, rounded clump; grass arcs outward.
  vec2 disp = outward * mix((0.16 + 0.42 * seed) * t * t, (0.34 + 0.2 * seed) * t, heather);
  disp += dwWindBend(root, seed) * t * t * (1.0 - 0.6 * heather);
  disp += dwPush(root, uPlayerPos + vec3(0.0, 0.6, 0.0), 1.5) * 1.15 * t;
  disp += dwPush(root, uDwBend.xyz, uDwBend.w) * 1.3 * t;
  float dl = length(disp);
  if (dl > 0.92) disp *= 0.92 / dl;
  float up = t * sqrt(max(1.0 - dot(disp, disp), 0.08));
  dwPos = root + vec3(disp.x * H, up * H, disp.y * H) + vec3(across.x, 0.0, across.y) * aBlade.x * W * 0.5;

  vec3 tn = vec3(aBase.w * 2.0 - 1.0, 0.0, aTip.w * 2.0 - 1.0);
  tn.y = sqrt(max(0.0, 1.0 - dot(tn.xz, tn.xz)));
  objectNormal = normalize(tn + vec3(disp.x, 0.0, disp.y) * 0.9 + vec3(facing.x, 0.0, facing.y) * 0.22 * aBlade.x);
  vDwT = t;
  vDwGlow = 0.0;
}
`;

const FLOWER_VERTEX_PARS = /* glsl */ `
${COMMON_VERTEX}
attribute vec4 aFl;
vec3 dwPos;
`;

const FLOWER_BUILD = /* glsl */ `
vec3 objectNormal;
{
  float yaw = aPos.w;
  float cy = cos(yaw);
  float sy = sin(yaw);
  vec3 root = aPos.xyz;
  float dist = distance(root, cameraPosition);
  float keep = dwKeep(dist * 0.75);
  float vis = clamp((keep * 1.25 - aShape.z) / max(keep * 0.25, 0.004), 0.0, 1.0);
  float edge = 1.0 - smoothstep(uDwRadius * 0.78, uDwRadius, dist);
  float k = vis * edge;
  float grow = mix(1.0, 1.7, smoothstep(10.0, uDwRadius * 0.9, dist));
  vec2 lxz = vec2(cy * position.x - sy * position.z, sy * position.x + cy * position.z) * aShape.y;
  // Heads grow with distance (stems don't) so drifts keep reading as dabs of color far away.
  float headK = aFl.x > 0.5 ? grow : 1.0;
  float H = aShape.x;
  vec3 p = vec3(lxz.x, position.y * H, lxz.y);
  float w = aFl.y;
  vec2 disp = dwWindBend(root, aFl.w + aShape.w) * w * w * 0.8;
  disp += dwPush(root, uPlayerPos + vec3(0.0, 0.6, 0.0), 1.5) * 1.1 * w;
  disp += dwPush(root, uDwBend.xyz, uDwBend.w) * 1.2 * w;
  float dl = length(disp);
  if (dl > 0.9) disp *= 0.9 / dl;
  p.xz += disp * H;
  p.y -= dot(disp, disp) * H * 0.5;
  if (aFl.x > 0.5) {
    // Scale the head around its own center (approximated by the stem top above the root).
    vec3 headC = vec3(lxz.x, aFl.y * H, lxz.y);
    headC.xz += disp * H;
    p = headC + (p - headC) * headK;
  }
  dwPos = root + p * k;
  vec3 n = vec3(cy * normal.x - sy * normal.z, normal.y, sy * normal.x + cy * normal.z);
  objectNormal = normalize(n + vec3(disp.x, 0.0, disp.y));
  vDwT = 0.35 + 0.65 * aFl.y;
  vDwGlow = aFl.x > 0.5 ? aBase.w : 0.0;
}
`;

const GRASS_COLOR = /* glsl */ `
vColor = vec4(1.0);
{
  float t = position.y;
  vec3 b = dwSrgb(aBase.rgb);
  vec3 tp = dwSrgb(aTip.rgb);
  // Heather: brownish sprigs blooming over their upper half, soft and light at the tips.
  float hz = step(1.0, aShape.w);
  vColor.rgb = mix(b, tp, mix(smoothstep(0.0, 0.95, t), smoothstep(0.25, 0.75, t), hz)) * mix(0.72 + 0.28 * t, 0.82 + 0.25 * t, hz);
}
`;

const FLOWER_COLOR = /* glsl */ `
vColor = vec4(1.0);
{
  vec3 stem = dwSrgb(aBase.rgb);
  vec3 petal = dwSrgb(aTip.rgb) * (0.7 + 0.2 * aTip.a);
  if (aFl.x < 0.5) vColor.rgb = stem * (0.55 + 0.45 * aFl.y);
  else if (aFl.x < 1.5) vColor.rgb = mix(petal * 1.08, petal * 0.78, aFl.z);
  else vColor.rgb = mix(petal, dwSrgb(vec3(1.0, 0.82, 0.35)), 0.65);
}
`;

const FRAGMENT_PARS = /* glsl */ `
varying float vDwT;
varying float vDwGlow;
`;

const FRAGMENT_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
{
  // Far blades are thinner than a pixel; with MSAA their varyings get extrapolated outside the
  // triangle (no centroid sampling), which would flash single white/black pixels. Clamp them.
  float vDwT = clamp(vDwT, 0.0, 1.0);
  float vDwGlow = clamp(vDwGlow, 0.0, 1.0);
  // Backlit blades glow with the sun behind them (golden-hour rim on the meadow).
  vec3 dwV = normalize(vDwWorldPos - cameraPosition);
  float dwBack = pow(max(dot(dwV, uSunDir), 0.0), 4.0) * smoothstep(-0.05, 0.15, uSunDir.y);
  totalEmissiveRadiance += diffuseColor.rgb * uSunColor * dwBack * vDwT * 0.6 * (1.0 - uNight);
  // A soft sky-colored sheen on the tips so the field doesn't go flat in shade.
  totalEmissiveRadiance += diffuseColor.rgb * vDwT * vDwT * 0.06 * (1.0 - uNight);
  totalEmissiveRadiance += diffuseColor.rgb * vDwGlow * uNight * 2.2;
}
`;

function fieldMaterial(kind: 'grass' | 'flower', uniforms: FieldUniforms): MeshToonMaterial {
  const m = new MeshToonMaterial({
    gradientMap: toonRamp(),
    vertexColors: true,
    side: DoubleSide,
    color: new Color('#ffffff'),
  });
  m.name = `field:${kind}`;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDwRadius = uniforms.uDwRadius;
    shader.uniforms.uDwBend = uniforms.uDwBend;
    const flower = kind === 'flower';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${flower ? FLOWER_VERTEX_PARS : GRASS_VERTEX_PARS}`)
      .replace('#include <beginnormal_vertex>', flower ? FLOWER_BUILD : GRASS_BUILD)
      .replace('#include <begin_vertex>', 'vec3 transformed = dwPos;')
      .replace('#include <color_vertex>', flower ? FLOWER_COLOR : GRASS_COLOR);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb = clamp(diffuseColor.rgb, 0.0, 1.0);' +
          // Lawns keep less chroma than painted (render/look.ts, G3c); flowers keep theirs.
          (flower ? '' : `\ndiffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, ${LOOK.grassChroma.toFixed(3)});`),
      )
      .replace(
        '#include <normal_fragment_begin>',
        `float faceDirection = 1.0;
        float dwNl = length( vNormal );
        vec3 normal = dwNl > 1e-4 ? vNormal / dwNl : vec3( 0.0, 0.0, 1.0 );
        vec3 nonPerturbedNormal = normal;`,
      )
      .replace('#include <emissivemap_fragment>', FRAGMENT_EMISSIVE);
  };
  m.customProgramCacheKey = () => `dw-field-${kind}`;
  // A touch less rim than solid props: thousands of blade edges would sparkle.
  return applyPainterly(m, { rim: 0.35 });
}

export function grassMaterial(u: FieldUniforms): MeshToonMaterial {
  return fieldMaterial('grass', u);
}

export function flowerMaterial(u: FieldUniforms): MeshToonMaterial {
  return fieldMaterial('flower', u);
}
