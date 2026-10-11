import type { AudioEngine } from './engine';
import type { TraversalCue } from './traversalCues';
import { pluck, rustle, whoosh } from './voices';

/** Short rider-local feedback using the existing procedural palette and Effects bus. */
export function traversalVoice(e: AudioEngine, cue: TraversalCue, t: number): void {
  const out = e.strip(e.sfx, 0.85, 0, 0.04);
  switch (cue) {
    case 'cast':
      whoosh(e, out, t, 0.18, 0.7, 850, 2400);
      break;
    case 'attach':
      pluck(e, out, t, 67, 1.15, 0.5);
      rustle(e, out, t, 0.6);
      break;
    case 'release':
      pluck(e, out, t, 55, 0.7, 0.5);
      whoosh(e, out, t, 0.16, 0.4, 1800, 600);
      break;
    case 'pull':
      rustle(e, out, t, 1.2);
      whoosh(e, out, t, 0.35, 0.85, 500, 1800);
      break;
    case 'boost':
      whoosh(e, out, t, 0.28, 1.0, 400, 2600);
      break;
  }
}
