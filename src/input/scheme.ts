// The control scheme as data — the single source of truth. Input.ts reads the physical bindings
// below (KEYS, PAD), and the controls screen and button prompts read SCHEME, whose display
// strings are DERIVED from those same bindings, so the two cannot drift apart.
//
// Design notes (deliberate changes from the first draft of the scheme):
//  - Flare is NOT on Ctrl. Ctrl+W closes the browser tab and cannot be intercepted, and W is
//    held constantly in flight. Flare is C, or right mouse button while the mouse is captured.
//    With the mouse captured, left button also beats the wings, so a mouse hand can fly
//    (look + flap + flare) while the left hand steers.
//  - Rudder bumpers (LB/RB) are digital, so they ramp in like keyboard keys (~0.12 s) instead of
//    snapping the tail over.
//  - Tuck (dive) is BOTH bumpers held together (LB + RB), not a face button: a dive is exactly
//    when you want the right thumb on the camera stick and the left on the flight stick, and the
//    index fingers are free (you neither flap nor flare while tucked). Either bumper alone is
//    rudder; a lone bumper waits ~90 ms before it steers (the second finger is usually a frame
//    or two behind), and after a dive the bumper still held stays quiet until let go — so a dive
//    never kicks the tail. Pulling RT out of a dive (a strong beat at the bottom) still works.
//  - Keyboard pitch is shaped for a heavy body: a tap or a short hold eases in to 60%, a held key
//    grows to full after ~0.55 s. Taps trim the path; holding commits.
//  - Inverts are per device (Settings.invertPitchPad / invertPitchKeys, falling back to
//    invertPitch) and the camera has its own (invertLookY).
//  - Optional mouse steering (Settings.mouseFlight): with the mouse captured in flight it is a
//    virtual stick that eases back to centre; hold the middle button to look around instead.
//  - Pitch/roll use a square-mapped stick: a full diagonal gives full pitch AND full roll.
//  - L3 (click the move stick) latches a run on foot until the stick returns to centre, so you
//    can run and steer the camera with the right thumb at the same time. B still runs while held.
//  - Tap-to-flap (Settings.holdToFlap = false): each press gives exactly one wingbeat whose
//    strength is the trigger's peak during the press. Held mode beats continuously.
//  - Esc (or anything else that releases the captured mouse during play, like alt-tab) pauses.
//    Losing window focus and a controller disconnecting during play also pause.
//  - On foot / freefall, Q / RT casts the Windline. Flight keeps its rudder / flap bindings.
//  - Airborne rider: LT pulls / boosts alongside A, keeping the right thumb on the camera.
//    LT still flares on the wyvern; an ordinary ground jump stays on A / Space.
//  - Menus: left stick, D-pad, arrows or WASD navigate with auto-repeat (380 ms, then 90 ms).
//    In the stable, the right stick or a mouse drag turns the view, and RT/LT or the wheel zoom.

import type { InputDevice } from '../core/types';
import type { PadStyle } from './shaping';

export type { PadStyle } from './shaping';

export type ControlAction =
  | 'pitch' | 'roll' | 'yaw' | 'flap' | 'tuck' | 'flare' | 'look' | 'freeLook' | 'recenter'
  | 'move' | 'jump' | 'sprint' | 'interact' | 'mount' | 'dismount' | 'stable'
  | 'pause' | 'restart' | 'toggleHud' | 'confirm' | 'back' | 'tabPrev' | 'tabNext'
  | 'navigate' | 'rotateView' | 'zoom'
  | 'lance' | 'recoverLance' | 'airSteer' | 'airBoost' | 'tetherPull' | 'leap' | 'recall';

/** Physical controls on a standard-mapping gamepad, named by their Xbox position. */
export type PadControl =
  | 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'LT' | 'RT' | 'View' | 'Menu' | 'L3' | 'R3'
  | 'DUp' | 'DDown' | 'DLeft' | 'DRight' | 'DPad' | 'LS' | 'RS';

export type PadButton = Exclude<PadControl, 'LS' | 'RS' | 'DPad'>;

