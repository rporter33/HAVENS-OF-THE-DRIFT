// The visible archipelago: island, spire, arch and rock-form meshes with distance LODs, plus floating debris.
// Vegetation, water and structures belong to the Dressing system (world/dressing/).
//
// Shadows: the level being drawn never casts. Each feature casts from a shadow-only stand-in
// (render/shadowOnly.ts) that follows the drawn level in the same frame (BoundsLOD.onSelect):
//   - drawn at level 1 or 2: that level's geometry, exactly as before;
//   - drawn at level 0: islands cast from a shadow mesh with level 0's exact top (hills and
//     terraces shadow themselves as drawn; at a low sun any other surface would band) and coarse
//     cliffs and underside; spires and arches cast from level 1.
// The Roost's shadow pass draws 41k triangles instead of 68k, Rootfall's 58k instead of 109k.
//
// Build strategy: the coarsest LOD of everything is built up front (~0.1 s for the whole world),
// finer LODs are built lazily as the camera approaches, nearest first, inside a per-frame time
// budget (builders are generators that yield between rings). Fine LODs that fall far behind the
// camera are dropped again to bound memory. The first update builds whatever the starting view
// needs synchronously, and with ?manual=1 (headless captures) the budget is unlimited so every
// capture shows final detail.

import { Group, Mesh, MeshDepthMaterial, type BufferGeometry, type PerspectiveCamera, type Scene, type Vector3 } from 'three';
import type { WorldSystem } from '../game/contracts';
import type { QualityProfile } from '../render/quality';
import { readDebugParams } from '../debug/params';
import { makeShadowOnly, shadowOnlyMaterial } from '../render/shadowOnly';
import { LAYOUT, type WorldLayout } from './layout';
import { Terrain } from './terrain';
import type { ArchShape, IslandShape, SpireShape } from './islandShape';
import { BoundsLOD, boundsDistance, type Bounds } from './mesh/BoundsLOD';
import { ISLAND_LODS, ISLAND_SHADOW_LOD, buildIslandMesh, islandLodDistances } from './mesh/islandMesh';
import { SPIRE_LODS, buildSpireMesh } from './mesh/spireMesh';
import { ARCH_LODS, buildArchMesh } from './mesh/archMesh';
import { ROCK_LODS, buildRockFormMesh } from './mesh/rockFormMesh';
import type { RockFormShape } from './rockForm';
import { toGeometry, type MeshData } from './mesh/MeshBuilder';
import { terrainMaterial } from './mesh/terrainMaterial';
import { Debris } from './mesh/debris';

/** Per-frame build budget (ms) during normal play. */
const BUILD_BUDGET_MS = 3;
/** Start building a finer level this far (m) before the camera reaches its switch distance. */
const PREFETCH = 160;
/** Drop a finer level once the camera is this many times its switch distance away. */
const EVICT_FACTOR = 2.6;
/**
 * How far (m) a coarser stand-in is pulled in along its normals on steep faces in the shadow pass.
 * A coarse cliff bulges out of the drawn rock in places (sedimentary ledges are carved only into
 * level 0); where it does, a cliff turned away from the sun "sees" past its own rock and shows lit
 * blotches. Inset, the cliff stays inside the rock. Anything less steep than a cliff
 * (normal.y > 0.3) stays put.
 */
const PROXY_INSET = 1.2;
/** LOD distance scale per quality level. */
const LOD_SCALE: Record<QualityProfile['level'], number> = { low: 0.6, medium: 0.8, high: 1, ultra: 1.35 };

type Builder = (level: number) => Generator<void, { data: MeshData; splitIndex?: number }>;

/** Which part of an island mesh to draw: all, the top only (camera on/above it), or the underside only. */
type Part = 'all' | 'top' | 'under';

