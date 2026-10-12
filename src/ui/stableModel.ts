// The Stable as data: its tabs, what each tab edits, and the small rules of editing a look
// (switching breed carries default colors along only if you never changed them). Pure,
// unit-tested; Stable.ts renders it.

import type { BreedId, CosmeticSlot, RiderGarmentSlot, RiderLook, WyvernLook } from '../core/types';
import { BREED_DEFAULT_COLORS, PALETTES } from '../cosmetics/catalog';

export type LookTarget = 'wyvern' | 'rider';
export type StableFocus = 'wyvern' | 'rider' | 'both';

export type WyvernColorKey = 'primary' | 'secondary' | 'belly' | 'membrane' | 'eyes' | 'saddleColor';
export type RiderColorKey = 'skin' | 'hairColor' | 'outfitPrimary' | 'outfitSecondary' | 'scarfColor' | 'capeColor' | 'armorColor' | 'leatherColor';
export type WyvernShapeKey = 'pattern' | 'horns' | 'frill' | 'tail' | 'saddle';
export type RiderShapeKey = 'hair' | 'outfit' | 'headgear' | 'scarf' | 'cape' | 'chest' | 'shoulderDrape' | 'waist' | 'armWraps' | 'legWraps' | 'footwear';

export type StableSection =
  | { kind: 'breeds'; title: string }
  | { kind: 'build'; title: string }
  | { kind: 'garment'; title: string; target: 'rider'; key: RiderGarmentSlot; slot: CosmeticSlot }
  | { kind: 'options'; title: string; target: 'wyvern'; key: WyvernShapeKey; slot: CosmeticSlot }
  | { kind: 'options'; title: string; target: 'rider'; key: RiderShapeKey; slot: CosmeticSlot }
  | { kind: 'swatches'; title: string; target: 'wyvern'; key: WyvernColorKey; palette: readonly string[] }
  | { kind: 'swatches'; title: string; target: 'rider'; key: RiderColorKey; palette: readonly string[] };

export interface StableTab {
  id: string;
  label: string;
  group: LookTarget;
  /** What the camera frames while this tab is open. */
  focus: StableFocus;
  sections: StableSection[];
}

