// Procedural audio: every sound is synthesized on WebAudio at runtime, nothing is downloaded.
//
//   engine.ts    mixer graph (buses, reverb, limiter), shared noise loops
//   voices.ts    one-shot synth voices (wingbeats, footsteps, chimes, bells, UI, thunder …)
//   layers.ts    continuous layers steered per frame (wind, stall flutter, ambience)
//   sequencer.ts the generative score; music.ts renders it
//   mix.ts       pure game-state → mix mappings (unit-tested)
//
// Nothing is created or played before unlock(), which must come from a user gesture (Game calls
// it when the player starts; a first click or key press anywhere also unlocks). Gameplay talks
// to audio only through the event bus, plus the per-frame update() that reads the player, sky and
// weather for the continuous layers.

import { Vector3, type PerspectiveCamera } from 'three';
import type { GameEvents, Settings } from '../core/types';
import type { AudioSystemApi, PlayerSystem, SkySystem, WeatherSystem } from '../game/contracts';
import type { GameEventBus } from '../core/events';
import { clamp01, damp, smoothstep } from '../core/math';
import { AudioEngine } from './engine';
import { AmbienceLayer, StallLayer, WindLayer } from './layers';
import { MusicPlayer } from './music';
import { TitleMusic } from './titleMusic';
import { TraversalCues } from './traversalCues';
import { traversalVoice } from './traversalVoices';
import titleMusicUrl from './assets/driftwing-intro.mp3?url';
import {
  ambienceMix,
  emptyAmbienceMix,
  emptyWindMix,
  impactWeight,
  loudestFall,
  spatial,
  windMix,
  type FallHearing,
  type FallSource,
  type Spatial,
  type WindInput,
} from './mix';
import { THERMAL_CHIME_GAP, finishArpeggio, medalChord, ringNote, thermalNotes, unlockJingle } from './notes';
import * as V from './voices';

export interface AudioDeps {
  /** Waterfalls to hear (lips with outward direction and drop). Read once per frame. */
  waterfalls?: () => readonly FallSource[];
}

type AnyAudioContextCtor = new (opts?: AudioContextOptions) => AudioContext;

const GESTURES = ['pointerdown', 'keydown', 'touchend', 'mousedown'] as const;

export class AudioSystem implements AudioSystemApi {
  private ctx: AudioContext | null = null;
  private engine: AudioEngine | null = null;
  private wind: WindLayer | null = null;
  private stall: StallLayer | null = null;
  private ambience: AmbienceLayer | null = null;
  private music: MusicPlayer | null = null;
  private titleMusic: TitleMusic | null = null;
  private inTitle = false;
  private inPlay = false;
  private readonly traversalCues = new TraversalCues();
  private settings: () => Settings;
  private deps: AudioDeps;

  // Listener (camera) and the player, refreshed every update for event spatialization.
  private listener = new Vector3();
  private listenerRight = new Vector3(1, 0, 0);
  private player: PlayerSystem | null = null;

  private stalled = false;
  private intensity = 0;
  private intensityTarget = 0;
  private nearGround = 1;
  private gustClock = 0;
  private lastHit = -1;
  /** Audio time of the last lightning event; while the sky drives thunder, ours stays quiet. */
  private lastLightning = -1e9;
  /** Audio time of the last thermal chime (rate-limited: circling crosses a column's edge often). */
  private lastThermal = -1e9;
  private readonly windIn: WindInput = { airspeed: 0, tuck: 0, flare: 0, gLoad: 1, grounded: true, ambientWind: 3 };
  private readonly windOut = emptyWindMix();
  private readonly ambOut = emptyAmbienceMix();
  private readonly fall: FallHearing = { gain: 0, x: 0, y: 0, z: 0 };
  private readonly sp: Spatial = { gain: 1, pan: 0 };
  private readonly tmp = new Vector3();
  private onGesture = () => this.unlock();
  private onVisibility = () => {
    if (!this.ctx || typeof document === 'undefined') return;
    if (document.hidden) void this.ctx.suspend().catch(() => {});
    else void this.ctx.resume().catch(() => {});
  };

  constructor(events: GameEventBus, settings: () => Settings, deps: AudioDeps = {}) {
    this.settings = settings;
    this.deps = deps;
    this.subscribe(events);
    if (typeof window !== 'undefined') {
      for (const g of GESTURES) window.addEventListener(g, this.onGesture, { capture: true, passive: true });
      document.addEventListener('visibilitychange', this.onVisibility);
    }
  }