/** W3C "standard" gamepad mapping: button indices. */
export const PAD_BUTTON: Record<PadButton, number> = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, View: 8, Menu: 9, L3: 10, R3: 11,
  DUp: 12, DDown: 13, DLeft: 14, DRight: 15,
};

/** Standard mapping axes. Y axes are +1 when the stick is pulled toward you. */
export const PAD_AXIS = { LX: 0, LY: 1, RX: 2, RY: 3 } as const;

/**
 * Keyboard bindings by KeyboardEvent.code. 'Mouse0' / 'Mouse1' / 'Mouse2' are the left, middle
 * and right mouse buttons; they only count as game buttons while the mouse is captured in play.
 */
export const KEYS = {
  pitchDown: ['KeyW', 'ArrowUp'],
  pitchUp: ['KeyS', 'ArrowDown'],
  rollLeft: ['KeyA', 'ArrowLeft'],
  rollRight: ['KeyD', 'ArrowRight'],
  yawLeft: ['KeyQ'],
  yawRight: ['KeyE'],
  flap: ['Space', 'Mouse0'],
  tuck: ['ShiftLeft', 'ShiftRight'],
  flare: ['KeyC', 'Mouse2'],
  moveForward: ['KeyW', 'ArrowUp'],
  moveBack: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  lance: ['KeyQ'],
  recoverLance: ['KeyE'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyF'],
  recenter: ['KeyV', 'Mouse1'],
  /** Mouse steering only: hold to look around with the mouse instead (a click still recenters). */
  freeLook: ['Mouse1'],
  pause: ['Escape'],
  restart: ['KeyR'],
  toggleHud: ['KeyH'],
  confirm: ['Enter', 'NumpadEnter', 'Space'],
  back: ['Escape', 'Backspace'],
  tabPrev: ['KeyQ'],
  tabNext: ['KeyE'],
  navUp: ['ArrowUp', 'KeyW'],
  navDown: ['ArrowDown', 'KeyS'],
  navLeft: ['ArrowLeft', 'KeyA'],
  navRight: ['ArrowRight', 'KeyD'],
} as const satisfies Record<string, readonly string[]>;

/**
 * Gamepad bindings. Sticks are fixed by role: LS flies / walks / navigates menus, RS looks.
 * Triggers are analog: RT = flap strength, LT = flare amount.
 */
export const PAD = {
  flap: ['RT'],
  flare: ['LT'],
  /** Held TOGETHER (a chord): see the design notes. Either one alone is rudder. */
  tuck: ['LB', 'RB'],
  yawLeft: ['LB'],
  yawRight: ['RB'],
  jump: ['A'],
  airAction: ['LT'],
  lance: ['RT'],
  recoverLance: ['RB'],
  sprint: ['B'],
  sprintLatch: ['L3'],
  interact: ['Y'],
  recenter: ['R3'],
  pause: ['Menu'],
  restart: ['View'],
  toggleHud: ['DUp'],
  confirm: ['A'],
  back: ['B'],
  tabPrev: ['LB'],
  tabNext: ['RB'],
  navUp: ['DUp'],
  navDown: ['DDown'],
  navLeft: ['DLeft'],
  navRight: ['DRight'],
} as const satisfies Record<string, readonly PadButton[]>;

export interface Binding {
  action: ControlAction;
  /** Human description for the controls screen. */
  label: string;
  /** Which context the binding belongs to. */
  context: 'flight' | 'ground' | 'traversal' | 'menu' | 'general';
  /** Display strings, derived from `pad` / `keys` (see bind()). */
  xbox: string;
  playstation: string;
  keyboard: string;
  /** Physical gamepad controls (for drawing button icons). */
  pad: readonly PadControl[];
  /** KeyboardEvent.code values (and Mouse0/1/2, MouseMove, MouseDrag, Wheel). */
  keys: readonly string[];
  /** True for controls you hold rather than press. */
  hold?: boolean;
  /**
   * True when the pad controls are pressed TOGETHER (LB + RB), not alternatives: prompts must
   * show all of them, joined with "+".
   */
  chord?: boolean;
}

const PAD_NAMES: Record<PadStyle, Record<PadControl, string>> = {
  xbox: {
    A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', View: 'View', Menu: 'Menu',
    L3: 'L3', R3: 'R3', DUp: 'D-pad ↑', DDown: 'D-pad ↓', DLeft: 'D-pad ←', DRight: 'D-pad →', DPad: 'D-pad',
    LS: 'LS', RS: 'RS',
  },
  playstation: {
    A: '✕', B: '○', X: '□', Y: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', View: 'Create', Menu: 'Options',
    L3: 'L3', R3: 'R3', DUp: 'D-pad ↑', DDown: 'D-pad ↓', DLeft: 'D-pad ←', DRight: 'D-pad →', DPad: 'D-pad',
    LS: 'L', RS: 'R',
  },
  // Third-party pads in standard mapping are positional, so name buttons by Xbox position.
  generic: {
    A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', View: 'Select', Menu: 'Start',
    L3: 'L3', R3: 'R3', DUp: 'D-pad ↑', DDown: 'D-pad ↓', DLeft: 'D-pad ←', DRight: 'D-pad →', DPad: 'D-pad',
    LS: 'LS', RS: 'RS',
  },
};

const KEY_NAMES: Record<string, string> = {
  Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
  Escape: 'Esc', Enter: 'Enter', NumpadEnter: 'Enter', Backspace: 'Backspace', Tab: 'Tab',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Mouse0: 'Left click', Mouse1: 'Middle click', Mouse2: 'Right click',
  MouseMove: 'Mouse', MouseDrag: 'Drag', Wheel: 'Mouse wheel',
};

/** Display name of one physical pad control in a controller family. */
export function padLabel(control: PadControl, style: PadStyle | null): string {
  return PAD_NAMES[style ?? 'xbox'][control];
}

/** Display name of a KeyboardEvent.code (or Mouse0/1/2). */
export function keyLabel(code: string): string {
  return KEY_NAMES[code] ?? code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
}

function uniq(list: string[]): string[] {
  return [...new Set(list)];
}

interface BindOptions {
  /** Appended to the pad names, e.g. ' ↕' for a stick axis or ' (hold)'. */
  padNote?: string;
  /** Replaces the derived keyboard text, e.g. 'WASD' rather than listing eight keys. */
  kb?: string;
  hold?: boolean;
  /** The pad controls are a chord (held together): displayed joined with " + ". */
  chord?: boolean;
}

function bind(
  action: ControlAction,
  label: string,
  context: Binding['context'],
  pad: readonly PadControl[],
  keys: readonly string[],
  opts: BindOptions = {},
): Binding {
  const padText = (style: PadStyle) => uniq(pad.map((c) => padLabel(c, style))).join(opts.chord ? ' + ' : ' / ') + (opts.padNote ?? '');
  return {
    action,
    label,
    context,
    xbox: padText('xbox'),
    playstation: padText('playstation'),
    keyboard: opts.kb ?? uniq(keys.map(keyLabel)).join(' / '),
    pad,
    keys,
    hold: opts.hold,
    chord: opts.chord,
  };
}

export const SCHEME: Binding[] = [
  bind('pitch', 'Pitch — push to dive, pull to climb', 'flight', ['LS'], [...KEYS.pitchDown, ...KEYS.pitchUp], { padNote: ' ↕', kb: 'W / S' }),
  bind('roll', 'Bank left / right', 'flight', ['LS'], [...KEYS.rollLeft, ...KEYS.rollRight], { padNote: ' ↔', kb: 'A / D' }),
  bind('yaw', 'Rudder', 'flight', [...PAD.yawLeft, ...PAD.yawRight], [...KEYS.yawLeft, ...KEYS.yawRight]),
  bind('flap', 'Beat wings (costs stamina; pull harder for a stronger beat)', 'flight', PAD.flap, KEYS.flap, { hold: true }),
  bind('flare', 'Flare — brake and land', 'flight', PAD.flare, KEYS.flare, { hold: true }),
  bind('tuck', 'Tuck wings — dive', 'flight', PAD.tuck, KEYS.tuck, { padNote: ' (hold)', hold: true, chord: true }),
  bind('look', 'Look around', 'general', ['RS'], ['MouseMove'], { kb: 'Mouse (click to capture) / right-drag' }),
  bind('freeLook', 'Look around while mouse-steering', 'flight', ['RS'], [...KEYS.freeLook], { kb: 'Hold middle mouse', hold: true }),
  bind('recenter', 'Recenter camera', 'general', PAD.recenter, KEYS.recenter),
  bind('move', 'Walk', 'ground', ['LS'], [...KEYS.moveForward, ...KEYS.moveBack, ...KEYS.moveLeft, ...KEYS.moveRight], { kb: 'WASD' }),
  bind('jump', 'Jump', 'ground', PAD.jump, KEYS.jump),
  bind('sprint', 'Run (hold, or click L3 to keep running)', 'ground', [...PAD.sprint, ...PAD.sprintLatch], KEYS.sprint, { hold: true }),
  bind('interact', 'Interact', 'ground', PAD.interact, KEYS.interact),
  bind('mount', 'Mount your wyvern', 'ground', PAD.interact, KEYS.interact),
  bind('dismount', 'Dismount (when landed)', 'ground', PAD.interact, KEYS.interact),
  bind('stable', 'Open the Stable', 'ground', PAD.interact, KEYS.interact),
  bind('lance', 'Cast Windline at solid surfaces within 65 m (hold to retain; release to detach)', 'traversal', PAD.lance, KEYS.lance),
  bind('recoverLance', 'Reform a missed line (also reforms automatically)', 'traversal', PAD.recoverLance, KEYS.recoverLance),
  bind('airSteer', 'Steer freefall — forward dives, back brakes', 'traversal', ['LS'], [...KEYS.moveForward, ...KEYS.moveBack, ...KEYS.moveLeft, ...KEYS.moveRight], { kb: 'WASD' }),
  bind('tetherPull', 'Pull inward while airborne and linked (one pulse per press)', 'traversal', [...PAD.airAction, ...PAD.jump], KEYS.jump),
  bind('airBoost', 'Air boost while free (recharges in 1.75 seconds)', 'traversal', [...PAD.airAction, ...PAD.jump], KEYS.jump),
  bind('leap', 'Hold to leap from your flying wyvern', 'traversal', PAD.interact, KEYS.interact, { hold: true }),
  bind('recall', 'Hold to recall your wyvern when free — release after leaping, then hold again', 'traversal', PAD.interact, KEYS.interact, { hold: true }),
  bind('restart', 'Restart race', 'general', PAD.restart, KEYS.restart),
  bind('toggleHud', 'Hide HUD', 'general', PAD.toggleHud, KEYS.toggleHud),
  bind('pause', 'Pause menu', 'general', PAD.pause, KEYS.pause),
  bind('navigate', 'Move selection', 'menu', ['LS', 'DPad'], [...KEYS.navUp, ...KEYS.navLeft], { kb: 'Arrows / WASD' }),
  bind('confirm', 'Select', 'menu', PAD.confirm, ['Enter']),
  bind('back', 'Back', 'menu', PAD.back, KEYS.back),
  bind('tabPrev', 'Previous tab', 'menu', PAD.tabPrev, KEYS.tabPrev),
  bind('tabNext', 'Next tab', 'menu', PAD.tabNext, KEYS.tabNext),
  bind('rotateView', 'Turn the view (stable)', 'menu', ['RS'], ['MouseDrag']),
  bind('zoom', 'Zoom (stable)', 'menu', ['RT', 'LT'], ['Wheel']),
];

/** The binding for an action (first match). */
export function bindingFor(action: ControlAction): Binding | undefined {
  return SCHEME.find((s) => s.action === action);
}

/** The button name to show in a prompt for this action on the current device. */
export function glyph(action: ControlAction, device: InputDevice, padStyle: PadStyle | null): string {
  const b = bindingFor(action);
  if (!b) return '?';
  if (device === 'keyboard') return b.keyboard;
  return padStyle === 'playstation' ? b.playstation : b.xbox;
}
