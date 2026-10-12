// Persistence: one versioned JSON document in localStorage, ghosts in IndexedDB.
//
// Loading never trusts what it finds: the raw document is run through the migration chain up to
// the current version and then sanitized field by field (unknown breeds, cosmetics, colors,
// race records or collectible ids fall back to defaults), so a hand-edited, truncated or
// old-format save always yields a playable game. Ghost recordings are large binary blobs, so they
// live in IndexedDB (falling back to memory when it's unavailable, e.g. in tests or private
// windows) and are never part of the JSON document.

import type { BreedId, CosmeticSlot, Medal, RaceRecord, RiderLook, Settings, WyvernLook } from '../core/types';
import type { GhostRecording, SaveData, SaveStore } from '../game/contracts';
import { COSMETICS, DEFAULT_RIDER, DEFAULT_WYVERN, cosmeticById } from '../cosmetics/catalog';
import { DEFAULT_SETTINGS } from '../game/settings';
import { BREEDS } from '../flight/breeds';
import { isCollectibleId } from './relics';
import { cosmeticKey, medalAtLeast, medalTally, recordedUnlocked } from './unlocks';
import { researchState } from '../research/state';
import { GARMENT_SLOTS } from '../cosmetics/wardrobe';

export const SAVE_KEY = 'driftwing.save.v1';
/** Where pre-release builds kept their (unversioned) save. Migrated once, then removed. */
export const LEGACY_SAVE_KEY = 'driftwing.save';
export const SAVE_VERSION = 1;

/** Floats per ghost sample: x, y, z, qx, qy, qz, qw, flapPhase, flapStrength, wingSpread, flare. */
export const GHOST_STRIDE = 11;

export function defaultSave(): SaveData {
  return {
    version: 1,
    wyvern: { ...DEFAULT_WYVERN },
    rider: { ...DEFAULT_RIDER },
    unlocked: [],
    collected: [],
    races: {},
    settings: { ...DEFAULT_SETTINGS },
    discovered: [],
    playTime: 0,
    tutorialDone: false,
    research: researchState(undefined, { collected: [], discovered: [] }),
  };
}

// ---------------------------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------------------------

type Raw = Record<string, unknown>;

/**
 * One step per version: MIGRATIONS[n] turns a version-n document into version n+1. Steps work
 * on loose JSON; sanitize() then enforces the final shape.
 *
 * v0 (pre-release, no `version` field): race records were { best, medal } without run counts or
 * breed, collectibles lived under `found`, and discovered landmarks weren't tracked.
 */
const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {
  0: (raw) => {
    const out: Raw = { ...raw, version: 1 };
    if (!Array.isArray(raw.collected) && Array.isArray(raw.found)) out.collected = raw.found;
    delete out.found;
    const races: Raw = {};
    if (isObject(raw.races)) {
      for (const [id, rec] of Object.entries(raw.races)) {
        if (!isObject(rec)) continue;
        const best = typeof rec.bestMs === 'number' ? rec.bestMs : rec.best;
        races[id] = { bestMs: best, medal: rec.medal, breed: rec.breed ?? 'harrier', runs: rec.runs ?? 1 };
      }
    }
    out.races = races;
    if (!Array.isArray(raw.discovered)) out.discovered = [];
    return out;
  },
};

/** Version of a raw document (0 when it predates versioning). */
function versionOf(raw: Raw): number {
  const v = raw.version;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0;
}

/**
 * PURE: any parsed JSON (or garbage) → a valid current-version SaveData. Documents from a newer
 * build than this one are read as best we can rather than discarded.
 */
export function migrateSave(input: unknown): SaveData {
  if (!isObject(input)) return defaultSave();
  let raw: Raw = input;
  let v = versionOf(raw);
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    raw = step ? step(raw) : { ...raw, version: v + 1 };
    v = versionOf(raw) > v ? versionOf(raw) : v + 1;
  }
  return sanitize(raw);
}

// ---------------------------------------------------------------------------------------------
// Sanitizing
// ---------------------------------------------------------------------------------------------

const HEX = /^#[0-9a-fA-F]{6}$/;
const MEDALS: readonly Medal[] = ['none', 'bronze', 'silver', 'gold'];

function isObject(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isBreed(v: unknown): v is BreedId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(BREEDS, v);
}

function color(v: unknown, fallback: string): string {
  return typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fallback;
}

function cosmetic(v: unknown, slot: CosmeticSlot, fallback: string): string {
  return typeof v === 'string' && cosmeticById(v, slot) ? v : fallback;
}

