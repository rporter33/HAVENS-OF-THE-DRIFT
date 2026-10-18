// Player state machine: the rider and their wyvern.
//
//   flying ──touchdown──▶ landed ──interact──▶ dismounting ──▶ onFoot ──interact (near)──▶ mounting ──▶ landed
//     ▲  ◀──takeoff / walk off a cliff──┘                         │ walks off an edge
//     │                                                           ▼
//     ├──────────────── caught (0.8 s later) ◀──────────────── falling
//     └── respawning ◀── below the cloud floor (fade to white, back above the last safe ground)
//
// Physics runs in fixedUpdate (120 Hz): the flight model while airborne, kinematic walkers on
// the ground. update() interpolates everything into the render poses once per frame.

import { Quaternion, Vector3 } from 'three';
import type {
  BreedId,
  BreedStats,
  FlightEnvironment,
  FlightInput,
  FlightState,
  GroundHit,
  InputFrame,
  PlayerMode,
  RiderAction,
  RiderPose,
  Settings,
  WyvernGait,
  WyvernPose,
} from '../core/types';
import type { GameEventBus } from '../core/events';
import type { PlayerSystem } from '../game/contracts';
import type { Terrain } from '../world/terrain';
import { BREEDS } from '../flight/breeds';
import { FlightModel, createFlightState } from '../flight/FlightModel';
import { angleDelta, clamp, clamp01, damp, DEG, lerp, smoothstep } from '../core/math';
import { hashSeed, mulberry32 } from '../core/rng';
import { createRiderPose, createWyvernPose } from './poses';
import { slopeLimitY, standingOrientation, yawOf } from './ground';
import { gaitProfile } from '../core/gait';
import { RiderFoot } from './foot';
import { Companion } from './companion';
import { PLAYER_TUNING as P } from './tuning';
import { FixedHome, type HomeAnchor } from './home';
import { SkyLance } from '../traversal/SkyLance';
import { integrate, resolveTether, steerSwing, ROPE_EPSILON } from '../traversal/tether';
import { moveBody, type SweepWorld } from '../traversal/sweep';
import { LANCE } from '../traversal/tuning';
import { fallSpeed } from '../traversal/freefall';
import { AirBoost, openDrop, steerFreefall } from '../traversal/air';
import { boundaryPush01 } from '../sky/windField';

export interface PlayerDeps {
  terrain: Terrain;
  env: FlightEnvironment;
  events: GameEventBus;
  breed: BreedId;
  /** Read for settings.holdToFlap. Optional: hold-to-flap when absent. */
  settings?: () => Settings;
  /**
   * The saddle origin (where the rider's hips rest) in the wyvern's body frame, from the model
   * (Wyvern.seatOffset). Return null (or omit) to use the standHeight-proportional estimate.
   */
  seat?: (out: Vector3) => Vector3 | null;
  /**
   * Where the model's foot i (LH, RH, LF, RF) is coming down, or stands (world; Wyvern.footLanding):
   * the wyvern's footsteps are placed there. Return null (or omit) to use the walker's estimate.
   */
  foot?: (i: number, out: Vector3) => Vector3 | null;
  /** Where home (the stable, the last-resort respawn) is. Defaults to the Roost. */
  home?: HomeAnchor;
  /**
   * 0..1 how much sun there is (1 = full day, 0 = night), for basking: a wyvern resting in the
   * sun is Sun-warmed a little sooner. Absent = treated as night (the plain Rested timing).
   */
  daylight?: () => number;
  /**
   * True when an interactable (an inscription, Quintus, the Codex) is in reach of this on-foot
   * position: interact then belongs to it (Game calls it), so the rider neither mounts nor waves.
   */
  interactableNear?: (p: Vector3) => boolean;
}

// Scratch.
const _v = new Vector3();
const _v2 = new Vector3();
const _fwd = new Vector3();
const _up = new Vector3();
const _left = new Vector3();
const _q = new Quaternion();
const _seat = new Vector3();
const UP = new Vector3(0, 1, 0);
const NEUTRAL: FlightInput = { pitch: 0, roll: 0, yaw: 0, flap: 0, tuck: 0, flare: 0 };

/** A cycle phase (0..1) from `a` to `b` at `t`, the short way round. */
function phaseLerp(a: number, b: number, t: number): number {
  let d = b - a;
  d -= Math.round(d);
  const p = a + d * t;
  return p - Math.floor(p);
}

/** The Rested bonus, announced the first few times: basking by day, a rest by night. */
const SUN_WARMED_TOAST = { text: 'Sun-warmed — your wyvern spreads its wings to the sun', sub: 'Its stamina lasts longer for a while', icon: 'info' } as const;
const RESTED_TOAST = { text: 'Rested — your wyvern stretches and settles', sub: 'Its stamina lasts longer for a while', icon: 'info' } as const;

/** A failed landing explains itself at most this often (s), and never on ground steeper than ~70°. */
const STEEP_HINT_INTERVAL = 8;
const STEEP_HINT_MIN_Y = 0.34;

/** Seat (where the rider's hips rest) in body space, as a fraction of standHeight. */
const SEAT_UP = 0.37;
const SEAT_FWD = 0.08;

export class Player implements PlayerSystem {
  mode: PlayerMode = 'flying';
  breed: BreedStats;
  readonly model: FlightModel;
  private readonly contact = { id: 0, reset: 0, impact: 0 };
  readonly wyvernPose: WyvernPose = Object.assign(createWyvernPose(), {
    touchdown: this.contact,
    control: { pitch: 0, roll: 0, yaw: 0 },
    gust: { l: 0, r: 0 },
    // A tired wyvern's ragged beat (B7): this beat's amplitude, the right wing's lag.
    beatAmp: 1,
    sideLag: 0,
    // A called arrival greets the rider: the id follows Companion.greetings.
    cue: { kind: 'greet' as const, id: 0 },
  });
  readonly riderPose: RiderPose = createRiderPose();
  readonly riderPosition = new Vector3();
  readonly prevPosition = new Vector3();
  readonly position = new Vector3();
  controllable = true;
  fade = 0;
  /** Seconds since the mode changed. */
  modeTime = 0;
  /** The wyvern on the ground (riderless or carrying the rider) and the rider on foot. */
  readonly companion = new Companion();
  readonly foot = new RiderFoot();
  /** Where the stable is and where to fall back to (the Roost today; one day an airship). */
  readonly home: HomeAnchor;

  /** Rider traversal equipment; isolated showcases may supply their own world adapter. */
  skyLance: SkyLance | null = null;
  traversalPhase: 'tethered' | 'released' = 'released';
  lanceInteraction: 'hold' | 'toggle' = 'hold';
  setLanceInteraction(value: 'hold' | 'toggle'): void {
    this.lanceInteraction = value; this.skyLance?.reset(); this.cancelLanceWindup();
  }
  private callTime = 0;
  get windlineHoldAction(): 'leap' | 'recall' | null {
    if (!this.skyLance || this.mountHoldBlocked || this.skyLance.rope) return null;
    return this.mode === 'flying' ? 'leap' : this.mode === 'traversing' ? 'recall' : null;
  }
  get windlineHoldProgress(): number { return this.windlineHoldAction ? clamp01(this.callTime / LANCE.callHold) : 0; }
  private readonly traversalStart = new Vector3();
  freefallTilt = 0;
  freefallSteer = 0;
  freefallOpen = false;
  readonly airBoost = new AirBoost();
  private mountHoldBlocked = false;
  private unmountedFlight = false;
  private readonly companionFlight: FlightInput = {pitch:0,roll:0,yaw:0,flap:0,tuck:0,flare:0};
  private latchLance = false;
  private latchLanceRelease = false;
  private blockWindup = false;
  private latchRecover = false;
  private prevLance = false;
  private prevRecover = false;
  private readonly latchedLanceAim = new Vector3();
  private hasLanceAim = false;
  private readonly harness = new Vector3();

  enableSkyLance(world: SweepWorld): void { this.disableSkyLance(); this.skyLance = new SkyLance(world); this.blockWindup = false; }
  /** Equipment teardown does not alter rider world velocity or the normal movement systems. */
  disableSkyLance(): void {
    this.skyLance?.reset(); this.cancelLanceWindup(); this.skyLance = null;
    this.traversalPhase = 'released';
    this.unmountedFlight = false; this.airBoost.reset(); this.freefallOpen = false; this.freefallSteer = 0;
    if (this.mode === 'traversing') this.setMode('onFoot');
  }
  private deps: PlayerDeps;
  private simTime = 0;
  private cameraYaw = 0;

  // Interpolation: wyvern body and rider (feet on foot / seat mounted).
  private prevWyPos = new Vector3();
  private prevWyQuat = new Quaternion();
  /** The animation channels at the previous physics step (interpolated like the body). */
  private readonly prevAnim = { velocity: new Vector3(), angularVelocity: new Vector3(), airspeed: 0, wingSpread: 1, flapPhase: 0, flapStrength: 0, flare: 0, stall: 0 };
  private riderPos = new Vector3();
  private prevRiderPos = new Vector3();
  private riderYaw = 0;
  private prevRiderYaw = 0;
  private riderVel = new Vector3();
  private riderMounted = true;

  // Animation channels written each fixed step.
  private airborne = true;
  private gait: WyvernGait = 'idle';
  private gaitStart = 0;
  private wingSpread = 1;
  private flapPhase = 0;
  private flapStrength = 0;
  private flare = 0;
  private groundSpeed = 0;
  private groundY: number | null = null;
  private turnRate = 0;
  private riderAction: RiderAction = 'mounted';
  private riderActionStart = 0;
  /** Wyvern takeoff crouch (0..1) and the rider's own crouch. */
  private crouch = 0;
  private riderCrouch = 0;
  private brace = 0;
  private lean = 0;
  private fatigue = 0;
  private landKick = 0;

  // Input.
  private latched = false;
  private latchInteract = false;
  private latchJump = false;
  private latchAirAction = false;
  private prevInteract = false;
  private prevJump = false;
  private prevAirAction = false;
  private prevFlap = 0;
  private flapQueued = 0;
  private beatsAtQueue = 0;
  private queueAge = 0;
  private flightIn: FlightInput = { pitch: 0, roll: 0, yaw: 0, flap: 0, tuck: 0, flare: 0 };
  /** Seconds of automatic half-tuck left after walking off a cliff. */
  private autoTuck = 0;
  /** Seconds of committed launch strokes left after a takeoff leap (one press climbs away). */
  private launchHold = 0;

