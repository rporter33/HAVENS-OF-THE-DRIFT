import { guidingToShrine } from './firstLeadGuide';
// The in-flight HUD: deliberately sparse. A stamina arc around the wing emblem (only while it
// is being spent or refilling, or while the wyvern is Rested), airspeed and altitude, a compass
// ribbon with the race waypoint and nearby landmarks, the one context prompt, corner notices, a
// discovery banner and a stall warning. Readouts fade back when nothing is happening. Per frame
// it only writes to the DOM when a displayed value changes, and it allocates nothing in steady
// state.
//
// Every announcement goes through one NoticeQueue (corner notices) or BannerQueue (the centred
// title card), so a pickup, unlock or discovery is announced exactly once, however many systems
// report it (see notices.ts).

import { Vector3 } from 'three';
import type { GameEventBus } from '../core/events';
import type { GameEvents } from '../core/types';
import type { GameView, PromptAction, SaveData } from '../game/contracts';
import { bindingFor, type ControlAction } from '../input/scheme';
import { COLLECTIBLE_SPECS } from '../progression/collectibleDefs';
import { slotLabel } from '../progression/unlocks';
import { LAYOUT } from '../world/layout';
import { CARDINALS, headingFromYaw, headingOf, layoutLabels, relativeBearing, ribbonPosition, type LabelCandidate } from './compass';
import { LiveClass, LiveStyle, LiveText, div, fromHtml, h } from './dom';
import { formatDistance, kmh } from './format';
import { ICONS, RULE } from './icons';
import { BannerQueue, NoticeQueue, isRestedToast, type Notice, type NoticeSpec } from './notices';

const DEG = Math.PI / 180;
/** Half the angle the compass ribbon shows, each side of center. */
const HALF_SPAN = 60 * DEG;
/** Compass ribbon width in --u units (must match .dw-compass width in ui.css). */
const RIBBON_U = 36;
/** Mark labels: font size in --u (.dw-mark-label), average glyph width and padding in em. */
const LABEL_EM = 0.74;
const LABEL_CHAR_EM = 0.53;
const LABEL_PAD_EM = 1.5;
/** Seconds of calm before the readouts fade back. */
const IDLE_AFTER = 5;
/** Stamina arc: 300° of a circle, gap at the bottom. */
const ARC_R = 42;
const ARC_C = 2 * Math.PI * ARC_R;
const ARC_LEN = (ARC_C * 300) / 360;
/** The Rested ring hugs the outside of the stamina arc. */
const REST_R = 50.5;
const REST_C = 2 * Math.PI * REST_R;
const REST_LEN = (REST_C * 300) / 360;
/** Prompts that are flying tips (hidden in flight when tips are off). Interactions always show. */
const TIP_ACTIONS: ReadonlySet<PromptAction> = new Set<PromptAction>(['flap', 'flare', 'tuck', 'rest']);
/** "Click to look around" shows this long each time it is needed, then steps aside. */
const POINTER_HINT_SECONDS = 6;
/** weather.boundary past which "the winds turn you back" is announced (once per trip), and the
 *  level well inside the Drift that re-arms it. */
const BOUNDARY_NOTICE = 0.5;
const BOUNDARY_REARM = 0.02;
/** Without weather.boundary: the same in metres relative to the boundary radius. */
const BOUNDARY_NOTICE_IN = -150;
const BOUNDARY_NOTICE_REARM = -500;
/** Rising air under the wings (m/s) that reads as lift without a thermal (ridge lift). */
const RISING_LIFT = 2;
/** Near the edge (weather.boundary above this), show speed over the ground when the headwind
 *  takes this much of the airspeed (m/s; on / off). */
const GROUND_SPEED_EDGE = 0.2;
const GROUND_SPEED_ON = 6;
const GROUND_SPEED_OFF = 3.5;
/** Seconds the "Sun-warmed" / "Rested" caption shows when the bonus begins. */
const RESTED_CAPTION = 5;

export interface HudCtx {
  events: GameEventBus;
  fillGlyphs(root: Element): void;
  reducedMotion(): boolean;
}

interface Marker {
  id: string;
  x: number;
  z: number;
  name: string;
  realName: string;
  lastDist: number;
  lastName: string;
  text: string;
  el: HTMLElement;
  label: LiveText;
  pos: LiveStyle;
  labelPos: LiveStyle;
  shown: LiveClass;
  near: LiveClass;
  unknown: LiveClass;
  lastX: number;
  /** This frame: wants a label, its ribbon x (px), priority. */
  wants: boolean;
  lx: number;
  priority: number;
}

/** Where a feather or relic was found, as a caption ("Behind the Roost’s waterfall"). */
const PLACE_OF = new Map(COLLECTIBLE_SPECS.map((s) => [s.id, s.where.charAt(0).toUpperCase() + s.where.slice(1)]));

/** Pixel size of one --u at the current viewport (mirrors the clamp() in ui.css). */
export function unitPx(): number {
  const vh = typeof innerHeight === 'number' ? innerHeight : 720;
  return Math.min(40, Math.max(14, vh * 0.01667));
}

