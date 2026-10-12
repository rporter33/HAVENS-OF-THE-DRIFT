import type { QualityLevel } from '../core/types';

/** Everything that scales with the graphics quality setting. Modules read what they need. */
export interface QualityProfile {
  level: QualityLevel;
  pixelRatioCap: number;
  msaa: number;
  bloom: boolean;
  /**
   * Levels in the bloom mip chain (half resolution and down). Each level doubles the halo's
   * reach for a quarter of the previous level's cost. Optional: 6 when absent.
   */
  bloomLevels?: number;
  /** FXAA in the grade pass (for levels without MSAA). Optional: off when absent. */
  fxaa?: boolean;
  shadows: boolean;
  /**
   * Shadow map resolution. Dedicated-GPU tiers use 2048/3072/4096 while keeping each
   * level's existing coverage, so extra texels improve contact and costume-edge definition.
   */
  shadowMapSize: number;
  /**
   * Half-extent of the shadow camera around the player (m). Shadows fade out over the box's outer
   * band (sky/shadowFade.ts), so a smaller box costs reach, never a visible border.
   */
  shadowExtent: number;
  /** Multiplier on grass blade counts. 0 disables grass. */
  grassDensity: number;
  /** Radius around the camera in which grass is drawn (m). */
  grassRadius: number;
  /** Multiplier on trees, flowers, rocks. */
  propDensity: number;
  /** Camera far plane / max view distance (m). */
  drawDistance: number;
  /** Multiplier on particle counts (rain, motes, spray). */
  particles: number;
  /** Cloud quality 0..2 (puff count, shader steps). */
  clouds: number;
}

export const QUALITY: Record<QualityLevel, QualityProfile> = {
  low: {
    level: 'low', pixelRatioCap: 1, msaa: 0, fxaa: true, bloom: false, bloomLevels: 0, shadows: false, shadowMapSize: 1024,
    shadowExtent: 80, grassDensity: 0.25, grassRadius: 70, propDensity: 0.5, drawDistance: 4200,
    particles: 0.4, clouds: 0,
  },
  medium: {
    level: 'medium', pixelRatioCap: 1.5, msaa: 2, bloom: true, bloomLevels: 5, shadows: true, shadowMapSize: 2048,
    shadowExtent: 80, grassDensity: 0.8, grassRadius: 130, propDensity: 0.8, drawDistance: 5500,
    particles: 0.7, clouds: 1,
  },
  high: {
    level: 'high', pixelRatioCap: 1.75, msaa: 4, bloom: true, bloomLevels: 6, shadows: true, shadowMapSize: 3072,
    shadowExtent: 110, grassDensity: 1.25, grassRadius: 180, propDensity: 1, drawDistance: 7000,
    particles: 1, clouds: 2,
  },
  ultra: {
    level: 'ultra', pixelRatioCap: 2, msaa: 4, bloom: true, bloomLevels: 6, shadows: true, shadowMapSize: 4096,
    shadowExtent: 140, grassDensity: 1.75, grassRadius: 220, propDensity: 1.3, drawDistance: 8000,
    particles: 1.4, clouds: 2,
  },
};
