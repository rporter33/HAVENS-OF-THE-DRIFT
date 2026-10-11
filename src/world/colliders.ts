// Collision for everything the analytic terrain doesn't describe: building walls and roofs,
// towers, posts, decks, tree trunks and canopies, race gates, relic pedestals.
//
// Colliders are simple shapes (vertical cylinders, spheres, boxes turned about Y) bucketed into a
// coarse grid, so a query only looks at the handful of shapes near the point asked about — the
// cost doesn't grow with how many trees and buildings the world has. Terrain folds this index into
// every TerrainQuery call (collideSphere, distance, raycast, groundAt), so flight, walking,
// landing and the camera all collide with it without knowing it exists.

import { Vector3 } from 'three';
import type { BoxCollider, Collider, ContactInfo, CylinderCollider, SphereCollider, SurfaceKind } from '../core/types';
import { convexDistance } from './convexDistance';

/**
 * Grid cell size (m). Most shapes are a few meters across, so a cell holds only the handful of
 * shapes around it; bigger ones (roofs, canopies) simply sit in several cells.
 */
const CELL = 12;

/** How much of a soft (foliage) penetration is resolved per query: a cushion, not a wall. */
export const SOFT_PUSH = 0.35;

interface Entry {
  c: Collider;
  stamp: number;
  /** Top of the shape (m), for ground queries and quick rejects. */
  top: number;
  bottom: number;
  /** Horizontal bounds: most candidates in a cell are rejected on these before any real test. */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const tmpN = new Vector3();

interface Source {
  id: string;
  get: () => readonly Collider[];
  list: readonly Collider[] | null;
  seen: number;
}

function isSphere(c: Collider): c is SphereCollider {
  return c.kind === 'sphere';
}
function isBox(c: Collider): c is BoxCollider {
  return c.kind === 'box';
}

/**
 * Work done by queries, for tests and profiling: a query should only ever touch the handful of
 * shapes near it, however many the world holds.
 */
export interface ColliderWork {
  queries: number;
  /** Entries pulled from grid cells (after de-duplication). */
  candidates: number;
  /** Exact shape tests (signed distance evaluations) after the cheap bounds rejects. */
  exact: number;
}

export class ColliderIndex {
  /** Changes to indexed static geometry invalidate presentation query snapshots. */
  private geometryRevision = 0;
  get revision(): number { return this.geometryRevision; }
  readonly work: ColliderWork = { queries: 0, candidates: 0, exact: 0 };
  private grid = new Map<number, Entry[]>();
  private entries: Entry[] = [];
  private membership = new Map<Collider, Source | null>();
  private readonly colliderIds = new WeakMap<Collider,string>();
  private nextColliderId = 0;
  private stamp = 0;
  private scratch: Entry[] = [];
  private sources = new Map<string, Source>();
  /** The sources' values, for the per-frame sync (a Map iterator would allocate). */
  private sourceList: Source[] = [];

  get size(): number {
    return this.entries.length;
  }

  add(c: Collider): void { this.addEntry(c, null); }

