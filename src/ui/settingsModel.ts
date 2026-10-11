// The settings screen as data: which rows each tab has, their ranges and labels, and how a
// left/right press changes a value. Pure, unit-tested; SettingsMenu renders it.

import type { QualityLevel, Settings } from '../core/types';
import type { QualityProfile } from '../render/quality';
import { percent } from './format';

type KeysOfType<T, V> = { [K in keyof T]-?: NonNullable<T[K]> extends V ? K : never }[keyof T];

export interface ChoiceRow<K extends keyof Settings = keyof Settings> {
  kind: 'choice';
  key: K;
  label: string;
  help: string;
  options: readonly { value: Settings[K]; label: string }[];
}

export interface SliderRow {
  kind: 'slider';
  key: KeysOfType<Settings, number>;
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
  format(v: number): string;
}

export interface ToggleRow {
  kind: 'toggle';
  key: KeysOfType<Settings, boolean>;
  label: string;
  help: string;
  /** An optional setting that, while absent, follows this one (per-device inverts → invertPitch). */
  fallback?: KeysOfType<Settings, boolean>;
}

export interface ActionRow {
  kind: 'action';
  id: 'resetProgress' | 'replayTips';
  label: string;
  help: string;
}

export type SettingRow = ChoiceRow | SliderRow | ToggleRow | ActionRow;

export interface SettingsTab {
  id: string;
  label: string;
  rows: SettingRow[];
}

const QUALITY: { value: QualityLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'ultra', label: 'Ultra' },
];

const TIME_OF_DAY: { value: Settings['timeOfDay']; label: string }[] = [
  { value: 'cycle', label: 'Day & night cycle' },
  { value: 'dawn', label: 'Always dawn' },
  { value: 'day', label: 'Always day' },
  { value: 'dusk', label: 'Always dusk' },
  { value: 'night', label: 'Always night' },
];

export const SETTINGS_TABS: SettingsTab[] = [
  {
    id: 'graphics',
    label: 'Graphics',
    rows: [
      { kind: 'choice', key: 'quality', label: 'Quality', help: 'Draw distance, shadows, grass density and post effects.', options: QUALITY } as ChoiceRow,
      {
        kind: 'slider', key: 'resolutionScale', label: 'Resolution scale', help: 'Render below native resolution for a smoother frame rate.',
        min: 0.5, max: 1, step: 0.05, format: percent,
      },
    ],
  },
  {
    id: 'camera',
    label: 'Camera',
    rows: [
      {
        kind: 'slider', key: 'fov', label: 'Field of view', help: 'Vertical field of view. Wider feels faster.',
        min: 50, max: 90, step: 1, format: (v) => `${Math.round(v)}°`,
      },
      {
        kind: 'slider', key: 'lookSensitivity', label: 'Look sensitivity', help: 'Right stick and mouse look speed.',
        min: 0.25, max: 2, step: 0.05, format: (v) => `${v.toFixed(2)}×`,
      },
      // Per device: plenty of players fly a pad one way and the keys the other. Until set, both
      // follow the older single setting (invertPitch).
      {
        kind: 'toggle', key: 'invertPitchPad', fallback: 'invertPitch', label: 'Invert pitch — controller',
        help: 'Push the stick forward to climb, pull back to dive.',
      },
      {
        kind: 'toggle', key: 'invertPitchKeys', fallback: 'invertPitch', label: 'Invert pitch — keyboard & mouse',
        help: 'W climbs and S dives (mouse steering follows).',
      },
      { kind: 'toggle', key: 'invertLookY', label: 'Invert camera Y', help: 'Push the stick up, or move the mouse up, to look down.' },
      {
        kind: 'toggle', key: 'mouseFlight', label: 'Mouse steering (hold middle button to look)',
        help: 'Keyboard & mouse: with the mouse captured in flight, it banks and pitches the wyvern.',
      },
    ],
  },
  {
    id: 'gameplay',
    label: 'Gameplay',
    rows: [
      { kind: 'toggle', key: 'holdToFlap', label: 'Hold to flap', help: 'On: hold to keep beating. Off: one beat per press.' },
      { kind: 'toggle', key: 'windlineToggle', label: 'Toggle Windline', help: 'On: press to cast, press again to release. Off: hold to retain, release to detach. Changing this releases the current line.' },
      { kind: 'toggle', key: 'showGhost', label: 'Race ghost', help: 'Race against a ghost of your best run.' },
      {
        kind: 'toggle', key: 'showControlHints', label: 'Show tips',
        help: 'First-flight lessons and flying hints like “Flare to land”. Interaction prompts always show.',
      },
      { kind: 'action', id: 'replayTips', label: 'Replay tips', help: 'Show the first-flight lessons again, from the start.' },
      { kind: 'choice', key: 'timeOfDay', label: 'Time of day', help: 'Let the sun cross the sky, or hold it at your favourite hour.', options: TIME_OF_DAY } as ChoiceRow,
      {
        kind: 'slider', key: 'dayLengthMinutes', label: 'Day length', help: 'Real minutes for one full day and night.',
        min: 6, max: 60, step: 2, format: (v) => `${Math.round(v)} min`,
      },
      { kind: 'action', id: 'resetProgress', label: 'Erase progress', help: 'Forget collectibles, medals and unlocks. Settings are kept.' },
    ],
  },
  {
    id: 'audio',
    label: 'Audio',
    rows: [
      { kind: 'slider', key: 'masterVolume', label: 'Master volume', help: 'Everything.', min: 0, max: 1, step: 0.05, format: percent },
      { kind: 'slider', key: 'musicVolume', label: 'Music', help: 'The score.', min: 0, max: 1, step: 0.05, format: percent },
      { kind: 'slider', key: 'sfxVolume', label: 'Effects', help: 'Wind, wings, footsteps and menus.', min: 0, max: 1, step: 0.05, format: percent },
    ],
  },
  {
    id: 'access',
    label: 'Accessibility',
    rows: [
      { kind: 'toggle', key: 'reducedMotion', label: 'Reduced motion', help: 'No camera shake, speed blur, FOV kicks or menu animation.' },
      { kind: 'toggle', key: 'rumble', label: 'Controller rumble', help: 'Vibration on wingbeats, landings and impacts.' },
    ],
  },
];

