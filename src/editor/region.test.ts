import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { LAYOUT } from '../world/layout';
import { Terrain } from '../world/terrain';
import { SAVE_KEY } from '../progression/save';
import { flyCourse, thermalAir } from '../race/flyCourse';
import { BREEDS } from '../flight/breeds';
import { buildAssets, assetPosition } from './assets';
import {
  cloneRegion, LIMITS, parseRegion, REGION_KEY, RegionHistory, regionLayout, regionRace, REGION_ORIGIN, starterRegion,
} from './region';
import { loadRegion, sandboxSave, saveRegion } from './storage';
import { validateRegion } from './validation';

describe('authored region transactions and untrusted files', () => {
  it('roundtrips the schema and strips injected world anchors and runtime fields', () => {
    const r = starterRegion();
    const raw = { ...r, script: 'alert(1)', islands: r.islands.map(d => ({ ...d, landmark: 'roost', trees: 1, waterfalls: 99 })) };
    expect(parseRegion(JSON.stringify(raw))).toEqual(r);
    expect(parseRegion(raw).islands.every(d => !d.landmark && d.trees === 0)).toBe(true);
  });
  it.each([
    ['unknown version', (r: any) => { r.version = 2; }],
    ['NaN', (r: any) => { r.islands[0].x = NaN; }],
    ['numeric strings', (r: any) => { r.islands[0].radius = '100'; }],
    ['duplicate IDs', (r: any) => { r.islands[1].id = r.islands[0].id; }],
    ['unknown asset', (r: any) => { r.assets[0].kind = 'script'; }],
    ['missing asset owner', (r: any) => { r.assets[0].islandId = 999999; }],
    ['too many checkpoints', (r: any) => { r.checkpoints = Array.from({ length: LIMITS.checkpoints + 1 }, (_, i) => ({ ...r.checkpoints[0], id: String(i) })); }],
    ['out of bounds', (r: any) => { r.islands[0].x = 1001; }],
  ])('rejects %s', (_name, change) => {
    const r = starterRegion(); change(r); expect(() => parseRegion(r)).toThrow();
  });
  it('rejects oversized JSON before parsing', () => {
    expect(() => parseRegion(' '.repeat(LIMITS.bytes + 1))).toThrow('200 KB');
  });
  it('keeps edit/delete/import undoable, clears redo on a new edit, and rejects invalid edits atomically', () => {
    const history = new RegionHistory(starterRegion()); const initial = cloneRegion(history.current);
    history.edit(r => { r.islands[0].radius = 140; });
    const edited = cloneRegion(history.current);
    history.edit(r => { r.assets = r.assets.filter(a => a.islandId !== r.islands[0].id); r.islands.shift(); });
    history.undo(); expect(history.current).toEqual(edited);
    history.undo(); expect(history.current).toEqual(initial);
    history.redo(); expect(history.current).toEqual(edited);
    history.edit(r => { r.name = 'New branch of edits'; });
    expect(history.canRedo).toBe(false);
    const before = cloneRegion(history.current);
    expect(() => history.edit(r => { r.islands[0].radius = -1; })).toThrow();
    expect(history.current).toEqual(before);
    history.commit(initial); history.undo(); expect(history.current).toEqual(before);
  });
});
describe('shared region geometry, clearance and sandbox isolation', () => {
  it('flies the starter authored course through the existing flight/race geometry', () => {
    const r = starterRegion(); const terrain = new Terrain(regionLayout(r));
    const props = buildAssets(r, terrain); terrain.colliders.addAll(props.colliders);
    try {
      const result = flyCourse(regionRace(r)!, { breed: BREEDS.harrier, env: thermalAir([], terrain) });
      expect(result.finished).toBe(true); expect(result.hits).toBe(0);
    } finally { props.dispose(); }
  });
  it('leaves every canonical island, anchor, race source and layout object intact', () => {
    const before = JSON.stringify(LAYOUT); const r = starterRegion();
    const layout = regionLayout(r, true);
    expect(layout.islands.slice(0, LAYOUT.islands.length)).toEqual(LAYOUT.islands);
    expect(layout.spawn).toEqual(LAYOUT.spawn); expect(layout.stable).toEqual(LAYOUT.stable);
    expect(layout.islands.some(d => d.landmark === 'gullrest')).toBe(true);
    expect(layout.islands.at(-2)?.x).toBe(r.islands[0].x + REGION_ORIGIN.x);
    layout.islands[0].x = 1234;
    expect(JSON.stringify(LAYOUT)).toBe(before);
  });
  it('uses the same analytic surface for preview, sandbox and attached prop heights after reshaping', () => {
    const r = starterRegion(); r.islands[0].x += 31; r.islands[0].hills = 12;
    const a = new Terrain(regionLayout(r)); const b = new Terrain(regionLayout(r, true));
    const p = assetPosition(r.assets[0], a)!; const q = assetPosition(r.assets[0], b)!;
    expect(q.x - p.x).toBe(REGION_ORIGIN.x); expect(q.y).toBeCloseTo(p.y, 8);
    expect(a.groundAt(p.x, p.z, 1000)?.y).toBe(p.y);
    expect(b.groundAt(q.x, q.z, 1000)?.y).toBe(q.y);
    expect(regionRace(r, true)?.rings[0].normal).toEqual(regionRace(r)?.rings[0].normal);
  });
  it('makes a column solid at its rendered shaft and keeps its surrounding ground walkable', () => {
    const r = starterRegion(); const terrain = new Terrain(regionLayout(r));
    const assets = buildAssets(r, terrain); terrain.colliders.addAll(assets.colliders);
    const p = assetPosition(r.assets[0], terrain)!;
    expect(terrain.distance(new Vector3(p.x, p.y + 3, p.z))).toBeLessThan(0);
    expect(terrain.distance(new Vector3(p.x + 4, p.y + 3, p.z))).toBeGreaterThan(1);
    assets.dispose();
  });
  it('accepts the starter, blocks submerged rings and unsupported props, and warns about facing/overlap', () => {
    const r = starterRegion(); expect(validateRegion(r).filter(i => i.severity === 'error')).toEqual([]);
    const blocked = cloneRegion(r); blocked.checkpoints[0].position = [-180, 481, 0];
    expect(validateRegion(blocked).some(i => i.severity === 'error' && /Checkpoint 1/.test(i.message))).toBe(true);
    const edge = cloneRegion(r); edge.assets[0].x = 240;
    expect(validateRegion(edge).some(i => i.severity === 'error' && /outside/.test(i.message))).toBe(true);
    const reverse = cloneRegion(r); reverse.checkpoints[0].yaw = 0;
    expect(validateRegion(reverse).some(i => i.severity === 'warning' && /faces away/.test(i.message))).toBe(true);
    const overlap = cloneRegion(r); overlap.islands[1].x = overlap.islands[0].x; overlap.islands[1].z = overlap.islands[0].z;
    expect(validateRegion(overlap).some(i => /overlapping footprints/.test(i.message))).toBe(true);
  });
  it('stores authored JSON under a separate key and keeps sandbox progress and ghosts in memory', async () => {
    const data = new Map<string, string>([[SAVE_KEY, 'player-save-sentinel']]);
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
    const region = starterRegion(); saveRegion(region, storage);
    expect(loadRegion(storage)).toEqual(region); expect(data.has(REGION_KEY)).toBe(true);
    const save = sandboxSave(); save.data.collected.push('fake'); save.flush(); save.reset();
    expect(data.get(SAVE_KEY)).toBe('player-save-sentinel');
    expect(save.data.collected).toEqual([]);
    expect(await save.getGhost('author-course')).toBeNull();
  });
});
