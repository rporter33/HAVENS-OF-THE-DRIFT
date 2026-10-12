import { describe, expect, it } from 'vitest';
import type { RiderLook } from '../../core/types';
import { DEFAULT_RIDER } from '../../cosmetics/catalog';
import { createRiderPose } from '../../player/poses';
import { QUALITY } from '../../render/quality';
import { buildRiderModel, recolorRiderModel } from './model';
import { C02_LOOK, proofClothSpecs } from './proof';
import { Rider } from './Rider';
import type { ClothRig } from './clothRig';

const slots = ['chest', 'shoulderDrape', 'waist', 'armWraps', 'legWraps', 'footwear'] as const;
const look: RiderLook = { ...C02_LOOK, outfit: 'travel-drape' };
function dispose(m: ReturnType<typeof buildRiderModel>) { m.geometry.dispose(); m.rig.skeleton.dispose(); }

describe('itemized Travel Drape', () => {
  it('loads the secured costume without debug flags and preserves the complete approved mesh', () => {
    const a = buildRiderModel(look), b = buildRiderModel(C02_LOOK, { proof: 'aerie' });
    try {
      expect(a.proof).toBe('aerie');
      for (const key of ['position', 'normal', 'uv', 'color', 'skinWeight', 'skinIndex']) {
        expect(Array.from(a.geometry.getAttribute(key).array)).toEqual(Array.from(b.geometry.getAttribute(key).array));
      }
      expect(a.geometry.index!.count).toBe(b.geometry.index!.count);
    } finally { dispose(a); dispose(b); }
  });

  it.each(['aerie', 'wanderer'] as const)('%s: every combination removes only optional geometry, with a finite covered base', { timeout: 60000 }, proof => {
    const full = buildRiderModel(look, { proof });
    const count = full.geometry.index!.count;
    dispose(full);
    for (let mask = 0; mask < 64; mask++) {
      const next = { ...look };
      slots.forEach((key, i) => { if (mask & (1 << i)) next[key] = 'none'; });
      const m = buildRiderModel(next, { proof });
      try {
        expect(m.geometry.index!.count).toBeLessThanOrEqual(count);
        if (mask) expect(m.geometry.index!.count).toBeLessThan(count);
        expect(m.geometry.index!.count / 3).toBeGreaterThan(9000);
        expect(Array.from(m.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
        const names = proofClothSpecs(m.ctx, proof).map(s => s.name);
        expect(names.includes('c02-chlamys')).toBe(proof === 'wanderer' && next.shoulderDrape !== 'none');
        expect(names.includes('c02-sash')).toBe(proof === 'wanderer' && next.waist !== 'none');
        expect(m.rig.skeleton.bones.length).toBe(full.rig.skeleton.bones.length);
      } finally { dispose(m); }
    }
  });

  it('recolors scales and leather in place exactly like a fresh build, without changing UVs or rig', () => {
    const next = { ...look, armorColor: '#315e9c', leatherColor: '#8e3649' };
    const a = buildRiderModel(look), b = buildRiderModel(next);
    try {
      const geometry = a.geometry, skeleton = a.rig.skeleton;
      const before = Array.from(geometry.getAttribute('color').array);
      recolorRiderModel(a, next);
      expect(Array.from(a.geometry.getAttribute('color').array)).not.toEqual(before);
      expect(Array.from(a.geometry.getAttribute('color').array)).toEqual(Array.from(b.geometry.getAttribute('color').array));
      expect(a.geometry).toBe(geometry); expect(a.rig.skeleton).toBe(skeleton);
      expect(Array.from(a.geometry.getAttribute('uv').array)).toEqual(Array.from(b.geometry.getAttribute('uv').array));
    } finally { dispose(a); dispose(b); }
  });

  it('rebuilds equipped cloth and restores it through previews; quality and dyes keep the solver', () => {
    const r = new Rider(look, { proof: 'wanderer', quality: QUALITY.low });
    const cloth = () => (r as unknown as { cloth: ClothRig }).cloth;
    const pose = createRiderPose(); pose.airflow.set(18, 2, -35);
    try {
      expect(cloth().pieces.some(p => p.spec.name === 'c02-chlamys')).toBe(true);
      r.setLook({ ...look, shoulderDrape: 'none', waist: 'none' });
      expect(cloth().pieces.some(p => p.spec.name.startsWith('c02-'))).toBe(false);
      r.setLook(look);
      for (let i = 0; i < 120; i++) r.update(1 / 60, pose, null);
      const solvers = cloth().pieces.map(p => p.cloth);
      r.setQuality(QUALITY.high);
      r.setLook({ ...look, armorColor: '#315e9c', leatherColor: '#8e3649' });
      expect(cloth().pieces.map(p => p.cloth)).toEqual(solvers);
      expect(cloth().pieces.every(p => Array.from(p.cloth.pos).every(Number.isFinite))).toBe(true);
      r.setLook(DEFAULT_RIDER);
      expect((r as unknown as { model: { proof?: string } }).model.proof).toBe('wanderer');
    } finally { r.dispose(); }
  });
});
