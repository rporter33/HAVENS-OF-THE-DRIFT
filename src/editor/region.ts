import type { RaceDef } from '../game/contracts';
import { LAYOUT, type IslandDef, type WorldLayout } from '../world/layout';
import { coursePoints, medalTimes } from '../race/courseMath';

export const REGION_KEY = 'driftwing.authored-region.v1';
export const SESSION_KEY = 'driftwing.editor-session.v1';
export const PLAYTEST_KEY = 'driftwing.editor-playtest.v1';
export const REGION_ORIGIN = { x: 8000, z: 0 } as const;
export const LIMITS = { islands: 12, assets: 80, checkpoints: 20, bytes: 200_000 } as const;
export const ASSET_KINDS = ['column', 'terrace', 'crate'] as const;
export type AssetKind = typeof ASSET_KINDS[number];
export type Preset = 'meadow' | 'plateau' | 'rocky';
export interface PlacedAsset {
  id: string;
  kind: AssetKind;
  islandId: number;
  /** Metres relative to the owning island; height always resolves from the analytic surface. */
  x: number;
  z: number;
  yaw: number;
  scale: number;
}
export interface Checkpoint {
  id: string;
  position: [number, number, number];
  yaw: number;
  radius: number;
}
export interface Region {
  format: 'driftwing-region';
  version: 1;
  name: string;
  islands: IslandDef[];
  assets: PlacedAsset[];
  start: { position: [number, number, number]; yaw: number };
  checkpoints: Checkpoint[];
}
export type Selection = { kind: 'island'; id: number } | { kind: 'asset' | 'checkpoint'; id: string } | { kind: 'start'; id: 'start' };
export const cloneRegion = (r: Region): Region => structuredClone(r);

export function islandPreset(id: number, preset: Preset, x = 0, z = 0): IslandDef {
  return {
    id, kind: preset, name: preset === 'plateau' ? 'Terrace island' : preset === 'rocky' ? 'Rock island' : 'Meadow island',
    x, y: 480, z, radius: 110, outline: preset === 'rocky' ? 0.24 : 0.12,
    hills: preset === 'rocky' ? 18 : preset === 'plateau' ? 5 : 3,
    depth: 160, lip: 10, flatCenter: preset === 'plateau' ? 0.65 : 0.45,
    seed: id * 7919, trees: 0, grass: 0, waterfalls: 0,
  };
}
export function starterRegion(): Region {
  const a = islandPreset(10000, 'plateau', -180, 0);
  const b = islandPreset(10001, 'meadow', 180, -160);
  return {
    format: 'driftwing-region', version: 1, name: 'First wind terrace', islands: [a, b],
    assets: [
      { id: 'asset-1', kind: 'column', islandId: a.id, x: -14, z: 0, yaw: 0, scale: 1 },
      { id: 'asset-2', kind: 'terrace', islandId: a.id, x: 0, z: 0, yaw: 0, scale: 1 },
      { id: 'asset-3', kind: 'crate', islandId: a.id, x: 12, z: 0, yaw: 10, scale: 1 },
    ],
    start: { position: [-180, 535, 160], yaw: 180 },
    checkpoints: [
      { id: 'checkpoint-1', position: [-180, 535, 50], yaw: 180, radius: 12 },
      { id: 'checkpoint-2', position: [0, 545, -100], yaw: 110, radius: 12 },
      { id: 'checkpoint-3', position: [180, 540, -230], yaw: 110, radius: 12 },
    ],
  };
}

type Raw = Record<string, unknown>;
function object(v: unknown, label: string): Raw {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error(label + ' must be an object.');
  return v as Raw;
}
function number(v: unknown, lo: number, hi: number, label: string, integer = false): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi || (integer && !Number.isInteger(v))) {
    throw Error(label + ' must be ' + (integer ? 'an integer ' : '') + 'between ' + lo + ' and ' + hi + '.');
  }
  return v;
}
function text(v: unknown, label: string, max = 64): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw Error(label + ' must contain 1–' + max + ' characters.');
  return v.trim();
}
function list(v: unknown, max: number, label: string): unknown[] {
  if (!Array.isArray(v) || v.length > max) throw Error(label + ' must be a list of at most ' + max + ' entries.');
  return v;
}
function point(v: unknown, label: string): [number, number, number] {
  const p = list(v, 3, label);
  if (p.length !== 3) throw Error(label + ' needs x, height and z.');
  return [number(p[0], -1200, 1200, label + ' x'), number(p[1], 150, 1500, label + ' height'), number(p[2], -1200, 1200, label + ' z')];
}
function unique(ids: (string | number)[], label: string): void {
  if (new Set(ids).size !== ids.length) throw Error('Duplicate ' + label + ' IDs.');
}

