// TerrainQuery over the whole archipelago: a coarse spatial grid of analytic solids. Cheap
// enough to call several times per physics step; deterministic, so it runs in unit tests.

import { Vector3 } from 'three';
import type { ContactInfo, GroundHit, RayHit, SurfaceKind, TerrainQuery } from '../core/types';
import { LAYOUT, type WorldLayout } from './layout';
import { ArchShape, IslandShape, SpireShape } from './islandShape';
import { ColliderIndex } from './colliders';

const CELL = 400;
/** How far above the feet a structure top still counts as ground to step onto (m). */
const STRUCTURE_STEP = 1.0;
/** How far distance() looks for structure colliders (m); also the longest step it allows near them. */
const COLLIDER_REACH = 24;
/** Ground hits on structures report this island id (they aren't part of any island). */
export const STRUCTURE_GROUND_ID = -1000;

export type TerrainSolid =
  | { type: 'island'; shape: IslandShape; stamp: number }
  | { type: 'spire'; shape: SpireShape; stamp: number }
  | { type: 'arch'; shape: ArchShape; stamp: number };

const tmpN = new Vector3();
/** sqrt(a² + b²). Math.hypot allocates its argument list in V8; these run many times a frame. */
const hyp = (a: number, b: number): number => Math.sqrt(a * a + b * b);
const tmpP = new Vector3();
const tmpQ = new Vector3();
const rockProbe = new Vector3();
/** Query-local exact column reuse for vertical sweeps; never retained across world updates. */
export type RockColumns = Map<IslandShape,{x:number;z:number;bottom:number;top:number;normal:Vector3|null}>;

export class Terrain implements TerrainQuery {
  readonly layout: WorldLayout;
  readonly islands: IslandShape[];
  readonly spires: SpireShape[];
  readonly arches: ArchShape[];
  /** Buildings, trees, decks, gates…: everything solid that isn't analytic rock. */
  readonly colliders = new ColliderIndex();
  private grid = new Map<number, TerrainSolid[]>();
  private solids: TerrainSolid[] = [];
  private stamp = 0;
  private scratch: TerrainSolid[] = [];

  constructor(layout: WorldLayout = LAYOUT) {
    this.layout = layout;
    this.islands = layout.islands.map((d) => new IslandShape(d));
    this.spires = layout.spires.map((d) => new SpireShape(d));
    this.arches = layout.arches.map((d) => new ArchShape(d));
    for (const shape of this.islands) this.insert({ type: 'island', shape, stamp: 0 }, shape.def.x, shape.def.z, shape.maxRadius);
    for (const shape of this.spires) this.insert({ type: 'spire', shape, stamp: 0 }, shape.def.x, shape.def.z, shape.maxRadius);
    for (const shape of this.arches) this.insert({ type: 'arch', shape, stamp: 0 }, shape.center.x, shape.center.z, shape.boundRadius);
  }

  private key(cx: number, cz: number): number {
    return (cx + 1000) * 4096 + (cz + 1000);
  }