function strings(v: unknown, keep: (s: string) => boolean = () => true): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const s of v) if (typeof s === 'string' && keep(s) && !out.includes(s)) out.push(s);
  return out;
}

function sanitizeWyvern(v: unknown): WyvernLook {
  const r = isObject(v) ? v : {};
  const d = DEFAULT_WYVERN;
  return {
    breed: isBreed(r.breed) ? r.breed : d.breed,
    primary: color(r.primary, d.primary),
    secondary: color(r.secondary, d.secondary),
    belly: color(r.belly, d.belly),
    membrane: color(r.membrane, d.membrane),
    eyes: color(r.eyes, d.eyes),
    pattern: cosmetic(r.pattern, 'wyvernPattern', d.pattern),
    horns: cosmetic(r.horns, 'wyvernHorns', d.horns),
    frill: cosmetic(r.frill, 'wyvernFrill', d.frill),
    tail: cosmetic(r.tail, 'wyvernTail', d.tail),
    saddle: cosmetic(r.saddle, 'saddle', d.saddle),
    saddleColor: color(r.saddleColor, d.saddleColor),
  };
}

function sanitizeRider(v: unknown): RiderLook {
  const r = isObject(v) ? v : {};
  const d = DEFAULT_RIDER;
  const builds: RiderLook['build'][] = ['slight', 'medium', 'broad'];
  const wardrobe: NonNullable<RiderLook['wardrobe']> = {};
  if (isObject(r.wardrobe)) for (const [part, slot] of Object.entries(GARMENT_SLOTS)) {
    const value = r.wardrobe[part];
    if (typeof value === 'string' && cosmeticById(value, slot)) wardrobe[part as keyof typeof wardrobe] = value;
  }
  return {
    build: r.outfit === 'travel-drape' ? 'medium' : builds.includes(r.build as RiderLook['build']) ? (r.build as RiderLook['build']) : d.build,
    skin: color(r.skin, d.skin),
    hair: cosmetic(r.hair, 'riderHair', d.hair),
    hairColor: color(r.hairColor, d.hairColor),
    outfit: cosmetic(r.outfit, 'riderOutfit', d.outfit),
    outfitPrimary: color(r.outfitPrimary, d.outfitPrimary),
    outfitSecondary: color(r.outfitSecondary, d.outfitSecondary),
    headgear: cosmetic(r.headgear, 'riderHeadgear', d.headgear),
    scarf: cosmetic(r.scarf, 'riderScarf', d.scarf),
    scarfColor: color(r.scarfColor, d.scarfColor),
    cape: cosmetic(r.cape, 'riderCape', d.cape),
    capeColor: color(r.capeColor, d.capeColor),
    chest: cosmetic(r.chest, 'riderChest', d.chest),
    shoulderDrape: cosmetic(r.shoulderDrape, 'riderDrape', d.shoulderDrape),
    waist: cosmetic(r.waist, 'riderWaist', d.waist),
    armWraps: cosmetic(r.armWraps, 'riderArmWraps', d.armWraps),
    legWraps: cosmetic(r.legWraps, 'riderLegWraps', d.legWraps),
    footwear: cosmetic(r.footwear, 'riderFootwear', d.footwear),
    armorColor: color(r.armorColor, d.armorColor),
    leatherColor: color(r.leatherColor, d.leatherColor),
    ...(Object.keys(wardrobe).length ? { wardrobe } : {}),
  };
}

function sanitizeSettings(v: unknown): Settings {
  const r = isObject(v) ? v : {};
  const out: Settings = { ...DEFAULT_SETTINGS };
  // Copy only keys we know, and only when the type matches the default's.
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const val = r[key];
    if (typeof val === typeof DEFAULT_SETTINGS[key] && (typeof val !== 'number' || Number.isFinite(val))) {
      (out as unknown as Raw)[key] = val;
    }
  }
  const qualities: Settings['quality'][] = ['low', 'medium', 'high', 'ultra'];
  if (!qualities.includes(out.quality)) out.quality = DEFAULT_SETTINGS.quality;
  const tods: Settings['timeOfDay'][] = ['cycle', 'dawn', 'day', 'dusk', 'night'];
  if (!tods.includes(out.timeOfDay)) out.timeOfDay = DEFAULT_SETTINGS.timeOfDay;
  const clampTo = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
  out.resolutionScale = clampTo(out.resolutionScale, 0.5, 1);
  out.lookSensitivity = clampTo(out.lookSensitivity, 0.25, 2);
  out.fov = clampTo(out.fov, 40, 100);
  out.masterVolume = clampTo(out.masterVolume, 0, 1);
  out.musicVolume = clampTo(out.musicVolume, 0, 1);
  out.sfxVolume = clampTo(out.sfxVolume, 0, 1);
  out.dayLengthMinutes = clampTo(out.dayLengthMinutes, 1, 240);
  return out;
}

