// G3b trial body (Q38): the fitted Meshy Harrier binds to the procedural rig by bone name, stays in
// the LOD0 budget, keeps the two material groups and moves the seat and eyes by sane amounts.

import { describe, expect, it } from 'vitest';
import { DEFAULT_WYVERN } from '../../cosmetics/catalog';
import { buildWyvernGeometry } from './geometry';
import { rigFor } from './rig';
import { parseWyvernTrial, trialInfo } from './trial';

const FILE = new URL('../../assets/wyvern-trial/harrier-meshy.glb', import.meta.url);

// Node built-ins without @types/node in the project: imported by a computed name.
async function readFile(): Promise<ArrayBuffer> {
  const name = 'node:fs';
  const fs = (await import(/* @vite-ignore */ name)) as { readFileSync(p: URL): { buffer: ArrayBuffer; byteOffset: number; byteLength: number } };
  const b = fs.readFileSync(FILE);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

describe('G3b Meshy Harrier trial body', () => {
  it('parses, binds every joint by name and stays within the LOD0 triangle ceiling', async () => {
    const asset = parseWyvernTrial(await readFile());
    const rig = rigFor('harrier');
    const names = new Set(rig.bones.map((b) => b.name));
    for (const n of asset.jointNames) expect(names.has(n), n).toBe(true);
    const info = trialInfo(rig, buildWyvernGeometry(rig, { ...DEFAULT_WYVERN, breed: 'harrier' }), asset);
    expect(info.triangles).toBeLessThanOrEqual(24000);
    expect(info.geometry.groups).toHaveLength(2);
    expect(info.geometry.groups[1].count).toBeGreaterThan(0);
    const w = info.geometry.getAttribute('skinWeight');
    const idx = info.geometry.getAttribute('skinIndex');
    for (let v = 0; v < w.count; v++) {
      const s = w.getX(v) + w.getY(v) + w.getZ(v) + w.getW(v);
      expect(Math.abs(s - 1)).toBeLessThan(1e-3);
      expect(idx.getX(v)).toBeLessThan(rig.bones.length);
    }
    const pos = info.geometry.getAttribute('position').array;
    for (let i = 0; i < pos.length; i++) expect(Number.isFinite(pos[i])).toBe(true);
  });

  it('moves the seat by a bounded amount and keeps the game head, eyes and all', async () => {
    const asset = parseWyvernTrial(await readFile());
    const rig = rigFor('harrier');
    const base = buildWyvernGeometry(rig, { ...DEFAULT_WYVERN, breed: 'harrier' });
    const seat0 = base.saddle.seat.clone();
    const eye0 = base.eyeCenter.clone();
    const info = trialInfo(rig, base, asset);
    expect(info.saddle.seat.distanceTo(seat0)).toBeLessThan(0.5);
    const r0 = base.eyeRadius;
    expect(info.eyeCenter.distanceTo(eye0)).toBe(0);
    expect(info.eyeRadius).toBe(r0);
    // The procedural skull, eyes and teeth are in the trial geometry (the file has no head).
    const mat = info.geometry.getAttribute('aMat');
    const regions = new Set<number>();
    for (let v = 0; v < mat.count; v++) regions.add(Math.round(mat.getX(v)));
    for (const r of [2, 13]) expect(regions.has(r), `region ${r}`).toBe(true);
  });
});
