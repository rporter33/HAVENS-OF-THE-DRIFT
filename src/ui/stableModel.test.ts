import { describe, expect, it } from 'vitest';
import type { CosmeticSlot } from '../core/types';
import { BREED_DEFAULT_COLORS, COSMETICS, DEFAULT_RIDER, DEFAULT_WYVERN } from '../cosmetics/catalog';
import { STABLE_TABS, looksDiffer, nextTab, withBreed } from './stableModel';

describe('stable tabs', () => {
  it('offer every cosmetic slot in the catalog', () => {
    const slots = new Set<CosmeticSlot>();
    for (const t of STABLE_TABS) for (const s of t.sections) if (s.kind === 'options' || s.kind === 'garment') slots.add(s.slot);
    for (const c of COSMETICS) expect(slots.has(c.slot)).toBe(true);
  });
  it('edit every field of both looks', () => {
    const wyvern = new Set<string>(['breed']);
    const rider = new Set<string>();
    for (const t of STABLE_TABS) {
      for (const s of t.sections) {
        if (s.kind === 'options' || s.kind === 'swatches') (s.target === 'wyvern' ? wyvern : rider).add(s.key);
        if (s.kind === 'garment' && s.key in DEFAULT_RIDER) rider.add(s.key);
        if (s.kind === 'build') rider.add('build');
      }
    }
    expect(wyvern).toEqual(new Set(Object.keys(DEFAULT_WYVERN)));
    expect(rider).toEqual(new Set(Object.keys(DEFAULT_RIDER)));
  });
  it('rider tabs frame the rider, wyvern tabs the wyvern', () => {
    for (const t of STABLE_TABS) expect(t.focus).toBe(t.group);
  });
});

describe('withBreed', () => {
  it('brings the new breed’s colors when the old defaults were untouched', () => {
    const look = withBreed(DEFAULT_WYVERN, 'skimmer');
    expect(look.breed).toBe('skimmer');
    expect(look.primary).toBe(BREED_DEFAULT_COLORS.skimmer.primary);
    expect(look.horns).toBe(DEFAULT_WYVERN.horns);
  });
  it('keeps colors the player chose', () => {
    const custom = { ...DEFAULT_WYVERN, primary: '#8e2f2f' };
    const look = withBreed(custom, 'ironback');
    expect(look.breed).toBe('ironback');
    expect(look.primary).toBe('#8e2f2f');
    expect(look.belly).toBe(DEFAULT_WYVERN.belly);
  });
  it('is a no-op for the same breed', () => {
    expect(withBreed(DEFAULT_WYVERN, 'harrier')).toBe(DEFAULT_WYVERN);
  });
});

describe('helpers', () => {
  it('detects changed looks', () => {
    expect(looksDiffer(DEFAULT_RIDER, { ...DEFAULT_RIDER })).toBe(false);
    expect(looksDiffer(DEFAULT_RIDER, { ...DEFAULT_RIDER, hair: 'curls' })).toBe(true);
  });
  it('wraps tab switching', () => {
    expect(nextTab(0, -1)).toBe(STABLE_TABS.length - 1);
    expect(nextTab(STABLE_TABS.length - 1, 1)).toBe(0);
  });
});
