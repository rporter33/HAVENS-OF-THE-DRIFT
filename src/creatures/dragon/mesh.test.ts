// G12b binding: the fitted body and the white elder's parts at every LOD bind by joint name to the
// rig's own skeleton (64 bones, one skeleton for every LOD), keep a clean skin (four influences,
// weights summing to one), take the rib cage's breath weights only from the trunk, and stay inside
// each LOD's ceiling. The whiskers stand apart with their strand coordinates.

import { describe, expect, it } from 'vitest';
import { DRAGON_LOD_BUDGETS } from './asset';
import { ELDER_DRAGONS } from './catalog';
import { Dragon, piecesFor } from './Dragon';
import { diskAssets } from './dragon.testkit';
import { addBreathWeights, buildDragonLod, jointRemap, orientToNormals } from './mesh';
import { dragonRig } from './rig';

const rig = dragonRig();
const look = ELDER_DRAGONS.white!;
const TRUNK = new Set(['spine', 'chest', 'pelvis']);

describe('G12b white dragon binding', () => {
  it('maps every joint name in every file onto the rig, and refuses a name the rig lacks', async () => {
    const a = await diskAssets();
    for (const b of a.bodies) expect([...jointRemap(rig, b.jointNames, 'body')].map((i) => rig.bones[i].name)).toEqual(b.jointNames);
    for (const p of a.parts.pieces) expect([...jointRemap(rig, p.jointNames, p.piece)].map((i) => rig.bones[i].name)).toEqual(p.jointNames);
    expect(() => jointRemap(rig, ['root', 'tongue0'], 'test')).toThrow(/tongue0/);
  });

  it('binds each vertex to the bones its file names, by name (the breath bone apart)', async () => {
    const a = await diskAssets();
    for (let lod = 0; lod < 3; lod++) {
      const body = a.bodies[lod];
      const g = buildDragonLod(rig, body, piecesFor(look, a.parts.pieces, lod), lod).geometry;
      const si = g.getAttribute('skinIndex');
      const n = body.position.length / 3;
      let checked = 0;
      for (let v = 0; v < n; v++) {
        for (let k = 0; k < 4; k++) {
          if (!(body.weights[v * 4 + k] > 0)) continue;
          const name = rig.bones[si.getComponent(v, k)].name;
          expect(name === body.jointNames[body.joints[v * 4 + k]] || name === 'breath').toBe(true);
          checked++;
        }
      }
      // Every vertex is weighted.
      expect(checked).toBeGreaterThanOrEqual(n);
    }
  });

  it('keeps a clean skin at every LOD: at most four bones, weights summing to one, rig bones only', async () => {
    const a = await diskAssets();
    for (let lod = 0; lod < 3; lod++) {
      const g = buildDragonLod(rig, a.bodies[lod], piecesFor(look, a.parts.pieces, lod), lod).geometry;
      const si = g.getAttribute('skinIndex');
      const sw = g.getAttribute('skinWeight');
      for (let v = 0; v < g.getAttribute('position').count; v++) {
        let s = 0;
        for (let k = 0; k < 4; k++) {
          s += sw.getComponent(v, k);
          expect(si.getComponent(v, k)).toBeLessThan(rig.bones.length);
        }
        expect(Math.abs(s - 1)).toBeLessThan(1e-4);
      }
    }
  });

  it('gives the rib cage its breath weights from the trunk only, between the hips and the shoulders', async () => {
    const a = await diskAssets();
    const body = a.bodies[0];
    const joints = new Uint16Array(body.joints.length);
    const remap = jointRemap(rig, body.jointNames, 'body');
    for (let i = 0; i < joints.length; i++) joints[i] = body.weights[i] > 0 ? remap[body.joints[i]] : 0;
    const weights = Float32Array.from(body.weights);
    const before = Float32Array.from(weights);
    const n = body.position.length / 3;
    const moved = addBreathWeights(rig, body.position, joints, weights, n);
    expect(moved).toBeGreaterThan(800);
    const T = rig.props.shape.torsoLength;
    for (let v = 0; v < n; v++) {
      let breath = 0;
      for (let k = 0; k < 4; k++) {
        const j = joints[v * 4 + k];
        if (j === rig.idx.breath && weights[v * 4 + k] > 0) breath += weights[v * 4 + k];
        // Every other bone keeps its weight unless it is a trunk bone giving some up.
        else if (!TRUNK.has(rig.bones[j].name) && before[v * 4 + k] > 0) expect(weights[v * 4 + k]).toBeCloseTo(before[v * 4 + k], 6);
      }
      if (breath > 0) {
        const z = body.position[v * 3 + 2] / T;
        expect(z).toBeGreaterThan(-0.36);
        expect(z).toBeLessThan(0.28);
      }
    }
  });

  it('merges the rigid parts into the skinned mesh and keeps the whiskers apart with their strands', async () => {
    const a = await diskAssets();
    for (let lod = 0; lod < 3; lod++) {
      const pieces = piecesFor(look, a.parts.pieces, lod);
      const built = buildDragonLod(rig, a.bodies[lod], pieces, lod);
      const body = a.bodies[lod];
      const rigid = pieces.filter((p) => !p.strand);
      const tris = (body.index[0].length + body.index[1].length) / 3 + rigid.reduce((s, p) => s + (p.index[0].length + p.index[1].length) / 3, 0);
      expect(built.triangles).toBe(tris);
      const groups = built.geometry.groups;
      expect(groups.map((g) => g.materialIndex)).toEqual([0, 1]);
      expect(groups[1].count).toBe(body.index[1].length + rigid.reduce((s, p) => s + p.index[1].length, 0));
      if (lod < 2) {
        expect(built.whiskers).not.toBeNull();
        const w = built.whiskers!;
        expect(w.strands.map((s) => s.name)).toEqual(['whiskerL', 'whiskerR']);
        for (let v = 0; v < w.strand.length / 2; v++) {
          expect([0, 1]).toContain(Math.round(w.strand[v * 2]));
          expect(w.strand[v * 2 + 1]).toBeGreaterThanOrEqual(-1e-6);
          expect(w.strand[v * 2 + 1]).toBeLessThanOrEqual(1 + 1e-6);
        }
      } else expect(built.whiskers).toBeNull();
    }
  });

  it('turns the few membrane triangles wound against their normals, so no wing shows its underside from above', async () => {
    const a = await diskAssets();
    // As decimated: LOD0 47 of 3,297, LOD1 18 of 990, LOD2 9 of 314 (G12a's trailing edge).
    const expected = [47, 18, 9];
    for (let lod = 0; lod < 3; lod++) {
      const built = buildDragonLod(rig, a.bodies[lod], piecesFor(look, a.parts.pieces, lod), lod);
      expect(built.reoriented).toBe(expected[lod]);
      const g = built.geometry;
      const index = g.getIndex()!.array as Uint32Array;
      const [, mem] = g.groups;
      const copy = index.slice(mem.start, mem.start + mem.count);
      expect(orientToNormals(g.getAttribute('position').array as Float32Array, g.getAttribute('normal').array as Float32Array, copy)).toBe(0);
    }
  });

  it('gives every vertex a unit normal: the wing-root cut and the cheek fins come with a few at zero', async () => {
    const a = await diskAssets();
    // Three at the closed wing-root cut at every LOD; six on the cheek fins at LOD0 and LOD1.
    const expected = [9, 9, 3];
    for (let lod = 0; lod < 3; lod++) {
      const built = buildDragonLod(rig, a.bodies[lod], piecesFor(look, a.parts.pieces, lod), lod);
      expect(built.renormaled).toBe(expected[lod]);
      const nor = built.geometry.getAttribute('normal');
      for (let v = 0; v < nor.count; v++) expect(Math.abs(Math.hypot(nor.getX(v), nor.getY(v), nor.getZ(v)) - 1)).toBeLessThan(1e-3);
    }
  });

  it('builds one dragon on one 64-bone skeleton in rig order, every LOD inside its ceiling with the parts on', async () => {
    const a = await diskAssets();
    const d = new Dragon(a, { look });
    expect(d.bones.map((b) => b.name)).toEqual(rig.bones.map((b) => b.name));
    expect(d.skeleton.bones.length).toBe(64);
    expect(d.skeleton.bones.length).toBeLessThanOrEqual(64);
    const meshes = d.group.children.filter((o) => (o as { isSkinnedMesh?: boolean }).isSkinnedMesh) as unknown as { skeleton: unknown }[];
    expect(meshes.length).toBe(3);
    for (const m of meshes) expect(m.skeleton).toBe(d.skeleton);
    for (const lod of [0, 1, 2] as const) expect(d.triangles(lod)).toBeLessThanOrEqual(DRAGON_LOD_BUDGETS[lod].equipped);
    // The eye the shader draws sits inside the head, behind the body's eye patch.
    expect(d.uniforms.uEyeCenter.value.x).toBeGreaterThan(0);
    expect(d.uniforms.uEyeRadius.value).toBeGreaterThan(0.04);
    d.dispose();
  });
});
