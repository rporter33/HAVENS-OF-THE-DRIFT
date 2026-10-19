// The look of every hour, as data. Keyframes are art-directed in sRGB hex (what a painter would
// pick) and converted to linear once; the sky samples them by time of day, then the weather
// pulls them toward grey, mist or storm. Pure — no scene access — so it is unit-tested.

import { Color } from 'three';
import { clamp01, lerp, smoothstep } from '../core/math';

export interface SkyPalette {
  // --- Sky dome ---
  zenith: Color;
  horizon: Color;
  /** Horizon color on the side of the sun (sunrise/sunset glow). */
  horizonSun: Color;
  sunDisk: Color;
  /** Strength of the halo around the sun and the warm horizon on its side (0..~1.3). */
  glow: number;
  /** Earth's-shadow / Belt-of-Venus band opposite the sun at twilight (0..1). */
  belt: number;
  beltColor: Color;
  /** 0..1 star visibility. */
  stars: number;

  // --- Lights ---
  /** Key light (sun by day, moon by night) color. */
  key: Color;
  /** Key light intensity relative to the noon sun (1 = noon). */
  keyI: number;
  hemiSky: Color;
  hemiGround: Color;
  hemiI: number;

  // --- Air ---
  fog: Color;
  fogSun: Color;
  fogDensity: number;
  fogFalloff: number;

  // --- Clouds ---
  cloudLit: Color;
  cloudShade: Color;

  // --- Grade / post ---
  exposure: number;
  saturation: number;
  contrast: number;
  lift: Color;
  gain: Color;
  bloom: number;
  bloomThreshold: number;
  rim: number;
  /**
   * Saturation boost for muted colors (grade uVibrance): a painterly lift for daylight greens,
   * blues and stone. Off from sunset to dawn, where it pushes pinks and violets to magenta.
   */
  vibrance: number;
}

type ColorKey = {
  [K in keyof SkyPalette]: SkyPalette[K] extends Color ? K : never;
}[keyof SkyPalette];
type NumberKey = {
  [K in keyof SkyPalette]: SkyPalette[K] extends number ? K : never;
}[keyof SkyPalette];

export const COLOR_KEYS: ColorKey[] = [
  'zenith', 'horizon', 'horizonSun', 'sunDisk', 'beltColor', 'key', 'hemiSky', 'hemiGround',
  'fog', 'fogSun', 'cloudLit', 'cloudShade', 'lift', 'gain',
];
export const NUMBER_KEYS: NumberKey[] = [
  'glow', 'belt', 'stars', 'keyI', 'hemiI', 'fogDensity', 'fogFalloff', 'exposure', 'saturation',
  'contrast', 'bloom', 'bloomThreshold', 'rim', 'vibrance',
];

/** Authoring form: colors as sRGB hex. */
type PaletteSpec = { [K in ColorKey]: string } & { [K in NumberKey]: number };

// ---------------------------------------------------------------------------------------------
// Keyframes
// ---------------------------------------------------------------------------------------------

const NIGHT: PaletteSpec = {
  zenith: '#06102c', horizon: '#1c325f', horizonSun: '#1c325f', sunDisk: '#000000', glow: 0,
  belt: 0, beltColor: '#000000', stars: 1,
  key: '#a9c0f2', keyI: 0.28, hemiSky: '#3c5590', hemiGround: '#40507e', hemiI: 0.8,
  fog: '#1a2c56', fogSun: '#2e4680', fogDensity: 0.00024, fogFalloff: 0.0021,
  cloudLit: '#7686b6', cloudShade: '#141d40',
  exposure: 1.08, saturation: 0.94, contrast: 1.06, lift: '#03081c', gain: '#d6e2ff',
  bloom: 0.55, bloomThreshold: 0.72, rim: 0.75, vibrance: 0,
};

const PREDAWN: PaletteSpec = {
  zenith: '#12235a', horizon: '#4a4c8e', horizonSun: '#946c9c', sunDisk: '#000000', glow: 0.25,
  belt: 0, beltColor: '#000000', stars: 0.5,
  key: '#a4b0e4', keyI: 0.2, hemiSky: '#4a5a96', hemiGround: '#424670', hemiI: 1.1,
  fog: '#3c4479', fogSun: '#7e6292', fogDensity: 0.00027, fogFalloff: 0.0021,
  cloudLit: '#a8a8da', cloudShade: '#343a6c',
  exposure: 1.5, saturation: 0.98, contrast: 1.04, lift: '#0a0822', gain: '#e2dcff',
  bloom: 0.5, bloomThreshold: 0.75, rim: 0.65, vibrance: 0,
};

