// The whiskers as verlet strands (gate G12b), from the parts file's strand data (parts.ts): each
// whisker's rest nodes, root first, in the bind pose. No bones: the strands are simulated in the
// dragon's frame and the whisker geometry is bent along them on the CPU.
//
// Each strand's root rides the head. Every other node falls under gravity, is held at its rest
// spacing, and is pulled toward where the head would carry it at rest, strongly near the lip and
// hardly at all past the first third, so the whisker leaves the lip as drawn and then hangs. A slow
// breeze sways the free part. The platform (y = 0) stops the nodes, with friction.
//
// Frame-rate independent like the wyvern's tail (wyvern/anim/tail.ts): the strands step at a fixed
// 120 Hz with the head's pose interpolated to each step's own time, and are drawn between their last
// two steps at the frame's time (the caller passes the blend).

import { Quaternion, Vector3 } from 'three';
import { noise1 } from '../wyvern/ik';
import type { DragonStrand } from './parts';

/** The strands' tuning. */
export const WHISKER = {
  gravity: 9.81,
  /** Per step: the share of a node's velocity it keeps (air drag). */
  keep: 0.985,
  /** Per step: the pull toward the rest shape at the root, falling off along the strand as (1 − f)^power. */
  shapeRoot: 0.2,
  shapePower: 10,
  /** Distance passes per step. */
  iterations: 6,
  /** Ground friction: the share of sliding a node on the platform keeps per step. */
  friction: 0.6,
  /** The nodes' radius above the platform (m). */
  radius: 0.02,
  /** The breeze (m/s² at the tip). */
  breeze: 0.5,
};

const _v = new Vector3();
const _w = new Vector3();

/** Two-or-more strands' nodes as flat arrays (x, y, z per node). */
export class WhiskerStrands {
  readonly strands: DragonStrand[];
  readonly count: number[];
  /** Current, previous-step and before-that positions per strand (dragon frame). */
  pos: Float64Array[];
  prev: Float64Array[];
  /** The positions at the last two steps, for drawing between them. */
  stepA: Float64Array[];
  stepB: Float64Array[];
  private rest: Float64Array[];
  private seg: number[];

  constructor(strands: DragonStrand[]) {
    this.strands = strands;
    this.count = strands.map((s) => s.nodes.length);
    const mk = () => strands.map((s) => new Float64Array(s.nodes.length * 3));
    this.pos = mk();
    this.prev = mk();
    this.stepA = mk();
    this.stepB = mk();
    this.rest = strands.map((s) => Float64Array.from(s.nodes.flat()));
    this.seg = strands.map((s) => {
      let L = 0;
      for (let i = 1; i < s.nodes.length; i++) L += Math.hypot(s.nodes[i][0] - s.nodes[i - 1][0], s.nodes[i][1] - s.nodes[i - 1][1], s.nodes[i][2] - s.nodes[i - 1][2]);
      return L / (s.nodes.length - 1);
    });
  }

  /** Rest node i of strand s, carried by the head (bind pivot, posed pivot and rotation). */
  carried(s: number, i: number, bindPivot: Vector3, headP: Vector3, headQ: Quaternion, out: Vector3): Vector3 {
    const r = this.rest[s];
    return out.set(r[i * 3] - bindPivot.x, r[i * 3 + 1] - bindPivot.y, r[i * 3 + 2] - bindPivot.z).applyQuaternion(headQ).add(headP);
  }

  /** Put every node where the head carries it at rest, at rest. */
  reset(bindPivot: Vector3, headP: Vector3, headQ: Quaternion): void {
    for (let s = 0; s < this.strands.length; s++) {
      for (let i = 0; i < this.count[s]; i++) {
        this.carried(s, i, bindPivot, headP, headQ, _v);
        for (const a of [this.pos[s], this.prev[s], this.stepA[s], this.stepB[s]]) {
          a[i * 3] = _v.x;
          a[i * 3 + 1] = Math.max(WHISKER.radius, _v.y);
          a[i * 3 + 2] = _v.z;
        }
      }
    }
  }

