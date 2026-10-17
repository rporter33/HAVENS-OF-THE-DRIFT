// The Windhaven greeting (gate G4): coming home to Windhaven (landmark 'roost') after time away,
// on foot or landing there, the wyvern greets its rider (the existing 'greet' behaviour: the head
// comes round to them, a nictitating sweep, a burst of tongue flicks). Presentation only.
//
// Arrival is the first moment back inside the Roost's vicinity (its discovery zone) standing on
// the ground: the rider on foot, or the pair landed. The greeting then waits until the wyvern can
// give it (on the ground, settled, near its rider) or gives up after a while.

import type { PlayerMode } from '../core/types';
import { inZone, type DiscoveryZone } from '../progression/discovery';

export const HOME_LANDMARK = 'roost';

export const GREETING = {
  /** Seconds outside the vicinity before coming back counts as an arrival. */
  awayTime: 8,
  /** Seconds after touchdown before a landed greeting (the landing crouch first). */
  landSettle: 0.6,
  /** On foot: the wyvern must be standing within this distance (m) of its rider. */
  footRange: 20,
  /** Seconds an arrival waits for the wyvern to be able to greet before it lapses. */
  patience: 15,
} as const;

export type GreetingKind = 'foot' | 'landing';

/** What the greeting reads each rendered frame. */
export interface GreetingSample {
  mode: PlayerMode;
  /** The rider (on foot: between the feet; mounted: the seat). */
  x: number;
  y: number;
  z: number;
  /** Seconds since the mode last changed. */
  modeTime: number;
  /** The wyvern stands on the ground, idle (not walking over, hopping or swooping). */
  wyvernSettled: boolean;
  /** Horizontal distance from the rider to the wyvern (m). */
  wyvernDistance: number;
}

export class RoostGreeting {
  /** Been away long enough that coming back is an arrival. Starts false: a new session begins home. */
  away = false;
  private outside = 0;
  private pending: GreetingKind | null = null;
  private waited = 0;
  /** Greetings given (for tests and captures). */
  count = 0;

  constructor(private readonly zone: DiscoveryZone) {}

  /** Back to "home, nothing pending" (new game, reset). */
  clear(): void {
    this.away = false;
    this.outside = 0;
    this.pending = null;
    this.waited = 0;
  }

  /** Advance by dt; returns the greeting to play this frame, if any. */
  update(dt: number, s: GreetingSample): GreetingKind | null {
    if (!inZone(this.zone, s.x, s.y, s.z)) {
      this.outside += dt;
      if (this.outside >= GREETING.awayTime) this.away = true;
      this.pending = null;
      return null;
    }
    this.outside = 0;
    if (this.away && !this.pending) {
      const kind: GreetingKind | null = s.mode === 'onFoot' ? 'foot' : s.mode === 'landed' ? 'landing' : null;
      if (kind) {
        this.pending = kind;
        this.waited = 0;
        this.away = false;
      }
    }
    if (!this.pending) return null;
    this.waited += dt;
    const kind = this.pending;
    // Took off again, or the wait ran out: the moment has passed.
    if (s.mode === 'flying' || this.waited > GREETING.patience) {
      this.pending = null;
      return null;
    }
    // (Landed and straight off the saddle, the greeting waits for the wyvern beside them instead.)
    const ready =
      (s.mode === 'landed' && s.modeTime >= GREETING.landSettle && s.wyvernSettled) ||
      (s.mode === 'onFoot' && s.wyvernSettled && s.wyvernDistance <= GREETING.footRange);
    if (!ready) return null;
    this.pending = null;
    this.count++;
    return kind;
  }
}