/** What the Rested bonus is called: basking in the sun by day, a night's rest after dark. */
export function restedName(night: boolean): string {
  return night ? 'Rested' : 'Sun-warmed';
}

/** Restart a one-shot CSS animation class. */
function restartAnimation(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** Prompt actions that are not a button: drawn as an emblem instead of a glyph. */
function isButtonAction(action: PromptAction): boolean {
  return !!bindingFor(action as ControlAction);
}

export class Hud {
  readonly root: HTMLElement;
  /** Notices sit outside the HUD layer so they still show over menus. */
  readonly toastLayer: HTMLElement;
  /** The one queue every corner notice goes through. */
  readonly notices = new NoticeQueue();
  private ctx: HudCtx;
  private noticeEls = new Map<number, { el: HTMLElement; t: HTMLElement; s: HTMLElement; rev: number }>();
  private leaving: { el: HTMLElement; left: number }[] = [];
  /** Latest view (event handlers run between frames and read it). */
  private view: GameView | null = null;
  private saveData: SaveData | null = null;

  // Flight info.
  private flightInfo: HTMLElement;
  /** The soft shade behind the readouts/gauge, while either is showing. */
  private shade: LiveClass;
  private readouts: LiveClass;
  private readoutsIdle: LiveClass;
  private speed: LiveText;
  private alt: LiveText;
  private vario: HTMLElement;
  private varioState = '';
  private liftEl: HTMLElement;
  private lift: LiveClass;
  private liftValue: LiveText;
  private liftAir = new Vector3();
  /** Riding a thermal (thermalEnter until thermalExit). */
  private inThermal = false;
  private groundSpeed: LiveText;
  private groundSpeedOn: LiveClass;
  private groundSpeedShown = false;
  private restCaption: HTMLElement;
  private restCaptionText: LiveText;
  private restCaptionOn: LiveClass;
  private restCaptionLeft = 0;
  private restCaptionNight: boolean | null = null;
  private wasRested = false;
  private gauge: HTMLElement;
  private gaugeFill: SVGCircleElement;
  private gaugeDash: LiveStyle;
  private restDash: LiveStyle;
  private gaugeFull: LiveClass;
  private gaugeLow: LiveClass;
  private gaugeWinded: LiveClass;
  private gaugeRested: LiveClass;
  private restNote: LiveClass;
  private fullTime = 0;
  private lastArc = -1;
  private lastRest = -1;
  private lastStrip = NaN;

  // Compass.
  private compass: HTMLElement;
  private compassIdle: LiveClass;
  private compassLabels: HTMLElement;
  private strip: HTMLElement;
  private stripPos: LiveStyle;
  private markers: Marker[] = [];
  private allMarkers: Marker[] = [];
  private home: Marker;
  private shrineMarker: Marker;
  private waypoint: Marker;
  private waypointOn: LiveClass;
  private startGate: Marker;
  private wp = new Vector3();
  private ribbon = { x: 0, edge: false };
  private candidates: LabelCandidate[] = [];
  private candidatePool: LabelCandidate[] = [];
  private candidateOf: Marker[] = [];
  private rows: number[] = [];

  // Prompt, stall, pointer hint.
  private prompt: HTMLElement;
  private promptOn: LiveClass;
  private promptWarn: LiveClass;
  private promptCalm: LiveClass;
  private promptGlyph: HTMLElement;
  private promptText: LiveText;
  private promptAction: string | null = null;
  private stall: HTMLElement;
  private stallOn: LiveClass;
  private pointerHint: HTMLElement;
  private pointerText: LiveText;
  private pointerOn: LiveClass;
  private pointerLeft = 0;
  private pointerWasNeeded = false;

  // Banner.
  private banner: HTMLElement;
  private bannerKicker: HTMLElement;
  private bannerName: HTMLElement;
  private bannerSub: HTMLElement;
  readonly banners = new BannerQueue();

  private idleTime = 0;
  private lastSpeed = 0;
  private visible = true;
  private unit = unitPx();
  private beyondBoundary = false;

  constructor(ctx: HudCtx) {
    this.ctx = ctx;
    this.root = div('dw-layer dw-hud');

    // --- Compass ---------------------------------------------------------------------------
    this.strip = div('dw-compass-strip');
    for (let d = -180; d <= 540; d += 5) {
      const card = CARDINALS.find((c) => ((c.deg - d) % 360 + 360) % 360 === 0);
      if (card) {
        const lab = h('span', {
          class: `dw-compass-card${card.major ? '' : ' is-minor'}${card.label === 'N' ? ' is-north' : ''}`,
          text: card.label,
        });
        // Labels change font-size, so position them in --u rather than their own em.
        lab.style.left = `calc(var(--u) * ${((d / 120) * RIBBON_U).toFixed(3)})`;
        this.strip.append(lab);
      } else {
        const t = div(`dw-compass-tick${d % 15 === 0 ? ' is-mid' : ''}`);
        t.style.left = `calc(var(--u) * ${((d / 120) * RIBBON_U).toFixed(3)})`;
        this.strip.append(t);
      }
    }
    this.stripPos = new LiveStyle(this.strip, 'transform');
    const marks = div('dw-compass-marks');
    // Labels hang below the ribbon in their own layer: the ribbon's edge mask would swallow them.
    const labels = div('dw-compass-labels');
    const mk = (id: string, x: number, z: number, name: string, icon: string, cls: string): Marker => {
      const label = h('span', { class: `dw-mark-label ${cls}` });
      const el = div(`dw-mark ${cls}`, fromHtml(icon));
      marks.append(el);
      labels.append(label);
      const m: Marker = {
        id, x, z, name, el,
        realName: name,
        lastDist: -1,
        lastName: '',
        text: '',
        label: new LiveText(label),
        pos: new LiveStyle(el, 'transform'),
        labelPos: new LiveStyle(label, 'transform'),
        shown: new LiveClass(el, 'dw-hidden'),
        near: new LiveClass(label, 'is-on'),
        unknown: new LiveClass(el, 'is-unknown'),
        lastX: NaN,
        wants: false,
        lx: 0,
        priority: 0,
      };
      this.allMarkers.push(m);
      return m;
    };
    for (const l of LAYOUT.landmarks) {
      if (l.id === 'roost') continue;
      this.markers.push(mk(l.id, l.position[0], l.position[2], l.name, ICONS.landmark, ''));
    }
    const roost = LAYOUT.landmarks.find((l) => l.id === 'roost');
    this.home = mk('roost', roost?.position[0] ?? 0, roost?.position[2] ?? 0, roost?.name ?? 'Windhaven', ICONS.home, 'is-home');
    this.shrineMarker = mk('first-wind', 0, 0, 'First Wind shrine', ICONS.landmark, 'is-shrine');
    this.waypoint = mk('waypoint', 0, 0, '', ICONS.waypoint, 'is-waypoint');
    this.waypointOn = new LiveClass(this.waypoint.el, 'dw-hidden');
    // Outside a race the waypoint is just the nearest start gate: a quieter ring marker.
    this.startGate = mk('start', 0, 0, 'Race start', ICONS.race, 'is-start');
    this.compass = div('dw-compass dw-fadeable', div('dw-compass-band'), this.strip, div('dw-compass-center'), marks);
    this.compassLabels = labels;
    this.compassIdle = new LiveClass(this.compass, 'is-idle');

    // --- Stamina gauge + readouts ------------------------------------------------------------
    const ring = fromHtml(
      `<svg class="dw-gauge-ring" viewBox="0 0 100 100" aria-hidden="true">
        <defs><linearGradient id="dw-stamina-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="#c88f3a"/><stop offset=".55" stop-color="#ffd27e"/><stop offset="1" stop-color="#fff2cf"/>
        </linearGradient>
        <linearGradient id="dw-rest-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="#ff7f5a"/><stop offset=".6" stop-color="#ffb07a"/><stop offset="1" stop-color="#ffe0bd"/>
        </linearGradient></defs>
        <circle class="dw-gauge-track" cx="50" cy="50" r="${ARC_R}" transform="rotate(120 50 50)" stroke-dasharray="${ARC_LEN.toFixed(2)} ${ARC_C.toFixed(2)}"/>
        <circle class="dw-gauge-fill" cx="50" cy="50" r="${ARC_R}" transform="rotate(120 50 50)" stroke-dasharray="${ARC_LEN.toFixed(2)} ${ARC_C.toFixed(2)}"/>
        <circle class="dw-gauge-rest" cx="50" cy="50" r="${REST_R}" transform="rotate(120 50 50)" stroke-dasharray="0 ${REST_C.toFixed(2)}"/>
      </svg>`,
    );
    this.gaugeFill = ring.querySelector('.dw-gauge-fill') as SVGCircleElement;
    this.gaugeDash = new LiveStyle(this.gaugeFill, 'stroke-dasharray');
    this.restDash = new LiveStyle(ring.querySelector('.dw-gauge-rest') as SVGCircleElement, 'stroke-dasharray');
    this.gauge = div('dw-gauge is-full', ring, div('dw-gauge-face', fromHtml(ICONS.wing)));
    this.gaugeFull = new LiveClass(this.gauge, 'is-full');
    this.gaugeLow = new LiveClass(this.gauge, 'is-low');
    this.gaugeWinded = new LiveClass(this.gauge, 'is-winded');
    this.gaugeRested = new LiveClass(this.gauge, 'is-rested');

    const speedV = h('span', { class: 'dw-readout-v', text: '0' });
    const altV = h('span', { class: 'dw-readout-v', text: '0' });
    this.vario = fromHtml(ICONS.arrow);
    this.vario.classList.add('dw-vario', 'is-level');
    // "Rising air +4 m/s": the lift under the wings, a gentle vario for thermals and ridges.
    const liftV = h('span', { class: 'dw-lift-v' });
    this.liftEl = h('span', { class: 'dw-lift' }, 'Rising air', liftV);
    this.lift = new LiveClass(this.liftEl, 'is-on');
    this.liftValue = new LiveText(liftV);
    const restNote = h('span', { class: 'dw-restnote', text: 'Glide or land to rest' });
    this.restNote = new LiveClass(restNote, 'is-on');
    // The Rested bonus names itself when it begins: basking by day, a night's rest after dark.
    const capText = h('span', { text: 'Sun-warmed' });
    this.restCaption = h('span', { class: 'dw-restcap' }, h('span', { class: 'dw-restcap-i', html: ICONS.sun }), capText);
    this.restCaptionText = new LiveText(capText);
    this.restCaptionOn = new LiveClass(this.restCaption, 'is-on');
    // Speed over the ground, shown only when a headwind at the edge of the world eats the airspeed.
    const gsV = h('b', { text: '0' });
    const gsEl = div('dw-readout-gs', gsV, h('span', { text: 'km/h over ground' }));
    this.groundSpeed = new LiveText(gsV);
    this.groundSpeedOn = new LiveClass(gsEl, 'is-on');
    const readouts = div(
      'dw-readouts dw-fadeable',
      div('dw-readout dw-readout--speed', speedV, h('span', { class: 'dw-readout-u', text: 'km/h' })),
      gsEl,
      div('dw-readout dw-readout--alt', this.vario, altV, h('span', { class: 'dw-readout-u', text: 'm' })),
    );
    this.speed = new LiveText(speedV);
    this.alt = new LiveText(altV);
    this.readouts = new LiveClass(readouts, 'is-gone');
    this.readoutsIdle = new LiveClass(readouts, 'is-idle');
    this.flightInfo = div('dw-flightinfo', div('dw-flightinfo-notes', this.liftEl, restNote, this.restCaption), readouts, this.gauge);
    this.shade = new LiveClass(this.flightInfo, 'is-shaded');

    // --- Prompt, stall, pointer hint ---------------------------------------------------------
    this.promptGlyph = h('span', { class: 'dw-hint-g' });
    const promptText = h('span', { class: 'dw-prompt-t' });
    this.prompt = div('dw-prompt', this.promptGlyph, promptText);
    this.promptText = new LiveText(promptText);
    this.promptOn = new LiveClass(this.prompt, 'is-on');
    this.promptWarn = new LiveClass(this.prompt, 'is-warn');
    this.promptCalm = new LiveClass(this.prompt, 'is-calm');

    this.stall = div('dw-stall', fromHtml(ICONS.stall), h('span', { text: 'STALL' }));
    this.stallOn = new LiveClass(this.stall, 'is-on');

    const pointerText = h('span', { text: 'Click to look around' });
    this.pointerHint = div('dw-pointer-hint', h('span', { class: 'dw-hint-g', attrs: { 'data-glyph-key': 'Mouse0' } }), pointerText);
    this.pointerText = new LiveText(pointerText);
    this.pointerOn = new LiveClass(this.pointerHint, 'is-on');

    // --- Banner -------------------------------------------------------------------------------
    this.bannerKicker = h('div', { class: 'dw-banner-kicker' });
    this.bannerName = h('div', { class: 'dw-banner-name' });
    this.bannerSub = h('div', { class: 'dw-banner-sub' });
    this.banner = div('dw-banner', this.bannerKicker, this.bannerName, fromHtml(RULE), this.bannerSub);

    this.root.append(this.compass, this.compassLabels, this.stall, this.banner, this.prompt, this.pointerHint, this.flightInfo);
    this.toastLayer = div('dw-toasts');

    this.subscribe(ctx.events);
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => (this.unit = unitPx()));
      // Moving the mouse while it isn't captured brings "click to look around" back briefly.
      window.addEventListener('mousemove', () => {
        if (this.pointerWasNeeded && this.pointerLeft < 2.5) this.pointerLeft = 2.5;
      });
    }
  }

  setVisible(on: boolean): void {
    if (on === this.visible) return;
    this.visible = on;
    this.root.classList.toggle('is-off', !on);
  }

  /** Announce something in the corner (the Ui and the race HUD use this too). */
  notify(spec: NoticeSpec): void {
    this.notices.push(spec);
  }

  /** Queue a toast (kept for showcases and older callers). */
  toast(text: string, sub = '', icon: NoticeSpec['icon'] = 'info', variant = ''): void {
    this.notices.push({ key: `toast:${text}`, aliases: [text], text, sub, icon, variant });
  }

  /** A centered title card: "Discovered — Cascade Isle". */
  showBanner(kicker: string, name: string, sub = ''): void {
    this.banners.push({ key: `${kicker}:${name}`, kicker, name, sub });
  }

  private racing(): boolean {
    const r = this.view?.races;
    return !!r && r.activeId !== null && (r.state === 'countdown' || r.state === 'running');
  }

  private subscribe(ev: GameEventBus): void {
    ev.on('flapRefused', () => this.pulseGauge());
    // Riding into a thermal: the lift note lights up with a pulse (once per entry, not per frame).
    ev.on('thermalEnter', () => {
      this.inThermal = true;
      if (this.view?.player.mode === 'flying') restartAnimation(this.liftEl, 'is-pulse');
    });
    ev.on('thermalExit', () => {
      this.inThermal = false;
    });
    // Generic notices from any system. Typed events below own pickups, unlocks and discoveries;
    // when an emitter also sends a plain toast for them, the queue merges it away (same text).
    ev.on('toast', (e: GameEvents['toast']) => {
      if (isRestedToast(e.text)) return;
      const icon = e.icon ?? 'info';
      this.notices.push({ key: `toast:${e.text}`, aliases: [e.text], text: e.text, sub: e.sub ?? '', icon, always: icon === 'info', priority: icon === 'info' ? 2 : 1 });
    });
    ev.on('collect', (e: GameEvents['collect']) => {
      const place = PLACE_OF.get(e.id) ?? '';
      if (e.kind === 'feather') {
        const text = `Feather ${e.total} of ${e.ofTotal}`;
        this.notices.push({ key: `collect:${e.id}`, aliases: [text], text, sub: place, icon: 'feather', group: 'feather', priority: 1 });
      } else {
        const text = `Relic found: ${e.name}`;
        this.notices.push({
          key: `collect:${e.id}`,
          aliases: [text, e.name],
          text,
          sub: `${e.total} of ${e.ofTotal} relics · its story is in your Collection`,
          icon: 'relic',
          variant: 'relic',
          priority: 3,
          life: 5.5,
        });
      }
    });
    ev.on('unlock', (e: GameEvents['unlock']) => {
      const text = `Unlocked: ${e.name}`;
      this.notices.push({ key: `unlock:${e.slot}:${e.cosmeticId}`, aliases: [text], text, sub: `${slotLabel(e.slot)} · new in the Stable`, icon: 'unlock', variant: 'unlock', priority: 3, life: 5 });
    });
    ev.on('discover', (e: GameEvents['discover']) => {
      const l = LAYOUT.landmarks.find((m) => m.id === e.landmarkId);
      // The banner (or, mid-race, a corner note) is the one announcement. Either way the name is
      // claimed, so a plain toast for the same discovery merges away instead of repeating it.
      if (this.racing()) {
        // Mid-race the middle of the screen belongs to the rings: a quiet corner note instead.
        this.notices.push({ key: `discover:${e.landmarkId}`, aliases: [e.name], text: `Discovered: ${e.name}`, sub: l?.description ?? '', icon: 'landmark', priority: 2 });
      } else {
        this.notices.remember([e.name], 10);
        this.banners.push({ key: `discover:${e.landmarkId}`, kicker: 'DISCOVERED', name: e.name, sub: l?.description ?? '' });
      }
    });
  }

  private pulseGauge(): void {
    const g = this.gauge;
    g.classList.remove('is-pulse');
    void g.offsetWidth; // restart the animation
    g.classList.add('is-pulse');
    this.gaugeFull.set(false);
    this.fullTime = 0;
  }

  update(dt: number, view: GameView): void {
    this.view = view;
    if (view.save.data !== this.saveData) {
      // A new game (progress erased): places can be discovered and announced again.
      if (this.saveData) {
        this.banners.reset();
        this.notices.clear();
      }
      this.saveData = view.save.data;
    }
    // Nothing new on the title screen: the first discovery waits for play.
    this.notices.held = view.screen === 'title' || view.screen === 'loading';
    this.updateNotices(dt);
    this.updateBanner(dt);
    if (!this.visible) return;

    const player = view.player;
    const f = player.flight;
    const mode = player.mode;
    // Only the wyvern in flight has an airspeed worth showing (not a rider stepping off a ledge).
    const flying = mode === 'flying';
    const input = view.input.frame;

    // --- Activity → idle fade ----------------------------------------------------------------
    const fi = input.flight;
    const steering = Math.abs(fi.pitch) + Math.abs(fi.roll) + Math.abs(fi.yaw) > 0.3 || fi.flap > 0 || fi.tuck > 0 || fi.flare > 0;
    const accel = Math.abs(f.airspeed - this.lastSpeed) / Math.max(dt, 1e-3);
    this.lastSpeed = f.airspeed;
    const racing = view.races.activeId !== null && view.races.state !== 'idle';
    const busy = steering || accel > 4 || f.stall > 0.1 || racing || input.lookActive || (!flying && (input.foot.moveX !== 0 || input.foot.moveY !== 0));
    this.idleTime = busy ? 0 : this.idleTime + dt;
    const idle = this.idleTime > IDLE_AFTER;
    this.readoutsIdle.set(idle);
    this.compassIdle.set(idle && !racing);

    // --- Readouts --------------------------------------------------------------------------
    this.readouts.set(!flying);
    let rising = false;
    let showGround = false;
    if (flying) {
      this.speed.set(kmh(f.airspeed));
      this.alt.set(Math.max(0, Math.round(f.position.y)));
      const vy = f.velocity.y;
      const v = vy > 2.5 ? 'is-up' : vy < -2.5 ? 'is-down' : 'is-level';
      if (v !== this.varioState) {
        if (this.varioState) this.vario.classList.remove(this.varioState);
        this.vario.classList.add(v);
        this.varioState = v;
      }
      // Rising air under the wings (thermals, ridge lift): the cue that circling here pays. The
      // weather measures it at the wyvern each frame; older weather systems are sampled here.
      const lift = view.weather.lift ?? view.weather.windAt(f.position, this.liftAir).y;
      rising = this.inThermal || lift > RISING_LIFT;
      if (rising) this.liftValue.set(`+${Math.max(1, Math.round(lift))} m/s`);
      // At the edge of the world the headwind can hold the wyvern still while the airspeed reads
      // 100 km/h: then say how fast it actually moves over the ground.
      if ((view.weather.boundary ?? 0) > GROUND_SPEED_EDGE) {
        const ground = f.velocity.length();
        const lost = Math.abs(f.airspeed - ground);
        showGround = this.groundSpeedShown ? lost > GROUND_SPEED_OFF : lost > GROUND_SPEED_ON;
        if (showGround) this.groundSpeed.set(kmh(ground));
      }
    }
    this.lift.set(rising);
    this.groundSpeedShown = showGround;
    this.groundSpeedOn.set(showGround);

    // --- Stamina -----------------------------------------------------------------------------
    const st = Math.max(0, Math.min(1, f.stamina));
    const rested = Math.max(0, Math.min(1, player.rested ?? 0));
    const full = st >= 0.995 && !f.winded;
    this.fullTime = full ? this.fullTime + dt : 0;
    this.gaugeFull.set(this.fullTime > 1.2 && rested <= 0);
    this.gaugeRested.set(rested > 0);
    // Quantized, and the dash string is only rebuilt when the arc actually moves.
    const len = Math.round(ARC_LEN * st * 10) / 10;
    if (len !== this.lastArc) {
      this.lastArc = len;
      this.gaugeDash.set(`${len} ${ARC_C}`);
    }
    const rlen = Math.round(REST_LEN * rested * 10) / 10;
    if (rlen !== this.lastRest) {
      this.lastRest = rlen;
      this.restDash.set(`${rlen} ${REST_C}`);
    }
    const low = st < 0.3 && !f.winded;
    this.gaugeLow.set(low);
    this.gaugeWinded.set(f.winded);
    this.shade.set((flying && !idle) || !(this.fullTime > 1.2 && rested <= 0));
    // Tired reads as a suggestion, not a failure: glide, or land on any island to rest. (Winded,
    // the prompt says it; while the stamina tip is up, the tip says it.)
    this.restNote.set(flying && low && !rising && view.prompt?.action !== 'rest');
    this.updateRestCaption(dt, view, rested);

    // --- Stall -------------------------------------------------------------------------------
    this.stallOn.set(flying && f.stall > 0.35);

    // --- Compass -------------------------------------------------------------------------------
    this.updateCompass(view);

    // --- Prompt ------------------------------------------------------------------------------
    const pr = view.prompt;
    const showHints = view.save.data.settings.showControlHints;
    // "Show tips" off hides the flying hints; on the ground every prompt is an interaction.
    const promptVisible = pr !== null && (showHints || !flying || !TIP_ACTIONS.has(pr.action));
    this.promptOn.set(promptVisible);
    if (pr && promptVisible) {
      // Never show a button that won't work right now: winded, wingbeats are refused.
      const refused = flying && f.winded && pr.action === 'flap';
      const shown = refused ? 'rest' : pr.action;
      if (shown !== this.promptAction) {
        this.promptAction = shown;
        if (isButtonAction(shown)) {
          this.promptGlyph.className = 'dw-hint-g';
          this.promptGlyph.setAttribute('data-glyph', shown);
          this.ctx.fillGlyphs(this.prompt);
        } else {
          // Not a button ('rest': glide or land): the wing emblem, so it never says "press".
          this.promptGlyph.removeAttribute('data-glyph');
          this.promptGlyph.className = 'dw-hint-g dw-prompt-emblem';
          this.promptGlyph.innerHTML = ICONS.wing;
        }
      }
      this.promptText.set(pr.text);
      // Stalling gets the warm warning edge; being winded is calm advice, never an alarm.
      this.promptWarn.set(flying && f.stall > 0.5);
      this.promptCalm.set(flying && f.winded && f.stall <= 0.5);
    }

    // --- Pointer lock hint -------------------------------------------------------------------
    const inp = view.input;
    const needed = !!inp.pointerLockWanted && !inp.pointerLocked && inp.device === 'keyboard';
    if (needed && !this.pointerWasNeeded) this.pointerLeft = POINTER_HINT_SECONDS;
    this.pointerWasNeeded = needed;
    if (this.pointerLeft > 0) this.pointerLeft -= dt;
    this.pointerOn.set(needed && this.pointerLeft > 0);
    // With mouse steering on, capturing the mouse in flight hands it the wyvern, not the camera.
    if (needed) this.pointerText.set(flying && view.save.data.settings.mouseFlight ? 'Click to steer with the mouse' : 'Click to look around');

    // --- The edge of the world -----------------------------------------------------------------
    this.updateBoundary(view, flying);
  }

  /** Re-render glyphs after a device change. */
  refreshGlyphs(): void {
    this.promptAction = null;
  }

  /** Where the player is for the compass: the rider (on foot they may be far from the wyvern). */
  private origin(view: GameView): Vector3 {
    return view.player.riderPosition;
  }

  /**
   * "Sun-warmed" (by day: the wyvern basks, wings spread to the sun) or "Rested" (at night) beside
   * the stamina emblem for a few seconds when the bonus begins; the warm ring says it after that.
   */
  private updateRestCaption(dt: number, view: GameView, rested: number): void {
    const isRested = rested > 0;
    if (isRested && !this.wasRested) this.restCaptionLeft = RESTED_CAPTION;
    this.wasRested = isRested;
    if (this.restCaptionLeft > 0) this.restCaptionLeft -= dt;
    const on = isRested && this.restCaptionLeft > 0;
    this.restCaptionOn.set(on);
    if (!on) return;
    const night = view.sky.night > 0.5;
    if (night === this.restCaptionNight) return;
    this.restCaptionNight = night;
    this.restCaptionText.set(restedName(night));
    (this.restCaption.firstChild as HTMLElement).innerHTML = night ? ICONS.moon : ICONS.sun;
  }

  private updateBoundary(view: GameView, flying: boolean): void {
    // The weather says how deep into the storm at the edge the wyvern is; without it, measure.
    const b = view.weather.boundary;
    let near: boolean;
    let home: boolean;
    if (b !== undefined) {
      near = b > BOUNDARY_NOTICE;
      home = b < BOUNDARY_REARM;
    } else {
      const p = this.origin(view);
      const past = Math.hypot(p.x, p.z) - LAYOUT.boundaryRadius;
      near = past > BOUNDARY_NOTICE_IN;
      home = past < BOUNDARY_NOTICE_REARM;
    }
    if (!this.beyondBoundary && flying && near) {
      this.beyondBoundary = true;
      this.notices.push({ key: 'boundary', text: 'The winds of the Drift turn you back', sub: 'Follow the compass home to Windhaven', icon: 'wing', priority: 3, life: 6 });
    } else if (this.beyondBoundary && home) {
      this.beyondBoundary = false;
    }
  }

  private updateCompass(view: GameView): void {
    const heading = headingFromYaw(view.camera.yaw);
    const halfW = (this.unit * RIBBON_U) / 2;
    // Strip: the current heading sits at the ribbon's center.
    const sx = Math.round((halfW - (heading / DEG / 120) * RIBBON_U * this.unit) * 2) / 2;
    if (sx !== this.lastStrip) {
      this.lastStrip = sx;
      this.stripPos.set(`translate3d(${sx}px,0,0)`);
    }

    const p = this.origin(view);
    const discovered = view.save.data.discovered;
    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i];
      const known = discovered.includes(m.id);
      m.unknown.set(!known);
      m.name = known ? m.realName : 'Unexplored';
      this.placeMarker(m, p, heading, halfW, false, known ? 2 : 1);
    }
    // Far out over the Drift, home stays pinned to the ribbon so you always know the way back.
    const lost = Math.hypot(p.x, p.z) > LAYOUT.boundaryRadius - 400;
    this.placeMarker(this.home, p, heading, halfW, lost, 3);

    const wp = view.races.waypoint(this.wp);
    const racing = view.races.activeId !== null && view.races.state !== 'idle';
    this.waypointOn.set(!wp || !racing);
    this.startGate.shown.set(!wp || racing);
    this.waypoint.wants = false;
    this.startGate.wants = false;
    if (wp) {
      const m = racing ? this.waypoint : this.startGate;
      m.x = wp.x;
      m.z = wp.z;
      this.placeMarker(m, p, heading, halfW, racing, racing ? 9 : 4);
    }
    const shrine = view.tutorialShrine;
    this.shrineMarker.wants = false;
    this.shrineMarker.shown.set(true);
    if (!racing && shrine && guidingToShrine(view.save.data)) {
      this.shrineMarker.x = shrine.x;
      this.shrineMarker.z = shrine.z;
      this.placeMarker(this.shrineMarker, p, heading, halfW, true, 8);
    }
    this.layoutCompassLabels(racing);
  }

  /** Position a marker's icon and decide whether it wants a label this frame. */
  private placeMarker(m: Marker, p: Vector3, heading: number, halfW: number, pinned: boolean, priority: number): void {
    const dx = m.x - p.x;
    const dz = m.z - p.z;
    const rel = relativeBearing(headingOf(dx, dz), heading);
    ribbonPosition(rel, HALF_SPAN, this.ribbon);
    // The waypoint pins to the edge when behind you, so it always says which way to turn.
    const visible = pinned || !this.ribbon.edge;
    m.shown.set(!visible);
    m.wants = false;
    if (!visible) return;
    const x = Math.round(this.ribbon.x * halfW * 0.92 * 2) / 2;
    if (x !== m.lastX) {
      m.lastX = x;
      m.pos.set(`translate3d(${x}px,0,0)`);
    }
    // Keep the label inside the readable middle of the ribbon.
    m.lx = Math.max(-halfW * 0.74, Math.min(halfW * 0.74, x));
    m.priority = priority;
    m.wants = pinned || Math.abs(rel) < 9 * DEG;
    if (!m.wants) return;
    // Distance labels: quantized first, so the string is only rebuilt when it would change.
    const isWaypoint = m === this.waypoint;
    const d = isWaypoint ? Math.hypot(dx, dz, this.wp.y - p.y) : Math.hypot(dx, dz);
    const q = d < 995 ? Math.round(d / 5) : 1000 + Math.round(d / 100);
    if (q === m.lastDist && m.name === m.lastName) return;
    m.lastDist = q;
    m.lastName = m.name;
    m.text = isWaypoint ? formatDistance(d) : `${m.name} · ${formatDistance(d)}`;
    m.label.set(m.text);
  }

  /**
   * One label per place, never on top of another: the race waypoint keeps the first row, the rest
   * take the first free row (or stay quiet); only the nearest of several unexplored places speaks.
   */
  private layoutCompassLabels(racing: boolean): void {
    const c = this.candidates;
    const of = this.candidateOf;
    of.length = 0;
    const px = this.unit * LABEL_EM;
    let unknown: Marker | null = null;
    for (const m of this.allMarkers) {
      if (!m.wants) continue;
      if (m.name === 'Unexplored' && m.priority === 1) {
        if (!unknown || Math.abs(m.lx) < Math.abs(unknown.lx)) unknown = m;
        continue;
      }
      of.push(m);
    }
    if (unknown) of.push(unknown);
    // Candidate records are pooled (this runs every frame).
    while (this.candidatePool.length < of.length) this.candidatePool.push({ x: 0, width: 0, priority: 0 });
    c.length = 0;
    for (let k = 0; k < of.length; k++) {
      const m = of[k];
      const cand = this.candidatePool[k];
      cand.x = m.lx;
      cand.width = (m.text.length * LABEL_CHAR_EM + LABEL_PAD_EM) * px;
      cand.priority = m.priority;
      c.push(cand);
    }
    // Mid-race the second row would sit on the race timer.
    layoutLabels(c, px * 0.6, racing ? 1 : 2, this.rows);
    const rowH = px * 1.55;
    for (const m of this.allMarkers) {
      const i = of.indexOf(m);
      const row = i >= 0 ? this.rows[i] : -1;
      m.near.set(row >= 0);
      if (row >= 0) m.labelPos.set(`translate3d(${m.lx}px,${row * rowH}px,0) translateX(-50%)`);
    }
  }

  private updateNotices(dt: number): void {
    const q = this.notices;
    q.update(dt);
    for (const n of q.retired) this.retireNotice(n);
    for (const n of q.visible) {
      const r = this.noticeEls.get(n.id);
      if (!r) this.showNotice(n);
      else if (r.rev !== n.rev) {
        r.rev = n.rev;
        r.t.textContent = n.text;
        r.s.textContent = n.sub;
        r.s.style.display = n.sub ? '' : 'none';
        // A streak (feathers in a row): a little bump so the new count reads.
        r.el.classList.remove('is-bump');
        void r.el.offsetWidth;
        r.el.classList.add('is-bump');
      }
    }
    for (let i = this.leaving.length - 1; i >= 0; i--) {
      const l = this.leaving[i];
      l.left -= dt;
      if (l.left <= 0) {
        l.el.remove();
        this.leaving.splice(i, 1);
      }
    }
  }

  private showNotice(n: Notice): void {
    const t = h('span', { class: 'dw-toast-t', text: n.text });
    const s = h('span', { class: 'dw-toast-s', text: n.sub });
    if (!n.sub) s.style.display = 'none';
    const el = div(`dw-toast${n.variant ? ` dw-toast--${n.variant}` : ''}`, div('dw-toast-icon', fromHtml(ICONS[n.icon])), div('dw-toast-text', t, s));
    this.toastLayer.append(el);
    this.noticeEls.set(n.id, { el, t, s, rev: n.rev });
  }

  private retireNotice(n: Notice): void {
    const r = this.noticeEls.get(n.id);
    if (!r) return;
    this.noticeEls.delete(n.id);
    r.el.classList.add('is-out');
    this.leaving.push({ el: r.el, left: 0.6 });
  }

  private updateBanner(dt: number): void {
    // A race owns the middle of the screen; hidden HUD (menus) just pauses the card.
    if (!this.visible) return;
    const step = this.banners.update(dt, this.racing());
    if (step === 'hide') this.banner.classList.remove('is-on');
    if (step !== 'show') return;
    const b = this.banners.current!;
    this.bannerKicker.textContent = b.kicker;
    this.bannerName.textContent = b.name;
    this.bannerSub.textContent = b.sub ?? '';
    this.bannerSub.style.display = b.sub ? '' : 'none';
    this.banner.classList.remove('is-on');
    void this.banner.offsetWidth; // restart the entrance
    this.banner.classList.add('is-on');
  }
}
