// G12b shading: the dragon is painted by the wyvern hide shader's regions in its flight's palette.
// The dragon's two patches (the plates mixed most of the way to the flight's accent, slate claws)
// land on the real shader source and in the dragon's own programs only; the wyvern's are untouched.

import { describe, expect, it } from 'vitest';
import { Color, ShaderLib, UniformsUtils, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { createBodyMaterial, createWyvernUniforms, BELLY_MAX_LUMINANCE, SCALES_MAX_LUMINANCE, luminance } from '../wyvern/materials';
import { CLAW_LINE, PLATE_LINE, PLATE_MIX, applyDragonPalette, createDragonMaterials, createDragonShadeUniforms } from './materials';
import { dragonPalette } from './look';
import { ELDER_DRAGONS } from './catalog';

/** Run a material's compile hook on three's own toon shader source. */
function compile(m: { onBeforeCompile: (s: WebGLProgramParametersWithUniforms, r: WebGLRenderer) => void }): WebGLProgramParametersWithUniforms {
  const shader = {
    uniforms: UniformsUtils.clone(ShaderLib.toon.uniforms),
    vertexShader: ShaderLib.toon.vertexShader,
    fragmentShader: ShaderLib.toon.fragmentShader,
  } as unknown as WebGLProgramParametersWithUniforms;
  m.onBeforeCompile(shader, {} as WebGLRenderer);
  return shader;
}

describe('G12b dragon materials', () => {
  it('patches the hide shader for plates and slate claws, in the dragon program only', () => {
    const u = createWyvernUniforms();
    const extra = createDragonShadeUniforms();
    const [body, membrane] = createDragonMaterials(u, extra, 2);
    const s = compile(body);
    expect(s.fragmentShader).toContain('dorsal * uDwPlateMix');
    expect(s.fragmentShader).not.toContain(PLATE_LINE);
    expect(s.fragmentShader).not.toContain(CLAW_LINE);
    expect(s.fragmentShader).toContain('uniform vec3 uDwClaws;');
    expect(s.uniforms.uDwPlateMix.value).toBe(PLATE_MIX);
    expect(s.uniforms.uDwClaws).toBe(extra.uDwClaws);
    expect(body.customProgramCacheKey()).toContain('-dragon-body');
    // The membrane is the wyvern's, under its own cache key.
    const sm = compile(membrane);
    expect(sm.fragmentShader).toContain('dwMembraneAlbedo');
    expect(membrane.customProgramCacheKey()).toContain('-dragon-membrane');
    // The wyvern's own body material still has its countershading and its claws.
    const w = compile(createBodyMaterial(createWyvernUniforms()));
    expect(w.fragmentShader).toContain(PLATE_LINE);
    expect(w.fragmentShader).toContain(CLAW_LINE);
    expect(createBodyMaterial(createWyvernUniforms()).customProgramCacheKey()).not.toContain('dragon');
  });

  it('builds every shading detail (2 close, 1 mid, 0 far)', () => {
    for (const d of [0, 1, 2] as const) {
      const [body] = createDragonMaterials(createWyvernUniforms(), createDragonShadeUniforms(), d);
      expect(body.defines?.DW_DETAIL).toBe(d);
      expect(compile(body).fragmentShader).toContain('uDwPlateMix');
    }
  });

  it('paints the white elder in the white flight: plates, membrane, eyes, horns, claws, the hide and belly under the bloom caps', () => {
    const u = createWyvernUniforms();
    const extra = createDragonShadeUniforms();
    const p = dragonPalette(ELDER_DRAGONS.white!);
    applyDragonPalette(u, extra, p);
    const c = (hex: string) => new Color(hex);
    expect(u.uSecondary.value.equals(c(p.plates))).toBe(true);
    expect(u.uMembrane.value.equals(c(p.membrane))).toBe(true);
    expect(u.uEyes.value.equals(c(p.eyes))).toBe(true);
    expect(u.uHorn.value.equals(c(p.horns))).toBe(true);
    expect(extra.uDwClaws.value.equals(c(p.claws))).toBe(true);
    expect(luminance(u.uPrimary.value)).toBeLessThanOrEqual(SCALES_MAX_LUMINANCE + 1e-6);
    expect(luminance(u.uBelly.value)).toBeLessThanOrEqual(BELLY_MAX_LUMINANCE + 1e-6);
    // Ivory stays ivory under the cap: the same hue, only darker.
    const hsl = { h: 0, s: 0, l: 0 };
    const raw = { h: 0, s: 0, l: 0 };
    u.uPrimary.value.getHSL(hsl);
    c(p.hide).getHSL(raw);
    expect(Math.abs(hsl.h - raw.h)).toBeLessThan(0.01);
    expect(u.uPattern.value).toBe(0);
  });

  it('turns with the hue shift as one palette', () => {
    const a = createWyvernUniforms();
    const b = createWyvernUniforms();
    applyDragonPalette(a, createDragonShadeUniforms(), dragonPalette({ ...ELDER_DRAGONS.white!, hueShift: 0 }));
    applyDragonPalette(b, createDragonShadeUniforms(), dragonPalette({ ...ELDER_DRAGONS.white!, hueShift: 4 }));
    expect(a.uSecondary.value.equals(b.uSecondary.value)).toBe(false);
    expect(a.uHorn.value.equals(b.uHorn.value)).toBe(false);
  });
});
