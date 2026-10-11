import { describe, expect, it } from 'vitest';
import type { RiderGarmentSlot, RiderLook } from '../../core/types';
import { COSMETICS, DEFAULT_RIDER, cosmeticsFor } from '../../cosmetics/catalog';
import { GARMENT_SLOTS, garmentChoice, withGarment } from '../../cosmetics/wardrobe';
import { LocalSaveStore, defaultSave, migrateSave } from '../../progression/save';
import { evaluateUnlocks } from '../../progression/unlocks';
import { looksDiffer } from '../../ui/stableModel';
import { buildRiderModel, recolorRiderModel } from './model';
import { riderClothSpecs } from './wardrobeModel';
import { C02_LOOK } from './proof';
import { Rider } from './Rider';
import { createRiderPose } from '../../player/poses';
import { QUALITY } from '../../render/quality';
import type { ClothRig } from './clothRig';

const base = { ...C02_LOOK, outfit: 'travel-drape' };
function dispose(m: ReturnType<typeof buildRiderModel>) { m.geometry.dispose(); m.rig.skeleton.dispose(); }

describe('pieces from every existing outfit', () => {
  it('offers actual garments from all seven outfits and inherits every parent unlock', () => {
    for (const outfit of cosmeticsFor('riderOutfit')) {
      const pieces = COSMETICS.filter(o => o.sourceOutfit === outfit.id);
      expect(pieces.length).toBeGreaterThanOrEqual(2);
      for (const p of pieces) expect(p.unlock).toEqual(outfit.unlock);
    }
    const save = new LocalSaveStore({ storage: null });
    try {
      expect(save.isUnlocked('courier-top', 'riderTop')).toBe(false);
      save.data.unlocked.push('courier');
      expect(save.isUnlocked('courier-top', 'riderTop')).toBe(true);
      expect(save.isUnlocked('courier-footwear', 'riderFootwear')).toBe(true);
      expect(evaluateUnlocks(save.data).some(p => p.sourceOutfit)).toBe(false);
    } finally { save.flush(); }
  });

  it('round-trips sparse mixes and repairs invalid slots without losing old saves', () => {
    const look = withGarment(withGarment(DEFAULT_RIDER, 'top', 'courier-top'), 'footwear', 'scout-footwear');
    const save = { ...defaultSave(), rider: look };
    expect(migrateSave(JSON.parse(JSON.stringify(save))).rider).toEqual(look);
    const invalid = migrateSave({ rider: { ...look, wardrobe: { ...look.wardrobe, top: 'none', chest: 'courier-top', hacked: 'x' } } });
    expect(invalid.rider.wardrobe).toEqual({ footwear: 'scout-footwear' });
    expect(migrateSave({ rider: { ...C02_LOOK, chest: 'none' } }).rider.chest).toBe('none');
    expect(migrateSave({ rider: DEFAULT_RIDER }).rider).toEqual(DEFAULT_RIDER);
    expect(looksDiffer(look, { ...look, wardrobe: { footwear: 'scout-footwear', top: 'courier-top' } })).toBe(false);
    expect(looksDiffer(look, withGarment(look, 'footwear', 'none'))).toBe(true);
  });

  it.each(['slight', 'medium', 'broad'] as const)('%s: every individual garment builds on one rig, without malformed geometry', { timeout: 60000 }, build => {
    for (const [part, slot] of Object.entries(GARMENT_SLOTS) as [RiderGarmentSlot, typeof GARMENT_SLOTS[RiderGarmentSlot]][]) {
      for (const option of cosmeticsFor(slot)) {
        const look = withGarment({ ...DEFAULT_RIDER, build, headgear: 'none', scarf: 'none' }, part, option.id);
        const m = buildRiderModel(look);
        try {
          expect(m.rig.skeleton.bones.length).toBe(27);
          for (const key of ['position', 'normal', 'skinWeight']) expect(Array.from(m.geometry.getAttribute(key).array).every(Number.isFinite)).toBe(true);
          expect(m.geometry.index!.count / 3).toBeLessThan(32000);
          expect(riderClothSpecs(m.ctx, m.proof).some(p => p.name === 'coatL')).toBe(part === 'top' && option.id === 'courier-top');
        } finally { dispose(m); }
      }
    }
  });

  it('removes Courier tails when the top changes and removes C02 drape/sash cloth independently', () => {
    const look = withGarment(base, 'top', 'courier-top');
    const a = buildRiderModel(look, { proof: 'wanderer' });
    const b = buildRiderModel(withGarment(withGarment(withGarment(look, 'top', 'scout-top'), 'shoulderDrape', 'none'), 'waist', 'none'), { proof: 'wanderer' });
    try {
      expect(riderClothSpecs(a.ctx, a.proof).map(p => p.name)).toEqual(expect.arrayContaining(['coatL', 'coatR', 'c02-chlamys', 'c02-sash']));
      expect(riderClothSpecs(b.ctx, b.proof).some(p => /coat|c02/.test(p.name))).toBe(false);
    } finally { dispose(a); dispose(b); }
  });

  it('keeps the combined seven-outfit C02 mesh finite before rendering', () => {
    let look: RiderLook = base;
    for (const [part, id] of Object.entries({ top: 'courier-top', trousers: 'racer-trousers', chest: 'scout-chest',
      shoulderDrape: 'chlamys', waist: 'cartographer-waist', armWraps: 'skyknight-armWraps',
      legWraps: 'scout-legWraps', footwear: 'flight-footwear' })) look = withGarment(look, part as RiderGarmentSlot, id);
    const samples = [look];
    for (const [part, slot] of Object.entries(GARMENT_SLOTS) as [RiderGarmentSlot, typeof GARMENT_SLOTS[RiderGarmentSlot]][])
      for (const option of cosmeticsFor(slot)) samples.push(withGarment(base, part, option.id));
    for (const sample of samples) {
      const m = buildRiderModel(sample);
      try {
        for (const key of ['position', 'normal', 'skinWeight']) expect(Array.from(m.geometry.getAttribute(key).array).every(Number.isFinite), key).toBe(true);
        m.geometry.computeBoundingSphere(); expect(Number.isFinite(m.geometry.boundingSphere!.radius)).toBe(true);
      } finally { dispose(m); }
    }
  });

  it('mixed legacy and C02 dyes match a fresh build while retaining geometry, UVs and rig', () => {
    const look = withGarment(withGarment(base, 'shoulderDrape', 'skyknight-shoulderDrape'), 'footwear', 'flight-footwear');
    const next = { ...look, outfitPrimary: '#86455a', armorColor: '#315e9c', leatherColor: '#ac724b' };
    const a = buildRiderModel(look), b = buildRiderModel(next);
    try {
      const geometry = a.geometry, bones = a.rig.skeleton;
      recolorRiderModel(a, next);
      expect(Array.from(a.geometry.getAttribute('color').array)).toEqual(Array.from(b.geometry.getAttribute('color').array));
      expect(Array.from(a.geometry.getAttribute('uv').array)).toEqual(Array.from(b.geometry.getAttribute('uv').array));
      expect(a.geometry).toBe(geometry); expect(a.rig.skeleton).toBe(bones);
    } finally { dispose(a); dispose(b); }
  });

  it('coat tails, drape and hair remain finite through gusts and quality changes without replacing solvers', () => {
    const look = withGarment(base, 'top', 'courier-top');
    const rider = new Rider(look, { proof: 'wanderer', quality: QUALITY.low });
    const pose = createRiderPose(), cloth = () => (rider as unknown as { cloth: ClothRig }).cloth;
    try {
      for (let i = 0; i < 360; i++) {
        pose.airflow.set(24 * Math.sin(i / 12), 4 * Math.cos(i / 9), -90 * Math.cos(i / 21));
        rider.update(i % 40 === 0 ? .25 : 1 / 60, pose, null);
        for (const pc of cloth().pieces) {
          expect(Array.from(pc.cloth.pos).every(Number.isFinite)).toBe(true);
          for (let k = 0; k < pc.cloth.n; k++) expect(Math.hypot(...pc.cloth.pos.slice(k * 3, k * 3 + 3))).toBeLessThan(3);
        }
      }
      const solvers = cloth().pieces.map(p => p.cloth);
      rider.setQuality(QUALITY.high);
      expect(cloth().pieces.map(p => p.cloth)).toEqual(solvers);
      expect(garmentChoice(look, 'top')).toBe('courier-top');
    } finally { rider.dispose(); }
  });
});
