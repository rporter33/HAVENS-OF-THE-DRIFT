// Look development (gate G3c, Q40): the few numbers that set how hard the light is.
//
// The world's lit materials take three kinds of light: the sun (a directional light through the
// toon ramp, the only term shadows remove), the sky (three's hemisphere light) and the painterly
// fill (render/painterly.ts, a soft sun-side-weighted term). Until G3c the fill was a flat lift
// as strong as the sun itself at golden hour (its fresnel was 1 on every front face), and the
// ramp's darkest band was a third of the sun: cast shadows removed about a third of the light
// and turned-away faces kept half of it, so frames had about 58% of the target renders' tonal
// range. G3c makes the sun carry the form: a brighter sun, a smaller, cooler fill, a real
// fresnel rim, and a ramp whose terminator sits where the surface turns from the sun.
//
// Every value here can be overridden for look development with ?lookdev=sun:1.3,fill:0.5
// (dev builds, or ?debug=1 / ?manual=1), so captures can sweep a value without a rebuild.

export const LOOK = {
  /** Sun (key light) intensity multiplier over the palette's keyI × 2.7. */
  sun: 1.35,
  /** Painterly fill strength (was 1.6: the flat lift). */
  fill: 0.55,
  /** How far the fill's color moves from the sun toward a cool sky blue (was 0.35). */
  fillCool: 0.6,
  /** Real fresnel rim strength on world materials (there was none). */
  rim: 1.1,
  /** The world toon ramp's four bands, from facing away to facing the sun (was 0.32/0.55/0.8/1). */
  ramp: [0.13, 0.3, 0.78, 1.0] as number[],
  /** Creature fill over its pre-G3c strength (the wyvern's wrap fill follows the world's). */
  creatureFill: 0.5,
  /** Creature ramp's shadow value (was 0.28). */
  creatureShadow: 0.16,
  /** How much of the wyvern's baked ambient occlusion reaches the screen (0 = none, as before). */
  creatureAO: 0.85,
  /**
   * Chroma the lawns keep (grass blades and the ground's grass paint; 1 = as painted). The stable
   * view measured 45 mean chroma against target 01's 27: the targets' greens are olive and sage.
   */
  grassChroma: 0.74,
  /** Look development only: 0 turns the screen-space AO off on the levels that have it (cost checks). */
  ssao: 1,
  /** Look development only: 1 shows the screen-space AO alone. */
  aoDebug: 0,
};

export type LookKey = Exclude<keyof typeof LOOK, 'ramp'>;

/** Apply `sun:1.3,fill:0.5,ramp:0.1/0.3/0.8/1` (the ?lookdev= value). Unknown keys are ignored. */
export function applyLookOverrides(spec: string | null | undefined): void {
  if (!spec) return;
  for (const part of spec.split(',')) {
    const [k, v] = part.split(':');
    if (!k || v === undefined) continue;
    if (k === 'ramp') {
      const r = v.split('/').map(Number);
      if (r.length === 4 && r.every(Number.isFinite)) LOOK.ramp = r;
      continue;
    }
    const n = Number(v);
    if (k in LOOK && Number.isFinite(n)) (LOOK as unknown as Record<string, number>)[k] = n;
  }
}

if (typeof location !== 'undefined') {
  const q = new URLSearchParams(location.search);
  const allowed = import.meta.env?.DEV || q.get('debug') === '1' || q.get('manual') === '1';
  if (allowed) applyLookOverrides(q.get('lookdev'));
}
