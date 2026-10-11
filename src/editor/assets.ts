import { Box3, Group, Matrix4, Mesh, Vector3 } from 'three';
import type { Collider } from '../core/types';
import { GeoBuilder, xf } from '../world/dressing/geom';
import { box, column, crate, resetJitter, stoneBlock } from '../world/dressing/structures/kit';
import { dressMaterial } from '../world/dressing/materials';
import { colBox, colCyl } from '../world/dressing/colliderKit';
import type { Terrain } from '../world/terrain';
import type { AssetKind, PlacedAsset, Region } from './region';

export const ASSET_CATALOG: Record<AssetKind, { name: string; description: string; footprint: number; reference: string }> = {
  column: { name: 'Limestone column', description: 'Broad shaft, simple base and capital.', footprint: 1.8, reference: 'Art master §07: broad, simplified limestone columns.' },
  terrace: { name: 'Blue terrace block', description: 'Weathered limestone with a quiet blue plaster band.', footprint: 3.8, reference: 'Art master §07 and palette: limestone terraces, blue painted plaster.' },
  crate: { name: 'Supply crate', description: 'A modest timber prop for a working terrace.', footprint: 0.85, reference: 'Art master §01: craftsmanship and travel; existing timber kit.' },
};
const STONE = '#D8D1C2';
const BLUE = '#7FA8C4';

export function assetSeed(id: string): number {
  let seed = 2166136261;
  for (let i = 0; i < id.length; i++) seed = Math.imul(seed ^ id.charCodeAt(i), 16777619);
  return seed >>> 0;
}
export function assetPosition(a: PlacedAsset, terrain: Terrain): Vector3 | null {
  const shape = terrain.islands.find(d => d.def.id === a.islandId);
  if (!shape) return null;
  const x = shape.def.x + a.x;
  const z = shape.def.z + a.z;
  if (shape.normRadius(x, z) >= 1) return null;
  return new Vector3(x, shape.topHeight(x, z), z);
}
export interface AssetBuild { group: Group; objects: Map<string, Group>; colliders: Collider[]; dispose(): void }

/** The same procedural geometry and collision construction is used by preview, validation and playtest. */
export function buildAssets(region: Region, terrain: Terrain): AssetBuild {
  const group = new Group();
  group.name = 'authored-assets';
  const objects = new Map<string, Group>();
  const colliders: Collider[] = [];
  const material = dressMaterial({});
  for (const a of region.assets) {
    const position = assetPosition(a, terrain);
    if (!position) continue;
    resetJitter(assetSeed(a.id));
    const b = new GeoBuilder();
    const identity = new Matrix4();
    if (a.kind === 'column') column(b, identity, 0, 0, 0, 0.85, 7, STONE);
    if (a.kind === 'terrace') {
      stoneBlock(b, identity, 0, 0.6, 0, 6, 1.2, 4, assetSeed(a.id), STONE, 0);
      box(b, identity, 0, 0.78, 2.02, 5.8, 0.28, 0.1, BLUE);
    }
    if (a.kind === 'crate') crate(b, identity, 0, 0, 0, 1.2);
    const root = new Group();
    root.name = 'asset-' + a.id;
    root.position.copy(position);
    root.rotation.y = a.yaw * Math.PI / 180;
    root.scale.setScalar(a.scale);
    root.userData.selection = { kind: 'asset', id: a.id };
    const geometry = b.build(true);
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    root.add(mesh); group.add(root); objects.set(a.id, root);
    const F = xf(position.x, position.y, position.z, 0, root.rotation.y, 0);
    const s = a.scale;
    if (a.kind === 'column') {
      const r = 0.85 * s;
      colBox(colliders, F, 0, 0.2 * s, 0, r * 2.8, 0.4 * s, r * 2.8);
      colBox(colliders, F, 0, 0.5 * s, 0, r * 2.4, 0.25 * s, r * 2.4);
      colCyl(colliders, F, 0, 0.6 * s, 0, r, 6.4 * s);
      colBox(colliders, F, 0, 7.15 * s, 0, r * 2.6, 0.3 * s, r * 2.6);
      colBox(colliders, F, 0, 6.9 * s, 0, r * 2.2, 0.25 * s, r * 2.2);
    } else {
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox as Box3;
      const centre = bounds.getCenter(new Vector3()).multiplyScalar(s);
      const size = bounds.getSize(new Vector3()).multiplyScalar(s);
      colBox(colliders, F, centre.x, centre.y, centre.z, size.x, size.y, size.z);
    }
  }
  return { group, objects, colliders, dispose() {
    group.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); });
    material.dispose(); group.removeFromParent();
  } };
}
