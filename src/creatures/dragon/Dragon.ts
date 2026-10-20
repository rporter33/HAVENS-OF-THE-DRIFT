// A dragon at rest (gate G12b): the fitted body and its look's parts at three LODs, bound by name to
// the game's own skeleton (rig.ts), shaded by the wyvern hide shader in its flight's palette
// (materials.ts) and posed by its own driver (idle.ts). No flight model, no player pose: it lies in
// render 08's pose with the idle life over it. Nothing in the normal build creates one before G12c.
//
// One skeleton serves every LOD. Each LOD is one skinned mesh in two draw calls (opaque, membrane)
// plus the whiskers' own mesh, bent on the CPU along their verlet strands. The LOD follows the
// camera's distance unless one is forced.

import { Bone, Group, Matrix4, Mesh, Quaternion, Skeleton, SkinnedMesh, Sphere, Vector3, type BufferAttribute, type Material } from 'three';
import { createWyvernUniforms, type WyvernUniforms } from '../wyvern/materials';
import { DRAGON_PARTS } from './catalog';
import { dragonPalette, type DragonLook } from './look';
import { applyDragonPalette, createDragonMaterials, createDragonShadeUniforms, type DragonShadeUniforms } from './materials';
import { buildDragonLod, eyePatch, type DragonLodGeometry } from './mesh';
import { clawSites, eyeFrame } from './features';
import { DragonIdle } from './idle';
import type { DragonPartPiece } from './parts';
import { dragonRig, type DragonRigDef } from './rig';
import { WhiskerDeform } from './whiskers';
import type { WhiteDragonAssets } from './load';

export type DragonLod = 0 | 1 | 2;

/** Camera distances (m) past which the dragon drops to LOD1 and LOD2. */
export const DRAGON_LOD_DISTANCE = [70, 160] as const;

export interface DragonOptions {
  look: DragonLook;
  /** Seeds the idle's timed events. */
  seed?: number;
  /** Cued blinks (s); any cue holds the natural ones off. */
  blinks?: number[];
  /** Hold the idle still (the bare pose). */
  still?: boolean;
  /** The bind pose, standing with the wings spread (implies still). */
  bind?: boolean;
  /** 'built' (default): the built membrane, claws and eyes (features.ts); 'fitted': the fitted
   * body's own, for comparison. */
  features?: 'built' | 'fitted';
}

interface LodView {
  data: DragonLodGeometry;
  mesh: SkinnedMesh;
  materials: Material[];
  whiskers: Mesh | null;
  deform: WhiskerDeform | null;
}

const _c = new Vector3();
const _m = new Matrix4();

/** The pieces of a look's parts at a LOD. */
export function piecesFor(look: DragonLook, all: DragonPartPiece[], lod: number): DragonPartPiece[] {
  const names = new Set(Object.values(look.parts).flatMap((id) => DRAGON_PARTS.find((p) => p.id === id)?.pieces ?? []));
  return all.filter((p) => p.lod === lod && names.has(p.piece));
}

export class Dragon {
  readonly group = new Group();
  readonly rig: DragonRigDef = dragonRig();
  readonly uniforms: WyvernUniforms = createWyvernUniforms();
  readonly shade: DragonShadeUniforms = createDragonShadeUniforms();
  readonly idle: DragonIdle;
  readonly bones: Bone[];
  readonly skeleton: Skeleton;
  private readonly lods: LodView[];
  private look: DragonLook;
  private forced: DragonLod | null = null;
  private current: DragonLod = 0;
  private readonly local = new Vector3();

