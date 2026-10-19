// Wings: the arm (humerus, forearm, hand) as one tube with smooth joints, three long fingers,
// knuckle claws for walking, and the membranes stretched between them (group 1, rendered with
// the translucent membrane material).
//
// Membrane sectors (left wing; the right mirrors it):
//   A  finger 0 ↔ finger 1 (the wingtip panel)
//   B  finger 1 ↔ finger 2
//   C  arm + finger 2 ↔ the flank (the big inner panel, attached from shoulder to hip)
//   D  the small leading-edge panel in front of the elbow (shoulder → wrist)
// Each is a ruled patch between two skinned boundary curves; interior vertices blend the two
// boundaries' bones, so the membrane folds like a fan when the fingers close.

import { Vector3 } from 'three';
import { smoothstep } from '../../../core/math';
import { GeoBuilder, MREGION, REGION, Skin, ellipsoid, tube } from '../builder';
import { HUMERUS_R, SIDE_SIGN, armScale, innerTrailRoot, type RigDef } from '../rig';
import { bodyChain } from './body';
import { SkinChain } from './chain';
import { bezier3, keyed, spike } from './shape';
import { RES, sides, steps, type Res } from './res';

/** Peak skin weight of the fold helper in the inner panel (sector C). */
const FOLD_W = 0.55;
/** Where the helper's weight has risen to full strength, out from the flank root (fraction of t). */
const FOLD_ROOT = 0.18;
/** Peak of smoothstep(0, FOLD_ROOT, t)·(1 − t)^0.7, so FOLD_W stays the peak weight. */
const FOLD_PEAK = (() => {
  let m = 0;
  for (let i = 0; i <= 400; i++) {
    const t = i / 400;
    const x = Math.min(1, t / FOLD_ROOT);
    m = Math.max(m, x * x * (3 - 2 * x) * Math.pow(1 - t, 0.7));
  }
  return m;
})();
/**
 * Fold helper weight over sector C (t from the flank root line to finger 2, v from the arm to the
 * trailing edge): strongest in the interior near the body, zero on every boundary, so the root
 * stays glued along the flank (the panel pleats against the body rather than peeling off it), and
 * the arm, finger and trailing edge keep their own bones.
 */
export const foldWeight = (t: number, v: number) => {
  const x = Math.min(1, t / FOLD_ROOT);
  return ((FOLD_W * Math.sin(Math.PI * v) * x * x * (3 - 2 * x)) / FOLD_PEAK) * Math.pow(1 - t, 0.7);
};
/** A skin's `n` heaviest influences, renormalised. */
function prune(s: Skin, n: number): Skin {
  const order = s.bones.map((_, i) => i).sort((a, b) => s.weights[b] - s.weights[a]).slice(0, n);
  let sum = 0;
  for (const i of order) sum += s.weights[i];
  const out = new Skin();
  for (const i of order) out.add(s.bones[i], s.weights[i] / sum);
  return out;
}

/** aExtra scratch (x AO open, y pleat valley; see builder.ts). */
const _ext: [number, number, number, number] = [1, 0, 0, 0];

/** How far below the flank's equator the membrane root runs half-way back (fraction of lower). */
const ROOT_DROP = 0.3;
const _line = new Vector3();
const _dip = new Vector3();
const _seg = new Vector3();
const _rel = new Vector3();
const _pc = new Vector3();
/**
 * Inner panel lever arm (× the torso half-width): how far out from the root along the flank the
 * wing's bones take over a membrane point fully (A2).
 */
const LEVER = 1.5;
/** Rows across the inner panel at LOD0: four to each of the eight fold pleats. */
const PLEAT_ROWS = 32;
/**
 * How fast the flank's share falls off along the inner panel's trailing edge: (1 − t)^TRAIL_DECAY.
 * Linear, as C3's trailRoll (anim/ground.ts) models it: it rolls finger 2 so the edge's midpoint,
 * half on the flank and half on the finger, lies half-way across. (A faster fall-off, 1.5, put 65%
 * on the finger there and turned the folded panel's middle 20-37 cm into the flank.)
 */
const TRAIL_DECAY = 1;

export { armScale, humerusRootRadius } from '../rig';