  // Rest: landing refills the meter; a moment's rest after a flight makes the wyvern Rested.
  /** 0..1 of the Rested bonus left. */
  private restedLeft = 0;
  /** Seconds on the ground since the last flight. */
  private groundTime = 0;
  /** A real flight happened since the last time it rested (rest is earned by flying). */
  private flownSinceRest = false;
  /** Seconds into the wing ruffle (< 0: not playing). */
  private ruffleT = -1;
  private restedToasts = 0;

  // Transitions.
  private takeoffTimer = -1;
  private mountDuration: number = P.mountTime;
  private airTime = 0;
  private launchGait: WyvernGait = 'idle';
  private noLand = 0;
  private landBlend = 1;
  private touchdownQuat = new Quaternion();
  private transFrom = new Vector3();
  private transTo = new Vector3();
  private respawnPlaced = false;
  private waveTimer = 0;
  private landActionTimer = 0;
  private hitCooldown = 0;
  /** Seconds until a failed steep landing may explain itself again. */
  private steepHintTimer = 0;
  private stillTime = 0;

  // Last place it was safe to stand (respawn point).
  private lastSafe = new Vector3();
  private lastSafeYaw = 0;
  private safeTimer = 0;

  // Where the wyvern looks.
  private lookTarget = new Vector3();
  private lookSmooth = new Vector3();
  private lookFresh = true;
  private idleLookTimer = 0;
  private idleLookCount = 0;
  private idleLook = new Vector3();

  constructor(deps: PlayerDeps) {
    this.deps = deps;
    this.breed = BREEDS[deps.breed];
    this.model = new FlightModel(this.breed);
    this.home = deps.home ?? new FixedHome(deps.terrain.layout, deps.terrain);
    this.lastSafeYaw = this.home.respawn(this.lastSafe);
    this.companion.footAt = (i, out) => this.footstepAt(i, out);
  }

  get flight(): FlightState {
    return this.model.state;
  }

  // --- Queries for prompts, HUD and tests ---------------------------------------------------

  /** Height of the wyvern's body above the ground below it (null over open air). */
  get heightAboveGround(): number | null {
    const g = this.groundY;
    return g === null ? null : this.model.state.position.y - g;
  }

