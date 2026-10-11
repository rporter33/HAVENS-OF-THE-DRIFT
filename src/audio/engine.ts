// The mixer graph, built on any BaseAudioContext so the live game and an OfflineAudioContext
// check render through exactly the same chain:
//
//   voices ─► sfx.dry ──────────┐
//          └► sfx.wet ─► reverb ┤
//   wind ──► sfx.dry            ├─► master ─► compressor (limiter) ─► soft clip ─► out
//   ambience ─► amb.dry / wet   │
//   music ─► music.dry / wet ───┘
//
// Each bus has a dry and a wet (reverb send) input, both carrying the bus volume, so a voice's
// reverb amount is per voice while the settings sliders still scale everything it makes.

import { noiseLoop, reverbImpulse, softClipCurve, type NoiseColor } from './dsp';
import { volumeToGain } from './mix';
import { mulberry32 } from '../core/rng';

export interface Bus {
  dry: GainNode;
  wet: GainNode;
}

/** Fixed trims under the sliders: the music sits well under the effects by default. */
const MUSIC_TRIM = 0.6;
const AMB_TRIM = 1.0;
const SFX_TRIM = 1.0;

export class AudioEngine {
  readonly ctx: BaseAudioContext;
  readonly master: GainNode;
  readonly sfx: Bus;
  readonly music: Bus;
  readonly amb: Bus;
  readonly limiter: DynamicsCompressorNode;
  private reverb: ConvolverNode;
  private noise: Record<NoiseColor, AudioBuffer>;
  /** Seeded randomness for voice variation (pitch/level jitter, grain timing). */
  readonly rand: () => number;
  /** Small rolling counter so successive noise one-shots read different parts of the loop. */
  private noiseCursor = 0;

  constructor(ctx: BaseAudioContext, seed = 1, destination: AudioNode = ctx.destination) {
    this.ctx = ctx;
    this.rand = mulberry32(seed * 977 + 5);
    const sr = ctx.sampleRate;

    this.master = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    // Brick-wall-ish: anything over -9 dBFS gets squashed hard and fast.
    this.limiter.threshold.value = -9;
    this.limiter.knee.value = 4;
    this.limiter.ratio.value = 16;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.18;
    const clip = ctx.createWaveShaper();
    clip.curve = softClipCurve() as Float32Array<ArrayBuffer>;
    this.master.connect(this.limiter).connect(clip).connect(destination);

    this.reverb = ctx.createConvolver();
    this.reverb.normalize = false;
    const [l, r] = reverbImpulse(sr, 2.6, seed + 11);
    const ir = ctx.createBuffer(2, l.length, sr);
    ir.copyToChannel(l as Float32Array<ArrayBuffer>, 0);
    ir.copyToChannel(r as Float32Array<ArrayBuffer>, 1);
    this.reverb.buffer = ir;
    this.reverb.connect(this.master);

    const bus = (): Bus => {
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      dry.connect(this.master);
      wet.connect(this.reverb);
      return { dry, wet };
    };
    this.sfx = bus();
    this.music = bus();
    this.amb = bus();

    const mk = (color: NoiseColor, s: number): AudioBuffer => {
      const L = noiseLoop(color, sr, 4, seed * 31 + s);
      const R = noiseLoop(color, sr, 4, seed * 31 + s + 101);
      const buf = ctx.createBuffer(2, L.length, sr);
      buf.copyToChannel(L as Float32Array<ArrayBuffer>, 0);
      buf.copyToChannel(R as Float32Array<ArrayBuffer>, 1);
      return buf;
    };
    this.noise = { white: mk('white', 1), pink: mk('pink', 2), brown: mk('brown', 3) };
    this.setVolumes(0.8, 0.6, 0.9, true);
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  /** Apply the settings sliders (0..1 each). Glides unless `immediate`. */
  setVolumes(master: number, music: number, sfx: number, immediate = false): void {
    const t = this.ctx.currentTime;
    const set = (g: GainNode, v: number) => {
      // A settings change replaces pending fades (including AudioSystem's unlock ramp).
      // Holding the current value preserves a smooth glide rather than jumping the mix.
      if (typeof g.gain.cancelAndHoldAtTime === 'function') g.gain.cancelAndHoldAtTime(t);
      else {
        const held = g.gain.value;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(held, t);
      }
      if (immediate) g.gain.setValueAtTime(v, t);
      else g.gain.setTargetAtTime(v, t, 0.05);
    };
    set(this.master, volumeToGain(master));
    const m = volumeToGain(music) * MUSIC_TRIM;
    const s = volumeToGain(sfx) * SFX_TRIM;
    const a = volumeToGain(sfx) * AMB_TRIM;
    set(this.music.dry, m);
    set(this.music.wet, m);
    set(this.sfx.dry, s);
    set(this.sfx.wet, s);
    set(this.amb.dry, a);
    set(this.amb.wet, a);
  }

  /** A noise source reading the shared loop from a fresh offset. Loops by default. */
  noiseSource(color: NoiseColor, loop = true): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise[color];
    src.loop = loop;
    return src;
  }

  /** Start a noise source at `t` from a different point of the loop each time. */
  startNoise(src: AudioBufferSourceNode, t: number, dur?: number): void {
    this.noiseCursor = (this.noiseCursor + 0.6180339) % 1;
    const len = src.buffer ? src.buffer.duration : 1;
    const offset = this.noiseCursor * Math.max(0, len - (dur ?? 0) - 0.05);
    if (dur !== undefined) src.start(t, offset, dur);
    else src.start(t, offset);
  }

  /**
   * An output strip for a one-shot voice: gain → pan → bus dry, plus a reverb send. Returns the
   * strip's input. Nodes are released by the browser once the voice's sources end.
   */
  strip(bus: Bus, gain: number, pan = 0, wet = 0): GainNode {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = gain;
    let tail: AudioNode = g;
    if (pan !== 0) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      tail = p;
    }
    tail.connect(bus.dry);
    if (wet > 0) {
      const w = ctx.createGain();
      w.gain.value = wet;
      tail.connect(w).connect(bus.wet);
    }
    return g;
  }
}