/** Whitelist every persisted field; imported data never becomes code or arbitrary world anchors. */
export function parseRegion(input: string | unknown): Region {
  if (typeof input === 'string' && new TextEncoder().encode(input).length > LIMITS.bytes) throw Error('Region file exceeds 200 KB.');
  const r = object(typeof input === 'string' ? JSON.parse(input) : input, 'Region');
  if (r.format !== 'driftwing-region' || r.version !== 1) throw Error('Expected a Driftwing region, version 1.');
  const islands = list(r.islands, LIMITS.islands, 'Islands').map((v, i): IslandDef => {
    const d = object(v, 'Island ' + (i + 1));
    if (!['meadow', 'plateau', 'rocky'].includes(String(d.kind))) throw Error('Unsupported island preset.');
    return {
      id: number(d.id, 10000, 1_000_000, 'Island ID', true), kind: d.kind as Preset,
      name: text(d.name, 'Island name'), x: number(d.x, -1000, 1000, 'Island x'),
      y: number(d.y, 220, 1000, 'Island height'), z: number(d.z, -1000, 1000, 'Island z'),
      radius: number(d.radius, 35, 220, 'Island radius'), outline: number(d.outline, 0, 0.35, 'Outline'),
      hills: number(d.hills, 0, 40, 'Hill relief'), depth: number(d.depth, 40, 320, 'Depth'),
      lip: number(d.lip, 5, 20, 'Rim thickness'), flatCenter: number(d.flatCenter, 0.1, 0.8, 'Flat centre'),
      seed: number(d.seed, 0, 2_147_483_647, 'Seed', true), trees: 0, grass: 0, waterfalls: 0,
    };
  });
  unique(islands.map(d => d.id), 'island');
  const assets = list(r.assets, LIMITS.assets, 'Assets').map((v): PlacedAsset => {
    const a = object(v, 'Asset');
    if (!ASSET_KINDS.includes(a.kind as AssetKind)) throw Error('Unsupported asset.');
    const islandId = number(a.islandId, 10000, 1_000_000, 'Asset island ID', true);
    if (!islands.some(d => d.id === islandId)) throw Error('Asset refers to a missing island.');
    return {
      id: text(a.id, 'Asset ID'), kind: a.kind as AssetKind, islandId,
      x: number(a.x, -250, 250, 'Asset x'), z: number(a.z, -250, 250, 'Asset z'),
      yaw: number(a.yaw, -180, 180, 'Asset yaw'), scale: number(a.scale, 0.5, 2, 'Asset scale'),
    };
  });
  unique(assets.map(a => a.id), 'asset');
  const checkpoints = list(r.checkpoints, LIMITS.checkpoints, 'Checkpoints').map((v): Checkpoint => {
    const c = object(v, 'Checkpoint');
    return { id: text(c.id, 'Checkpoint ID'), position: point(c.position, 'Checkpoint'), yaw: number(c.yaw, -180, 180, 'Checkpoint facing'), radius: number(c.radius, 7, 24, 'Checkpoint radius') };
  });
  unique(checkpoints.map(c => c.id), 'checkpoint');
  const start = object(r.start, 'Start');
  return { format: 'driftwing-region', version: 1, name: text(r.name, 'Region name'), islands, assets,
    start: { position: point(start.position, 'Start'), yaw: number(start.yaw, -180, 180, 'Start facing') }, checkpoints };
}
export function regionLayout(r: Region, sandbox = false): WorldLayout {
  const x = sandbox ? REGION_ORIGIN.x : 0;
  const z = sandbox ? REGION_ORIGIN.z : 0;
  const authored = r.islands.map(d => ({ ...d, x: d.x + x, z: d.z + z, landmark: 'authored-' + d.id }));
  return {
    ...structuredClone(LAYOUT),
    islands: sandbox ? [...structuredClone(LAYOUT.islands), ...authored] : authored,
    spires: sandbox ? structuredClone(LAYOUT.spires) : [], arches: sandbox ? structuredClone(LAYOUT.arches) : [],
    thermals: sandbox ? structuredClone(LAYOUT.thermals) : [],
    landmarks: [...(sandbox ? structuredClone(LAYOUT.landmarks) : []), ...authored.map(d => ({
      id: 'authored-' + d.id, name: d.name ?? 'Authored island', description: 'Authored sandbox island.',
      position: [d.x, d.y + 30, d.z] as [number, number, number],
    }))],
    boundaryRadius: sandbox ? 10500 : LAYOUT.boundaryRadius,
  };
}
export function regionRace(r: Region, sandbox = false): RaceDef | null {
  if (!r.checkpoints.length) return null;
  const origin = sandbox ? REGION_ORIGIN : { x: 0, z: 0 };
  const position = (p: [number, number, number]): [number, number, number] => [p[0] + origin.x, p[1], p[2] + origin.z];
  const def: RaceDef = {
    id: 'authored-region', name: r.name, description: 'Authoring sandbox course', kind: 'rings', difficulty: 1,
    start: { position: position(r.start.position), yaw: r.start.yaw * Math.PI / 180 },
    rings: r.checkpoints.map(c => ({ position: position(c.position), radius: c.radius,
      normal: [Math.sin(c.yaw * Math.PI / 180), 0, Math.cos(c.yaw * Math.PI / 180)] })),
    medals: { gold: 0, silver: 0, bronze: 0 }, landmark: 'authored-' + (r.islands[0]?.id ?? 10000),
  };
  def.medals = medalTimes(coursePoints(def));
  return def;
}

/** Bounded whole-document transactions keep every edit (including import and cascading delete) reversible. */
export class RegionHistory {
  current: Region;
  private past: Region[] = [];
  private future: Region[] = [];
  constructor(initial: Region) { this.current = parseRegion(initial); }
  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }
  commit(next: Region): boolean {
    const clean = parseRegion(next);
    if (JSON.stringify(clean) === JSON.stringify(this.current)) return false;
    this.past.push(cloneRegion(this.current));
    if (this.past.length > 60) this.past.shift();
    this.current = clean; this.future = []; return true;
  }
  edit(fn: (r: Region) => void): boolean { const next = cloneRegion(this.current); fn(next); return this.commit(next); }
  undo(): void { const previous = this.past.pop(); if (previous) { this.future.push(this.current); this.current = previous; } }
  redo(): void { const next = this.future.pop(); if (next) { this.past.push(this.current); this.current = next; } }
}