  constructor(assets: WhiteDragonAssets, opts: DragonOptions) {
    const rig = this.rig;
    this.look = { ...opts.look, parts: { ...opts.look.parts } };
    this.group.name = 'dragon';

    // Bones: identity rest rotations, positions relative to the parent (as the wyvern's).
    this.bones = rig.bones.map((d) => {
      const b = new Bone();
      b.name = d.name;
      return b;
    });
    const inverses: Matrix4[] = [];
    rig.bones.forEach((d, i) => {
      const b = this.bones[i];
      if (d.parent >= 0) {
        this.bones[d.parent].add(b);
        b.position.subVectors(d.pos, rig.bones[d.parent].pos);
      } else b.position.copy(d.pos);
      inverses.push(new Matrix4().makeTranslation(-d.pos.x, -d.pos.y, -d.pos.z));
    });
    this.group.add(this.bones[0]);
    this.skeleton = new Skeleton(this.bones, inverses);

    const strands = assets.parts.pieces.find((p) => p.strands.length && piecesFor(this.look, [p], p.lod).length)?.strands ?? null;
    this.idle = new DragonIdle(rig, { seed: opts.seed, strands, blinks: opts.blinks, still: opts.still, bind: opts.bind });

    // The claw sites and the eyeball come from LOD0's body, so every LOD has the same ones.
    const fitted = opts.features === 'fitted';
    const built = fitted
      ? { wings: 'fitted' as const, claws: null, eye: null }
      : { wings: 'built' as const, claws: clawSites(assets.bodies[0], rig), eye: eyeFrame(eyePatch(assets.bodies[0], rig), rig) };
    this.lods = assets.bodies.map((body, lod) => {
      const data = buildDragonLod(rig, body, piecesFor(this.look, assets.parts.pieces, lod), lod, built);
      const materials = createDragonMaterials(this.uniforms, this.shade, (2 - lod) as 0 | 1 | 2);
      const mesh = new SkinnedMesh(data.geometry, materials);
      mesh.bind(this.skeleton, _m.identity());
      // The whole resting dragon, tail curl and raised wings included.
      mesh.boundingSphere = new Sphere(new Vector3(2, 2, -1.5), 12);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `dragon-lod${lod}`;
      this.group.add(mesh);
      let whiskers: Mesh | null = null;
      let deform: WhiskerDeform | null = null;
      if (data.whiskers && this.idle.whiskers) {
        whiskers = new Mesh(data.whiskers.geometry, materials[0]);
        whiskers.name = `dragon-whiskers-lod${lod}`;
        whiskers.castShadow = true;
        whiskers.frustumCulled = false;
        this.group.add(whiskers);
        deform = new WhiskerDeform(data.whiskers.strands, data.whiskers.rest, data.whiskers.restNormal, data.whiskers.strand);
      }
      return { data, mesh, materials, whiskers, deform };
    });

    const u = this.uniforms;
    const eye = this.lods[0].data.eye;
    u.uEyeCenter.value.copy(eye.center);
    u.uEyeAxis.value.copy(eye.axis);
    u.uEyeRadius.value = eye.radius;
    this.shade.uDwEyeFw.value.copy(eye.forward);
    this.shade.uDwEyeUp.value.copy(eye.up);
    this.shade.uDwEyeLid.value = fitted ? 0 : 1;
    u.uBodyScale.value = rig.props.shape.torsoLength / 3.3;
    // Folded at rest: the membranes a little bunched; the cheek fins ripple faintly in the air.
    u.uFold.value = 0.15;
    u.uRipple.value = 0.25;
    u.uContour.value = 1;
    applyDragonPalette(u, this.shade, dragonPalette(this.look));
    this.setLod(null);
  }

  /** Triangles per LOD (skinned mesh plus whiskers). */
  triangles(lod: DragonLod): number {
    const d = this.lods[lod].data;
    return d.triangles + (d.whiskers?.triangles ?? 0);
  }

  get lod(): DragonLod {
    return this.current;
  }

  get currentLook(): DragonLook {
    return this.look;
  }

  /** Force a LOD, or null to follow the camera's distance. */
  setLod(lod: DragonLod | null): void {
    this.forced = lod;
    this.show(lod ?? this.current);
  }

  /** A new hue shift on the same parts: a uniform update. */
  setHueShift(deg: number): void {
    this.look = { ...this.look, hueShift: deg };
    applyDragonPalette(this.uniforms, this.shade, dragonPalette(this.look));
  }

  /**
   * Advance the idle and pose the skeleton. `target` (world) is what the head follows, or null;
   * `camera` (world) picks the LOD.
   */
  update(dt: number, target: Vector3 | null, camera: Vector3 | null): void {
    this.group.updateMatrixWorld();
    let local: Vector3 | null = null;
    if (target) local = this.group.worldToLocal(this.local.copy(target));
    this.idle.update(dt, local);
    const pose = this.idle.pose;
    for (let i = 0; i < this.bones.length; i++) this.bones[i].quaternion.copy(pose.local[i]);
    this.bones[this.rig.idx.root].position.copy(pose.rootPos);
    this.bones[this.rig.idx.breath].scale.copy(this.idle.breathScale);
    this.uniforms.uBlink.value = this.idle.blink;

    if (this.forced === null && camera) {
      // The dragon's middle, about 2 m above the platform.
      const d = camera.distanceTo(this.group.localToWorld(_c.set(1.5, 2, -1.5)));
      this.show(d > DRAGON_LOD_DISTANCE[1] ? 2 : d > DRAGON_LOD_DISTANCE[0] ? 1 : 0);
    }
    this.group.updateMatrixWorld(true);

    const view = this.lods[this.current];
    if (view.whiskers && view.deform && this.idle.whiskers) {
      const g = view.whiskers.geometry;
      const pos = g.getAttribute('position') as BufferAttribute;
      const nor = g.getAttribute('normal') as BufferAttribute;
      const headQ: Quaternion = this.idle.model.q[this.rig.idx.head];
      view.deform.apply(this.idle.whiskers, this.idle.whiskerBlend, headQ, pos.array as Float32Array, nor.array as Float32Array);
      pos.needsUpdate = true;
      nor.needsUpdate = true;
    }
  }

  /** World position of a bone's pivot, as of the last update. */
  bonePosition(name: string, out: Vector3): Vector3 {
    const b = this.bones.find((x) => x.name === name);
    return b ? b.getWorldPosition(out) : out.copy(this.group.position);
  }

  /** The rest eye point (world): where the camera's "head" shots aim. */
  eyeWorld(out: Vector3): Vector3 {
    return this.group.localToWorld(out.copy(this.idle.eyePoint));
  }

  dispose(): void {
    for (const l of this.lods) {
      l.data.geometry.dispose();
      l.data.whiskers?.geometry.dispose();
      for (const m of l.materials) m.dispose();
    }
    this.skeleton.dispose();
    this.group.removeFromParent();
  }

  private show(lod: DragonLod): void {
    this.current = lod;
    this.lods.forEach((l, i) => {
      l.mesh.visible = i === lod;
      if (l.whiskers) l.whiskers.visible = i === lod;
    });
  }
}

