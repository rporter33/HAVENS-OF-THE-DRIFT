import { Vector3 } from 'three';
import { Terrain } from '../world/terrain';
import { gateRing, GATE_RADIUS } from '../race/courseMath';
import { assetPosition, ASSET_CATALOG, buildAssets } from './assets';
import { regionLayout, regionRace, type Region, type Selection } from './region';

export interface RegionIssue { severity: 'error' | 'warning'; message: string; selection?: Selection }
/** Conservative clearance checks, not a flight-completion certificate. */
export function validateRegion(region: Region): RegionIssue[] {
  const issues: RegionIssue[] = [];
  const add = (severity: RegionIssue['severity'], message: string, selection?: Selection) => issues.push({ severity, message, selection });
  if (!region.islands.length) add('error', 'Add an island before playtesting.');
  const terrain = new Terrain(regionLayout(region));
  for (let i = 0; i < terrain.islands.length; i++) {
    const a = terrain.islands[i];
    for (const b of terrain.islands.slice(i + 1)) {
      if (Math.hypot(a.def.x - b.def.x, a.def.z - b.def.z) < a.maxRadius + b.maxRadius) {
        add('warning', (a.def.name ?? 'Island') + ' and ' + (b.def.name ?? 'Island') + ' have overlapping footprints.', { kind: 'island', id: a.def.id });
      }
    }
  }
  for (const a of region.assets) {
    const shape = terrain.islands.find(s => s.def.id === a.islandId);
    const p = assetPosition(a, terrain);
    const selection: Selection = { kind: 'asset', id: a.id };
    if (!shape || !p) { add('error', ASSET_CATALOG[a.kind].name + ' is outside its island.', selection); continue; }
    const footprint = ASSET_CATALOG[a.kind].footprint * a.scale;
    const n = shape.topNormal(p.x, p.z, new Vector3());
    if (n.y < Math.cos(15 * Math.PI / 180)) add('error', ASSET_CATALOG[a.kind].name + ' needs flatter ground (under 15°).', selection);
    let lo = Infinity; let hi = -Infinity;
    let edge = false;
    for (let k = 0; k < 12; k++) {
      const angle = k * Math.PI / 6;
      const x = p.x + Math.cos(angle) * footprint; const z = p.z + Math.sin(angle) * footprint;
      if (shape.normRadius(x, z) > 0.94) edge = true;
      const y = shape.topHeight(x, z); lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    if (edge) add('error', ASSET_CATALOG[a.kind].name + ' is too close to the island edge.', selection);
    if (hi - lo > 1.2) add('error', ASSET_CATALOG[a.kind].name + ' has uneven support; move it onto a flatter patch.', selection);
    else if (hi - lo > 0.35) add('warning', ASSET_CATALOG[a.kind].name + ' has sloping support; inspect its base on foot.', selection);
  }
  const assets = buildAssets(region, terrain);
  terrain.colliders.addAll(assets.colliders);
  try {
    const race = regionRace(region);
    const p = new Vector3();
    if (race) {
      const gate = gateRing(race);
      if (terrain.distance(p.set(gate.cx, gate.cy, gate.cz)) < GATE_RADIUS + 3) add('error', 'Start gate needs more clearance from rock or props.', { kind: 'start', id: 'start' });
      const points = [race.start.position, ...race.rings.map(r => r.position)];
      race.rings.forEach((r, i) => {
        const sel: Selection = { kind: 'checkpoint', id: region.checkpoints[i].id };
        if (terrain.distance(p.fromArray(r.position)) < r.radius + 3) add('error', 'Checkpoint ' + (i + 1) + ' needs its radius + 3 m of clearance.', sel);
        const from = points[i];
        if (new Vector3(...from).distanceTo(new Vector3(...r.position)) < 30) add('error', 'Checkpoint ' + (i + 1) + ' needs at least 30 m from the previous gate or checkpoint.', sel);
        const direction = new Vector3(...r.position).sub(new Vector3(...from)).normalize();
        if (direction.dot(new Vector3(...r.normal)) < 0.2) add('warning', 'Checkpoint ' + (i + 1) + ' faces away from its approach.', sel);
        const a = new Vector3(...from); const b = new Vector3(...r.position);
        const steps = Math.min(80, Math.max(2, Math.ceil(a.distanceTo(b) / 20)));
        for (let k = 1; k < steps; k++) {
          p.copy(a).lerp(b, k / steps);
          if (terrain.distance(p) < 8) {
            add('warning', 'The flight line into checkpoint ' + (i + 1) + ' passes within 8 m of rock or props. Fly this segment.', sel); break;
          }
        }
      });
    } else {
      if (terrain.distance(p.fromArray(region.start.position)) < 12) add('error', 'Flight start needs 12 m of open space.', { kind: 'start', id: 'start' });
      add('warning', 'No checkpoints: this will be a free-flight sandbox.');
    }
    for (let i = 0; i < region.assets.length; i++) {
      const a = region.assets[i]; const pa = assetPosition(a, terrain);
      for (const b of region.assets.slice(i + 1)) {
        const pb = assetPosition(b, terrain);
        if (pa && pb && pa.distanceTo(pb) < ASSET_CATALOG[a.kind].footprint * a.scale + ASSET_CATALOG[b.kind].footprint * b.scale) {
          add('warning', 'Two placed assets may overlap. Inspect their silhouettes and access.', { kind: 'asset', id: a.id });
        }
      }
    }
  } finally { assets.dispose(); }
  return issues;
}