  private addEntry(c: Collider, source: Source | null): void {
    this.geometryRevision++;
    this.membership.set(c, source);
    if (!this.colliderIds.has(c)) this.colliderIds.set(c,`solid-${this.nextColliderId++}`);
    let minX: number, maxX: number, minZ: number, maxZ: number, top: number, bottom: number;
    if (isSphere(c)) {
      minX = c.x - c.radius;
      maxX = c.x + c.radius;
      minZ = c.z - c.radius;
      maxZ = c.z + c.radius;
      top = c.y + c.radius;
      bottom = c.y - c.radius;
    } else if (isBox(c)) {
      const ext = Math.abs(Math.cos(c.yaw)) * c.hx + Math.abs(Math.sin(c.yaw)) * c.hz;
      const exz = Math.abs(Math.sin(c.yaw)) * c.hx + Math.abs(Math.cos(c.yaw)) * c.hz;
      minX = c.x - ext;
      maxX = c.x + ext;
      minZ = c.z - exz;
      maxZ = c.z + exz;
      top = c.y + c.hy;
      bottom = c.y - c.hy;
    } else {
      minX = c.x - c.radius;
      maxX = c.x + c.radius;
      minZ = c.z - c.radius;
      maxZ = c.z + c.radius;
      top = c.y1;
      bottom = c.y0;
    }
    const e: Entry = { c, stamp: 0, top, bottom, minX, maxX, minZ, maxZ };
    this.entries.push(e);
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        const k = key(cx, cz);
        let list = this.grid.get(k);
        if (!list) this.grid.set(k, (list = []));
        list.push(e);
      }
    }
  }

  addAll(list: readonly Collider[]): void {
    for (const c of list) this.add(c);
  }

  /**
   * Register a list that may grow (dressing builds distant sites later) or be replaced outright
   * (the forest is rebuilt when tree density changes with quality). Call sync() once a frame:
   * appended entries are indexed incrementally; a replaced list triggers a full rebuild.
   */
  addSource(id: string, get: () => readonly Collider[]): void {
    if (this.sources.has(id)) this.removeSource(id);
    this.sources.set(id, { id, get, list: null, seen: 0 });
    this.sourceList = [...this.sources.values()];
    this.sync();
  }

  /** Validate live source membership as well as indexed identity (including source replacement). */
  contains(c: Collider): boolean {
    if (!this.membership.has(c)) return false;
    const source = this.membership.get(c);
    return !source || (this.sources.get(source.id) === source && source.get().includes(c));
  }

  /** Assigned when geometry is indexed, never by presentation/aim queries. Survives index rebuilds
   * for the same object; replacement geometry gets a distinct identity. */
  identity(c: Collider): string | null {
    return this.contains(c) ? this.colliderIds.get(c) ?? null : null;
  }

  /** Remove one experimental source without dropping unrelated direct or sourced colliders. */
  removeSource(id: string): void {
    const removed = this.sources.get(id);
    if (!removed) return;
    const remaining = this.entries.filter(e => this.membership.get(e.c) !== removed)
      .map(e => ({ c: e.c, source: this.membership.get(e.c) ?? null }));
    this.sources.delete(id); this.sourceList = [...this.sources.values()];
    this.clear();
    for (const e of remaining) this.addEntry(e.c, e.source);
  }

  /** Bring the index up to date with its sources. Cheap when nothing changed. */
  sync(): void {
    const sources = this.sourceList;
    let replaced = false;
    for (let s = 0; s < sources.length; s++) {
      const src = sources[s];
      const list = src.get();
      if (src.list !== null && list !== src.list) replaced = true;
    }
    if (replaced) {
      this.clear();
      for (let s = 0; s < sources.length; s++) {
        sources[s].list = null;
        sources[s].seen = 0;
      }
    }
    for (let s = 0; s < sources.length; s++) {
      const src = sources[s];
      const list = src.get();
      src.list = list;
      for (let i = src.seen; i < list.length; i++) this.addEntry(list[i], src);
      src.seen = list.length;
    }
  }

  /** Drop every indexed collider (sources stay registered and refill on the next sync). */
  clear(): void {
    this.geometryRevision++;
    this.grid.clear();
    this.entries.length = 0;
    this.membership.clear();
  }

  /** Entries whose horizontal bounds come within r of (x, z). Reuses an internal array. */
  /** Read-only broad phase for experimental swept queries. Array is reused; do not nest queries. */
  candidates(x: number, z: number, radius: number, limit = Infinity): readonly Entry[] { return this.near(x, z, radius, limit); }

  private near(x: number, z: number, r: number, limit = Infinity): Entry[] {
    const out = this.scratch;
    out.length = 0;
    const s = ++this.stamp;
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
      for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
        const list = this.grid.get(key(cx, cz));
        if (!list) continue;
        // Indexed loops throughout: these run many times a frame, and for-of allocates an
        // iterator until the optimizer gets to it.
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          if (e.stamp === s) continue;
          e.stamp = s;
          out.push(e);
        if (out.length > limit) return out;
        }
      }
    }
    return out;
  }

  /**
   * Push a sphere (moved in place in `p`) out of nearby colliders. Accumulates contact normals into
   * outNormal (not normalized). Returns true on contact; info.soft stays true only if every contact
   * was soft (foliage).
   */
  resolveSphere(p: Vector3, radius: number, outNormal: Vector3, info?: ContactInfo): boolean {
    if (this.entries.length === 0) return false;
    let hit = false;
    const list = this.near(p.x, p.z, radius);
    const work = this.work;
    work.queries++;
    work.candidates += list.length;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (p.y - radius > e.top || p.y + radius < e.bottom) continue;
      if (p.x + radius < e.minX || p.x - radius > e.maxX || p.z + radius < e.minZ || p.z - radius > e.maxZ) continue;
      const c = e.c;
      work.exact++;
      const d = signedDistance(c, p, tmpN);
      if (d >= radius) continue;
      const depth = radius - d;
      p.addScaledVector(tmpN, c.soft ? depth * SOFT_PUSH : depth);
      outNormal.add(tmpN);
      if (info) {
        if (!hit) info.soft = !!c.soft;
        else if (!c.soft) info.soft = false;
        if (!c.soft) info.solidSurface = c.surface ?? 'wood';
      }
      hit = true;
    }
    return hit;
  }

  /** Signed distance to the nearest collider within maxR (Infinity if none that close). */
  distance(p: Vector3, maxR: number): number {
    if (this.entries.length === 0) return Infinity;
    this.work.queries++;
    const s = ++this.stamp;
    const pcx = Math.floor(p.x / CELL);
    const pcz = Math.floor(p.z / CELL);
    // The cell holding p first: a near hit there shrinks the search for everything else.
    let best = this.distanceInCell(this.grid.get(key(pcx, pcz)), p, maxR, Infinity, s);
    for (let cx = Math.floor((p.x - maxR) / CELL); cx <= Math.floor((p.x + maxR) / CELL); cx++) {
      for (let cz = Math.floor((p.z - maxR) / CELL); cz <= Math.floor((p.z + maxR) / CELL); cz++) {
        if (cx === pcx && cz === pcz) continue;
        // Skip whole cells farther than the best so far.
        const gx = gap(cx * CELL, (cx + 1) * CELL, p.x);
        const gz = gap(cz * CELL, (cz + 1) * CELL, p.z);
        const lim = Math.min(best, maxR);
        if (lim > 0 && gx * gx + gz * gz > lim * lim) continue;
        best = this.distanceInCell(this.grid.get(key(cx, cz)), p, maxR, best, s);
      }
    }
    return best;
  }

  private distanceInCell(list: Entry[] | undefined, p: Vector3, maxR: number, best: number, s: number): number {
    if (!list) return best;
    const work = this.work;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.stamp === s) continue;
      e.stamp = s;
      work.candidates++;
      // Distance to the entry's bounding box never overestimates: skip anything whose box is
      // already farther than the best (or the search radius).
      const ex = gap(e.minX, e.maxX, p.x);
      const ey = gap(e.bottom, e.top, p.y);
      const ez = gap(e.minZ, e.maxZ, p.z);
      const lim = Math.min(best, maxR);
      if (lim > 0 && ex * ex + ey * ey + ez * ez > lim * lim) continue;
      work.exact++;
      const d = signedDistance(e.c, p, null);
      if (d < best) best = d;
    }
    return best;
  }

  /**
   * The highest solid (non-soft) top under (x, z) at or below fromY + stepUp — roofs, decks,
   * wall tops — as walkable ground. Null if none.
   */
  groundAt(x: number, z: number, fromY: number, stepUp: number): { y: number; surface: SurfaceKind } | null {
    const y = this.groundTop(x, z, fromY, stepUp);
    return y > -Infinity ? { y, surface: this.groundTopSurface } : null;
  }

  /** What the last groundTop() hit is made of. */
  groundTopSurface: SurfaceKind = 'wood';

  /**
   * groundAt without allocating: the top's height, or -Infinity if none (its surface is left in
   * groundTopSurface).
   */
  groundTop(x: number, z: number, fromY: number, stepUp: number): number {
    if (this.entries.length === 0) return -Infinity;
    let best: Entry | null = null;
    const list = this.near(x, z, 0);
    this.work.queries++;
    this.work.candidates += list.length;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const c = e.c;
      if (c.soft || e.top > fromY + stepUp) continue;
      if (best && e.top <= best.top) continue;
      if (x < e.minX || x > e.maxX || z < e.minZ || z > e.maxZ) continue;
      if (!insideTopFace(c, x, z)) continue;
      best = e;
    }
    if (!best) return -Infinity;
    this.groundTopSurface = best.c.surface ?? 'wood';
    return best.top;
  }
}

