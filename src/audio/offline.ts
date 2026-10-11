// Speaker-free verification: render scenes through the real mixer graph on an OfflineAudioContext
// and measure them. Used by the audio showcase (?view=audio → window.__dwAudioCheck()) from a
// headless browser; every scene must be audible, finite, and stay under full scale.

import type { SurfaceKind } from '../core/types';
import { levels } from './dsp';
import { AudioEngine } from './engine';
import { AmbienceLayer, StallLayer, WindLayer } from './layers';
import { ambienceMix, emptyAmbienceMix, emptyWindMix, windMix, type AmbienceMix } from './mix';
import { MusicPlayer } from './music';
import { finishArpeggio, medalChord, ringNote, thermalNotes, unlockJingle } from './notes';
import * as V from './voices';
import { traversalVoice } from './traversalVoices';
import type { TraversalCue } from './traversalCues';

export interface SceneReport {
  name: string;
  seconds: number;
  /** dBFS of the whole render (both channels). */
  rmsDb: number;
  peakDb: number;
  /** Loudest 100 ms window, dBFS. */
  loudestDb: number;
  nan: boolean;
  /** Any sample at or above 0.999 (would clip a DAC). */
  clipped: boolean;
  ok: boolean;
  renderMs: number;
}

const db = (v: number) => (v > 1e-9 ? 20 * Math.log10(v) : -180);

type Builder = (e: AudioEngine, seconds: number) => void;

/** Steer a layer as the live game would: once every `frame` seconds across the render. */
function steer(seconds: number, frame: number, fn: (t: number) => void): void {
  for (let t = 0; t < seconds; t += frame) fn(t);
}

