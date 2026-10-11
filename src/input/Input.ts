// Keyboard, mouse and gamepad → one InputFrame per rendered frame.
//
// The controller is the primary device: sticks get a radial deadzone, flight axes a square map
// and an expo curve so small corrections are precise, triggers are analog. Keyboard flight keys
// ramp in and out so they are never twitchy (pitch more gently still: taps trim, holds commit).
// Optional mouse steering turns mouse travel into a virtual stick in flight. Both devices are
// always read and merged (the stronger deflection wins); `device` only says which one was used
// LAST, for button prompts, and it switches on deliberate actions only (presses, real stick
// throws, real mouse travel), never on stick noise. Pads without the standard mapping are read
// through a best-guess remap (padMapping.ts).
//
// Bindings come from scheme.ts (the single source of truth). Rumble patterns are mixed here
// (Input owns the actuator) and fed by haptics.ts.

import type { GameEventBus } from '../core/events';
import type { InputDevice, InputFrame, InputPresses, Settings } from '../core/types';
import type { InputSystem } from '../game/contracts';
import { clamp } from '../core/math';
import { KEYS, PAD, PAD_AXIS, PAD_BUTTON, type PadButton } from './scheme';
import {
  BumperChord,
  MouseStick,
  RepeatTimer,
  SHAPING,
  StickNav,
  TapPulse,
  circleToSquare,
  detectPadStyle,
  dominant,
  expo,
  keyPitchTarget,
  radialDeadzone,
  rampAxis,
  triggerDeadzone,
  wheelNotches,
  type PadStyle,
  type Vec2,
} from './shaping';
import { createPadMapState, createPadView, mapPad, type PadMapState, type PadView } from './padMapping';
import { HapticMixer, type RumbleLevels, type RumblePulse, type RumbleSink } from './haptics';

export function emptyPresses(): InputPresses {
  return {
    confirm: false, back: false, interact: false, pause: false, restart: false, jump: false,
    navUp: false, navDown: false, navLeft: false, navRight: false, tabPrev: false, tabNext: false,
    recenter: false, toggleHud: false, lance: false, lanceRelease: false, recoverLance: false, airAction: false,
  };
}

export function emptyFrame(): InputFrame {
  return {
    device: 'keyboard',
    flight: { pitch: 0, roll: 0, yaw: 0, flap: 0, tuck: 0, flare: 0 },
    foot: { moveX: 0, moveY: 0, sprint: false },
    lookX: 0,
    lookY: 0,
    lookIsRate: false,
    lookActive: false,
    zoom: 0,
    jumpHeld: false,
    pressed: emptyPresses(),
  };
}

/**
 * Radians of camera turn per pixel of mouse travel at look sensitivity 1. Mouse look arrives in
 * InputFrame.lookX/Y already multiplied by this and the sensitivity (lookIsRate = false).
 */
export const MOUSE_RAD_PER_PX = 0.0022;
/** Mouse travel (px, decaying) that counts as "switched to the mouse". */
const MOUSE_SWITCH_CAPTURED = 6;
const MOUSE_SWITCH_FREE = 40;
/** Zoom rate (notches per second) from fully pulled triggers outside play. */
const TRIGGER_ZOOM_RATE = 2.5;
/** Keys whose browser default (scrolling, focus moves, history back) must not fire in-game. */
const PREVENT_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace']);
const BUTTON_COUNT = 17;

const noop = () => {};

/** The bits of GamepadHapticActuator we use, typed loosely across browser versions. */
interface HapticActuatorLike {
  effects?: readonly string[];
  playEffect?(type: string, params: Record<string, number>): Promise<unknown>;
  reset?(): Promise<unknown>;
  pulse?(value: number, duration: number): Promise<unknown>;
}