export const STABLE_TABS: StableTab[] = [
  { id: 'breed', label: 'Breed', group: 'wyvern', focus: 'wyvern', sections: [{ kind: 'breeds', title: 'Breed' }] },
  {
    id: 'colors',
    label: 'Colors',
    group: 'wyvern',
    focus: 'wyvern',
    sections: [
      { kind: 'swatches', title: 'Scales', target: 'wyvern', key: 'primary', palette: PALETTES.scales },
      { kind: 'swatches', title: 'Back & crest', target: 'wyvern', key: 'secondary', palette: PALETTES.scales },
      { kind: 'swatches', title: 'Belly', target: 'wyvern', key: 'belly', palette: PALETTES.belly },
      { kind: 'swatches', title: 'Wing membrane', target: 'wyvern', key: 'membrane', palette: PALETTES.membrane },
      { kind: 'swatches', title: 'Eyes', target: 'wyvern', key: 'eyes', palette: PALETTES.eyes },
    ],
  },
  {
    id: 'markings',
    label: 'Markings',
    group: 'wyvern',
    focus: 'wyvern',
    sections: [{ kind: 'options', title: 'Markings', target: 'wyvern', key: 'pattern', slot: 'wyvernPattern' }],
  },
  {
    id: 'features',
    label: 'Horns & Tail',
    group: 'wyvern',
    focus: 'wyvern',
    sections: [
      { kind: 'options', title: 'Horns', target: 'wyvern', key: 'horns', slot: 'wyvernHorns' },
      { kind: 'options', title: 'Frill', target: 'wyvern', key: 'frill', slot: 'wyvernFrill' },
      { kind: 'options', title: 'Tail', target: 'wyvern', key: 'tail', slot: 'wyvernTail' },
    ],
  },
  {
    id: 'saddle',
    label: 'Saddle',
    group: 'wyvern',
    focus: 'wyvern',
    sections: [
      { kind: 'options', title: 'Saddle', target: 'wyvern', key: 'saddle', slot: 'saddle' },
      { kind: 'swatches', title: 'Saddle leather', target: 'wyvern', key: 'saddleColor', palette: PALETTES.cloth },
    ],
  },
  {
    id: 'rider',
    label: 'Rider',
    group: 'rider',
    focus: 'rider',
    sections: [
      { kind: 'build', title: 'Build' },
      { kind: 'swatches', title: 'Skin', target: 'rider', key: 'skin', palette: PALETTES.skin },
      { kind: 'options', title: 'Hair', target: 'rider', key: 'hair', slot: 'riderHair' },
      { kind: 'swatches', title: 'Hair color', target: 'rider', key: 'hairColor', palette: PALETTES.hair },
    ],
  },
  {
    id: 'outfit',
    label: 'Outfit',
    group: 'rider',
    focus: 'rider',
    sections: [
      { kind: 'options', title: 'Outfit', target: 'rider', key: 'outfit', slot: 'riderOutfit' },
      { kind: 'swatches', title: 'Main color', target: 'rider', key: 'outfitPrimary', palette: PALETTES.cloth },
      { kind: 'swatches', title: 'Trim', target: 'rider', key: 'outfitSecondary', palette: PALETTES.cloth },
    ],
  },
  {
    id: 'gear', label: 'Outfit Pieces', group: 'rider', focus: 'rider',
    sections: [
      { kind: 'garment', title: 'Top', target: 'rider', key: 'top', slot: 'riderTop' },
      { kind: 'garment', title: 'Trousers', target: 'rider', key: 'trousers', slot: 'riderTrousers' },
      { kind: 'garment', title: 'Chest layer', target: 'rider', key: 'chest', slot: 'riderChest' },
      { kind: 'swatches', title: 'Scale color', target: 'rider', key: 'armorColor', palette: PALETTES.cloth },
      { kind: 'garment', title: 'Shoulders & collar', target: 'rider', key: 'shoulderDrape', slot: 'riderDrape' },
      { kind: 'garment', title: 'Belt & sash', target: 'rider', key: 'waist', slot: 'riderWaist' },
      { kind: 'garment', title: 'Sleeves & gloves', target: 'rider', key: 'armWraps', slot: 'riderArmWraps' },
      { kind: 'garment', title: 'Leg wraps & guards', target: 'rider', key: 'legWraps', slot: 'riderLegWraps' },
      { kind: 'garment', title: 'Footwear', target: 'rider', key: 'footwear', slot: 'riderFootwear' },
      { kind: 'swatches', title: 'Leather color', target: 'rider', key: 'leatherColor', palette: PALETTES.cloth },
    ],
  },
  {
    id: 'headgear',
    label: 'Headgear',
    group: 'rider',
    focus: 'rider',
    sections: [{ kind: 'options', title: 'Headgear', target: 'rider', key: 'headgear', slot: 'riderHeadgear' }],
  },
  {
    id: 'scarf',
    label: 'Scarf & Cape',
    group: 'rider',
    focus: 'rider',
    sections: [
      { kind: 'options', title: 'Scarf', target: 'rider', key: 'scarf', slot: 'riderScarf' },
      { kind: 'swatches', title: 'Scarf color', target: 'rider', key: 'scarfColor', palette: PALETTES.cloth },
      { kind: 'options', title: 'Cape', target: 'rider', key: 'cape', slot: 'riderCape' },
      { kind: 'swatches', title: 'Cape color', target: 'rider', key: 'capeColor', palette: PALETTES.cloth },
    ],
  },
];

export const BUILDS: { value: RiderLook['build']; label: string; description: string }[] = [
  { value: 'slight', label: 'Slight', description: 'Light and wiry.' },
  { value: 'medium', label: 'Medium', description: 'Sturdy and balanced.' },
  { value: 'broad', label: 'Broad', description: 'Broad-shouldered and strong.' },
];

const COLOR_KEYS = ['primary', 'secondary', 'belly', 'membrane', 'eyes'] as const;

/**
 * The look after picking a breed. If the colors are still the old breed's defaults, the new
 * breed's defaults come along (so a fresh Skimmer looks like a Skimmer); colors the player chose
 * themselves are kept.
 */
export function withBreed(look: WyvernLook, breed: BreedId): WyvernLook {
  if (look.breed === breed) return look;
  const oldDefaults = BREED_DEFAULT_COLORS[look.breed];
  const untouched = COLOR_KEYS.every((k) => look[k].toLowerCase() === oldDefaults[k].toLowerCase());
  return untouched ? { ...look, breed, ...BREED_DEFAULT_COLORS[breed] } : { ...look, breed };
}

/** True if two looks differ in any field. */
export function looksDiffer<T extends object>(a: T, b: T): boolean {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = (a as Record<string, unknown>)[key], y = (b as Record<string, unknown>)[key];
    if (x === y) continue;
    if (x && y && typeof x === 'object' && typeof y === 'object') {
      if (looksDiffer(x, y)) return true;
    } else return true;
  }
  return false;
}

/** Tab index after a LB/RB press, wrapping. */
export function nextTab(index: number, dir: number, count = STABLE_TABS.length): number {
  return (((index + Math.sign(dir)) % count) + count) % count;
}