const DAWN: PaletteSpec = {
  zenith: '#3a5a9c', horizon: '#e6a6a8', horizonSun: '#ffbe76', sunDisk: '#ffd29a', glow: 1.0,
  belt: 0.55, beltColor: '#d8a0bc', stars: 0.06,
  key: '#ffb07a', keyI: 0.42, hemiSky: '#8c9ece', hemiGround: '#b29cb0', hemiI: 0.98,
  fog: '#caa2b6', fogSun: '#ffbe86', fogDensity: 0.0003, fogFalloff: 0.0021,
  cloudLit: '#ffd0b0', cloudShade: '#7e78aa',
  exposure: 1.12, saturation: 1.1, contrast: 1.04, lift: '#160a28', gain: '#fff0e4',
  bloom: 0.42, bloomThreshold: 0.82, rim: 0.85, vibrance: 0.04,
};

const MORNING_GOLD: PaletteSpec = {
  zenith: '#4472bc', horizon: '#d2c6cc', horizonSun: '#ffd6a2', sunDisk: '#fff0d0', glow: 0.8,
  belt: 0.12, beltColor: '#d0a8c0', stars: 0,
  key: '#ffd29e', keyI: 0.72, hemiSky: '#9cb4dc', hemiGround: '#bab6c6', hemiI: 1.0,
  fog: '#c4c4d6', fogSun: '#ffd4a2', fogDensity: 0.00026, fogFalloff: 0.0022,
  cloudLit: '#fff0dc', cloudShade: '#8e9cc6',
  exposure: 1.04, saturation: 1.1, contrast: 1.05, lift: '#0a0818', gain: '#fff6ec',
  bloom: 0.34, bloomThreshold: 0.85, rim: 0.65, vibrance: 0.14,
};

const MORNING: PaletteSpec = {
  zenith: '#2c66c8', horizon: '#aecaec', horizonSun: '#f4e6d0', sunDisk: '#fff6e6', glow: 0.6,
  belt: 0, beltColor: '#000000', stars: 0,
  key: '#ffe8c8', keyI: 0.92, hemiSky: '#a4c0e8', hemiGround: '#b4bccc', hemiI: 1.0,
  fog: '#a6c2e6', fogSun: '#f2e2c8', fogDensity: 0.00018, fogFalloff: 0.0022,
  cloudLit: '#fff4e4', cloudShade: '#7a96cc',
  exposure: 1.0, saturation: 1.14, contrast: 1.07, lift: '#02040c', gain: '#fffcf6',
  bloom: 0.28, bloomThreshold: 0.88, rim: 0.5, vibrance: 0.22,
};

const NOON: PaletteSpec = {
  zenith: '#1f5cc8', horizon: '#9cc0ec', horizonSun: '#dcebf6', sunDisk: '#ffffff', glow: 0.5,
  belt: 0, beltColor: '#000000', stars: 0,
  key: '#fff4e4', keyI: 1.0, hemiSky: '#a8c8f2', hemiGround: '#b2bccc', hemiI: 1.05,
  fog: '#9cbde6', fogSun: '#e4eef4', fogDensity: 0.00016, fogFalloff: 0.0022,
  cloudLit: '#fff6e6', cloudShade: '#7896cc',
  exposure: 1.0, saturation: 1.15, contrast: 1.08, lift: '#00030a', gain: '#ffffff',
  bloom: 0.25, bloomThreshold: 0.9, rim: 0.42, vibrance: 0.25,
};