/**
 * The fold helpers' rest blend, per side: the bones (and weights) the inner panel's interior is
 * skinned to besides the helper, averaged over the panel by the helper's own weight. Holding a
 * helper at this blend of bone transforms leaves the panel as it would be without the helper;
 * the animator folds from there.
 */
export type FoldRest = [{ bone: number; weight: number }[], { bone: number; weight: number }[]];
const foldRestCache = new WeakMap<RigDef, FoldRest>();

/** The fold helpers' rest blend for a rig (see FoldRest). */
export function foldRest(rig: RigDef): FoldRest {
  let r = foldRestCache.get(rig);
  if (!r) {
    buildWings(new GeoBuilder(), rig, RES[2]);
    r = foldRestCache.get(rig)!;
  }
  return r;
}

export interface WingInfo {
  /** Membrane area of one wing (m², bind pose), for checks against BreedStats.wingArea. */
  membraneArea: number;
}

export function buildWings(b: GeoBuilder, rig: RigDef, res: Res = RES[0]): WingInfo {
  const humRings = res.lod === 0 ? 3 + res.limbRings : res.lod === 1 ? 3 : 1;
  const foreRings = res.lod === 0 ? 4 : res.lod === 1 ? 2 : 1;
  /** Membrane grid size for a base count (LOD0 ×1.5 ... LOD2 fans). */
  const grid = (n: number, min: number) => (res.membrane > 0 ? Math.max(min, Math.round(n * res.membrane)) : min);
  const P = rig.props;
  const S = P.shape;
  const k = armScale(rig);
  let area = 0;
  const rest: FoldRest = [[], []];
  for (let side = 0; side < 2; side++) {
    // Fold-weighted bone shares of the inner panel (sampled on a fixed grid, any LOD alike).
    const share = new Map<number, number>();
    const sx = SIDE_SIGN[side];
    const wi = rig.idx.wings[side];
    const foldBone = rig.idx.fold[side];
    const m = (v: Vector3) => new Vector3(v.x * sx, v.y, v.z);
    const sh = new Vector3(P.shoulder[0] * sx, P.shoulder[1], P.shoulder[2]);
    const el = m(rig.elbow);
    const wr = m(rig.wrist);
    const kn = m(rig.knuckle);
    const tips = rig.fingerTips.map(m);
    const mids = [0, 1, 2].map((f) => kn.clone().lerp(tips[f], P.arm.fingers[f][0] / (P.arm.fingers[f][0] + P.arm.fingers[f][1])));

    // --- Arm tube ---------------------------------------------------------------------------------
    const pts: Vector3[] = [];
    const rad: [number, number][] = [];
    const sAt: number[] = [];
    // Ring centre offsets (the deltopectoral crest) in the ring's (up, forward) frame.
    const crest: number[] = [];
    const push = (p: Vector3, r: number, dp = 0) => {
      sAt.push(pts.length ? sAt[sAt.length - 1] + p.distanceTo(pts[pts.length - 1]) : 0);
      pts.push(p);
      rad.push([r, r * 0.68]);
      crest.push(dp);
    };
    // A flier's arm: a massive humerus flattened in the wing plane, with the deltopectoral crest
    // (where the flight muscles insert) bulging toward the leading edge's underside near the
    // shoulder, tapering to a stout forearm.
    const inBody = sh.clone().add(new Vector3(-0.45 * S.torsoHalfWidth * sx, -0.05, 0));
    push(inBody, 0.34 * k);
    const iSh = pts.length;
    push(sh.clone(), 0.345 * k);
    for (let i = 1; i <= humRings; i++) {
      const t = i / (humRings + 1);
      push(sh.clone().lerp(el, t), keyed(HUMERUS_R, t) * k, t > 0.15 && t < 0.45 ? 0.06 * k * Math.sin((Math.PI * (t - 0.15)) / 0.3) : 0);
    }
    const iEl = pts.length;
    push(el.clone(), 0.17 * k);
    for (let i = 1; i <= foreRings; i++) push(el.clone().lerp(wr, i / (foreRings + 1)), (0.17 - (0.024 * i) / (foreRings + 1)) * k);
    const iWr = pts.length;
    // A load-bearing wrist and a stout hand: the wrist is a front foot.
    push(wr.clone(), 0.15 * k);
    if (res.lod < 2) push(wr.clone().lerp(kn, 0.5), 0.11 * k);
    const iKn = pts.length;
    push(kn.clone(), 0.1 * k);
    push(kn.clone().add(new Vector3(0.05 * sx, 0, 0)), 0.07 * k);
    const chain = new SkinChain([
      { bone: rig.idx.chest, s0: -0.4, s1: sAt[iSh] },
      { bone: wi.humerus, s0: sAt[iSh], s1: sAt[iEl] },
      { bone: wi.forearm, s0: sAt[iEl], s1: sAt[iWr] },
      { bone: wi.hand, s0: sAt[iWr], s1: sAt[iKn] },
    ]);
    // Bias the tent so the shoulder stays mostly on the humerus (otherwise flaps pinch it).
    const armSkin = (s: number) => (s < sAt[iSh] * 0.5 ? chain.skin(s) : chain.skin(Math.max(s, sAt[iSh] + 0.05)));
    b.begin(0);
    const rings: number[][] = [];
    const dir = new Vector3();
    const u = new Vector3();
    const w = new Vector3();
    const p = new Vector3();
    const SEG = res.armAround;
    for (let i = 0; i < pts.length; i++) {
      dir.subVectors(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      u.set(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
      w.crossVectors(dir, u).normalize();
      const ring: number[] = [];
      const skin = armSkin(sAt[i]);
      for (let q = 0; q < SEG; q++) {
        const th = (q / SEG) * Math.PI * 2;
        const c = Math.cos(th);
        // A slight leading-edge ridge (the forearm's front is the wing's leading edge).
        p.copy(pts[i])
          .addScaledVector(u, c * rad[i][1] - crest[i] * 0.7)
          .addScaledVector(w, Math.sin(th) * rad[i][0] + crest[i] * 0.7 * sx);
        ring.push(b.vertex(p, skin, { region: REGION.skin, belly: Math.max(0, -c) * 0.7, dorsal: Math.max(0, c) }, 20 + sAt[i], Math.sin(th)));
      }
      rings.push(ring);
    }
    for (let r = 0; r < rings.length - 1; r++) {
      for (let q = 0; q < SEG; q++) {
        const j = (q + 1) % SEG;
        b.quad(rings[r][q], rings[r][j], rings[r + 1][j], rings[r + 1][q]);
      }
    }
    const capEnd = b.vertex(pts[pts.length - 1].clone().add(new Vector3(0.03 * sx, 0, 0)), armSkin(sAt[pts.length - 1]), { region: REGION.skin });
    const last = rings[rings.length - 1];
    for (let q = 0; q < SEG; q++) b.tri(last[q], last[(q + 1) % SEG], capEnd);
    b.end();

    // --- Fingers ------------------------------------------------------------------------------------
    for (let f = 0; f < 3; f++) {
      const [fa, fb] = wi.fingers[f];
      const la = P.arm.fingers[f][0];
      const fchain = new SkinChain([
        { bone: wi.hand, s0: -0.3, s1: 0 },
        { bone: fa, s0: 0, s1: la },
        { bone: fb, s0: la, s1: la + P.arm.fingers[f][1] },
      ]);
      const N = res.fingerRings;
      const fpts: Vector3[] = [];
      for (let i = 0; i <= N; i++) fpts.push(kn.clone().lerp(tips[f], i / N));
      // Stout finger struts, so the bone fan reads against the membrane from behind.
      const r0 = 1.3 * (0.065 - 0.008 * f) * k;
      b.begin(0);
      spike(
        b,
        fpts,
        r0,
        (i) => fchain.skin((i / N) * (la + P.arm.fingers[f][1])),
        { region: REGION.skin, dorsal: 0.6 },
        res.fingerSides,
        new Vector3(0, 1, 0),
        0.8,
        0.75,
      );
      b.end();
    }

    // --- The hand it walks on: a sole pad and three clawed digits at the wrist -------------------
    if (res.lod < 2) buildHand(b, rig, res, side, wr, k);

    // --- Membranes --------------------------------------------------------------------------------
    const fingerSkin = (f: number, t: number, out: Skin, weight: number) => {
      const [fa, fb] = wi.fingers[f];
      const split = P.arm.fingers[f][0] / (P.arm.fingers[f][0] + P.arm.fingers[f][1]);
      const bw = 0.18;
      const x = (t - split) / bw;
      const tb = x <= -0.5 ? 0 : x >= 0.5 ? 1 : x + 0.5;
      out.add(fa, (1 - tb) * weight);
      out.add(fb, tb * weight);
    };
    const tris: number[] = [];
    const patch = (
      nt: number,
      nv: number,
      pos: (t: number, v: number, out: Vector3) => Vector3,
      skin: (t: number, v: number) => Skin,
      thin: (t: number, v: number) => number,
      edge: (t: number, v: number) => number,
      flutter: (t: number, v: number) => number,
      vOffset: number,
      extra?: (t: number, v: number) => readonly [number, number, number, number],
    ) => {
      b.begin(1);
      const grid: number[][] = [];
      for (let i = 0; i <= nt; i++) {
        const t = i / nt;
        const row: number[] = [];
        for (let j = 0; j <= nv; j++) {
          const v = j / nv;
          pos(t, v, p);
          row.push(
            b.vertex(p, skin(t, v), { region: MREGION.wing, belly: thin(t, v), dorsal: edge(t, v), flutter: flutter(t, v), extra: extra?.(t, v) }, t, v + vOffset),
          );
        }
        grid.push(row);
      }
      for (let i = 0; i < nt; i++) {
        for (let j = 0; j < nv; j++) {
          const a = grid[i][j];
          const c = grid[i + 1][j];
          const d = grid[i + 1][j + 1];
          const e = grid[i][j + 1];
          if (sx > 0) {
            b.tri(a, c, d);
            b.tri(a, d, e);
          } else {
            b.tri(a, d, c);
            b.tri(a, e, d);
          }
          tris.push(a, c, d, a, d, e);
        }
      }
      b.end();
    };

    // A & B: between fingers, rays from the knuckle to a scalloped trailing edge.
    for (let sec = 0; sec < 2; sec++) {
      const fA = sec;
      const fB = sec + 1;
      const tA = tips[fA];
      const tB = tips[fB];
      const midTip = tA.clone().lerp(tB, 0.5);
      const inward = kn.clone().sub(midTip).normalize();
      const depth = S.wing.scallop * tA.distanceTo(tB);
      const E = new Vector3();
      patch(
        grid(16, 1),
        grid(8, 2),
        (t, v, out) => {
          E.lerpVectors(tA, tB, v).addScaledVector(inward, depth * Math.sin(Math.PI * v));
          return out.lerpVectors(kn, E, t);
        },
        (t, v) => {
          const s = new Skin();
          fingerSkin(fA, t, s, 1 - v);
          fingerSkin(fB, t, s, v);
          return s;
        },
        (t, v) => Math.pow(t, 0.6) * Math.sin(Math.PI * v),
        (t) => t,
        (t, v) => t * t * (0.35 + 0.65 * Math.sin(Math.PI * v)),
        sec,
      );
    }

    // C: arm + finger 2 ↔ flank.
    const body = bodyChain(rig);
    const trail = m(innerTrailRoot(P, rig.plan));
    const sTrail = rig.plan.sAtZ(trail.z);
    const bodyTrailSkin = body.skin(sTrail);
    const shAttach = sh.clone().add(new Vector3(-0.05 * sx, 0, -0.08));
    const armPts = [shAttach, el, wr, kn];
    const armLen: number[] = [0];
    for (let i = 1; i < armPts.length; i++) armLen.push(armLen[i - 1] + armPts[i].distanceTo(armPts[i - 1]));
    const armTotal = armLen[armLen.length - 1];
    const armAt = (t: number, out: Vector3) => {
      const s = t * armTotal;
      let i = 0;
      while (i < armPts.length - 2 && armLen[i + 1] < s) i++;
      const f = (s - armLen[i]) / Math.max(1e-6, armLen[i + 1] - armLen[i]);
      return out.lerpVectors(armPts[i], armPts[i + 1], Math.min(1, Math.max(0, f)));
    };
    const armChainS = (t: number) => {
      // Map the attach curve parameter onto the arm tube's arc length.
      const s = t * armTotal;
      return sAt[iSh] + s;
    };
    // The root runs along the side of the body, not in a straight line from the shoulder to the
    // hip: behind the shoulder it drops to the lower flank (like a bat's or a pterosaur's), so the
    // rider's legs hang above it and a beating wing never sweeps through them. A quadratic curve
    // through a low point half-way back, faded out over the inner part of the panel.
    const zMid = (shAttach.z + trail.z) / 2;
    const stM = rig.plan.station(rig.plan.sAtZ(zMid));
    const rootMid = new Vector3(0.86 * stM.halfWidth * sx, stM.center.y - ROOT_DROP * stM.lower, zMid);
    const rootCtl = rootMid.clone().multiplyScalar(2).addScaledVector(shAttach, -0.5).addScaledVector(trail, -0.5);
    const rootDip = (v: number, out: Vector3) =>
      out
        .copy(shAttach)
        .multiplyScalar((1 - v) * (1 - v))
        .addScaledVector(rootCtl, 2 * v * (1 - v))
        .addScaledVector(trail, v * v)
        .sub(_line.lerpVectors(shAttach, trail, v));
    const tip2 = tips[2];
    const midC = trail.clone().lerp(tip2, 0.5);
    const inwardC = wr.clone().sub(midC);
    inwardC.y = 0;
    inwardC.normalize();
    const depthC = (S.wing.scallopInner ?? S.wing.scallop) * 1.2 * trail.distanceTo(tip2);
    const Lp = new Vector3();
    const Rp = new Vector3();
    /** Panel C's bind surface: from the arm (v = 0) to the trailing edge, the root along the flank at t = 0. */
    const posC = (t: number, v: number, out: Vector3) => {
      armAt(t, Lp);
      Rp.lerpVectors(trail, tip2, t).addScaledVector(inwardC, depthC * Math.sin(Math.PI * t));
      out.lerpVectors(Lp, Rp, v);
      const w = Math.pow(1 - t, 3);
      return w > 1e-4 ? out.addScaledVector(rootDip(v, _dip), w) : out;
    };
    // The root line along the flank, for the lever arm below.
    const rootLine: Vector3[] = [];
    for (let i = 0; i <= 32; i++) rootLine.push(posC(0, i / 32, new Vector3()));
    /** Distance (m) from a bind point to the root line, and the root parameter (v) nearest it. */
    const toRoot = (q: Vector3): [number, number] => {
      let best = Infinity;
      let bv = 0;
      for (let i = 0; i < rootLine.length - 1; i++) {
        const a = rootLine[i];
        _seg.subVectors(rootLine[i + 1], a);
        const f = Math.min(1, Math.max(0, _rel.subVectors(q, a).dot(_seg) / Math.max(1e-9, _seg.lengthSq())));
        const d = _rel.copy(a).addScaledVector(_seg, f).distanceTo(q);
        if (d < best) {
          best = d;
          bv = (i + f) / (rootLine.length - 1);
        }
      }
      return [best, bv];
    };
    const lever = LEVER * S.torsoHalfWidth;
    /**
     * The inner panel's skin without the fold helper. The leading side follows the arm, the
     * trailing side blends from the flank at the root to finger 2 at the tip. The arm's share is
     * weighted by lever arm: it carries a point in proportion to the point's distance from the root
     * along the flank (fully beyond `lever`), the body at the nearest root point carrying the rest,
     * as a membrane hinged on the flank moves. Before, the rows near the root were half on the
     * humerus 0.6 m behind the shoulder and swung with every beat; the arm's own edge (v near 0)
     * keeps the arm.
     */
    const innerSkin = (t: number, v: number) => {
      const s = new Skin();
      if (t < 0.02) s.add(rig.idx.chest, 1 - v);
      else {
        const [r, vr] = toRoot(posC(t, v, _pc));
        const k = 1 - (1 - smoothstep(0, lever, r)) * smoothstep(0, 0.25, v);
        s.mix(chain.skin(armChainS(t)), (1 - v) * k);
        s.add(rig.idx.chest, (1 - v) * (1 - k) * (1 - vr));
        s.mix(bodyTrailSkin, (1 - v) * (1 - k) * vr);
      }
      // Trailing boundary: the flank at the root, finger 2 toward the tip (see TRAIL_DECAY).
      const bt = Math.pow(1 - t, TRAIL_DECAY);
      s.mix(bodyTrailSkin, v * bt);
      fingerSkin(2, 1, s, v * (1 - bt));
      return s;
    };
    // Across the panel (v) the near LOD carries four rows to each of the fold's eight pleats
    // (the uFold vertex pleats in materials.ts, sin(aUv2.y·8π + aUv2.x·3)), so they fold as
    // geometry rather than alias; fewer rows along it pay for them.
    patch(
      grid(13, 2),
      res.lod === 0 ? PLEAT_ROWS : grid(10, 2),
      posC,
      (t, v) => {
        const s = innerSkin(t, v);
        // The fold helper takes the interior (most near the root, none on the boundaries), so
        // the animator can contract and pleat the folded panel against the flank. (The panel's own
        // skin is pruned to three bones first, so the four influences keep the helper's share exact.)
        const wf = foldWeight(t, v);
        return wf > 1e-4 ? new Skin().mix(prune(s, 3), 1 - wf).add(foldBone, wf) : s;
      },
      (t, v) => v * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.3))),
      (_t, v) => v,
      (t, v) => v * v * Math.sin(Math.PI * t),
      2,
      (t, v) => {
        // Pleat valleys: troughs of the uFold vertex pleats (sin(aUv2.y * 8π + aUv2.x * 3),
        // aUv2.y = v + 2 here), where the folded sheet bunches, weighted like the fold helper.
        const trough = 0.5 - 0.5 * Math.sin((v + 2) * 25.13 + t * 3);
        _ext[1] = (foldWeight(t, v) / FOLD_W) * trough;
        return _ext;
      },
    );

    {
      // The rest blend: sample the panel's own skin (without the helper) on a fixed grid.
      for (let i = 0; i <= 16; i++)
        for (let j = 0; j <= 10; j++) {
          const t = i / 16;
          const v = j / 10;
          const wf = foldWeight(t, v);
          if (wf < 1e-4) continue;
          const sk = innerSkin(t, v);
          for (let q = 0; q < sk.bones.length; q++) share.set(sk.bones[q], (share.get(sk.bones[q]) ?? 0) + wf * sk.weights[q]);
        }
      let sum = 0;
      for (const w of share.values()) sum += w;
      for (const [bone, w] of share) if (w / sum > 0.01) rest[side].push({ bone, weight: w / sum });
      const kept = rest[side].reduce((a, e) => a + e.weight, 0);
      for (const e of rest[side]) e.weight /= kept;
    }

    // D: leading-edge panel in front of the elbow.
    const lead0 = sh.clone().add(new Vector3(0, 0, 0.12));
    const fwd = new Vector3(0, 0, 1);
    patch(
      grid(10, 2),
      grid(2, 1),
      (t, v, out) => {
        armAt(t * (armLen[2] / armTotal), Lp);
        Rp.lerpVectors(lead0, wr, t).addScaledVector(fwd, 0.06 * Math.sin(Math.PI * t));
        return out.lerpVectors(Lp, Rp, v);
      },
      (t, v) => {
        const s = new Skin();
        s.mix(chain.skin(armChainS(t * (armLen[2] / armTotal))), 1 - v);
        s.add(wi.humerus, v * (1 - t));
        s.add(wi.forearm, v * t);
        return s;
      },
      (_t, v) => v * 0.6,
      (_t, v) => v,
      () => 0,
      -1,
    );

    // Area of this wing's membrane (bind pose).
    const A = new Vector3();
    const B = new Vector3();
    const C = new Vector3();
    for (let i = 0; i < tris.length; i += 3) {
      b.getPosition(tris[i], A);
      b.getPosition(tris[i + 1], B);
      b.getPosition(tris[i + 2], C);
      area += B.sub(A).cross(C.sub(A)).length() / 2;
    }
  }
  foldRestCache.set(rig, rest);
  return { membraneArea: area / 2 };
}

