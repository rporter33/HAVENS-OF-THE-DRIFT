// Verlet cloth for capes, scarves, coat tails and hair: a grid of particles (a chain is a grid one
// or two particles wide) with distance constraints, long-range tethers to the pinned row, capsule
// collision and aerodynamic drag toward the relative air velocity.
//
// The simulation runs in a TRANSLATING frame that follows the rider (positions are relative to a
// moving origin, usually the hips). Free particles keep their inertia because the caller passes
// the frame's velocity change each frame (a fictitious force), so a dive at 80 m/s needs no huge
// numbers: the air simply blows past at 80 m/s and the cloth streams straight back. Fixed
// substeps keep it stable at any frame rate.
//
// Pure TypeScript (no three.js) so it can be unit tested.

export interface ClothConfig {
  cols: number;
  rows: number;
  /** Rest positions, row-major (row 0 first), xyz per particle. Defines rest lengths. */
  rest: ArrayLike<number>;
  /** 1 for particles driven by anchors (usually row 0). */
  pinned: ArrayLike<number>;
  /** Air coupling across the surface normal (1/s at low speed). */
  drag: number;
  /** Fraction of drag that also acts along the surface (sheets); chains use 1 (isotropic). */
  dragTangent: number;
  /** Extra coupling per m/s of relative air speed (quadratic drag feel). */
  dragQuad: number;
  /** Velocity damping (1/s). */
  damping: number;
  /** Stiffness of shear and bending constraints (0..1 per iteration). */
  bend: number;
  /** Constraint iterations per substep. */
  iterations: number;
  /** Particle radius for collisions (m). */
  radius: number;
  /** Strength of the wind flutter wave (m/s² at full speed). */
  flutter: number;
  /** Flutter frequency (Hz) at 20 m/s. */
  flutterHz: number;
  /** Phase offset of the flutter wave (twin tails weave against each other). */
  flutterPhase?: number;
  /** Gravity scale (hair a little lighter than cloth feels better). */
  gravity?: number;
  /**
   * Drag multiplier at walking/running air speeds (a run into a breeze: below ~10 m/s, back to 1
   * by ~22 m/s, under any flying speed). Light ribbons need less: at full drag a running pace
   * already holds a scarf out like a rod, where a real one droops and swings. Default 1.
   */
  dragLow?: number;
  /**
   * Fraction of the flutter wave that stays on at low air speed (default 0: flutter grows with
   * the square of the air speed), so a scarf still ripples and swings at a jog.
   */
  flutterFloor?: number;
  /** Opt-in non-bouncy contact for C02. Legacy cloth retains its existing response. */
  contactFriction?: number;
  /** Opt-in spring and travel envelope around a posed garment, in meters. */
  poseStiffness?: number;
  poseRadius?: number;
  /** Join duplicate first/last columns of a closed textile sleeve. Opt-in only. */
  sewEdges?: boolean;
}

/** A collision capsule (segment a→b with radius r) in the simulation frame. */
export interface Capsule {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  r: number;
}

export interface ClothEnv {
  /** Relative air velocity in the simulation frame (wind − frame velocity), m/s. */
  airX: number;
  airY: number;
  airZ: number;
  /** Seconds, for the flutter wave. */
  time: number;
  /** Walkable surface height in this translating frame; null over open air. */
  groundAt?: (x: number, y: number, z: number) => number | null;
  /** Bone-skinned rest positions for localized garments only. */
  guide?: ArrayLike<number>;
}

const SUBSTEP = 1 / 120;
const MAX_SUBSTEPS = 10;
/** Air speed beyond which drag stops growing (the cloth is already straight; keeps it stiff-free). */
const AIR_CAP = 32;

interface Constraint {
  a: number;
  b: number;
  rest: number;
  k: number;
}