  /** One fixed step of h seconds at time t, the head at (headP, headQ); `down` is the dragon frame's down. */
  step(h: number, t: number, bindPivot: Vector3, headP: Vector3, headQ: Quaternion, down: Vector3): void {
    const W = WHISKER;
    for (let s = 0; s < this.strands.length; s++) {
      const P = this.pos[s];
      const Q = this.prev[s];
      const n = this.count[s];
      // The strands' "before" for drawing.
      this.stepA[s].set(this.stepB[s]);
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        const k = i * 3;
        if (i === 0) {
          this.carried(s, 0, bindPivot, headP, headQ, _v);
          Q[k] = P[k];
          Q[k + 1] = P[k + 1];
          Q[k + 2] = P[k + 2];
          P[k] = _v.x;
          P[k + 1] = _v.y;
          P[k + 2] = _v.z;
          continue;
        }
        // Verlet: keep most of the velocity, fall, drift in the breeze.
        const vx = (P[k] - Q[k]) * W.keep;
        const vy = (P[k + 1] - Q[k + 1]) * W.keep;
        const vz = (P[k + 2] - Q[k + 2]) * W.keep;
        Q[k] = P[k];
        Q[k + 1] = P[k + 1];
        Q[k + 2] = P[k + 2];
        const sway = W.breeze * f * f;
        const bx = sway * noise1(t * 0.31 + s * 7.1, 11);
        const bz = sway * noise1(t * 0.27 + s * 3.7, 12);
        P[k] += vx + (down.x * W.gravity + bx) * h * h;
        P[k + 1] += vy + down.y * W.gravity * h * h;
        P[k + 2] += vz + (down.z * W.gravity + bz) * h * h;
        // The rest shape's pull, strong at the lip.
        const pull = W.shapeRoot * Math.pow(1 - f, W.shapePower);
        if (pull > 1e-4) {
          this.carried(s, i, bindPivot, headP, headQ, _v);
          P[k] += (_v.x - P[k]) * pull;
          P[k + 1] += (_v.y - P[k + 1]) * pull;
          P[k + 2] += (_v.z - P[k + 2]) * pull;
        }
      }
      // Hold the spacing, from the root out (the root is pinned).
      const L = this.seg[s];
      for (let it = 0; it < W.iterations; it++) {
        for (let i = 1; i < n; i++) {
          const a = (i - 1) * 3;
          const b = i * 3;
          _w.set(P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]);
          const d = _w.length();
          if (d < 1e-9) continue;
          const e = (d - L) / d;
          if (i === 1) {
            P[b] -= _w.x * e;
            P[b + 1] -= _w.y * e;
            P[b + 2] -= _w.z * e;
          } else {
            P[a] += _w.x * e * 0.5;
            P[a + 1] += _w.y * e * 0.5;
            P[a + 2] += _w.z * e * 0.5;
            P[b] -= _w.x * e * 0.5;
            P[b + 1] -= _w.y * e * 0.5;
            P[b + 2] -= _w.z * e * 0.5;
          }
        }
        // The platform, with friction on what lies on it.
        for (let i = 1; i < n; i++) {
          const k = i * 3;
          if (P[k + 1] < W.radius) {
            P[k + 1] = W.radius;
            P[k] = Q[k] + (P[k] - Q[k]) * W.friction;
            P[k + 2] = Q[k + 2] + (P[k + 2] - Q[k + 2]) * W.friction;
          }
        }
      }
      this.stepB[s].set(P);
    }
  }

  /** Strand s's nodes drawn between the last two steps (blend 0 → the earlier, 1 → the later). */
  drawn(s: number, blend: number, out: Float64Array): Float64Array {
    const a = this.stepA[s];
    const b = this.stepB[s];
    for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * blend;
    return out;
  }
}

const _qa = new Quaternion();
const _qb = new Quaternion();
const _ta = new Vector3();
const _tb = new Vector3();
const _p = new Vector3();