interface Feature {
  name: string;
  lod: BoundsLOD;
  bounds: Bounds;
  /** Base switch distance of each level (level 0 at 0), before quality scaling. */
  distances: number[];
  meshes: (Mesh | null)[];
  build: Builder;
  /** Islands only: the shape and the part currently drawn. */
  island?: IslandShape;
  part: Part;
  /** Shadow-only stand-in (shares the geometry of a built level, or casts from shadowGeo). */
  proxy: Mesh | null;
  /** Islands only: builds the shadow mesh (ISLAND_SHADOW_LOD). */
  buildShadow?: () => Generator<void, { data: MeshData; splitIndex?: number }>;
  /** The shadow mesh, while the camera is within level 0's range. */
  shadowGeo: BufferGeometry | null;
}

interface Job {
  feature: Feature;
  /** A visible level, or SHADOW_JOB for the feature's shadow mesh. */
  level: number;
  gen: Generator<void, { data: MeshData; splitIndex?: number }>;
}

const SHADOW_JOB = -1;

export interface WorldStats {
  /** Triangles per level, summed over every feature that currently has that level built. */
  trianglesBuilt: number[];
  /** Time to construct the world (shapes, coarse LODs, debris), ms. */
  constructMs: number;
  /** Total time spent in lazy builds so far, ms. */
  lazyBuildMs: number;
  lazyBuilds: number;
}

export class World implements WorldSystem {
  readonly terrain: Terrain;
  readonly layout: WorldLayout;
  readonly group = new Group();
  readonly stats: WorldStats = { trianglesBuilt: [0, 0, 0], constructMs: 0, lazyBuildMs: 0, lazyBuilds: 0 };
  private features: Feature[] = [];
  private job: Job | null = null;
  private quality: QualityProfile;
  private lodScale: number;
  private unlimitedBudget: boolean;
  private firstUpdate = true;
  private debris: Debris;
  /** Shadow-only stand-ins. */
  private proxies = new Group();

  constructor(scene: Scene, quality: QualityProfile, layout: WorldLayout = LAYOUT) {
    const t0 = performance.now();
    this.layout = layout;
    this.terrain = new Terrain(this.layout);
    this.quality = quality;
    this.lodScale = LOD_SCALE[quality.level];
    this.unlimitedBudget = readDebugParams().manual;
    this.group.name = 'world';
    this.proxies.name = 'world-shadow-proxies';
    this.group.add(this.proxies);

    for (const shape of this.terrain.islands) this.addIsland(shape);
    for (const shape of this.terrain.spires) this.addSpire(shape);
    for (const shape of this.terrain.arches) this.addArch(shape);
    for (const shape of this.terrain.rocks) this.addRock(shape);
    // The coarsest level of everything, now: the whole archipelago is visible from the start.
    for (const f of this.features) this.install(f, f.distances.length - 1, runBuilder(f.build(f.distances.length - 1)));

    this.debris = new Debris(this.terrain, quality);
    this.group.add(this.debris.group);
    scene.add(this.group);
    this.stats.constructMs = performance.now() - t0;
  }

  // --- Features -------------------------------------------------------------------------------

  private addFeature(
    name: string,
    bounds: Bounds,
    distances: number[],
    position: Vector3Like,
    build: Builder,
    island?: IslandShape,
    buildShadow?: Feature['buildShadow'],
  ): void {
    const lod = new BoundsLOD(bounds);
    lod.name = name;
    lod.position.set(position[0], position[1], position[2]);
    lod.updateMatrix();
    lod.matrixAutoUpdate = false;
    this.group.add(lod);
    const index = this.features.length;
    lod.onSelect = (object) => this.syncProxy(this.features[index], object as Mesh);
    this.features.push({ name, lod, bounds, distances, meshes: distances.map(() => null), build, island, part: 'all', proxy: null, buildShadow, shadowGeo: null });
  }

