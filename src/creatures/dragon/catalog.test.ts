import { describe, expect, it } from 'vitest';
import { DRAGON_PARTS, ELDER_DRAGONS, dragonPartsFor, hasValidParts } from './catalog';
import { DRAGON_PART_SLOTS, FLIGHT_PALETTES, HUE_SHIFT_MAX_DEG } from './look';

describe('dragon parts', () => {
  it('offers at least one part in every slot', () => {
    for (const slot of DRAGON_PART_SLOTS) expect(dragonPartsFor(slot).length).toBeGreaterThan(0);
  });

  it('has unique ids within each slot', () => {
    for (const slot of DRAGON_PART_SLOTS) {
      const ids = dragonPartsFor(slot).map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    for (const p of DRAGON_PARTS) expect(DRAGON_PART_SLOTS).toContain(p.slot);
  });

  it('names each option’s geometry: one piece or more for every slot with a shape, none for the pattern', () => {
    for (const p of DRAGON_PARTS) expect(p.pieces.length > 0, `${p.slot}/${p.id}`).toBe(p.slot !== 'pattern');
    const all = DRAGON_PARTS.flatMap((p) => p.pieces);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('elder dragons', () => {
  it('gives the white elder a complete, valid look from render 08', () => {
    const white = ELDER_DRAGONS.white!;
    expect(white.flight).toBe('white');
    expect(hasValidParts(white)).toBe(true);
    expect(white.parts).toEqual({ horns: 'branching', whiskers: 'long', frill: 'finCrest', tail: 'fin', pattern: 'plates' });
  });

  it('keeps every elder inside its flight: a palette exists and the shift is within ±8°', () => {
    for (const look of Object.values(ELDER_DRAGONS)) {
      expect(FLIGHT_PALETTES[look!.flight]).toBeDefined();
      expect(Math.abs(look!.hueShift)).toBeLessThanOrEqual(HUE_SHIFT_MAX_DEG);
    }
  });

  it('rejects a look with an unknown part', () => {
    const white = ELDER_DRAGONS.white!;
    expect(hasValidParts({ ...white, parts: { ...white.parts, horns: 'not-a-horn' } })).toBe(false);
  });
});
