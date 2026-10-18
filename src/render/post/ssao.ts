// Screen-space ambient occlusion (G3c, Q40), half resolution, for the quality levels that ask for
// it. Contact shadows and crevice darkening for the whole world: under eaves and canopies, where
// a wall meets the ground, between rocks, under the wyvern. Nothing else in the frame had any.
//
//   ao    scene depth (resolved from the MSAA target) → half-res AO + linear depth: a normal from
//         the neighbouring depths (the side with the smaller step, so silhouettes don't smear),
//         12 samples in a disk of fixed world radius, rotated per pixel, scored by how far each
//         rises above the surface's tangent plane (the "alchemy"/SAO estimator), faded out with
//         distance so the far cloud sea and islands keep the fog's softness.
//   blur  two separable 9-tap passes, weighted by depth so no halo crosses a silhouette.
//
// The grade pass samples the result with a depth-aware 4-tap upsample and multiplies the scene
// by it before exposure (post/grade.ts). Sky pixels (depth at the far plane) stay 1.

import {
  HalfFloatType,
  LinearFilter,
  Matrix4,
  NearestFilter,
  RGFormat,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { POST_VERTEX, PostQuad } from './quad';

/** Tuning, shared with the grade's upsample. */
export const SSAO = {
  /** World radius of the sample disk (m). */
  radius: 2.5,
  /** Samples per pixel. */
  samples: 12,
  /** Occlusion gain and the shaping power on the result. */
  intensity: 6.0,
  power: 1.4,
  /** Depth bias, as a fraction of the view distance (self-occlusion on flat ground). */
  bias: 0.0025,
  /** Full strength nearer than this, none beyond `fadeFar` (m from the camera). */
  fadeNear: 140,
  fadeFar: 420,
};

const DEPTH_PARS = /* glsl */ `
uniform sampler2D tDepth;
uniform mat4 uProjInv;
uniform float uNear, uFar;
float dwViewZ(float d) {
  // three's perspectiveDepthToViewZ, for a depth buffer value d in [0, 1].
  return (uNear * uFar) / ((uFar - uNear) * d - uFar);
}
vec3 dwViewPos(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
`;

const AO_FRAG = /* glsl */ `
${DEPTH_PARS}
uniform vec2 uTexel;      // full-resolution texel
uniform float uProjScale; // pixels per metre at 1 m (vertical): 0.5 * height * proj[1][1]
uniform float uRadius, uIntensity, uPower, uBias, uFadeNear, uFadeFar;
varying vec2 vUv;

float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

void main() {
  float d = texture2D(tDepth, vUv).x;
  // (Depth goes in a half float: the sky's stand-in distance stays under its 65504 maximum.)
  if (d >= 0.999999) { gl_FragColor = vec4(1.0, 60000.0, 0.0, 1.0); return; }
  vec3 P = dwViewPos(vUv);
  float dist = -P.z;
  float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, dist);
  if (fade <= 0.0) { gl_FragColor = vec4(1.0, dist, 0.0, 1.0); return; }
  // Normal from the smaller of the two steps on each axis (no smearing across silhouettes).
  vec3 Pr = dwViewPos(vUv + vec2(uTexel.x * 2.0, 0.0));
  vec3 Pl = dwViewPos(vUv - vec2(uTexel.x * 2.0, 0.0));
  vec3 Pu = dwViewPos(vUv + vec2(0.0, uTexel.y * 2.0));
  vec3 Pd = dwViewPos(vUv - vec2(0.0, uTexel.y * 2.0));
  vec3 dx = abs(Pr.z - P.z) < abs(P.z - Pl.z) ? Pr - P : P - Pl;
  vec3 dy = abs(Pu.z - P.z) < abs(P.z - Pd.z) ? Pu - P : P - Pd;
  vec3 N = normalize(cross(dx, dy));
  if (dot(N, P) > 0.0) N = -N;
  // The disk in screen space: the world radius at this distance, in UV units.
  float rPix = uRadius * uProjScale / dist;
  vec2 rUv = vec2(rPix * uTexel.x, rPix * uTexel.y);
  float rot = ign(gl_FragCoord.xy) * 6.2831853;
  float r2 = uRadius * uRadius;
  float occ = 0.0;
  const int N_SAMPLES = ${SSAO.samples};
  for (int i = 0; i < N_SAMPLES; i++) {
    float fi = float(i) + 0.5;
    float a = rot + fi * 2.39996323;
    float rr = sqrt(fi / float(N_SAMPLES));
    vec2 suv = vUv + vec2(cos(a), sin(a)) * rUv * rr;
    vec3 v = dwViewPos(suv) - P;
    float vv = dot(v, v);
    float vn = dot(v, N);
    occ += max(0.0, vn - uBias * dist) / (vv + 0.01) * max(0.0, 1.0 - vv / r2);
  }
  float ao = clamp(1.0 - uIntensity * occ / float(N_SAMPLES), 0.0, 1.0);
  ao = pow(ao, uPower);
  gl_FragColor = vec4(mix(1.0, ao, fade), dist, 0.0, 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
uniform sampler2D tAO;
uniform vec2 uDir;  // one texel of the AO target along the blur axis
varying vec2 vUv;
void main() {
  vec2 c = texture2D(tAO, vUv).rg;
  float sum = c.r;
  float wsum = 1.0;
  float tol = 0.04 * c.g + 0.15;
  for (int i = 1; i <= 4; i++) {
    float g = exp(-float(i * i) / 8.0);
    vec2 a = texture2D(tAO, vUv + uDir * float(i)).rg;
    vec2 b = texture2D(tAO, vUv - uDir * float(i)).rg;
    float wa = g * step(abs(a.g - c.g), tol);
    float wb = g * step(abs(b.g - c.g), tol);
    sum += a.r * wa + b.r * wb;
    wsum += wa + wb;
  }
  gl_FragColor = vec4(sum / wsum, c.g, 0.0, 1.0);
}
`;

/** Depth-aware upsample of the half-resolution AO (for the grade pass). Needs DEPTH_PARS. */
export const SSAO_UPSAMPLE_GLSL = /* glsl */ `
${DEPTH_PARS}
uniform sampler2D tAO;
uniform vec2 uAOTexel;
float dwAO(vec2 uv) {
  float z = min(-dwViewZ(texture2D(tDepth, uv).x), 60000.0);
  vec2 base = uv - 0.5 * uAOTexel;
  float sum = 0.0, wsum = 0.0;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 s = texture2D(tAO, base + vec2(float(i), float(j)) * uAOTexel).rg;
    float w = 1.0 / (abs(s.g - z) + 0.02 * z + 0.05);
    sum += s.r * w;
    wsum += w;
  }
  return wsum > 1e-6 ? sum / wsum : 1.0;
}
`;

export class SSAOPass {
  private ao: WebGLRenderTarget;
  private blurA: WebGLRenderTarget;
  private aoQuad: PostQuad<ShaderMaterial>;
  private blurQuad: PostQuad<ShaderMaterial>;
  readonly quads: PostQuad<ShaderMaterial>[];
  private readonly projInv = new Matrix4();
  readonly texel = new Vector2(1, 1);
  private fullHeight = 1;

  constructor() {
    const rt = () =>
      new WebGLRenderTarget(1, 1, { type: HalfFloatType, format: RGFormat, minFilter: NearestFilter, magFilter: LinearFilter, depthBuffer: false, generateMipmaps: false });
    this.ao = rt();
    this.blurA = rt();
    this.aoQuad = new PostQuad(
      new ShaderMaterial({
        name: 'DriftwingSSAO',
        uniforms: {
          tDepth: { value: null },
          uProjInv: { value: this.projInv },
          uNear: { value: 0.5 },
          uFar: { value: 7000 },
          uTexel: { value: new Vector2(1, 1) },
          uProjScale: { value: 1 },
          uRadius: { value: SSAO.radius },
          uIntensity: { value: SSAO.intensity },
          uPower: { value: SSAO.power },
          uBias: { value: SSAO.bias },
          uFadeNear: { value: SSAO.fadeNear },
          uFadeFar: { value: SSAO.fadeFar },
        },
        vertexShader: POST_VERTEX,
        fragmentShader: AO_FRAG,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.blurQuad = new PostQuad(
      new ShaderMaterial({
        name: 'DriftwingSSAOBlur',
        uniforms: { tAO: { value: null }, uDir: { value: new Vector2() } },
        vertexShader: POST_VERTEX,
        fragmentShader: BLUR_FRAG,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.quads = [this.aoQuad, this.blurQuad];
  }

  /** Size from the full-resolution drawing buffer. */
  setSize(w: number, h: number): void {
    const hw = Math.max(1, Math.ceil(w / 2));
    const hh = Math.max(1, Math.ceil(h / 2));
    this.ao.setSize(hw, hh);
    this.blurA.setSize(hw, hh);
    this.texel.set(1 / hw, 1 / hh);
    (this.aoQuad.material.uniforms.uTexel.value as Vector2).set(1 / w, 1 / h);
    this.fullHeight = h;
  }

  /** The blurred AO (R) and linear depth (G) at half resolution. */
  render(gl: WebGLRenderer, depth: Texture, camera: PerspectiveCamera): Texture {
    const u = this.aoQuad.material.uniforms;
    u.tDepth.value = depth;
    this.projInv.copy(camera.projectionMatrixInverse);
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    // Pixels per metre at 1 m along the view: half the buffer height times proj[1][1].
    u.uProjScale.value = 0.5 * this.fullHeight * camera.projectionMatrix.elements[5];
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(this.ao);
    this.aoQuad.render(gl);
    const b = this.blurQuad.material.uniforms;
    gl.setRenderTarget(this.blurA);
    b.tAO.value = this.ao.texture;
    (b.uDir.value as Vector2).set(this.texel.x, 0);
    this.blurQuad.render(gl);
    gl.setRenderTarget(this.ao);
    b.tAO.value = this.blurA.texture;
    (b.uDir.value as Vector2).set(0, this.texel.y);
    this.blurQuad.render(gl);
    gl.setRenderTarget(prev);
    return this.ao.texture;
  }

  /** A target to compile the passes against (warmup). */
  get compileTarget(): WebGLRenderTarget {
    return this.ao;
  }

  dispose(): void {
    this.ao.dispose();
    this.blurA.dispose();
    for (const q of this.quads) q.dispose();
  }
}