  private addIsland(shape: IslandShape): void {
    const d = shape.def;
    this.addFeature(
      `island-${d.id}`,
      { kind: 'cylinder', x: d.x, z: d.z, radius: shape.maxRadius + 1, minY: shape.minY, maxY: shape.maxY },
      islandLodDistances(d.radius),
      [d.x, d.y, d.z],
      (level) => buildIslandMesh(shape, ISLAND_LODS[level]),
      shape,
      () => buildIslandMesh(shape, ISLAND_SHADOW_LOD),
    );
  }

  private addSpire(shape: SpireShape): void {
    const d = shape.def;
    this.addFeature(
      `spire-${d.id}`,
      { kind: 'cylinder', x: d.x, z: d.z, radius: shape.maxRadius, minY: d.tipY, maxY: d.topY },
      SPIRE_LODS.map((l) => l.distance),
      [d.x, d.topY, d.z],
      (level) => buildSpireMesh(shape, SPIRE_LODS[level]),
    );
  }

  private addArch(shape: ArchShape): void {
    const c = shape.center;
    this.addFeature(
      `arch-${shape.def.id}`,
      { kind: 'sphere', x: c.x, y: c.y, z: c.z, radius: shape.boundRadius },
      ARCH_LODS.map((l) => l.distance),
      [c.x, c.y, c.z],
      (level) => buildArchMesh(shape, ARCH_LODS[level], this.terrain),
    );
  }

  private addRock(shape: RockFormShape): void {
    const c = shape.center;
    const d = shape.def;
    this.addFeature(
      `rock-${d.id}`,
      { kind: 'sphere', x: c.x, y: c.y, z: c.z, radius: shape.boundRadius },
      ROCK_LODS.map((l) => l.distance),
      [d.x, d.y, d.z],
      (level) => buildRockFormMesh(shape, ROCK_LODS[level]),
    );
  }

  private install(f: Feature, level: number, result: { data: MeshData; splitIndex?: number }): void {
    const data = result.data;
    const mesh = new Mesh(toGeometry(data), terrainMaterial());
    mesh.geometry.userData.split = result.splitIndex ?? -1;
    applyPart(mesh, f.part);
    mesh.name = `${f.name}-lod${level}`;
    // The stand-in casts instead (see updateProxy).
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    f.meshes[level] = mesh;
    if (!f.proxy) this.createProxy(f, mesh);
    // Picks the visible level, which points the stand-in at what it should cast from.
    f.lod.setLevel(mesh, f.distances[level] * this.lodScale);
    this.stats.trianglesBuilt[level] += data.indices.length / 3;
  }

  /**
   * Point the stand-in at what to cast from while `drawn` is the visible level (see the header).
   * Runs whenever the LOD picks a level, so it matches the drawn rock in the same frame.
   */
  private syncProxy(f: Feature, drawn: Mesh): void {
    const p = f.proxy;
    if (!p) return;
    let geometry = drawn.geometry;
    let depth: MeshDepthMaterial | undefined;
    if (drawn === f.meshes[0]) {
      const coarser = f.shadowGeo ?? (f.island ? null : f.meshes[1]?.geometry);
      if (coarser) {
        geometry = coarser;
        depth = insetDepthMaterial();
      }
    }
    if (p.geometry !== geometry) p.geometry = geometry;
    if (p.customDepthMaterial !== depth) p.customDepthMaterial = depth;
  }

  /** Re-sync the stand-in with whatever level is visible now. */
  private resyncProxy(f: Feature): void {
    const level = f.lod.levels[f.lod.getCurrentLevel()];
    if (level) this.syncProxy(f, level.object as Mesh);
  }

  private createProxy(f: Feature, mesh: Mesh): void {
    // A level's geometry is shared (with its hidden-part draw range): no extra GPU memory. Culled
    // from the main pass; the shadow pass culls it against the shadow box like any caster.
    const p = makeShadowOnly(new Mesh(mesh.geometry, shadowOnlyMaterial()));
    p.name = `${f.name}-shadow`;
    p.position.copy(f.lod.position);
    p.updateMatrix();
    p.matrixAutoUpdate = false;
    p.castShadow = this.quality.shadows;
    p.receiveShadow = false;
    f.proxy = p;
    this.proxies.add(p);
  }

