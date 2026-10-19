// Uniforms shared by every painterly material and custom shader. The sky/weather system writes
// them once per frame; materials hold references, so nothing else has to be told the sun moved.

import { Color, Vector3 } from 'three';
import { LOOK } from './look';

export const globalUniforms = {
  uTime: { value: 0 },
  /** Direction TOWARD the sun (or moon at night), normalized. */
  uSunDir: { value: new Vector3(0.35, 0.7, 0.25).normalize() },
  /** Direct light color × intensity of the key light (sun or moon). */
  uSunColor: { value: new Color(1.0, 0.92, 0.8) },
  uSkyZenith: { value: new Color(0.24, 0.45, 0.78) },
  uSkyHorizon: { value: new Color(0.75, 0.84, 0.92) },
  /** Aerial-perspective fog color looking away from the sun. */
  uFogColor: { value: new Color(0.68, 0.78, 0.9) },
  /** Fog color looking toward the sun (forward scattering glow). */
  uFogSunColor: { value: new Color(1.0, 0.85, 0.65) },
  /** Base fog density at y = uFogBaseY (per meter). */
  uFogDensity: { value: 0.00022 },
  /** How fast fog thins with altitude (per meter). */
  uFogHeightFalloff: { value: 0.0022 },
  uFogBaseY: { value: 0 },
  /** 0 = full day, 1 = deep night. Emissives (lanterns, glowcaps, fireflies) scale with this. */
  uNight: { value: 0 },
  /** Global wind vector (m/s, world) for foliage, cloth, grass, waterfalls. */
  uWind: { value: new Vector3(4, 0, 2) },
  /** 0..1 gustiness, modulates sway amplitude. */
  uGust: { value: 0.3 },
  /** 0..1 how wet the world is (rain darkens and glosses surfaces slightly). */
  uWetness: { value: 0 },
  /** Strength of the painterly rim light. */
  uRimStrength: { value: 0.45 },
  /** Painterly fill and fresnel rim gains, and how cool the fill is (render/look.ts, G3c). */
  uDwFill: { value: LOOK.fill },
  uDwFillCool: { value: LOOK.fillCool },
  uDwRimEdge: { value: LOOK.rim },
  /** Player position, for grass bending and proximity effects. */
  uPlayerPos: { value: new Vector3() },
};

export type GlobalUniforms = typeof globalUniforms;

/**
 * The creature light rig: uniforms only the wyvern and rider materials read (the world never
 * compiles them). The sky writes the bloom threshold; the camera rig writes the kick and rim
 * lights per shot (camera/creatureLight.ts), in VIEW space, every frame.
 */
export const creatureUniforms = {
  /**
   * The palette's bloom threshold (linear scene luminance). Creature hide light is shouldered
   * just under it, so no non-emissive pixel of a wyvern ever blooms.
   */
  uDwBloomT: { value: 0.85 },
  /** Kick light: direction toward the light (view space), color and intensity. */
  uKickDir: { value: new Vector3(0, 1, 0) },
  uKickColor: { value: new Color(0.8, 0.88, 1.0) },
  uKickI: { value: 0 },
  /** Directional rim light: direction toward the light (view space, mostly behind the subject). */
  uRimDir: { value: new Vector3(0, 0, -1) },
  uRimColor: { value: new Color(1, 1, 1) },
  uRimI: { value: 0 },
};

export type CreatureUniforms = typeof creatureUniforms;
