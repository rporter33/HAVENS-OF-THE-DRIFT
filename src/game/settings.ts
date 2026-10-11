import type { Settings } from '../core/types';

export const DEFAULT_SETTINGS: Settings = {
  quality: 'high',
  resolutionScale: 1,
  invertPitch: false,
  lookSensitivity: 1,
  fov: 62,
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.9,
  reducedMotion: false,
  rumble: true,
  showControlHints: true,
  timeOfDay: 'cycle',
  dayLengthMinutes: 24,
  holdToFlap: true,
  windlineToggle: false,
  showGhost: true,
};

/** Pick a starting quality from what the GPU says about itself. */
export function guessQuality(): Settings['quality'] {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return 'low';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    // Give the probe context back now rather than whenever GC gets to it (browsers cap live
    // WebGL contexts, and this one would otherwise sit next to the game's for a while).
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return qualityForRenderer(name);
  } catch {
    return 'medium';
  }
}

/**
 * Starting quality for a WebGL renderer string (often wrapped by ANGLE, e.g. "ANGLE (Intel,
 * Intel(R) UHD Graphics 620 Direct3D11 ...)"). Adaptive resolution and the settings menu take
 * it from there; this only has to avoid a slideshow (or a needlessly plain first impression).
 */
export function qualityForRenderer(renderer: string): Settings['quality'] {
  const n = renderer.toLowerCase();
  // Browsers that hide the renderer: a middle guess.
  if (!n.trim()) return 'medium';
  if (/swiftshader|llvmpipe|softpipe|software|basic render/.test(n)) return 'low';
  // Intel's discrete cards before the integrated rule below.
  if (/intel.*\barc\b/.test(n)) return 'high';
  // Older Intel integrated graphics (HD / UHD 5xx-7xx) and phone GPUs.
  if (/intel.*\b(hd|uhd) graphics|mali|adreno|powervr|videocore/.test(n)) return 'low';
  // Iris / Xe, Apple silicon, AMD APUs, entry-level laptop GeForce MX.
  if (/intel|iris|apple|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics|\bmx\s?\d{3}\b/.test(n)) return 'medium';
  return 'high';
}