/**
 * Bend a whisker geometry along drawn strands. Each vertex's (strand, along) places it on its
 * strand: its offset from the rest centre line, turned with the head and then by how far that
 * stretch of strand has swung from where the head would carry it, lands on the drawn centre line.
 */
export class WhiskerDeform {
  private readonly frames: Quaternion[][];
  private readonly drawnNodes: Float64Array[];

  constructor(
    private readonly strands: DragonStrand[],
    private readonly rest: Float32Array,
    private readonly restNormal: Float32Array,
    private readonly strand: Float32Array,
  ) {
    this.frames = strands.map((s) => s.nodes.map(() => new Quaternion()));
    this.drawnNodes = strands.map((s) => new Float64Array(s.nodes.length * 3));
  }

  /** Write bent positions and normals. `nodes(s, out)` fills strand s's drawn nodes (dragon frame). */
  apply(sim: WhiskerStrands, blend: number, headQ: Quaternion, outPos: Float32Array, outNormal: Float32Array): void {
    for (let s = 0; s < this.strands.length; s++) {
      const N = sim.drawn(s, blend, this.drawnNodes[s]);
      const R = this.strands[s].nodes;
      const n = R.length;
      const F = this.frames[s];
      // Per segment: the turn from the head-carried rest tangent to the drawn one (after the head).
      for (let i = 0; i < n - 1; i++) {
        _ta.set(R[i + 1][0] - R[i][0], R[i + 1][1] - R[i][1], R[i + 1][2] - R[i][2]).applyQuaternion(headQ).normalize();
        _tb.set(N[i * 3 + 3] - N[i * 3], N[i * 3 + 4] - N[i * 3 + 1], N[i * 3 + 5] - N[i * 3 + 2]).normalize();
        F[i].setFromUnitVectors(_ta, _tb).multiply(headQ);
      }
      // Per node: halfway between its two segments (the ends take their one).
      for (let i = n - 1; i >= 1; i--) {
        if (i === n - 1) F[i].copy(F[i - 1]);
        else F[i].slerp(F[i - 1], 0.5);
      }
    }
    const nv = this.rest.length / 3;
    for (let v = 0; v < nv; v++) {
      const s = Math.round(this.strand[v * 2]);
      const R = this.strands[s].nodes;
      const n = R.length;
      const u = Math.min(n - 1, Math.max(0, this.strand[v * 2 + 1] * (n - 1)));
      const i = Math.min(n - 2, Math.floor(u));
      const f = u - i;
      const N = this.drawnNodes[s];
      const F = this.frames[s];
      _qa.copy(F[i]).slerp(F[i + 1], f);
      // Offset from the rest centre line, turned onto the drawn one.
      _p.set(
        this.rest[v * 3] - (R[i][0] + (R[i + 1][0] - R[i][0]) * f),
        this.rest[v * 3 + 1] - (R[i][1] + (R[i + 1][1] - R[i][1]) * f),
        this.rest[v * 3 + 2] - (R[i][2] + (R[i + 1][2] - R[i][2]) * f),
      ).applyQuaternion(_qa);
      outPos[v * 3] = N[i * 3] + (N[i * 3 + 3] - N[i * 3]) * f + _p.x;
      outPos[v * 3 + 1] = N[i * 3 + 1] + (N[i * 3 + 4] - N[i * 3 + 1]) * f + _p.y;
      outPos[v * 3 + 2] = N[i * 3 + 2] + (N[i * 3 + 5] - N[i * 3 + 2]) * f + _p.z;
      _qb.copy(_qa);
      _p.set(this.restNormal[v * 3], this.restNormal[v * 3 + 1], this.restNormal[v * 3 + 2]).applyQuaternion(_qb);
      outNormal[v * 3] = _p.x;
      outNormal[v * 3 + 1] = _p.y;
      outNormal[v * 3 + 2] = _p.z;
    }
  }
}
