// WebGL renderer + post chain:
//
//   scene ──► HDR target (half float, MSAA per quality, the only multisampled buffer)
//          ├► bloom mip chain (half res and down; see post/bloom.ts)
//          └► AO from the resolved depth (half res, High/Ultra; see post/ssao.ts)
//   grade (full res, straight to the canvas): scene + bloom, speed blur or sharpening, color
//          grade, cloud veil, flash, vignette, fade, ACES tone map, sRGB, dither.
//
// One full-resolution pass after the scene, one MSAA resolve, no ping-pong buffers. Shader
// warmup (warmup.ts) keeps program links out of play; quality changes rebuild the targets and
// recompile everything before the next visible frame.

import {
  ACESFilmicToneMapping,
  DepthTexture,
  FloatType,
  HalfFloatType,
  PCFShadowMap,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
  type Camera,
  type PerspectiveCamera,
  type ShaderMaterial,
  type Scene,
} from 'three';
import { QUALITY, type QualityProfile } from './quality';
import type { QualityLevel } from '../core/types';
import { BloomChain } from './post/bloom';
import { gradeMaterial, gradeUniforms, type GradeUniforms } from './post/grade';
import { POST_CAMERA, PostQuad } from './post/quad';
import { SSAOPass } from './post/ssao';
import { LOOK } from './look';
import { ShaderWarmup, type WarmupStats } from './warmup';
import { globalUniforms } from './uniforms';

export type { GradeUniforms } from './post/grade';
export type { WarmupStats } from './warmup';

/**
 * Bloom energy relative to the strength the sky's palettes ask for (0.25-0.55). Calibrated so
 * halos match the UnrealBloomPass tuning the palettes were authored against.
 */
const BLOOM_GAIN = 1.8;
/** How much of the screen-space AO the grade applies (post/ssao.ts, G3c). */
const AO_STRENGTH = 0.85;
/** Below this strength bloom is skipped entirely. */
const BLOOM_MIN = 0.02;
/**
 * Shader time wraps by this much (seconds; a power of two, so the wrap is exact). float32
 * keeps sub-millisecond steps below 2^13 s; the wrap happens behind a fade when possible.
 */
const TIME_WRAP = 4096;
/** Wrap regardless after this long without a fade (one frame of animation phase jump). */
const TIME_HARD_LIMIT = 4 * TIME_WRAP;
/** Longest a quality change may hold back drawing while programs compile (ms). */
const RECOMPILE_MAX_MS = 4000;

export interface RenderStats {
  /** Draw calls, triangles and points of the last frame (shadow and post passes included). */
  calls: number;
  triangles: number;
  points: number;
  /** Linked programs in total. */
  programs: number;
  /** Drawing-buffer size in pixels. */
  width: number;
  height: number;
  /** Current pixel ratio (cap × resolution setting × automatic factor). */
  pixelRatio: number;
  /** Objects held off camera while their programs compile. */
  compiling: number;
}

export class Renderer {
  readonly gl: WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  readonly grade: GradeUniforms;
  readonly warmup: ShaderWarmup;
  quality: QualityProfile;
  /** True when the last frame linked new programs (a hitch, not steady-state cost). */
  compiledThisFrame = false;
  private target: WebGLRenderTarget;
  private bloom: BloomChain;
  private ssao: SSAOPass;
  private gradeQuad: PostQuad<ShaderMaterial>;
  private bloomStrength = 0.32;
  private resolutionScale = 1;
  /** Automatic resolution factor (0.5..1) the game lowers when frames run long. */
  private dynamicScale = 1;
  private size = new Vector2();
  private pixelRatio = 1;
  /** devicePixelRatio the buffers were last sized for. */
  private dpr = 1;
  private needsRecompile = false;
  private recompiling: { done: boolean; started: number } | null = null;

