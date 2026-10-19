// G12a fitted body: the Meshy white dragon, fitted in Blender to the game's skeleton, binds to the
// rig by bone name, stays inside the bare LOD0 budget, carries a clean fit (every vertex weighted, at
// most four influences) and stands where the skeleton stands.

import { describe, expect, it } from 'vitest';
import { parseDragonBody, type DragonBodyAsset } from './asset';
import { dragonRig } from './rig';
import { dragonSegments } from './skeleton';

const FILE = new URL('../../assets/dragon/white-dragon.glb', import.meta.url);

// Node built-ins without @types/node in the project: imported by a computed name.
async function load(): Promise<DragonBodyAsset> {
  const name = 'node:fs';
  const fs = (await import(/* @vite-ignore */ name)) as { readFileSync(p: URL): { buffer: ArrayBuffer; byteOffset: number; byteLength: number } };
  const b = fs.readFileSync(FILE);
  return parseDragonBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

const rig = dragonRig();
const S = rig.props.shape;
/** Exploratory budget for a bare dragon at LOD0 (Art and Assets/Guides/model-budgets). */
const BARE_TRIANGLES = [16000, 20000];

describe('G12a white dragon fitted body', () => {
  it('binds every joint by name to the rig, in the rig’s order', async () => {
    const a = await load();
    expect(a.jointNames).toEqual(rig.bones.map((b) => b.name));
  });

  it('stays inside the bare LOD0 budget, with the membranes as their own group', async () => {
    const a = await load();
    const tris = (a.index[0].length + a.index[1].length) / 3;
    expect(tris).toBeGreaterThanOrEqual(BARE_TRIANGLES[0]);
    expect(tris).toBeLessThanOrEqual(BARE_TRIANGLES[1]);
    expect(a.index[1].length).toBeGreaterThan(0);
    const n = a.position.length / 3;
    for (const list of a.index) for (let i = 0; i < list.length; i++) expect(list[i]).toBeLessThan(n);
  });

  it('weights every vertex, at most four bones, all of them bones the fit maps', async () => {
    const a = await load();
    const fitted = new Set(Object.keys(dragonSegments(rig)));
    const n = a.position.length / 3;
    let bad = 0;
    for (let v = 0; v < n; v++) {
      let s = 0;
      for (let k = 0; k < 4; k++) {
        const w = a.weights[v * 4 + k];
        s += w;
        if (w > 0 && !fitted.has(a.jointNames[a.joints[v * 4 + k]])) bad++;
      }
      if (Math.abs(s - 1) > 1e-3) bad++;
    }
    expect(bad).toBe(0);
    for (let i = 0; i < a.position.length; i++) expect(Number.isFinite(a.position[i])).toBe(true);
  });

  it('stands where the skeleton stands: soles, snout, tail tip and wingtips', async () => {
    const a = await load();
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < a.position.length; i++) {
      lo[i % 3] = Math.min(lo[i % 3], a.position[i]);
      hi[i % 3] = Math.max(hi[i % 3], a.position[i]);
    }
    // Claw tips may dip a few centimetres below the soles.
    expect(Math.abs(lo[1] + S.standHeight)).toBeLessThan(0.1);
    expect(Math.abs(hi[2] - rig.snout.z)).toBeLessThan(0.1);
    expect(Math.abs(lo[2] - rig.tailTip.z)).toBeLessThan(0.15);
    // Wingtips at the span (the fingers' ends), the claws about 0.2 m beyond; left and right alike.
    expect(hi[0] - S.wingspan / 2).toBeGreaterThan(-0.05);
    expect(hi[0] - S.wingspan / 2).toBeLessThan(0.3);
    expect(Math.abs(hi[0] + lo[0])).toBeLessThan(0.1);
  });

  it('bakes the hide regions: back plates, claws, eyes, and membranes apart', async () => {
    const a = await load();
    const n = a.position.length / 3;
    const regions = new Set<number>();
    let dorsal = 0;
    for (let v = 0; v < n; v++) {
      regions.add(Math.round(a.mat[v * 4]));
      if (a.mat[v * 4 + 2] > 0.5) dorsal++;
    }
    for (const r of [0, 2, 9]) expect(regions.has(r), `region ${r}`).toBe(true);
    expect(dorsal / n).toBeGreaterThan(0.1);
    expect(dorsal / n).toBeLessThan(0.6);
  });

  it('keeps the hide shader’s channels apart: one region per triangle, claws on feet and wings only', async () => {
    const a = await load();
    const region = (v: number) => Math.round(a.mat[v * 4]);
    const [body, membrane] = a.index;
    for (let i = 0; i < body.length; i += 3) {
      expect(region(body[i + 1])).toBe(region(body[i]));
      expect(region(body[i + 2])).toBe(region(body[i]));
    }
    // The two primitives don't share vertices: each carries its own reading of the channels.
    const inBody = new Set(body);
    for (let i = 0; i < membrane.length; i++) expect(inBody.has(membrane[i])).toBe(false);
    const n = a.position.length / 3;
    for (let v = 0; v < n; v++) {
      if (region(v) !== 9 || !inBody.has(v)) continue;
      const nearGround = a.position[v * 3 + 1] < -S.standHeight + 1.0;
      const onWing = Math.abs(a.position[v * 3]) > 2.5;
      expect(nearGround || onWing).toBe(true);
    }
  });

  it('runs the body tube’s coordinates smoothly and leaves the limbs and head off the tube', async () => {
    const a = await load();
    const n = a.position.length / 3;
    const along = new Set<number>();
    let offTube = 0;
    for (const v of new Set(a.index[0])) {
      if (a.mat[v * 4 + 3] > 0.5) along.add(Math.round(a.uv2[v * 2] * 1000));
      else offTube++;
    }
    // Arc length along the tube is continuous (not stepped at the plan's stations).
    expect(along.size).toBeGreaterThan(1000);
    expect(offTube).toBeGreaterThan(0.2 * n);
  });

  it('spreads the membrane’s across-panel coordinate over the wyvern’s 0..3', async () => {
    const a = await load();
    const vs = [...new Set(a.index[1])];
    let atThree = 0;
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of vs) {
      expect(Math.round(a.mat[v * 4])).toBe(0);
      const y = a.uv2[v * 2 + 1];
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
      if (Math.abs(y - 3) < 1e-6) atThree++;
    }
    expect(lo).toBeLessThan(0.2);
    expect(hi).toBeGreaterThan(2.8);
    expect(atThree / vs.length).toBeLessThan(0.15);
  });

  it('records where it came from', async () => {
    const a = await load();
    const p = a.provenance as { sources: { raw: { sha256: string } }; meshy: { plan: string; task_id: string } };
    expect(p.sources.raw.sha256).toBe('45afc967ae23c44392687f5b8e41c15e4cb13838a7e66167d76a972aaa21f562');
    expect(p.meshy.plan).toMatch(/^Pro/);
    expect(p.meshy.task_id).toBe('not recorded');
  });
});
