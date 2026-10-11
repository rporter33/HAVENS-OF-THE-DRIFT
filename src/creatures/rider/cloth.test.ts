import { describe, expect, it } from 'vitest';
import { Cloth, particleDistance, type ClothConfig } from './cloth';
import { RIBBON } from './accessories';

/** A grid hanging down from a pinned top row along x, spacing `seg`, in the plane z = 0. */
function grid(cols: number, rows: number, seg: number, extra: Partial<ClothConfig> = {}): Cloth {
  const rest: number[] = [];
  const pinned: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rest.push((c - (cols - 1) / 2) * seg, -r * seg, 0);
      pinned.push(r === 0 ? 1 : 0);
    }
  }
  return new Cloth({
    cols,
    rows,
    rest,
    pinned,
    drag: 0.9,
    dragTangent: 0.15,
    dragQuad: 0.5,
    damping: 0.6,
    bend: 0.35,
    iterations: 5,
    radius: 0.02,
    flutter: 26,
    flutterHz: 2.6,
    ...extra,
  });
}

/** Mean direction from the pinned row to the last row. */
function trail(c: Cloth): [number, number, number] {
  const C = c.cols;
  const last = (c.rows - 1) * C;
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < C; i++) {
    x += c.pos[(last + i) * 3] - c.pos[i * 3];
    y += c.pos[(last + i) * 3 + 1] - c.pos[i * 3 + 1];
    z += c.pos[(last + i) * 3 + 2] - c.pos[i * 3 + 2];
  }
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

function maxStretch(c: Cloth): number {
  // Vertical neighbours, rest spacing taken from the first column's rest pose.
  let worst = 0;
  for (let r = 0; r + 1 < c.rows; r++) {
    for (let col = 0; col < c.cols; col++) {
      const a = r * c.cols + col;
      const d = particleDistance(c, a, a + c.cols);
      worst = Math.max(worst, d);
    }
  }
  return worst;
}

const calm = { airX: 0, airY: 0, airZ: 0, time: 0 };

