import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../game/settings';
import { QUALITY } from '../render/quality';
import { SETTINGS_TABS, cycleChoice, qualityFacts, sliderFraction, sliderValueAt, stepSlider, toggleValue } from './settingsModel';

describe('settings rows', () => {
  it('cover every setting exactly once (a setting others follow counts as covered)', () => {
    const rows = SETTINGS_TABS.flatMap((t) => t.rows);
    const keys = rows.flatMap((r) => (r.kind === 'action' ? [] : [r.key]));
    expect(new Set(keys).size).toBe(keys.length);
    const covered = new Set([...keys, ...rows.flatMap((r) => (r.kind === 'toggle' && r.fallback ? [r.fallback] : []))]);
    const optional = ['invertPitchPad', 'invertPitchKeys', 'invertLookY', 'mouseFlight'];
    // Bookkeeping the menu never shows (lensRev: which default lens the settings were made under).
    const internal = ['lensRev'];
    expect(covered).toEqual(new Set([...Object.keys(DEFAULT_SETTINGS).filter((k) => !internal.includes(k)), ...optional]));
  });
  it('per-device inverts follow the single invert until set', () => {
    const row = SETTINGS_TABS.flatMap((t) => t.rows).find((r) => r.kind === 'toggle' && r.key === 'invertPitchPad');
    expect(row?.kind).toBe('toggle');
    if (row?.kind !== 'toggle') return;
    expect(toggleValue({ ...DEFAULT_SETTINGS, invertPitch: true }, row)).toBe(true);
    expect(toggleValue({ ...DEFAULT_SETTINGS, invertPitch: true, invertPitchPad: false }, row)).toBe(false);
    expect(toggleValue({ ...DEFAULT_SETTINGS }, { key: 'mouseFlight' })).toBe(false);
  });
  it('slider ranges contain the defaults', () => {
    for (const row of SETTINGS_TABS.flatMap((t) => t.rows)) {
      if (row.kind !== 'slider') continue;
      const v = DEFAULT_SETTINGS[row.key] as number;
      expect(v).toBeGreaterThanOrEqual(row.min);
      expect(v).toBeLessThanOrEqual(row.max);
    }
  });
});

describe('stepSlider', () => {
  const row = { min: 0, max: 1, step: 0.05 };
  it('steps on the grid without float noise', () => {
    expect(stepSlider(0.1, row, 1)).toBe(0.15);
    expect(stepSlider(0.3, row, -1)).toBe(0.25);
  });
  it('snaps off-grid values and clamps at the ends', () => {
    expect(stepSlider(0.12, row, 1)).toBe(0.15);
    expect(stepSlider(1, row, 1)).toBe(1);
    expect(stepSlider(0, row, -1)).toBe(0);
  });
  it('maps track positions to snapped values and back', () => {
    const fov = { min: 50, max: 90, step: 1 };
    expect(sliderValueAt(0.5, fov)).toBe(70);
    expect(sliderValueAt(1.4, fov)).toBe(90);
    expect(sliderFraction(70, fov)).toBeCloseTo(0.5);
  });
});

describe('cycleChoice', () => {
  const opts = [{ value: 'low' }, { value: 'medium' }, { value: 'high' }];
  it('clamps on left/right', () => {
    expect(cycleChoice('high', opts, 1)).toBe('high');
    expect(cycleChoice('low', opts, -1)).toBe('low');
    expect(cycleChoice('medium', opts, 1)).toBe('high');
  });
  it('wraps when asked (A on the row)', () => {
    expect(cycleChoice('high', opts, 1, true)).toBe('low');
    expect(cycleChoice('low', opts, -1, true)).toBe('high');
  });
});

describe('qualityFacts', () => {
  it('summarises each level', () => {
    const low = Object.fromEntries(qualityFacts(QUALITY.low).map((f) => [f.label, f.value]));
    expect(low['Shadows']).toBe('Off');
    expect(low['Anti-aliasing']).toBe('Off');
    const high = Object.fromEntries(qualityFacts(QUALITY.high).map((f) => [f.label, f.value]));
    expect(high['View distance']).toBe('7.0 km');
    expect(high['Grass']).toBe('Very lush · 180 m');
  });
});