  private evict(f: Feature, level: number): void {
    const mesh = f.meshes[level];
    if (!mesh) return;
    f.meshes[level] = null;
    // Re-picking the visible level moves the stand-in off this geometry before it is freed.
    f.lod.removeLevel(f.distances[level] * this.lodScale);
    f.lod.refresh();
    this.stats.trianglesBuilt[level] -= (mesh.geometry.index?.count ?? 0) / 3;
    mesh.geometry.dispose();
    // The shadow mesh serves the same range as level 0.
    if (level === 0) this.evictShadow(f);
  }

  private installShadow(f: Feature, result: { data: MeshData; splitIndex?: number }): void {
    f.shadowGeo?.dispose();
    f.shadowGeo = toGeometry(result.data);
    f.shadowGeo.name = `${f.name}-shadow`;
    // The hidden part casts nothing either, as with the drawn levels (cullHiddenParts).
    f.shadowGeo.userData.split = result.splitIndex ?? -1;
    applyPartTo(f.shadowGeo, f.part);
    this.resyncProxy(f);
  }

  private evictShadow(f: Feature): void {
    const geo = f.shadowGeo;
    if (!geo) return;
    f.shadowGeo = null;
    this.resyncProxy(f);
    geo.dispose();
  }

  // --- Per frame --------------------------------------------------------------------------------

  /** The finest level a camera at distance `dist` needs (prefetching ahead of the switch). */
  private neededLevel(f: Feature, dist: number): number {
    const n = f.distances.length;
    for (let k = 0; k < n - 1; k++) {
      if (dist < f.distances[k + 1] * this.lodScale + PREFETCH) return k;
    }
    return n - 1;
  }