  /** Horizontal distance from the rider to the wyvern's body. */
  get wyvernDistance(): number {
    const a = this.riderPos;
    const b = this.model.state.position;
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /** Seconds the mounted wyvern has been standing still on the ground. */
  get groundStillTime(): number {
    return this.stillTime;
  }

  /** The point the wyvern respawns above. */
  get safeGround(): Vector3 {
    return this.lastSafe;
  }

  /** 0..1 of the Rested bonus left (0 = not rested). */
  get rested(): number {
    return this.restedLeft;
  }

  /** True when the wyvern is close enough (and settled enough) for the rider to mount. */
  get canMount(): boolean {
    const d = this.wyvernDistance;
    if (this.unmountedFlight) return false;
    return d <= P.mountRange || (d <= P.mountReach && this.companion.state === 'idle');
  }

  // --- Setup ----------------------------------------------------------------------------------

  setBreed(id: BreedId): void {
    this.breed = BREEDS[id];
    this.model.setBreed(this.breed);
    if (this.mode !== 'flying' && this.mode !== 'respawning' && this.mode !== 'falling' && this.mode !== 'traversing' && this.companion.state !== 'hop') {
      const w = this.companion.walker;
      w.settle(this.deps.terrain, this.breed.standHeight, w.groundY + 3);
      this.syncModelFromGround();
      this.prevWyPos.copy(this.model.state.position);
    }
  }

  /** New game: the rider on foot at the spawn, the wyvern standing on the Roost beside the stable. */
  placeAtSpawn(): void {
    const home = this.home;
    this.resetTransitions();
    const riderYaw = home.riderStart(_v);
    this.foot.place(_v.setY(1e5), riderYaw, this.deps.terrain);
    const w = this.companion.walker;
    w.yaw = home.wyvernStart(w.position);
    w.position.y = 1e5;
    w.speed = 0;
    w.settle(this.deps.terrain, this.breed.standHeight, 1e5);
    this.companion.standStill();
    // It waits by the stable for its rider rather than trotting straight over.
    this.companion.leash = Math.hypot(w.position.x - this.foot.position.x, w.position.z - this.foot.position.z) + 15;
    this.model.state.stamina = 1;
    this.model.state.winded = false;
    this.restedLeft = 0;
    this.flownSinceRest = false;
    this.ruffleT = -1;
    this.syncModelFromGround();
    this.lastSafe.set(w.position.x, w.groundY, w.position.z);
    this.lastSafeYaw = w.yaw;
    this.setMode('onFoot');
    this.syncRiderFromFoot();
    this.snapInterpolation();
  }

  /**
   * The Stable is opening with the rider on foot and the wyvern left far away (at a new game it
   * waits across the plaza): bring it to a stall beside the stable, so the Stable frames wyvern
   * and rider together instead of gliding the camera across the island. True if it moved.
   */
  settleAtStable(): boolean {
    if (this.mode !== 'onFoot') return false;
    const c = this.companion;
    if ((c.state !== 'idle' && c.state !== 'follow') || this.wyvernDistance <= P.stableSettleRange) return false;
    const t = this.deps.terrain;
    const w = c.walker;
    const sh = this.breed.standHeight;
    for (let i = 0; i < this.home.stallCount; i++) {
      const yaw = this.home.stableStall(i, _v);
      w.position.set(_v.x, _v.y + 3, _v.z);
      w.yaw = yaw;
      w.speed = 0;
      if (!w.settle(t, sh, _v.y + 3) || w.normal.y < slopeLimitY(this.breed.id, 'walk')) continue;
      // Clear of the walls, posts and planters (it would only be pushed aside).
      _v2.copy(w.position);
      w.resolveWalls(t, sh, 0, slopeLimitY(this.breed.id, 'land'));
      if (w.position.distanceToSquared(_v2) > 0.01) continue;
      c.standStill();
      c.called = false;
      c.leash = P.followDistance;
      this.syncModelFromCompanion();
      const s = this.model.state;
      this.position.copy(s.position);
      this.prevPosition.copy(s.position);
      this.prevWyPos.copy(s.position);
      this.prevWyQuat.copy(s.orientation);
      this.keepAnimPrev();
      this.lookFresh = true;
      this.update(0, 1);
      return true;
    }
    return false;
  }

  teleport(position: Vector3, yaw: number, mode: 'flying' | 'landed' | 'onFoot', speed?: number): void {
    this.resetTransitions();
    const t = this.deps.terrain;
    if (mode === 'landed' || mode === 'onFoot') {
      const w = this.companion.walker;
      if (mode === 'onFoot') {
        if (this.foot.place(position, yaw, t)) {
          // The wyvern waits a few meters to the rider's left.
          w.position.set(position.x + Math.cos(yaw) * 4.5, position.y + 4, position.z - Math.sin(yaw) * 4.5);
          w.yaw = yaw;
          if (!w.settle(t, this.breed.standHeight)) {
            w.position.set(position.x, position.y + 4, position.z);
            w.settle(t, this.breed.standHeight);
          }
          w.speed = 0;
          this.companion.standStill();
          this.syncModelFromGround();
          this.setMode('onFoot');
          this.syncRiderFromFoot();
          this.snapInterpolation();
          return;
        }
      } else {
        w.position.copy(position);
        w.yaw = yaw;
        w.speed = 0;
        if (w.settle(t, this.breed.standHeight, position.y + 3)) {
          this.companion.standStill();
          this.syncModelFromGround();
          this.setMode('landed');
          this.syncRiderToSeat();
          this.snapInterpolation();
          return;
        }
      }
      // No ground there: fly instead.
    }
    const q = standingOrientation(yaw, UP, 0, 0, _q);
    const v = _v.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(speed ?? this.model.derived.vCruise);
    this.model.reset(position, q, v);
    this.model.setGrace(1);
    this.airTime = 99;
    this.setMode('flying');
    this.syncRiderToSeat();
    this.snapInterpolation();
  }

  /**
   * Latch this frame's edge-triggered presses (interact, jump) so a press is never lost on a
   * rendered frame that runs no fixed step, nor applied twice on one that runs several. Game
   * calls it once per frame before the fixed steps; without it, presses are edge-detected
   * across fixed steps instead.
   */
  latchPresses(input: InputFrame): void {
    this.latched = true;
    if (input.pressed.interact) this.latchInteract = true;
    if (input.pressed.jump) this.latchJump = true;
    if (input.pressed.airAction) this.latchAirAction = true;
    if (input.pressed.lance && !this.latchLance) {
      this.latchLance = true;
      this.hasLanceAim = !!input.aim;
      if (input.aim) this.latchedLanceAim.copy(input.aim);
    }
    if (input.pressed.lanceRelease) {
      this.latchLanceRelease = true;
    }
    if (input.pressed.recoverLance) this.latchRecover = true;
  }

  // --- Simulation -----------------------------------------------------------------------------

  fixedUpdate(dt: number, input: InputFrame, cameraYaw: number): void {
    if (!(dt > 0)) return;
    this.airBoost.tick(dt);
    this.simTime += dt;
    this.modeTime += dt;
    this.cameraYaw = cameraYaw;
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.steepHintTimer = Math.max(0, this.steepHintTimer - dt);
    this.noLand = Math.max(0, this.noLand - dt);
    this.landActionTimer = Math.max(0, this.landActionTimer - dt);
    this.waveTimer = Math.max(0, this.waveTimer - dt);
    this.prevPosition.copy(this.model.state.position);
    this.prevWyPos.copy(this.model.state.position);
    this.prevWyQuat.copy(this.model.state.orientation);
    this.keepAnimPrev();
    this.prevRiderPos.copy(this.riderPos);
    this.prevRiderYaw = this.riderYaw;

    let interact: boolean;
    let jump: boolean;
    let airAction: boolean;
    if (this.latched) {
      interact = this.latchInteract;
      jump = this.latchJump;
      airAction = this.latchAirAction;
      this.latchInteract = false;
      this.latchJump = false;
      this.latchAirAction = false;
    } else {
      interact = input.pressed.interact && !this.prevInteract;
      jump = input.pressed.jump && !this.prevJump;
      airAction = !!input.pressed.airAction && !this.prevAirAction;
    }
    this.prevInteract = input.pressed.interact;
    this.prevJump = input.pressed.jump;
    this.prevAirAction = !!input.pressed.airAction;

    if (this.skyLance) {
      if (!input.callHeld) this.mountHoldBlocked = false;
      if ((this.mode === 'flying' || this.mode === 'landed') && !this.mountHoldBlocked) {
        this.callTime = input.callHeld ? this.callTime + dt : 0;
        if (this.callTime + 1e-9 >= LANCE.callHold) {
          this.callTime = 0; this.mountHoldBlocked = true;
          if (this.mode === 'flying') this.jumpFromWyvern();
          else if (this.landBlend >= 1 && !this.home.nearStable(this.riderPos)) this.startDismount();
        }
      }
    }
    // Equipment resolves before mode dispatch: an attachment wins over a catch on this step.
    const lancePress = this.latched ? this.latchLance : !!input.pressed.lance && !this.prevLance;
    const recover = this.latched ? this.latchRecover : !!input.pressed.recoverLance && !this.prevRecover;
    this.latchLance = this.latchRecover = false;
    this.prevLance = !!input.pressed.lance; this.prevRecover = !!input.pressed.recoverLance;
    const lanceRelease = this.latched ? this.latchLanceRelease : !!input.pressed.lanceRelease;
    this.latchLanceRelease = false;
    this.updateLance(dt, input, lancePress, recover, lanceRelease);
    this.hasLanceAim = false;
    switch (this.mode) {
      case 'traversing':
        this.updateTraversal(dt, input, jump || airAction);
        break;
      case 'flying':
        this.updateFlying(dt, input);
        break;
      case 'landed':
        this.updateLanded(dt, input, interact);
        break;
      case 'onFoot':
        this.updateOnFoot(dt, input, interact, jump);
        break;
      case 'mounting':
        this.updateMounting(dt);
        break;
      case 'dismounting':
        this.updateDismounting(dt);
        break;
      case 'falling':
        this.updateFalling(dt);
        break;
      case 'respawning':
        this.updateRespawning(dt);
        break;
    }
    this.prevFlap = input.flight.flap;
    this.position.copy(this.model.state.position);
    this.controllable = this.mode === 'flying' || this.mode === 'landed' || this.mode === 'onFoot' || this.mode === 'traversing' || (this.mode === 'falling' && this.skyLance !== null);
    this.updateRest(dt);
    this.updateSafeGround(dt);
    this.updateChannels(dt);
    this.updateLookTarget(dt);
  }

  // --- Independent rider traversal --------------------------------------------------------------

  /** Called when play loses input ownership. A held button must be released before a fresh windup. */
  cancelLanceWindup(): void {
    this.skyLance?.cancelCharge(); this.callTime = 0; this.mountHoldBlocked = true;
    if (this.skyLance?.state === 'projectile') this.skyLance.detach('Cast cancelled');
    this.latchLance = this.latchLanceRelease = this.latchRecover = false; this.hasLanceAim = false;
    this.latchJump = this.latchInteract = false;
    this.latchAirAction = false; this.airBoost.cancelRequest();
    this.blockWindup = true;
  }

  private updateLance(dt: number, input: InputFrame, press: boolean, recover: boolean, released: boolean): void {
    const lance = this.skyLance;
    if (!lance) return;
    const riderFree = this.mode === 'onFoot' || this.mode === 'falling' || this.mode === 'traversing';
    if (!riderFree) { lance.reset(); return; }
    this.harness.copy(this.foot.position).addScaledVector(UP, LANCE.harnessHeight);
    if (this.blockWindup) {
      if (!input.lanceHeld) this.blockWindup = false;
      press = false;
    }
    if (press) {
      if (lance.state === 'anchored' || lance.state === 'projectile') {
        if (this.lanceInteraction === 'toggle') lance.detach();
      } else if (lance.state === 'ready') {
        _fwd.set(Math.sin(this.cameraYaw), 0.35, Math.cos(this.cameraYaw)).normalize();
        lance.throw(this.harness, this.hasLanceAim ? this.latchedLanceAim : input.aim ?? _fwd, this.foot.velocity);
        if (!this.foot.grounded) this.beginTraversal();
      }
    }
    if (released && this.lanceInteraction === 'hold' && (lance.rope || lance.state === 'projectile')) {
      lance.detach(); this.callTime = 0;
    }
    if (!lance.rope) this.traversalPhase = 'released';
    if (recover) { lance.cancelCharge(); lance.recover(); } // Never changes an attached rope or rider velocity.
    if (lance.step(dt, this.harness, true)) {
      this.callTime = 0; this.traversalPhase = 'tethered';
      // Grounded attachment does not transfer movement ownership or remove support.
      if (this.mode !== 'onFoot' || !this.foot.grounded) this.beginTraversal();
    }
  }

  private beginTraversal(): void {
    if (this.mode === 'falling') {
      this.home.respawn(_v);
      this.companion.cancelRescue(_v, this.breed.standHeight);
    }
    if (this.mode !== 'traversing') { this.setMode('traversing'); this.callTime = 0; }
  }

  /** A newly blocked line is a movement boundary, not an automatic equipment release.
   * Restore the previous clear body endpoint through a sweep. Retain its committed length;
   * an attempted powered reel cannot commit shortening across a blocked path.
   * A failed restoration still detaches safely. At most two line checks on this exceptional path. */
  private keepTetherClear(lance: SkyLance, beforeFeet: Vector3, length: number): boolean {
    if (!lance.rope || lance.validate(this.harness, true, true)) return false;
    const rope = lance.rope;
    if (!rope) return false; // Invalid static identity always detaches.
    _v.copy(beforeFeet);
    this.foot.velocity.set(0,0,0);
    moveBody(lance.world, this.foot.position, _v, this.foot.velocity);
    this.foot.position.copy(_v); this.harness.copy(_v).addScaledVector(UP,LANCE.harnessHeight);
    rope.length = length;
    if (this.harness.distanceTo(rope.anchor) > length + ROPE_EPSILON || !lance.validate(this.harness)) {
      if (lance.rope) lance.detach('Blocked line cannot be restored');
    } else { lance.reason = 'Line caught at edge'; lance.pullTime = 0; }
    return true;
  }

  private updateTraversal(dt: number, input: InputFrame, jump: boolean): void {
    const lance = this.skyLance!, foot = this.foot, terrain = this.deps.terrain;
    const rope = lance.rope, committedLength = rope?.length ?? 0;
    this.traversalStart.copy(foot.position);
    this.freefallOpen = !rope && openDrop(terrain, foot.position);
    this.traversalPhase = rope ? 'tethered' : 'released';
    // Torso endpoint is stable simulation data; animated hands never exert physics forces.
    this.harness.copy(foot.position).addScaledVector(UP, LANCE.harnessHeight);
    const bodyCollision = (from: Vector3, to: Vector3, velocity: Vector3) => {
      _v.copy(from).addScaledVector(UP, -LANCE.harnessHeight);
      _v2.copy(to).addScaledVector(UP, -LANCE.harnessHeight);
      moveBody(lance.world, _v, _v2, velocity);
      to.copy(_v2).addScaledVector(UP, LANCE.harnessHeight);
    };
    this.freefallTilt += (Math.max(-1, Math.min(1, input.foot.moveY)) - this.freefallTilt) * (1 - Math.exp(-5 * dt));
    this.freefallSteer = damp(this.freefallSteer, this.freefallOpen ? clamp(input.foot.moveX,-1,1) : 0, 8, dt);
    if (rope) {
      this.airBoost.stop(); if (jump) lance.pull();
      steerSwing(this.harness,foot.velocity,rope,input.foot.moveX,input.foot.moveY,this.cameraYaw,dt);
    }
    else {
      if (jump) {
        const x = input.foot.moveX, y = input.foot.moveY;
        _fwd.set(-Math.cos(this.cameraYaw)*x + Math.sin(this.cameraYaw)*y,0,Math.sin(this.cameraYaw)*x + Math.cos(this.cameraYaw)*y);
        this.airBoost.request(foot.velocity, _fwd.lengthSq() > .01 ? _fwd : input.aim, this.cameraYaw);
      }
      const boosting = this.airBoost.remaining > 0 || (this.airBoost.buffered && this.airBoost.available);
      this.airBoost.step(dt, foot.velocity);
      if (this.freefallOpen && !boosting) steerFreefall(foot.velocity, input.foot.moveX, input.foot.moveY, this.cameraYaw, dt);
    }
    const drag = rope || !this.freefallOpen ? 0 : LANCE.spreadDrag + (LANCE.diveDrag - LANCE.spreadDrag) * (this.freefallTilt + 1) * .5;
    const pull = lance.pullTime > 0 ? LANCE.pullAcceleration * smoothstep(0,LANCE.pullRise,LANCE.pullDuration-lance.pullTime+dt*.5) : 0;
    lance.taut = integrate(this.harness, foot.velocity, dt, rope, bodyCollision, drag, undefined, rope || !this.freefallOpen ? 0 : fallSpeed(this.freefallTilt), pull);
    lance.pullTime = Math.max(0, lance.pullTime - dt);
    foot.position.copy(this.harness).addScaledVector(UP, -LANCE.harnessHeight);
    foot.grounded = false; foot.airTime += dt;
    foot.speed = Math.hypot(foot.velocity.x, foot.velocity.z);
    if (foot.speed > 0.5) {
      const turn = Math.atan2(Math.sin(Math.atan2(foot.velocity.x,foot.velocity.z)-foot.yaw),Math.cos(Math.atan2(foot.velocity.x,foot.velocity.z)-foot.yaw));
      foot.yaw += turn * (1-Math.exp(-10*dt));
    }
    // A constraint correction must not push the rider into a wall. Detach rather than stretch or snap.
    if (rope && this.harness.distanceTo(rope.anchor) > rope.length + ROPE_EPSILON) {
      lance.detach('Contact conflicts with tether'); this.callTime = 0;
    }
    if (lance.rope) this.keepTetherClear(lance, this.traversalStart, committedLength);
    if (rope && !lance.rope) this.callTime = 0;
    this.traversalPhase = lance.rope ? 'tethered' : 'released';
    const g = terrain.groundAt(foot.position.x, foot.position.z, foot.position.y);
    if (g && foot.velocity.y <= 0 && foot.position.y <= g.y + 0.015 && g.normal.y >= P.maxSlopeY) {
      if (lance.rope) lance.detach('Landed');
      foot.position.y = g.y; foot.velocity.y = 0; foot.grounded = true; foot.airTime = 0;
      foot.groundY = g.y; foot.normal.copy(g.normal); foot.surface = g.surface;
      this.traversalPhase = 'released';
      this.setMode('onFoot'); this.airBoost.stop(); this.freefallOpen = false; this.landActionTimer = 0.35;
    } else {
      this.callTime = !lance.rope && !this.mountHoldBlocked && input.callHeld ? this.callTime + dt : 0;
      if (this.callTime + 1e-9 >= LANCE.callHold) { this.callTime = 0; this.startFall(); return; }
      // Keep the existing world-boundary recovery, but never summon a dragon automatically.
      if (foot.position.y < terrain.layout.cloudFloor) { lance.reset(); this.startRespawn(); return; }
    }
    this.updateIndependentCompanion(dt);
    this.syncRiderFromFoot();
    this.setRiderAction(foot.grounded ? 'land' : foot.velocity.y > 0 ? 'jump' : 'fall');
  }

  /** Deliberate saddle jump: retain dragon momentum and add a small upwards/outwards hop.
   * The unmounted wyvern continues through the same FlightModel until called or landed. */
  private jumpFromWyvern(): void {
    const state = this.model.state;
    this.seatPosition(this.foot.position).addScaledVector(UP, .8 - P.riderHip);
    _left.set(1,0,0).applyQuaternion(state.orientation);
    _v.copy(this.foot.position);
    this.foot.position.addScaledVector(_left, .7);
    this.foot.velocity.copy(state.velocity).addScaledVector(UP, 5).addScaledVector(_left, 2.5);
    // Sweep the initial outward hop as well as every subsequent airborne step.
    if (this.skyLance) moveBody(this.skyLance.world, _v, this.foot.position, this.foot.velocity);
    this.foot.yaw = Math.atan2(state.velocity.x, state.velocity.z);
    this.foot.grounded = false; this.foot.airTime = 0;
    this.unmountedFlight = true; this.airBoost.stop(); this.skyLance?.reset();
    this.setMode('traversing'); this.callTime = 0;
    this.syncRiderFromFoot(); this.setRiderAction('jump');
    this.deps.events.emit('dismount', {});
  }

  private updateIndependentCompanion(dt: number): void {
    if (this.unmountedFlight && this.foot.grounded && this.companion.called) {
      // Transfer the actual gliding pose only after a safe greeting landing has been found.
      if (this.companion.recallFromAir(this.foot.position, this.breed, this.deps.terrain)) this.unmountedFlight = false;
    }
    if (this.unmountedFlight) {
      this.model.step(dt, this.companionFlight, this.deps.env, this.deps.events);
      this.airTime += dt; this.copyFlightAnim(); this.legContact(dt);
      // Keep the catch origin at the actual gliding dragon, never its stale ground position.
      this.companion.walker.position.copy(this.model.state.position);
      this.companion.orientation.copy(this.model.state.orientation);
      this.companion.velocity.copy(this.model.state.velocity);
    } else {
      this.companion.update(dt, this.foot.position, this.foot.grounded, this.breed, this.deps.terrain, this.deps.events, this.simTime);
      this.syncModelFromCompanion();
    }
  }

  // --- Flying -----------------------------------------------------------------------------------

  private updateFlying(dt: number, input: InputFrame): void {
    const s = this.model.state;
    this.buildFlightInput(dt, input.flight);
    const step = this.model.step(dt, this.flightIn, this.deps.env, this.deps.events);
    this.airTime += dt;
    this.copyFlightAnim();
    this.setGait(this.airTime < P.takeoffGaitTime ? this.launchGait : 'idle');
    this.legContact(dt);
    if (step.contact) this.explainSteepContact();
    if (this.mode === 'flying' && s.position.y < this.deps.terrain.layout.cloudFloor) this.startRespawn();
    this.syncRiderToSeat();
  }

  private buildFlightInput(dt: number, f: FlightInput): void {
    const fi = this.flightIn;
    fi.pitch = f.pitch;
    fi.roll = f.roll;
    fi.yaw = f.yaw;
    fi.tuck = f.tuck;
    fi.flare = f.flare;
    if (this.autoTuck > 0) {
      this.autoTuck -= dt;
      // Any flap or flare from the player ends the swoop early.
      if (f.flap > 0.1 || f.flare > 0.1) this.autoTuck = 0;
      else fi.tuck = Math.max(fi.tuck, 0.55);
    }
    // A takeoff commits to its first strokes: one press of "take off" climbs away; a flare or a
    // tuck takes the wings back.
    if (this.launchHold > 0) {
      this.launchHold -= dt;
      // The strokes go on until it is nearly at cruise speed (at least the first `launchCommit` s).
      const flying = this.model.state.airspeed > 0.9 * this.model.derived.vCruise;
      if (f.flare > 0.1 || f.tuck > 0.1 || (flying && this.airTime > P.launchCommit)) this.launchHold = 0;
    }
    this.boundaryAssist(f);
    const launch = this.launchHold > 0 ? 1 : 0;
    const hold = this.deps.settings?.().holdToFlap ?? true;
    if (hold) {
      fi.flap = Math.max(f.flap, launch);
      return;
    }
    // Tap mode: every press queues exactly one wingbeat (buffered until the current one ends).
    // The input layer already turns a squeeze into a clean pulse, so any rising edge counts, and a
    // soft squeeze makes a soft (cheap) beat.
    if (f.flap > 0.05 && this.prevFlap <= 0.05) {
      this.flapQueued = Math.max(0.3, f.flap);
      this.beatsAtQueue = this.model.beats;
      this.queueAge = 0;
    } else if (this.flapQueued > 0 && f.flap > this.flapQueued) {
      this.flapQueued = f.flap;
    }
    if (this.flapQueued > 0) {
      this.queueAge += dt;
      if (this.model.beats !== this.beatsAtQueue || this.queueAge > Math.max(1.2, 0.15 + 1 / this.breed.flapRate)) this.flapQueued = 0;
    }
    fi.flap = Math.max(this.flapQueued, launch);
  }

  /**
   * The storm at the world's edge turns the wyvern back toward the islands: a phantom rudder
   * toward the centre, and a lean into that turn while the player leaves the roll alone (their
   * own stick always wins). It grows with the storm's push, so it is gentle at the edge.
   */
  private boundaryAssist(f: FlightInput): void {
    const s = this.model.state;
    const p = s.position;
    const push = boundaryPush01(Math.sqrt(p.x * p.x + p.z * p.z), this.deps.terrain.layout.boundaryRadius);
    if (push <= 0) return;
    const fi = this.flightIn;
    // + when the way home lies to the left (a larger yaw).
    const err = clamp(angleDelta(Math.atan2(s.velocity.x, s.velocity.z), Math.atan2(-p.x, -p.z)) * 1.2, -1, 1);
    fi.yaw = clamp(fi.yaw - P.boundaryRudder * push * err, -1, 1);
    const free = 1 - smoothstep(0.1, 0.4, Math.abs(f.roll));
    if (free > 0) {
      _up.set(0, 1, 0).applyQuaternion(s.orientation);
      _left.set(1, 0, 0).applyQuaternion(s.orientation);
      const bank = Math.atan2(_left.y, _up.y);
      // Positive bank is to the right; home to the left wants a left (negative) bank.
      const want = -P.boundaryBank * push * err;
      fi.roll = clamp(fi.roll + free * push * clamp((want - bank) * 2, -1, 1), -1, 1);
    }
  }

  private copyFlightAnim(): void {
    const s = this.model.state;
    this.airborne = true;
    this.wingSpread = s.wingSpread;
    this.flapPhase = s.flapPhase;
    this.flapStrength = s.flapStrength;
    this.flare = s.flare;
    this.groundSpeed = 0;
    this.groundY = this.model.ground ? this.model.ground.y : null;
    this.turnRate = 0;
  }

  /** Legs touching the ground: land, skid, bounce or skate off a slope. */
  private legContact(dt: number): void {
    const s = this.model.state;
    const sh = this.breed.standHeight;
    // The flight model already found the ground under the start of this step; when that's well
    // below the legs there's no need to look again.
    const g0 = this.model.ground;
    if (g0 && s.position.y - g0.y > sh + 4) return;
    const g = this.deps.terrain.groundAt(s.position.x, s.position.z, s.position.y + 0.5);
    if (!g) return;
    this.groundY = g.y;
    const h = s.position.y - g.y;
    if (h > sh || this.noLand > 0) return;
    // At speed the legs are tucked: contact is the body scraping (handled by the flight model).
    const legsDown = s.airspeed < P.legsSpeed || s.flare > 0.25 || this.airTime < 0.6;
    if (!legsDown) return;
    const n = g.normal;
    const vn = s.velocity.dot(n);
    if (vn > 0.5) return; // pushing off / climbing away
    const sink = Math.max(0, -vn);
    _v.copy(s.velocity).addScaledVector(n, -vn);
    const along = _v.length();
    if (n.y < slopeLimitY(this.breed.id, 'land')) {
      // Too steep to stand: the legs skate and the wyvern slides off.
      s.position.addScaledVector(n, (sh - h) * 0.5);
      if (vn < 0) s.velocity.addScaledVector(n, -vn);
      this.explainSteep(n.y);
      return;
    }
    // Flaring into the ground is a landing, however heavy: the legs take it (a deep crouch, a
    // camera kick), no bounce, no crash.
    const sinkLimit = s.flare > 0.5 ? P.landSinkFlared : P.landSink;
    if (along < P.landSpeed && sink < sinkLimit) {
      this.touchdown(g, sink);
      return;
    }
    // Too fast: the legs plant, the body is held up, speed is scrubbed off; a hard one bounces.
    s.position.y = g.y + sh;
    if (vn < 0) s.velocity.addScaledVector(n, -vn * (1 + (sink > P.landSink ? P.bounce : 0)));
    if (along > 1e-3) s.velocity.addScaledVector(_v, -Math.min(along, P.skidDecel * dt) / along);
    if (sink > P.landSink * 0.7 && this.hitCooldown <= 0) {
      this.hitCooldown = 0.35;
      this.landKick = 1;
      this.deps.events.emit('terrainHit', { impulse: sink, point: s.position.clone().setY(g.y), normal: n.clone() });
    }
    this.setGait('landing');
  }

  /**
   * Say why a landing attempt skated off, once per interval: how steep the ground is against what
   * this breed lands on. Never for a wall (nobody tries to land on one). Presentation only.
   */
  private explainSteep(normalY: number): void {
    if (this.steepHintTimer > 0 || normalY < STEEP_HINT_MIN_Y) return;
    this.steepHintTimer = STEEP_HINT_INTERVAL;
    const limit = Math.floor((Math.acos(slopeLimitY(this.breed.id, 'land')) * 180) / Math.PI);
    const slope = Math.ceil((Math.acos(normalY) * 180) / Math.PI);
    this.deps.events.emit('toast', {
      text: 'Too steep to land',
      sub: `A ${this.breed.name} lands on slopes up to ${limit}°. This one is ${slope}°.`,
      icon: 'info',
    });
  }

  /**
   * On a steep slope the body touches before the legs do (the legs' reach is measured straight
   * down, and a slope's perpendicular is shorter), so a flared approach that bounces off ground
   * too steep for this breed never reaches legContact's own check. Explain it from the contact.
   */
  private explainSteepContact(): void {
    const s = this.model.state;
    if (this.steepHintTimer > 0 || (s.flare < 0.25 && s.airspeed >= P.legsSpeed)) return;
    const g = this.deps.terrain.groundAt(s.position.x, s.position.z, s.position.y + 0.5);
    if (!g || s.position.y - g.y > this.breed.standHeight + 3) return;
    if (g.normal.y < slopeLimitY(this.breed.id, 'land')) this.explainSteep(g.normal.y);
  }

  private touchdown(g: GroundHit, sink: number): void {
    const s = this.model.state;
    const w = this.companion.walker;
    w.position.set(s.position.x, g.y + this.breed.standHeight, s.position.z);
    w.groundY = g.y;
    w.normal.copy(g.normal);
    w.surface = g.surface;
    w.islandId = g.islandId;
    const hs = Math.sqrt(s.velocity.x * s.velocity.x + s.velocity.z * s.velocity.z);
    w.yaw = hs > 2 ? Math.atan2(s.velocity.x, s.velocity.z) : yawOf(_fwd.set(0, 0, 1).applyQuaternion(s.orientation));
    w.speed = Math.min(hs, P.landSpeed);
    w.turnRate = 0;
    w.yawRate = 0;
    this.companion.state = 'idle';
    this.touchdownQuat.copy(s.orientation);
    this.landBlend = 0;
    this.landKick = clamp01(sink / P.landSink);
    // Out of the air: clear the flight state (closing any open stall/tuck events).
    this.model.reset(s.position, s.orientation, s.velocity);
    this.takeoffTimer = -1;
    this.stillTime = 0;
    if (this.unmountedFlight) {
      this.unmountedFlight = false; this.companion.standStill();
    } else this.setMode('landed');
    this.setGait('landing');
    const contact = this.contact;
    contact.id++;
    contact.impact = sink;
    this.deps.events.emit('touchdown', { impact: sink, position: w.position.clone().setY(g.y), surface: g.surface });
    this.syncModelFromGround();
  }

  // --- Landed (mounted, on the ground) ------------------------------------------------------------

  private updateLanded(dt: number, input: InputFrame, interact: boolean): void {
    const w = this.companion.walker;
    this.groundRegen(dt);
    this.landBlend = Math.min(1, this.landBlend + dt / P.landBlendTime);

    if (this.takeoffTimer >= 0) {
      this.takeoffTimer += dt;
      w.step(dt, null, 0, this.breed, this.deps.terrain, false);
      if (this.takeoffTimer >= P.crouchTime) {
        this.leap();
        return;
      }
    } else {
      const flapPressed = input.flight.flap > 0.5 && this.prevFlap <= 0.5;
      if (flapPressed) {
        this.takeoffTimer = 0;
        this.setGait('takeoff');
      } else if (interact && this.landBlend >= 1 && !this.home.nearStable(this.riderPos)) {
        this.startDismount();
        return;
      }
      const dir = this.cameraRelative(input.foot.moveX, input.foot.moveY, _v);
      const mag = Math.min(1, dir.length());
      // A key is all or nothing: on the keyboard the wyvern walks, and Shift gallops (the pad's
      // stick gives every speed in between).
      const pace = input.device === 'keyboard' && !input.foot.sprint ? P.keyboardWalk : 1;
      const res = w.step(dt, mag > 0.05 ? dir : null, mag * pace * this.breed.groundSpeed, this.breed, this.deps.terrain, true);
      if (res === 'edge') {
        this.walkOff();
        return;
      }
    }
    this.wyvernFootsteps(dt, this.takeoffTimer < 0);
    this.stillTime = w.speed < 0.3 && this.takeoffTimer < 0 ? this.stillTime + dt : 0;
    if (this.takeoffTimer < 0) {
      const landing = this.gait === 'landing' && (this.simTime - this.gaitStart < P.landGaitTime || w.speed > this.breed.groundSpeed * 1.05);
      if (!landing) this.setGait(this.gaitForSpeed(w.speed));
    }
    this.syncModelFromGround();
    this.groundAnim(this.takeoffTimer >= 0 ? smoothstep(0, P.crouchTime, this.takeoffTimer) : 0);
    this.syncRiderToSeat();
  }

  private leap(): void {
    const w = this.companion.walker;
    w.forward(_fwd);
    const vel = _v.copy(_fwd).multiplyScalar(w.speed + P.leapForward).addScaledVector(UP, P.leapUp);
    const q = standingOrientation(w.yaw, UP, 0, P.leapPitch, _q);
    this.model.reset(_v2.copy(w.position).addScaledVector(UP, 0.15), q, vel);
    this.model.forceBeat(1);
    this.model.setGrace(P.launchGrace, true);
    this.launchHold = P.launchCommitMax;
    this.takeoffTimer = -1;
    this.airTime = 0;
    this.noLand = 0.3;
    this.launchGait = 'takeoff';
    this.setMode('flying');
    this.setGait('takeoff');
    this.deps.events.emit('takeoff', { position: this.model.state.position.clone() });
  }

  /** Walked off a cliff while mounted: spread the wings and fall into flight. */
  private walkOff(): void {
    const w = this.companion.walker;
    w.forward(_fwd);
    const fast = w.speed > this.breed.groundSpeed * 0.6;
    const vel = _v.copy(_fwd).multiplyScalar(Math.max(w.speed, 3.5)).addScaledVector(UP, fast ? P.walkOffHop : 0.8);
    const q = standingOrientation(w.yaw, UP, 0, -8 * DEG, _q);
    this.model.reset(w.position, q, vel);
    this.model.state.wingSpread = 0.45;
    this.model.setGrace(P.walkOffGrace, true);
    // Drop off the edge with the wings half folded, then spread them into the pull-out.
    this.autoTuck = P.walkOffTuckTime;
    this.airTime = 0;
    this.noLand = 0.6;
    this.launchGait = 'jump';
    this.setMode('flying');
    this.setGait('jump');
    this.deps.events.emit('takeoff', { position: this.model.state.position.clone() });
  }

  private startDismount(): void {
    this.mountHoldBlocked = true;
    const w = this.companion.walker;
    const sh = this.breed.standHeight;
    w.forward(_fwd);
    _left.set(_fwd.z, 0, -_fwd.x); // body left = up × forward
    const offset = sh * 0.9 + 0.7;
    let found = false;
    for (const [lx, fz] of [[1, 0], [-1, 0], [0, -1.6], [0.7, -0.9], [-0.7, -0.9]] as const) {
      _v.copy(w.position).addScaledVector(_left, lx * offset).addScaledVector(_fwd, fz * offset);
      const g = this.deps.terrain.groundAt(_v.x, _v.z, w.groundY + 2);
      if (!g || g.normal.y < P.maxSlopeY || Math.abs(g.y - w.groundY) > 1.5) continue;
      this.transTo.set(_v.x, g.y, _v.z);
      found = true;
      break;
    }
    if (!found) this.transTo.copy(w.position).addScaledVector(_left, offset).setY(w.groundY);
    this.seatPosition(this.transFrom);
    w.speed = 0;
    this.companion.standStill();
    this.companion.leash = P.followDistance;
    this.setMode('dismounting');
    this.deps.events.emit('dismount', {});
  }

  private updateDismounting(dt: number): void {
    this.groundRegen(dt);
    this.companion.walker.step(dt, null, 0, this.breed, this.deps.terrain, false);
    this.syncModelFromGround();
    this.groundAnim(0);
    this.setGait('idle');
    const t = clamp01(this.modeTime / P.dismountTime);
    // Hop down off the saddle: hips → feet on the ground, a small arc outward.
    this.arc(this.transFrom, _v2.copy(this.transTo).addScaledVector(UP, P.riderHip), t, 0.5, this.riderPos);
    this.riderPos.y -= P.riderHip * smoothstep(0, 1, t);
    this.riderYaw = this.companion.walker.yaw;
    this.riderMounted = false;
    this.setRiderAction('dismount');
    if (t >= 1) {
      this.foot.place(this.transTo, this.companion.walker.yaw, this.deps.terrain);
      this.setMode('onFoot');
      this.syncRiderFromFoot();
    }
  }

  // --- On foot ----------------------------------------------------------------------------------

  private updateOnFoot(dt: number, input: InputFrame, interact: boolean, jump: boolean): void {
    const t = this.deps.terrain;
    const ev = this.deps.events;
    if (!this.unmountedFlight) this.groundRegen(dt);
    const f = input.foot;
    if (jump && this.skyLance?.rope) this.skyLance.pull();
    const beforeWalk = this.skyLance?.rope ? this.foot.position.clone() : null;
    const r = this.foot.step(dt, { moveX: f.moveX, moveY: f.moveY, sprint: f.sprint, jump }, this.cameraYaw, t);
    if (beforeWalk && this.skyLance?.rope) {
      const lance = this.skyLance, rope = lance.rope!;
      // Walker is the sole integrator. Only collision/tether projection follows it, without gravity.
      moveBody(lance.world, beforeWalk, this.foot.position, this.foot.velocity);
      this.harness.copy(this.foot.position).addScaledVector(UP, LANCE.harnessHeight);
      lance.taut = resolveTether(this.harness, this.foot.velocity, rope, (from, to, velocity) => {
        _v.copy(from).addScaledVector(UP, -LANCE.harnessHeight);
        _v2.copy(to).addScaledVector(UP, -LANCE.harnessHeight);
        moveBody(lance.world, _v, _v2, velocity);
        to.copy(_v2).addScaledVector(UP, LANCE.harnessHeight);
      }, this.foot.grounded);
      this.foot.position.copy(this.harness).addScaledVector(UP, -LANCE.harnessHeight);
      if (this.harness.distanceTo(rope.anchor) > rope.length + ROPE_EPSILON) lance.detach('Contact conflicts with tether');
      // Recheck support after correction; a deliberate jump must never be snapped back down.
      if (this.foot.grounded) {
        const support = t.groundAt(this.foot.position.x, this.foot.position.z, this.foot.position.y);
        this.foot.grounded = !!support && Math.abs(support.y - this.foot.position.y) <= .015;
        if (support && this.foot.grounded) {
          this.foot.groundY = support.y; this.foot.normal.copy(support.normal); this.foot.surface = support.surface;
        }
      }
      if (lance.rope && this.keepTetherClear(lance, beforeWalk, rope.length) && !jump) {
        const support = t.groundAt(this.foot.position.x, this.foot.position.z, this.foot.position.y);
        this.foot.grounded = !!support && Math.abs(support.y-this.foot.position.y) <= .015;
        if (support && this.foot.grounded) { this.foot.groundY = support.y; this.foot.normal.copy(support.normal); this.foot.surface = support.surface; }
      }
      if (r.landed && lance.rope) { lance.detach('Landed'); this.traversalPhase = 'released'; }
      this.foot.speed = Math.hypot(this.foot.velocity.x, this.foot.velocity.z);
    }
    if (r.footstep) ev.emit('footstep', { position: this.foot.position.clone(), surface: this.foot.surface, heavy: false });
    if (r.landed && r.impact > 2) {
      ev.emit('footstep', { position: this.foot.position.clone(), surface: this.foot.surface, heavy: r.impact > 7 });
      if (r.impact > 6) this.landActionTimer = 0.35;
    }
    if (!this.foot.grounded && this.skyLance && (this.skyLance.rope || openDrop(t, this.foot.position))) {
      this.beginTraversal();
      this.syncRiderFromFoot();
      this.setRiderAction(this.foot.velocity.y > 0 ? 'jump' : 'fall');
      return;
    }
    if (!this.foot.grounded && !this.skyLance) {
      const below = t.groundAt(this.foot.position.x, this.foot.position.z, this.foot.position.y);
      if (!below || this.foot.position.y - below.y > P.fallDepth || this.foot.position.y < t.layout.cloudFloor) {
        this.startFall();
        return;
      }
    }
    let groundCall = false;
    if (this.skyLance) {
      this.callTime = input.callHeld && !this.mountHoldBlocked && this.foot.grounded ? this.callTime + dt : 0;
      groundCall = this.callTime + 1e-9 >= LANCE.callHold;
      if (groundCall) { this.callTime = 0; this.mountHoldBlocked = true; }
    }
    if ((interact || groundCall) && !this.deps.interactableNear?.(this.foot.position)) {
      if (this.canMount) {
        this.startMount();
        return;
      }
      if (!this.home.nearStable(this.foot.position)) {
        // Too far to mount: wave and the wyvern comes.
        this.waveTimer = P.waveTime;
        this.companion.called = true;
      }
    }
    if (this.foot.grounded) this.airBoost.stop();
    this.updateIndependentCompanion(dt);
    this.syncRiderFromFoot();
    const fs = this.foot;
    if (this.waveTimer > 0) this.setRiderAction('wave');
    else if (!fs.grounded) this.setRiderAction(fs.velocity.y > 0 ? 'jump' : 'fall');
    else if (this.landActionTimer > 0) this.setRiderAction('land');
    else this.setRiderAction(fs.speed < 0.3 ? 'idle' : fs.speed < (P.walkSpeed + P.runSpeed) / 2 ? 'walk' : 'run');
  }

  private startMount(): void {
    this.mountHoldBlocked = true; this.airBoost.stop();
    this.transFrom.copy(this.foot.position);
    // A wyvern standing a few steps away: the rider covers the gap at a jog before climbing on.
    this.mountDuration = P.mountTime + Math.max(0, this.wyvernDistance - P.mountRange) / P.runSpeed;
    this.companion.walker.speed = 0;
    this.companion.called = false;
    this.companion.standStill();
    this.setMode('mounting');
    this.deps.events.emit('mount', {});
  }

  private updateMounting(dt: number): void {
    this.groundRegen(dt);
    this.companion.walker.step(dt, null, 0, this.breed, this.deps.terrain, false);
    this.syncModelFromGround();
    this.groundAnim(0);
    this.setGait('idle');
    const t = clamp01(this.modeTime / this.mountDuration);
    // Feet travel from the ground up to where they hang when the hips are on the seat.
    this.seatPosition(_v2).addScaledVector(UP, -P.riderHip);
    this.arc(this.transFrom, _v2, smoothstep(0, 1, t), 1.1, this.riderPos);
    this.riderYaw += clamp(angleDelta(this.riderYaw, this.companion.walker.yaw), -6 * dt, 6 * dt);
    this.riderMounted = t >= 0.75;
    this.setRiderAction('mount');
    if (t >= 1) {
      this.landBlend = 1;
      this.takeoffTimer = -1;
      this.stillTime = 0;
      this.setMode('landed');
      this.syncRiderToSeat();
    }
  }

  // --- Falling off an island ---------------------------------------------------------------------

  private startFall(): void {
    this.unmountedFlight = false; this.airBoost.stop();
    const fp = this.foot.position;
    this.setMode('falling');
    this.deps.events.emit('fellOff', { position: fp.clone() });
    // Where the rider will be when the wyvern arrives, and the body position under that seat.
    const tc = P.catchDelay;
    const v = this.foot.velocity;
    const yaw = Math.sqrt(v.x * v.x + v.z * v.z) > 0.5 ? Math.atan2(v.x, v.z) : this.foot.yaw;
    const pred = _v.copy(fp).addScaledVector(v, tc);
    pred.y -= 0.5 * P.footGravity * tc * tc;
    this.bodyUnderSeat(pred, yaw, _v2);
    this.companion.beginSwoop(fp, v, _v2, tc);
  }

  private updateFalling(dt: number): void {
    const t = this.deps.terrain;
    this.foot.fall(dt);
    this.companion.update(dt, this.foot.position, false, this.breed, t, undefined, this.simTime);
    this.syncModelFromCompanion();
    this.syncRiderFromFoot();
    this.setRiderAction('fall');
    // Landed on something below before the wyvern got there.
    const g = t.groundAt(this.foot.position.x, this.foot.position.z, this.foot.position.y + 1);
    if (g && this.foot.position.y <= g.y) {
      this.foot.place(_v.copy(this.foot.position).setY(g.y), this.foot.yaw, t);
      this.landActionTimer = 0.5;
      this.deps.events.emit('footstep', { position: this.foot.position.clone(), surface: g.surface, heavy: true });
      // The wyvern lands nearby instead of catching.
      this.companion.walker.position.copy(this.model.state.position);
      this.companion.walker.groundY = g.y;
      this.companion.standStill();
      this.companion.called = true;
      this.companion.state = 'follow';
      this.setMode('onFoot');
      return;
    }
    if (this.modeTime >= P.catchDelay) this.catchRider();
  }

  private catchRider(): void {
    this.mountHoldBlocked = true; this.airBoost.stop();
    const v = this.foot.velocity;
    const yaw = Math.sqrt(v.x * v.x + v.z * v.z) > 0.5 ? Math.atan2(v.x, v.z) : this.foot.yaw;
    const body = this.bodyUnderSeat(this.foot.position, yaw, _v2);
    _fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    const vel = _v.copy(v).addScaledVector(_fwd, this.model.derived.vStall * 0.9);
    const q = standingOrientation(yaw, UP, 0, -20 * DEG, _q);
    this.model.reset(body, q, vel);
    this.model.setGrace(P.catchGrace);
    this.airTime = 99;
    this.launchGait = 'idle';
    this.setMode('flying');
    this.deps.events.emit('caught', {});
    this.syncRiderToSeat();
  }

  // --- Respawn ----------------------------------------------------------------------------------

  private startRespawn(): void {
    this.respawnPlaced = false;
    this.flapQueued = 0;
    this.setMode('respawning');
  }

  private updateRespawning(dt: number): void {
    // Keep gliding hands-off (quietly) through the fade.
    this.model.step(dt, NEUTRAL, this.deps.env);
    this.copyFlightAnim();
    this.setGait('idle');
    const t = this.modeTime;
    if (!this.respawnPlaced) {
      this.fade = clamp01(t / P.fadeOut);
      if (t >= P.fadeOut) this.placeRespawn();
    } else {
      const u = t - P.fadeOut - P.fadeHold;
      this.fade = u <= 0 ? 1 : 1 - clamp01(u / P.fadeIn);
      if (this.fade <= 0) this.setMode('flying');
    }
    this.syncRiderToSeat();
  }

  private placeRespawn(): void {
    // The last safe ground, if it is still there (a moving home may have carried it off);
    // otherwise home's own fallback.
    const t = this.deps.terrain;
    const g = t.groundAt(this.lastSafe.x, this.lastSafe.z, this.lastSafe.y + 3);
    if (!g || Math.abs(g.y - this.lastSafe.y) > 3) this.lastSafeYaw = this.home.respawn(this.lastSafe);
    const yaw = this.lastSafeYaw;
    const p = _v2.copy(this.lastSafe).addScaledVector(UP, P.respawnHeight + this.breed.standHeight);
    const q = standingOrientation(yaw, UP, 0, 0, _q);
    this.model.reset(p, q, _v.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(this.model.derived.vCruise));
    const s = this.model.state;
    s.stamina = Math.max(s.stamina, 0.6);
    s.winded = false;
    this.model.setGrace(2);
    this.respawnPlaced = true;
    this.airTime = 99;
    this.syncRiderToSeat();
    this.snapInterpolation();
    this.deps.events.emit('respawn', { position: s.position.clone() });
  }

  private updateSafeGround(dt: number): void {
    this.safeTimer += dt;
    if (this.safeTimer < 0.5) return;
    this.safeTimer = 0;
    let x: number, y: number, z: number, yaw: number, ny: number;
    if (this.mode === 'landed') {
      const w = this.companion.walker;
      [x, y, z, yaw, ny] = [w.position.x, w.groundY, w.position.z, w.yaw, w.normal.y];
    } else if (this.mode === 'onFoot' && this.foot.grounded) {
      const f = this.foot;
      [x, y, z, yaw, ny] = [f.position.x, f.position.y, f.position.z, f.yaw, f.normal.y];
    } else return;
    if (ny < 0.85) return;
    // Only well inside an island: respawning over a cliff edge would be no favour.
    const island = this.deps.terrain.islandAt(x, z, y + 1);
    if (!island || island.normRadius(x, z) > 0.8) return;
    this.lastSafe.set(x, y, z);
    this.lastSafeYaw = yaw;
  }

  // --- Rest -------------------------------------------------------------------------------------

  /** On the ground: the meter refills quickly (a landing tops it up in about two seconds). */
  private groundRegen(dt: number): void {
    this.model.regenStamina(dt, 1, P.groundRefill);
  }

  /**
   * Rest and the Rested bonus: after a flight, a moment on the ground (mounted or not) makes the
   * wyvern Rested for a while — more stamina capacity and faster regen — and it shakes out its
   * wings. Never a penalty: the bonus simply fades away.
   */
  private updateRest(dt: number): void {
    const c = this.companion.state;
    const grounded =
      !this.unmountedFlight && (this.mode === 'landed' || ((this.mode === 'onFoot' || this.mode === 'mounting' || this.mode === 'dismounting') && (c === 'idle' || c === 'follow')));
    if ((this.mode === 'flying' || this.unmountedFlight) && this.airTime > P.restFlight) this.flownSinceRest = true;
    if (grounded) {
      this.groundTime += dt;
      // Basking: in sunlight the wyvern warms up a little sooner (never slower at night).
      const restTime = lerp(P.restTime, P.restTimeSun, clamp01(this.daylight()));
      if (this.groundTime >= restTime && this.flownSinceRest) this.grantRested();
    } else this.groundTime = 0;
    this.restedLeft = Math.max(0, this.restedLeft - dt / P.restedDuration);
    const bonus = smoothstep(0, P.restedFade, this.restedLeft);
    this.model.capacity = 1 + P.restedCapacity * bonus;
    this.model.regenMultiplier = 1 + P.restedRegen * bonus;
    if (this.ruffleT >= 0) {
      this.ruffleT += dt;
      // Taking off mid-shake ends it; it plays once, on the ground.
      if (this.ruffleT > P.ruffleTime || this.mode === 'flying' || this.mode === 'falling') this.ruffleT = -1;
    }
  }

  private grantRested(): void {
    this.restedLeft = 1;
    this.flownSinceRest = false;
    this.ruffleT = 0;
    if (this.restedToasts < P.restedToasts) {
      this.restedToasts++;
      // Wyverns are reptiles: by day the rest is basking in the sun, wings spread to it.
      const sun = this.daylight() > 0.5;
      this.deps.events.emit('toast', sun ? SUN_WARMED_TOAST : RESTED_TOAST);
    }
  }

  /** 0..1 how much sun there is (0 without a sky). */
  private daylight(): number {
    return this.deps.daylight?.() ?? 0;
  }

  // --- Shared helpers ---------------------------------------------------------------------------

  private setMode(mode: PlayerMode): void {
    const from = this.mode;
    this.mode = mode;
    this.modeTime = 0;
    if (mode !== 'respawning') this.fade = 0;
    if (this.skyLance && mode !== 'onFoot' && mode !== 'falling' && mode !== 'traversing') {
      this.skyLance.reset(); this.cancelLanceWindup(); this.traversalPhase = 'released';
    }
    this.riderMounted = mode === 'flying' || mode === 'landed' || mode === 'respawning';
    if (this.riderMounted) {this.unmountedFlight = false; this.airBoost.stop(); this.freefallOpen = false;}
    if (mode !== 'traversing') this.airBoost.cancelRequest();
    if (this.riderMounted) this.setRiderAction('mounted');
    if (mode === 'onFoot' || mode === 'landed' || mode === 'mounting' || mode === 'dismounting') this.airborne = false;
    if (from !== mode) this.deps.events.emit('modeChange', { from, to: mode });
  }

  private resetTransitions(): void {
    this.skyLance?.reset();
    this.unmountedFlight = false; this.mountHoldBlocked = false; this.airBoost.reset();
    this.freefallOpen = false; this.freefallSteer = 0;
    this.hasLanceAim = false; this.latchLanceRelease = false; this.blockWindup = false;
    this.callTime = 0; this.freefallTilt = 0; this.traversalPhase = 'released';
    this.latchLance = this.latchRecover = this.prevLance = this.prevRecover = false;
    this.latchJump = this.latchInteract = this.prevJump = this.prevInteract = false;
    this.latchAirAction = this.prevAirAction = false;
    this.contact.reset++;
    this.contact.impact = 0;
    this.takeoffTimer = -1;
    this.respawnPlaced = false;
    this.flapQueued = 0;
    this.autoTuck = 0;
    this.launchHold = 0;
    this.landBlend = 1;
    this.noLand = 0;
    this.waveTimer = 0;
    this.landActionTimer = 0;
    this.fade = 0;
    this.companion.called = false;
    this.companion.leash = P.followDistance;
  }

  private setGait(g: WyvernGait): void {
    if (g === this.gait) return;
    this.gait = g;
    this.gaitStart = this.simTime;
  }

  private setRiderAction(a: RiderAction): void {
    if (a === this.riderAction) return;
    this.riderAction = a;
    this.riderActionStart = this.simTime;
  }

  private gaitForSpeed(speed: number): WyvernGait {
    if (speed < 0.3) return 'idle';
    return speed < this.breed.groundSpeed * P.walkFraction ? 'walk' : 'run';
  }

  /**
   * Footsteps on the visible footfalls, where the model's foot comes down (PlayerDeps.foot): heavy
   * for the feet that carry more than an even share of the weight (GaitProfile.load: the hind
   * feet), lighter for the wing knuckles.
   */
  private wyvernFootsteps(dt: number, moving: boolean): void {
    const w = this.companion.walker;
    const contacts = w.gaitStep(dt, this.breed, moving);
    if (contacts === 0) return;
    const load = gaitProfile(this.breed.id).load;
    for (let i = 0; i < 4; i++) {
      if (!(contacts & (1 << i))) continue;
      this.deps.events.emit('footstep', { position: this.footstepAt(i, new Vector3()), surface: w.surface, heavy: load[i] > 0.25 });
    }
  }

  /**
   * Where foot i's footstep is heard: where the model's foot comes down (PlayerDeps.foot) while
   * that is under the walking body, else the walker's estimate of the foot's spot.
   */
  private footstepAt(i: number, out: Vector3): Vector3 {
    const w = this.companion.walker;
    const sh = this.breed.standHeight;
    const m = this.deps.foot?.(i, out);
    if (m && Math.hypot(m.x - w.position.x, m.z - w.position.z) < 1.5 * sh && Math.abs(m.y - w.groundY) < sh) return m;
    return w.footPosition(i, sh, out);
  }

  /** Camera-relative stick → world direction (length = stick magnitude). */
  private cameraRelative(mx: number, my: number, out: Vector3): Vector3 {
    const s = Math.sin(this.cameraYaw);
    const c = Math.cos(this.cameraYaw);
    return out.set(-c * mx + s * my, 0, s * mx + c * my);
  }

  /** Copy the grounded wyvern (walker) into the physics state. */
  private syncModelFromGround(): void {
    const w = this.companion.walker;
    const s = this.model.state;
    s.position.copy(w.position);
    const stand = standingOrientation(w.yaw, w.normal, gaitProfile(this.breed.id).slopeTilt, 0, _q);
    if (this.mode === 'landed' && this.landBlend < 1) {
      s.orientation.slerpQuaternions(this.touchdownQuat, stand, smoothstep(0, 1, this.landBlend));
    } else s.orientation.copy(stand);
    // (The walk plus the swing of a turn on the haunches.)
    s.velocity.copy(w.velocity);
    s.angularVelocity.set(0, w.turnRate, 0);
    s.airspeed = w.speed;
    s.stall = 0;
    s.flare = 0;
    this.groundY = w.groundY;
  }

  private syncModelFromCompanion(): void {
    const c = this.companion;
    const s = this.model.state;
    // Companion hops use the same authoritative touchdown channel as ridden landings.
    // Without a new contact id the animator can retain feet planted on the departure island.
    if (this.airborne && !c.anim.airborne && (c.state === 'idle' || c.state === 'follow')) {
      this.contact.id++;
      this.contact.impact = Math.max(0,-s.velocity.dot(c.walker.normal));
    }
    s.position.copy(c.walker.position);
    s.orientation.copy(c.orientation);
    s.velocity.copy(c.velocity);
    s.angularVelocity.set(0, c.walker.turnRate, 0);
    s.airspeed = c.velocity.length();
    s.stall = 0;
    this.airborne = c.anim.airborne;
    this.setGait(c.anim.gait);
    this.wingSpread = c.anim.wingSpread;
    this.flapPhase = c.anim.flapPhase;
    this.flapStrength = c.anim.flapStrength;
    this.flare = c.anim.flare;
    this.groundSpeed = c.state === 'idle' || c.state === 'follow' ? c.walker.speed : 0;
    this.groundY = c.walker.groundY;
    this.turnRate = c.walker.turnRate;
    s.flapPhase = this.flapPhase;
    s.wingSpread = this.wingSpread;
  }

  /** Animation channels for a wyvern standing/walking; `crouch` opens the wings for takeoff. */
  private groundAnim(crouch: number): void {
    const w = this.companion.walker;
    this.airborne = false;
    this.wingSpread = lerp(0.22, 1, crouch);
    this.flapPhase = 0;
    this.flapStrength = 0;
    this.flare = 0;
    this.groundSpeed = w.speed;
    this.groundY = w.groundY;
    this.turnRate = w.turnRate;
    this.crouch = crouch;
    const s = this.model.state;
    s.wingSpread = this.wingSpread;
    s.flapPhase = 0;
  }

  /** The saddle seat in the wyvern's body frame: the model's, or an estimate from standHeight. */
  private seatLocal(out: Vector3): Vector3 {
    const fromModel = this.deps.seat?.(out);
    if (fromModel) return fromModel;
    const sh = this.breed.standHeight;
    return out.set(0, SEAT_UP * sh, SEAT_FWD * sh);
  }

  /** World position of the saddle seat for the wyvern's current physics pose. */
  private seatPosition(out: Vector3): Vector3 {
    const s = this.model.state;
    return this.seatLocal(out).applyQuaternion(s.orientation).add(s.position);
  }

  /** Body center that puts the seat under a rider whose feet are at `feet` (level, facing yaw). */
  private bodyUnderSeat(feet: Vector3, yaw: number, out: Vector3): Vector3 {
    const seat = this.seatLocal(_seat);
    const sn = Math.sin(yaw);
    const cs = Math.cos(yaw);
    // Seat (body frame: x left, z forward) turned to the world by yaw, then subtracted.
    return out.set(feet.x - (cs * seat.x + sn * seat.z), feet.y + P.riderHip - seat.y, feet.z - (-sn * seat.x + cs * seat.z));
  }

  private syncRiderToSeat(): void {
    this.seatPosition(this.riderPos);
    this.riderVel.copy(this.model.state.velocity);
    this.riderYaw = yawOf(_fwd.set(0, 0, 1).applyQuaternion(this.model.state.orientation));
  }

  private syncRiderFromFoot(): void {
    this.riderPos.copy(this.foot.position);
    this.riderVel.copy(this.foot.velocity);
    this.riderYaw = this.foot.yaw;
  }

  /** Point along a hop from a to b at t with an arc of `height`. */
  private arc(a: Vector3, b: Vector3, t: number, height: number, out: Vector3): Vector3 {
    out.lerpVectors(a, b, t);
    out.y += Math.sin(Math.PI * t) * height;
    return out;
  }

  private snapInterpolation(): void {
    const s = this.model.state;
    this.prevPosition.copy(s.position);
    this.position.copy(s.position);
    this.prevWyPos.copy(s.position);
    this.prevWyQuat.copy(s.orientation);
    this.keepAnimPrev();
    this.prevRiderPos.copy(this.riderPos);
    this.prevRiderYaw = this.riderYaw;
    this.updateLookTarget(0);
    this.lookFresh = true;
    // Poses and riderPosition are valid immediately, before the next frame.
    this.update(0, 1);
  }

  /**
   * The wyvern's animation channels as they stand now become the previous physics step's: the
   * render pose interpolates them between the last two steps like the body's position, so a
   * frame that ran no step, or two, sees them move on smoothly rather than stand still or jump.
   */
  private keepAnimPrev(): void {
    const s = this.model.state;
    const p = this.prevAnim;
    p.velocity.copy(s.velocity);
    p.angularVelocity.copy(s.angularVelocity);
    p.airspeed = this.animAirspeed();
    p.wingSpread = this.wingSpread;
    p.flapPhase = this.flapPhase;
    p.flapStrength = this.flapStrength;
    p.flare = this.flare;
    p.stall = this.animStall();
  }

  /** Airspeed for the animation: the flight model's in the air, the ground speed otherwise. */
  private animAirspeed(): number {
    const s = this.model.state;
    return this.mode === 'flying' || this.mode === 'respawning' ? s.airspeed : s.velocity.length();
  }

  private animStall(): number {
    return this.mode === 'flying' ? this.model.state.stall : 0;
  }

  /** Rider lean / crouch / brace and wyvern fatigue, smoothed at the physics rate. */
  private updateChannels(dt: number): void {
    const s = this.model.state;
    const b = this.breed;
    let lean = 0;
    let crouch = this.crouch;
    let brace = 0;
    if (this.mode === 'flying' || this.mode === 'respawning') {
      _up.set(0, 1, 0).applyQuaternion(s.orientation);
      _left.set(1, 0, 0).applyQuaternion(s.orientation);
      const bank = Math.atan2(_left.y, _up.y);
      lean = clamp(0.45 * Math.sin(bank) + (0.5 * s.angularVelocity.z) / b.maxRollRate, -1, 1);
      const tuck = clamp01((1 - s.wingSpread) / 0.78);
      crouch = Math.max(tuck, 0.5 * smoothstep(35, 70, s.airspeed));
      brace = Math.max(0.9 * s.flare, clamp01((s.gLoad - 2) / 3), clamp01(this.model.stunned / 0.6));
    } else if (this.mode === 'landed') {
      lean = clamp(-this.turnRate * 0.35, -1, 1);
    } else {
      crouch = 0;
    }
    this.landKick = Math.max(0, this.landKick - dt * 2.5);
    brace = Math.max(brace, this.landKick);
    this.lean = damp(this.lean, lean, 8, dt);
    this.riderCrouch = damp(this.riderCrouch, crouch, 8, dt);
    this.brace = damp(this.brace, brace, 10, dt);
    if (this.mode !== 'landed') this.crouch = Math.max(0, this.crouch - dt * 4);
    const tired = s.winded ? Math.max(0.75, 1 - s.stamina) : clamp01((1 - s.stamina - 0.2) / 0.8);
    this.fatigue = damp(this.fatigue, tired, 2, dt);
  }

  /** Where the wyvern's head wants to look this step (world). */
  private updateLookTarget(dt: number): void {
    const s = this.model.state;
    const p = s.position;
    const out = this.lookTarget;
    const riderHead = _v.copy(this.riderPos).addScaledVector(UP, this.riderMounted ? 0.8 : 1.6);
    if (this.mode === 'flying' || this.mode === 'respawning') {
      // Lead into turns: the head swings toward where the flight path is going.
      _fwd.set(0, 0, 1).applyQuaternion(s.orientation);
      _up.set(0, 1, 0).applyQuaternion(s.orientation);
      _left.set(1, 0, 0).applyQuaternion(s.orientation);
      const w = s.angularVelocity;
      out.copy(_fwd)
        .addScaledVector(_left, clamp(w.y * 0.9 - w.z * 0.25, -0.9, 0.9))
        .addScaledVector(_up, clamp(-w.x * 0.6, -0.5, 0.6));
      if (s.velocity.lengthSq() > 4) out.addScaledVector(_v2.copy(s.velocity).normalize(), 0.6);
      out.normalize().multiplyScalar(40).add(p);
      return;
    }
    if (this.mode === 'mounting' || this.mode === 'dismounting' || this.mode === 'falling' || this.mode === 'traversing') {
      out.copy(riderHead);
      return;
    }
    if (this.mode === 'landed') {
      // Look where the camera looks (within reason), or along the way it's walking.
      const w = this.companion.walker;
      let yaw = this.cameraYaw;
      if (w.speed > 1) yaw = w.yaw + clamp(w.turnRate * 0.6, -0.8, 0.8);
      const rel = clamp(angleDelta(w.yaw, yaw), -1.6, 1.6);
      out.set(Math.sin(w.yaw + rel), 0, Math.cos(w.yaw + rel)).multiplyScalar(30).add(p);
      out.y = p.y + 1.5;
      return;
    }
    // On foot: watch the rider when they're close; otherwise look around.
    const d = this.wyvernDistance;
    if (d < 16 || this.companion.state !== 'idle' || this.waveTimer > 0) {
      out.copy(riderHead);
      return;
    }
    this.idleLookTimer -= dt;
    if (this.idleLookTimer <= 0) {
      const rnd = mulberry32(hashSeed(this.idleLookCount++, 7.3));
      this.idleLookTimer = 2.5 + rnd() * 3;
      const yaw = this.companion.walker.yaw + (rnd() - 0.5) * 2.6;
      const dist = 12 + rnd() * 50;
      const r = rnd();
      if (r < 0.25) this.idleLook.copy(riderHead);
      else this.idleLook.set(p.x + Math.sin(yaw) * dist, p.y + (rnd() - 0.3) * 8, p.z + Math.cos(yaw) * dist);
    }
    out.copy(this.idleLook);
  }

  // --- Presentation -----------------------------------------------------------------------------

  update(dt: number, alpha: number): void {
    const s = this.model.state;
    const a = clamp01(alpha);
    const wp = this.wyvernPose;
    wp.touchdown = this.contact;
    wp.position.lerpVectors(this.prevWyPos, s.position, a);
    wp.orientation.slerpQuaternions(this.prevWyQuat, s.orientation, a);
    if (!this.airborne && this.crouch > 0) wp.position.y -= this.crouch * 0.22 * this.breed.standHeight;
    wp.airborne = this.airborne;
    // The animation channels, interpolated between the last two physics steps like the body: at a
    // frame rate that isn't a multiple of the physics rate, raw values would stand still on one
    // frame and jump two steps on the next (the beat's phase, its heave, the velocity the
    // animator differentiates into an acceleration).
    const pa = this.prevAnim;
    wp.velocity.lerpVectors(pa.velocity, s.velocity, a);
    wp.airspeed = lerp(pa.airspeed, this.animAirspeed(), a);
    wp.angularVelocity.lerpVectors(pa.angularVelocity, s.angularVelocity, a);
    wp.wingSpread = lerp(pa.wingSpread, this.wingSpread, a);
    wp.flapPhase = phaseLerp(pa.flapPhase, this.flapPhase, a);
    wp.flapStrength = lerp(pa.flapStrength, this.flapStrength, a);
    wp.flare = lerp(pa.flare, this.flare, a);
    wp.stall = lerp(pa.stall, this.animStall(), a);
    wp.fatigue = this.fatigue;
    wp.gait = this.gait;
    wp.gaitTime = this.simTime - this.gaitStart;
    wp.gaitPhase = this.companion.walker.gaitPhase;
    wp.ruffle = this.ruffleT >= 0 ? clamp01(this.ruffleT / P.ruffleTime) : 0;
    wp.groundSpeed = this.airborne ? 0 : this.groundSpeed;
    wp.groundY = this.groundY;
    // The stick and the air at the wingtips, for the animation's leads and gust response.
    const inAir = this.mode === 'flying' || this.mode === 'respawning';
    const ctl = wp.control!;
    ctl.pitch = inAir ? this.flightIn.pitch : 0;
    ctl.roll = inAir ? this.flightIn.roll : 0;
    ctl.yaw = inAir ? this.flightIn.yaw : 0;
    const tips = this.model.tipUpdraft;
    wp.gust!.l = inAir ? tips.l : 0;
    wp.gust!.r = inAir ? tips.r : 0;
    wp.beatAmp = inAir ? this.model.beatAmp : 1;
    wp.sideLag = inAir ? this.model.sideLag : 0;
    wp.cue!.id = this.companion.greetings;
    if (this.lookFresh) {
      this.lookSmooth.copy(this.lookTarget);
      this.lookFresh = false;
    } else {
      const k = 1 - Math.exp(-6 * dt);
      this.lookSmooth.lerp(this.lookTarget, k);
    }
    wp.lookTarget.copy(this.lookSmooth);

    const rp = this.riderPose;
    rp.equipment = this.skyLance && !this.riderMounted
      ? this.skyLance.rope ? 'tether' : 'bracer' : undefined;
    rp.lanceCharge = 0;
    const equipment = this.skyLance;
    rp.lanceMotion = equipment && !this.riderMounted
      ? equipment.state === 'spent' ? 'recover' : equipment.castAge < LANCE.castTime ? 'cast' : undefined : undefined;
    rp.lanceMotionT = equipment ? equipment.state === 'spent' ? Math.min(1, equipment.age / LANCE.recoveryTime) : Math.min(1, equipment.castAge / LANCE.castTime) : 0;
    rp.lineTension = equipment?.taut ? 1 : 0;
    rp.freefallTilt = this.mode === 'traversing' && this.freefallOpen && !this.skyLance?.rope && this.foot.velocity.y <= -.5 ? this.freefallTilt : undefined;
    rp.freefallSteer = rp.freefallTilt !== undefined ? this.freefallSteer : 0;
    rp.airBoost = this.skyLance && this.airBoost.remaining > 0 ? this.airBoost.remaining / LANCE.boostDuration : 0;
    rp.mounted = this.riderMounted;
    if (this.riderMounted) {
      this.seatLocal(rp.position).applyQuaternion(wp.orientation).add(wp.position);
      rp.yaw = yawOf(_fwd.set(0, 0, 1).applyQuaternion(wp.orientation));
    } else {
      rp.position.lerpVectors(this.prevRiderPos, this.riderPos, a);
      rp.yaw = this.prevRiderYaw + angleDelta(this.prevRiderYaw, this.riderYaw) * a;
    }
    rp.velocity.copy(this.riderVel);
    rp.action = this.riderMounted && this.mode !== 'mounting' ? 'mounted' : this.riderAction;
    rp.actionTime = this.simTime - this.riderActionStart;
    rp.lean = this.riderMounted ? this.lean : 0;
    rp.crouch = this.riderMounted ? this.riderCrouch : 0;
    rp.brace = this.riderMounted ? this.brace : 0;
    this.deps.env.windAt(rp.position, rp.airflow);
    rp.airflow.sub(rp.velocity);
    this.riderPosition.copy(rp.position);
  }
}

export { createFlightState, createRiderPose, createWyvernPose };