  private insert(solid: TerrainSolid, x: number, z: number, r: number): void {
    this.solids.push(solid);
    const x0 = Math.floor((x - r) / CELL);
    const x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL);
    const z1 = Math.floor((z + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = this.key(cx, cz);
        let list = this.grid.get(k);
        if (!list) this.grid.set(k, (list = []));
        list.push(solid);
      }
    }
  }

  /** Solids whose horizontal bounds come within `r` of (x, z). Reuses an internal array. */
  candidates(x: number, z: number, r: number): TerrainSolid[] {
    const out = this.scratch;
    out.length = 0;
    const s = ++this.stamp;
    const x0 = Math.floor((x - r) / CELL);
    const x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL);
    const z1 = Math.floor((z + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const list = this.grid.get(this.key(cx, cz));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const solid = list[i];
          if (solid.stamp === s) continue;
          solid.stamp = s;
          out.push(solid);
        }
      }
    }
    return out;
  }

  /** Island whose footprint contains (x, z) with the highest top at or below fromY + 2. */
  islandAt(x: number, z: number, fromY = Infinity): IslandShape | null {
    let best: IslandShape | null = null;
    let bestY = -Infinity;
    for (const s of this.candidates(x, z, 0)) {
      if (s.type !== 'island') continue;
      if (s.shape.normRadius(x, z) > 1) continue;
      const y = s.shape.topHeight(x, z);
      if (y <= fromY + 2 && y > bestY) {
        bestY = y;
        best = s.shape;
      }
    }
    return best;
  }

  /**
   * See TerrainQuery.groundAt. Pass `out` to have the hit written into it (no allocation; the
   * walkers and the flight model ask several times per step); it is returned on a hit.
   */
  groundAt(x: number, z: number, fromY: number, out?: GroundHit): GroundHit | null {
    // Find the winner first, then fill one result: no objects per candidate.
    let found: 'island' | 'spire' | 'structure' | null = null;
    let bestY = -Infinity;
    let island: IslandShape | null = null;
    let spireId = 0;
    const list = this.candidates(x, z, 0);
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (s.type === 'island') {
        const shape = s.shape;
        if (shape.normRadius(x, z) > 1) continue;
        const y = shape.topHeight(x, z);
        if (y > fromY + 2) continue;
        if (found && y <= bestY) continue;
        found = 'island';
        bestY = y;
        island = shape;
      } else if (s.type === 'spire') {
        const d = s.shape.def;
        if (hyp(x - d.x, z - d.z) > d.topRadius) continue;
        if (d.topY > fromY + 2) continue;
        if (found && d.topY <= bestY) continue;
        found = 'spire';
        bestY = d.topY;
        spireId = d.id;
      }
    }
    // Roofs, decks and other structure tops you can stand on (only a small step up, so walls and
    // chest-high props block instead of teleporting you onto them).
    const topY = this.colliders.groundTop(x, z, fromY, STRUCTURE_STEP);
    if (topY > -Infinity && (!found || topY > bestY)) {
      found = 'structure';
      bestY = topY;
    }
    if (!found) return null;
    const hit = out ?? { y: 0, normal: new Vector3(), islandId: 0, surface: 'grass' as SurfaceKind };
    hit.y = bestY;
    if (found === 'island') {
      island!.topNormal(x, z, hit.normal);
      hit.islandId = island!.def.id;
      hit.surface = island!.surfaceAt(x, z, hit.normal.y);
    } else {
      hit.normal.set(0, 1, 0);
      hit.islandId = found === 'spire' ? -1 - spireId : STRUCTURE_GROUND_ID;
      hit.surface = found === 'spire' ? 'stone' : this.colliders.groundTopSurface;
    }
    return hit;
  }

  collideSphere(center: Vector3, radius: number, outPush: Vector3, outNormal: Vector3, outInfo?: ContactInfo): boolean {
    outPush.set(0, 0, 0);
    outNormal.set(0, 0, 0);
    if (outInfo) {
      outInfo.soft = false;
      outInfo.solidSurface = undefined;
    }
    const p = tmpP.copy(center);
    // Structures and trees first (rock wins any tie by resolving last).
    let hit = this.colliders.resolveSphere(p, radius, outNormal, outInfo);
    const rockHit = this.collideRock(p, radius, outNormal);
    if (rockHit && outInfo) outInfo.soft = false;
    hit = hit || rockHit;
    if (!hit) return false;
    outPush.subVectors(p, center);
    if (outNormal.lengthSq() < 1e-8) outNormal.set(0, 1, 0);
    outNormal.normalize();
    return true;
  }

  /** Experimental swept traversal queries: same analytic rock, excluding structure/foliage proxies. */
  rockContact(center: Vector3, radius: number, push: Vector3, normal: Vector3, contact?: { solid: TerrainSolid | null }, columns?: RockColumns, candidates?: readonly TerrainSolid[]): boolean {
    const p = rockProbe.copy(center);
    normal.set(0, 0, 0);
    if (contact) contact.solid = null;
    if (!this.collideRock(p, radius, normal, contact, columns, candidates)) return false;
    push.subVectors(p, center);
    normal.normalize();
    return true;
  }

  private collideRock(p: Vector3, radius: number, outNormal: Vector3, contact?: { solid: TerrainSolid | null }, columns?: RockColumns, candidates?: readonly TerrainSolid[]): boolean {
    let hit = false;
    const center = p;
    const list = candidates ?? this.candidates(center.x, center.z, radius + 1);
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      // Resolve against each solid in turn, accumulating the correction.
      let pushed = false;
      if (s.type === 'island') pushed = this.collideIsland(s.shape, p, radius, columns);
      else if (s.type === 'spire') pushed = this.collideSpire(s.shape, p, radius);
      else pushed = this.collideArch(s.shape, p, radius);
      if (pushed) {
        if (contact) contact.solid = s;
        hit = true;
        outNormal.add(tmpN);
      }
    }
    return hit;
  }

  /** Exact vertical contact interval for the same island planes used by collideIsland.
   * The sweep may clip its fine lattice to this interval; no terrain approximation is used. */
  rockColumnBounds(shape: IslandShape, x: number, z: number, radius: number, columns: RockColumns): [number, number] | null {
    const dx = x - shape.def.x, dz = z - shape.def.z;
    const r = hyp(dx, dz), outline = shape.outlineRadius(Math.atan2(dz, dx));
    if (r > outline + radius) return null;
    const bottom = shape.bottomHeight(x, z), top = shape.topHeight(x, z);
    const normal = shape.bottomNormal(x, z, new Vector3());
    columns.set(shape, { x, z, bottom, top, normal });
    if (r > outline) return [bottom - radius, top + radius];
    const topY = shape.topNormal(x, z, tmpN).y;
    return [bottom - radius / Math.max(1e-12, -normal.y), top + radius / Math.max(1e-12, topY)];
  }

  /** Pushes p out of the island in place. On contact, tmpN holds the contact normal. */
  private collideIsland(shape: IslandShape, p: Vector3, radius: number, columns?: RockColumns): boolean {
    const d = shape.def;
    if (p.y > shape.maxY + radius || p.y < shape.minY - radius) return false;
    const dx = p.x - d.x;
    const dz = p.z - d.z;
    const rxz = hyp(dx, dz);
    if (rxz > shape.maxRadius + radius) return false;
    const theta = Math.atan2(dz, dx);
    const R = shape.outlineRadius(theta);
    let column=columns?.get(shape);
    if (columns && (!column || column.x!==p.x || column.z!==p.z)) {
      column={x:p.x,z:p.z,bottom:shape.bottomHeight(p.x,p.z),top:NaN,normal:null};
      columns?.set(shape,column);
    }
    const bottom=column?.bottom ?? shape.bottomHeight(p.x,p.z);
    // If even the top's enclosing lower bound places the midpoint above p, do not
    // evaluate top terrain at all. Its bound is constructed with the same list/rim geometry.
    const lower = rxz<=R && p.y<(shape.minTopY+bottom)*.5;
    let top=column?.top ?? NaN;
    if (!lower && Number.isNaN(top)) {top=shape.topHeight(p.x,p.z);if(column)column.top=top;}
    if (rxz<=R) {
      // The finite-difference normal stencil samples within the enclosing vertical bounds
      // (+4 m covers its <=1.5 m reach beyond the footprint). This worst-case vertical
      // magnitude allows exact far-side rejection before four more height evaluations.
      const span=shape.maxY-shape.minY+4;
      if (!lower && p.y>=(top+bottom)*.5) {
        if ((p.y-top)*(2/Math.sqrt(2*span*span+4))>=radius) return false;
        const n=shape.topNormal(p.x,p.z,tmpN),dist=(p.y-top)*n.y;
        if (dist>=radius) return false;
        p.addScaledVector(n,radius-dist);return true;
      }
      if ((bottom-p.y)*(3/Math.sqrt(2*span*span+9))>=radius) return false;
      if (column && !column.normal) column.normal=shape.bottomNormal(p.x,p.z,new Vector3());
      const n=column?.normal?tmpN.copy(column.normal):shape.bottomNormal(p.x,p.z,tmpN),dist=(bottom-p.y)*-n.y;
      if (dist>=radius) return false;
      p.addScaledVector(n,radius-dist);return true;
    }

    // Outside the footprint: collide with the cliff rim band [bottom, top] at radius R.
    const out = rxz - R;
    let vy = 0;
    if (p.y > top) vy = p.y - top;
    else if (p.y < bottom) vy = p.y - bottom;
    const dist = hyp(out, vy);
    if (dist >= radius) return false;
    const ox = dx / rxz;
    const oz = dz / rxz;
    if (dist < 1e-6) {
      tmpN.set(ox, 0, oz);
      p.x += ox * radius;
      p.z += oz * radius;
      return true;
    }
    tmpN.set((ox * out) / dist, vy / dist, (oz * out) / dist);
    p.addScaledVector(tmpN, radius - dist);
    return true;
  }

  private collideSpire(shape: SpireShape, p: Vector3, radius: number): boolean {
    const d = shape.def;
    if (p.y < d.tipY - radius || p.y > d.topY + radius) return false;
    const dx = p.x - d.x;
    const dz = p.z - d.z;
    const rxz = hyp(dx, dz);
    if (rxz > shape.maxRadius + radius) return false;
    // Flat top.
    if (p.y > d.topY - 1 && rxz < d.topRadius) {
      const dist = p.y - d.topY;
      if (dist >= radius) return false;
      tmpN.set(0, 1, 0);
      p.y += radius - dist;
      return true;
    }
    const R = shape.baseRadiusAt(Math.min(d.topY - 0.01, Math.max(d.tipY + 0.01, p.y))) * 0.97;
    const dist = rxz - R;
    if (dist >= radius) return false;
    const ox = rxz > 1e-6 ? dx / rxz : 1;
    const oz = rxz > 1e-6 ? dz / rxz : 0;
    tmpN.set(ox, 0, oz);
    p.x += ox * (radius - dist);
    p.z += oz * (radius - dist);
    return true;
  }

  private collideArch(shape: ArchShape, p: Vector3, radius: number): boolean {
    if (p.distanceTo(shape.center) > shape.boundRadius + radius) return false;
    const dist = shape.distance(p);
    if (dist >= radius) return false;
    // Normal by central differences of the distance field.
    const e = 0.25;
    const q = tmpQ;
    const gx = shape.distance(q.set(p.x + e, p.y, p.z)) - shape.distance(q.set(p.x - e, p.y, p.z));
    const gy = shape.distance(q.set(p.x, p.y + e, p.z)) - shape.distance(q.set(p.x, p.y - e, p.z));
    const gz = shape.distance(q.set(p.x, p.y, p.z + e)) - shape.distance(q.set(p.x, p.y, p.z - e));
    tmpN.set(gx, gy, gz);
    if (tmpN.lengthSq() < 1e-10) tmpN.set(0, 1, 0);
    tmpN.normalize();
    p.addScaledVector(tmpN, radius - dist);
    return true;
  }

  distance(p: Vector3): number {
    let best = Infinity;
    // Look a generous distance around; far solids are bounded by their cylinders.
    const list = this.candidates(p.x, p.z, 450);
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      let d: number;
      if (s.type === 'island') d = islandDistance(s.shape, p);
      else if (s.type === 'spire') d = spireDistance(s.shape, p);
      else {
        const bound = p.distanceTo(s.shape.center) - s.shape.boundRadius;
        d = bound > 5 ? bound : s.shape.distance(p);
      }
      if (d < best) best = d;
    }
    // Outside the searched cells nothing is closer than the cell margin.
    best = Math.min(best, 400);
    // Structures only matter when they're nearer than the rock already found. Colliders beyond the
    // search radius weren't looked at, so they may be anywhere past it: cap the answer there to
    // stay a lower bound (sphere tracing would otherwise step straight through a building).
    if (this.colliders.size === 0) return best;
    const reach = Math.min(best, COLLIDER_REACH);
    return Math.min(best, this.colliders.distance(p, reach), reach);
  }

  raycast(origin: Vector3, dir: Vector3, maxDist: number): RayHit | null {
    let t = 0;
    const p = new Vector3();
    for (let i = 0; i < 160 && t < maxDist; i++) {
      p.copy(origin).addScaledVector(dir, t);
      const d = this.distance(p);
      if (d < 0.25) {
        const normal = this.gradient(p, new Vector3());
        return { point: p.clone(), normal, distance: t };
      }
      t += Math.max(d, 0.3);
    }
    return null;
  }

  /** Approximate outward normal at a point near a surface. */
  gradient(p: Vector3, out: Vector3): Vector3 {
    const e = 0.5;
    const q = new Vector3();
    const gx = this.distance(q.set(p.x + e, p.y, p.z)) - this.distance(q.set(p.x - e, p.y, p.z));
    const gy = this.distance(q.set(p.x, p.y + e, p.z)) - this.distance(q.set(p.x, p.y - e, p.z));
    const gz = this.distance(q.set(p.x, p.y, p.z + e)) - this.distance(q.set(p.x, p.y, p.z - e));
    out.set(gx, gy, gz);
    if (out.lengthSq() < 1e-10) out.set(0, 1, 0);
    return out.normalize();
  }

  /** Resolve a spawn-style (x, z) to a standing position on the ground. */
  standingPoint(x: number, z: number, out: Vector3): Vector3 {
    const g = this.groundAt(x, z, 1e6);
    return out.set(x, g ? g.y : 300, z);
  }
}