const AFTERNOON: PaletteSpec = {
  zenith: '#2260c4', horizon: '#a2c2ea', horizonSun: '#f6e4c4', sunDisk: '#fff8ea', glow: 0.62,
  belt: 0, beltColor: '#000000', stars: 0,
  key: '#ffefd2', keyI: 0.95, hemiSky: '#a8c4ea', hemiGround: '#b8bcc8', hemiI: 1.0,
  fog: '#a2c0e4', fogSun: '#f4deb8', fogDensity: 0.00018, fogFalloff: 0.0022,
  cloudLit: '#ffeed6', cloudShade: '#7a94c8',
  exposure: 1.0, saturation: 1.15, contrast: 1.08, lift: '#02030a', gain: '#fffaf0',
  bloom: 0.28, bloomThreshold: 0.88, rim: 0.5, vibrance: 0.22,
};

// Golden hour is warm light on a blue sky (Robert, 2026-10-18, Q40): the warmth is the sun, its
// side of the horizon and what it lights; the sky, the haze and the shade stay blue.
const GOLDEN: PaletteSpec = {
  zenith: '#2a5cbc', horizon: '#bcd0e6', horizonSun: '#ffb458', sunDisk: '#ffe2a2', glow: 1.0,
  belt: 0.04, beltColor: '#c8a0b8', stars: 0,
  key: '#ffbd74', keyI: 0.8, hemiSky: '#9cb4dc', hemiGround: '#c0b0a0', hemiI: 0.96,
  fog: '#b6c6de', fogSun: '#ffba68', fogDensity: 0.00022, fogFalloff: 0.0022,
  cloudLit: '#ffd8a0', cloudShade: '#7c8cc0',
  exposure: 1.05, saturation: 1.16, contrast: 1.08, lift: '#0a0614', gain: '#fff0dc',
  bloom: 0.45, bloomThreshold: 0.82, rim: 0.9, vibrance: 0.1,
};

const SUNSET: PaletteSpec = {
  zenith: '#2e448a', horizon: '#f0b28a', horizonSun: '#ff7e3e', sunDisk: '#ffb070', glow: 1.25,
  belt: 0.3, beltColor: '#c890b2', stars: 0,
  key: '#ff9456', keyI: 0.52, hemiSky: '#7c82ba', hemiGround: '#aa8c9e', hemiI: 0.92,
  fog: '#b8a0b0', fogSun: '#ff9250', fogDensity: 0.0003, fogFalloff: 0.0022,
  cloudLit: '#ffb27a', cloudShade: '#6e689a',
  exposure: 1.1, saturation: 1.18, contrast: 1.05, lift: '#1c0a28', gain: '#ffe8d4',
  bloom: 0.5, bloomThreshold: 0.78, rim: 0.95, vibrance: 0.02,
};

const SUNDOWN: PaletteSpec = {
  zenith: '#24367c', horizon: '#e68a7c', horizonSun: '#ff7a4a', sunDisk: '#ff7040', glow: 1.1,
  belt: 0.7, beltColor: '#d48cb2', stars: 0.05,
  key: '#d27c74', keyI: 0.3, hemiSky: '#6870ae', hemiGround: '#90789a', hemiI: 1.0,
  fog: '#a0789a', fogSun: '#f08062', fogDensity: 0.0003, fogFalloff: 0.0022,
  cloudLit: '#f2a294', cloudShade: '#5a5892',
  exposure: 1.3, saturation: 1.12, contrast: 1.04, lift: '#180a2c', gain: '#f8e4e8',
  bloom: 0.5, bloomThreshold: 0.75, rim: 0.8, vibrance: 0,
};

const DUSK: PaletteSpec = {
  zenith: '#182a6c', horizon: '#8a7cb2', horizonSun: '#d8808a', sunDisk: '#000000', glow: 0.55,
  belt: 0.45, beltColor: '#b088b4', stars: 0.3,
  key: '#a2a4e0', keyI: 0.2, hemiSky: '#5a68a8', hemiGround: '#5a6290', hemiI: 1.05,
  fog: '#4c5890', fogSun: '#b47888', fogDensity: 0.00028, fogFalloff: 0.0021,
  cloudLit: '#a8aedc', cloudShade: '#303c70',
  exposure: 1.45, saturation: 1.0, contrast: 1.05, lift: '#0a0c2a', gain: '#e8e8ff',
  bloom: 0.52, bloomThreshold: 0.74, rim: 0.78, vibrance: 0,
};

