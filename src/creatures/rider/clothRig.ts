// Runs the rider's cloth pieces against the skeleton: pins anchored particles to bones, feeds
// colliders and air, and draws each piece as a smooth sheet (capes, scarves, coat tails, long
// hair) or a tube (ponytail, braids). Meshes are drawn in the simulation frame: positions are
// relative to a moving origin, and the mesh's world matrix is just a translation to it.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Matrix4,
  Mesh,
  MeshToonMaterial,
  Vector3,
  Vector2,
  type Bone,
  type Group,
} from 'three';
import { applyPainterly, toonRamp } from '../../render/painterly';
import type { RiderLook } from '../../core/types';
import { Cloth, type Capsule, type ClothEnv } from './cloth';
import {capsuleDepth,capsuleExit} from './clothContact';
import type { ClothPattern, ClothSpec, ColliderName } from './accessories';
import { evalRecipe, recipeOf, type ColorRecipe } from './palette';
import { proofAtlas, proofUV, type ProofMaps, type ProofAtlasSize } from './proofMaterials';

const PATTERN_ID: Record<ClothPattern, number> = { plain: 0, tattered: 1, feather: 2, hair: 3, scarf: 4, tail: 5, braid: 6, coat: 7, garment: 8 };

const PATTERN_GLSL = /* glsl */ `
float dwHash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec3 dwPattern(vec3 base, vec2 uv, bool front) {
  vec3 c = base;
  #if DW_PATTERN == 0
    // Plain cape: trim along the hem and edges.
    float edge = step(0.94, uv.y) + step(uv.x, 0.025) + step(0.975, uv.x);
    c = mix(c, uDwTrim, clamp(edge, 0.0, 1.0));
  #elif DW_PATTERN == 1
    // Tattered: ragged hem, a few holes, weathered toward the bottom.
    float cell = floor(uv.x * 11.0);
    float f = fract(uv.x * 11.0);
    float cut = 0.8 + 0.13 * dwHash(cell) + 0.07 * abs(f - 0.5) * 2.0 * dwHash(cell + 7.0);
    if (uv.y > cut) discard;
    vec2 hc = floor(uv * vec2(5.0, 7.0));
    vec2 hf = fract(uv * vec2(5.0, 7.0)) - 0.5;
    if (uv.y > 0.4 && dwHash(hc.x * 13.0 + hc.y * 7.0) > 0.82 && length(hf * vec2(1.0, 1.4)) < 0.18 + 0.06 * dwHash(hc.x + hc.y)) discard;
    c *= mix(1.0, 0.72, smoothstep(0.35, 1.0, uv.y));
    c = mix(c, c * 0.6, smoothstep(cut - 0.06, cut, uv.y));
  #elif DW_PATTERN == 2
    // Feathered mantle: overlapping rows of pointed feathers.
    float rows = 7.0;
    float rv = uv.y * rows;
    float row = floor(rv);
    float fv = fract(rv);
    float cols = 7.0;
    float fu = fract(uv.x * cols + mod(row, 2.0) * 0.5);
    float tip = 1.0 - 0.55 * pow(abs(fu * 2.0 - 1.0), 1.6);
    if (row >= rows - 1.0 && fv > tip) discard;
    float tone = 0.86 + 0.14 * dwHash(row * 3.1 + floor(uv.x * cols + mod(row, 2.0) * 0.5));
    c *= tone * mix(1.0, 0.68, smoothstep(tip - 0.3, tip, fv));
    c = mix(c, uDwTrim, 0.35 * step(abs(fu - 0.5), 0.035) * (1.0 - fv));
    c = mix(c, uDwTrim, 0.25 * smoothstep(0.6, 1.0, uv.y));
  #elif DW_PATTERN == 3
    // Long hair: strands and pointed clumps at the ends.
    float cl = fract(uv.x * 7.0);
    float tipH = 0.72 + 0.28 * pow(1.0 - abs(cl * 2.0 - 1.0), 0.7) * (0.75 + 0.25 * dwHash(floor(uv.x * 7.0)));
    if (uv.y > tipH) discard;
    c *= 0.84 + 0.16 * sin(uv.x * 70.0 + sin(uv.y * 9.0) * 2.0);
    c *= mix(1.0, 0.8, abs(cl * 2.0 - 1.0));
  #elif DW_PATTERN == 4
    // Scarf: a band near the end and a fringe.
    float band = step(0.84, uv.y) * step(uv.y, 0.885) + step(0.91, uv.y) * step(uv.y, 0.925);
    c = mix(c, uDwTrim, band);
    if (uv.y > 0.955 && fract(uv.x * 6.0) > 0.55) discard;
    c *= 0.92 + 0.08 * smoothstep(0.0, 0.2, min(uv.x, 1.0 - uv.x));
  #elif DW_PATTERN == 5
    // Ponytail: soft streaks running down the tail.
    c *= 0.82 + 0.18 * sin(uv.x * 6.2831 * 5.0 + uv.y * 4.0);
  #elif DW_PATTERN == 6
    // Braid: interlocking chevrons and a tie near the end.
    float b = fract(uv.y * 14.0 + abs(uv.x - 0.5) * 1.6);
    c *= 0.72 + 0.28 * smoothstep(0.0, 0.5, b) * (1.0 - smoothstep(0.75, 1.0, b));
    c = mix(c, uDwTrim, step(0.86, uv.y) * step(uv.y, 0.92));
  #elif DW_PATTERN == 7
    // Coat tails: a darker hem band.
    c = mix(c, uDwTrim, step(0.9, uv.y));
  #endif
  // Lining: the inside of capes and coats is a deeper tone.
  if (!front) c *= 0.66;
  return c;
}
`;

