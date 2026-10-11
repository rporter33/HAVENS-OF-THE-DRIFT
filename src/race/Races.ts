// Races: ring courses and sprints, timing, medals and ghosts.
//
// Flow: a deliberate approach to a start gate arms its race (raceArmed; the HUD shows its name):
// airborne a while (never straight off a launch, a catch or a respawn), lined up with the gate's
// axis, aimed at its opening, close and at flying speed. Crossing the gate starts the clock
// (raceStart); missing the opening, turning away or landing stands the race down
// (raceDisarmed, with a reason). Rings must be flown through in order (ringPassed with split and
// delta vs the best run, or ringMissed when one is passed by), and the last ring or a sprint's
// finish beacon ends it (raceFinish, a RaceRecord, unlocks). begin() from the menu puts the
// player on a rolling start before the gate, high enough for its breed and clear of the world.
// Respawning, dismounting, changing breed or wandering far off course aborts (raceAbort, with a
// reason); restart() then tries the same race again for a little while.
//
// A record always holds the breed (and look) the run was flown with, captured at the gate.
// Erasing progress (the save document is swapped) drops the best time and ghost in hand.
//
// Timing runs in fixedUpdate at the physics rate with sub-step precision (the swept test
// reports where in the step a plane was crossed). The best run's ghost flies alongside.

import { Vector3, type PerspectiveCamera, type Scene } from 'three';
import type { GameEventBus } from '../core/events';
import type { BreedId, Collider, GameEvents, RiderLook, Settings, TerrainQuery, WyvernLook } from '../core/types';
import type { CameraSystem, GhostRecording, PlayerSystem, RaceDef, RaceSystem, SaveData, SaveStore } from '../game/contracts';
import type { QualityProfile } from '../render/quality';
import { DEG } from '../core/math';
import { COURSES } from './courses';
import { GATE_HALF_HEIGHT, GATE_HALF_WIDTH, gateRing, medalFor, RACE_START } from './courseMath';
import { missRadiusFor, ringGeom, ringSide, sweepGate, sweepRing, type RingGeom } from './ringMath';
import { createGhostSample, ghostDuration, GHOST_RATE, GhostRecorder, sampleGhost } from './ghost';
import { raceStartPosition } from './flyCourse';
import { bestMedal, grantUnlocks } from '../progression/unlocks';
import { RaceVisuals } from './RaceVisuals';
import { RaceGhost } from './RaceGhost';
import { courseColors, gateColliders } from './gateMesh';

export type RaceAbortReason = GameEvents['raceAbort']['reason'];
export type RaceDisarmReason = NonNullable<GameEvents['raceDisarmed']['reason']>;

/**
 * Arming takes a deliberate approach, so exploring (a takeoff from the launch deck, a glide past a
 * gate) never starts a race by accident. All must hold:
 */
export const ARMING = {
  /** Within this distance of the gate's center (m)... */
  distance: 200,
  /** ...and at least this far before its plane (m), so the countdown has time to run. */
  minLead: 15,
  /** Heading (horizontal) within this angle of the gate's axis (degrees). */
  headingDeg: 25,
  /** Aimed at it: the current line crosses the gate's plane within the opening plus this (m). */
  aimMargin: 20,
  /** At flying speed (m/s). */
  minSpeed: 12,
  /** Airborne at least this long since the last takeoff, catch or respawn (s). */
  airborne: 6,
} as const;
/** An armed race stands down beyond this distance (m)... */
const DISARM_DISTANCE = 340;
/** ...or after flying away from the gate for this long (s). */
const DISARM_AWAY_SECONDS = 2.5;
/** After a race stands down or is abandoned, restart() tries it again for this long (s). */
const RETRY_WINDOW = 20;
/** How long the result stays up before the race goes idle (s). */
const FINISHED_HOLD = 8;
/** Abort when this far from the next ring for this long. */
const LEFT_COURSE_DISTANCE = { rings: 1400, sprint: 3200 } as const;
const LEFT_COURSE_SECONDS = 4;

