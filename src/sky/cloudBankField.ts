// Cumulus banks drifting among the islands, as data: where every puff is, how big and how
// opaque, and how deep inside a cloud a point is (the camera's white-out veil). Pure — the
// renderer (CloudBanks.ts) draws exactly what this computes, so flying into a puff you can see
// is flying into the veil.

import { Vector3 } from 'three';
import { Rng } from '../core/rng';
import { clamp01, smoothstep } from '../core/math';
import type { WorldLayout } from '../world/layout';
import { rockFormBounds } from '../world/rockForm';
import { PUFF_VARIANTS } from './cloudTextures';

export interface PuffDef {
  /** Offset from the bank's base center (m). */
  ox: number;
  oy: number;
  oz: number;
  radius: number;
  /** 0 = flat base of the bank, 1 = crown. Darkens bases. */
  shade: number;
  rotation: number;
  variant: number;
}

export interface BankDef {
  ax: number;
  ay: number;
  az: number;
  /** Horizontal half-width (m). */
  width: number;
  height: number;
  /** The bank shows when cloud cover exceeds this (0..1); spreads banks across cover levels. */
  threshold: number;
  /** Slow form-and-dissolve cycle. */
  lifeRate: number;
  lifePhase: number;
  puffs: PuffDef[];
  /** Bounding radius around the base center including puff radii. */
  bound: number;
}

/** Half-size of the square the banks wrap around in as they drift (m). */
export const BANK_WRAP = 3300;
const WRAP_FADE = 450;
/** Inside this fraction of a puff's radius the veil is total. */
const VEIL_CORE = 0.35;
const VEIL_EDGE = 1.0;
/**
 * The bank's body as an ellipsoid (fractions of width / height) that veils on its own: puffs
 * alone leave clear pockets between them, and the heart of a bank should be a solid white-out.
 */
const BODY_RX = 0.72;
const BODY_RY = 0.5;
const BODY_LIFT = 0.42;

export function buildBanks(layout: WorldLayout, count: number, puffsPer: number, seed = 0xb4a7c): BankDef[] {
  const rng = new Rng(seed);
  const banks: BankDef[] = [];
  let attempts = 0;
  while (banks.length < count && attempts < count * 60) {
    attempts++;
    const ang = rng.range(0, Math.PI * 2);
    const dist = Math.sqrt(rng.float()) * 2700 + 150;
    const ax = Math.cos(ang) * dist;
    const az = Math.sin(ang) * dist;
    const ay = rng.range(250, 700);
    const width = rng.range(100, 240);
    const height = width * rng.range(0.45, 0.8);
    // Start clear of islands (drift moves them later; the field fades them near solids).
    if (islandClearance(layout, ax, ay, az, width, height) < 40) continue;
    const puffs: PuffDef[] = [];
    const elong = rng.range(0.6, 1.0);
    const yaw = rng.range(0, Math.PI);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    for (let i = 0; i < puffsPer; i++) {
      const base = i < Math.ceil(puffsPer * 0.4);
      const h = base ? rng.range(0, 0.12) : Math.pow(rng.range(0.15, 1), 0.85);
      const ring = width * (base ? rng.range(0.25, 1) : (1 - h * 0.72) * Math.sqrt(rng.float()));
      const a = rng.range(0, Math.PI * 2);
      const lx = Math.cos(a) * ring;
      const lz = Math.sin(a) * ring * elong;
      const radius = width * (base ? rng.range(0.32, 0.46) : rng.range(0.3, 0.44) * (1 - 0.3 * h));
      puffs.push({
        ox: lx * cy - lz * sy,
        oy: h * height + radius * 0.35,
        oz: lx * sy + lz * cy,
        radius,
        shade: h,
        rotation: rng.range(0, Math.PI * 2),
        variant: rng.int(0, PUFF_VARIANTS - 1),
      });
    }
    let bound = 0;
    for (const p of puffs) bound = Math.max(bound, Math.hypot(p.ox, p.oy, p.oz) + p.radius);
    banks.push({
      ax, ay, az, width, height,
      threshold: 0,
      lifeRate: rng.range(0.004, 0.009),
      lifePhase: rng.range(0, Math.PI * 2),
      puffs,
      bound,
    });
  }
  // Spread cover thresholds evenly (shuffled), so cover maps linearly to how many banks show.
  const order = banks.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  order.forEach((bankIndex, rank) => {
    banks[bankIndex].threshold = 0.1 + (0.88 * (rank + 0.5)) / order.length;
  });
  return banks;
}

/** Horizontal gap between a bank and the nearest island, spire or rock form it overlaps vertically (m). */
export function islandClearance(layout: WorldLayout, x: number, y: number, z: number, width: number, height: number): number {
  // Indexed loops and sqrt (for-of iterators and Math.hypot allocate in V8); runs per bank per
  // refresh.
  let best = Infinity;
  const islands = layout.islands;
  for (let i = 0; i < islands.length; i++) {
    const isl = islands[i];
    const top = isl.y + isl.hills + 40;
    const bottom = isl.y - isl.depth * 0.9;
    if (y > top || y + height < bottom) continue;
    const dx = x - isl.x;
    const dz = z - isl.z;
    const gap = Math.sqrt(dx * dx + dz * dz) - isl.radius * (1 + isl.outline) - width;
    if (gap < best) best = gap;
  }
  const spires = layout.spires;
  for (let i = 0; i < spires.length; i++) {
    const sp = spires[i];
    if (y > sp.topY + 30 || y + height < sp.tipY) continue;
    const dx = x - sp.x;
    const dz = z - sp.z;
    const gap = Math.sqrt(dx * dx + dz * dz) - sp.bellyRadius - width;
    if (gap < best) best = gap;
  }
  const rocks = layout.rocks ?? [];
  for (let i = 0; i < rocks.length; i++) {
    const r = rockFormBounds(rocks[i]);
    if (y > r.maxY + 30 || y + height < r.minY) continue;
    const dx = x - rocks[i].x;
    const dz = z - rocks[i].z;
    const gap = Math.sqrt(dx * dx + dz * dz) - r.radius - width;
    if (gap < best) best = gap;
  }
  return best;
}

