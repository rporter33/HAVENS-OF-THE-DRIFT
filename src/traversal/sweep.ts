import { Vector3 } from 'three';
import type { Collider } from '../core/types';
import type { Terrain, TerrainSolid, RockColumns } from '../world/terrain';
import { signedDistance } from '../world/colliders';
import { AnchorRegistry } from './anchors';
export interface SweepHit { fraction: number; point: Vector3; normal: Vector3; anchorId: string | null; exhausted?: boolean }
export interface SweepWorld { readonly revision?: number; anchorValid(id: string): boolean; sweep(from: Vector3, to: Vector3, radius: number, ignoreAnchorId?: string): SweepHit | null }
/** Conservative fixed query budgets for the isolated V1; overload blocks rather than tunnels. */
export const SWEEP_LIMITS = Object.freeze({ length: 128, candidates: 256, tetherSpacing: .04 });
/** Exact-distance conservative advancement against a sphere-expanded primitive (including thin boxes).
 * Iteration exhaustion fails closed rather than permitting tunnelling. */
export function sweepShape(from: Vector3, to: Vector3, radius: number, shape: Collider): SweepHit | null {
  const delta = to.clone().sub(from), length = delta.length();
  const point = from.clone(), normal = new Vector3();
  let travel = 0;
  for (let i = 0; i < 192; i++) {
    point.copy(from).addScaledVector(delta, length > 0 ? travel / length : 0);
    const gap = signedDistance(shape, point, normal) - radius;
    if (travel === 0 && gap >= -1e-6 && delta.dot(normal) >= 0) return null;
    if (gap <= 1e-6) return { fraction: length > 0 ? travel / length : 0, point, normal, anchorId: null };
    if (travel + gap > length || length === 0) return null;
    travel += gap;
  }
  point.copy(from).addScaledVector(delta, travel / length);
  return { fraction: travel / length, point, normal, anchorId: null, exhausted: true };
}
/** V1 world adapter. Structures use exact primitive sweeps. Rock uses the shared analytic
 * contact query with a conservative sampled envelope, then bisection. Probe inflation by half
 * the spacing covers the swept segment between samples, including grazing contacts. This adds
 * at most 1 cm of body/projectile rock clearance, or 2 cm for the thinner tether;
 * it never derives collision from the render mesh. Tether sampling uses a wider
 * conservative envelope, preserving full line obstruction checks at one quarter
 * of the previous query count. Primitive sweeps stay exact.
 * Solid-bound interval clipping skips empty space; a bounded 16384-query budget
 * fails closed for pathological grazing displacement. Soft foliage is ignored.
 */
