// G12b built features (Robert, 2026-10-19: the wings' and the claws' static mesh, the eyes'
// definition): the membrane is one sheet per wing that stays on its bones and its flank when posed,
// the finger bones run along the fingers, every claw sits on a foot or a wing, the fitted body's stray
// claw patches are hide, and each eyeball stands proud of the skin in the head.

import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { ELDER_DRAGONS } from './catalog';
import { piecesFor } from './Dragon';
import { diskAssets } from './dragon.testkit';
import { CLAW, EYE, FINGER, MEMBRANE_RES, buildEyes, buildFingers, buildMembranes, clawSites, eyeFrame, wingClawSites } from './features';
import { buildDragonLod, eyePatch } from './mesh';
import { dragonSkin, modelPose, restingPose } from './pose';
import { dragonRig } from './rig';

const rig = dragonRig();
const { idx } = rig;
const look = ELDER_DRAGONS.white!;
const wingBones = new Set(idx.wings.flatMap((w) => [w.humerus, w.forearm, w.hand, ...w.fingers.flat()]));

/** Distance from p to the polyline through `pts`. */
function toLine(p: Vector3, pts: Vector3[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const ab = pts[i + 1].clone().sub(pts[i]);
    const t = Math.min(1, Math.max(0, p.clone().sub(pts[i]).dot(ab) / ab.lengthSq()));
    best = Math.min(best, p.distanceTo(pts[i].clone().addScaledVector(ab, t)));
  }
  return best;
}

describe('G12b built wings', () => {
  it('builds each wing as one sheet in three panels at every LOD, skinned to the wing bones and the spine only', () => {
    for (let lod = 0; lod < 3; lod++) {
      const m = buildMembranes(rig, lod);
      const { fingers, inner } = MEMBRANE_RES[lod];
      expect(m.index[0].length).toBe(0);
      expect(m.index[1].length / 3).toBe(2 * (2 * fingers[0] * fingers[1] * 2 + inner[0] * inner[1] * 2));
      for (let v = 0; v < m.position.length / 3; v++) {
        let s = 0;
        for (let k = 0; k < 4; k++) {
          const w = m.weights[v * 4 + k];
          if (w > 0) expect(wingBones.has(m.joints[v * 4 + k]) || m.joints[v * 4 + k] === idx.spine).toBe(true);
          s += w;
        }
        expect(Math.abs(s - 1)).toBeLessThan(1e-5);
      }
    }
  });

  it('turns its upper face up in the bind pose, as the hide shader reads it', () => {
    const m = buildMembranes(rig, 0);
    let up = 0;
    const n = m.normal.length / 3;
    for (let v = 0; v < n; v++) if (m.normal[v * 3 + 1] > 0) up++;
    expect(up / n).toBeGreaterThan(0.95);
  });

  it('stays on its fingers and its flank folded and raised in the resting pose, and off the platform', () => {
    const m = buildMembranes(rig, 0);
    const M = modelPose(rig, restingPose(rig));
    const posed = dragonSkin(rig, M, m.position, m.joints, m.weights);
    // Where each finger and the trailing root are, posed.
    const at = (bone: number, p: Vector3) => p.clone().sub(rig.bones[bone].pos).applyQuaternion(M.q[bone]).add(M.p[bone]);
    for (let side = 0; side < 2; side++) {
      const w = idx.wings[side];
      const tips = rig.fingerTips.map((t) => (side === 0 ? t.clone() : new Vector3(-t.x, t.y, t.z)));
      const lines = [0, 1, 2].map((k) => [M.p[w.fingers[k][0]], M.p[w.fingers[k][1]], at(w.fingers[k][1], tips[k])]);
      const trail = side === 0 ? rig.trailRoot.clone() : new Vector3(-rig.trailRoot.x, rig.trailRoot.y, rig.trailRoot.z);
      const trailPosed = at(idx.spine, trail);
      let onFinger = 0;
      let nearTrail = Infinity;
      const p = new Vector3();
      for (let v = 0; v < posed.length / 3; v++) {
        p.fromArray(posed, v * 3);
        expect(p.y).toBeGreaterThan(-0.02);
        if (Math.sign(m.position[v * 3]) !== (side === 0 ? 1 : -1)) continue;
        const vAcross = m.uv2[v * 2 + 1];
        // Every vertex on a finger line (v = 0, 1, 2) is still on that finger, folded.
        for (const k of [0, 1, 2]) {
          if (Math.abs(vAcross - k) < 1e-6) {
            expect(toLine(p, lines[k])).toBeLessThan(0.03);
            onFinger++;
          }
        }
        nearTrail = Math.min(nearTrail, p.distanceTo(trailPosed));
      }
      expect(onFinger).toBeGreaterThan(30);
      // The panel's corner at the trailing root stays on the flank.
      expect(nearTrail).toBeLessThan(0.02);
    }
  });

  it('runs the finger bones along the fingers, tapering, riding only their own two bones', () => {
    const f = buildFingers(rig, 0);
    const p = new Vector3();
    for (let v = 0; v < f.position.length / 3; v++) {
      p.fromArray(f.position, v * 3);
      const side = p.x > 0 ? 0 : 1;
      const w = idx.wings[side];
      const bones = new Set(w.fingers.flat());
      let d = Infinity;
      for (let k = 0; k < 3; k++) {
        const tip = rig.fingerTips[k].clone();
        if (side === 1) tip.x = -tip.x;
        d = Math.min(d, toLine(p, [rig.bones[w.fingers[k][0]].pos, rig.bones[w.fingers[k][1]].pos, tip]));
      }
      expect(d).toBeLessThan(FINGER.root * FINGER.leading * (1 + FINGER.joint) + 1e-6);
      for (let k = 0; k < 4; k++) if (f.weights[v * 4 + k] > 0) expect(bones.has(f.joints[v * 4 + k])).toBe(true);
    }
  });

  it('gives each wing a claw at every finger tip and the thumb claw at the wrist, riding the hand', () => {
    const sites = wingClawSites(rig);
    expect(sites.length).toBe(8);
    for (const w of idx.wings) expect(sites.filter((s) => s.joints[0] === w.hand).length).toBe(1);
  });
});