function wrap(v: number): number {
  const s = BANK_WRAP * 2;
  return ((((v + BANK_WRAP) % s) + s) % s) - BANK_WRAP;
}

/**
 * Live state of every puff: world center, radius and opacity. Arrays are laid out per puff in
 * bank order; `update` rewrites them in place (no allocation).
 */
export class CloudBankField {
  readonly banks: BankDef[];
  readonly puffCount: number;
  /** xyz per puff. */
  readonly centers: Float32Array;
  readonly radii: Float32Array;
  readonly alphas: Float32Array;
  /** Per bank: current base center xyz and opacity. */
  readonly bankPos: Float32Array;
  readonly bankAlpha: Float32Array;
  private layout: WorldLayout;
  private clearance: Float32Array;
  private clearanceTimer = 0;

  constructor(layout: WorldLayout, banks: BankDef[]) {
    this.layout = layout;
    this.banks = banks;
    this.puffCount = banks.reduce((n, b) => n + b.puffs.length, 0);
    this.centers = new Float32Array(this.puffCount * 3);
    this.radii = new Float32Array(this.puffCount);
    this.alphas = new Float32Array(this.puffCount);
    this.bankPos = new Float32Array(banks.length * 3);
    this.bankAlpha = new Float32Array(banks.length);
    this.clearance = new Float32Array(banks.length).fill(1);
  }

  /**
   * @param drift  integral of the wind (m): banks ride it.
   * @param time   seconds, for the slow life cycle.
   * @param cover  0..1 weather cloud cover.
   */
  update(drift: Vector3, time: number, cover: number, dt = 0): void {
    // Island clearance only changes as banks drift a few m/s: refresh it a few times a second.
    this.clearanceTimer -= dt;
    const refresh = this.clearanceTimer <= 0;
    if (refresh) this.clearanceTimer = 0.25;
    let k = 0;
    for (let b = 0; b < this.banks.length; b++) {
      const bank = this.banks[b];
      const x = wrap(bank.ax + drift.x * 0.92);
      const z = wrap(bank.az + drift.z * 0.92);
      const y = bank.ay;
      if (refresh) {
        this.clearance[b] = smoothstep(-10, 110, islandClearance(this.layout, x, y, z, bank.width, bank.height));
      }
      const coverK = smoothstep(bank.threshold - 0.07, bank.threshold + 0.07, cover);
      const life = smoothstep(-0.75, 0.1, Math.sin(time * bank.lifeRate + bank.lifePhase));
      const edge = 1 - smoothstep(BANK_WRAP - WRAP_FADE, BANK_WRAP - 40, Math.max(Math.abs(x), Math.abs(z)));
      const a = clamp01(coverK * life * edge * this.clearance[b]);
      this.bankPos[b * 3] = x;
      this.bankPos[b * 3 + 1] = y;
      this.bankPos[b * 3 + 2] = z;
      this.bankAlpha[b] = a;
      // Fading banks also shrink: they evaporate rather than turn to glass.
      const grow = 0.55 + 0.45 * a;
      const puffs = bank.puffs;
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        this.centers[k * 3] = x + p.ox * grow;
        this.centers[k * 3 + 1] = y + p.oy * grow;
        this.centers[k * 3 + 2] = z + p.oz * grow;
        this.radii[k] = p.radius * grow;
        this.alphas[k] = a;
        k++;
      }
    }
  }

  /** 0..1 how deep inside cloud the point is. Smooth; 0 in clear air. */
  veilAt(p: Vector3): number {
    let clear = 1;
    let k = 0;
    for (let b = 0; b < this.banks.length; b++) {
      const bank = this.banks[b];
      const n = bank.puffs.length;
      const a = this.bankAlpha[b];
      const bx = this.bankPos[b * 3] - p.x;
      const by = this.bankPos[b * 3 + 1] - p.y;
      const bz = this.bankPos[b * 3 + 2] - p.z;
      if (a <= 0.001 || bx * bx + by * by + bz * bz > bank.bound * bank.bound) {
        k += n;
        continue;
      }
      // The body: an ellipsoid around the bank's middle, thick at the heart, soft at the skin.
      const grow = 0.55 + 0.45 * a;
      const rx = bank.width * BODY_RX * grow;
      const ry = bank.height * BODY_RY * grow;
      const ey = (by + bank.height * BODY_LIFT * grow) / ry;
      const e = Math.sqrt((bx * bx + bz * bz) / (rx * rx) + ey * ey);
      if (e < 1) clear *= 1 - a * (1 - smoothstep(0.3, 1, e));
      for (let i = 0; i < n; i++, k++) {
        const r = this.radii[k];
        const dx = this.centers[k * 3] - p.x;
        const dy = this.centers[k * 3 + 1] - p.y;
        const dz = this.centers[k * 3 + 2] - p.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= r * r * VEIL_EDGE * VEIL_EDGE) continue;
        const v = this.alphas[k] * (1 - smoothstep(r * VEIL_CORE, r * VEIL_EDGE, Math.sqrt(d2)));
        clear *= 1 - v;
      }
    }
    return clamp01(1 - clear);
  }
}