/** Distance from v to the interval [lo, hi] (0 inside); a 3-argument Math.max allocates in V8. */
function gap(lo: number, hi: number, v: number): number {
  return v < lo ? lo - v : v > hi ? v - hi : 0;
}

function key(cx: number, cz: number): number {
  return (cx + 2048) * 8192 + (cz + 2048);
}

function insideTopFace(c: Collider, x: number, z: number): boolean {
  if (isSphere(c)) return false;
  if (isBox(c)) {
    const dx = x - c.x;
    const dz = z - c.z;
    const cs = Math.cos(c.yaw);
    const sn = Math.sin(c.yaw);
    // Local axes: +x' = (cos, 0, -sin), +z' = (sin, 0, cos) (yaw turns +Z toward +X).
    const lx = dx * cs - dz * sn;
    const lz = dx * sn + dz * cs;
    if (c.convex) {
      const planes = c.convex.planes;
      for (let i = 0; i < planes.length; i += 4) {
        if (planes[i] * lx + planes[i + 1] * c.hy + planes[i + 2] * lz + planes[i + 3] > 1e-6) return false;
      }
      return true;
    }
    const radius = Math.min(c.roundXZ ?? 0, c.hx, c.hz);
    if (radius > 0) {
      const qx = Math.max(Math.abs(lx) - (c.hx - radius), 0);
      const qz = Math.max(Math.abs(lz) - (c.hz - radius), 0);
      return qx * qx + qz * qz <= radius * radius;
    }
    return Math.abs(lx) <= c.hx && Math.abs(lz) <= c.hz;
  }
  const dx = x - c.x;
  const dz = z - c.z;
  return dx * dx + dz * dz <= c.radius * c.radius;
}