export interface RacesDeps {
  scene: Scene;
  events: GameEventBus;
  save: SaveStore & { data: SaveData };
  player: PlayerSystem;
  quality: QualityProfile;
  settings: () => Settings;
  /** Snapped after a teleport to the start (it also snaps on its own for big jumps). */
  camera?: CameraSystem;
  /** Keeps begin()'s rolling start clear of rock, trees and buildings. */
  terrain?: Pick<TerrainQuery, 'distance'>;
  defs?: RaceDef[];
}

const _p = new Vector3();
const _v = new Vector3();

/** Where the player is: the rider on foot (the wyvern may be waiting far off), else the wyvern. */
function focusOf(player: PlayerSystem): Vector3 {
  return player.mode === 'onFoot' || player.mode === 'falling' || player.mode === 'traversing' ? player.riderPosition : player.position;
}

export class Races implements RaceSystem {
  readonly defs: RaceDef[];
  activeId: string | null = null;
  state: 'idle' | 'countdown' | 'running' | 'finished' = 'idle';
  elapsedMs = 0;
  nextRingIndex = 0;
  bestMs: number | null = null;
  lastDeltaMs: number | null = null;
  /** Race time at each ring of the current run (ms). */
  readonly splits: number[] = [];
  /** The last finish (for the results screen). */
  lastResult: { raceId: string; timeMs: number; medal: string; newBest: boolean } | null = null;
  /**
   * Solid parts of every start gate (pillars, the rocks under them, the lintel). Static: Game
   * registers it as a collider source on the terrain.
   */
  readonly colliders: readonly Collider[];

  private deps: RacesDeps;
  private gates: RingGeom[];
  private rings: RingGeom[][];
  private active: RaceDef | null = null;
  private visuals: RaceVisuals;
  private recorder = new GhostRecorder();
  private stepCount = 0;
  private bestGhost: GhostRecording | null = null;
  private ghostRequest = 0;
  private ghost: RaceGhost;
  private ghostSample = createGhostSample();
  private showGhost: boolean;
  private countdownShown = 4;
  private missedAt = -1;
  private offCourseTime = 0;
  private finishedTime = 0;
  private armCheck = 0;
  /** Seconds flying since the last takeoff, catch or respawn. */
  private airTime = 0;
  /** Seconds an armed race has been flown away from. */
  private awayTime = 0;
  /** What the run is flown with, captured at the gate. */
  private runBreed: BreedId | null = null;
  private runLook: WyvernLook | null = null;
  private runRider: RiderLook | null = null;
  /**
   * The race restart() tries again after a stand-down or an abort, and the seconds left to do so
   * (a countdown, not a session clock: nothing here grows without bound).
   */
  private retry: { id: string; left: number } | null = null;
  /** The save document this state belongs to (a reset swaps it). */
  private saveData: SaveData;

  constructor(deps: RacesDeps) {
    this.deps = deps;
    this.defs = deps.defs ?? COURSES;
    this.gates = this.defs.map((d) => gateRing(d));
    this.rings = this.defs.map((d) => d.rings.map(ringGeom));
    this.colliders = this.defs.flatMap((d) => gateColliders(d));
    this.showGhost = deps.settings().showGhost;
    this.saveData = deps.save.data;
    this.visuals = new RaceVisuals(deps.scene, this.defs, deps.quality);
    this.ghost = new RaceGhost(deps.scene, deps.quality, deps.save.data.wyvern);
    deps.events.on('respawn', () => {
      this.airTime = 0;
      if (this.activeId && this.state === 'running') this.abort('respawn');
      else if (this.activeId && this.state === 'countdown') this.disarm('respawn');
    });
    deps.events.on('takeoff', () => (this.airTime = 0));
    deps.events.on('caught', () => (this.airTime = 0));
  }

  // --- Queries ----------------------------------------------------------------------------------

  waypoint(out: Vector3): Vector3 | null {
    const d = this.active;
    if (d && this.state === 'countdown') return out.fromArray(d.start.position);
    if (d && this.state === 'running') return out.fromArray(d.rings[this.nextRingIndex].position);
    if (this.state === 'idle') {
      const near = this.nearestStart(focusOf(this.deps.player), 900);
      return near ? out.fromArray(near.start.position) : null;
    }
    return null;
  }