const SCENES: Record<string, { seconds: number; minRmsDb: number; build: Builder }> = {
  volumeDuringUnlock: {
    seconds: 3,
    minRmsDb: -45,
    build: (e) => {
      // Reproduce unmuting while AudioSystem's initial 1.5 s master fade is pending.
      e.setVolumes(0, 0.6, 0.9, true);
      e.master.gain.setValueAtTime(0, 0);
      e.master.gain.linearRampToValueAtTime(0, 1.5);
      e.setVolumes(0.8, 0.6, 0.9);
      V.pluck(e, e.strip(e.sfx, 1), 2, 67, 1, 0.7);
    },
  },
  volumeDuringUnlockFallback: {
    seconds: 3,
    minRmsDb: -45,
    build: (e) => {
      // Exercise browsers without cancelAndHoldAtTime using real AudioParams.
      for (const g of [e.master, e.sfx.dry, e.sfx.wet, e.music.dry, e.music.wet, e.amb.dry, e.amb.wet]) {
        Object.defineProperty(g.gain, 'cancelAndHoldAtTime', { value: undefined });
      }
      e.setVolumes(0, 0.6, 0.9, true);
      e.master.gain.setValueAtTime(0, 0);
      e.master.gain.linearRampToValueAtTime(0, 1.5);
      e.setVolumes(0.8, 0.6, 0.9);
      V.pluck(e, e.strip(e.sfx, 1), 2, 67, 1, 0.7);
    },
  },
  traversal: {
    seconds: 5,
    minRmsDb: -45,
    build: (e) => {
      const cues: TraversalCue[] = ['cast', 'attach', 'pull', 'release', 'boost'];
      cues.forEach((cue, i) => traversalVoice(e, cue, 0.1 + i * 0.85));
    },
  },
  windCruise: {
    seconds: 3,
    minRmsDb: -45,
    build: (e, s) => {
      const w = new WindLayer(e, 0);
      const m = windMix({ airspeed: 25, tuck: 0, flare: 0, gLoad: 1, grounded: false, ambientWind: 3 }, emptyWindMix());
      steer(s, 0.05, (t) => w.apply(m, 1 + 0.15 * Math.sin(t), t));
    },
  },
  windDive: {
    seconds: 3,
    minRmsDb: -35,
    build: (e, s) => {
      const w = new WindLayer(e, 0);
      const m = windMix({ airspeed: 82, tuck: 1, flare: 0, gLoad: 1.2, grounded: false, ambientWind: 3 }, emptyWindMix());
      steer(s, 0.05, (t) => w.apply(m, 1 + 0.1 * Math.sin(t * 2), t));
    },
  },
  windFlare: {
    seconds: 2,
    minRmsDb: -45,
    build: (e, s) => {
      const w = new WindLayer(e, 0);
      const st = new StallLayer(e, 0);
      const m = windMix({ airspeed: 24, tuck: 0, flare: 1, gLoad: 1.5, grounded: false, ambientWind: 3 }, emptyWindMix());
      steer(s, 0.05, (t) => {
        w.apply(m, 1, t);
        st.apply(t > 1 ? 0.8 : 0, 14, t);
      });
    },
  },
  groundBreeze: {
    seconds: 3,
    minRmsDb: -60,
    build: (e, s) => {
      const w = new WindLayer(e, 0);
      const m = windMix({ airspeed: 0, tuck: 0, flare: 0, gLoad: 1, grounded: true, ambientWind: 6 }, emptyWindMix());
      steer(s, 0.05, (t) => w.apply(m, 1 + 0.3 * Math.sin(t * 0.7), t));
    },
  },
  wingbeats: {
    seconds: 4,
    minRmsDb: -40,
    build: (e) => {
      const out = e.strip(e.sfx, 1, 0, 0.05);
      [470, 650, 640, 920].forEach((mass, b) => {
        for (let i = 0; i < 3; i++) V.wingbeat(e, out, 0.1 + b * 0.95 + i * 0.3, i === 2 ? 0.4 : 1, mass);
      });
      V.huff(e, out, 3.6, 650);
    },
  },
  footsteps: {
    seconds: 4,
    minRmsDb: -55,
    build: (e) => {
      const out = e.strip(e.sfx, 1, 0, 0.02);
      const surfaces: SurfaceKind[] = ['grass', 'stone', 'wood', 'rock', 'dirt', 'sand'];
      surfaces.forEach((s, i) => {
        V.footstep(e, out, 0.1 + i * 0.32, s, false, 650);
        V.footstep(e, out, 0.26 + i * 0.32, s, false, 650);
        V.footstep(e, out, 2.1 + i * 0.3, s, true, 920);
      });
    },
  },
  impacts: {
    seconds: 4,
    minRmsDb: -40,
    build: (e) => {
      const out = e.strip(e.sfx, 1, 0, 0.1);
      V.impact(e, out, 0.1, 0.2);
      V.impact(e, out, 0.8, 0.6);
      V.impact(e, out, 1.6, 1);
      V.touchdown(e, out, 2.6, 1.5, 'grass', 650);
      V.touchdown(e, out, 3.3, 6, 'stone', 920);
    },
  },
  race: {
    seconds: 9,
    minRmsDb: -40,
    build: (e) => {
      const out = e.strip(e.sfx, 1, 0, 0.4);
      for (let i = 0; i < 10; i++) {
        const n = ringNote(i, 10);
        V.chime(e, out, 0.2 + i * 0.4, n, 1);
        V.chime(e, out, 0.23 + i * 0.4, n + 12, 0.28, 0.7);
      }
      const arp = finishArpeggio();
      arp.forEach((n, i) => V.chime(e, out, 4.4 + i * 0.075, n, 0.85, 0.9));
      const tc = 4.4 + arp.length * 0.075 + 0.12;
      medalChord('gold').forEach((n) => V.chime(e, out, tc, n, 0.7, 1.6));
      V.swell(e, e.strip(e.sfx, 1, 0, 0.6), tc - 0.1, medalChord('gold').map((n) => n - 12), 0.4, 3.5, 0.8);
      V.sparkle(e, e.strip(e.sfx, 1, -0.5, 0.5), e.strip(e.sfx, 1, 0.5, 0.5), tc + 0.08, 1);
      const music = new MusicPlayer(e, 3);
      music.renderSpan(0, 9, 0.5, 1);
    },
  },
  thermal: {
    seconds: 3,
    minRmsDb: -50,
    build: (e) => {
      V.thermalChime(e, e.strip(e.sfx, 0.9, 0, 0.6), 0.1, thermalNotes(), 1);
    },
  },
  edgeStorm: {
    seconds: 4,
    minRmsDb: -40,
    build: (e, s) => {
      const amb = new AmbienceLayer(e, 0);
      const w = new WindLayer(e, 0);
      const wm = windMix({ airspeed: 30, tuck: 0, flare: 0, gLoad: 1, grounded: false, ambientWind: 14 }, emptyWindMix());
      const m = ambienceMix({ night: 0, timeOfDay: 0.5, rain: 0, nearGround: 0, boundary: 1 }, emptyAmbienceMix());
      steer(s, 0.05, (t) => {
        amb.apply(m, 0, 0, t, 0.05);
        w.apply(wm, 1, t);
      });
    },
  },
  collect: {
    seconds: 7,
    minRmsDb: -45,
    build: (e) => {
      V.sparkle(e, e.strip(e.sfx, 1, -0.45, 0.45), e.strip(e.sfx, 1, 0.45, 0.45), 0.1, 1);
      V.deepBell(e, e.strip(e.sfx, 1, 0, 0.65), 1.2, 50, 1);
      const out = e.strip(e.sfx, 0.9, 0, 0.45);
      unlockJingle().forEach((n, i) => V.pluck(e, out, 4.5 + i * 0.09, n, 0.8, 0.9));
      for (const k of ['move', 'select', 'back', 'locked', 'tab'] as const) V.uiSound(e, e.strip(e.sfx, 1, 0, 0.05), 5.6 + ['move', 'select', 'back', 'locked', 'tab'].indexOf(k) * 0.25, k);
    },
  },
  nightRain: {
    seconds: 8,
    minRmsDb: -50,
    build: (e, s) => {
      const a = new AmbienceLayer(e, 0);
      const m: AmbienceMix = { ...emptyAmbienceMix(), air: 0.04, crickets: 0.05, rainHiss: 0.1, thunder: 0 };
      steer(s, 0.1, (t) => a.apply(m, 0.6, -0.3, t, 0.1, 0.3));
      V.thunder(e, e.strip(e.amb, 1, 0.4, 0.5), 1, 0.5);
    },
  },
  dayMeadow: {
    seconds: 8,
    minRmsDb: -60,
    build: (e, s) => {
      const a = new AmbienceLayer(e, 0);
      const m: AmbienceMix = { ...emptyAmbienceMix(), air: 0.08, birds: 1 };
      steer(s, 0.1, (t) => a.apply(m, 0, 0, t, 0.1, 0.3));
      const out = e.strip(e.amb, 1, 0.3, 0.3);
      V.birdPhrase(e, out, 0.5, 0.05);
      V.birdPhrase(e, out, 3.5, 0.05);
    },
  },
  musicDay: {
    seconds: 16,
    minRmsDb: -50,
    build: (e, s) => {
      new MusicPlayer(e, 9).renderSpan(0, s, 0.45, 0);
    },
  },
  musicNight: {
    seconds: 16,
    minRmsDb: -55,
    build: (e, s) => {
      new MusicPlayer(e, 9).renderSpan(0, s, 0.95, 0);
    },
  },
  /** Everything at once with every slider maxed: the limiter must hold it under full scale. */
  stress: {
    seconds: 5,
    minRmsDb: -30,
    build: (e, s) => {
      e.setVolumes(1, 1, 1, true);
      const w = new WindLayer(e, 0);
      const m = windMix({ airspeed: 90, tuck: 1, flare: 0, gLoad: 3, grounded: false, ambientWind: 12 }, emptyWindMix());
      const a = new AmbienceLayer(e, 0);
      const am: AmbienceMix = { air: 0.08, crickets: 0.05, birds: 0, rainHiss: 0.14, thunder: 0, storm: 0.13 };
      steer(s, 0.05, (t) => {
        w.apply(m, 1.3, t);
        a.apply(am, 1, 0, t, 0.05, 0.3);
      });
      const out = e.strip(e.sfx, 1, 0, 0.1);
      for (let i = 0; i < 10; i++) V.wingbeat(e, out, 0.1 + i * 0.25, 1, 920);
      for (let i = 0; i < 6; i++) V.impact(e, out, 0.2 + i * 0.6, 1);
      V.thunder(e, e.strip(e.amb, 1, 0, 0.5), 0.3, 0.6);
      const c = e.strip(e.sfx, 1, 0, 0.4);
      for (let i = 0; i < 10; i++) V.chime(e, c, 0.5 + i * 0.12, ringNote(i, 10), 1);
      V.deepBell(e, e.strip(e.sfx, 1, 0, 0.65), 1, 50, 1);
      new MusicPlayer(e, 1).renderSpan(0, s, 0.5, 1);
      for (let i = 0; i < 8; i++) {
        traversalVoice(e, 'attach', 0.15 + i * 0.5);
        traversalVoice(e, 'pull', 0.3 + i * 0.5);
        traversalVoice(e, 'release', 0.45 + i * 0.5);
        traversalVoice(e, 'boost', 0.5 + i * 0.5);
      }
    },
  },
};