/**
 * The wing-walker's hand (one side): a pale sole pad under the wrist and three short digits
 * fanned forward (pterosaur-like), each jointed at a knuckle and ending in a recurved claw, all
 * riding the claw bone. In the bind (flight) pose the digits point forward along the leading
 * edge; standing, the animator plants the wrist WRIST_CLEARANCE * standHeight above the ground
 * with the claw bone pitched down by GROUND_PITCH, and the digits are bent so their claws meet
 * the ground there.
 */
function buildHand(b: GeoBuilder, rig: RigDef, res: Res, side: number, wr: Vector3, k: number): void {
  const sx = SIDE_SIGN[side];
  const skin = Skin.of(rig.idx.wings[side].claw);
  const sh = rig.props.standHeight;
  const ground = WRIST_CLEARANCE * sh;
  // Sole pad: a broad, flat cushion under the wrist, a touch sunk into the ground when standing.
  // Only its sole is pale (like the belly); the sides take the hide, so the wrist reads as one
  // limb ending in a foot rather than a pale mitten.
  const pr: [number, number, number] = [0.17 * k, 0.1 * k, 0.22 * k];
  const padC = wr.clone().add(new Vector3(0.02 * k * sx, -ground + 0.08 * k, 0.04 * k));
  b.begin(0);
  ellipsoid(
    b,
    padC,
    new Vector3(1, 0, 0),
    new Vector3(0, 1, 0),
    new Vector3(0, 0, 1),
    pr,
    () => skin,
    (_p, nl) => ({ region: REGION.skin, belly: 0.75 * smoothstep(0.2, 0.8, -nl.y) }),
    res.lod === 0 ? 5 : 3,
    res.lod === 0 ? 8 : 5,
  );
  b.end();
  const tilt = Math.tan(GROUND_PITCH);
  for (let d = 0; d < 3; d++) {
    const az = (d - 1) * 0.35 * sx;
    const len = HAND_DIGITS[d] * k;
    const r0 = 0.06 * k;
    const fwd = new Vector3(Math.sin(az), 0, Math.cos(az));
    const base = wr.clone().add(new Vector3(0.03 * k * sx, -0.03 * k, 0.08 * k)).addScaledVector(fwd, 0.06 * k);
    // Proximal phalanx level with the claw bone; the distal one bends down so that, pitched by
    // GROUND_PITCH when standing, the claw tip reaches the ground.
    const L1 = 0.55 * len;
    const L2 = 0.45 * len;
    const drop = ground - 0.03 * k - L1 * Math.sin(GROUND_PITCH);
    const a2 = Math.min(0.75, Math.max(0.08, Math.asin(Math.min(1, Math.max(0, drop / (L2 + 0.05 * k)))) - GROUND_PITCH));
    const knuckle = base.clone().addScaledVector(fwd, L1);
    const d2 = fwd.clone().multiplyScalar(Math.cos(a2)).add(new Vector3(0, -Math.sin(a2), 0));
    const tip = knuckle.clone().addScaledVector(d2, L2);
    b.begin(0);
    if (res.joints) {
      tube(b, {
        points: [base, base.clone().lerp(knuckle, 0.5), knuckle, knuckle.clone().lerp(tip, 0.5), tip],
        radii: [r0, r0 * 0.88, r0 * 1.02, r0 * 0.72, r0 * 0.5],
        segments: 5,
        hint: new Vector3(0, 1, 0),
        skin: () => skin,
        mat: () => ({ region: REGION.skin, dorsal: 0.5 }),
        capEnd: true,
      });
    } else {
      spike(b, [base, knuckle, tip], r0, skin, { region: REGION.skin, dorsal: 0.5 }, 4, new Vector3(0, 1, 0), 1, 0.5);
    }
    // Recurved claw: out of the digit, hooking down into the ground.
    const c0 = tip.clone().addScaledVector(d2, -0.02 * k);
    const c1 = c0.clone().addScaledVector(d2, 0.09 * k).add(new Vector3(0, 0.02 * k, 0));
    const c2 = c0.clone().addScaledVector(fwd, 0.13 * k).add(new Vector3(0, -0.1 * k - tilt * 0.13 * k, 0));
    spike(b, bezier3(c0, c1, c2, res.lod === 0 ? 3 : 1), 0.05 * k, skin, { region: REGION.claw }, res.lod === 0 ? 5 : 3, new Vector3(0, 1, 0), 0.8);
    b.end();
  }
}

/** The animator plants the wrist this far (× standHeight) above the ground (applyWingIK). */
const WRIST_CLEARANCE = 0.07;
/** ...with the claw bone's forward axis pitched down by this much (radians, atan 0.25). */
const GROUND_PITCH = Math.atan(0.25);
/** Hand digit lengths (× the arm scale k): inner, middle, outer. */
const HAND_DIGITS = [0.3, 0.34, 0.28];
