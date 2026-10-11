// Input as a whole on fake devices: non-standard pads (GAMEPAD-01), the shoulder chord (INP-05),
// per-device inverts and camera invert (INP-04), mouse steering only in flight (INP-03), and a
// late pointer lock nobody wants any more (LOCK-01).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameEvents, Settings } from '../core/types';
import { EventBus } from '../core/events';
import { DEFAULT_SETTINGS } from '../game/settings';
import { Input } from './Input';
import { SHAPING } from './shaping';
import { createPadMapState, createPadView, mapPad, STD, type PadLike } from './padMapping';

type Btn = { pressed: boolean; value: number };

function fakePad(mapping: string, axes: number, buttons: number, id = 'Generic USB Joystick'): PadLike & { connected: boolean; index: number; axes: number[]; buttons: Btn[] } {
  return {
    id,
    index: 0,
    connected: true,
    mapping,
    axes: new Array(axes).fill(0),
    buttons: Array.from({ length: buttons }, () => ({ pressed: false, value: 0 })),
  };
}

function press(b: Btn, v = 1): void {
  b.value = v;
  b.pressed = v > 0.5;
}

describe('padMapping (GAMEPAD-01)', () => {
  it('reads a standard pad as is', () => {
    const g = fakePad('standard', 4, 17);
    press(g.buttons[STD.RT], 0.8);
    g.axes[1] = -0.5;
    const v = mapPad(g, createPadMapState(), createPadView());
    expect(v.guessed).toBe(false);
    expect(v.buttons[STD.RT].value).toBeCloseTo(0.8);
    expect(v.axes[1]).toBe(-0.5);
  });

  it('remaps a Linux xpad layout: triggers and D-pad on axes, right stick on 3/4', () => {
    const g = fakePad('', 8, 11, 'Microsoft X-Box 360 pad');
    const st = createPadMapState();
    const out = createPadView();
    // Before the trigger axis has ever moved it reads 0 (not half pressed).
    expect(mapPad(g, st, out).buttons[STD.RT].value).toBe(0);
    g.axes[5] = -1; // at rest once seen
    g.axes[2] = -1;
    mapPad(g, st, out);
    expect(out.buttons[STD.RT].value).toBe(0);
    g.axes[5] = 0.6; // pulled 80%
    g.axes[3] = 0.7;
    g.axes[7] = -1; // D-pad up
    press(g.buttons[4]); // LB
    press(g.buttons[7]); // Start
    mapPad(g, st, out);
    expect(out.guessed).toBe(true);
    expect(out.buttons[STD.RT].value).toBeCloseTo(0.8);
    expect(out.buttons[STD.RT].pressed).toBe(true);
    expect(out.buttons[STD.LT].value).toBe(0);
    expect(out.axes[2]).toBeCloseTo(0.7); // RX
    expect(out.buttons[STD.DUP].pressed).toBe(true);
    expect(out.buttons[STD.LB].pressed).toBe(true);
    expect(out.buttons[STD.MENU].pressed).toBe(true);
  });

  it('remaps a Linux PlayStation layout (triangle/square swapped versus Xbox order)', () => {
    const g = fakePad('', 8, 13, 'Sony Interactive Entertainment Wireless Controller');
    press(g.buttons[2]); // triangle
    const v = mapPad(g, createPadMapState(), createPadView());
    expect(v.buttons[STD.Y].pressed).toBe(true);
    expect(v.buttons[STD.X].pressed).toBe(false);
  });
});

