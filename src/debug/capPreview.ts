// Debug-only preview of two G5 capabilities, for playtesting the capability sites before G5
// exists (decision Q34; values from docs/design/CAPABILITIES.md). Enabled only by the URL switch
// ?capPreview=steep,snap and never reachable in normal play:
//
//   steep  every breed's landing slope limit becomes cos 53° (today 0.65, 49.5°)
//   snap   a double-tap of roll (the stick or key pushed past 0.6 twice the same way within
//          0.3 s) gives a 0.6 s burst of roll rate and roll authority × 1.6; a short rumble marks it
//
// A preview session never saves: progress, race records, ghosts and bond memory stay as they were,
// so nothing earned with a capability that doesn't exist yet reaches the real save.

import type { BreedStats, FlightInput } from '../core/types';
import { GAIT_PROFILES } from '../core/gait';
import { BREED_ORDER } from '../flight/breeds';
import type { Game } from '../game/Game';

export interface CapPreviewFlags {
  steep: boolean;
  snap: boolean;
}

export const PREVIEW = {
  landNormalY: Math.cos((53 * Math.PI) / 180),
  snapMultiplier: 1.6,
  snapDuration: 0.6,
  /** Seconds between the two taps, and how far the stick must go (and come back) for a tap. */
  tapWindow: 0.3,
  tapOn: 0.6,
  tapOff: 0.3,
} as const;

export function parseCapPreview(value: string | null): CapPreviewFlags | undefined {
  if (!value) return undefined;
  const parts = value.split(',').map((s) => s.trim());
  const flags = { steep: parts.includes('steep'), snap: parts.includes('snap') };
  return flags.steep || flags.snap ? flags : undefined;
}

export class CapabilityPreview {
  /** Seconds left in the current snap burst (0: none). */
  burst = 0;
  /** Bursts fired this session (for automation). */
  bursts = 0;
  private lastTap = { dir: 0, time: -Infinity };
  private armed = true;
  private clock = 0;
  private boosted: BreedStats | null = null;

  constructor(
    private readonly game: Game,
    readonly flags: CapPreviewFlags,
  ) {
    if (flags.steep) for (const id of BREED_ORDER) GAIT_PROFILES[id].landNormalY = PREVIEW.landNormalY;
    // Nothing from a preview session reaches the real save.
    game.save.save = () => {};
    game.save.putGhost = async () => {};
    game.bond.store.save = () => {};
    const names = [flags.steep ? 'steep landing' : '', flags.snap ? 'snap-roll (double-tap roll)' : ''].filter(Boolean).join(', ');
    game.events.emit('toast', { text: `Capability preview: ${names}`, sub: 'Debug only. This session saves nothing.', icon: 'info' });
  }

  /** Once per rendered frame, before the fixed steps, with the input the simulation will see. */
  update(dt: number, input: { flight: FlightInput }): void {
    this.clock += dt;
    if (!this.flags.snap) return;
    const player = this.game.player;
    const roll = player.mode === 'flying' ? input.flight.roll : 0;
    const mag = Math.abs(roll);
    if (this.armed && mag >= PREVIEW.tapOn) {
      this.armed = false;
      const dir = Math.sign(roll);
      if (dir === this.lastTap.dir && this.clock - this.lastTap.time <= PREVIEW.tapWindow) {
        this.burst = PREVIEW.snapDuration;
        this.bursts++;
        this.lastTap.dir = 0;
        this.game.input.rumble(0.35, 0.6, 140);
      } else this.lastTap = { dir, time: this.clock };
    } else if (mag <= PREVIEW.tapOff) this.armed = true;

    const model = player.model;
    if (this.burst > 0 && player.mode === 'flying') {
      // Rebuilt when the breed changes; the flight model reads both numbers every step.
      if (!this.boosted || this.boosted.id !== player.breed.id) {
        const b = player.breed;
        this.boosted = { ...b, maxRollRate: b.maxRollRate * PREVIEW.snapMultiplier, rollAuthority: b.rollAuthority * PREVIEW.snapMultiplier };
      }
      model.breed = this.boosted;
      this.burst = Math.max(0, this.burst - dt);
    } else {
      this.burst = 0;
      if (model.breed !== player.breed) model.breed = player.breed;
    }
  }
}
