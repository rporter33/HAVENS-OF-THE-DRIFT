// URL parameters for development, screenshots and automated checks. None of these are needed
// to play; they make the game scriptable from a headless browser.
//
//   ?play=1                 skip the title screen
//   ?tod=0.3                lock time of day (0 midnight, 0.25 dawn, 0.5 noon, 0.75 dusk)
//   ?weather=rain           clear | breezy | overcast | mist | rain
//   ?quality=low            low | medium | high | ultra
//   ?at=x,y,z&yaw=deg&mode=flying&speed=30   place the player
//   ?cam=x,y,z&look=x,y,z   pin the camera
//   ?freeze=1               pause the simulation (presentation still updates)
//   ?manual=1               no rAF loop: drive frames with window.__dw.advance(seconds)
//   ?debug=1                install window.__dw in a production build (dev builds always do)
//   ?warmup=1               run the boot shader warmup under ?manual=1 (skipped by default)
//   ?starglints=1           night sky: glinting starfield (0 classic .. 1; see SkyDome STAR_GLINTS)
//   ?capPreview=steep,snap  playtest two G5 capabilities before G5 exists (debug/capPreview.ts);
//                           the session saves nothing

import type { QualityLevel, WeatherKind } from '../core/types';
import type { RiderProof } from '../creatures/rider/proof';
import type { ProofMaps } from '../creatures/rider/proofMaterials';
import type { TrialSelection } from '../creatures/rider/importContract';
import { parseCapPreview, type CapPreviewFlags } from './capPreview';

export interface DebugParams {
  riderTrial?: TrialSelection;
  /** P1 preview only: riderProof=wanderer|aerie, riderMaps=color|normal|off. */
  riderProof?: RiderProof;
  riderMaps?: ProofMaps;
  /** High comparison only: riderTexture=3072|4096. No saved settings. */
  riderTexture?: 3072 | 4096;
  play: boolean;
  tod?: number;
  weather?: WeatherKind;
  quality?: QualityLevel;
  at?: [number, number, number];
  yaw?: number;
  mode?: 'flying' | 'landed' | 'onFoot';
  speed?: number;
  cam?: [number, number, number];
  look?: [number, number, number];
  freeze: boolean;
  manual: boolean;
  /** Free-form string for module-specific showcases (e.g. view=wyvern). */
  view?: string;
  /** Night-sky star glints, 0 (classic) .. 1 (glinting). */
  starGlints?: number;
  /** Debug preview of G5 capabilities for the capability-site playtest. */
  capPreview?: CapPreviewFlags;
}

function vec3(v: string | null): [number, number, number] | undefined {
  if (!v) return undefined;
  const parts = v.split(',').map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) ? (parts as [number, number, number]) : undefined;
}

export function readDebugParams(search = typeof location !== 'undefined' ? location.search : ''): DebugParams {
  const q = new URLSearchParams(search);
  const num = (k: string) => (q.has(k) && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : undefined);
  const yawDeg = num('yaw');
  return {
    riderTrial: q.get('riderTrial')==='compatibility' ? 'compatibility' : q.get('riderTrial')==='blender' ? 'blender' : undefined,
    riderProof: q.get('riderProof') === 'wanderer' ? 'wanderer' : q.get('riderProof') === 'aerie' ? 'aerie' : undefined,
    riderMaps: q.get('riderMaps') === 'off' ? 'off' : q.get('riderMaps') === 'normal' ? 'normal' : 'color',
    riderTexture: q.get('riderTexture') === '4096' ? 4096 : q.get('riderTexture') === '3072' ? 3072 : undefined,
    play: q.get('play') === '1',
    tod: num('tod'),
    weather: (q.get('weather') as WeatherKind) ?? undefined,
    quality: (q.get('quality') as QualityLevel) ?? undefined,
    at: vec3(q.get('at')),
    yaw: yawDeg !== undefined ? (yawDeg * Math.PI) / 180 : undefined,
    mode: (q.get('mode') as DebugParams['mode']) ?? undefined,
    speed: num('speed'),
    cam: vec3(q.get('cam')),
    look: vec3(q.get('look')),
    freeze: q.get('freeze') === '1',
    manual: q.get('manual') === '1',
    view: q.get('view') ?? undefined,
    starGlints: num('starglints'),
    capPreview: parseCapPreview(q.get('capPreview')),
  };
}