describe('Input on fake devices', () => {
  let pads: (ReturnType<typeof fakePad> | null)[] = [];
  let settings: Settings;
  beforeEach(() => {
    pads = [];
    settings = { ...DEFAULT_SETTINGS };
    vi.stubGlobal('navigator', { getGamepads: () => pads });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function make(events?: EventBus<GameEvents>) {
    const target = { requestPointerLock: vi.fn() } as unknown as HTMLElement;
    return { input: new Input(target, () => settings, events), target };
  }

  it('reports held tether, release edges, and deliberate catch independently', () => {
    const { input } = make(), g = fakePad('standard', 4, 17); pads = [g]; input.traversal = true; input.poll(1 / 120);
    press(g.buttons[STD.RT]); press(g.buttons[3]); let f = input.poll(1 / 120);
    expect(f.lanceHeld).toBe(true); expect(f.callHeld).toBe(true); expect(f.pressed.lanceRelease).toBe(false);
    press(g.buttons[STD.RT], 0); f = input.poll(1 / 120);
    expect(f.lanceHeld).toBe(false); expect(f.pressed.lanceRelease).toBe(true); expect(f.callHeld).toBe(true);
    expect(input.poll(1 / 120).pressed.lanceRelease).toBe(false);
    input.setScripted({}); f = input.poll(1 / 120); expect(f.lanceHeld).toBe(false); expect(f.callHeld).toBe(false);
  });
  it('a complete keyboard tap between polls carries both cast and release edges', () => {
    const { input } = make(); input.traversal = true; input.poll(1/120);
    const raw = input as unknown as {keysDown: Set<string>}; raw.keysDown.add('KeyQ');
    const f = input.poll(1/120);
    expect(f.pressed.lance).toBe(true); expect(f.lanceHeld).toBe(false); expect(f.pressed.lanceRelease).toBe(true);
    expect(input.poll(1/120).pressed.lance).toBe(false);
  });

  it('requires a fresh trigger after mode changes and preserves flight and menu roles', () => {
    const { input } = make(), g = fakePad('standard', 4, 17); pads = [g];
    input.poll(1 / 120); press(g.buttons[STD.RT]);
    let f = input.poll(1 / 120); expect(f.pressed.lance).toBe(false);
    expect(f.flight.flap).toBeGreaterThan(.9); expect(f.zoom).toBeGreaterThan(0);
    input.traversal = true; f = input.poll(1 / 120);
    expect(f.pressed.lance).toBe(false); expect(f.lanceHeld).toBe(false);
    press(g.buttons[STD.RT], 0); input.poll(1 / 120);
    press(g.buttons[STD.RT]); f = input.poll(1 / 120);
    expect(f.pressed.lance).toBe(true); expect(f.lanceHeld).toBe(true);
    expect(input.poll(1 / 120).pressed.lance).toBe(false);
    input.traversal = false; f = input.poll(1 / 120);
    expect(f.pressed.lanceRelease).toBe(false); expect(f.lanceHeld).toBe(false);
    input.traversal = true; expect(input.poll(1 / 120).pressed.lance).toBe(false);
  });

  it.each([true, false])('delivers a retained tether release after a pause (release during pause: %s)', duringPause => {
    const { input } = make(), g = fakePad('standard', 4, 17); pads = [g];
    input.traversal = true; input.poll(1 / 120);
    press(g.buttons[STD.RT]); expect(input.poll(1 / 120).lanceHeld).toBe(true);
    input.traversal = false; expect(input.poll(1 / 120).pressed.lanceRelease).toBe(false);
    if (duringPause) { press(g.buttons[STD.RT], 0); expect(input.poll(1 / 120).pressed.lanceRelease).toBe(false); }
    input.traversal = true;
    const resumed = input.poll(1 / 120);
    expect(resumed.pressed.lance).toBe(false);
    expect(resumed.pressed.lanceRelease).toBe(duringPause);
    if (!duringPause) { press(g.buttons[STD.RT], 0); expect(input.poll(1 / 120).pressed.lanceRelease).toBe(true); }
    expect(input.poll(1 / 120).pressed.lanceRelease).toBe(false);
  });

  it('flaps from a non-standard pad whose triggers are axes, and says the layout was guessed', () => {
    const events = new EventBus<GameEvents>();
    const toasts: string[] = [];
    events.on('toast', ({ text }) => toasts.push(text));
    const { input } = make(events);
    const g = fakePad('', 6, 11, 'Microsoft X-Box 360 pad');
    pads = [g];
    g.axes[5] = -1;
    input.poll(1 / 60);
    g.axes[5] = 1; // RT fully pulled
    const f = input.poll(1 / 60);
    expect(f.flight.flap).toBeGreaterThan(0.9);
    input.poll(1 / 60);
    expect(toasts.filter((t) => /guessed/.test(t))).toHaveLength(1);
  });

  it('LB + RB tucks; LB alone is rudder', () => {
    const { input } = make();
    const g = fakePad('standard', 4, 17, 'Xbox Wireless Controller (STANDARD GAMEPAD)');
    pads = [g];
    press(g.buttons[STD.LB]);
    press(g.buttons[STD.RB]);
    let f = input.poll(1 / 60);
    for (let i = 0; i < 10; i++) f = input.poll(1 / 60);
    expect(f.flight.tuck).toBe(1);
    expect(Math.abs(f.flight.yaw)).toBeLessThan(1e-6);
    press(g.buttons[STD.LB], 0);
    press(g.buttons[STD.RB], 0);
    input.poll(1 / 60);
    press(g.buttons[STD.LB]);
    for (let i = 0; i < 30; i++) f = input.poll(1 / 60);
    expect(f.flight.tuck).toBe(0);
    expect(f.flight.yaw).toBeLessThan(-0.9);
    // A face button no longer folds the wings (the right thumb stays on the camera).
    press(g.buttons[STD.LB], 0);
    press(g.buttons[STD.A]);
    f = input.poll(1 / 60);
    expect(f.flight.tuck).toBe(0);
  });

  it('inverts per device, and the camera on its own', () => {
    const { input } = make();
    const g = fakePad('standard', 4, 17);
    pads = [g];
    g.axes[1] = 1; // stick pulled back = nose up
    settings.invertPitch = false;
    settings.invertPitchPad = true;
    let f = input.poll(1 / 60);
    expect(f.flight.pitch).toBeLessThan(-0.9);
    settings.invertPitchPad = undefined; // falls back to invertPitch
    f = input.poll(1 / 60);
    expect(f.flight.pitch).toBeGreaterThan(0.9);
    g.axes[1] = 0;
    g.axes[3] = 0.8; // right stick down
    settings.invertLookY = true;
    f = input.poll(1 / 60);
    expect(f.lookY).toBeLessThan(0);
    settings.invertLookY = false;
    f = input.poll(1 / 60);
    expect(f.lookY).toBeGreaterThan(0);
  });

  it('mouse steering flies only in the air with the mouse captured; otherwise the mouse looks', () => {
    const { input } = make();
    settings.mouseFlight = true;
    input.pointerLocked = true;
    const move = (dx: number, dy: number) => {
      const raw = input as unknown as { mouseDX: number; mouseDY: number };
      raw.mouseDX = dx;
      raw.mouseDY = dy;
      return input.poll(1 / 60);
    };
    input.flying = true;
    let f = move(0, 0);
    for (let i = 0; i < 8; i++) f = move(15, 10);
    expect(f.flight.roll).toBeGreaterThan(0.3);
    expect(f.flight.pitch).toBeGreaterThan(0.2); // mouse toward you = nose up
    expect(f.lookActive).toBe(false);
    input.flying = false;
    f = move(15, 10);
    expect(f.flight.roll).toBe(0);
    expect(f.lookActive).toBe(true);
    settings.mouseFlight = false;
    input.flying = true;
    f = move(15, 10);
    expect(f.flight.roll).toBe(0);
    expect(f.lookActive).toBe(true);
  });

  it('keyboard W eases in rather than bunting at full', () => {
    const { input } = make();
    const keys = (input as unknown as { keys: Set<string> }).keys;
    keys.add('KeyW');
    let f = input.poll(1 / 60);
    for (let t = 0; t < 0.4; t += 1 / 60) f = input.poll(1 / 60);
    expect(f.flight.pitch).toBeCloseTo(-SHAPING.keyPitchSoft, 2);
    for (let t = 0; t < 1; t += 1 / 60) f = input.poll(1 / 60);
    expect(f.flight.pitch).toBeCloseTo(-1, 3);
  });

  it('hands back a pointer lock that arrives after play no longer wants it (LOCK-01)', () => {
    const { input, target } = make();
    const doc = { pointerLockElement: null as unknown, exitPointerLock: vi.fn() };
    vi.stubGlobal('document', doc);
    input.setPointerLock(true); // Stable → play…
    input.setPointerLock(false); // …→ title in the same frame
    expect(target.requestPointerLock).toHaveBeenCalledTimes(1);
    doc.pointerLockElement = target; // the browser grants it late
    (input as unknown as { onLockChange(): void }).onLockChange();
    expect(doc.exitPointerLock).toHaveBeenCalledTimes(1);
    expect(input.pointerLocked).toBe(true);
    doc.pointerLockElement = null;
    (input as unknown as { onLockChange(): void }).onLockChange();
    expect(input.pointerLocked).toBe(false);
    // Released by us: no pause request.
    expect(input.poll(1 / 60).pressed.pause).toBe(false);
  });
});