const LATE_DUSK: PaletteSpec = {
  zenith: '#0d1848', horizon: '#334080', horizonSun: '#5a4a86', sunDisk: '#000000', glow: 0.2,
  belt: 0, beltColor: '#000000', stars: 0.8,
  key: '#a6b6ee', keyI: 0.27, hemiSky: '#42528e', hemiGround: '#404c7a', hemiI: 0.9,
  fog: '#26346c', fogSun: '#3e467c', fogDensity: 0.00026, fogFalloff: 0.0021,
  cloudLit: '#7e8cc2', cloudShade: '#1c264e',
  exposure: 1.36, saturation: 0.96, contrast: 1.05, lift: '#060a22', gain: '#dfe6ff',
  bloom: 0.55, bloomThreshold: 0.72, rim: 0.72, vibrance: 0,
};

/** Keyframes by time of day. Must be sorted, start at 0 and end at 1 with matching looks. */
export const KEYFRAMES: { t: number; name: string; spec: PaletteSpec }[] = [
  { t: 0.0, name: 'night', spec: NIGHT },
  { t: 0.19, name: 'night', spec: NIGHT },
  { t: 0.225, name: 'predawn', spec: PREDAWN },
  { t: 0.258, name: 'dawn', spec: DAWN },
  { t: 0.3, name: 'morning gold', spec: MORNING_GOLD },
  { t: 0.36, name: 'morning', spec: MORNING },
  { t: 0.5, name: 'noon', spec: NOON },
  { t: 0.63, name: 'afternoon', spec: AFTERNOON },
  { t: 0.7, name: 'golden hour', spec: GOLDEN },
  { t: 0.737, name: 'sunset', spec: SUNSET },
  { t: 0.757, name: 'sundown', spec: SUNDOWN },
  { t: 0.78, name: 'dusk', spec: DUSK },
  { t: 0.82, name: 'late dusk', spec: LATE_DUSK },
  { t: 0.87, name: 'night', spec: NIGHT },
  { t: 1.0, name: 'night', spec: NIGHT },
];

// ---------------------------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------------------------

export function createPalette(): SkyPalette {
  const p = {} as Record<string, number | Color>;
  for (const k of COLOR_KEYS) p[k] = new Color();
  for (const k of NUMBER_KEYS) p[k] = 0;
  return p as unknown as SkyPalette;
}

/** Linear-space palettes, converted once. */
const RESOLVED: SkyPalette[] = KEYFRAMES.map((k) => {
  const p = createPalette();
  for (const c of COLOR_KEYS) p[c].set(k.spec[c]);
  for (const n of NUMBER_KEYS) p[n] = k.spec[n];
  return p;
});

export function copyPalette(src: SkyPalette, out: SkyPalette): SkyPalette {
  for (const c of COLOR_KEYS) out[c].copy(src[c]);
  for (const n of NUMBER_KEYS) out[n] = src[n];
  return out;
}

export function lerpPalette(a: SkyPalette, b: SkyPalette, t: number, out: SkyPalette): SkyPalette {
  for (const c of COLOR_KEYS) out[c].copy(a[c]).lerp(b[c], t);
  for (const n of NUMBER_KEYS) out[n] = lerp(a[n], b[n], t);
  return out;
}

/** The palette at time of day t (wraps). Segments ease in and out so there are no kinks. */
export function samplePalette(t: number, out: SkyPalette): SkyPalette {
  t = ((t % 1) + 1) % 1;
  let i = 0;
  while (i < KEYFRAMES.length - 2 && KEYFRAMES[i + 1].t <= t) i++;
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[i + 1];
  const u = smoothstep(0, 1, (t - a.t) / Math.max(1e-6, b.t - a.t));
  return lerpPalette(RESOLVED[i], RESOLVED[i + 1], u, out);
}

// ---------------------------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------------------------

/** The slice of the weather state that colors the sky. */
export interface PaletteWeather {
  overcast: number;
  mist: number;
  rain: number;
  /** Extra fog multiplier for the state (breezy air is crisp, < 1). */
  fog: number;
}

const tmp = new Color();
const MIST_TINT = new Color('#dfe6ee');

function luma(c: Color): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/** Pull a color toward a neutral, slightly cool grey of similar brightness. */
function toGrey(c: Color, amount: number, bright = 1): void {
  const l = luma(c) * bright;
  tmp.setRGB(l * 0.97, l * 0.99, l * 1.04);
  c.lerp(tmp, clamp01(amount));
}