describe('G12b built claws and eyes', () => {
  it('finds two to four claw sites on every foot (render 08 has four toes), each on a toe bone at the foot', async () => {
    const a = await diskAssets();
    const sites = clawSites(a.bodies[0], rig);
    const body = a.bodies[0];
    const feet = [...idx.forelegs.map((f) => [f.hand, f.toes]), ...idx.hindlegs.map((h) => [h.meta, h.toes])];
    for (const bones of feet) {
      const on = sites.filter((s) => bones.includes(s.joints[0]) || s.joints.some((j) => bones.includes(j)));
      expect(on.length).toBeGreaterThanOrEqual(2);
      expect(on.length).toBeLessThanOrEqual(CLAW.perFoot);
    }
    // Each base is at the body's surface.
    const P = new Vector3();
    for (const s of sites) {
      let d = Infinity;
      for (let v = 0; v < body.position.length / 3; v++) d = Math.min(d, P.fromArray(body.position, v * 3).distanceTo(s.base));
      expect(d).toBeLessThan(0.12);
    }
  });

  it('leaves no fitted claw on the body: each is a built claw or, for a stray patch, hide', async () => {
    const a = await diskAssets();
    // As the dragon builds them: LOD0's claw sites and eye on every LOD.
    const sites = clawSites(a.bodies[0], rig);
    const eye = eyeFrame(eyePatch(a.bodies[0], rig), rig);
    for (let lod = 0; lod < 3; lod++) {
      const built = buildDragonLod(rig, a.bodies[lod], piecesFor(look, a.parts.pieces, lod), lod, { claws: sites, eye });
      // At least one a foot (the coarsest LOD runs each foot's claws together).
      expect(built.claws.replaced).toBeGreaterThanOrEqual(4);
      const nB = a.bodies[lod].position.length / 3;
      const mat = built.geometry.getAttribute('aMat').array as Float32Array;
      const index = built.geometry.getIndex()!.array as Uint32Array;
      let fitted = 0;
      for (const v of index) if (v < nB && Math.round(mat[v * 4]) === 9) fitted++;
      expect(fitted).toBe(0);
      expect(built.pieces).toEqual(expect.arrayContaining(['membrane', 'fingers', 'claws']));
    }
  });

  it('sets each eyeball proud of the skin round the eye patch, inside the head, at LOD0 and LOD1 only', async () => {
    const a = await diskAssets();
    const patch = eyePatch(a.bodies[0], rig);
    const frame = eyeFrame(patch, rig);
    const pole = frame.center.clone().addScaledVector(frame.axis, EYE.radius * EYE.depth);
    // The skin round the patch, measured from the patch along its axis.
    const skinLevel = patch.center.clone().addScaledVector(patch.axis, patch.skin);
    // Proud of the skin, but only a little (Robert: "bulging a little less").
    const proud = pole.clone().sub(skinLevel).dot(frame.axis);
    expect(proud).toBeGreaterThan(0.015);
    expect(proud).toBeLessThan(0.035);
    expect(frame.center.distanceTo(rig.bones[idx.head].pos)).toBeLessThan(rig.props.shape.headLength);
    expect(buildEyes(frame, rig, 0)).not.toBeNull();
    expect(buildEyes(frame, rig, 1)).not.toBeNull();
    expect(buildEyes(frame, rig, 2)).toBeNull();
    const eyes = buildEyes(frame, rig, 0)!;
    for (let v = 0; v < eyes.position.length / 3; v++) {
      expect(eyes.mat[v * 4]).toBe(2);
      expect(eyes.joints[v * 4]).toBe(idx.head);
    }
  });
});