export class TraversalWorld implements SweepWorld {
  get revision(): number { return this.terrain.colliders.revision; }
  private readonly rockAnchors = new Map<string,{solid:TerrainSolid; definition:string}>();
  constructor(readonly terrain: Terrain, readonly anchors = new AnchorRegistry([],true)) {}
  private rockId(solid: TerrainSolid): string | null {
    if (!this.anchors.allSolids) return null;
    const id = `rock-${solid.type}-${solid.shape.def.id}`;
    if (!this.rockAnchors.has(id)) this.rockAnchors.set(id,{solid,definition:JSON.stringify(solid.shape.def)});
    return this.anchorValid(id) ? id : null;
  }
  anchorValid(id: string): boolean {
    const rock = this.rockAnchors.get(id);
    if (rock) {
      const {solid,definition} = rock;
      const list: readonly object[] = solid.type === 'island' ? this.terrain.islands : solid.type === 'spire' ? this.terrain.spires : solid.type === 'rock' ? this.terrain.rocks : this.terrain.arches;
      return list.includes(solid.shape) && definition === JSON.stringify(solid.shape.def);
    }
    const shape = this.anchors.resolve(id);
    return !!shape && this.terrain.colliders.contains(shape);
  }
  // Keep the caller interface, but never ignore an entire solid anchor. Projectile clearance
  // already places the endpoint outside it; the thinner tether must still test its near side.
  sweep(from: Vector3, to: Vector3, radius: number, lineAnchorId?: string): SweepHit | null {
    const spacing = lineAnchorId && radius === .02 ? SWEEP_LIMITS.tetherSpacing : Math.min(0.02, Math.max(radius / 2, 0.002));
    const rockRadius = radius + spacing / 2;
    const length = from.distanceTo(to), mid = from.clone().add(to).multiplyScalar(0.5);
    let hit: SweepHit | null = null;
    if (!Number.isFinite(length) || length > SWEEP_LIMITS.length) return {
      fraction: 0, point: from.clone(), normal: length > 0 && Number.isFinite(length) ? from.clone().sub(to).normalize() : new Vector3(0, 1, 0), anchorId: null, exhausted: true,
    };
    const candidates = this.terrain.colliders.candidates(mid.x, mid.z, length / 2 + radius, SWEEP_LIMITS.candidates);
    if (candidates.length > SWEEP_LIMITS.candidates) return {
      fraction: 0, point: from.clone(), normal: length > 0 ? from.clone().sub(to).normalize() : new Vector3(0, 1, 0), anchorId: null, exhausted: true,
    };
    for (const entry of candidates) {
      const c = entry.c;
      if (!this.terrain.colliders.contains(c) || c.soft) continue;
      const h = sweepShape(from, to, radius, c);
      if (h && (!hit || h.fraction < hit.fraction)) { h.anchorId = h.exhausted ? null : this.anchors.id(c,this.terrain.colliders.identity(c) ?? undefined); hit = h; }
    }
    // Use the same analytic solids' bounds to skip empty space above the islands.
    const low = Math.min(from.y, to.y) - rockRadius, high = Math.max(from.y, to.y) + rockRadius;
    const rocks: TerrainSolid[] = [];
    for (const solid of this.terrain.candidates(mid.x, mid.z, length / 2 + rockRadius)) {
      if (solid.type === 'island') {
        if (low <= solid.shape.maxY && high >= solid.shape.minY) rocks.push(solid);
      } else if (solid.type === 'spire') {
        if (low <= solid.shape.def.topY && high >= solid.shape.def.tipY) rocks.push(solid);
      } else if (low <= solid.shape.center.y + solid.shape.boundRadius && high >= solid.shape.center.y - solid.shape.boundRadius) rocks.push(solid);
    }
    if (!rocks.length) return hit;
    const end = hit?.fraction ?? 1;
    const count = Math.max(1, Math.ceil(length * end / spacing));
    const point = new Vector3(), push = new Vector3(), normal = new Vector3();
    const contact: { solid: TerrainSolid | null } = {solid:null};
    const columns: RockColumns | undefined = from.x===to.x && from.z===to.z ? new Map() : undefined;
    // Clip the original sample lattice against enclosing solid AABBs, then merge intervals.
    // Only actual bounds may reject an interval: rockContact resolves against local surface
    // planes and is not a sphere-distance oracle for craggy geometry.
    const ranges: [number,number][] = [];
    const delta = to.clone().sub(from);
    for (const solid of rocks) {
      const shape=solid.shape;
      const center = solid.type==='arch' ? solid.shape.center : {x:shape.def.x,z:shape.def.z};
      const reach = (solid.type==='arch'?solid.shape.boundRadius:solid.shape.maxRadius)+rockRadius;
      let bottom = (solid.type==='island'||solid.type==='rock'?solid.shape.minY:solid.type==='spire'?solid.shape.def.tipY:solid.shape.center.y-solid.shape.boundRadius)-rockRadius;
      let top = (solid.type==='island'||solid.type==='rock'?solid.shape.maxY:solid.type==='spire'?solid.shape.def.topY:solid.shape.center.y+solid.shape.boundRadius)+rockRadius;
      if (columns && solid.type === 'island') {
        const interval = this.terrain.rockColumnBounds(solid.shape, from.x, from.z, rockRadius, columns);
        if (!interval) continue;
        bottom = Math.max(bottom, interval[0]); top = Math.min(top, interval[1]);
      }
      let lo=0,hi=end;
      for (const [origin,travel,min,max] of [[from.x,delta.x,center.x-reach,center.x+reach],[from.y,delta.y,bottom,top],[from.z,delta.z,center.z-reach,center.z+reach]]) {
        if (Math.abs(travel)<1e-12) {if(origin<min||origin>max)hi=-1;continue;}
        const a=(min-origin)/travel,b=(max-origin)/travel;
        lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
      }
      if (lo<=hi) ranges.push([Math.max(0,Math.floor(end>0?lo/end*count:0)),Math.min(count,Math.ceil(end>0?hi/end*count:0))]);
    }
    ranges.sort((a,b)=>a[0]-b[0]);
    let checked=-1,queries=0;
    for (const [first,last] of ranges) for (let i=Math.max(first,checked+1);i<=last;i++) {
      checked=i;point.lerpVectors(from,to,end*i/count);
      if (++queries>16384) return {fraction:end*i/count,point,normal:from.clone().sub(to).normalize(),anchorId:null,exhausted:true};
      if (!this.terrain.rockContact(point,rockRadius,push,normal,undefined,columns,rocks)) continue;
      const fraction = end * i / count;
      if (i === 0 && push.lengthSq() < 1e-8 && to.clone().sub(from).dot(normal) >= 0) continue;
      let lo = Math.max(0,end*(i-1)/count), hi = fraction;
      for (let j = 0; j < 12; j++) {
        const m = (lo+hi)/2;point.lerpVectors(from,to,m);
        if (this.terrain.rockContact(point,rockRadius,push,normal,undefined,columns,rocks)) hi=m;else lo=m;
      }
      point.lerpVectors(from,to,hi);
      this.terrain.rockContact(point,rockRadius,push,normal,contact,columns,rocks);
      return {fraction:hi,point,normal,anchorId:contact.solid?this.rockId(contact.solid):null};
    }
    return hit;
  }
}

/** Three vertically stacked rider spheres, swept and slid along contact planes. */
export function moveBody(world: SweepWorld, from: Vector3, to: Vector3, velocity: Vector3): void {
  const start = from.clone(), goal = to.clone(), offset = new Vector3(), remaining = new Vector3();
  for (let pass = 0; pass < 4; pass++) {
    let nearest: SweepHit | null = null;
    for (const h of [0.35, 1, 1.45]) {
      offset.set(0, h, 0);
      const hit = world.sweep(start.clone().add(offset), goal.clone().add(offset), 0.35);
      if (hit && (!nearest || hit.fraction < nearest.fraction)) nearest = hit;
    }
    if (!nearest) { to.copy(goal); return; }
    remaining.subVectors(goal, start).multiplyScalar(1 - nearest.fraction);
    start.lerp(goal, nearest.fraction).addScaledVector(nearest.normal, 0.002);
    const into = remaining.dot(nearest.normal);
    if (into < 0) remaining.addScaledVector(nearest.normal, -into);
    const vn = velocity.dot(nearest.normal);
    if (vn < 0) velocity.addScaledVector(nearest.normal, -vn);
    goal.copy(start).add(remaining);
  }
  // Multiple incompatible planes: stop at the last safe contact, never tunnel.
  to.copy(start);
}
