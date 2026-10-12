import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import type { GameEvents, Medal } from '../core/types';
import { COSMETICS, type CosmeticOption, type Unlock } from '../cosmetics/catalog';
import { defaultSave } from './save';
import { describeUnlock, evaluateUnlocks, grantUnlocks, medalAtLeast, unlockEntry, unlockProgress } from './unlocks';
import { RELICS, featherId } from './relics';

const opt = (id: string, unlock: Unlock): CosmeticOption => ({ id, slot: 'riderCape', name: id, description: '', unlock });

function saveWith(p: { feathers?: number; relics?: string[]; races?: Record<string, Medal> }) {
  const s = defaultSave();
  for (let i = 0; i < (p.feathers ?? 0); i++) s.collected.push(featherId(i));
  s.collected.push(...(p.relics ?? []));
  for (const [id, medal] of Object.entries(p.races ?? {})) s.races[id] = { bestMs: 60000, medal, breed: 'harrier', runs: 1 };
  return s;
}

describe('unlock evaluation', () => {
  it('never reports defaults as newly unlocked', () => {
    const fresh = evaluateUnlocks(saveWith({}), [opt('a', { type: 'default' })]);
    expect(fresh).toEqual([]);
  });

  it('feathers: unlocks at exactly the count', () => {
    const cat = [opt('f5', { type: 'feathers', count: 5 })];
    expect(evaluateUnlocks(saveWith({ feathers: 4 }), cat)).toEqual([]);
    expect(evaluateUnlocks(saveWith({ feathers: 5 }), cat).map((c) => c.id)).toEqual(['f5']);
    // Relics don't count as feathers.
    expect(evaluateUnlocks(saveWith({ feathers: 4, relics: ['relic-ember'] }), cat)).toEqual([]);
  });

  it('relic: needs that relic specifically', () => {
    const cat = [opt('r', { type: 'relic', relicId: 'relic-mane' })];
    expect(evaluateUnlocks(saveWith({ relics: ['relic-ember'] }), cat)).toEqual([]);
    expect(evaluateUnlocks(saveWith({ relics: ['relic-mane'] }), cat).map((c) => c.id)).toEqual(['r']);
  });

  it('medal: a better medal on that race also counts, other races do not', () => {
    const cat = [opt('m', { type: 'medal', raceId: 'cascade-run', medal: 'silver' })];
    expect(evaluateUnlocks(saveWith({ races: { 'cascade-run': 'bronze' } }), cat)).toEqual([]);
    expect(evaluateUnlocks(saveWith({ races: { 'roost-loop': 'gold' } }), cat)).toEqual([]);
    expect(evaluateUnlocks(saveWith({ races: { 'cascade-run': 'silver' } }), cat)).toHaveLength(1);
    expect(evaluateUnlocks(saveWith({ races: { 'cascade-run': 'gold' } }), cat)).toHaveLength(1);
  });

  it('medals: counts races at or above the medal', () => {
    const cat = [opt('g3', { type: 'medals', medal: 'gold', count: 3 }), opt('b2', { type: 'medals', medal: 'bronze', count: 2 })];
    const s = saveWith({ races: { a: 'gold', b: 'gold', c: 'silver' } });
    expect(evaluateUnlocks(s, cat).map((c) => c.id)).toEqual(['b2']);
    s.races.c.medal = 'gold';
    expect(evaluateUnlocks(s, cat).map((c) => c.id)).toEqual(['g3', 'b2']);
    // 'none' records (finished without a medal) count for nothing.
    expect(evaluateUnlocks(saveWith({ races: { a: 'none', b: 'none' } }), cat)).toEqual([]);
  });

  it('does not report what the save already records', () => {
    const cat = [opt('f1', { type: 'feathers', count: 1 })];
    const s = saveWith({ feathers: 3 });
    s.unlocked.push('f1');
    expect(evaluateUnlocks(s, cat)).toEqual([]);
  });

  it('covers every unlock in the real catalog: a complete save unlocks everything', () => {
    const all = saveWith({
      feathers: 48,
      relics: RELICS.map((r) => r.id),
      races: Object.fromEntries(['roost-loop', 'cascade-run', 'archway-thread', 'underspan', 'needle-slalom', 'lantern-dash', 'long-drift'].map((id) => [id, 'gold'])),
    });
    const fresh = evaluateUnlocks(all);
    const locked = COSMETICS.filter((c) => c.unlock.type !== 'default' && !c.sourceOutfit);
    expect(fresh.length).toBe(locked.length);
    // Every relic the catalog names exists.
    for (const c of COSMETICS) if (c.unlock.type === 'relic') expect(RELICS.some((r) => r.id === (c.unlock as { relicId: string }).relicId)).toBe(true);
    // An empty save unlocks nothing.
    expect(evaluateUnlocks(defaultSave())).toEqual([]);
  });

  it('grantUnlocks records, announces once, and is idempotent', () => {
    const bus = new EventBus<GameEvents>();
    const got: string[] = [];
    const toasts: string[] = [];
    bus.on('unlock', (e) => got.push(`${e.slot}:${e.cosmeticId}`));
    bus.on('toast', (e) => toasts.push(e.text));
    const s = saveWith({ feathers: 6 });
    const granted = grantUnlocks(s, bus);
    expect(granted.map((c) => c.id).sort()).toEqual(['blade', 'cap', 'half', 'long', 'stripes'].sort());
    expect(got).toContain('riderHair:long');
    expect(toasts.length).toBe(granted.length);
    expect(grantUnlocks(s, bus)).toEqual([]);
    expect(got.length).toBe(granted.length);
  });

  it('progress and descriptions read sensibly', () => {
    const s = saveWith({ feathers: 7 });
    expect(unlockProgress({ type: 'feathers', count: 10 }, s)).toEqual({ have: 7, need: 10 });
    expect(unlockProgress({ type: 'feathers', count: 5 }, s)).toEqual({ have: 5, need: 5 });
    expect(describeUnlock({ type: 'feathers', count: 10 })).toBe('Find 10 feathers');
    expect(describeUnlock({ type: 'relic', relicId: 'relic-charts' })).toBe('Find the Wind Charts');
    expect(describeUnlock({ type: 'medal', raceId: 'roost-loop', medal: 'gold' }, () => 'Roost Loop')).toBe('Gold on Roost Loop');
    expect(medalAtLeast('gold', 'bronze')).toBe(true);
    expect(medalAtLeast('none', 'bronze')).toBe(false);
  });

  it('records clashing ids with their slot', () => {
    const hair = COSMETICS.find((c) => c.slot === 'riderHair' && c.id === 'long')!;
    // The scarf 'long' is a default, so the hair can be recorded by its plain id.
    expect(unlockEntry(hair)).toBe('long');
    const a = opt('x', { type: 'feathers', count: 1 });
    const b: CosmeticOption = { ...opt('x', { type: 'feathers', count: 2 }), slot: 'riderHair' };
    expect(unlockEntry(a, [a, b])).toBe('riderCape:x');
  });
});
