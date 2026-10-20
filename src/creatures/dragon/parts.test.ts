// G12a parts: the white elder's horns, whiskers, cheek fins, spines and tail fin are geometry for
// its catalog options, ride bones the skeleton already has (no part adds one), sit on the fitted
// body, and stay inside the accessory allowance at every LOD, with the body inside each LOD's ceiling.

import { describe, expect, it } from 'vitest';
import { DRAGON_LOD_BUDGETS, parseDragonBody, type DragonBodyAsset } from './asset';
import { DRAGON_PARTS, ELDER_DRAGONS } from './catalog';
import { parseDragonParts, pieceTriangles, type DragonPartPiece, type DragonPartsAsset } from './parts';
import { dragonRig } from './rig';

const DIR = new URL('../../assets/dragon/', import.meta.url);
const BODY_FILES = ['white-dragon.glb', 'white-dragon-lod1.glb', 'white-dragon-lod2.glb'];

// Node built-ins without @types/node in the project: imported by a computed name.
type Bytes = { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
async function bytes(name: string): Promise<Bytes> {
  const mod = 'node:fs';
  const fs = (await import(/* @vite-ignore */ mod)) as { readFileSync(p: URL): Bytes };
  return fs.readFileSync(new URL(name, DIR));
}
const slice = (b: Bytes) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
async function sha256(name: string): Promise<string> {
  const mod = 'node:crypto';
  const c = (await import(/* @vite-ignore */ mod)) as { createHash(a: string): { update(b: Uint8Array): { digest(e: string): string } } };
  const b = await bytes(name);
  return c.createHash('sha256').update(new Uint8Array(b.buffer, b.byteOffset, b.byteLength)).digest('hex');
}
let parts: DragonPartsAsset | undefined;
async function load(): Promise<DragonPartsAsset> {
  return (parts ??= parseDragonParts(slice(await bytes('white-dragon-parts.glb'))));
}
const bodies: DragonBodyAsset[] = [];
async function body(lod: number): Promise<DragonBodyAsset> {
  return (bodies[lod] ??= parseDragonBody(slice(await bytes(BODY_FILES[lod]))));
}
const atLod = (a: DragonPartsAsset, lod: number) => a.pieces.filter((p) => p.lod === lod);

const rig = dragonRig();
const BONES = rig.bones.map((b) => b.name);
/** Which bones each piece may ride. */
const RIDES: Record<string, (bone: string) => boolean> = {
  horns: (b) => b === 'head',
  whiskers: (b) => b === 'head',
  cheekFins: (b) => b === 'fanL' || b === 'fanR',
  spines: (b) => b === 'head' || b === 'chest' || /^neck\d$/.test(b),
  tailFin: (b) => /^tail\d$/.test(b),
};

/** Connected pieces of geometry (shared vertices), as vertex lists. */
function components(p: DragonPartPiece): number[][] {
  const n = p.position.length / 3;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const list of p.index) for (let i = 0; i < list.length; i += 3) for (let k = 1; k < 3; k++) parent[find(list[i + k])] = find(list[i]);
  const groups = new Map<number, number[]>();
  for (let v = 0; v < n; v++) {
    const r = find(v);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(v);
  }
  return [...groups.values()];
}

/** Least distance between a set of vertices and a point cloud. */
function nearest(p: Float32Array, vs: number[], cloud: Float32Array): number {
  let best = Infinity;
  for (const v of vs) {
    const x = p[v * 3];
    const y = p[v * 3 + 1];
    const z = p[v * 3 + 2];
    for (let j = 0; j < cloud.length; j += 3) {
      const d = (cloud[j] - x) ** 2 + (cloud[j + 1] - y) ** 2 + (cloud[j + 2] - z) ** 2;
      if (d < best) best = d;
    }
  }
  return Math.sqrt(best);
}