export function clothMaterial(pattern: ClothPattern, color: Color, trim: Color, proofMaps?: ProofMaps, size: ProofAtlasSize = 1024): MeshToonMaterial {
  const atlas = proofMaps && proofMaps !== 'off' ? proofAtlas(size) : undefined;
  const m = new MeshToonMaterial({ color, side: DoubleSide, gradientMap: toonRamp(),
    map: atlas?.color ?? null, normalMap: proofMaps === 'normal' ? atlas!.normal : null, normalScale: new Vector2(.3, .3) });
  const trimU = { value: trim.clone() };
  // Kept on the material so a color-only look change can retint it in place.
  m.userData.trim = trimU;
  applyPainterly(m, {
    rim: proofMaps ? .6 : .9,
    onBeforeCompile: (shader) => {
      shader.uniforms.uDwTrim = trimU;
      shader.defines = { ...(shader.defines ?? {}), DW_PATTERN: PATTERN_ID[pattern] };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 dwUv;\nvarying vec2 vDwUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDwUv = dwUv;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vDwUv;\nuniform vec3 uDwTrim;\n' + PATTERN_GLSL)
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = dwPattern(diffuseColor.rgb, vDwUv, gl_FrontFacing);');
    },
  });
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${key()}-cloth-${pattern}-${proofMaps ?? 'legacy'}`;
  return m;
}

/**
 * Uniform Catmull-Rom basis weights at t into `out` (w0..w3 for p0..p3). The draw loops apply
 * them inline: a helper returning a number per sample boxes thousands of doubles a frame once the
 * JIT stops inlining it.
 */
function crWeights(t: number, out: Float64Array): void {
  const t2 = t * t;
  const t3 = t2 * t;
  out[0] = 0.5 * (-t + 2 * t2 - t3);
  out[1] = 0.5 * (2 - 5 * t2 + 3 * t3);
  out[2] = 0.5 * (t + 4 * t2 - 3 * t3);
  out[3] = 0.5 * (-t2 + t3);
}
const _cw = new Float64Array(4);

interface Piece {
  spec: ClothSpec;
  cloth: Cloth;
  mesh: Mesh;
  geo: BufferGeometry;
  pos: Float32Array;
  nrm: Float32Array;
  /** Visual grid size. */
  vu: number;
  vv: number;
  /** Bone-local offsets of pinned particles (bind rotations are identity). */
  pinOffset: Float64Array;
  pinBone: Int32Array;
  /** For reset: per particle, the bone whose motion carries it and its offset. */
  carryBone: Int32Array;
  targets: Float64Array;
  capsules: Capsule[];
  /** Tube scratch: smoothed centerline. */
  line?: Float64Array;
  flip: boolean;
  /** Visual subdivisions per particle span (quality dependent). */
  sub: number;
  /** Tubes: radius at each visual row (static, from the spec). */
  radii?: Float64Array;
  /** How the piece's color and trim derive from the look (undefined = constant). */
  colorRecipe?: ColorRecipe;
  trimRecipe?: ColorRecipe;
  guide?: Float64Array;
  contactDirection: Vector3;
  renderParticles?: Float64Array;
  surfaceRest?: Float32Array;
  surfacePinned: Uint8Array;
  wrappedArm: boolean;
  contactSpans:Float32Array;
  vertexRecipes?: (ColorRecipe | undefined)[];
}

export interface ClothLod {
  /** Multiplier on visual subdivisions (1 = full). */
  detail: number;
  shadows: boolean;
  proofMaps?: ProofMaps;
  proofAtlasSize?: ProofAtlasSize;
}

const _m = new Matrix4();
const _v = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _n = new Vector3();
const _t = new Vector3();
const _prevN = new Vector3();

export class ClothRig {
  readonly pieces: Piece[] = [];
  private readonly parent: Group;
  readonly origin = new Vector3();
  /** Reused every step (no per-frame object). */
  private readonly env: ClothEnv = { airX: 0, airY: 0, airZ: 0, time: 0 };

  private readonly lod: ClothLod;
  private readonly bindPos: Vector3[];

  constructor(specs: ClothSpec[], bindPos: Vector3[], parent: Group, colliderSets: Record<ColliderName, Capsule>, lod: ClothLod = { detail: 1, shadows: true }, groundAt?: ClothEnv['groundAt'], states?: ReadonlyMap<string, Cloth>) {
    this.parent = parent;
    this.bindPos = bindPos;
    this.lod = lod;
    if (groundAt) this.env.groundAt = (x, y, z) => {
      // Short drapes/hair cannot reach the floor. Query shared geometry only for lower particles.
      if (y > -.35) return null;
      const height = groundAt(x + this.origin.x, y + this.origin.y, z + this.origin.z);
      return height === null ? null : height - this.origin.y;
    };
    for (const spec of specs) this.pieces.push(this.makePiece(spec, bindPos, colliderSets, states?.get(spec.name)));
  }

  private makePiece(spec: ClothSpec, bindPos: Vector3[], colliderSets: Record<ColliderName, Capsule>, state?: Cloth): Piece {
    const n = spec.cols * spec.rows;
    const rest = new Float64Array(n * 3);
    const pinned = new Uint8Array(n);
    const pinOffset = new Float64Array(n * 3);
    const pinBone = new Int32Array(n).fill(-1);
    const carryBone = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const p = spec.rest[i];
      rest[i * 3] = p.x;
      rest[i * 3 + 1] = p.y;
      rest[i * 3 + 2] = p.z;
      const bone = spec.anchorBone[i];
      if (bone >= 0) {
        pinned[i] = 1;
        pinBone[i] = bone;
        pinOffset[i * 3] = p.x - bindPos[bone].x;
        pinOffset[i * 3 + 1] = p.y - bindPos[bone].y;
        pinOffset[i * 3 + 2] = p.z - bindPos[bone].z;
      }
      // Free particles ride with their column's anchor bone on reset.
      const col = i % spec.cols;
      carryBone[i] = spec.anchorBone[col] >= 0 ? spec.anchorBone[col] : spec.anchorBone.find((b) => b >= 0) ?? 0;
    }
    // Quality changes rebuild visual subdivision only. Keep particles, velocity, pins and the
    // substep accumulator intact instead of making the wind-driven drape snap to its rest pose.
    const cloth = state ?? new Cloth({ cols: spec.cols, rows: spec.rows, rest, pinned, ...spec.config });
    const sub = Math.max(1, Math.round((spec.render.subdiv ?? 3) * this.lod.detail));
    let vu: number;
    let vv: number;
    if (spec.render.kind === 'tube') {
      vu = 9; // ring vertices (+1 seam)
      vv = (spec.rows - 1) * sub + 1;
    } else {
      vu = spec.cols === 2 ? 2 : (spec.cols - 1) * sub + 1;
      vv = (spec.rows - 1) * sub + 1;
    }
    const geo = new BufferGeometry();
    const pos = new Float32Array(vu * vv * 3);
    const surfacePinned=new Uint8Array(vu*vv);
    if(spec.guideSkin)for(let j=0;j<vv;j++)for(let i=0;i<vu;i++){
      const row=j/sub,col=i/sub,r0=Math.min(spec.rows-2,Math.floor(row)),c0=Math.min(spec.cols-2,Math.floor(col));
      const fr=row-r0,fc=col-c0;let fixed=true;
      for(let r=0;r<2;r++)for(let c=0;c<2;c++)if((r?fr:1-fr)*(c?fc:1-fc)>1e-9&&spec.anchorBone[(r0+r)*spec.cols+c0+c]<0)fixed=false;
      surfacePinned[j*vu+i]=fixed?1:0;
    }
    const nrm = new Float32Array(vu * vv * 3);
    const uv = new Float32Array(vu * vv * 2);
    for (let j = 0; j < vv; j++) {
      for (let i = 0; i < vu; i++) {
        uv[(j * vu + i) * 2] = i / (vu - 1);
        uv[(j * vu + i) * 2 + 1] = j / (vv - 1);
      }
    }
    // Which winding faces away from the body? Check the rest shape's middle against the outward
    // direction from the body's vertical axis.
    let flip = false;
    if (spec.render.kind === 'sheet' && spec.cols > 1) {
      const c0 = Math.floor(spec.cols / 2) - (spec.cols === 2 ? 1 : 0);
      const r0 = Math.min(1, spec.rows - 1);
      const i0 = r0 * spec.cols + c0;
      const p0 = spec.rest[i0];
      const pr = spec.rest[i0 + 1];
      const pd = spec.rest[i0 + spec.cols] ?? spec.rest[i0];
      _a.subVectors(pr, p0);
      _b.subVectors(pd, p0);
      _n.crossVectors(_a, _b); // face normal of (i, i+1, i+cols) winding
      _t.set(p0.x, 0, p0.z);
      flip = _n.dot(_t) < 0;
    }
    const idx: number[] = [];
    for (let j = 0; j < vv - 1; j++) {
      for (let i = 0; i < vu - 1; i++) {
        const a = j * vu + i;
        const b = a + 1;
        const c = a + vu;
        const d = c + 1;
        if (!flip) idx.push(a, b, c, b, d, c);
        else idx.push(a, c, b, b, c, d);
      }
    }
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('normal', new BufferAttribute(nrm, 3));
    geo.setAttribute('dwUv', new BufferAttribute(uv, 2));
    if (spec.render.proofLinen) {
      const atlasUv = new Float32Array(uv.length);
      for (let i = 0; i < uv.length; i += 2) atlasUv.set(proofUV('linen', uv[i], uv[i + 1]), i);
      geo.setAttribute('uv', new BufferAttribute(atlasUv, 2));
    }
    geo.setIndex(idx);
    const mat = clothMaterial(spec.render.pattern, spec.render.color, spec.render.trim,
      spec.render.proofLinen ? this.lod.proofMaps ?? 'color' : undefined, this.lod.proofAtlasSize);
    let vertexRecipes: (ColorRecipe | undefined)[] | undefined;
    if (spec.render.colorAt) {
      const colors = new Float32Array(vu * vv * 3);
      vertexRecipes = [];
      for (let j = 0; j < vv; j++) for (let i = 0; i < vu; i++) {
        const color = spec.render.colorAt(i / (vu - 1), j / (vv - 1)), k = j * vu + i;
        colors.set([color.r, color.g, color.b], k * 3);
        vertexRecipes.push(recipeOf(color));
      }
      geo.setAttribute('color', new BufferAttribute(colors, 3));
      mat.vertexColors = true;
      mat.color.setRGB(1, 1, 1);
    }
    const mesh = new Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.castShadow = this.lod.shadows;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;
    this.parent.add(mesh);
    const capsules = spec.colliders.map((c) => colliderSets[c]).filter(Boolean);
    cloth.setColliders(capsules);
    let radii: Float64Array | undefined;
    if (spec.render.kind === 'tube') {
      const radius = spec.render.radius ?? (() => 0.02);
      radii = new Float64Array(vv);
      for (let j = 0; j < vv; j++) radii[j] = Math.max(0.002, radius(j / (vv - 1)));
    }
    return {
      radii,
      spec,
      cloth,
      mesh,
      geo,
      pos,
      nrm,
      vu,
      vv,
      pinOffset,
      pinBone,
      carryBone,
      targets: new Float64Array(n * 3),
      capsules,
      flip,
      sub,
      colorRecipe: recipeOf(spec.render.color),
      trimRecipe: recipeOf(spec.render.trim),
      guide: spec.guideSkin ? new Float64Array(n * 3) : undefined,
      contactDirection:new Vector3(0,.25,1).normalize(),
      renderParticles:spec.guideSkin?new Float64Array(n*3):undefined,
      surfaceRest:spec.guideSkin?new Float32Array(pos.length):undefined,
      surfacePinned,wrappedArm:spec.name.startsWith('sleeve-'),
      contactSpans:new Float32Array(vu*vv*4),
      vertexRecipes,
    };
  }

  /** Retint every piece for a look with the same shape (colors only), in place. */
  recolor(look: RiderLook): void {
    const memo = new Map<ColorRecipe, Color>();
    for (const pc of this.pieces) {
      const m = pc.mesh.material as MeshToonMaterial;
      if (pc.colorRecipe && !pc.vertexRecipes) m.color.copy(evalRecipe(pc.colorRecipe, look, memo));
      if (pc.vertexRecipes) {
        const colors = pc.geo.getAttribute('color') as BufferAttribute;
        for (let i = 0; i < pc.vertexRecipes.length; i++) {
          const recipe = pc.vertexRecipes[i]; if (!recipe) continue;
          const c = evalRecipe(recipe, look, memo); colors.setXYZ(i, c.r, c.g, c.b);
        }
        colors.needsUpdate = true;
      }
      const trimU = m.userData.trim as { value: Color } | undefined;
      if (pc.trimRecipe && trimU) trimU.value.copy(evalRecipe(pc.trimRecipe, look, memo));
    }
  }

  /** Put every particle back on its rest shape, carried by the current bone poses. */
  reset(bones: Bone[], bindPos: Vector3[], origin: Vector3): void {
    this.origin.copy(origin);
    for (const pc of this.pieces) {
      const n = pc.spec.cols * pc.spec.rows;
      const out = pc.targets;
      if (pc.guide) {
        this.poseGuide(pc, bones, origin);
        out.set(pc.guide);
        pc.cloth.reset(out);
        continue;
      }
      for (let i = 0; i < n; i++) {
        const bone = pc.carryBone[i];
        const r = pc.spec.rest[i];
        _v.set(r.x - bindPos[bone].x, r.y - bindPos[bone].y, r.z - bindPos[bone].z).applyMatrix4(bones[bone].matrixWorld).sub(origin);
        out[i * 3] = _v.x;
        out[i * 3 + 1] = _v.y;
        out[i * 3 + 2] = _v.z;
      }
      pc.cloth.reset(out);
    }
  }

  /**
   * Advance. `origin` is the frame origin this frame (world), `dv` the change of the frame's
   * velocity since last frame, `air` the relative air velocity (wind − rider velocity).
   */
  update(dt: number, bones: Bone[], origin: Vector3, dv: Vector3, air: Vector3, time: number): void {
    this.origin.copy(origin);
    for (const pc of this.pieces) {
      const n = pc.spec.cols * pc.spec.rows;
      const tg = pc.targets;
      for (let i = 0; i < n; i++) {
        const bone = pc.pinBone[i];
        if (bone < 0) continue;
        _v.set(pc.pinOffset[i * 3], pc.pinOffset[i * 3 + 1], pc.pinOffset[i * 3 + 2]).applyMatrix4(bones[bone].matrixWorld).sub(origin);
        tg[i * 3] = _v.x;
        tg[i * 3 + 1] = _v.y;
        tg[i * 3 + 2] = _v.z;
      }
      pc.cloth.setAnchors(tg);
      pc.cloth.frameVelocityChange(dv.x, dv.y, dv.z);
      const env = this.env;
      if (pc.guide) this.poseGuide(pc, bones, origin);
      env.guide = pc.guide;
      env.airX = air.x;
      env.airY = air.y;
      env.airZ = air.z;
      env.time = time;
      pc.cloth.update(dt, env);
      this.draw(pc);
      _m.makeTranslation(origin.x, origin.y, origin.z);
      pc.mesh.matrixWorld.copy(_m);
    }
  }

  private draw(pc: Piece): void {
    if (pc.spec.render.kind === 'tube') this.drawTube(pc);
    else this.drawSheet(pc);
    pc.geo.attributes.position.needsUpdate = true;
    pc.geo.attributes.normal.needsUpdate = true;
  }

  /** Skin the rest envelope with the same bones as the fitted garment, without new joints. */
  private poseGuide(pc: Piece, bones: Bone[], origin: Vector3): void {
    const out = pc.guide!, skins = pc.spec.guideSkin!;
    for (let i = 0; i < skins.length; i++) {
      const rest = pc.spec.rest[i], skin = skins[i];
      let x = 0, y = 0, z = 0, total = 0;
      for (let k = 0; k < skin.length; k += 2) {
        const bone = skin[k], weight = skin[k + 1], bind = this.bindPos[bone];
        _v.set(rest.x - bind.x, rest.y - bind.y, rest.z - bind.z).applyMatrix4(bones[bone].matrixWorld);
        x += _v.x * weight; y += _v.y * weight; z += _v.z * weight; total += weight;
      }
      out[i * 3] = x / total - origin.x; out[i * 3 + 1] = y / total - origin.y; out[i * 3 + 2] = z / total - origin.z;
    }
    let cx=0,cz=0;for(let i=0;i<out.length;i+=3){cx+=out[i];cz+=out[i+2];}
    const radial=Math.hypot(cx,cz);
    if(radial>1e-6)pc.contactDirection.set(cx,.25*radial,cz).normalize();
  }

  private drawSheet(pc: Piece): void {
    const { cols, rows } = pc.spec;
    const p = pc.renderParticles??pc.cloth.pos;
    if(pc.renderParticles&&pc.guide){
      // A collision can move a particle much farther than wind may move this fitted garment.
      // Keep those repairs out of the interpolator; the continuous drawn envelope below owns
      // surface contacts. Simulation positions and velocities remain untouched.
      for(let i=0;i<pc.cloth.n;i++){
        const k=i*3,dx=pc.cloth.pos[k]-pc.guide[k],dy=pc.cloth.pos[k+1]-pc.guide[k+1],dz=pc.cloth.pos[k+2]-pc.guide[k+2];
        const row=Math.floor(i/pc.spec.cols)/(pc.spec.rows-1),limit=(pc.spec.config.poseRadius??.07)*(.15+.85*row);
        const length=Math.hypot(dx,dy,dz),scale=length>limit?limit/length:1;
        p[k]=pc.guide[k]+dx*scale;p[k+1]=pc.guide[k+1]+dy*scale;p[k+2]=pc.guide[k+2]+dz*scale;
      }
    }
    const sub = pc.sub;
    const vu = pc.vu;
    const vv = pc.vv;
    const out = pc.pos;
    // Pass 1: Catmull-Rom down every particle column at each visual row.
    if (!pc.line || pc.line.length !== vv * cols * 3) pc.line = new Float64Array(vv * cols * 3);
    const tmp = pc.line;
    const W = _cw;
    for (let j = 0; j < vv; j++) {
      const r = Math.min(rows - 2, Math.floor(j / sub));
      crWeights(j / sub - r, W);
      const w0 = W[0];
      const w1 = W[1];
      const w2 = W[2];
      const w3 = W[3];
      const b0 = Math.max(0, r - 1) * cols * 3;
      const b1 = r * cols * 3;
      const b2 = (r + 1) * cols * 3;
      const b3 = Math.min(rows - 1, r + 2) * cols * 3;
      const o = j * cols * 3;
      for (let q = 0; q < cols * 3; q++) tmp[o + q] = w0 * p[b0 + q] + w1 * p[b1 + q] + w2 * p[b2 + q] + w3 * p[b3 + q];
    }
    // Two-wide ribbons: drawn about their centerline with a minimum width and a twist that
    // builds along the length, so a scarf tail shows its face from any side (never a string).
    if (cols === 2) {
      this.drawRibbon(pc, tmp, vv);
      this.projectGarmentSurface(pc);
      return this.sheetNormals(pc);
    }
    // Pass 2: across the columns.
    for (let i = 0; i < vu; i++) {
      const c = Math.min(cols - 2, Math.floor(i / sub));
      crWeights(i / sub - c, W);
      const w0 = W[0];
      const w1 = W[1];
      const w2 = W[2];
      const w3 = W[3];
      const c0 = Math.max(0, c - 1) * 3;
      const c1 = c * 3;
      const c2 = (c + 1) * 3;
      const c3 = Math.min(cols - 1, c + 2) * 3;
      for (let j = 0; j < vv; j++) {
        const rowBase = j * cols * 3;
        const o = (j * vu + i) * 3;
        for (let k = 0; k < 3; k++) {
          out[o + k] = w0 * tmp[rowBase + c0 + k] + w1 * tmp[rowBase + c1 + k] + w2 * tmp[rowBase + c2 + k] + w3 * tmp[rowBase + c3 + k];
        }
      }
    }
    if (pc.spec.config.sewEdges) for (let j=0;j<vv;j++) {
      const a=j*vu*3,b=(j*vu+vu-1)*3;
      for (let k=0;k<3;k++) out[a+k]=out[b+k]=(out[a+k]+out[b+k])*.5;
    }
    this.projectGarmentSurface(pc);
    this.sheetNormals(pc);
  }

  /** Spline interpolation can cut inside a capsule even when its particles are outside.
   * Repair only the final free garment surface; never move a pinned seam or simulation state. */
  private projectGarmentSurface(pc:Piece):void {
    if(!pc.guide)return;
    const out=pc.pos,rad=pc.spec.config.radius+(pc.wrappedArm?.001:.003);
    const {x:nx,y:ny,z:nz}=pc.contactDirection;
    pc.surfaceRest!.set(out);
    let needsSmooth=false,spansReady=false;
    for(let sweep=0;sweep<32;sweep++){
    let touched=false;
    for(let i=pc.vu;i<out.length/3;i++) {
      if(pc.surfacePinned[i])continue;
      const k=i*3;
      for(let pass=0;pass<8;pass++) {
        let push=0;
        for(const c of pc.capsules) {
          if(pc.wrappedArm&&pc.spec.colliders[pc.capsules.indexOf(c)].startsWith('foreArm')){
            const depth=capsuleDepth(out[k],out[k+1],out[k+2],c,rad+.002);
            if(depth>1e-6){
              const ex=c.bx-c.ax,ey=c.by-c.ay,ez=c.bz-c.az,ee=ex*ex+ey*ey+ez*ez;
              const u=ee>1e-12?Math.max(0,Math.min(1,((out[k]-c.ax)*ex+(out[k+1]-c.ay)*ey+(out[k+2]-c.az)*ez)/ee)):0;
              const dx=out[k]-c.ax-ex*u,dy=out[k+1]-c.ay-ey*u,dz=out[k+2]-c.az-ez*u,length=Math.hypot(dx,dy,dz)||1;
              out[k]+=dx/length*(depth+1e-5);out[k+1]+=dy/length*(depth+1e-5);out[k+2]+=dz/length*(depth+1e-5);touched=true;
            }
          }else push=Math.max(push,capsuleExit(out[k],out[k+1],out[k+2],nx,ny,nz,c,rad));
        }
        if(push<1e-6)break;
        touched=true;
        out[k]+=nx*(push+1e-5);out[k+1]+=ny*(push+1e-5);out[k+2]+=nz*(push+1e-5);
      }
      const ground=this.env.groundAt?.(out[k],out[k+1],out[k+2]);
      if(ground!==null&&ground!==undefined&&out[k+1]<ground+rad){out[k+1]=ground+rad;touched=true;}
    }
    touched=this.clearGarmentTriangles(pc,rad)||touched;
    if(!pc.wrappedArm&&(touched||needsSmooth)){
      if(!spansReady){
        const base=pc.surfaceRest!;
        for(let i=pc.vu;i<out.length/3;i++)for(let dir=0;dir<4;dir++){
          const row=Math.floor(i/pc.vu),col=i%pc.vu,a=i*3;
          const j=dir===0?(col>0?i-1:-1):dir===1?(col<pc.vu-1?i+1:-1):dir===2?(row>1?i-pc.vu:-1):(row<pc.vv-1?i+pc.vu:-1),b=j*3;
          pc.contactSpans[i*4+dir]=j<pc.vu?0:Math.hypot(base[a]-base[b],base[a+1]-base[b+1],base[a+2]-base[b+2]);
        }
        spansReady=true;
      }
      needsSmooth=this.smoothGarmentContact(pc);touched=needsSmooth||touched;
    }
    if(pc.spec.config.sewEdges)for(let row=1;row<pc.vv;row++){
      const a=row*pc.vu*3,b=(row*pc.vu+pc.vu-1)*3;
      for(let k=0;k<3;k++){
        if(Math.abs(out[a+k]-out[b+k])>1e-6)touched=true;
        out[a+k]=out[b+k]=(out[a+k]+out[b+k])*.5;
      }
    }
    if(!touched)break;
    }
  }

  /** Vertices alone cannot detect a folded face spanning the body. A capsule support plane
   * at an intersecting edge/centroid keeps the rendered face outside. All corrections use one
   * outward direction per piece, so overlapping contacts cannot push it back and forth. */
  private clearGarmentTriangles(pc:Piece,rad:number):boolean {
    const p=pc.pos,idx=pc.geo.index!.array;
    const {x:nx,y:ny,z:nz}=pc.contactDirection;
    let touched=false;
      for(let t=0;t<idx.length;t+=3){
        const a=idx[t]*3,b=idx[t+1]*3,c=idx[t+2]*3;
        if(pc.surfacePinned[a/3]||pc.surfacePinned[b/3]||pc.surfacePinned[c/3])continue;
        for(const cap of pc.capsules){
          const R=cap.r+rad;
          if(Math.min(p[a],p[b],p[c])>Math.max(cap.ax,cap.bx)+R||Math.max(p[a],p[b],p[c])<Math.min(cap.ax,cap.bx)-R||
             Math.min(p[a+1],p[b+1],p[c+1])>Math.max(cap.ay,cap.by)+R||Math.max(p[a+1],p[b+1],p[c+1])<Math.min(cap.ay,cap.by)-R||
             Math.min(p[a+2],p[b+2],p[c+2])>Math.max(cap.az,cap.bz)+R||Math.max(p[a+2],p[b+2],p[c+2])<Math.min(cap.az,cap.bz)-R)continue;
        for(let sample=0;sample<4;sample++){
          const wa=sample===0||sample===1?.5:sample===3?1/3:0;
          const wb=sample===0||sample===2?.5:sample===3?1/3:0;
          const wc=1-wa-wb;
          let x=p[a]*wa+p[b]*wb+p[c]*wc,y=p[a+1]*wa+p[b+1]*wb+p[c+1]*wc,z=p[a+2]*wa+p[b+2]*wb+p[c+2]*wc;
            if(capsuleDepth(x,y,z,cap,rad)<1e-6)continue;
            // Wrapped sleeves need a local radial tangent plane at their own arm, rather
            // than a ray across the arm to its opposite side. This retains the sewn ring.
            if(pc.wrappedArm&&pc.spec.colliders[pc.capsules.indexOf(cap)].startsWith('foreArm')){
              const ex=cap.bx-cap.ax,ey=cap.by-cap.ay,ez=cap.bz-cap.az,ee=ex*ex+ey*ey+ez*ez;
              const u=ee>1e-12?Math.max(0,Math.min(1,((x-cap.ax)*ex+(y-cap.ay)*ey+(z-cap.az)*ez)/ee)):0;
              let dx=x-cap.ax-ex*u,dy=y-cap.ay-ey*u,dz=z-cap.az-ez*u;
              const length=Math.hypot(dx,dy,dz)||1;dx/=length;dy/=length;dz/=length;
              const plane=Math.max(cap.ax*dx+cap.ay*dy+cap.az*dz,cap.bx*dx+cap.by*dy+cap.bz*dz)+cap.r+rad+1e-5;
              for(const j of [a,b,c]){
                const move=plane-p[j]*dx-p[j+1]*dy-p[j+2]*dz;
                if(move>0){p[j]+=dx*move;p[j+1]+=dy*move;p[j+2]+=dz*move;touched=true;}
              }
              x=p[a]*wa+p[b]*wb+p[c]*wc;y=p[a+1]*wa+p[b+1]*wb+p[c+1]*wc;z=p[a+2]*wa+p[b+2]*wb+p[c+2]*wc;
              continue;
            }
            const move=capsuleExit(x,y,z,nx,ny,nz,cap,rad)+1e-5;
            for(const j of [a,b,c]){
              if(move>0){p[j]+=nx*move;p[j+1]+=ny*move;p[j+2]+=nz*move;touched=true;}
            }
            x+=nx*move;y+=ny*move;z+=nz*move;
          }
        }
      }
    return touched;
  }

  /** Spread contact displacement across neighbouring cloth instead of leaving a sharp fin.
   * Only raise the outward envelope, so smoothing cannot pull a cleared face into the body. */
  private smoothGarmentContact(pc:Piece):boolean {
    const p=pc.pos,base=pc.surfaceRest!,n=pc.contactDirection;
    let touched=false;
    for(let scan=0;scan<2;scan++)for(let ii=pc.vu;ii<p.length/3;ii++){
      const i=scan===0?ii:p.length/3-1-(ii-pc.vu),row=Math.floor(i/pc.vu),col=i%pc.vu,a=i*3;
      let offset=(p[a]-base[a])*n.x+(p[a+1]-base[a+1])*n.y+(p[a+2]-base[a+2])*n.z,need=offset;
      for(let dir=0;dir<4;dir++){
        const j=dir===0?(col>0?i-1:-1):dir===1?(col<pc.vu-1?i+1:-1):dir===2?(row>1?i-pc.vu:-1):(row<pc.vv-1?i+pc.vu:-1);
        if(j<pc.vu)continue;const b=j*3;
        const other=(p[b]-base[b])*n.x+(p[b+1]-base[b+1])*n.y+(p[b+2]-base[b+2])*n.z;
        const span=pc.contactSpans[i*4+dir];
        need=Math.max(need,other-.65*span);
      }
      if(need-offset>1e-5){const move=need-offset;p[a]+=n.x*move;p[a+1]+=n.y*move;p[a+2]+=n.z*move;touched=true;}
    }
    return touched;
  }

  /** Ribbon rows from the two smoothed columns in `line` (row-major, 2 points per row). */
  private drawRibbon(pc: Piece, line: Float64Array, vv: number): void {
    const out = pc.pos;
    const twist = pc.spec.render.twist ?? 0;
    const minHalf = (pc.spec.render.minWidth ?? 0) / 2;
    for (let j = 0; j < vv; j++) {
      const a = j * 6;
      const cx = (line[a] + line[a + 3]) / 2;
      const cy = (line[a + 1] + line[a + 4]) / 2;
      const cz = (line[a + 2] + line[a + 5]) / 2;
      // Tangent from the neighbouring rows' centers.
      const p0 = Math.max(0, j - 1) * 6;
      const p1 = Math.min(vv - 1, j + 1) * 6;
      let tx = (line[p1] + line[p1 + 3] - line[p0] - line[p0 + 3]) / 2;
      let ty = (line[p1 + 1] + line[p1 + 4] - line[p0 + 1] - line[p0 + 4]) / 2;
      let tz = (line[p1 + 2] + line[p1 + 5] - line[p0 + 2] - line[p0 + 5]) / 2;
      const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
      tx /= tl;
      ty /= tl;
      tz /= tl;
      // Half-width vector, made perpendicular to the tangent.
      let hx = (line[a + 3] - line[a]) / 2;
      let hy = (line[a + 4] - line[a + 1]) / 2;
      let hz = (line[a + 5] - line[a + 2]) / 2;
      const ht = hx * tx + hy * ty + hz * tz;
      hx -= tx * ht;
      hy -= ty * ht;
      hz -= tz * ht;
      let hl = Math.sqrt(hx * hx + hy * hy + hz * hz);
      if (hl < 1e-6) {
        // Degenerate: any perpendicular.
        hx = -tz;
        hy = 0;
        hz = tx;
        hl = Math.sqrt(hx * hx + hz * hz) || 1;
      }
      const w = Math.max(hl, minHalf) / hl;
      hx *= w;
      hy *= w;
      hz *= w;
      // Twist about the tangent, building up from the knot toward the end.
      const f = j / Math.max(1, vv - 1);
      const ang = twist * f * f * (3 - 2 * f);
      if (ang !== 0) {
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        // Rodrigues with h ⟂ t: h' = h cos + (t × h) sin.
        const qx = ty * hz - tz * hy;
        const qy = tz * hx - tx * hz;
        const qz = tx * hy - ty * hx;
        hx = hx * c + qx * s;
        hy = hy * c + qy * s;
        hz = hz * c + qz * s;
      }
      const o = j * 6;
      out[o] = cx - hx;
      out[o + 1] = cy - hy;
      out[o + 2] = cz - hz;
      out[o + 3] = cx + hx;
      out[o + 4] = cy + hy;
      out[o + 5] = cz + hz;
    }
  }

  /** Normals by central differences on the visual grid. */
  private sheetNormals(pc: Piece): void {
    const out = pc.pos;
    const vu = pc.vu;
    const vv = pc.vv;
    const nrm = pc.nrm;
    const s = pc.flip ? -1 : 1;
    for (let j = 0; j < vv; j++) {
      for (let i = 0; i < vu; i++) {
        const l = j * vu + Math.max(0, i - 1);
        const rr = j * vu + Math.min(vu - 1, i + 1);
        const u = Math.max(0, j - 1) * vu + i;
        const d = Math.min(vv - 1, j + 1) * vu + i;
        _a.set(out[rr * 3] - out[l * 3], out[rr * 3 + 1] - out[l * 3 + 1], out[rr * 3 + 2] - out[l * 3 + 2]);
        _b.set(out[d * 3] - out[u * 3], out[d * 3 + 1] - out[u * 3 + 1], out[d * 3 + 2] - out[u * 3 + 2]);
        _n.crossVectors(_a, _b).multiplyScalar(s);
        if (_n.lengthSq() < 1e-14) _n.set(0, 1, 0);
        _n.normalize();
        const o = (j * vu + i) * 3;
        nrm[o] = _n.x;
        nrm[o + 1] = _n.y;
        nrm[o + 2] = _n.z;
      }
    }
    if (pc.spec.config.sewEdges) for (let j=0;j<vv;j++) {
      const a=j*vu*3,b=(j*vu+vu-1)*3;
      _n.set(nrm[a]+nrm[b],nrm[a+1]+nrm[b+1],nrm[a+2]+nrm[b+2]).normalize();
      for (const k of [a,b]) { nrm[k]=_n.x;nrm[k+1]=_n.y;nrm[k+2]=_n.z; }
    }
  }

  private drawTube(pc: Piece): void {
    const rows = pc.spec.rows;
    const p = pc.cloth.pos;
    const sub = pc.sub;
    const vu = pc.vu;
    const vv = pc.vv;
    const ring = vu - 1;
    const out = pc.pos;
    const nrm = pc.nrm;
    const radii = pc.radii!;
    const braid = pc.spec.render.pattern === 'braid';
    if (!pc.line) pc.line = new Float64Array(vv * 3);
    const line = pc.line;
    const W = _cw;
    for (let j = 0; j < vv; j++) {
      const r = Math.min(rows - 2, Math.floor(j / sub));
      crWeights(j / sub - r, W);
      const b0 = Math.max(0, r - 1) * 3;
      const b1 = r * 3;
      const b2 = Math.min(rows - 1, r + 1) * 3;
      const b3 = Math.min(rows - 1, r + 2) * 3;
      for (let k = 0; k < 3; k++) line[j * 3 + k] = W[0] * p[b0 + k] + W[1] * p[b1 + k] + W[2] * p[b2 + k] + W[3] * p[b3 + k];
    }
    // Parallel-transport frames down the line.
    _prevN.set(1, 0, 0);
    for (let j = 0; j < vv; j++) {
      const a = Math.max(0, j - 1);
      const b = Math.min(vv - 1, j + 1);
      _t.set(line[b * 3] - line[a * 3], line[b * 3 + 1] - line[a * 3 + 1], line[b * 3 + 2] - line[a * 3 + 2]).normalize();
      _n.copy(_prevN).addScaledVector(_t, -_prevN.dot(_t));
      if (_n.lengthSq() < 1e-8) _n.set(0, 1, 0).addScaledVector(_t, -_t.y);
      _n.normalize();
      _prevN.copy(_n);
      _b.crossVectors(_t, _n);
      const f = j / (vv - 1);
      let rad = radii[j];
      for (let i = 0; i <= ring; i++) {
        const th = (i / ring) * Math.PI * 2;
        let rr = rad;
        if (braid) rr *= 0.86 + 0.2 * Math.abs(Math.sin(f * 40 + (i % 2) * 1.5 + th));
        const cx = Math.cos(th);
        const sy = Math.sin(th);
        _v.copy(_n).multiplyScalar(cx).addScaledVector(_b, sy);
        const o = (j * vu + i) * 3;
        out[o] = line[j * 3] + _v.x * rr;
        out[o + 1] = line[j * 3 + 1] + _v.y * rr;
        out[o + 2] = line[j * 3 + 2] + _v.z * rr;
        nrm[o] = _v.x;
        nrm[o + 1] = _v.y;
        nrm[o + 2] = _v.z;
      }
      if (j === vv - 1) rad = 0;
    }
    // Pinch the tip closed.
    const last = (vv - 1) * vu;
    for (let i = 0; i <= ring; i++) {
      const o = (last + i) * 3;
      out[o] = line[(vv - 1) * 3];
      out[o + 1] = line[(vv - 1) * 3 + 1];
      out[o + 2] = line[(vv - 1) * 3 + 2];
    }
  }

  dispose(): void {
    for (const pc of this.pieces) {
      pc.mesh.removeFromParent();
      pc.geo.dispose();
      (pc.mesh.material as MeshToonMaterial).dispose();
    }
    this.pieces.length = 0;
  }
}
