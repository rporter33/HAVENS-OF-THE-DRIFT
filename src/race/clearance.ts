// Clearance queries for course validation and collectible placement: how much open air there is
// around a point, counting rock (the analytic terrain), Rootfall's hanging roots and the
// waterfall ribbons. Pure; tests run these against the real layout.

import { Vector3 } from 'three';
import type { Terrain } from '../world/terrain';
import type { IslandShape, SpireShape } from '../world/islandShape';
import { strandClearance, type RootPlan } from '../world/dressing/roots/rootPlan';
import { fallOffset, type WaterfallPlan } from '../world/dressing/water/waterfallPlan';

/** Extra room kept from a fall beyond its half-width (spray, mist, the wind pushing it). */
export const FALL_SPRAY = 4;

/** Polyline of a fall's centerline, sampled every 0.25 s of flight. */
export function fallPolyline(w: WaterfallPlan): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const n = Math.max(2, Math.ceil(w.duration / 0.25));
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * w.duration;
    const o = fallOffset(w.speed, t);
    pts.push([w.lip.x + w.outX * o.out, w.lip.y - o.down, w.lip.z + w.outZ * o.out]);
  }
  return pts;
}

function segDist(px: number, py: number, pz: number, a: readonly number[], b: readonly number[]): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const l2 = abx * abx + aby * aby + abz * abz;
  let t = l2 > 0 ? ((px - a[0]) * abx + (py - a[1]) * aby + (pz - a[2]) * abz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - a[0] - abx * t, py - a[1] - aby * t, pz - a[2] - abz * t);
}

/** The visible spire mesh bulges up to this much beyond the collision radius (angular noise). */
const SPIRE_VISUAL = 1.2;

/**
 * Distance to an island's rock, measured against the surfaces themselves: the cliff band
 * analytically, the top and underside by sampling around the point (the underside cone slopes,
 * so straight-down distance would overestimate). Negative inside. For validation, not per frame.
 */
export function islandRockDistance(shape: IslandShape, p: Vector3): number {
  const d = shape.def;
  const dx = p.x - d.x;
  const dz = p.z - d.z;
  const rxz = Math.hypot(dx, dz);
  const boundOut = rxz - shape.maxRadius;
  const boundVy = p.y > shape.maxY ? p.y - shape.maxY : p.y < shape.minY ? shape.minY - p.y : 0;
  if (boundOut > 80 || boundVy > 80) return Math.hypot(Math.max(0, boundOut), boundVy);
  const R = shape.outlineRadius(Math.atan2(dz, dx));
  const top = shape.topHeight(p.x, p.z);
  const bottom = shape.bottomHeight(p.x, p.z);
  const dr = rxz - R;
  if (dr <= 0 && p.y < top && p.y > bottom) return -Math.min(top - p.y, p.y - bottom, -dr);
  // The cliff band (vertical, at the outline) plus the surfaces straight above/below.
  let best = dr > 0 ? Math.hypot(dr, p.y > top ? p.y - top : p.y < bottom ? bottom - p.y : 0) : p.y >= top ? p.y - top : bottom - p.y;
  // Sample the top and underside around the point for anything closer sideways.
  const reach = Math.min(best, 80);
  for (let ring = 1; ring <= 8; ring++) {
    const rr = (reach * ring) / 8;
    const n = 6 + ring * 3;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + ring;
      const x = p.x + Math.cos(a) * rr;
      const z = p.z + Math.sin(a) * rr;
      if (shape.normRadius(x, z) > 1) continue;
      const surf = p.y >= (shape.topHeight(x, z) + shape.bottomHeight(x, z)) / 2 ? shape.topHeight(x, z) : shape.bottomHeight(x, z);
      const dist = Math.hypot(rr, p.y - surf);
      if (dist < best) best = dist;
    }
  }
  return best;
}

/** Distance to a spire's visible surface (its mesh bulges past the collision radius). */
export function spireRockDistance(shape: SpireShape, p: Vector3): number {
  const d = shape.def;
  const rxz = Math.hypot(p.x - d.x, p.z - d.z);
  if (p.y > d.topY) return Math.hypot(Math.max(0, rxz - d.topRadius * SPIRE_VISUAL), p.y - d.topY);
  if (p.y < d.tipY) return Math.hypot(rxz, d.tipY - p.y);
  return rxz - shape.baseRadiusAt(p.y) * SPIRE_VISUAL;
}

/** Distance to the nearest rock of any kind: islands, spires, arches (exact signed distance). */
export function rockDistance(terrain: Terrain, p: Vector3): number {
  let best = 400;
  for (const s of terrain.candidates(p.x, p.z, 400)) {
    let d: number;
    if (s.type === 'island') d = islandRockDistance(s.shape, p);
    else if (s.type === 'spire') d = spireRockDistance(s.shape, p);
    else if (s.type === 'rock') d = s.shape.distance(p);
    else {
      const bound = p.distanceTo(s.shape.center) - s.shape.boundRadius;
      d = bound > 60 ? bound : s.shape.distance(p);
    }
    if (d < best) best = d;
  }
  return best;
}

export interface ClearanceWorld {
  terrain: Terrain;
  roots?: RootPlan;
  falls?: readonly WaterfallPlan[];
}

/** Precomputed fall polylines for repeated queries. */
export class ClearanceField {
  private fallLines: { line: [number, number, number][]; width: number; minY: number; maxY: number; x: number; z: number; reach: number }[];
  private p = new Vector3();

  constructor(private world: ClearanceWorld) {
    this.fallLines = (world.falls ?? []).map((w) => {
      const line = fallPolyline(w);
      const ys = line.map((q) => q[1]);
      return { line, width: w.width, minY: Math.min(...ys), maxY: Math.max(...ys), x: w.lip.x, z: w.lip.z, reach: 40 };
    });
  }

  /** Distance to the nearest waterfall's water (half-width + spray removed). */
  fall(x: number, y: number, z: number): number {
    let best = Infinity;
    for (const f of this.fallLines) {
      if (Math.hypot(x - f.x, z - f.z) - f.reach > best) continue;
      if (y < f.minY - best || y > f.maxY + best) continue;
      for (let i = 0; i < f.line.length - 1; i++) {
        const d = segDist(x, y, z, f.line[i], f.line[i + 1]) - f.width - FALL_SPRAY;
        if (d < best) best = d;
      }
    }
    return best;
  }

  /** Distance to the nearest root, vine or glow strand. */
  root(x: number, y: number, z: number): number {
    return this.world.roots ? strandClearance(this.world.roots, x, y, z) : Infinity;
  }

  /** Distance to rock: islands, spires (as drawn), arches. */
  rock(x: number, y: number, z: number): number {
    return rockDistance(this.world.terrain, this.p.set(x, y, z));
  }

  /** Open air around a point: the nearest of rock, roots and water. */
  at(x: number, y: number, z: number): number {
    return Math.min(this.rock(x, y, z), this.root(x, y, z), this.fall(x, y, z));
  }

  /** Smallest clearance along a straight segment, sampled every `step` meters. */
  along(a: readonly number[], b: readonly number[], step = 4): { min: number; at: [number, number, number] } {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const n = Math.max(1, Math.ceil(L / step));
    let min = Infinity;
    let at: [number, number, number] = [a[0], a[1], a[2]];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      const z = a[2] + (b[2] - a[2]) * t;
      const c = this.at(x, y, z);
      if (c < min) {
        min = c;
        at = [x, y, z];
      }
    }
    return { min, at };
  }
}