  constructor(container: HTMLElement, level: QualityLevel = 'high') {
    this.quality = QUALITY[level];
    this.gl = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.gl.outputColorSpace = SRGBColorSpace;
    this.gl.toneMapping = ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.0;
    this.gl.shadowMap.enabled = this.quality.shadows;
    this.gl.shadowMap.type = PCFShadowMap;
    // Count the whole frame (shadow, scene and post passes), not just the last draw.
    this.gl.info.autoReset = false;
    this.canvas = this.gl.domElement;
    this.canvas.tabIndex = 0;
    container.appendChild(this.canvas);
    this.warmup = new ShaderWarmup(this.gl);

    this.target = this.makeSceneTarget(this.quality.msaa, !!this.quality.ao);
    this.bloom = new BloomChain(this.quality.bloomLevels ?? 6);
    this.ssao = new SSAOPass();
    this.bloom.threshold = 0.86;
    this.grade = gradeUniforms();
    this.grade.uFxaa.value = this.quality.fxaa ? 1 : 0;
    this.gradeQuad = new PostQuad(gradeMaterial(this.grade));

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.watchPixelRatio();
    // A restored context has lost every program: compile them all again before drawing.
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.needsRecompile = true;
    });
  }

  setQuality(level: QualityLevel, resolutionScale = this.resolutionScale): void {
    const q = QUALITY[level];
    const changed = q !== this.quality;
    this.quality = q;
    this.resolutionScale = resolutionScale;
    this.gl.shadowMap.enabled = q.shadows;
    // three never re-creates a framebuffer when `samples` changes on a live target, so a new
    // MSAA level means a new target.
    if (this.target.samples !== q.msaa || !!this.target.depthTexture !== !!q.ao) {
      this.target.dispose();
      this.target = this.makeSceneTarget(q.msaa, !!q.ao);
    }
    this.bloom.setLevels(q.bloomLevels ?? 6);
    this.grade.uFxaa.value = q.fxaa ? 1 : 0;
    // The systems apply their own quality changes right after this call; recompile on the next
    // frame, once they have.
    if (changed) this.needsRecompile = true;
    this.resize();
  }

  /** True while a quality change holds drawing back until its programs have linked. */
  get recompilingQuality(): boolean {
    return this.recompiling !== null || this.needsRecompile;
  }

  /** Current automatic resolution factor. */
  get dynamicResolution(): number {
    return this.dynamicScale;
  }

  /** Set the automatic resolution factor (reallocates render targets, so change it rarely). */
  setDynamicResolution(scale: number): void {
    const s = Math.min(1, Math.max(0.5, scale));
    if (Math.abs(s - this.dynamicScale) < 1e-3) return;
    this.dynamicScale = s;
    this.resize();
  }

  /**
   * Bloom strength and threshold (the sky raises bloom at dusk/night for glowing lanterns).
   * `knee` softens the threshold: the ramp runs from threshold - knee to threshold + knee.
   */
  setBloom(strength: number, threshold?: number, knee?: number): void {
    this.bloomStrength = strength;
    if (threshold !== undefined) this.bloom.threshold = threshold;
    if (knee !== undefined) this.bloom.knee = knee;
  }

  resize(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    const pr = Math.min(dpr, this.quality.pixelRatioCap) * this.resolutionScale * this.dynamicScale;
    this.pixelRatio = pr;
    this.gl.setPixelRatio(pr);
    this.gl.setSize(w, h, false);
    const bw = this.canvas.width;
    const bh = this.canvas.height;
    this.target.setSize(bw, bh);
    this.bloom.setSize(bw, bh);
    this.ssao.setSize(bw, bh);
    this.grade.uAOTexel.value.copy(this.ssao.texel);
    this.grade.uTexel.value.set(1 / bw, 1 / bh);
    // The browser stretches the drawing buffer to the screen; sharpen in proportion.
    this.grade.uSharpen.value = sharpenFor((w * dpr) / bw);
    this.size.set(w, h);
    for (const fn of this.resizeListeners) fn(w, h);
  }

  private resizeListeners: ((w: number, h: number) => void)[] = [];
  onResize(fn: (w: number, h: number) => void): void {
    this.resizeListeners.push(fn);
    fn(this.size.x, this.size.y);
  }

  get aspect(): number {
    return this.size.x / Math.max(1, this.size.y);
  }

  get stats(): RenderStats {
    const i = this.gl.info;
    return {
      calls: i.render.calls,
      triangles: i.render.triangles,
      points: i.render.points,
      programs: i.programs?.length ?? 0,
      width: this.canvas.width,
      height: this.canvas.height,
      pixelRatio: this.pixelRatio,
      compiling: this.warmup.compiling,
    };
  }

  /**
   * Boot warmup, run behind the splash: compile every program the scene and the post chain use
   * (in parallel where the driver allows), then draw everything once off screen so shadow
   * variants exist and all geometry is uploaded. See warmup.ts.
   */
  async prepare(scene: Scene, camera: Camera, drawAll = true): Promise<WarmupStats> {
    const programsBefore = this.gl.info.programs?.length ?? 0;
    this.compilePost();
    const { compileMs, readyMs } = await this.warmup.compileAll(scene, camera, this.target);
    const drawMs = drawAll ? this.warmup.drawAll(scene, camera, this.target) : 0;
    return { programsBefore, programsAfter: this.gl.info.programs?.length ?? 0, compileMs, readyMs, drawMs };
  }

  render(scene: Scene, camera: Camera, dt: number): void {
    this.advanceTime(dt);
    // Backstop for the matchMedia watch (some environments never fire it).
    if ((window.devicePixelRatio || 1) !== this.dpr) this.resize();
    if (this.needsRecompile) this.startRecompile(scene, camera);
    const r = this.recompiling;
    if (r) {
      // Hold the last frame on screen while the new quality's programs link.
      if (!r.done && performance.now() - r.started < RECOMPILE_MAX_MS) {
        this.compiledThisFrame = true;
        return;
      }
      this.recompiling = null;
      // Shadow-depth variants and uploads for the new settings, off screen.
      this.warmup.drawAll(scene, camera, this.target);
    }
    const info = this.gl.info;
    info.reset();
    const programs = info.programs?.length ?? 0;
    this.warmup.update(scene, camera, this.target, dt);

    const gl = this.gl;
    gl.setRenderTarget(this.target);
    gl.render(scene, camera);

    const g = this.grade;
    const depth = this.target.depthTexture;
    if (this.quality.ao && LOOK.ssao > 0 && depth && (camera as PerspectiveCamera).isPerspectiveCamera) {
      const cam = camera as PerspectiveCamera;
      g.tAO.value = this.ssao.render(gl, depth, cam);
      g.tDepth.value = depth;
      g.uProjInv.value.copy(cam.projectionMatrixInverse);
      g.uNear.value = cam.near;
      g.uFar.value = cam.far;
      g.uAOStrength.value = AO_STRENGTH;
      g.uAODebug.value = LOOK.aoDebug;
    } else {
      g.uAOStrength.value = 0;
    }
    if (this.quality.bloom && this.bloomStrength > BLOOM_MIN) {
      g.tBloom.value = this.bloom.render(gl, this.target.texture);
      g.uBloomStrength.value = this.bloomStrength * BLOOM_GAIN;
    } else {
      g.uBloomStrength.value = 0;
    }
    g.tDiffuse.value = this.target.texture;
    const autoClear = gl.autoClear;
    gl.autoClear = false; // the grade covers every pixel
    try {
      gl.setRenderTarget(null);
      this.gradeQuad.render(gl);
    } finally {
      gl.autoClear = autoClear;
    }
    this.compiledThisFrame = (info.programs?.length ?? 0) !== programs;
  }

  /** Render without post (for the stable preview inset or debug captures). */
  renderRaw(scene: Scene, camera: Camera): void {
    this.gl.setRenderTarget(null);
    this.gl.render(scene, camera);
  }

  // --- Internals ------------------------------------------------------------------------------

  private makeSceneTarget(samples: number, depthTexture = false): WebGLRenderTarget {
    const w = Math.max(1, this.canvas?.width ?? 1);
    const h = Math.max(1, this.canvas?.height ?? 1);
    const t = new WebGLRenderTarget(w, h, {
      type: HalfFloatType,
      samples,
      depthBuffer: true,
      stencilBuffer: false,
      // The AO pass reads the scene's depth (resolved from the multisampled buffer by three).
      // (Only set when wanted: three's setter does not accept undefined.)
      ...(depthTexture ? { depthTexture: new DepthTexture(w, h, FloatType) } : {}),
    });
    t.texture.name = 'DriftwingScene';
    t.texture.generateMipmaps = false;
    return t;
  }

  private compilePost(): void {
    const gl = this.gl;
    const prev = gl.getRenderTarget();
    try {
      gl.setRenderTarget(this.bloom.compileTarget);
      for (const q of this.bloom.quads) gl.compile(q.mesh, POST_CAMERA);
      gl.setRenderTarget(this.ssao.compileTarget);
      for (const q of this.ssao.quads) gl.compile(q.mesh, POST_CAMERA);
      gl.setRenderTarget(null);
      gl.compile(this.gradeQuad.mesh, POST_CAMERA);
    } finally {
      gl.setRenderTarget(prev);
    }
  }

  private startRecompile(scene: Scene, camera: Camera): void {
    this.needsRecompile = false;
    this.warmup.reset();
    const job = { done: false, started: performance.now() };
    // Without parallel compilation there is nothing to wait for: the next draw links in place.
    if (this.warmup.parallel) this.recompiling = job;
    this.warmup.compileAll(scene, camera, this.target).then(
      () => (job.done = true),
      () => (job.done = true),
    );
  }

  private advanceTime(dt: number): void {
    const g = this.grade.uTime;
    g.value = (g.value + Math.max(0, dt)) % 1000;
    const t = globalUniforms.uTime;
    t.value = wrapShaderTime(t.value, this.grade.uFade.value > 0.95);
  }

  /** devicePixelRatio changes (moving to another monitor, OS zoom) don't fire 'resize'. */
  private watchPixelRatio(): void {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    const onChange = () => {
      mq.removeEventListener('change', onChange);
      this.resize();
      this.watchPixelRatio();
    };
    mq.addEventListener('change', onChange);
  }
}

/**
 * Shader time, kept small enough for float32 (TIME-01): past TIME_WRAP seconds it steps back by
 * TIME_WRAP while the screen is faded out (the jump in animation phase is hidden), or at the
 * latest at TIME_HARD_LIMIT. TIME_WRAP is a power of two, so the subtraction is exact.
 */
export function wrapShaderTime(t: number, hidden: boolean): number {
  if (t > TIME_HARD_LIMIT || (hidden && t > TIME_WRAP)) return t - TIME_WRAP;
  return t;
}

/** Sharpening for a drawing buffer the browser stretches by `upscale` (1 = native). */
export function sharpenFor(upscale: number): number {
  if (!(upscale > 1.04)) return 0;
  return Math.min(0.5, (upscale - 1) * 0.8);
}
