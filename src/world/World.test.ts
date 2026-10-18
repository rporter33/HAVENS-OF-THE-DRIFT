import { describe, expect, it } from 'vitest';
import { LOD, Mesh, PerspectiveCamera, Scene } from 'three';
import { World } from './World';
import { QUALITY } from '../render/quality';

function meshes(world: World, re: RegExp): Mesh[] {
  const out: Mesh[] = [];
  world.group.traverse((o) => {
    if ((o as Mesh).isMesh && re.test(o.name)) out.push(o as Mesh);
  });
  return out;
}

const one = (world: World, name: string) => meshes(world, new RegExp(`^${name}$`))[0];
const tris = (m: Mesh) => (m.geometry.index?.count ?? 0) / 3;

/** What the renderer does each frame before the shadow pass: let every LOD pick its level. */
function pickLevels(world: World, camera: PerspectiveCamera): void {
  camera.updateMatrixWorld();
  world.group.traverse((o) => {
    if ((o as LOD).isLOD) (o as LOD).update(camera);
  });
}

function cameraAt(x: number, y: number, z: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(60, 1, 0.5, 8000);
  camera.position.set(x, y, z);
  camera.updateMatrixWorld();
  return camera;
}

describe('World shadow stand-ins (PERF-05)', () => {
  it('casts from one stand-in per feature, never from the drawn levels', () => {
    const world = new World(new Scene(), QUALITY.high);
    const proxies = meshes(world, /-shadow$/);
    const features = world.terrain.islands.length + world.terrain.spires.length + world.terrain.arches.length + world.terrain.rocks.length;
    expect(proxies.length).toBe(features);
    expect(meshes(world, /-lod\d$/).every((m) => !m.castShadow)).toBe(true);
    expect(proxies.every((p) => p.castShadow && !p.receiveShadow)).toBe(true);
    // Only the coarsest level exists: the stand-in casts it as is.
    const roost = one(world, 'island-0-shadow');
    expect(roost.geometry).toBe(one(world, 'island-0-lod2').geometry);
    expect(roost.customDepthMaterial).toBeUndefined();
  });

  it('follows the drawn level: shadow mesh at level 0, the level itself beyond', () => {
    const world = new World(new Scene(), QUALITY.high);
    const roost = world.terrain.islands[0].def;
    const camera = cameraAt(roost.x, roost.y + 40, roost.z);
    world.flushBuilds(camera);
    pickLevels(world, camera);
    const proxy = one(world, 'island-0-shadow');
    const lod0 = one(world, 'island-0-lod0');
    expect(lod0.visible).toBe(true);
    // Its own geometry with level 0's top: about 60% of level 0's triangles, inset on cliffs.
    expect(proxy.geometry).not.toBe(lod0.geometry);
    expect(proxy.geometry).not.toBe(one(world, 'island-0-lod1').geometry);
    expect(tris(proxy)).toBeLessThan(tris(lod0) * 0.7);
    expect(tris(proxy)).toBeGreaterThan(tris(lod0) * 0.4);
    expect(proxy.customDepthMaterial).toBeDefined();

    // A spire drawn at level 0 casts from level 1.
    const spire = world.terrain.spires[0].def;
    const near = cameraAt(spire.x + 30, spire.topY, spire.z);
    world.flushBuilds(near);
    pickLevels(world, near);
    expect(one(world, 'spire-0-lod0').visible).toBe(true);
    expect(one(world, 'spire-0-shadow').geometry).toBe(one(world, 'spire-0-lod1').geometry);

    // Seen from 900 m the Roost draws level 1, and casts exactly that.
    const mid = cameraAt(roost.x + 1100, roost.y, roost.z);
    pickLevels(world, mid);
    expect(one(world, 'island-0-lod1').visible).toBe(true);
    expect(proxy.geometry).toBe(one(world, 'island-0-lod1').geometry);
    expect(proxy.customDepthMaterial).toBeUndefined();

    // Far away: fine levels and the shadow mesh are freed; the stand-in is moved off them first.
    const far = cameraAt(roost.x + 20000, roost.y, roost.z);
    world.update(0, far, far.position);
    pickLevels(world, far);
    expect(meshes(world, /^island-0-lod[01]$/).length).toBe(0);
    expect(proxy.geometry).toBe(one(world, 'island-0-lod2').geometry);
  });

  it('follows the quality setting', () => {
    const world = new World(new Scene(), QUALITY.high);
    world.setQuality(QUALITY.low);
    expect(meshes(world, /-shadow$/).every((p) => !p.castShadow)).toBe(true);
    world.setQuality(QUALITY.ultra);
    expect(meshes(world, /-shadow$/).every((p) => p.castShadow)).toBe(true);
    expect(meshes(world, /-lod\d$/).every((m) => !m.castShadow)).toBe(true);
  });
});