describe('cloth', () => {
  it('C02 contact resolves a capsule-axis overlap without adding a rebound', () => {
    const c = grid(1, 1, .1, { pinned: [0], gravity: 0, contactFriction: .12 });
    c.setColliders([{ ax: 0, ay: -.1, az: 0, bx: 0, by: .1, bz: 0, r: .2 }]);
    c.update(1 / 120, calm);
    expect(Math.hypot(c.pos[0], c.pos[2])).toBeCloseTo(.22, 8);
    expect(Math.hypot(...c.pos.map((p, i) => p - c.prev[i]))).toBeLessThan(1e-9);
    for (let i = 0; i < 300; i++) c.update(1 / 60, { ...calm, time: i / 60 });
    expect(Math.hypot(c.pos[0], c.pos[2])).toBeCloseTo(.22, 8);
  });

  it('C02 cloth rests on a sloped walkable surface and falls freely over open sky', () => {
    const c = grid(4, 8, .1, { contactFriction: .12 });
    const groundAt = (x: number) => -.35 + .08 * x;
    let maxSpeed = 0;
    for (let i = 0; i < 360; i++) {
      c.update(1 / 60, { airX: i < 180 ? 8 : 0, airY: 0, airZ: 0, time: i / 60, groundAt });
      for (let k = c.cols; k < c.n; k++) {
        const j = k * 3;
        expect(c.pos[j + 1]).toBeGreaterThanOrEqual(groundAt(c.pos[j]) + .02 - 1e-9);
        if (i > 300) maxSpeed = Math.max(maxSpeed, Math.hypot(c.pos[j] - c.prev[j], c.pos[j + 1] - c.prev[j + 1], c.pos[j + 2] - c.prev[j + 2]) * 120);
      }
    }
    expect(maxSpeed).toBeLessThan(.15);
    for (let i = 0; i < 300; i++) c.update(1 / 60, { ...calm, time: 6 + i / 60, groundAt: () => null });
    // It leaves the former floor rather than sticking to a cached contact over open air.
    expect(c.pos[(c.n - 1) * 3 + 1]).toBeLessThan(-.55);
  });

  it('hangs straight down in still air and keeps its length', () => {
    const c = grid(6, 8, 0.1);
    for (let i = 0; i < 300; i++) c.update(1 / 60, { ...calm, time: i / 60 });
    const [x, y, z] = trail(c);
    expect(y).toBeLessThan(-0.98);
    expect(Math.abs(x) + Math.abs(z)).toBeLessThan(0.15);
    expect(maxStretch(c)).toBeLessThan(0.1 * 1.06);
  });

  it('streams straight back at 80 m/s', () => {
    const c = grid(8, 10, 0.12);
    for (let i = 0; i < 240; i++) c.update(1 / 60, { airX: 0, airY: 0, airZ: -80, time: i / 60 });
    const [, y, z] = trail(c);
    // Pointing downwind (−z) with only a little sag.
    expect(z).toBeLessThan(-0.93);
    expect(y).toBeGreaterThan(-0.35);
    expect(maxStretch(c)).toBeLessThan(0.12 * 1.08);
  });

  it('billows partway back at gentle speeds', () => {
    const c = grid(2, 12, 0.1, { flutter: 40, flutterHz: 3.4, dragTangent: 0.25, dragQuad: 0.55 });
    for (let i = 0; i < 300; i++) c.update(1 / 60, { airX: 0, airY: 0, airZ: -6, time: i / 60 });
    const [, y, z] = trail(c);
    const angle = Math.atan2(-z, -y);
    expect(angle).toBeGreaterThan(0.3);
    expect(angle).toBeLessThan(1.45);
  });

  it('a scarf tail droops and swings at a running pace, and streams back in flight (VIS-18)', () => {
    // Mean angle of the tail below horizontal (degrees) over two seconds in a steady headwind.
    const droop = (air: number, extra: Partial<ClothConfig> = {}) => {
      const c = grid(2, 13, 0.1, { ...RIBBON, ...extra });
      let sum = 0;
      let n = 0;
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < 480; i++) {
        c.update(1 / 60, { airX: 0, airY: 0, airZ: -air, time: i / 60 });
        if (i < 360) continue;
        const [, y, z] = trail(c);
        const below = (Math.atan2(-y, -z) * 180) / Math.PI;
        sum += below;
        n++;
        lo = Math.min(lo, below);
        hi = Math.max(hi, below);
      }
      return { mean: sum / n, swing: hi - lo };
    };
    // A run plus a breeze: the tail hangs at least 30° below horizontal, not out like a rod...
    expect(droop(6).mean).toBeGreaterThan(40);
    expect(droop(9).mean).toBeGreaterThan(30);
    // ...where the old full drag held it within 15° of level at the same speed.
    expect(droop(9, { dragLow: 1, flutterFloor: 0 }).mean).toBeLessThan(15);
    // It still moves at a jog (the flutter floor), and streams straight back when flying.
    expect(droop(6).swing).toBeGreaterThan(5);
    expect(Math.abs(droop(30).mean)).toBeLessThan(10);
  });

  // ~150k assertions: give it room on a loaded machine.
  it('is stable at any frame rate, including hitches', { timeout: 30000 }, () => {
    const c = grid(8, 10, 0.12);
    let t = 0;
    const dts = [1 / 240, 1 / 144, 1 / 60, 1 / 30, 1 / 15, 0.1, 0.25];
    for (let i = 0; i < 600; i++) {
      const dt = dts[i % dts.length];
      t += dt;
      // A swinging, accelerating anchor row and gusty air.
      const anchors = new Float64Array(c.n * 3);
      for (let k = 0; k < c.cols; k++) {
        anchors[k * 3] = (k - (c.cols - 1) / 2) * 0.12 + 0.3 * Math.sin(t * 7);
        anchors[k * 3 + 1] = 0.2 * Math.cos(t * 5);
        anchors[k * 3 + 2] = 0;
      }
      c.setAnchors(anchors);
      c.frameVelocityChange(Math.sin(t * 3) * 4, 0, Math.cos(t * 2) * 6);
      c.update(dt, { airX: 10 * Math.sin(t), airY: 3, airZ: -40 * Math.abs(Math.cos(t * 0.3)), time: t });
      for (let k = 0; k < c.n * 3; k++) expect(Number.isFinite(c.pos[k])).toBe(true);
    }
    expect(maxStretch(c)).toBeLessThan(0.12 * 1.2);
  });

  it('keeps world-space inertia when the frame accelerates', () => {
    const c = grid(1, 6, 0.1);
    for (let i = 0; i < 120; i++) c.update(1 / 60, { ...calm, time: i / 60 });
    // The rider suddenly moves forward (+z) at 5 m/s: the free end swings back (−z).
    c.frameVelocityChange(0, 0, 5);
    for (let i = 0; i < 6; i++) c.update(1 / 60, { ...calm, time: 2 + i / 60 });
    const tip = (c.rows - 1) * 3;
    expect(c.pos[tip + 2]).toBeLessThan(-0.05);
  });

  it('pushes particles out of colliders', () => {
    const c = grid(4, 8, 0.1);
    // A fat capsule right under the cloth.
    c.setColliders([{ ax: -1, ay: -0.45, az: 0.05, bx: 1, by: -0.45, bz: 0.05, r: 0.2 }]);
    for (let i = 0; i < 200; i++) c.update(1 / 60, { ...calm, time: i / 60 });
    for (let i = c.cols; i < c.n; i++) {
      const dy = c.pos[i * 3 + 1] + 0.45;
      const dz = c.pos[i * 3 + 2] - 0.05;
      expect(Math.hypot(dy, dz)).toBeGreaterThan(0.2 + 0.02 - 0.01);
    }
  });

  it('resets cleanly to a given shape', () => {
    const c = grid(3, 4, 0.1);
    for (let i = 0; i < 60; i++) c.update(1 / 60, { airX: 0, airY: 0, airZ: -50, time: i / 60 });
    const shape = new Float64Array(c.n * 3).map((_, i) => (i % 3 === 1 ? -Math.floor(i / 3 / 3) * 0.1 : 0));
    c.reset(shape);
    for (let i = 0; i < c.n * 3; i++) {
      expect(c.pos[i]).toBe(shape[i]);
      expect(c.prev[i]).toBe(shape[i]);
    }
  });
});