  nearbyStart(p: Vector3): RaceDef | null {
    return this.nearestStart(p, 250);
  }

  private nearestStart(p: Vector3, range: number): RaceDef | null {
    let best: RaceDef | null = null;
    let bestD = range;
    for (const d of this.defs) {
      const dist = _p.fromArray(d.start.position).distanceTo(p);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best;
  }

  /** Seconds the best ghost has been recorded for (0 without one). */
  get ghostSeconds(): number {
    return this.bestGhost ? ghostDuration(this.bestGhost) : 0;
  }

  /**
   * The race restart() would begin again when none is active: the one that just stood down at
   * its gate or was abandoned, for RETRY_WINDOW seconds. Null otherwise.
   */
  get retryId(): string | null {
    return this.retry?.id ?? null;
  }

  // --- Commands ---------------------------------------------------------------------------------

  begin(raceId: string): void {
    const def = this.defs.find((d) => d.id === raceId);
    if (!def) return;
    this.checkSave();
    if (this.activeId && (this.state === 'running' || this.state === 'countdown')) this.abort(this.activeId === raceId ? 'restart' : 'quit');
    const g = gateRing(def);
    const player = this.deps.player;
    const start = raceStartPosition(def, _p, { breed: player.breed, terrain: this.deps.terrain });
    player.teleport(start, Math.atan2(g.nx, g.nz), 'flying', RACE_START.speed);
    this.deps.camera?.snap(player);
    this.airTime = 0;
    this.arm(def);
  }

  restart(): void {
    const id = this.activeId ?? this.retryId;
    if (id) this.begin(id);
  }

  abort(reason: RaceAbortReason): void {
    const id = this.activeId;
    if (!id) return;
    const live = this.state === 'running' || this.state === 'countdown';
    if (live) this.deps.events.emit('raceAbort', { raceId: id, reason });
    this.reset();
    this.retry = live && reason !== 'quit' && reason !== 'restart' ? { id, left: RETRY_WINDOW } : null;
  }

  /**
   * Forget the progress in hand (Erase progress): abandon any race, drop the best time and the
   * best run's ghost (its stored copy went with the save). Runs by itself when the save document
   * is swapped; Game may also call it directly.
   */
  resetProgress(): void {
    this.saveData = this.deps.save.data;
    this.abort('quit');
    this.retry = null;
    this.bestGhost = null;
    this.ghostRequest++;
    this.bestMs = null;
    this.lastResult = null;
    this.ghost.hide();
  }

  setShowGhost(on: boolean): void {
    this.showGhost = on;
    if (!on) this.ghost.hide();
  }

  // --- Simulation -------------------------------------------------------------------------------

  fixedUpdate(dt: number, player: PlayerSystem): void {
    if (this.retry && (this.retry.left -= dt) <= 0) this.retry = null;
    this.checkSave();
    const a = player.prevPosition;
    const b = player.position;
    const flying = player.mode === 'flying';
    this.airTime = flying ? this.airTime + dt : 0;

    if (this.state === 'idle') {
      // Arming is a cheap check; a few times a second is plenty.
      this.armCheck -= dt;
      if (flying && this.armCheck <= 0) {
        this.armCheck = 0.1;
        const def = this.airTime >= ARMING.airborne ? this.armable(b, player.flight.velocity) : null;
        if (def) this.arm(def);
      }
      return;
    }
    // A deliberate leap leaves the mounted race before a riderless dragon can cross a gate.
    if (player.mode === 'traversing' && (this.state === 'countdown' || this.state === 'running')) {
      if (this.state === 'running') this.abort('dismount'); else this.disarm('landed');
      return;
    }
    const def = this.active!;
    const idx = this.defs.indexOf(def);

    if (this.state === 'countdown') {
      const gate = this.gates[idx];
      const c = sweepGate(a.x, a.y, a.z, b.x, b.y, b.z, gate, GATE_HALF_WIDTH, GATE_HALF_HEIGHT);
      if (c !== null) {
        this.start((1 - c) * dt, player);
        return;
      }
      const v = player.flight.velocity;
      this.awayTime = v.x * gate.nx + v.z * gate.nz < 0 ? this.awayTime + dt : 0;
      const dist = _p.set(gate.cx, gate.cy, gate.cz).distanceTo(b);
      const side = ringSide(b.x, b.y, b.z, gate);
      if (side > 2) this.disarm('missed-gate');
      else if (!flying) this.disarm(player.mode === 'respawning' ? 'respawn' : 'landed');
      else if (dist > DISARM_DISTANCE || this.awayTime > DISARM_AWAY_SECONDS) this.disarm('away');
      if (this.state !== 'countdown') return;
      // Three-two-one as the gate comes up (seconds to the gate at the current speed).
      const speed = Math.max(5, player.flight.velocity.dot(_v.set(gate.nx, gate.ny, gate.nz)));
      const eta = Math.ceil(-side / speed);
      if (eta >= 1 && eta <= 3 && eta < this.countdownShown) {
        this.countdownShown = eta;
        this.deps.events.emit('raceCountdown', { raceId: def.id, count: eta });
      }
      return;
    }

    if (this.state === 'finished') {
      this.finishedTime += dt;
      if (this.finishedTime > FINISHED_HOLD) this.reset();
      return;
    }

    // Running.
    const ring = this.rings[idx][this.nextRingIndex];
    const c = sweepRing(a.x, a.y, a.z, b.x, b.y, b.z, ring, missRadiusFor(ring.radius));
    if (c?.kind === 'pass') {
      this.passRing(this.elapsedMs + c.t * dt * 1000, b);
      if (this.state !== 'running') return;
    } else if (c?.kind === 'miss' && this.missedAt !== this.nextRingIndex) {
      this.missedAt = this.nextRingIndex;
      this.deps.events.emit('ringMissed', { raceId: def.id, index: this.nextRingIndex });
    }
    this.elapsedMs += dt * 1000;
    this.record(player);

    // Off: dismounted, changed breed, or far from the next ring for a while.
    if (player.mode === 'onFoot' || player.mode === 'dismounting') {
      this.abort('dismount');
      return;
    }
    if (player.breed.id !== this.runBreed) {
      this.abort('breed-change');
      return;
    }
    const next = this.rings[idx][this.nextRingIndex];
    const far = _p.set(next.cx, next.cy, next.cz).distanceTo(b) > LEFT_COURSE_DISTANCE[def.kind];
    this.offCourseTime = far ? this.offCourseTime + dt : 0;
    if (this.offCourseTime > LEFT_COURSE_SECONDS) this.abort('left-course');
  }

  update(dt: number, camera: PerspectiveCamera, player: PlayerSystem): void {
    this.checkSave();
    const idx = this.active ? this.defs.indexOf(this.active) : -1;
    this.visuals.update(dt, camera, {
      activeIndex: idx,
      state: this.state,
      nextRing: this.nextRingIndex,
    });
    this.updateGhost(dt, camera);
    void player;
  }

  // --- Internals --------------------------------------------------------------------------------

  /** The race whose gate the player is deliberately lining up on, if any (see ARMING). */
  private armable(p: Vector3, vel: Vector3): RaceDef | null {
    const speed = vel.length();
    const hs = Math.hypot(vel.x, vel.z);
    if (speed < ARMING.minSpeed || hs < 1) return null;
    const cosHeading = Math.cos(ARMING.headingDeg * DEG);
    for (let i = 0; i < this.defs.length; i++) {
      const g = this.gates[i]; // gate normals are horizontal
      const dx = p.x - g.cx;
      const dy = p.y - g.cy;
      const dz = p.z - g.cz;
      if (dx * dx + dy * dy + dz * dz > ARMING.distance * ARMING.distance) continue;
      const along = dx * g.nx + dz * g.nz; // signed side of the gate plane (negative = approach)
      if (along > -ARMING.minLead) continue;
      const vn = vel.x * g.nx + vel.z * g.nz;
      if (vn / hs < cosHeading) continue;
      // Where the current line crosses the gate's plane, relative to the opening's center.
      const t = -along / vn;
      const lateral = (dx + vel.x * t) * g.nz - (dz + vel.z * t) * g.nx;
      const up = dy + vel.y * t;
      if (Math.abs(lateral) > GATE_HALF_WIDTH + ARMING.aimMargin) continue;
      if (Math.abs(up) > GATE_HALF_HEIGHT + ARMING.aimMargin) continue;
      return this.defs[i];
    }
    return null;
  }

  private arm(def: RaceDef): void {
    this.reset();
    this.retry = null;
    this.active = def;
    this.activeId = def.id;
    this.state = 'countdown';
    this.countdownShown = 4;
    this.awayTime = 0;
    this.bestMs = this.deps.save.data.races[def.id]?.bestMs ?? null;
    this.loadGhost(def.id);
    this.deps.events.emit('raceArmed', { raceId: def.id });
  }

  /** An armed race stands down without starting. */
  private disarm(reason: RaceDisarmReason): void {
    const id = this.activeId;
    if (!id || this.state !== 'countdown') return;
    this.reset();
    this.retry = { id, left: RETRY_WINDOW };
    this.deps.events.emit('raceDisarmed', { raceId: id, reason });
  }

  /** A swapped save document means progress was erased: drop what was kept from the old one. */
  private checkSave(): void {
    if (this.deps.save.data !== this.saveData) this.resetProgress();
  }

  private start(sinceCrossing: number, player: PlayerSystem): void {
    const def = this.active!;
    const save = this.deps.save.data;
    // The run belongs to the breed and look it is flown with from the gate.
    this.runBreed = player.breed.id;
    this.runLook = { ...save.wyvern, breed: player.breed.id };
    this.runRider = { ...save.rider };
    this.state = 'running';
    this.elapsedMs = sinceCrossing * 1000;
    this.nextRingIndex = 0;
    this.splits.length = 0;
    this.lastDeltaMs = null;
    this.missedAt = -1;
    this.offCourseTime = 0;
    this.recorder.reset();
    this.stepCount = 0;
    this.record(player);
    this.visuals.gatePassed(this.defs.indexOf(def));
    this.deps.events.emit('raceStart', { raceId: def.id });
  }

  private passRing(atMs: number, at: Vector3): void {
    const def = this.active!;
    const index = this.nextRingIndex;
    this.splits.push(atMs);
    const best = this.bestGhost?.splits?.[index];
    this.lastDeltaMs = best !== undefined ? atMs - best : null;
    this.visuals.ringPassed(this.defs.indexOf(def), index);
    this.deps.events.emit('ringPassed', {
      raceId: def.id,
      index,
      total: def.rings.length,
      splitMs: atMs,
      deltaMs: this.lastDeltaMs,
      position: at.clone(),
    });
    this.nextRingIndex++;
    this.missedAt = -1;
    if (this.nextRingIndex >= def.rings.length) this.finish(atMs);
  }

  private finish(timeMs: number): void {
    const def = this.active!;
    const save = this.deps.save;
    const player = this.deps.player;
    const prev = save.data.races[def.id];
    const previousBestMs = prev?.bestMs ?? null;
    const medal = medalFor(timeMs, def.medals);
    const newBest = previousBestMs === null || timeMs < previousBestMs;
    const breed = this.runBreed ?? player.breed.id;
    save.data.races[def.id] = {
      bestMs: newBest ? timeMs : previousBestMs!,
      medal: bestMedal(prev?.medal ?? 'none', medal),
      breed: newBest ? breed : prev!.breed,
      runs: (prev?.runs ?? 0) + 1,
    };
    this.elapsedMs = timeMs;
    this.state = 'finished';
    this.finishedTime = 0;
    this.lastResult = { raceId: def.id, timeMs, medal, newBest };
    if (newBest) {
      this.bestMs = timeMs;
      const ghost = this.recorder.finish({
        raceId: def.id,
        breed,
        look: this.runLook ?? { ...save.data.wyvern, breed },
        rider: this.runRider ?? { ...save.data.rider },
        timeMs,
        splits: this.splits,
      });
      this.bestGhost = ghost;
      void save.putGhost(ghost);
    }
    save.save();
    this.deps.events.emit('raceFinish', { raceId: def.id, timeMs, medal, newBest, previousBestMs });
    grantUnlocks(save.data, this.deps.events);
    this.ghost.hide();
  }

  /** Back to idle: no race, nothing shown. */
  private reset(): void {
    if (this.active) this.visuals.clear(this.defs.indexOf(this.active));
    this.active = null;
    this.activeId = null;
    this.state = 'idle';
    this.elapsedMs = 0;
    this.nextRingIndex = 0;
    this.lastDeltaMs = null;
    this.splits.length = 0;
    this.runBreed = null;
    this.runLook = null;
    this.runRider = null;
    this.awayTime = 0;
    this.armCheck = 0.5; // don't instantly re-arm the gate we just left
    this.ghost.hide();
  }

  /** 30 Hz samples of the physics state (the fixed step is 120 Hz). */
  private record(player: PlayerSystem): void {
    const every = Math.max(1, Math.round(120 / GHOST_RATE));
    if (this.stepCount++ % every !== 0) return;
    const f = player.flight;
    const w = player.wyvernPose;
    if (player.mode === 'flying') this.recorder.push(f.position, f.orientation, f.flapPhase, f.flapStrength, f.wingSpread, f.flare);
    else this.recorder.push(w.position, w.orientation, w.flapPhase, w.flapStrength, w.wingSpread, w.flare);
  }

  private loadGhost(raceId: string): void {
    const req = ++this.ghostRequest;
    // Keep the ghost already in hand for this race (a run just finished) while storage answers.
    if (this.bestGhost?.raceId !== raceId) this.bestGhost = null;
    void this.deps.save.getGhost(raceId).then((g) => {
      // (Keep one handed in meanwhile, e.g. a just-finished run or a showcase's.)
      if (req === this.ghostRequest && this.activeId === raceId) this.bestGhost = g ?? this.bestGhost;
    });
  }

  private updateGhost(dt: number, camera: PerspectiveCamera): void {
    const g = this.bestGhost;
    const show = this.showGhost && g !== null && this.state === 'running' && this.elapsedMs / 1000 <= ghostDuration(g!) + 0.5;
    if (!show) {
      this.ghost.hide();
      return;
    }
    const s = sampleGhost(g!, this.elapsedMs / 1000, this.ghostSample);
    this.ghost.show(g!, s, courseColors(g!.raceId).light, dt, camera);
  }

  /** The ghost's model (for showcases and tests). */
  get ghostWyvern(): RaceGhost['wyvern'] {
    return this.ghost.wyvern;
  }

  /** The ghost recording currently flown against (for showcases). */
  get currentGhost(): GhostRecording | null {
    return this.bestGhost;
  }

  /** Showcases/tests: fly against this ghost. */
  setGhost(g: GhostRecording | null): void {
    this.bestGhost = g;
  }

  /**
   * Showcases: present race `id` as if it were running with `next` the next ring and the clock
   * at `elapsedMs` (rings before `next` already gone). Pair with ?freeze=1 for a still frame.
   */
  debugStage(id: string, next: number, elapsedMs: number, state: 'countdown' | 'running' | 'finished' = 'running'): void {
    const def = this.defs.find((d) => d.id === id);
    if (!def) return;
    const ghost = this.bestGhost;
    this.arm(def);
    if (ghost?.raceId === id) this.bestGhost = ghost;
    this.state = state;
    this.nextRingIndex = Math.min(next, def.rings.length - 1);
    this.elapsedMs = elapsedMs;
    const p = this.deps.player;
    this.runBreed = p.breed.id;
    this.runLook = { ...this.deps.save.data.wyvern, breed: p.breed.id };
    this.runRider = { ...this.deps.save.data.rider };
  }
}