/**
 * Signed distance from p to the collider's surface (negative inside). When `n` is given it
 * receives the outward unit normal at the closest surface point.
 */
export function signedDistance(c: Collider, p: Vector3, n: Vector3 | null): number {
  if (isSphere(c)) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const dz = p.z - c.z;
    // Plain square roots in the shape tests: Math.hypot allocates its argument list in V8.
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (n) {
      if (len > 1e-6) n.set(dx / len, dy / len, dz / len);
      else n.set(0, 1, 0);
    }
    return len - c.radius;
  }
  if (isBox(c)) return boxDistance(c, p, n);
  return cylinderDistance(c, p, n);
}

function cylinderDistance(c: CylinderCollider, p: Vector3, n: Vector3 | null): number {
  const dx = p.x - c.x;
  const dz = p.z - c.z;
  const rxz = Math.sqrt(dx * dx + dz * dz);
  const ox = rxz > 1e-6 ? dx / rxz : 1;
  const oz = rxz > 1e-6 ? dz / rxz : 0;
  const radial = rxz - c.radius; // + outside the side
  const mid = (c.y0 + c.y1) * 0.5;
  const half = (c.y1 - c.y0) * 0.5;
  const vertical = Math.abs(p.y - mid) - half; // + above the top / below the bottom
  const up = p.y >= mid ? 1 : -1;
  if (radial <= 0 && vertical <= 0) {
    // Inside: leave through the nearest face.
    if (radial > vertical) {
      n?.set(ox, 0, oz);
      return radial;
    }
    n?.set(0, up, 0);
    return vertical;
  }
  if (radial > 0 && vertical > 0) {
    const d = Math.sqrt(radial * radial + vertical * vertical);
    n?.set((ox * radial) / d, (up * vertical) / d, (oz * radial) / d);
    return d;
  }
  if (radial > 0) {
    n?.set(ox, 0, oz);
    return radial;
  }
  n?.set(0, up, 0);
  return vertical;
}