for (const cue of ['cast', 'attach', 'release', 'pull', 'boost'] as const) {
  SCENES[`traversal-${cue}`] = {
    seconds: 1.5,
    minRmsDb: -55,
    build: (e) => traversalVoice(e, cue, 0.1),
  };
}

export const AUDIO_SCENES = Object.keys(SCENES);

/** Render one scene offline and measure it. */
export async function renderScene(name: string, sampleRate = 44100): Promise<SceneReport> {
  const scene = SCENES[name];
  if (!scene) throw new Error(`unknown audio scene ${name}`);
  const ctx = new OfflineAudioContext(2, Math.ceil(scene.seconds * sampleRate), sampleRate);
  const e = new AudioEngine(ctx, 1);
  e.setVolumes(0.8, 0.6, 0.9, true);
  scene.build(e, scene.seconds);
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  const renderMs = performance.now() - t0;
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const l = levels(L);
  const r = levels(R);
  const win = Math.floor(sampleRate * 0.1);
  let loudest = 0;
  for (let i = 0; i + win <= L.length; i += win) {
    loudest = Math.max(loudest, levels(L.subarray(i, i + win)).rms, levels(R.subarray(i, i + win)).rms);
  }
  const peak = Math.max(l.peak, r.peak);
  const rms = Math.sqrt((l.rms * l.rms + r.rms * r.rms) / 2);
  const nan = l.nan || r.nan;
  const clipped = peak >= 0.999;
  return {
    name,
    seconds: scene.seconds,
    rmsDb: Math.round(db(rms) * 10) / 10,
    peakDb: Math.round(db(peak) * 10) / 10,
    loudestDb: Math.round(db(loudest) * 10) / 10,
    nan,
    clipped,
    ok: !nan && !clipped && db(rms) > scene.minRmsDb,
    renderMs: Math.round(renderMs),
  };
}

/** Render every scene (or the named ones) and report. */
export async function runAudioCheck(names: string[] = AUDIO_SCENES): Promise<{ ok: boolean; scenes: SceneReport[] }> {
  const scenes: SceneReport[] = [];
  for (const n of names) scenes.push(await renderScene(n));
  return { ok: scenes.every((s) => s.ok), scenes };
}