/** A toggle's effective value: the setting, else what it follows, else off. */
export function toggleValue(s: Settings, row: Pick<ToggleRow, 'key' | 'fallback'>): boolean {
  return !!(s[row.key] ?? (row.fallback ? s[row.fallback] : false));
}

/** Step a slider by one notch (dir −1/+1), snapped to the grid and clamped. */
export function stepSlider(v: number, row: Pick<SliderRow, 'min' | 'max' | 'step'>, dir: number): number {
  const n = Math.round((v - row.min) / row.step) + Math.sign(dir);
  const out = row.min + n * row.step;
  // Round away float noise (0.1 + 0.2) so stored settings stay tidy.
  return Math.min(row.max, Math.max(row.min, Math.round(out * 1000) / 1000));
}

/** Fraction 0..1 of a slider value, for drawing the fill. */
export function sliderFraction(v: number, row: Pick<SliderRow, 'min' | 'max'>): number {
  return Math.min(1, Math.max(0, (v - row.min) / (row.max - row.min)));
}

/** Value at a 0..1 position along the track (mouse click / drag), snapped. */
export function sliderValueAt(f: number, row: Pick<SliderRow, 'min' | 'max' | 'step'>): number {
  const raw = row.min + Math.min(1, Math.max(0, f)) * (row.max - row.min);
  const n = Math.round((raw - row.min) / row.step);
  return Math.min(row.max, Math.max(row.min, Math.round((row.min + n * row.step) * 1000) / 1000));
}

/**
 * Next / previous option of a choice row. Left/right clamp at the ends (the ends mean something:
 * lowest, highest); pressing A on the row cycles with wrap.
 */
export function cycleChoice<T>(value: T, options: readonly { value: T }[], dir: number, wrap = false): T {
  const n = options.length;
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  const raw = i + Math.sign(dir);
  const j = wrap ? ((raw % n) + n) % n : Math.min(n - 1, Math.max(0, raw));
  return options[j].value;
}

/** What a quality level draws, as short label/value pairs for the Graphics tab. */
export function qualityFacts(q: QualityProfile): { label: string; value: string }[] {
  const lush = (d: number) => (d < 0.4 ? 'Sparse' : d < 0.8 ? 'Medium' : d < 1.2 ? 'Lush' : 'Very lush');
  return [
    { label: 'View distance', value: `${(q.drawDistance / 1000).toFixed(1)} km` },
    { label: 'Shadows', value: q.shadows ? `${q.shadowMapSize} px` : 'Off' },
    { label: 'Grass', value: q.grassDensity <= 0 ? 'Off' : `${lush(q.grassDensity)} · ${q.grassRadius} m` },
    { label: 'Trees & flowers', value: `${Math.round(q.propDensity * 100)}%` },
    { label: 'Anti-aliasing', value: q.msaa > 0 ? `${q.msaa}× MSAA` : 'Off' },
    { label: 'Bloom', value: q.bloom ? 'On' : 'Off' },
    { label: 'Clouds', value: ['Simple', 'Soft', 'Full'][Math.max(0, Math.min(2, q.clouds))] },
    { label: 'Particles', value: `${Math.round(q.particles * 100)}%` },
  ];
}