function isEditable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export class Input implements InputSystem, RumbleSink {
  readonly frame: InputFrame = emptyFrame();
  device: InputDevice = 'keyboard';
  padStyle: PadStyle | null = null;
  /** True while the mouse is captured for look (pointer lock). */
  pointerLocked = false;
  /**
   * Set by Game each frame: the player is in the air. Mouse steering (Settings.mouseFlight) only
   * takes the mouse in flight; on the ground it still looks around.
   */
  flying = false;
  /** Independent rider context; RT retains its flight/menu roles outside traversal. */
  traversal = false;
  /** LT stays flare on a wyvern and cannot jump on foot. */
  airborneTraversal = false;
  private previousTraversal = false;
  private lanceArmed = true;
  private previousAirborneTraversal = false;
  private airActionArmed = true;
  private lanceTrigger = false;
  private airTrigger = false;
  private traversalPadSource = '';

  private target: HTMLElement;
  private settings: () => Settings;
  private events?: GameEventBus;

  // Keyboard + mouse buttons (Mouse0..2 only while captured), as KeyboardEvent.code values.
  private keys = new Set<string>();
  private keysDown = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private wheel = 0;
  private dragButton = -1;
  private mouseTravel = 0;
  private kbActivityAt = -1;
  private padActivityAt = -1;

  // Pointer lock bookkeeping.
  private wantLock = false;
  private releasing = false;
  private escAt = -1e9;
  private pendingPause = false;

  // Gamepads, read in standard layout (padMapping.ts remaps the rest). Per pad index: held state
  // this poll and last poll.
  private padIndex = -1;
  private pad: Gamepad | null = null;
  private padView: PadView = createPadView();
  private views: PadView[] = [];
  private mapStates: PadMapState[] = [];
  private guessWarned = new Set<string>();
  private padHeld: boolean[][] = [];
  private padPrev: boolean[][] = [];
  private padStickPrev: number[][] = [];

  // Shaping state.
  private rampPitch = 0;
  private rampRoll = 0;
  private rampYaw = 0;
  private kbPitchDir = 0;
  private kbPitchHeld = 0;
  private bumpers = new BumperChord();
  private mouseStick = new MouseStick();
  private tap = new TapPulse();
  private sprintLatch = false;
  private sprintIdle = 0;
  private stickNav = new StickNav();
  private repeat = { up: new RepeatTimer(), down: new RepeatTimer(), left: new RepeatTimer(), right: new RepeatTimer() };
  private ls: Vec2 = { x: 0, y: 0 };
  private rs: Vec2 = { x: 0, y: 0 };
  private sq: Vec2 = { x: 0, y: 0 };

  private scripted: Partial<InputFrame> | null = null;

  // Haptics.
  private mixer = new HapticMixer();
  private levels: RumbleLevels = { strong: 0, weak: 0, left: 0, right: 0 };
  private sent: RumbleLevels = { strong: 0, weak: 0, left: 0, right: 0 };
  private sentAt = -1e9;
  private sentPad: Gamepad | null = null;

  constructor(target: HTMLElement, settings: () => Settings, events?: GameEventBus) {
    this.target = target;
    this.settings = settings;
    this.events = events;
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      // macOS swallows keyups for other keys while Cmd is held; drop everything when it lifts.
      if (e.key === 'Meta') this.keys.clear();
    });
    // Losing focus mid-flight (alt-tab on a controller, a notification) pauses, like losing the
    // captured mouse does; and nothing stays "held" while we can't see the key going up.
    window.addEventListener('blur', () => this.focusLost());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.focusLost();
    });

    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    target.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mouseup', (e) => {
      this.keys.delete(`Mouse${e.button}`);
      if (e.button === this.dragButton) this.dragButton = -1;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener(
      'wheel',
      (e) => {
        this.wheel += wheelNotches(e.deltaY, e.deltaMode);
        this.kbActivityAt = now();
      },
      { passive: true },
    );
    document.addEventListener('pointerlockchange', () => this.onLockChange());

    window.addEventListener('gamepadconnected', (e) => this.onPadConnected(e.gamepad));
    window.addEventListener('gamepaddisconnected', (e) => this.onPadDisconnected(e.gamepad));
  }

  // --- InputSystem ---------------------------------------------------------------------------

  setPointerLock(on: boolean): void {
    this.wantLock = on;
    if (on) this.requestLock();
    else this.releaseLock();
  }

  setScripted(frame: Partial<InputFrame> | null): void {
    this.scripted = frame;
  }

  rumble(strong: number, weak: number, durationMs: number): void {
    this.pulse({ strong, weak, ms: Math.max(1, durationMs), attackMs: 0, shape: 'flat' });
  }

  /** RumbleSink: queue one enveloped pulse (haptics.ts plays its patterns through this). */
  pulse(p: RumblePulse, delayMs = 0): void {
    if (!this.settings().rumble) return;
    this.mixer.add(p, delayMs);
  }

  /**
   * Mark this frame's presses as handled so nothing later in the same frame acts on them again
   * (e.g. the press that opened the pause menu must not also close it).
   */
  consume(): void {
    const p = this.frame.pressed as unknown as Record<string, boolean>;
    for (const k in p) p[k] = false;
  }

  /** True while play wants the mouse captured (click the view to capture it). */
  get pointerLockWanted(): boolean {
    return this.wantLock;
  }

  private previousLanceHeld = false;

  poll(dt: number): InputFrame {
    const s = this.settings();
    const f = this.frame;
    const p = f.pressed;
    f.aim = undefined;
    this.readPads();
    const pad = this.pad;

    // --- Gamepad axes and triggers ----------------------------------------------------------
    let rt = 0;
    let lt = 0;
    if (pad) {
      const v = this.padView;
      const ax = v.axes;
      radialDeadzone(ax[PAD_AXIS.LX] ?? 0, ax[PAD_AXIS.LY] ?? 0, SHAPING.stickInner, SHAPING.stickOuter, this.ls);
      radialDeadzone(ax[PAD_AXIS.RX] ?? 0, ax[PAD_AXIS.RY] ?? 0, SHAPING.stickInner, SHAPING.stickOuter, this.rs);
      rt = triggerDeadzone(v.buttons[PAD_BUTTON.RT]?.value ?? 0);
      lt = triggerDeadzone(v.buttons[PAD_BUTTON.LT]?.value ?? 0);
    } else {
      this.ls.x = this.ls.y = this.rs.x = this.rs.y = 0;
    }

    // --- Flight -------------------------------------------------------------------------------
    // Keyboard: ramped digital axes. +pitch = nose up, so W (forward) pitches the nose down.
    // Pitch is shaped further (taps trim, a held key commits after ~0.55 s): a big body doesn't bunt.
    const kbPitch = (this.held(KEYS.pitchUp) ? 1 : 0) - (this.held(KEYS.pitchDown) ? 1 : 0);
    if (kbPitch !== 0 && kbPitch === this.kbPitchDir) this.kbPitchHeld += dt;
    else {
      this.kbPitchDir = kbPitch;
      this.kbPitchHeld = 0;
    }
    const kbRoll = (this.held(KEYS.rollRight) ? 1 : 0) - (this.held(KEYS.rollLeft) ? 1 : 0);
    // Pad shoulders: either alone is rudder, both together tuck (scheme.ts design notes).
    const chord = this.bumpers.update(this.padHeldAny(PAD.yawLeft), this.padHeldAny(PAD.yawRight), dt);
    const yawTarget = (this.held(KEYS.yawRight) || chord.right ? 1 : 0) - (this.held(KEYS.yawLeft) || chord.left ? 1 : 0);
    this.rampPitch = rampAxis(this.rampPitch, keyPitchTarget(kbPitch, this.kbPitchHeld), dt, SHAPING.keyPitchAttack, SHAPING.keyRelease);
    this.rampRoll = rampAxis(this.rampRoll, kbRoll, dt);
    this.rampYaw = rampAxis(this.rampYaw, yawTarget, dt);

    // Stick: square-mapped so a full diagonal is full pitch AND full roll, then expo.
    // Raw stick Y is +1 pulled back, which is nose up — the flight-sim convention.
    this.sq.x = this.ls.x;
    this.sq.y = this.ls.y;
    circleToSquare(this.sq);
    const padPitch = expo(this.sq.y, SHAPING.flightExpo);
    const padRoll = expo(this.sq.x, SHAPING.flightExpo);

    // Mouse steering (optional): captured mouse in flight → a virtual stick; middle button held
    // looks around instead. On the ground, and without it, the mouse only ever looks.
    const steering = !!s.mouseFlight && this.flying && this.pointerLocked && !this.held(KEYS.freeLook);
    if (steering) this.mouseStick.update(this.mouseDX, this.mouseDY, s.lookSensitivity, dt);
    else if (!this.flying || !s.mouseFlight) this.mouseStick.reset();
    else this.mouseStick.update(0, 0, s.lookSensitivity, dt);

    // Inverts are per device (falling back to the shared invertPitch).
    const padInv = (s.invertPitchPad ?? s.invertPitch) ? -1 : 1;
    const keyInv = (s.invertPitchKeys ?? s.invertPitch) ? -1 : 1;
    const fl = f.flight;
    fl.pitch = dominant(dominant(this.rampPitch * keyInv, padPitch * padInv), this.mouseStick.y * keyInv);
    fl.roll = dominant(dominant(this.rampRoll, padRoll), this.mouseStick.x);
    fl.yaw = this.rampYaw;
    const flapRaw = Math.max(rt, this.held(KEYS.flap) ? 1 : 0);
    fl.flap = s.holdToFlap ? flapRaw : this.tap.update(flapRaw, dt);
    fl.flare = Math.max(lt, this.held(KEYS.flare) ? 1 : 0);
    fl.tuck = this.held(KEYS.tuck) || chord.tuck ? 1 : 0;

    // --- On foot ------------------------------------------------------------------------------
    let kx = (this.held(KEYS.moveRight) ? 1 : 0) - (this.held(KEYS.moveLeft) ? 1 : 0);
    let ky = (this.held(KEYS.moveForward) ? 1 : 0) - (this.held(KEYS.moveBack) ? 1 : 0);
    if (kx !== 0 && ky !== 0) {
      kx *= Math.SQRT1_2;
      ky *= Math.SQRT1_2;
    }
    const ft = f.foot;
    if (kx !== 0 || ky !== 0) {
      ft.moveX = kx;
      ft.moveY = ky;
    } else {
      ft.moveX = this.ls.x;
      ft.moveY = -this.ls.y;
    }
    // L3 latches a run until the stick comes back to rest for a moment.
    if (this.padPressedAny(PAD.sprintLatch)) this.sprintLatch = !this.sprintLatch;
    if (Math.hypot(this.ls.x, this.ls.y) < 0.15) {
      this.sprintIdle += dt;
      if (this.sprintIdle > 0.3) this.sprintLatch = false;
    } else {
      this.sprintIdle = 0;
    }
    ft.sprint = this.held(KEYS.sprint) || this.padHeldAny(PAD.sprint) || this.sprintLatch;
    f.jumpHeld = this.held(KEYS.jump) || this.padHeldAny(PAD.jump);

    // --- Look -------------------------------------------------------------------------------
    const rmag = Math.hypot(this.rs.x, this.rs.y);
    if (rmag > 0) {
      const k = (expo(rmag, SHAPING.lookExpo) / rmag) * s.lookSensitivity;
      f.lookX = this.rs.x * k;
      f.lookY = this.rs.y * k;
      f.lookIsRate = true;
      f.lookActive = true;
    } else if (steering) {
      // The mouse is flying the wyvern; the camera holds its chase framing.
      f.lookX = f.lookY = 0;
      f.lookIsRate = false;
      f.lookActive = false;
    } else {
      const k = MOUSE_RAD_PER_PX * s.lookSensitivity;
      f.lookX = this.mouseDX * k;
      f.lookY = this.mouseDY * k;
      f.lookIsRate = false;
      f.lookActive = this.mouseDX !== 0 || this.mouseDY !== 0;
    }
    if (s.invertLookY) f.lookY = -f.lookY;
    this.mouseDX = this.mouseDY = 0;
    this.mouseTravel *= Math.exp(-4 * dt);

    // Wheel always zooms; triggers zoom only outside play (in play they fly).
    f.zoom = this.wheel + (this.wantLock ? 0 : (rt - lt) * TRIGGER_ZOOM_RATE * dt);
    this.wheel = 0;

    // --- Presses ------------------------------------------------------------------------------
    const source = pad ? `${pad.index}:${pad.id}` : '';
    const padChanged = source !== this.traversalPadSource;
    this.traversalPadSource = source;
    const rtValue = pad ? this.padView.buttons[PAD_BUTTON[PAD.lance[0]]]?.value ?? 0 : 0;
    const ltValue = pad ? this.padView.buttons[PAD_BUTTON[PAD.airAction[0]]]?.value ?? 0 : 0;
    const previousRt = this.lanceTrigger, previousLt = this.airTrigger;
    // Hysteresis belongs only to discrete rider actions; mounted analog flight is unchanged.
    this.lanceTrigger = rtValue >= .55 || (this.lanceTrigger && rtValue > .2);
    this.airTrigger = ltValue >= .55 || (this.airTrigger && ltValue > .2);
    let keyboardLanceHeld = false;
    for (const code of KEYS.lance) keyboardLanceHeld ||= this.keys.has(code);
    const rawLanceHeld = this.lanceTrigger || keyboardLanceHeld;
    if (this.traversal !== this.previousTraversal || padChanged) {
      this.lanceArmed = !keyboardLanceHeld && rtValue <= .2;
    }
    if (!rawLanceHeld && rtValue <= .2) this.lanceArmed = true;
    f.lanceHeld = this.traversal && this.lanceArmed && rawLanceHeld;
    f.callHeld = this.held(KEYS.interact) || this.padHeldAny(PAD.interact);
    // Keep an existing hold across a menu/context suspension. Deliver its physical release
    // when gameplay owns input again; a filtered/unarmed hold is not a release.
    p.lanceRelease = this.traversal && this.previousLanceHeld && !rawLanceHeld;
    p.lance = this.traversal && this.lanceArmed &&
      (this.down(KEYS.lance) || (this.lanceTrigger && !previousRt));
    // A buffered keyboard tap may begin and end between render polls.
    p.lanceRelease ||= !!p.lance && !rawLanceHeld;
    this.previousLanceHeld = !!f.lanceHeld || (this.previousLanceHeld && (!this.traversal || rawLanceHeld));
    this.previousTraversal = this.traversal;
    if (this.airborneTraversal !== this.previousAirborneTraversal || padChanged) this.airActionArmed = ltValue <= .2;
    if (ltValue <= .2) this.airActionArmed = true;
    p.airAction = this.airborneTraversal && this.airActionArmed && this.airTrigger && !previousLt;
    this.previousAirborneTraversal = this.airborneTraversal;
    p.recoverLance = this.traversal && (this.down(KEYS.recoverLance) || this.padPressedAny(PAD.recoverLance));
    p.confirm = this.down(KEYS.confirm) || this.padPressedAny(PAD.confirm);
    p.jump = this.down(KEYS.jump) || this.padPressedAny(PAD.jump);
    p.back = this.down(KEYS.back) || this.padPressedAny(PAD.back);
    p.pause = this.down(KEYS.pause) || this.padPressedAny(PAD.pause) || this.pendingPause;
    p.interact = this.down(KEYS.interact) || this.padPressedAny(PAD.interact);
    p.restart = this.down(KEYS.restart) || this.padPressedAny(PAD.restart);
    p.recenter = this.down(KEYS.recenter) || this.padPressedAny(PAD.recenter);
    p.toggleHud = this.down(KEYS.toggleHud) || this.padPressedAny(PAD.toggleHud);
    p.tabPrev = this.down(KEYS.tabPrev) || this.padPressedAny(PAD.tabPrev);
    p.tabNext = this.down(KEYS.tabNext) || this.padPressedAny(PAD.tabNext);
    this.pendingPause = false;

    const nav = this.stickNav.update(this.ls.x, this.ls.y);
    p.navUp = this.repeat.up.update(this.held(KEYS.navUp) || this.padHeldAny(PAD.navUp) || nav === 'up', dt);
    p.navDown = this.repeat.down.update(this.held(KEYS.navDown) || this.padHeldAny(PAD.navDown) || nav === 'down', dt);
    p.navLeft = this.repeat.left.update(this.held(KEYS.navLeft) || this.padHeldAny(PAD.navLeft) || nav === 'left', dt);
    p.navRight = this.repeat.right.update(this.held(KEYS.navRight) || this.padHeldAny(PAD.navRight) || nav === 'right', dt);

    this.keysDown.clear();
    this.commitPads();

    // --- Device (for prompts): last deliberate use wins --------------------------------------
    if (this.pad && this.padActivityAt > this.kbActivityAt) this.device = 'gamepad';
    else if (!this.pad || this.kbActivityAt > this.padActivityAt) this.device = 'keyboard';
    f.device = this.device;

    if (this.scripted) this.applyScripted(this.scripted);

    this.flushHaptics(dt, s);
    return f;
  }

  // --- Keyboard / mouse -----------------------------------------------------------------------

  private held(codes: readonly string[]): boolean {
    for (let i = 0; i < codes.length; i++) if (this.keys.has(codes[i]) || this.keysDown.has(codes[i])) return true;
    return false;
  }

  private down(codes: readonly string[]): boolean {
    for (let i = 0; i < codes.length; i++) if (this.keysDown.has(codes[i])) return true;
    return false;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (isEditable(e.target)) return;
    const code = e.code;
    if (!code) return;
    if (!e.repeat) {
      if (!this.keys.has(code)) this.keysDown.add(code);
      this.kbActivityAt = now();
    }
    this.keys.add(code);
    if (code === 'Escape') this.escAt = now();
    if (PREVENT_DEFAULT.has(code)) e.preventDefault();
  }

  private onMouseMove(e: MouseEvent): void {
    // Some platforms report a huge jump on the first event after capture; ignore spikes.
    const mx = clamp(e.movementX || 0, -300, 300);
    const my = clamp(e.movementY || 0, -300, 300);
    const steering = this.pointerLocked || this.dragButton >= 0;
    if (steering) {
      this.mouseDX += mx;
      this.mouseDY += my;
    }
    this.mouseTravel += Math.abs(mx) + Math.abs(my);
    if (this.mouseTravel > (steering ? MOUSE_SWITCH_CAPTURED : MOUSE_SWITCH_FREE)) this.kbActivityAt = now();
  }

  private onMouseDown(e: MouseEvent): void {
    this.kbActivityAt = now();
    if (this.pointerLocked) {
      // Captured: mouse buttons are game buttons (left flaps, right flares, middle recenters).
      const code = `Mouse${e.button}`;
      if (!this.keys.has(code)) this.keysDown.add(code);
      this.keys.add(code);
      e.preventDefault();
      return;
    }
    if (e.button === 0 && this.wantLock) {
      // Click the view to capture the mouse for look. This click does not flap.
      this.requestLock();
      return;
    }
    if (e.button === 1) {
      this.keysDown.add('Mouse1'); // middle click recenters even without capture
      e.preventDefault(); // no autoscroll
      return;
    }
    // Uncaptured look: right-drag in play; any drag in menus / the stable.
    if (e.button === 2 || (e.button === 0 && !this.wantLock)) this.dragButton = e.button;
  }

  private focusLost(): void {
    this.releaseAll();
    if (this.wantLock) this.pendingPause = true;
  }

  private releaseAll(): void {
    this.keys.clear();
    this.keysDown.clear();
    this.dragButton = -1;
    this.mouseDX = this.mouseDY = 0;
    this.kbPitchHeld = 0;
    this.bumpers.reset();
    this.mouseStick.reset();
  }

  // --- Pointer lock -------------------------------------------------------------------------

  private requestLock(): void {
    if (typeof document === 'undefined' || this.pointerLocked) return;
    const el = this.target as HTMLElement & {
      requestPointerLock(options?: { unadjustedMovement?: boolean }): Promise<void> | void;
    };
    if (typeof el.requestPointerLock !== 'function') return;
    try {
      // Raw (unaccelerated) mouse motion where supported; fall back to the plain request.
      const r = el.requestPointerLock({ unadjustedMovement: true });
      if (r && typeof r.then === 'function') {
        r.catch(() => {
          if (!this.wantLock || this.pointerLocked) return;
          try {
            const r2 = el.requestPointerLock();
            if (r2 && typeof r2.catch === 'function') r2.catch(noop);
          } catch {
            /* needs a user gesture; the next click on the view will capture */
          }
        });
      }
    } catch {
      /* needs a user gesture; the next click on the view will capture */
    }
  }

  private releaseLock(): void {
    if (typeof document === 'undefined') return;
    if (document.pointerLockElement === this.target) {
      this.releasing = true;
      document.exitPointerLock();
    }
  }

  private onLockChange(): void {
    const was = this.pointerLocked;
    this.pointerLocked = document.pointerLockElement === this.target;
    if (this.pointerLocked && !this.wantLock) {
      // A lock granted after nobody wants it any more (asked for on the way through 'play', e.g.
      // leaving a Stable opened from the title): hand the mouse straight back.
      this.releasing = true;
      document.exitPointerLock();
      return;
    }
    if (was && !this.pointerLocked) {
      this.keys.delete('Mouse0');
      this.keys.delete('Mouse1');
      this.keys.delete('Mouse2');
      if (this.releasing) {
        this.releasing = false;
      } else if (this.wantLock && now() - this.escAt > 300) {
        // The browser took the mouse back (an Esc it swallowed, alt-tab, a system dialog): pause.
        // If Esc did reach us it already produced the pause press; don't send a second one.
        this.pendingPause = true;
      }
    }
  }

  // --- Gamepads -------------------------------------------------------------------------------

  private readPads(): void {
    this.pad = null;
    let list: (Gamepad | null)[] | null = null;
    try {
      list = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : null;
    } catch {
      list = null; // insecure context or blocked by permissions policy
    }
    if (!list) {
      this.padStyle = null;
      return;
    }
    let first = -1;
    const t = now();
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      if (!g || !g.connected) continue;
      if (first < 0) first = i;
      const held = (this.padHeld[i] ??= new Array<boolean>(BUTTON_COUNT).fill(false));
      const prev = (this.padPrev[i] ??= new Array<boolean>(BUTTON_COUNT).fill(false));
      const sticks = (this.padStickPrev[i] ??= [0, 0]);
      // Standard layout, whatever the driver reports (GAMEPAD-01).
      const view = mapPad(g, (this.mapStates[i] ??= createPadMapState()), (this.views[i] ??= createPadView()));
      if (view.guessed && !this.guessWarned.has(g.id)) {
        this.guessWarned.add(g.id);
        this.events?.emit('toast', {
          text: 'Controller layout guessed',
          sub: 'If buttons feel wrong, try an Xbox / PlayStation pad in Chrome or Edge',
          icon: 'info',
        });
      }
      let active = false;
      for (let b = 0; b < BUTTON_COUNT; b++) {
        const btn = view.buttons[b];
        // Triggers count as "held" past half travel; their analog value is read separately.
        const isTrigger = b === PAD_BUTTON.LT || b === PAD_BUTTON.RT;
        held[b] = btn ? (isTrigger ? btn.value > 0.5 : btn.pressed) : false;
        if (held[b] && !prev[b]) active = true;
      }
      // A deliberate stick throw (not drift): crossing half deflection, or a big fast move.
      for (let st = 0; st < 2; st++) {
        const m = Math.hypot(view.axes[st * 2] ?? 0, view.axes[st * 2 + 1] ?? 0);
        const pm = sticks[st];
        if ((m > 0.5 && pm <= 0.5) || (m > 0.3 && Math.abs(m - pm) > 0.25)) active = true;
        sticks[st] = m;
      }
      if (active) {
        this.padIndex = i;
        this.padActivityAt = t;
      }
    }
    const cur = this.padIndex >= 0 ? list[this.padIndex] : null;
    if (!cur || !cur.connected) this.padIndex = first;
    this.pad = this.padIndex >= 0 ? list[this.padIndex] : null;
    if (this.pad) this.padView = this.views[this.padIndex] ?? this.padView;
    this.padStyle = this.pad ? detectPadStyle(this.pad.id) : null;
  }

  private commitPads(): void {
    for (let i = 0; i < this.padHeld.length; i++) {
      const held = this.padHeld[i];
      const prev = this.padPrev[i];
      if (!held || !prev) continue;
      for (let b = 0; b < BUTTON_COUNT; b++) prev[b] = held[b];
    }
  }

  private padHeldAny(buttons: readonly PadButton[]): boolean {
    if (!this.pad) return false;
    const held = this.padHeld[this.padIndex];
    for (let i = 0; i < buttons.length; i++) if (held[PAD_BUTTON[buttons[i]]]) return true;
    return false;
  }

  private padPressedAny(buttons: readonly PadButton[]): boolean {
    if (!this.pad) return false;
    const held = this.padHeld[this.padIndex];
    const prev = this.padPrev[this.padIndex];
    for (let i = 0; i < buttons.length; i++) {
      const b = PAD_BUTTON[buttons[i]];
      if (held[b] && !prev[b]) return true;
    }
    return false;
  }

  private onPadConnected(g: Gamepad): void {
    const style = detectPadStyle(g.id);
    const name = style === 'xbox' ? 'Xbox controller' : style === 'playstation' ? 'PlayStation controller' : 'Gamepad';
    this.events?.emit('toast', { text: 'Controller connected', sub: name, icon: 'info' });
    if (this.padIndex < 0) this.padIndex = g.index;
  }

  private onPadDisconnected(g: Gamepad): void {
    this.padHeld[g.index]?.fill(false);
    this.padPrev[g.index]?.fill(false);
    const wasActive = g.index === this.padIndex;
    const wasUsing = wasActive && this.device === 'gamepad';
    if (wasActive) {
      this.padIndex = -1;
      this.padActivityAt = -1;
      this.sentPad = null;
    }
    // Losing the controller mid-flight pauses, like a console would.
    if (wasUsing && this.wantLock) this.pendingPause = true;
    this.events?.emit('toast', {
      text: 'Controller disconnected',
      sub: wasUsing && this.wantLock ? 'Paused — reconnect it or use keyboard & mouse' : 'Keyboard & mouse active',
      icon: 'info',
    });
  }

  // --- Automation -----------------------------------------------------------------------------

  /** Scripted input replaces device input wholesale, so automated runs are deterministic. */
  private applyScripted(sc: Partial<InputFrame>): void {
    const f = this.frame;
    const fl = f.flight;
    fl.pitch = fl.roll = fl.yaw = fl.flap = fl.tuck = fl.flare = 0;
    f.foot.moveX = f.foot.moveY = 0;
    f.foot.sprint = false;
    f.lookX = f.lookY = 0;
    f.lookIsRate = false;
    f.zoom = 0;
    f.jumpHeld = false;
    f.lanceHeld = sc.lanceHeld ?? false;
    f.callHeld = sc.callHeld ?? false;
    const p = f.pressed as unknown as Record<string, boolean>;
    for (const k in p) p[k] = false;
    if (sc.flight) Object.assign(fl, sc.flight);
    if (sc.foot) Object.assign(f.foot, sc.foot);
    if (sc.pressed) Object.assign(p, sc.pressed);
    if (sc.lookX !== undefined) f.lookX = sc.lookX;
    if (sc.lookY !== undefined) f.lookY = sc.lookY;
    if (sc.lookIsRate !== undefined) f.lookIsRate = sc.lookIsRate;
    f.lookActive = sc.lookActive ?? (f.lookX !== 0 || f.lookY !== 0);
    if (sc.zoom !== undefined) f.zoom = sc.zoom;
    if (sc.jumpHeld !== undefined) f.jumpHeld = sc.jumpHeld;
    if (sc.device) f.device = sc.device;
    if (sc.aim) f.aim = sc.aim;
  }

  // --- Haptics -------------------------------------------------------------------------------

  private flushHaptics(dt: number, s: Settings): void {
    if (!s.rumble) this.mixer.clear();
    this.mixer.advance(dt * 1000);
    const pad = this.device === 'gamepad' ? this.pad : null;
    const lv = this.mixer.sample(this.levels);
    const loud = Math.max(lv.strong, lv.weak, lv.left, lv.right) > 0.01;
    const t = now();
    if (!pad || !loud) {
      const sent = this.sent;
      if (this.sentPad && Math.max(sent.strong, sent.weak, sent.left, sent.right) > 0) this.stopRumble();
      return;
    }
    const sent = this.sent;
    const changed =
      Math.abs(lv.strong - sent.strong) > 0.04 || Math.abs(lv.weak - sent.weak) > 0.04 ||
      Math.abs(lv.left - sent.left) > 0.04 || Math.abs(lv.right - sent.right) > 0.04;
    // Refresh long effects before they run out; a new request simply replaces the old one.
    if (!changed && t - this.sentAt < 80 && this.sentPad === pad) return;
    const act = (pad as unknown as { vibrationActuator?: HapticActuatorLike | null }).vibrationActuator;
    if (act?.playEffect) {
      const triggers = act.effects?.includes('trigger-rumble') ?? false;
      act
        .playEffect(triggers ? 'trigger-rumble' : 'dual-rumble', {
          startDelay: 0,
          duration: 120,
          strongMagnitude: lv.strong,
          weakMagnitude: lv.weak,
          leftTrigger: lv.left,
          rightTrigger: lv.right,
        })
        .catch(noop);
    } else {
      // Firefox's older API: a single-motor pulse.
      const legacy = (pad as unknown as { hapticActuators?: HapticActuatorLike[] }).hapticActuators?.[0];
      legacy?.pulse?.(Math.max(lv.strong, lv.weak), 120)?.catch?.(noop);
    }
    sent.strong = lv.strong;
    sent.weak = lv.weak;
    sent.left = lv.left;
    sent.right = lv.right;
    this.sentAt = t;
    this.sentPad = pad;
  }

  private stopRumble(): void {
    const pad = this.sentPad as unknown as { vibrationActuator?: HapticActuatorLike | null } | null;
    const act = pad?.vibrationActuator;
    if (act?.reset) act.reset().catch(noop);
    else act?.playEffect?.('dual-rumble', { duration: 1, strongMagnitude: 0, weakMagnitude: 0 }).catch(noop);
    this.sent.strong = this.sent.weak = this.sent.left = this.sent.right = 0;
    this.sentPad = null;
  }
}