describe('G12a white dragon parts', () => {
  it('gives every white elder catalog option its pieces: all of them at LOD0 and LOD1, the horns at LOD2', async () => {
    const a = await load();
    const white = ELDER_DRAGONS.white!;
    for (const lod of [0, 1, 2]) {
      const have = atLod(a, lod).map((p) => `${p.slot}/${p.option}/${p.piece}`).sort();
      const want = DRAGON_PARTS.filter((o) => white.parts[o.slot] === o.id)
        .flatMap((o) => o.pieces.map((piece) => `${o.slot}/${o.id}/${piece}`))
        .filter((k) => lod < 2 || k.endsWith('/horns'))
        .sort();
      expect(have, `LOD${lod}`).toEqual(want);
    }
    // The five the kit asks for, under the four slots that carry geometry.
    expect(atLod(a, 0).map((p) => p.piece).sort()).toEqual(['cheekFins', 'horns', 'spines', 'tailFin', 'whiskers']);
  });

  it('rides only bones the skeleton has, each piece the ones it is built for', async () => {
    const a = await load();
    for (const p of a.pieces) {
      expect(p.jointNames).toEqual(BONES);
      const used = new Set<string>();
      const n = p.position.length / 3;
      for (let v = 0; v < n; v++) {
        let s = 0;
        for (let k = 0; k < 4; k++) {
          const w = p.weights[v * 4 + k];
          s += w;
          if (w > 0) used.add(p.jointNames[p.joints[v * 4 + k]]);
        }
        expect(Math.abs(s - 1)).toBeLessThan(1e-4);
      }
      for (const b of used) expect(RIDES[p.piece](b), `${p.piece} LOD${p.lod} on ${b}`).toBe(true);
    }
    // Rigid where they should be: horns and whiskers on the head, each cheek fin on its own bone.
    const fins = atLod(a, 0).find((p) => p.piece === 'cheekFins')!;
    for (let v = 0; v < fins.position.length / 3; v++) {
      expect(fins.weights[v * 4]).toBe(1);
      expect(fins.jointNames[fins.joints[v * 4]]).toBe(fins.position[v * 3] > 0 ? 'fanL' : 'fanR');
    }
    // No part adds a bone: the skeleton is still the 64-bone budget.
    expect(BONES.length).toBe(64);
  });

  it('stays inside the accessory allowance at every LOD, and the body with its parts inside each ceiling', async () => {
    const a = await load();
    for (let lod = 0; lod < 3; lod++) {
      const B = DRAGON_LOD_BUDGETS[lod];
      const tris = atLod(a, lod).reduce((s, p) => s + pieceTriangles(p), 0);
      expect(tris, `parts LOD${lod}`).toBeGreaterThanOrEqual(B.parts[0]);
      expect(tris, `parts LOD${lod}`).toBeLessThanOrEqual(B.parts[1]);
      const b = await body(lod);
      const bare = (b.index[0].length + b.index[1].length) / 3;
      expect(bare + tris, `equipped LOD${lod}`).toBeLessThanOrEqual(B.equipped);
    }
    for (const p of a.pieces) {
      const n = p.position.length / 3;
      for (const list of p.index) for (let i = 0; i < list.length; i++) expect(list[i]).toBeLessThan(n);
    }
  });

  it('sits on the fitted body: every bit of geometry touches the hide or the rest of its part', async () => {
    const a = await load();
    const hide = (await body(0)).position;
    for (const p of atLod(a, 0)) {
      const comps = components(p);
      const onHide = comps.map((c) => nearest(p.position, c, hide) < 0.08);
      // A tine, a fin's web or a ray may join its part instead of the hide.
      for (let pass = 0; pass < comps.length; pass++) {
        for (let i = 0; i < comps.length; i++) {
          if (onHide[i]) continue;
          for (let j = 0; j < comps.length && !onHide[i]; j++) {
            if (!onHide[j]) continue;
            const pts = new Float32Array(comps[j].length * 3);
            comps[j].forEach((v, k) => pts.set(p.position.subarray(v * 3, v * 3 + 3), k * 3));
            if (nearest(p.position, comps[i], pts) < 0.06) onHide[i] = true;
          }
        }
      }
      expect(onHide.every(Boolean), `${p.piece}: ${onHide.filter((x) => !x).length} of ${comps.length} loose`).toBe(true);
    }
  });

  it('is symmetric: paired pieces left and right alike, the midline pieces centred', async () => {
    const a = await load();
    for (const p of a.pieces) {
      let lo = Infinity;
      let hi = -Infinity;
      let left = 0;
      let right = 0;
      for (let v = 0; v < p.position.length / 3; v++) {
        const x = p.position[v * 3];
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
        if (x > 1e-4) left++;
        else if (x < -1e-4) right++;
      }
      expect(Math.abs(hi + lo), `${p.piece} LOD${p.lod}`).toBeLessThan(0.03);
      if (p.piece !== 'spines' && p.piece !== 'tailFin') expect(left).toBe(right);
    }
  });

  it('hangs the whiskers as strands: on the head only, from the lip, 3.6 m long, coordinates root to tip', async () => {
    const a = await load();
    for (const p of a.pieces.filter((q) => q.piece === 'whiskers')) {
      expect(p.strands.map((s) => s.name)).toEqual(['whiskerL', 'whiskerR']);
      expect(p.strand).not.toBeNull();
      for (const [i, s] of p.strands.entries()) {
        expect(s.bone).toBe('head');
        let len = 0;
        for (let k = 1; k < s.nodes.length; k++) len += Math.hypot(...s.nodes[k].map((c, j) => c - s.nodes[k - 1][j]));
        expect(Math.abs(len - s.length) / s.length).toBeLessThan(0.03);
        expect(s.length).toBeCloseTo(3.6, 5);
        // Rooted on the muzzle, behind the snout and above the mouth line, on its own side.
        const [x, y, z] = s.nodes[0];
        expect(Math.sign(x)).toBe(i === 0 ? 1 : -1);
        expect(z).toBeLessThan(rig.snout.z);
        expect(z).toBeGreaterThan(rig.snout.z - 0.6);
        expect(Math.abs(y - rig.mouth.y)).toBeLessThan(0.2);
        // Hanging: the tip well below the root.
        expect(s.nodes[s.nodes.length - 1][1]).toBeLessThan(y - 1.5);
      }
      // Every vertex says which strand it is on and how far along, 0 at the root to 1 at the tip.
      const n = p.position.length / 3;
      let roots = 0;
      let tips = 0;
      for (let v = 0; v < n; v++) {
        const [k, t] = [p.strand![v * 2], p.strand![v * 2 + 1]];
        expect(k === 0 || k === 1).toBe(true);
        expect(Math.sign(p.position[v * 3])).toBe(k === 0 ? 1 : -1);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(1);
        if (t === 0) roots++;
        if (t === 1) tips++;
      }
      expect(roots).toBeGreaterThan(0);
      expect(tips).toBe(2);
    }
  });

  it('paints with the hide shader’s channels: horn and hide opaque, the cheek fins’ web a membrane apart', async () => {
    const a = await load();
    for (const p of a.pieces) {
      const region = (v: number) => Math.round(p.mat[v * 4]);
      const opaque = new Set(p.index[0]);
      for (const v of opaque) expect(region(v)).toBe(p.piece === 'whiskers' ? 0 : 1);
      for (let i = 0; i < p.index[1].length; i++) {
        expect(opaque.has(p.index[1][i])).toBe(false);
        expect(region(p.index[1][i])).toBe(2);
      }
      expect(p.index[1].length > 0).toBe(p.piece === 'cheekFins');
      for (let v = 0; v < p.position.length / 3; v++) {
        expect(p.uv2[v * 2]).toBeGreaterThanOrEqual(0);
        expect(p.uv2[v * 2]).toBeLessThanOrEqual(1);
        // Off the body tube: no girth angle for the scale rows.
        expect(p.mat[v * 4 + 3]).toBeLessThanOrEqual(0.5);
      }
    }
    // The whiskers take the belly's cloud white.
    const w = atLod(a, 0).find((p) => p.piece === 'whiskers')!;
    expect(w.mat[1]).toBe(1);
  });

  it('records where it came from: the parts sheet and the body it was built on', async () => {
    const a = await load();
    const p = a.provenance as { asset: string; sources: { parts_sheet: { sha256: string }; body: { sha256: string } } };
    expect(p.asset).toBe('white-dragon-parts');
    expect(p.sources.parts_sheet.sha256).toBe('0d116811065e22bace348e6a7b09b523349355abbc49f63759a6c88099c7c143');
    expect(p.sources.body.sha256).toBe(await sha256('white-dragon.glb'));
  });
});
