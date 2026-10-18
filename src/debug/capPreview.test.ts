// The capability-site playtest preview (?capPreview=steep,snap): parsing, the double-tap snap
// burst, the steep landing limit, and that a preview session saves nothing.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CapabilityPreview, PREVIEW, parseCapPreview } from './capPreview';
import { BREEDS, BREED_ORDER } from '../flight/breeds';
import { GAIT_PROFILES } from '../core/gait';
import { slopeLimitY } from '../player/ground';
import type { Game } from '../game/Game';
import type { FlightInput } from '../core/types';

function fakeGame() {
  const breed = BREEDS.harrier;
  const game = {
    save: { save: vi.fn(), putGhost: vi.fn(async () => {}) },
    bond: { store: { save: vi.fn() } },
    events: { emit: vi.fn() },
    input: { rumble: vi.fn() },
    player: { mode: 'flying', breed, model: { breed } },
  };
  return game;
}

const flight = (roll: number): { flight: FlightInput } => ({ flight: { pitch: 0, roll, yaw: 0, flap: 0, tuck: 0, flare: 0 } });

/** Feed a roll stick sequence, one value per 1/60 s frame. */
function feed(p: CapabilityPreview, rolls: number[]): void {
  for (const r of rolls) p.update(1 / 60, flight(r));
}
const hold = (v: number, frames: number) => Array<number>(frames).fill(v);

afterEach(() => {
  for (const id of BREED_ORDER) delete GAIT_PROFILES[id].landNormalY;
});

describe('capability preview', () => {
  it('parses only the known flags', () => {
    expect(parseCapPreview(null)).toBeUndefined();
    expect(parseCapPreview('nothing')).toBeUndefined();
    expect(parseCapPreview('steep')).toEqual({ steep: true, snap: false });
    expect(parseCapPreview('snap, steep')).toEqual({ steep: true, snap: true });
  });

  it('a double-tap of roll the same way gives a 0.6 s burst at × 1.6, then restores the breed', () => {
    const g = fakeGame();
    const p = new CapabilityPreview(g as unknown as Game, { steep: false, snap: true });
    feed(p, [...hold(1, 4), ...hold(0, 4), ...hold(1, 2)]);
    expect(p.bursts).toBe(1);
    expect(g.input.rumble).toHaveBeenCalledOnce();
    expect(g.player.model.breed.maxRollRate).toBeCloseTo(BREEDS.harrier.maxRollRate * PREVIEW.snapMultiplier, 9);
    expect(g.player.model.breed.rollAuthority).toBeCloseTo(BREEDS.harrier.rollAuthority * PREVIEW.snapMultiplier, 9);
    feed(p, hold(1, Math.ceil(PREVIEW.snapDuration * 60) + 2));
    expect(g.player.model.breed).toBe(BREEDS.harrier);
  });

  it('ignores a single tap, taps the other way, slow taps and the ground', () => {
    const g = fakeGame();
    const p = new CapabilityPreview(g as unknown as Game, { steep: false, snap: true });
    feed(p, [...hold(1, 4), ...hold(0, 30)]);
    feed(p, [...hold(1, 4), ...hold(0, 4), ...hold(-1, 4), ...hold(0, 30)]);
    feed(p, [...hold(-1, 4), ...hold(0, 30), ...hold(-1, 4)]);
    g.player.mode = 'landed';
    feed(p, [...hold(1, 4), ...hold(0, 4), ...hold(1, 4)]);
    expect(p.bursts).toBe(0);
    expect(g.player.model.breed).toBe(BREEDS.harrier);
  });

  it('steep: every breed lands on up to 53°', () => {
    new CapabilityPreview(fakeGame() as unknown as Game, { steep: true, snap: false });
    for (const id of BREED_ORDER) expect(slopeLimitY(id, 'land')).toBeCloseTo(Math.cos((53 * Math.PI) / 180), 9);
  });

  it('a preview session saves nothing, and says so', () => {
    const g = fakeGame();
    const save = g.save.save;
    const bondSave = g.bond.store.save;
    new CapabilityPreview(g as unknown as Game, { steep: true, snap: true });
    (g.save.save as () => void)();
    (g.bond.store.save as () => void)();
    expect(save).not.toHaveBeenCalled();
    expect(bondSave).not.toHaveBeenCalled();
    expect(g.events.emit).toHaveBeenCalledWith('toast', expect.objectContaining({ sub: expect.stringContaining('saves nothing') }));
  });
});
