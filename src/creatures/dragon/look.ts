// The dragon's look (gate G12a; Q48): its flight, a small hue shift and one part per slot.
//
// Colours are derived, never picked. Each flight has a palette (Q36: the hues one dragon of that
// flight carries, e.g. the white flight's ivory hide with powder-blue plates in render 08), and a
// dragon's palette is its flight's turned by its hue shift: Robert, 2026-10-19, "their colors are
// a small hue change for variation within flight". The turn is in OKLCH with lightness and chroma
// held, so every dragon of a flight reads as that flight; the shift is at most ±8° (Q48b), within its
// flight's own range (the white flight's is 0° to +4°: Robert, 2026-10-19, from G12b's lineup), and
// is a stored number, never random at runtime.
//
// The elders' dragons are characters whose looks are authored (Q48c): this is not a save format
// and nothing here touches WyvernLook or driftwing.save.v1.

import { clamp } from '../../core/math';

export type DragonFlight = 'white' | 'red' | 'green' | 'blue' | 'black';

/** The customization slots (Q48). Every part fits every flight's dragon (Q48a). */
export type DragonPartSlot = 'horns' | 'whiskers' | 'frill' | 'tail' | 'pattern';
export const DRAGON_PART_SLOTS: readonly DragonPartSlot[] = ['horns', 'whiskers', 'frill', 'tail', 'pattern'];

export interface DragonLook {
  flight: DragonFlight;
  /** Hue shift from the flight's palette (degrees; clamped to the flight's range, FLIGHT_HUE_RANGE). */
  hueShift: number;
  /** Part id per slot (see catalog.ts). */
  parts: Record<DragonPartSlot, string>;
}

/** One flight's colours by region, as "#rrggbb". */
export interface DragonPalette {
  hide: string;
  belly: string;
  /** The broad plates along the back, the top of the neck and the top of the tail. */
  plates: string;
  membrane: string;
  wingBones: string;
  claws: string;
  eyes: string;
  /** Horns, spines, fin rays and the tail fin (the hide shader's horn region). */
  horns: string;
}

/** The bound on any flight's hue shift (Q48b). */
export const HUE_SHIFT_MAX_DEG = 8;

/**
 * Each flight's own hue range (degrees), inside the bound. The white flight's is 0° to +4°: of G12b's
 * lineup at −8°, −4°, 0°, +4° and +8°, Robert liked 0° and +4° and narrowed it to that
 * (2026-10-19, Q48). Flights without a range of their own take the full ±8° until theirs is judged.
 */
export const FLIGHT_HUE_RANGE: Partial<Record<DragonFlight, readonly [number, number]>> = {
  white: [0, 4],
};

/** A flight's hue range: its own, or the full bound. */
export function hueRange(flight: DragonFlight): readonly [number, number] {
  return FLIGHT_HUE_RANGE[flight] ?? [-HUE_SHIFT_MAX_DEG, HUE_SHIFT_MAX_DEG];
}

/**
 * Flight palettes. Only the white flight has a source so far: the values are the model kit's,
 * read from render 08 (`Art and Assets/Creatures and Customization/WHITE_DRAGON_MODEL_KIT.md`).
 * The other four flights get theirs from their own renders, none of which exist yet.
 */
export const FLIGHT_PALETTES: Partial<Record<DragonFlight, DragonPalette>> = {
  white: {
    hide: '#efe6d6',
    belly: '#f7f0e1',
    plates: '#9db6d3',
    membrane: '#f2e6d0',
    wingBones: '#9db6d3',
    claws: '#4a5260',
    eyes: '#b8d4e8',
    // The kit asks for "pale bone ivory" without a value. This is the midpoint of the hide's ivory
    // and the wyverns' bone horn (#d9c9a6, wyvern/materials.ts): a step warmer and darker than the
    // hide, so the horns read against it. Proposed in G12b and settled by Robert, 2026-10-19: "the
    // horn should be an off white color so current is looking good".
    horns: '#e4d8be',
  },
};

/** A dragon's own palette: its flight's, turned by its hue shift clamped to the flight's range. */
export function dragonPalette(look: DragonLook): DragonPalette {
  const base = FLIGHT_PALETTES[look.flight];
  if (!base) throw Error(`Dragon look: the ${look.flight} flight has no palette yet`);
  const [lo, hi] = hueRange(look.flight);
  const shift = clamp(look.hueShift, Math.max(lo, -HUE_SHIFT_MAX_DEG), Math.min(hi, HUE_SHIFT_MAX_DEG));
  if (shift === 0) return { ...base };
  const out = {} as DragonPalette;
  for (const k of Object.keys(base) as (keyof DragonPalette)[]) out[k] = shiftHue(base[k], shift);
  return out;
}

// ---------------------------------------------------------------------------------------------
// OKLCH hue rotation (Björn Ottosson's OKLab, D65 sRGB)
// ---------------------------------------------------------------------------------------------

export interface Oklch {
  L: number;
  C: number;
  /** Hue (degrees, 0..360). */
  h: number;
}

/** Turn a colour's hue by `deg` in OKLCH, holding lightness and chroma (chroma is reduced only if
 * the turned colour would leave the sRGB gamut). */
export function shiftHue(hex: string, deg: number): string {
  const c = hexToOklch(hex);
  return oklchToHex({ L: c.L, C: c.C, h: c.h + deg });
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const [L, a, bb] = linearToOklab(r, g, b);
  const C = Math.hypot(a, bb);
  const h = (Math.atan2(bb, a) * 180) / Math.PI;
  return { L, C, h: (h + 360) % 360 };
}

export function oklchToHex(c: Oklch): string {
  const h = (c.h * Math.PI) / 180;
  const rgb = (C: number) => oklabToLinear(c.L, C * Math.cos(h), C * Math.sin(h));
  const inGamut = (v: number[]) => v.every((x) => x >= -1e-6 && x <= 1 + 1e-6);
  let lin = rgb(c.C);
  if (!inGamut(lin)) {
    // Bisect chroma down at the same lightness and hue.
    let lo = 0;
    let hi = c.C;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      if (inGamut(rgb(m))) lo = m;
      else hi = m;
    }
    lin = rgb(lo);
  }
  return rgbToHex(lin.map((x) => fromLinear(clamp(x, 0, 1))));
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgbToHex(rgb: number[]): string {
  return '#' + rgb.map((x) => Math.round(clamp(x, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
}

const toLinear = (x: number) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
const fromLinear = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);

function linearToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear(L: number, a: number, b: number): number[] {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
