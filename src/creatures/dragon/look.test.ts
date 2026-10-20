import { describe, expect, it } from 'vitest';
import { DRAGON_PART_SLOTS, FLIGHT_HUE_RANGE, FLIGHT_PALETTES, HUE_SHIFT_MAX_DEG, dragonPalette, hexToOklch, hueRange, oklchToHex, shiftHue, type DragonLook, type DragonPalette } from './look';

const look = (hueShift: number): DragonLook => ({
  flight: 'white',
  hueShift,
  parts: { horns: 'branching', whiskers: 'long', frill: 'finCrest', tail: 'fin', pattern: 'plates' },
});

const hueDelta = (a: number, b: number) => ((b - a + 540) % 360) - 180;
const channelGap = (a: string, b: string) => {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  return Math.max(...[16, 8, 0].map((s) => Math.abs(((x >> s) & 255) - ((y >> s) & 255))));
};

describe('OKLCH', () => {
  it('matches the reference values for sRGB red and white', () => {
    const red = hexToOklch('#ff0000');
    expect(red.L).toBeCloseTo(0.628, 3);
    expect(red.C).toBeCloseTo(0.2577, 3);
    expect(red.h).toBeCloseTo(29.23, 1);
    const white = hexToOklch('#ffffff');
    expect(white.L).toBeCloseTo(1, 4);
    expect(white.C).toBeLessThan(1e-4);
  });

  it('round-trips every white-flight colour to within one 8-bit step', () => {
    for (const hex of Object.values(FLIGHT_PALETTES.white!)) expect(channelGap(oklchToHex(hexToOklch(hex)), hex)).toBeLessThanOrEqual(1);
  });

  it('turns the hue and holds lightness and chroma', () => {
    for (const hex of Object.values(FLIGHT_PALETTES.white!)) {
      const a = hexToOklch(hex);
      for (const d of [-8, -3, 5, 8]) {
        const b = hexToOklch(shiftHue(hex, d));
        // 8-bit rounding moves L and C by a few thousandths at most.
        expect(Math.abs(b.L - a.L)).toBeLessThan(0.004);
        expect(Math.abs(b.C - a.C)).toBeLessThan(0.004);
        // Hue only means something with chroma: check it on the coloured regions.
        if (a.C > 0.03) expect(Math.abs(hueDelta(a.h, b.h) - d)).toBeLessThan(1.5);
      }
    }
  });
});

describe('dragon palette', () => {
  it('has every region for the white flight, as #rrggbb', () => {
    const p = FLIGHT_PALETTES.white!;
    const keys: (keyof DragonPalette)[] = ['hide', 'belly', 'plates', 'membrane', 'wingBones', 'claws', 'eyes', 'horns'];
    for (const k of keys) expect(p[k]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('is the flight palette itself at zero shift', () => {
    expect(dragonPalette(look(0))).toEqual(FLIGHT_PALETTES.white);
  });

  it('clamps the shift to its flight\'s range: the white flight 0° to +4°, inside the ±8° bound (Q48)', () => {
    expect(HUE_SHIFT_MAX_DEG).toBe(8);
    expect(FLIGHT_HUE_RANGE.white).toEqual([0, 4]);
    expect(dragonPalette(look(30))).toEqual(dragonPalette(look(4)));
    expect(dragonPalette(look(-30))).toEqual(FLIGHT_PALETTES.white);
    expect(dragonPalette(look(-4))).toEqual(FLIGHT_PALETTES.white);
    // A flight not yet judged keeps the full bound.
    expect(hueRange('red')).toEqual([-HUE_SHIFT_MAX_DEG, HUE_SHIFT_MAX_DEG]);
    for (const [lo, hi] of Object.values(FLIGHT_HUE_RANGE)) {
      expect(lo).toBeGreaterThanOrEqual(-HUE_SHIFT_MAX_DEG);
      expect(hi).toBeLessThanOrEqual(HUE_SHIFT_MAX_DEG);
    }
  });

  it('keeps a shifted white dragon white: the plates stay powder blue, the hide stays ivory', () => {
    const base = FLIGHT_PALETTES.white!;
    for (const d of [2, 4]) {
      const p = dragonPalette(look(d));
      // A small hue change: the plates move by about the shift, and the near-neutral hide by at
      // most a couple of 8-bit steps.
      expect(Math.abs(hueDelta(hexToOklch(base.plates).h, hexToOklch(p.plates).h) - d)).toBeLessThan(1.5);
      expect(channelGap(p.hide, base.hide)).toBeLessThanOrEqual(3);
      expect(channelGap(p.belly, base.belly)).toBeLessThanOrEqual(3);
    }
  });

  it('is deterministic', () => {
    expect(dragonPalette(look(2.5))).toEqual(dragonPalette(look(2.5)));
  });

  it('refuses a flight with no palette yet', () => {
    expect(() => dragonPalette({ ...look(0), flight: 'red' })).toThrow(/no palette/);
  });

  it('names the five slots of Q48', () => {
    expect([...DRAGON_PART_SLOTS]).toEqual(['horns', 'whiskers', 'frill', 'tail', 'pattern']);
  });
});