function boxDistance(c: BoxCollider, p: Vector3, n: Vector3 | null): number {
  const cs = Math.cos(c.yaw);
  const sn = Math.sin(c.yaw);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const dz = p.z - c.z;
  const lx = dx * cs - dz * sn;
  const lz = dx * sn + dz * cs;
  if (c.convex) {
    const distance = convexDistance(c.convex, lx, dy, lz, n);
    if (n) { const nx = n.x, nz = n.z; n.x = nx * cs + nz * sn; n.z = -nx * sn + nz * cs; }
    return distance;
  }
  const radius = Math.min(c.roundXZ ?? 0, c.hx, c.hz);
  if (radius > 0) {
    // Rounded rectangle extruded vertically: the renderer uses this same outer footprint.
    const qx = Math.abs(lx) - c.hx + radius, qz = Math.abs(lz) - c.hz + radius;
    const ex = Math.max(qx, 0), ez = Math.max(qz, 0), len = Math.sqrt(ex * ex + ez * ez);
    const horizontal = len + Math.min(Math.max(qx, qz), 0) - radius;
    const vertical = Math.abs(dy) - c.hy;
    let nx = len > 1e-9 ? ex / len * Math.sign(lx) : qx >= qz ? Math.sign(lx) || 1 : 0;
    let nz = len > 1e-9 ? ez / len * Math.sign(lz) : qz > qx ? Math.sign(lz) || 1 : 0;
    let ny = 0;
    let distance: number;
    if (horizontal > 0 && vertical > 0) {
      distance = Math.sqrt(horizontal * horizontal + vertical * vertical);
      nx *= horizontal / distance; nz *= horizontal / distance;
      ny = (Math.sign(dy) || 1) * vertical / distance;
    } else if (vertical >= horizontal) {
      distance = vertical; nx = nz = 0; ny = Math.sign(dy) || 1;
    } else distance = horizontal;
    n?.set(nx * cs + nz * sn, ny, -nx * sn + nz * cs);
    return distance;
  }
  const qx = Math.abs(lx) - c.hx;
  const qy = Math.abs(dy) - c.hy;
  const qz = Math.abs(lz) - c.hz;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  let d: number;
  if (qx <= 0 && qy <= 0 && qz <= 0) {
    // Inside: the least-deep face.
    if (qx >= qy && qx >= qz) nx = Math.sign(lx) || 1;
    else if (qy >= qz) ny = Math.sign(dy) || 1;
    else nz = Math.sign(lz) || 1;
    d = Math.max(qx, qy, qz);
  } else {
    const ex = Math.max(qx, 0);
    const ey = Math.max(qy, 0);
    const ez = Math.max(qz, 0);
    d = Math.sqrt(ex * ex + ey * ey + ez * ez);
    nx = (ex * (Math.sign(lx) || 1)) / d;
    ny = (ey * (Math.sign(dy) || 1)) / d;
    nz = (ez * (Math.sign(lz) || 1)) / d;
  }
  // Back to world axes (inverse of the rotation above).
  n?.set(nx * cs + nz * sn, ny, -nx * sn + nz * cs);
  return d;
}

/** A walkable deck (the dressing's Deck shape) as a solid slab: you stand on it and can't fly through it. */
export function deckCollider(d: {
  x: number;
  z: number;
  yaw: number;
  halfWidth: number;
  back: number;
  length: number;
  y: number;
  surface: 'wood' | 'stone';
}): BoxCollider {
  const mid = (d.length - d.back) / 2;
  const thickness = 0.5;
  return {
    kind: 'box',
    x: d.x + Math.sin(d.yaw) * mid,
    y: d.y - thickness / 2,
    z: d.z + Math.cos(d.yaw) * mid,
    hx: d.halfWidth,
    hy: thickness / 2,
    hz: (d.length + d.back) / 2,
    yaw: d.yaw,
    surface: d.surface,
  };
}