/** Conservative-ish distance to an island (scaled down because the surfaces slope). */
function islandDistance(shape: IslandShape, p: Vector3): number {
  const d = shape.def;
  const dx = p.x - d.x;
  const dz = p.z - d.z;
  const rxz = hyp(dx, dz);
  // Far away: distance to the bounding cylinder is plenty.
  const boundOut = rxz - shape.maxRadius;
  const boundVy = p.y > shape.maxY ? p.y - shape.maxY : p.y < shape.minY ? shape.minY - p.y : 0;
  if (boundOut > 30 || boundVy > 30) return hyp(Math.max(0, boundOut), boundVy);
  const R = shape.outlineRadius(Math.atan2(dz, dx));
  const top = shape.topHeight(p.x, p.z);
  const bottom = shape.bottomHeight(p.x, p.z);
  const dr = rxz - R;
  const dy = Math.max(p.y - top, bottom - p.y);
  let dist: number;
  if (dr <= 0) dist = dy > 0 ? dy : Math.max(dy, dr);
  else dist = dy > 0 ? hyp(dr, dy) : dr;
  return dist * 0.7;
}

function spireDistance(shape: SpireShape, p: Vector3): number {
  const d = shape.def;
  const rxz = hyp(p.x - d.x, p.z - d.z);
  if (p.y > d.topY) return hyp(Math.max(0, rxz - d.topRadius), p.y - d.topY);
  if (p.y < d.tipY) return hyp(rxz, d.tipY - p.y);
  return (rxz - shape.baseRadiusAt(p.y)) * 0.8;
}