/**
 * Modify a time-of-day palette for the weather: overcast greys and flattens the light, mist
 * thickens and whitens the air, rain darkens and wets. Applied in place.
 */
export function applyWeather(p: SkyPalette, w: PaletteWeather): SkyPalette {
  const o = clamp01(w.overcast);
  const m = clamp01(w.mist);
  const r = clamp01(w.rain);
  const day = clamp01(p.keyI / 0.6);

  // Overcast: a grey lid. Skies lose their color, the sun loses its punch, shadows go soft.
  const skyLift = 1 + 0.25 * o * day;
  toGrey(p.zenith, o * 0.78, skyLift);
  toGrey(p.horizon, o * 0.78, skyLift);
  toGrey(p.horizonSun, o * 0.78, skyLift);
  toGrey(p.cloudLit, o * 0.6, 0.86);
  toGrey(p.cloudShade, o * 0.55, 1.1);
  toGrey(p.hemiSky, o * 0.6);
  toGrey(p.fog, o * 0.6);
  toGrey(p.fogSun, o * 0.75);
  toGrey(p.key, o * 0.4);
  p.keyI *= 1 - 0.72 * o;
  // The toon ramp spreads a third of the key light onto faces turned away from it; under a grey
  // lid that light comes from everywhere instead, so the hemisphere takes it over.
  p.hemiI *= 1 + 1.6 * o;
  p.exposure *= 1 + 0.06 * o;
  toGrey(p.hemiGround, o * 0.5, 1.2);
  p.glow *= 1 - 0.85 * o;
  p.sunDisk.multiplyScalar(1 - 0.85 * o);
  p.belt *= 1 - o;
  p.stars *= 1 - o;
  p.saturation *= 1 - 0.3 * o;
  // A grey lid has no vivid colors to lift: vibrance would only tint the grey.
  p.vibrance *= 1 - 0.8 * o;
  p.contrast = 1 + (p.contrast - 1) * (1 - 0.6 * o) - 0.02 * o;
  p.rim *= 1 - 0.45 * o;
  p.bloom *= 1 - 0.3 * o;
  p.fogDensity *= 1 + 0.6 * o;

  // Mist: visibility drops and the air goes milky.
  if (m > 0) {
    // Moonlit mist glows rather than goes murky: never darker than a soft blue-grey.
    tmp.copy(MIST_TINT).multiplyScalar(Math.max(0.16, luma(p.horizon) * 1.25 + 0.05));
    p.fog.lerp(tmp, m * 0.55);
    p.fogSun.lerp(tmp, m * 0.4);
    p.horizon.lerp(p.fog, m * 0.6);
    p.horizonSun.lerp(p.fogSun, m * 0.5);
    p.fogDensity *= 1 + 3.8 * m;
    p.fogFalloff *= 1 - 0.55 * m;
    p.keyI *= 1 - 0.3 * m;
    p.stars *= 1 - m;
    p.contrast *= 1 - 0.08 * m;
    p.saturation *= 1 - 0.12 * m;
    p.vibrance *= 1 - 0.6 * m;
    p.lift.lerp(tmp.copy(p.fog).multiplyScalar(0.06), m * 0.5);
  }

  // Rain: heavier, darker, wetter.
  if (r > 0) {
    p.keyI *= 1 - 0.35 * r;
    p.hemiI *= 1 - 0.14 * r;
    p.exposure *= 1 - 0.05 * r;
    p.fogDensity *= 1 + 0.55 * r;
    p.cloudLit.multiplyScalar(1 - 0.28 * r);
    p.cloudShade.multiplyScalar(1 - 0.18 * r);
    p.zenith.multiplyScalar(1 - 0.35 * r);
    p.horizon.multiplyScalar(1 - 0.3 * r);
    p.horizonSun.multiplyScalar(1 - 0.3 * r);
    p.fog.multiplyScalar(1 - 0.3 * r);
    p.fogSun.multiplyScalar(1 - 0.3 * r);
    p.contrast *= 1 - 0.03 * r;
    p.saturation *= 1 - 0.06 * r;
  }

  p.fogDensity *= w.fog;
  return p;
}