  /**
   * The nearest feature missing a level it needs (or, once every visible level is in, the nearest
   * island in level 0's range missing its shadow mesh), and evicts levels far behind the camera.
   */
  private nextMissing(cam: Vector3, evict: boolean): Job | null {
    let best: Feature | null = null;
    let bestLevel = 0;
    let bestDist = Infinity;
    let shadow: Feature | null = null;
    let shadowDist = Infinity;
    const features = this.features;
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      const dist = boundsDistance(f.bounds, cam.x, cam.y, cam.z);
      const need = this.neededLevel(f, dist);
      // The finest needed level first: a teleport should not wait on intermediate levels.
      for (let k = need; k < f.distances.length - 1; k++) {
        if (!f.meshes[k] && dist < bestDist) {
          best = f;
          bestLevel = k;
          bestDist = dist;
        }
      }
      if (need === 0 && f.buildShadow && !f.shadowGeo && dist < shadowDist) {
        shadow = f;
        shadowDist = dist;
      }
      if (evict) {
        for (let k = 0; k < f.distances.length - 1; k++) {
          if (f.meshes[k] && dist > f.distances[k + 1] * this.lodScale * EVICT_FACTOR + PREFETCH) this.evict(f, k);
        }
      }
    }
    if (best) return { feature: best, level: bestLevel, gen: best.build(bestLevel) };
    return shadow?.buildShadow ? { feature: shadow, level: SHADOW_JOB, gen: shadow.buildShadow() } : null;
  }

  update(dt: number, camera: PerspectiveCamera, _focus: Vector3): void {
    const cam = camera.position;
    const unlimited = this.unlimitedBudget || this.firstUpdate;
    this.firstUpdate = false;
    if (!this.job) this.job = this.nextMissing(cam, true);
    const deadline = performance.now() + BUILD_BUDGET_MS;
    while (this.job) {
      const t0 = performance.now();
      let done = false;
      while (unlimited || performance.now() < deadline) {
        const r = this.job.gen.next();
        if (r.done) {
          if (this.job.level === SHADOW_JOB) this.installShadow(this.job.feature, r.value);
          else this.install(this.job.feature, this.job.level, r.value);
          done = true;
          break;
        }
      }
      this.stats.lazyBuildMs += performance.now() - t0;
      if (!done) break;
      this.stats.lazyBuilds++;
      // Keep going while there is time (always, without a budget) and work left.
      this.job = unlimited || performance.now() < deadline ? this.nextMissing(cam, false) : null;
    }
    this.debris.update(dt, camera);
    this.cullHiddenParts(cam);
  }

  /**
   * An island's own rock hides half of it from a camera inside its footprint: from on top you
   * can't see the underside, from underneath you can't see the top. Draw only the visible part.
   */
  private cullHiddenParts(cam: Vector3): void {
    const features = this.features;
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      const shape = f.island;
      if (!shape) continue;
      const d = shape.def;
      let part: Part = 'all';
      // Well inside the footprint only: near the rim (and across a bay) both parts can show.
      const dx = cam.x - d.x;
      const dz = cam.z - d.z;
      if (dx * dx + dz * dz < shape.maxRadius * shape.maxRadius && shape.normRadius(cam.x, cam.z) < 0.9) {
        if (cam.y > shape.topHeight(cam.x, cam.z) + 0.5) part = 'top';
        else if (cam.y < shape.bottomHeight(cam.x, cam.z) - 0.5) part = 'under';
      }
      if (part === f.part) continue;
      f.part = part;
      for (let k = 0; k < f.meshes.length; k++) if (f.meshes[k]) applyPart(f.meshes[k]!, part);
      if (f.shadowGeo) applyPartTo(f.shadowGeo, part);
    }
  }

  /** Builds every level the current view needs right now (debug captures, teleports). */
  flushBuilds(camera: PerspectiveCamera): void {
    this.firstUpdate = true;
    this.update(0, camera, camera.position);
  }

  setQuality(q: QualityProfile): void {
    this.quality = q;
    const scale = LOD_SCALE[q.level];
    for (const f of this.features) {
      for (const level of f.lod.levels) {
        const k = f.meshes.indexOf(level.object as Mesh);
        if (k >= 0) level.distance = f.distances[k] * scale;
      }
      f.lod.refresh();
      if (f.proxy) f.proxy.castShadow = q.shadows;
    }
    this.lodScale = scale;
    this.debris.setQuality(q);
  }
}

type Vector3Like = [number, number, number];

let insetMaterial: MeshDepthMaterial | null = null;

/**
 * Shadow-pass material for the stand-ins: steep faces are pulled in by PROXY_INSET along their
 * normals (object space is world-aligned: features are only translated), tops stay put.
 */
function insetDepthMaterial(): MeshDepthMaterial {
  if (insetMaterial) return insetMaterial;
  const m = new MeshDepthMaterial();
  m.name = 'world-shadow-inset';
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `vec3 transformed = vec3( position ) - normal * ( ${PROXY_INSET.toFixed(3)} * ( 1.0 - smoothstep( 0.1, 0.3, normal.y ) ) );`,
    );
  };
  m.customProgramCacheKey = () => 'dw-shadow-inset';
  insetMaterial = m;
  return m;
}


function runBuilder<T>(gen: Generator<void, T>): T {
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}

/** Limit an island mesh's draw range to the part that can be seen. */
function applyPart(mesh: Mesh, part: Part): void {
  applyPartTo(mesh.geometry, part);
}

/** Same for a bare geometry; the split (index count of the top part) is in userData.split. */
function applyPartTo(geometry: BufferGeometry, part: Part): void {
  const split = (geometry.userData.split as number | undefined) ?? -1;
  const total = geometry.index?.count ?? 0;
  if (split < 0 || part === 'all') geometry.setDrawRange(0, Infinity);
  else if (part === 'top') geometry.setDrawRange(0, split);
  else geometry.setDrawRange(split, total - split);
}
