// Bond expression v1 (gate G4): the Windhaven greeting and the anticipatory lean, wired to the
// player's poses. Runs once per rendered frame between Player.update and Wyvern.update, reads the
// interpolated poses and writes only presentation channels (WyvernPose.anticipate, the greeting's
// look target, the wyvern's 'greet' cue). No meters, no HUD, no flight-model input.

import { Vector3 } from 'three';
import type { Player } from '../player/Player';
import type { WyvernCueKind } from '../core/types';
import { smoothstep } from '../core/math';
import type { WorldLayout } from '../world/layout';
import { discoveryZones } from '../progression/discovery';
import { Anticipation } from './anticipation';
import { HOME_LANDMARK, RoostGreeting, type GreetingKind } from './greeting';
import { BondStore } from './memory';

/** Seconds the greeting holds the head's look on the rider (the life layer's greeting length). */
const GREET_LOOK = 3.8;
/**
 * A frame that moves the wyvern further than this (m) is a teleport (the animator's own test): the
 * pass in progress is void, and a greeting waits STEADY s so the animator's reset can't swallow it.
 */
const TELEPORT = 40;
const STEADY = 0.1;

const _head = new Vector3();

export class Bond {
  readonly store: BondStore;
  readonly anticipation: Anticipation;
  readonly greeting: RoostGreeting;
  /** The last greeting played, and seconds since (Infinity before the first). */
  lastGreeting: GreetingKind | null = null;
  sinceGreeting = Infinity;
  private readonly lastPos = new Vector3();
  private hasLast = false;
  /** Seconds since the last teleport. */
  private steady = 0;

  constructor(layout: WorldLayout, store = new BondStore()) {
    this.store = store;
    const zones = discoveryZones(layout);
    this.anticipation = new Anticipation(zones, () => this.store.data);
    const home = zones.find((z) => z.landmarkId === HOME_LANDMARK);
    if (!home) throw new Error(`Bond: no '${HOME_LANDMARK}' landmark in the layout`);
    this.greeting = new RoostGreeting(home);
  }

  /** New game or a progress reset: the wyvern starts over, at home. */
  reset(): void {
    this.store.reset();
    this.anticipation.clear();
    this.greeting.clear();
    this.hasLast = false;
  }

  /**
   * One rendered frame. `active` is false off the play screen (title, menus, the stable): nothing
   * is learned or expressed then. `cue` plays a one-shot behaviour on the wyvern model.
   */
  update(dt: number, player: Player, active: boolean, cue: (kind: WyvernCueKind) => void): void {
    const wp = player.wyvernPose;
    if (!active) {
      this.anticipation.clear();
      wp.anticipate = 0;
      this.hasLast = false;
      this.steady = 0;
      return;
    }
    if (this.hasLast && this.lastPos.distanceToSquared(wp.position) > TELEPORT * TELEPORT) {
      this.anticipation.clear();
      this.steady = 0;
    } else this.steady += dt;
    this.lastPos.copy(wp.position);
    this.hasLast = true;

    const flying = player.mode === 'flying';
    const v = wp.velocity;
    const changed = this.anticipation.update(dt, {
      flying,
      x: wp.position.x, y: wp.position.y, z: wp.position.z,
      vx: v.x, vy: v.y, vz: v.z,
      roll: flying ? (wp.control?.roll ?? 0) : 0,
    });
    if (changed) this.store.save();
    wp.anticipate = this.anticipation.value;

    const r = player.riderPosition;
    const settled = this.steady >= STEADY && !wp.airborne && wp.groundSpeed < 0.5 && (player.mode !== 'onFoot' || player.companion.state === 'idle');
    const greet = this.greeting.update(dt, {
      mode: player.mode,
      x: r.x, y: r.y, z: r.z,
      modeTime: player.modeTime,
      wyvernSettled: settled,
      wyvernDistance: player.wyvernDistance,
    });
    if (greet) {
      this.lastGreeting = greet;
      this.sinceGreeting = 0;
      cue('greet');
    } else this.sinceGreeting += dt;

    // While greeting, the head comes round to the rider (mounted, back over the shoulder).
    if (this.sinceGreeting < GREET_LOOK && !wp.airborne) {
      const t = this.sinceGreeting;
      const w = smoothstep(0, 0.3, t) * (1 - smoothstep(GREET_LOOK - 0.5, GREET_LOOK, t));
      _head.copy(r).y += player.riderPose.mounted ? 0.8 : 1.6;
      wp.lookTarget.lerp(_head, w);
    }
  }
}