export class Cloth {
  readonly n: number;
  readonly cols: number;
  readonly rows: number;
  /** Current positions (xyz). */
  readonly pos: Float64Array;
  readonly prev: Float64Array;
  /** Per-particle surface normals (sheets), updated each substep. */
  readonly normal: Float64Array;
  private readonly cfg: ClothConfig;
  private readonly pinned: Uint8Array;
  private readonly cons: Constraint[] = [];
  /** Tether: particle → root particle index and max distance. */
  private readonly tetherRoot: Int32Array;
  private readonly tetherLen: Float64Array;
  private readonly anchorFrom: Float64Array;
  private readonly anchorTo: Float64Array;
  private accumulator = 0;
  private pendingDv = [0, 0, 0];
  private capsules: Capsule[] = [];

  constructor(cfg: ClothConfig) {
    this.cfg = cfg;
    this.cols = cfg.cols;
    this.rows = cfg.rows;
    this.n = cfg.cols * cfg.rows;
    this.pos = new Float64Array(this.n * 3);
    this.prev = new Float64Array(this.n * 3);
    this.normal = new Float64Array(this.n * 3);
    this.pinned = new Uint8Array(this.n);
    this.anchorFrom = new Float64Array(this.n * 3);
    this.anchorTo = new Float64Array(this.n * 3);
    for (let i = 0; i < this.n; i++) this.pinned[i] = cfg.pinned[i] ? 1 : 0;
    for (let i = 0; i < this.n * 3; i++) {
      this.pos[i] = this.prev[i] = cfg.rest[i];
      this.anchorFrom[i] = this.anchorTo[i] = cfg.rest[i];
    }
    const C = cfg.cols;
    const R = cfg.rows;
    const add = (a: number, b: number, k: number) => {
      if (this.pinned[a] && this.pinned[b]) return;
      this.cons.push({ a, b, rest: this.restDist(a, b), k });
    };
    // Structural first, row by row from the pinned edge, so corrections propagate outward fast.
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const i = r * C + c;
        if (r + 1 < R) add(i, i + C, 1);
        if (c + 1 < C) add(i, i + 1, 1);
      }
      for (let c = 0; c < C; c++) {
        const i = r * C + c;
        if (r + 1 < R && c + 1 < C) {
          add(i, i + C + 1, cfg.bend);
          add(i + 1, i + C, cfg.bend);
        }
        if (r + 2 < R) add(i, i + 2 * C, cfg.bend * 0.6);
        if (c + 2 < C) add(i, i + 2, cfg.bend * 0.5);
      }
    }
    if (cfg.sewEdges) for (let r = 0; r < R; r++) add(r * C, r * C + C - 1, 1);
    // Long-range attachment: never farther from the column's root than the rest path length.
    this.tetherRoot = new Int32Array(this.n).fill(-1);
    this.tetherLen = new Float64Array(this.n);
    for (let c = 0; c < C; c++) {
      let root = -1;
      let len = 0;
      for (let r = 0; r < R; r++) {
        const i = r * C + c;
        if (this.pinned[i]) {
          root = i;
          len = 0;
          continue;
        }
        if (root < 0) continue;
        len += this.restDist(i, i - C);
        this.tetherRoot[i] = root;
        this.tetherLen[i] = len * 1.03;
      }
    }
  }

  private restDist(a: number, b: number): number {
    const r = this.cfg.rest;
    const dx = r[a * 3] - r[b * 3];
    const dy = r[a * 3 + 1] - r[b * 3 + 1];
    const dz = r[a * 3 + 2] - r[b * 3 + 2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /** Place every particle (e.g. on a teleport) and zero velocities. */
  reset(positions: ArrayLike<number>): void {
    for (let i = 0; i < this.n * 3; i++) {
      this.pos[i] = this.prev[i] = positions[i];
      this.anchorFrom[i] = this.anchorTo[i] = positions[i];
    }
    this.accumulator = 0;
    this.pendingDv[0] = this.pendingDv[1] = this.pendingDv[2] = 0;
  }

  /**
   * New anchor targets for pinned particles (xyz per particle; entries of free particles are
   * ignored). Substeps interpolate from the previous targets.
   */
  setAnchors(targets: ArrayLike<number>): void {
    for (let i = 0; i < this.n; i++) {
      if (!this.pinned[i]) continue;
      for (let k = 0; k < 3; k++) {
        this.anchorFrom[i * 3 + k] = this.anchorTo[i * 3 + k];
        this.anchorTo[i * 3 + k] = targets[i * 3 + k];
      }
    }
  }

  /** The simulation frame's velocity changed by dv (m/s): free particles keep their world velocity. */
  frameVelocityChange(dx: number, dy: number, dz: number): void {
    this.pendingDv[0] += dx;
    this.pendingDv[1] += dy;
    this.pendingDv[2] += dz;
  }

  setColliders(capsules: Capsule[]): void {
    this.capsules = capsules;
  }

  /** Advance by dt using fixed substeps. Returns the number of substeps taken. */
  update(dt: number, env: ClothEnv): number {
    this.accumulator += Math.max(0, dt);
    let steps = Math.floor(this.accumulator / SUBSTEP);
    if (steps > MAX_SUBSTEPS) {
      steps = MAX_SUBSTEPS;
      this.accumulator = 0;
    } else {
      this.accumulator -= steps * SUBSTEP;
    }
    if (steps === 0) {
      // Still follow the anchors so pinned points never lag a frame.
      this.placeAnchors(1);
      return 0;
    }
    // The frame's velocity change, applied once: relative velocity drops by dv.
    const h = SUBSTEP;
    const dv = this.pendingDv;
    for (let i = 0; i < this.n; i++) {
      if (this.pinned[i]) continue;
      this.prev[i * 3] += dv[0] * h;
      this.prev[i * 3 + 1] += dv[1] * h;
      this.prev[i * 3 + 2] += dv[2] * h;
    }
    dv[0] = dv[1] = dv[2] = 0;
    for (let s = 0; s < steps; s++) {
      this.substep(h, env, (s + 1) / steps, env.time - (steps - 1 - s) * h);
    }
    return steps;
  }

  private placeAnchors(f: number): void {
    const p = this.pos;
    const q = this.prev;
    for (let i = 0; i < this.n; i++) {
      if (!this.pinned[i]) continue;
      for (let k = 0; k < 3; k++) {
        const j = i * 3 + k;
        q[j] = p[j];
        p[j] = this.anchorFrom[j] + (this.anchorTo[j] - this.anchorFrom[j]) * f;
      }
    }
  }

  private computeNormals(): void {
    const C = this.cols;
    const R = this.rows;
    const p = this.pos;
    const nn = this.normal;
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const i = r * C + c;
        const l = r * C + Math.max(0, c - 1);
        const rr = r * C + Math.min(C - 1, c + 1);
        const u = Math.max(0, r - 1) * C + c;
        const d = Math.min(R - 1, r + 1) * C + c;
        const hx = p[rr * 3] - p[l * 3];
        const hy = p[rr * 3 + 1] - p[l * 3 + 1];
        const hz = p[rr * 3 + 2] - p[l * 3 + 2];
        const vx = p[d * 3] - p[u * 3];
        const vy = p[d * 3 + 1] - p[u * 3 + 1];
        const vz = p[d * 3 + 2] - p[u * 3 + 2];
        let nx = hy * vz - hz * vy;
        let ny = hz * vx - hx * vz;
        let nz = hx * vy - hy * vx;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 1e-9) {
          nx /= len;
          ny /= len;
          nz /= len;
        } else {
          nx = 0;
          ny = 0;
          nz = 0;
        }
        nn[i * 3] = nx;
        nn[i * 3 + 1] = ny;
        nn[i * 3 + 2] = nz;
      }
    }
  }

  private substep(h: number, env: ClothEnv, anchorF: number, time: number): void {
    const cfg = this.cfg;
    const p = this.pos;
    const q = this.prev;
    const sheet = this.cols > 1;
    if (sheet) this.computeNormals();
    // Air, capped for stability (cloth is already fully streamed long before the cap).
    let ax = env.airX;
    let ay = env.airY;
    let az = env.airZ;
    const airSpeed = Math.sqrt(ax * ax + ay * ay + az * az);
    if (airSpeed > AIR_CAP) {
      const k = AIR_CAP / airSpeed;
      ax *= k;
      ay *= k;
      az *= k;
    }
    const g = -9.81 * (cfg.gravity ?? 1);
    const damp = Math.exp(-cfg.damping * h);
    // Less drag at on-foot speeds for light pieces (see dragLow).
    const low = cfg.dragLow ?? 1;
    const lt = Math.min(1, Math.max(0, (airSpeed - 10) / 12));
    const dragScale = low + (1 - low) * lt * lt * (3 - 2 * lt);
    // Flutter: a travelling wave across the surface, stronger toward the free end and with speed.
    const speedK = Math.min(1, airSpeed / 22);
    const floor = (cfg.flutterFloor ?? 0) * Math.min(1, airSpeed / 2.5);
    const flutterAmp = cfg.flutter * Math.max(speedK * speedK, floor);
    const omega = Math.PI * 2 * cfg.flutterHz * (0.35 + 0.65 * Math.min(1.6, airSpeed / 20));
    // Side direction for chains: perpendicular to the air and to up.
    let sx = -az;
    let sz = ax;
    const sl = Math.sqrt(sx * sx + sz * sz);
    if (sl > 1e-6) {
      sx /= sl;
      sz /= sl;
    } else {
      sx = 1;
      sz = 0;
    }
    const C = this.cols;
    for (let i = 0; i < this.n; i++) {
      if (this.pinned[i]) continue;
      const j = i * 3;
      let vx = (p[j] - q[j]) / h;
      let vy = (p[j + 1] - q[j + 1]) / h;
      let vz = (p[j + 2] - q[j + 2]) / h;
      // Relative wind at this particle.
      const wx = ax - vx;
      const wy = ay - vy;
      const wz = az - vz;
      const wl = Math.sqrt(wx * wx + wy * wy + wz * wz);
      const base = cfg.drag * dragScale * (1 + cfg.dragQuad * wl);
      if (sheet) {
        const nx = this.normal[j];
        const ny = this.normal[j + 1];
        const nz = this.normal[j + 2];
        const wn = wx * nx + wy * ny + wz * nz;
        const kn = 1 - Math.exp(-base * h);
        const kt = 1 - Math.exp(-base * cfg.dragTangent * h);
        vx += (wx - wn * nx) * kt + wn * nx * kn;
        vy += (wy - wn * ny) * kt + wn * ny * kn;
        vz += (wz - wn * nz) * kt + wn * nz * kn;
      } else {
        const k = 1 - Math.exp(-base * h);
        vx += wx * k;
        vy += wy * k;
        vz += wz * k;
      }
      vy += g * h;
      if (env.guide && cfg.poseStiffness) {
        const k = cfg.poseStiffness * h;
        vx += (env.guide[j] - p[j]) * k;
        vy += (env.guide[j + 1] - p[j + 1]) * k;
        vz += (env.guide[j + 2] - p[j + 2]) * k;
      }
      if (flutterAmp > 0) {
        const row = Math.floor(i / C) / Math.max(1, this.rows - 1);
        const col = (i % C) / Math.max(1, C - 1);
        const wave = Math.sin(omega * time - row * 5.5 - col * 1.3 + (cfg.flutterPhase ?? 0)) * flutterAmp * row * h;
        if (sheet) {
          vx += this.normal[j] * wave;
          vy += this.normal[j + 1] * wave;
          vz += this.normal[j + 2] * wave;
        } else {
          vx += sx * wave;
          vy += wave * 0.35;
          vz += sz * wave;
        }
      }
      vx *= damp;
      vy *= damp;
      vz *= damp;
      q[j] = p[j];
      q[j + 1] = p[j + 1];
      q[j + 2] = p[j + 2];
      p[j] += vx * h;
      p[j + 1] += vy * h;
      p[j + 2] += vz * h;
    }
    this.placeAnchors(anchorF);
    // Collisions are the expensive part (every particle against every capsule), so resolve them
    // twice per substep — midway and last — rather than on every constraint pass.
    const mid = cfg.iterations >> 1;
    for (let it = 0; it < cfg.iterations; it++) {
      this.solveConstraints();
      this.solveTethers();
      if (env.guide && cfg.poseRadius) this.solvePoseEnvelope(env.guide, cfg.poseRadius);
      if (this.capsules.length && (it === mid || it === cfg.iterations - 1)) this.collide();
    }
    if (env.groundAt) this.collideGround(env.groundAt);
  }

  private solveConstraints(): void {
    const p = this.pos;
    const pin = this.pinned;
    const cons = this.cons;
    for (let c = 0; c < cons.length; c++) {
      const con = cons[c];
      const a = con.a * 3;
      const b = con.b * 3;
      const dx = p[b] - p[a];
      const dy = p[b + 1] - p[a + 1];
      const dz = p[b + 2] - p[a + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-9) continue;
      const diff = ((d - con.rest) / d) * con.k;
      const wa = pin[con.a] ? 0 : 1;
      const wb = pin[con.b] ? 0 : 1;
      const w = wa + wb;
      if (w === 0) continue;
      const fa = (diff * wa) / w;
      const fb = (diff * wb) / w;
      p[a] += dx * fa;
      p[a + 1] += dy * fa;
      p[a + 2] += dz * fa;
      p[b] -= dx * fb;
      p[b + 1] -= dy * fb;
      p[b + 2] -= dz * fb;
    }
  }

  /** Keep seams close and hems loose. Positional repair adds no rebound velocity. */
  private solvePoseEnvelope(guide: ArrayLike<number>, radius: number): void {
    for (let i = 0; i < this.n; i++) {
      if (this.pinned[i]) continue;
      const j = i * 3, row = Math.floor(i / this.cols) / Math.max(1, this.rows - 1);
      const limit = radius * (.15 + .85 * row * row * (3 - 2 * row));
      const dx = this.pos[j] - guide[j], dy = this.pos[j + 1] - guide[j + 1], dz = this.pos[j + 2] - guide[j + 2];
      const length = Math.hypot(dx, dy, dz);
      if (length <= limit) continue;
      const k = 1 - limit / length;
      this.pos[j] -= dx * k;
      this.prev[j] -= dx * k;
      this.pos[j + 1] -= dy * k;
      this.prev[j + 1] -= dy * k;
      this.pos[j + 2] -= dz * k;
      this.prev[j + 2] -= dz * k;
    }
  }

  private solveTethers(): void {
    const p = this.pos;
    for (let i = 0; i < this.n; i++) {
      const r = this.tetherRoot[i];
      if (r < 0) continue;
      const j = i * 3;
      const k = r * 3;
      const dx = p[j] - p[k];
      const dy = p[j + 1] - p[k + 1];
      const dz = p[j + 2] - p[k + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const max = this.tetherLen[i];
      if (d > max) {
        const s = max / d;
        p[j] = p[k] + dx * s;
        p[j + 1] = p[k + 1] + dy * s;
        p[j + 2] = p[k + 2] + dz * s;
      }
    }
  }

  private collide(): void {
    const p = this.pos;
    const rad = this.cfg.radius;
    // Bounds of the cloth, to skip capsules nowhere near it.
    let x0 = Infinity;
    let y0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    let z1 = -Infinity;
    for (let i = 0; i < this.n; i++) {
      const j = i * 3;
      if (p[j] < x0) x0 = p[j];
      if (p[j] > x1) x1 = p[j];
      if (p[j + 1] < y0) y0 = p[j + 1];
      if (p[j + 1] > y1) y1 = p[j + 1];
      if (p[j + 2] < z0) z0 = p[j + 2];
      if (p[j + 2] > z1) z1 = p[j + 2];
    }
    for (let ci = 0; ci < this.capsules.length; ci++) {
      const c = this.capsules[ci];
      const m = c.r + rad;
      if (Math.min(c.ax, c.bx) - m > x1 || Math.max(c.ax, c.bx) + m < x0) continue;
      if (Math.min(c.ay, c.by) - m > y1 || Math.max(c.ay, c.by) + m < y0) continue;
      if (Math.min(c.az, c.bz) - m > z1 || Math.max(c.az, c.bz) + m < z0) continue;
      const ex = c.bx - c.ax;
      const ey = c.by - c.ay;
      const ez = c.bz - c.az;
      const ee = ex * ex + ey * ey + ez * ez;
      const R = c.r + rad;
      for (let i = 0; i < this.n; i++) {
        if (this.pinned[i]) continue;
        const j = i * 3;
        const px = p[j] - c.ax;
        const py = p[j + 1] - c.ay;
        const pz = p[j + 2] - c.az;
        let t = ee > 1e-12 ? (px * ex + py * ey + pz * ez) / ee : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        let dx = px - ex * t;
        let dy = py - ey * t;
        let dz = pz - ez * t;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= R * R) continue;
        let d = Math.sqrt(d2);
        if (this.cfg.contactFriction === undefined) {
          // Preserve the ordinary wardrobe's original arithmetic and contact response.
          if (d < 1e-6) continue;
          const push = (R - d) / d;
          p[j] += dx * push; p[j + 1] += dy * push; p[j + 2] += dz * push;
          continue;
        }
        if (d < 1e-6) {
          // A particle exactly on the capsule axis still needs a deterministic exit direction.
          dx = -ez; dy = 0; dz = ex; d = Math.hypot(dx, dz);
          if (d < 1e-6) { dx = 1; dz = 0; d = 1; }
          dx /= d; dz /= d; d = 0;
        } else { dx /= d; dy /= d; dz /= d; }
        this.projectContact(j, dx, dy, dz, R - d);
      }
    }
  }
  private projectContact(j: number, nx: number, ny: number, nz: number, depth: number): void {
    const p = this.pos, q = this.prev;
    const vx = p[j] - q[j], vy = p[j + 1] - q[j + 1], vz = p[j + 2] - q[j + 2];
    p[j] += nx * depth; p[j + 1] += ny * depth; p[j + 2] += nz * depth;
    if (this.cfg.contactFriction === undefined) return;
    // Position repair must not become an impulse. Remove inward velocity with mild sliding
    // friction, so resting contact does not repeatedly launch a loose hem off the body.
    const inward = Math.min(0, vx * nx + vy * ny + vz * nz);
    const retain = 1 - Math.min(1, Math.max(0, this.cfg.contactFriction));
    q[j] = p[j] - (vx - nx * inward) * retain;
    q[j + 1] = p[j + 1] - (vy - ny * inward) * retain;
    q[j + 2] = p[j + 2] - (vz - nz * inward) * retain;
  }

  private collideGround(groundAt: NonNullable<ClothEnv['groundAt']>): void {
    for (let i = 0; i < this.n; i++) {
      if (this.pinned[i]) continue;
      const j = i * 3, p = this.pos;
      const ground = groundAt(p[j], p[j + 1], p[j + 2]);
      if (ground !== null && Number.isFinite(ground) && p[j + 1] < ground + this.cfg.radius)
        this.projectContact(j, 0, 1, 0, ground + this.cfg.radius - p[j + 1]);
    }
  }
}

/** Distance between two particles (tests, debugging). */
export function particleDistance(c: Cloth, a: number, b: number): number {
  const p = c.pos;
  return Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);
}
