import type { CosmeticSlot, RiderGarmentSlot, RiderLook } from '../core/types';
import type { CosmeticOption } from './catalog';

export const GARMENT_SLOTS: Record<RiderGarmentSlot, CosmeticSlot> = {
  top: 'riderTop', trousers: 'riderTrousers', chest: 'riderChest', shoulderDrape: 'riderDrape',
  waist: 'riderWaist', armWraps: 'riderArmWraps', legWraps: 'riderLegWraps', footwear: 'riderFootwear',
};
export const GARMENT_NAMES: Record<RiderGarmentSlot, string> = {
  top: 'Top', trousers: 'Trousers', chest: 'Chest layer', shoulderDrape: 'Shoulders & collar',
  waist: 'Belt & sash', armWraps: 'Sleeves & gloves', legWraps: 'Leg wraps & guards', footwear: 'Footwear',
};
const NAMES: Record<string, Partial<Record<RiderGarmentSlot, string>>> = {
  flight: { top: 'Flight Jacket', trousers: 'Flight Trousers', chest: 'Flight Harness', shoulderDrape: 'Shearling Collar', waist: 'Flight Belt & Pouch', armWraps: 'Flight Gloves', footwear: 'Flight Boots' },
  scout: { top: "Scout's Tunic", trousers: 'Scout Trousers', chest: 'Scout Jerkin', shoulderDrape: 'Scout Collar', waist: 'Scout Belt & Pouches', armWraps: 'Scout Bracers', legWraps: 'Scout Calf Wraps', footwear: 'Scout Boots' },
  courier: { top: "Courier's Coat", trousers: 'Courier Trousers', shoulderDrape: 'Courier Collar & Epaulettes', waist: 'Courier Sash', armWraps: 'Courier Cuffs & Gloves', footwear: 'Courier Boots' },
  racer: { top: 'Racing Top', trousers: 'Racing Trousers', chest: 'Racing Chevron & Patch', shoulderDrape: 'Racing Collar', waist: 'Racing Belt', armWraps: 'Racing Gloves', footwear: 'Racing Boots' },
  cartographer: { top: "Cartographer's Robes", trousers: 'Cartographer Trousers', chest: 'Map Case & Strap', shoulderDrape: 'Compass Mantle Collar', waist: 'Cartographer Sash', armWraps: 'Embroidered Bell Sleeves', footwear: 'Cartographer Boots' },
  skyknight: { top: 'Skyknight Tabard', trousers: 'Skyknight Underlayers', chest: 'Skyknight Cuirass & Faulds', shoulderDrape: 'Skyknight Gorget & Pauldrons', waist: 'Skyknight Belt', armWraps: 'Skyknight Vambraces & Gloves', legWraps: 'Skyknight Knee Guards', footwear: 'Skyknight Greaves & Boots' },
  'travel-drape': { top: 'Linen Chiton', trousers: 'Gathered Linen Trousers' },
};
export const TRAVEL_PIECES = { chest: 'slate-scales', shoulderDrape: 'chlamys', waist: 'woven-sash', armWraps: 'linen-wraps', legWraps: 'leather-wraps', footwear: 'sandals' } as const;

export function garmentOptions(catalog: readonly CosmeticOption[]): CosmeticOption[] {
  const options: CosmeticOption[] = [];
  for (const [part, slot] of Object.entries(GARMENT_SLOTS) as [RiderGarmentSlot, CosmeticSlot][]) {
    options.push({ id: 'outfit', slot, name: 'Match Outfit', description: 'Use this piece from your selected complete outfit.', unlock: { type: 'default' } });
    for (const outfit of catalog.filter(o => o.slot === 'riderOutfit')) {
      const name = NAMES[outfit.id]?.[part];
      if (name) options.push({ id: `${outfit.id}-${part}`, slot, name, description: `${GARMENT_NAMES[part]} from ${outfit.name}.`, unlock: outfit.unlock, sourceOutfit: outfit.id });
    }
  }
  return options;
}
export function garmentChoice(look: RiderLook, part: RiderGarmentSlot): string {
  const value = look.wardrobe?.[part];
  if (value) return value;
  return look.outfit === 'travel-drape' && part !== 'top' && part !== 'trousers' ? look[part] : 'outfit';
}
export function garmentSource(look: RiderLook, part: RiderGarmentSlot): string | undefined {
  const choice = garmentChoice(look, part);
  if (choice === 'none') return undefined;
  if (choice === 'outfit') {
    if (look.outfit === 'travel-drape') return look.outfit;
    return NAMES[look.outfit]?.[part] ? look.outfit : undefined;
  }
  if (part !== 'top' && part !== 'trousers' && choice === TRAVEL_PIECES[part]) return 'travel-drape';
  return Object.keys(NAMES).find(id => choice === `${id}-${part}`);
}
export function withGarment(look: RiderLook, part: RiderGarmentSlot, id: string): RiderLook {
  return { ...look, wardrobe: { ...look.wardrobe, [part]: id } };
}
export function wardrobeKey(look: RiderLook): string {
  return (Object.keys(GARMENT_SLOTS) as RiderGarmentSlot[]).map(part => `${part}:${garmentChoice(look, part)}`).join('|');
}
