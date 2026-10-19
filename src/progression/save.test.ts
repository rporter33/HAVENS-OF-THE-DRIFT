import { describe, expect, it } from 'vitest';
import { DEFAULT_RIDER, DEFAULT_WYVERN } from '../cosmetics/catalog';
import { DEFAULT_SETTINGS } from '../game/settings';
import type { GhostRecording } from '../game/contracts';
import { GHOST_STRIDE, LEGACY_SAVE_KEY, LocalSaveStore, MemoryGhostStore, SAVE_KEY, defaultSave, migrateSave, validGhost, type KeyValueStorage } from './save';
import { featherId } from './relics';
import { airshipStage, recordResearch, researchState, RIDGE_OBSERVATION } from '../research/state';

class MapStorage implements KeyValueStorage {
  map = new Map<string, string>();
  writes = 0;
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.writes++;
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

function ghost(raceId = 'roost-loop', n = 10): GhostRecording {
  const samples = new Float32Array(n * GHOST_STRIDE);
  for (let i = 0; i < samples.length; i++) samples[i] = i * 0.5;
  return { raceId, breed: 'harrier', look: { ...DEFAULT_WYVERN }, rider: { ...DEFAULT_RIDER }, timeMs: 1234, rate: 30, samples, splits: [100, 200] };
}

describe('save migration and sanitizing', () => {
  it('backfills itemized pieces in old saves without changing legacy outfit, finds or unlocks', () => {
    const old = { version: 1, rider: { outfit: 'courier', hair: 'braids', outfitPrimary: '#112233' },
      collected: ['feather-01'], unlocked: ['stripes'] };
    const s = migrateSave(old);
    expect(s.rider).toEqual({ ...DEFAULT_RIDER, outfit: 'courier', hair: 'braids', outfitPrimary: '#112233' });
    expect(s.collected).toEqual(old.collected); expect(s.unlocked).toEqual(old.unlocked);
    expect(migrateSave(s)).toEqual(s);
  });

  it('round-trips removed pieces and dyes; repairs unknown components within their own slots', () => {
    const s = defaultSave();
    s.rider = { ...s.rider, outfit: 'travel-drape', chest: 'none', shoulderDrape: 'none', waist: 'none',
      armWraps: 'none', legWraps: 'none', footwear: 'none', armorColor: '#112233', leatherColor: '#aabbcc' };
    expect(migrateSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const repaired = migrateSave({ ...s, rider: { ...s.rider, build: 'broad', chest: 'sandals', waist: 5, leatherColor: 'red' } });
    expect(repaired.rider.build).toBe('medium');
    expect(repaired.rider.chest).toBe(DEFAULT_RIDER.chest);
    expect(repaired.rider.waist).toBe(DEFAULT_RIDER.waist);
    expect(repaired.rider.leatherColor).toBe(DEFAULT_RIDER.leatherColor);
    expect(repaired.rider.footwear).toBe('none');
  });
  it('repairs research ids and ignores forged totals while preserving existing finds', () => {
    const s = migrateSave({ version: 1, collected: ['relic-ember'], discovered: ['roost'],
      research: { entries: ['survey:gullrest-shrine:inscription', 'survey:gullrest-shrine:inscription', 'bogus', 7],
        points: { nature: 999999, antiquity: -8, winds: 'bad' } } });
    expect(s.research).toEqual({ entries: ['survey:gullrest-shrine:inscription'], points: { nature: 0, antiquity: 20, winds: 3 } });
    expect(migrateSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(s.collected).toEqual(['relic-ember']);
    expect(s.discovered).toEqual(['roost']);
  });

  it('garbage in, default save out', () => {
    for (const junk of [null, undefined, 42, 'x', [], [1, 2]]) expect(migrateSave(junk)).toEqual(defaultSave());
  });

  it('a current save round-trips unchanged', () => {
    const s = defaultSave();
    s.collected.push(featherId(0), 'relic-ember');
    s.unlocked.push('stripes');
    s.races['roost-loop'] = { bestMs: 61234, medal: 'silver', breed: 'skimmer', runs: 4 };
    s.discovered.push('roost', 'eye');
    s.playTime = 321.5;
    s.tutorialDone = true;
    s.settings.fov = 70;
    s.settings.windlineToggle = true;
    s.wyvern.horns = 'ram';
    s.research = researchState(s.research, s);
    expect(migrateSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('migrates a v0 (unversioned) document', () => {
    const v0 = {
      wyvern: { breed: 'galewing', primary: '#112233' },
      found: ['feather-03', 'relic-mane', 'feather-99'],
      races: { 'cascade-run': { best: 70500, medal: 'gold' }, broken: { best: 'x' } },
      settings: { fov: 75, quality: 'potato' },
    };
    const s = migrateSave(v0);
    expect(s.version).toBe(1);
    expect(s.collected).toEqual(['feather-03', 'relic-mane']);
    expect(s.races['cascade-run']).toEqual({ bestMs: 70500, medal: 'gold', breed: 'harrier', runs: 1 });
    expect(s.races.broken).toBeUndefined();
    expect(s.wyvern.breed).toBe('galewing');
    expect(s.wyvern.primary).toBe('#112233');
    expect(s.wyvern.horns).toBe(DEFAULT_WYVERN.horns);
    expect(s.settings.fov).toBe(75);
    expect(s.settings.windlineToggle).toBe(false);
    expect(s.settings.quality).toBe(DEFAULT_SETTINGS.quality);
    expect(s.discovered).toEqual([]);
  });

  it('moves settings saved on the old default lens (62°) to the new one, and leaves a chosen lens alone', () => {
    expect(migrateSave({ version: 1, settings: { fov: 62 } }).settings.fov).toBe(DEFAULT_SETTINGS.fov);
    expect(migrateSave({ version: 1, settings: { fov: 70 } }).settings.fov).toBe(70);
    // Once made under the new default, 62 is a choice.
    expect(migrateSave({ version: 1, settings: { fov: 62, lensRev: 1 } }).settings.fov).toBe(62);
    expect(migrateSave({ version: 1, settings: { fov: 62 } }).settings.lensRev).toBe(1);
  });

  it('repairs bad fields without losing good ones', () => {
    const s = migrateSave({
      version: 1,
      wyvern: { breed: 'dragon', horns: 'not-a-horn', pattern: 'ember', primary: 'red' },
      rider: { hair: 'braids', build: 'huge', scarf: 'long' },
      unlocked: ['ember', 'bogus', 'ember', 7],
      collected: ['feather-01', 'feather-01', 'relic-nope'],
      races: { a: { bestMs: -5, medal: 'gold' }, b: { bestMs: 5000, medal: 'platinum', runs: 2.7, breed: 'ironback' } },
      settings: { showGhost: 'yes', lookSensitivity: 99, fov: Infinity },
      playTime: -3,
    });
    expect(s.wyvern.breed).toBe('harrier');
    expect(s.wyvern.horns).toBe(DEFAULT_WYVERN.horns);
    expect(s.wyvern.pattern).toBe('ember');
    expect(s.wyvern.primary).toBe(DEFAULT_WYVERN.primary);
    expect(s.rider.hair).toBe('braids');
    expect(s.rider.build).toBe(DEFAULT_RIDER.build);
    expect(s.unlocked).toEqual(['ember']);
    expect(s.collected).toEqual(['feather-01']);
    expect(s.races.a).toBeUndefined();
    expect(s.races.b).toEqual({ bestMs: 5000, medal: 'none', breed: 'ironback', runs: 2 });
    expect(s.settings.showGhost).toBe(true);
    expect(s.settings.lookSensitivity).toBe(2);
    expect(s.settings.fov).toBe(DEFAULT_SETTINGS.fov);
    expect(s.playTime).toBe(0);
  });
});

describe('LocalSaveStore', () => {
  it('backfills old finds, persists research, and resets rewards and observations', () => {
    const storage = new MapStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, collected: ['feather-01', 'relic-ember'], discovered: ['roost'] }));
    const a = new LocalSaveStore({ storage, ghosts: new MemoryGhostStore() });
    expect(a.data.research).toEqual({ entries: [], points: { nature: 1, antiquity: 10, winds: 3 } });
    a.data.research = recordResearch(a.data.research, a.data, 'survey:gullrest-shrine:inscription').state;
    a.data.research = recordResearch(a.data.research, a.data, RIDGE_OBSERVATION).state;
    a.data.settings.invertPitch = true;
    a.flush();
    const b = new LocalSaveStore({ storage, ghosts: new MemoryGhostStore() });
    expect(b.data).toEqual(a.data);
    expect(airshipStage(b.data.research)).toBe(1);
    expect(recordResearch(b.data.research, b.data, 'survey:gullrest-shrine:inscription').event).toBeNull();
    b.reset();
    const c = new LocalSaveStore({ storage, ghosts: new MemoryGhostStore() });
    expect(c.data.research).toEqual({ entries: [], points: { nature: 0, antiquity: 0, winds: 0 } });
    expect(airshipStage(c.data.research)).toBe(0);
    expect(c.data.settings.invertPitch).toBe(true);
  });

  it('persists, reloads and resets (keeping settings)', () => {
    const storage = new MapStorage();
    const a = new LocalSaveStore({ storage, ghosts: new MemoryGhostStore() });
    a.data.collected.push('feather-07');
    a.data.races['lantern-dash'] = { bestMs: 90000, medal: 'bronze', breed: 'harrier', runs: 1 };
    a.data.settings.invertPitch = true;
    a.flush();
    const b = new LocalSaveStore({ storage, ghosts: new MemoryGhostStore() });
    expect(b.data.collected).toEqual(['feather-07']);
    expect(b.medalCount('bronze')).toBe(1);
    expect(b.medalCount('silver')).toBe(0);
    b.reset();
    const c = new LocalSaveStore({ storage, ghosts: new MemoryGhostStore() });
    expect(c.data.collected).toEqual([]);
    expect(c.data.races).toEqual({});
    expect(c.data.settings.invertPitch).toBe(true);
  });

  it('debounces save() into one write', async () => {
    const storage = new MapStorage();
    const s = new LocalSaveStore({ storage, ghosts: new MemoryGhostStore(), debounceMs: 5 });
    s.save();
    s.save();
    s.save();
    expect(storage.writes).toBe(0);
    await new Promise((r) => setTimeout(r, 20));
    expect(storage.writes).toBe(1);
  });

  it('migrates the legacy key once', () => {
    const storage = new MapStorage();
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify({ found: ['relic-charts'] }));
    const s = new LocalSaveStore({ storage, ghosts: new MemoryGhostStore() });
    expect(s.data.collected).toEqual(['relic-charts']);
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBeNull();
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).version).toBe(1);
  });

  it('survives corrupt JSON and missing storage', () => {
    const storage = new MapStorage();
    storage.setItem(SAVE_KEY, '{"version":1,"collected":[');
    expect(new LocalSaveStore({ storage, ghosts: new MemoryGhostStore() }).data).toEqual(defaultSave());
    const none = new LocalSaveStore({ storage: null, ghosts: new MemoryGhostStore() });
    none.data.collected.push('feather-01');
    expect(() => none.flush()).not.toThrow();
  });

  it('isUnlocked honours defaults, records and slots', () => {
    const s = new LocalSaveStore({ storage: null, ghosts: new MemoryGhostStore() });
    expect(s.isUnlocked('plain')).toBe(true);
    expect(s.isUnlocked('stripes')).toBe(false);
    expect(s.isUnlocked('nonexistent')).toBe(false);
    // 'long' is a feather-locked hair style and a default scarf.
    expect(s.isUnlocked('long', 'riderScarf')).toBe(true);
    expect(s.isUnlocked('long', 'riderHair')).toBe(false);
    s.data.unlocked.push('stripes', 'long');
    expect(s.isUnlocked('stripes')).toBe(true);
    expect(s.isUnlocked('long', 'riderHair')).toBe(true);
  });

  it('stores ghosts and clears them on reset', async () => {
    const s = new LocalSaveStore({ storage: new MapStorage(), ghosts: new MemoryGhostStore() });
    expect(await s.getGhost('roost-loop')).toBeNull();
    await s.putGhost(ghost());
    const g = await s.getGhost('roost-loop');
    expect(g?.samples.length).toBe(10 * GHOST_STRIDE);
    s.reset();
    await Promise.resolve();
    expect(await s.getGhost('roost-loop')).toBeNull();
  });
});

describe('ghost validation', () => {
  it('accepts well-formed recordings (also from plain arrays) and rejects broken ones', () => {
    const g = ghost();
    expect(validGhost(g)?.samples).toEqual(g.samples);
    expect(validGhost({ ...g, samples: Array.from(g.samples) })?.samples).toBeInstanceOf(Float32Array);
    expect(validGhost({ ...g, samples: g.samples.subarray(0, 15) })).toBeNull();
    expect(validGhost({ ...g, breed: 'dragon' })).toBeNull();
    expect(validGhost({ ...g, timeMs: 0 })).toBeNull();
    expect(validGhost({ ...g, splits: ['x'] })?.splits).toBeUndefined();
    expect(validGhost(null)).toBeNull();
  });
});