function sanitizeRaces(v: unknown): Record<string, RaceRecord> {
  const out: Record<string, RaceRecord> = {};
  if (!isObject(v)) return out;
  for (const [id, rec] of Object.entries(v)) {
    if (!isObject(rec)) continue;
    const best = rec.bestMs;
    if (typeof best !== 'number' || !Number.isFinite(best) || best <= 0) continue;
    const runs = typeof rec.runs === 'number' && Number.isFinite(rec.runs) ? Math.max(1, Math.floor(rec.runs)) : 1;
    out[id] = {
      bestMs: best,
      medal: MEDALS.includes(rec.medal as Medal) ? (rec.medal as Medal) : 'none',
      breed: isBreed(rec.breed) ? rec.breed : 'harrier',
      runs,
    };
  }
  return out;
}

function sanitizeUnlocked(v: unknown): string[] {
  const known = (s: string) => COSMETICS.some((c) => c.id === s || cosmeticKey(c) === s);
  return strings(v, known);
}

function sanitize(raw: Raw): SaveData {
  const playTime = typeof raw.playTime === 'number' && Number.isFinite(raw.playTime) && raw.playTime > 0 ? raw.playTime : 0;
  const collected = strings(raw.collected, isCollectibleId);
  const discovered = strings(raw.discovered);
  return {
    version: 1,
    wyvern: sanitizeWyvern(raw.wyvern),
    rider: sanitizeRider(raw.rider),
    unlocked: sanitizeUnlocked(raw.unlocked),
    collected,
    races: sanitizeRaces(raw.races),
    settings: sanitizeSettings(raw.settings),
    discovered,
    research: researchState(raw.research, { collected, discovered }),
    playTime,
    tutorialDone: raw.tutorialDone === true,
    ...(Array.isArray(raw.tips) ? { tips: [...new Set(raw.tips.filter((id): id is string => typeof id === 'string' && ['walk', 'takeoff', 'flap', 'pitch', 'flare', 'tired', 'rested', 'thermal', 'race'].includes(id)))] } : {}),
    ...(raw.firstLeadGuide === 'active' || raw.firstLeadGuide === 'skipped' ? { firstLeadGuide: raw.firstLeadGuide } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// Ghost storage
// ---------------------------------------------------------------------------------------------

export interface GhostBackend {
  get(raceId: string): Promise<GhostRecording | null>;
  put(ghost: GhostRecording): Promise<void>;
  clear(): Promise<void>;
}

/** PURE: a structurally valid copy of a stored ghost, or null. */
export function validGhost(v: unknown): GhostRecording | null {
  if (!isObject(v)) return null;
  const { raceId, breed, timeMs, rate } = v;
  let samples = v.samples as unknown;
  if (Array.isArray(samples)) samples = Float32Array.from(samples as number[]);
  if (samples instanceof ArrayBuffer) samples = new Float32Array(samples);
  if (!(samples instanceof Float32Array)) return null;
  if (typeof raceId !== 'string' || !isBreed(breed)) return null;
  if (typeof timeMs !== 'number' || !(timeMs > 0) || typeof rate !== 'number' || !(rate > 0)) return null;
  if (samples.length < GHOST_STRIDE * 2 || samples.length % GHOST_STRIDE !== 0) return null;
  const ghost: GhostRecording = {
    raceId,
    breed,
    look: sanitizeWyvern(v.look),
    rider: sanitizeRider(v.rider),
    timeMs,
    rate,
    samples,
  };
  if (Array.isArray(v.splits) && v.splits.every((s) => typeof s === 'number' && Number.isFinite(s))) ghost.splits = (v.splits as number[]).slice();
  return ghost;
}

export class MemoryGhostStore implements GhostBackend {
  private map = new Map<string, GhostRecording>();
  async get(raceId: string): Promise<GhostRecording | null> {
    return this.map.get(raceId) ?? null;
  }
  async put(ghost: GhostRecording): Promise<void> {
    this.map.set(ghost.raceId, ghost);
  }
  async clear(): Promise<void> {
    this.map.clear();
  }
}

/** Ghosts in IndexedDB, keyed by race id. Every failure degrades to the memory copy. */
export class IndexedDbGhostStore implements GhostBackend {
  private memory = new MemoryGhostStore();
  private db: Promise<IDBDatabase | null>;

  constructor(dbName = 'driftwing', private storeName = 'ghosts') {
    this.db = new Promise((resolve) => {
      try {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName, { keyPath: 'raceId' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
    const db = await this.db;
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, mode);
        const req = op(tx.objectStore(this.storeName));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async get(raceId: string): Promise<GhostRecording | null> {
    const cached = await this.memory.get(raceId);
    if (cached) return cached;
    const stored = validGhost(await this.run<unknown>('readonly', (s) => s.get(raceId)));
    if (stored) await this.memory.put(stored);
    return stored;
  }

  async put(ghost: GhostRecording): Promise<void> {
    await this.memory.put(ghost);
    await this.run('readwrite', (s) => s.put(ghost));
  }

  async clear(): Promise<void> {
    await this.memory.clear();
    await this.run('readwrite', (s) => s.clear());
  }
}

// ---------------------------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------------------------

/** The slice of the Web Storage API the store uses (so tests can hand in a map). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // access can throw when storage is blocked
  }
}

function browserGhosts(): GhostBackend {
  return typeof indexedDB !== 'undefined' ? new IndexedDbGhostStore() : new MemoryGhostStore();
}

export interface SaveStoreOptions {
  storage?: KeyValueStorage | null;
  ghosts?: GhostBackend;
  /** Debounce for save() (ms). */
  debounceMs?: number;
}

export class LocalSaveStore implements SaveStore {
  data: SaveData;
  private storage: KeyValueStorage | null;
  private ghosts: GhostBackend;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private debounceMs: number;

  constructor(opts: SaveStoreOptions = {}) {
    this.storage = opts.storage !== undefined ? opts.storage : browserStorage();
    this.ghosts = opts.ghosts ?? browserGhosts();
    this.debounceMs = opts.debounceMs ?? 500;
    this.data = this.load();
    // Don't lose the last few seconds when the tab closes.
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('pagehide', () => this.flushPending());
      document.addEventListener?.('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flushPending();
      });
    }
  }

  private load(): SaveData {
    const s = this.storage;
    if (!s) return defaultSave();
    try {
      const raw = s.getItem(SAVE_KEY);
      if (raw) return migrateSave(JSON.parse(raw));
      const legacy = s.getItem(LEGACY_SAVE_KEY);
      if (legacy) {
        const migrated = migrateSave(JSON.parse(legacy));
        this.write(migrated);
        s.removeItem(LEGACY_SAVE_KEY);
        return migrated;
      }
    } catch {
      /* corrupt JSON or blocked storage: start fresh (the old document is left untouched) */
    }
    return defaultSave();
  }

  private write(data: SaveData): void {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* storage full or blocked: play on without saving */
    }
  }

  private flushPending(): void {
    if (this.timer) this.flush();
  }

  save(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.write(this.data);
    }, this.debounceMs);
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.write(this.data);
  }

  reset(): void {
    const settings = this.data.settings;
    this.data = { ...defaultSave(), settings };
    void this.ghosts.clear();
    this.flush();
  }

  getGhost(raceId: string): Promise<GhostRecording | null> {
    return this.ghosts.get(raceId).catch(() => null);
  }

  putGhost(ghost: GhostRecording): Promise<void> {
    return this.ghosts.put(ghost).catch(() => undefined);
  }

  /**
   * Whether a cosmetic can be worn. Pass `slot` for ids that several slots share ('long' is
   * both a hair style and a scarf); without it the first catalog match is used.
   */
  isUnlocked(cosmeticId: string, slot?: CosmeticSlot): boolean {
    const c = cosmeticById(cosmeticId, slot);
    if (!c) return false;
    if (c.sourceOutfit) return this.isUnlocked(c.sourceOutfit, 'riderOutfit') || recordedUnlocked(this.data, c);
    return c.unlock.type === 'default' || recordedUnlocked(this.data, c);
  }

  medalCount(medal: Exclude<Medal, 'none'>): number {
    return medalTally(this.data, medal);
  }

  /** The best medal held on a race ('none' when never finished). */
  medalFor(raceId: string): Medal {
    return this.data.races[raceId]?.medal ?? 'none';
  }

  hasMedal(raceId: string, medal: Exclude<Medal, 'none'>): boolean {
    return medalAtLeast(this.medalFor(raceId), medal);
  }
}