  /** True once the context exists and is running. */
  get running(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** The live engine (null before unlock); for debugging and the audio showcase. */
  get liveEngine(): AudioEngine | null {
    return this.engine;
  }

  // --- AudioSystemApi -----------------------------------------------------------------------------

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !(typeof document !== 'undefined' && document.hidden)) {
        void this.ctx.resume().then(() => this.releaseGestures(), () => {});
      }
      return;
    }
    if (typeof window === 'undefined') return;
    const w = window as unknown as { AudioContext?: AnyAudioContextCtor; webkitAudioContext?: AnyAudioContextCtor };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor({ latencyHint: 'interactive' });
    } catch (err) {
      console.warn('[audio] WebAudio unavailable', err);
      return;
    }
    const e = new AudioEngine(this.ctx, 1);
    this.engine = e;
    const s = this.settings();
    e.setVolumes(s.masterVolume, s.musicVolume, s.sfxVolume, true);
    // Fade the whole mix in so the first sound is never a jolt.
    const t = e.now;
    const target = e.master.gain.value;
    e.master.gain.setValueAtTime(0, t);
    e.master.gain.linearRampToValueAtTime(target, t + 1.5);
    this.wind = new WindLayer(e, t);
    this.stall = new StallLayer(e, t);
    this.ambience = new AmbienceLayer(e, t);
    this.music = new MusicPlayer(e);
    const ctx = this.ctx;
    this.titleMusic = new TitleMusic(ctx, e.music.dry, async () => {
      const response = await fetch(titleMusicUrl);
      if (!response.ok) throw new Error('Title music unavailable');
      return ctx.decodeAudioData(await response.arrayBuffer());
    });
    this.titleMusic.setActive(this.inTitle);
    void this.ctx.resume().then(() => this.releaseGestures(), () => {});
    if (this.ctx.state === 'running') this.releaseGestures();
  }

  update(dt: number, camera: PerspectiveCamera, player: PlayerSystem, weather: WeatherSystem, sky: SkySystem): void {
    this.player = player;
    camera.getWorldPosition(this.listener);
    const m = camera.matrixWorld.elements;
    this.listenerRight.set(m[0], m[1], m[2]).normalize();
    const e = this.engine;
    if (!e || !this.running) return;
    const t = e.now;
    const step = Math.min(0.1, Math.max(0, dt));
    this.traversalCues.update(player, this.inPlay, this.playTraversalCue);

    // --- Wind --------------------------------------------------------------------------------
    const f = player.flight;
    const mode = player.mode;
    const flying = mode === 'flying';
    const falling = mode === 'falling' || mode === 'traversing';
    const wi = this.windIn;
    wi.grounded = !flying && !falling;
    wi.airspeed = falling ? player.riderPose.velocity.length() : f.airspeed;
    wi.tuck = flying ? clamp01((1 - f.wingSpread) / 0.7) : 0;
    wi.flare = flying ? f.flare : 0;
    wi.gLoad = flying ? f.gLoad : 1;
    wi.ambientWind = weather.wind.length();
    windMix(wi, this.windOut);
    this.gustClock += step;
    const gc = this.gustClock;
    const gustiness = wi.grounded ? 0.35 : 0.18;
    const gust = 1 + gustiness * (0.6 * Math.sin(gc * 0.73) + 0.3 * Math.sin(gc * 1.91 + 1.3) + 0.25 * Math.sin(gc * 3.7 + 0.4));
    this.wind?.apply(this.windOut, gust, t);

    // --- Stall flutter ------------------------------------------------------------------------
    const stallAmt = flying && this.stalled ? 0.35 + 0.65 * clamp01(f.stall) : 0;
    this.stall?.apply(stallAmt, f.airspeed, t);

    // --- Ambience -----------------------------------------------------------------------------
    const pose = player.wyvernPose;
    let near = 1;
    if (flying || falling) {
      const p = falling ? player.riderPose.position : pose.position;
      near = pose.groundY !== null ? 1 - smoothstep(6, 140, p.y - pose.groundY) : 0;
    }
    this.nearGround = damp(this.nearGround, near, 1.5, step);
    // weather.boundary is optional in the contract (0 when absent).
    const boundary = weather.boundary ?? 0;
    ambienceMix({ night: sky.night, timeOfDay: sky.timeOfDay, rain: weather.rain, nearGround: this.nearGround, boundary }, this.ambOut);
    const falls = this.deps.waterfalls?.();
    let fallPan = 0;
    if (falls && falls.length) {
      loudestFall(this.listener, falls, this.fall);
      if (this.fall.gain > 0) {
        this.tmp.set(this.fall.x, this.fall.y, this.fall.z);
        fallPan = spatial(this.listener, this.listenerRight, this.tmp, 1, 1e9, this.sp).pan * 0.8;
      }
    } else {
      this.fall.gain = 0;
    }
    if (t - this.lastLightning < 120) this.ambOut.thunder = 0;
    this.ambience?.apply(this.ambOut, this.fall.gain, fallPan, t, step);

    // --- Music --------------------------------------------------------------------------------
    // Races raise the percussion quickly; it settles back slowly after the finish.
    const rate = this.intensityTarget > this.intensity ? 1.2 : 0.35;
    this.intensity = damp(this.intensity, this.intensityTarget, rate, step);
    if (!this.inTitle) this.music?.update(sky.timeOfDay, this.intensity);
  }

  /** Keep title music through menu sheets/stable, stopping on entry into gameplay. */
  setScreen(screen: string): void {
    this.inPlay = screen === 'play';
    if (screen === 'title') this.inTitle = true;
    else if (screen === 'play') this.inTitle = false;
    this.titleMusic?.setActive(this.inTitle);
  }

  applySettings(s: Settings): void {
    this.engine?.setVolumes(s.masterVolume, s.musicVolume, s.sfxVolume);
  }

  setIntensity(v: number): void {
    this.intensityTarget = clamp01(Number.isFinite(v) ? v : 0);
  }

  // --- Events -----------------------------------------------------------------------------------

  private releaseGestures(): void {
    if (typeof window === 'undefined') return;
    for (const g of GESTURES) window.removeEventListener(g, this.onGesture, { capture: true });
  }

  private playTraversalCue = (cue: Parameters<typeof traversalVoice>[1]): void => {
    if (this.engine) traversalVoice(this.engine, cue, this.engine.now + 0.01);
  };

  /** Time to schedule a one-shot "now" (a hair ahead of the clock), or -1 if audio is not live. */
  private when(): number {
    return this.engine && this.running ? this.engine.now + 0.01 : -1;
  }

  /** An sfx strip placed at `pos` (world), or centered when pos is null. */
  private stripAt(pos: Vector3 | null, gain: number, ref: number, maxDist: number, wet: number): GainNode | null {
    const e = this.engine;
    if (!e) return null;
    if (!pos) return e.strip(e.sfx, gain, 0, wet);
    spatial(this.listener, this.listenerRight, pos, ref, maxDist, this.sp);
    if (this.sp.gain < 0.003) return null;
    // Distant sounds get a little more reverb, like they do outdoors.
    const far = 1 - this.sp.gain;
    return e.strip(e.sfx, gain * this.sp.gain, this.sp.pan * 0.7, wet + 0.25 * far);
  }

  private get mass(): number {
    return this.player?.breed.mass ?? 650;
  }

  private subscribe(ev: GameEventBus): void {
    const on = <K extends keyof GameEvents>(k: K, fn: (p: GameEvents[K], t: number, e: AudioEngine) => void) =>
      ev.on(k, (p) => {
        const t = this.when();
        if (t < 0 || !this.engine) return;
        fn(p, t, this.engine);
      });

    // Flight.
    on('flap', (p, t, e) => {
      const out = this.stripAt(p.position, 0.65, 30, 600, 0.05);
      if (out) V.wingbeat(e, out, t, p.strength, this.mass);
    });
    on('flapRefused', (_p, t, e) => {
      const out = this.stripAt(this.player?.position ?? null, 0.9, 30, 300, 0.05);
      if (out) V.huff(e, out, t, this.mass);
    });
    ev.on('stallStart', () => (this.stalled = true));
    ev.on('stallEnd', () => (this.stalled = false));
    on('stallStart', (_p, t, e) => {
      const out = this.stripAt(this.player?.position ?? null, 0.8, 30, 300, 0.05);
      if (out) V.whoosh(e, out, t, 0.45, 0.35, 900, 380, 1.4);
    });
    on('tuckStart', (_p, t, e) => {
      const out = this.stripAt(this.player?.position ?? null, 0.8, 30, 300, 0.04);
      if (out) V.whoosh(e, out, t, 0.32, 0.4, 1500, 520, 1.1);
    });
    on('tuckEnd', (_p, t, e) => {
      const out = this.stripAt(this.player?.position ?? null, 0.8, 30, 300, 0.04);
      if (out) {
        V.whoosh(e, out, t, 0.38, 0.45, 380, 1700, 1.0);
        V.wingbeat(e, out, t + 0.1, 0.35, this.mass);
      }
    });
    on('terrainHit', (p, t, e) => {
      // Scrapes report many small hits; keep the first of each burst at full weight.
      const since = t - this.lastHit;
      this.lastHit = t;
      const w = impactWeight(p.impulse) * (since < 0.09 ? 0.35 : 1);
      if (w < 0.03 || (since < 0.04 && w < 0.3)) return;
      const out = this.stripAt(p.point, 1, 30, 600, 0.12);
      if (out) V.impact(e, out, t, w);
    });
    on('touchdown', (p, t, e) => {
      const out = this.stripAt(p.position, 1, 30, 500, 0.06);
      if (out) V.touchdown(e, out, t, p.impact, p.surface, this.mass);
    });
    on('takeoff', (p, t, e) => {
      const out = this.stripAt(p.position, 0.9, 30, 500, 0.06);
      if (out) V.whoosh(e, out, t, 0.6, 0.3, 300, 1300, 0.9);
    });
    on('footstep', (p, t, e) => {
      const out = this.stripAt(p.position, p.heavy ? 0.85 : 0.6, p.heavy ? 18 : 8, p.heavy ? 260 : 120, 0.02);
      if (out) V.footstep(e, out, t, p.surface, p.heavy, this.mass);
    });
    on('mount', (_p, t, e) => {
      const out = this.stripAt(this.player?.riderPosition ?? null, 1, 10, 200, 0.03);
      if (out) V.rustle(e, out, t, 1);
    });
    on('dismount', (_p, t, e) => {
      const out = this.stripAt(this.player?.riderPosition ?? null, 1, 10, 200, 0.03);
      if (out) V.rustle(e, out, t, 0.9);
    });
    on('fellOff', (_p, t, e) => {
      const out = this.stripAt(null, 0.9, 1, 1, 0.1);
      if (out) V.whoosh(e, out, t + 0.15, 1.3, 0.45, 1400, 260, 0.8);
    });
    on('caught', (_p, t, e) => {
      const out = this.stripAt(null, 1, 1, 1, 0.08);
      if (out) {
        V.wingbeat(e, out, t, 1, this.mass);
        V.rustle(e, out, t + 0.05, 1.1);
      }
    });
    on('respawn', (_p, t, e) => {
      V.swell(e, e.strip(e.sfx, 1, 0, 0.7), t, [60, 67, 72, 76, 79], 0.32, 3.2, 0.55);
      V.chime(e, e.strip(e.sfx, 0.5, 0.2, 0.7), t + 0.4, 84, 0.5, 1.4);
    });

    // Races.
    on('raceArmed', (_p, t, e) => {
      V.chime(e, e.strip(e.sfx, 0.7, -0.15, 0.4), t, 72, 0.6);
      V.chime(e, e.strip(e.sfx, 0.7, 0.15, 0.4), t + 0.12, 79, 0.6);
      this.setIntensity(Math.max(this.intensityTarget, 0.3));
    });
    on('raceCountdown', (p, t, e) => {
      const go = p.count <= 0;
      V.chime(e, e.strip(e.sfx, go ? 1 : 0.75, 0, 0.3), t, go ? 84 : 72, go ? 1 : 0.7, go ? 1.2 : 0.6);
    });
    on('raceStart', (_p, t, e) => {
      V.chime(e, e.strip(e.sfx, 1, -0.1, 0.35), t, 84, 1, 1.2);
      V.chime(e, e.strip(e.sfx, 0.8, 0.1, 0.35), t, 91, 0.7, 1.2);
      this.setIntensity(0.85);
    });
    on('ringPassed', (p, t, e) => {
      const n = ringNote(p.index, p.total);
      const out = e.strip(e.sfx, 1, 0, 0.4);
      V.chime(e, out, t, n, 1);
      V.chime(e, out, t + 0.03, n + 12, 0.28, 0.7);
    });
    on('ringMissed', (_p, t, e) => {
      const out = e.strip(e.sfx, 0.9, 0, 0.25);
      V.pluck(e, out, t, 57, 0.8, 0.5);
      V.pluck(e, out, t + 0.09, 52, 0.7, 0.7);
    });
    on('raceFinish', (p, t, e) => {
      const arp = finishArpeggio();
      const out = e.strip(e.sfx, 1, 0, 0.45);
      arp.forEach((n, i) => V.chime(e, out, t + i * 0.075, n, 0.85, 0.9));
      const tc = t + arp.length * 0.075 + 0.12;
      const chord = medalChord(p.medal);
      chord.forEach((n) => V.chime(e, out, tc, n, p.medal === 'none' ? 0.45 : 0.7, 1.6));
      V.swell(e, e.strip(e.sfx, 1, 0, 0.6), tc - 0.1, chord.map((n) => n - 12), p.medal === 'none' ? 0.25 : 0.4, 3.5, p.medal === 'gold' ? 0.8 : 0.5);
      if (p.medal === 'gold' || p.newBest) V.sparkle(e, e.strip(e.sfx, 1, -0.5, 0.5), e.strip(e.sfx, 1, 0.5, 0.5), tc + 0.08, 1);
      this.setIntensity(0);
    });
    on('raceAbort', (_p, t, e) => {
      const out = e.strip(e.sfx, 0.8, 0, 0.3);
      V.pluck(e, out, t, 67, 0.6, 0.5);
      V.pluck(e, out, t + 0.1, 62, 0.5, 0.8);
      this.setIntensity(0);
    });

    // Progression.
    on('collect', (p, t, e) => {
      // A reward sound: placed toward the pickup but never quiet.
      spatial(this.listener, this.listenerRight, p.position, 25, 1e5, this.sp);
      const g = Math.max(0.6, this.sp.gain);
      const pan = this.sp.pan * 0.5;
      if (p.kind === 'relic') {
        V.deepBell(e, e.strip(e.sfx, 1, pan, 0.65), t, 50, 1);
        V.sparkle(e, e.strip(e.sfx, 0.6 * g, pan - 0.4, 0.5), e.strip(e.sfx, 0.6 * g, pan + 0.4, 0.5), t + 0.05, 0.8);
      } else {
        V.sparkle(e, e.strip(e.sfx, g, pan - 0.45, 0.45), e.strip(e.sfx, g, pan + 0.45, 0.45), t, 1);
      }
    });
    on('unlock', (_p, t, e) => {
      const out = e.strip(e.sfx, 0.9, 0, 0.45);
      unlockJingle().forEach((n, i) => {
        V.pluck(e, out, t + i * 0.09, n, 0.8, 0.9);
        if (i === 5) V.chime(e, out, t + i * 0.09, n + 12, 0.5, 1.2);
      });
    });
    on('discover', (_p, t, e) => {
      V.swell(e, e.strip(e.sfx, 1, 0, 0.7), t, [55, 62, 67, 71, 74], 0.3, 5, 0.6);
      V.chime(e, e.strip(e.sfx, 0.6, 0.25, 0.7), t + 0.6, 86, 0.5, 2);
    });
    on('lightning', (p, t, e) => {
      // Sound travels ~340 m/s: far strikes rumble late, low and long.
      this.lastLightning = t;
      spatial(this.listener, this.listenerRight, p.position, 1, 1e9, this.sp);
      const near = 1 - Math.min(1, p.distance / 9000);
      const delay = Math.min(12, p.distance / 340);
      V.thunder(e, e.strip(e.amb, 1, this.sp.pan * 0.8, 0.5), t + delay, 0.25 + 0.45 * near * near);
    });
    on('thermalEnter', (p, t, e) => {
      if (t - this.lastThermal < THERMAL_CHIME_GAP) return;
      this.lastThermal = t;
      // A gentle cue, a little brighter for strong lift (enter fires above ~2 m/s).
      const lift = Number.isFinite(p?.lift) ? p.lift : 2;
      const vel = 0.75 + 0.25 * clamp01((lift - 2) / 4);
      V.thermalChime(e, e.strip(e.sfx, 0.9, 0, 0.6), t, thermalNotes(), vel);
    });
    on('weatherChange', (p, t, e) => {
      // Rain arriving: one roll of thunder to announce it.
      if (p.to === 'rain' && p.from !== 'rain') V.thunder(e, e.strip(e.amb, 1, (e.rand() - 0.5) * 1.2, 0.5), t + 1.5, 0.45);
    });

    // UI.
    on('uiSound', (p, t, e) => {
      V.uiSound(e, e.strip(e.sfx, 1, 0, 0.05), t, p.kind);
    });
  }
}
