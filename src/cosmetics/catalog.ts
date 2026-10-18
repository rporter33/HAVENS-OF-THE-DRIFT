// Every cosmetic option in the game, with how it is unlocked. Colors are always free; shapes,
// markings, gear and outfits are earned by exploring (feathers, relics) and racing (medals).
// The wyvern and rider renderers must support every id listed for their slots.

import type { BreedId, CosmeticSlot, Medal, RiderLook, WyvernLook } from '../core/types';
import { garmentOptions } from './wardrobe';

export type Unlock =
  | { type: 'default' }
  | { type: 'feathers'; count: number }
  | { type: 'relic'; relicId: string }
  | { type: 'medal'; raceId: string; medal: Exclude<Medal, 'none'> }
  | { type: 'medals'; medal: Exclude<Medal, 'none'>; count: number };

export interface CosmeticOption {
  id: string;
  slot: CosmeticSlot;
  name: string;
  description: string;
  unlock: Unlock;
  /** Component inherits availability from this complete outfit. */
  sourceOutfit?: string;
}

const opt = (slot: CosmeticSlot, id: string, name: string, description: string, unlock: Unlock = { type: 'default' }): CosmeticOption => ({
  id,
  slot,
  name,
  description,
  unlock,
});

export const COSMETICS: CosmeticOption[] = [
  // Wyvern markings
  opt('wyvernPattern', 'plain', 'Plain', 'An even coat, belly to crest.'),
  opt('wyvernPattern', 'saddleback', 'Saddleback', 'A darker mantle across the shoulders and back, with the breed’s own markings.'),
  opt('wyvernPattern', 'stripes', 'Tiger Stripes', 'Bold bands that taper down the flanks.', { type: 'feathers', count: 5 }),
  opt('wyvernPattern', 'dapple', 'Dapple', 'Soft spots like light through leaves.', { type: 'feathers', count: 10 }),
  opt('wyvernPattern', 'ember', 'Ember Veins', 'Glowing seams that brighten after dusk.', { type: 'relic', relicId: 'relic-ember' }),
  opt('wyvernPattern', 'starfield', 'Starfield', 'Pale freckles like a night sky.', { type: 'medals', medal: 'gold', count: 3 }),
  opt('wyvernPattern', 'gilded', 'Gilded Scales', 'Gold-tipped scales that catch the sun.', { type: 'medals', medal: 'gold', count: 6 }),

  // Wyvern horns
  opt('wyvernHorns', 'swept', 'Swept Horns', 'A pair of long horns swept back along the neck.'),
  opt('wyvernHorns', 'none', 'Hornless', 'Smooth-skulled and aerodynamic.'),
  opt('wyvernHorns', 'ram', 'Ram Horns', 'Heavy curls that frame the face.', { type: 'feathers', count: 8 }),
  opt('wyvernHorns', 'crown', 'Crown', 'A ring of short spikes around the skull.', { type: 'medal', raceId: 'roost-loop', medal: 'gold' }),
  opt('wyvernHorns', 'antler', 'Antlers', 'Branching tines, like an old stag.', { type: 'relic', relicId: 'relic-antler' }),
  opt('wyvernHorns', 'unicorn', 'Lancehorn', 'A single spiral horn on the brow.', { type: 'feathers', count: 30 }),

  // Wyvern frill / crest
  opt('wyvernFrill', 'none', 'No Frill', 'Clean lines from snout to tail.'),
  opt('wyvernFrill', 'spines', 'Dorsal Spines', 'A row of short spines down the spine.'),
  opt('wyvernFrill', 'sail', 'Sail Crest', 'A webbed crest along the neck that ripples in the wind.', { type: 'feathers', count: 15 }),
  opt('wyvernFrill', 'mane', 'Feathered Mane', 'A shaggy mane of feathers at the neck.', { type: 'relic', relicId: 'relic-mane' }),
  opt('wyvernFrill', 'fan', 'Cheek Fans', 'Webbed fans behind the jaw that flare when it roars.', { type: 'medal', raceId: 'cascade-run', medal: 'silver' }),

  // Wyvern tail tip
  opt('wyvernTail', 'spade', 'Spade Tip', 'The classic arrowhead.'),
  opt('wyvernTail', 'blade', 'Blade Tip', 'A long, flat fin for steering.', { type: 'feathers', count: 3 }),
  opt('wyvernTail', 'plume', 'Plume', 'A spray of long tail feathers that stream behind.', { type: 'feathers', count: 20 }),
  opt('wyvernTail', 'club', 'Club', 'A heavy knob of bone.', { type: 'medal', raceId: 'needle-slalom', medal: 'bronze' }),
  opt('wyvernTail', 'ribbon', 'Ribbon Fins', 'Twin trailing fins that flutter at speed.', { type: 'relic', relicId: 'relic-ribbon' }),

  // Saddles
  opt('saddle', 'rider', "Rider's Saddle", 'Worn leather, brass buckles, a blanket underneath.'),
  opt('saddle', 'racing', 'Racing Shell', 'A low, light saddle. You ride flat to the neck.', { type: 'medals', medal: 'bronze', count: 2 }),
  opt('saddle', 'nomad', "Nomad's Pack", 'Bedrolls, a lantern and saddlebags for long flights.', { type: 'feathers', count: 12 }),
  opt('saddle', 'royal', 'Royal Howdah', 'Carved wood, silk tassels and a little canopy.', { type: 'relic', relicId: 'relic-howdah' }),

  // Rider hair
  opt('riderHair', 'short', 'Short', 'Practical and windproof.'),
  opt('riderHair', 'ponytail', 'Ponytail', 'Long tail that streams out behind you.'),
  opt('riderHair', 'braids', 'Braids', 'Twin braids, tied off with cord.'),
  opt('riderHair', 'curls', 'Curls', 'A cloud of curls.'),
  opt('riderHair', 'shaved', 'Shaved', 'Nothing for the wind to grab.'),
  opt('riderHair', 'long', 'Long & Loose', 'A mane that flies everywhere at speed.', { type: 'feathers', count: 6 }),

  // Rider outfits
  opt('riderOutfit', 'travel-drape', 'Travel Drape', 'Ivory chiton and gathered trousers, with individually selectable gear. Medium build; drape secured for flight.'),
  opt('riderOutfit', 'flight', 'Flight Leathers', 'Fitted jacket, gloves and riding boots.'),
  opt('riderOutfit', 'scout', "Scout's Tunic", 'Light, layered and full of pockets.'),
  opt('riderOutfit', 'courier', "Courier's Coat", 'A long coat with a high collar.', { type: 'feathers', count: 10 }),
  opt('riderOutfit', 'racer', 'Racing Suit', 'Close-fitting, striped, unmistakably fast.', { type: 'medals', medal: 'silver', count: 3 }),
  opt('riderOutfit', 'cartographer', "Cartographer's Robes", 'Embroidered with the old wind charts.', { type: 'relic', relicId: 'relic-charts' }),
  opt('riderOutfit', 'skyknight', 'Skyknight Plate', 'Polished pauldrons and a tabard. Ceremonial.', { type: 'medals', medal: 'gold', count: 5 }),

  // Approved Travel Drape components. The base chiton/trousers always remain covered.
  opt('riderChest', 'slate-scales', 'Slate Scale Panel', 'Four broad rows of matte scales over the chiton.'),
  opt('riderChest', 'none', 'No Chest Armor', 'Keep the soft linen chiton.'),
  opt('riderDrape', 'chlamys', 'Shoulder Drape & Brooch', 'Folded linen fastened with an antique bronze spiral.'),
  opt('riderDrape', 'none', 'No Shoulder Drape', 'Leave the shoulders free of the outer drape.'),
  opt('riderWaist', 'woven-sash', 'Woven Sash', 'A broad dyed sash and hip knot.'),
  opt('riderWaist', 'none', 'No Sash', 'A simple uninterrupted chiton.'),
  opt('riderArmWraps', 'linen-wraps', 'Linen Arm Wraps', 'Soft forearm wraps; leather palm wraps in the riding cut.'),
  opt('riderArmWraps', 'none', 'No Arm Wraps', 'Bare forearms; the Windline tool remains separate.'),
  opt('riderLegWraps', 'leather-wraps', 'Leather Leg Wraps', 'Crossed leather straps over the calves.'),
  opt('riderLegWraps', 'none', 'No Leg Wraps', 'Leave the calves unwrapped.'),
  opt('riderFootwear', 'sandals', 'Riding Sandals', 'Leather straps, reinforced sole and heel.'),
  opt('riderFootwear', 'none', 'Bare Feet', 'Remove the sandals.'),

  // Rider headgear
  opt('riderHeadgear', 'goggles', 'Flight Goggles', 'Brass goggles pushed up on the forehead.'),
  opt('riderHeadgear', 'none', 'Bare Head', 'Wind in your hair.'),
  opt('riderHeadgear', 'cap', 'Aviator Cap', 'Leather cap with ear flaps.', { type: 'feathers', count: 4 }),
  opt('riderHeadgear', 'hood', 'Hood', 'A deep hood that billows.', { type: 'feathers', count: 14 }),
  opt('riderHeadgear', 'helm', 'Winged Helm', 'A light helm with swept metal wings.', { type: 'medal', raceId: 'lantern-dash', medal: 'gold' }),
  opt('riderHeadgear', 'circlet', 'Wind Circlet', 'A thin band set with a glowing stone.', { type: 'relic', relicId: 'relic-circlet' }),

  // Rider scarf
  opt('riderScarf', 'long', 'Long Scarf', 'A long scarf that streams behind you.'),
  opt('riderScarf', 'none', 'No Scarf', 'Collar up instead.'),
  opt('riderScarf', 'short', 'Neckerchief', 'A knotted kerchief, ends fluttering.'),
  opt('riderScarf', 'twin', 'Twin Tails', 'Two long tails that weave around each other.', { type: 'feathers', count: 25 }),

  // Rider cape
  opt('riderCape', 'none', 'No Cape', 'Nothing to catch the air.'),
  opt('riderCape', 'half', 'Half Cape', 'Over one shoulder, light and quick.', { type: 'feathers', count: 2 }),
  opt('riderCape', 'full', 'Full Cape', 'Floor-length and dramatic in a dive.', { type: 'feathers', count: 18 }),
  opt('riderCape', 'tattered', 'Tattered Cape', 'Frayed ends that whip in the wind.', { type: 'medal', raceId: 'underspan', medal: 'silver' }),
  opt('riderCape', 'feathered', 'Feathered Mantle', 'Layered feathers from every corner of the Drift.', { type: 'feathers', count: 40 }),
];

COSMETICS.push(...garmentOptions(COSMETICS));

export function cosmeticsFor(slot: CosmeticSlot): CosmeticOption[] {
  return COSMETICS.filter((c) => c.slot === slot);
}

export function cosmeticById(id: string, slot?: CosmeticSlot): CosmeticOption | undefined {
  return COSMETICS.find((c) => c.id === id && (!slot || c.slot === slot));
}

/** Curated swatches. Any hex is valid; these are what the stable offers. */
export const PALETTES = {
  scales: [
    '#2f5d50', '#3f7d5a', '#6f9a4a', '#a8a24a', '#c48a3a', '#b5562f', '#8e2f2f', '#6a2f4f',
    '#4b3a6b', '#2f4a7a', '#2f6f8f', '#4f8fa8', '#8fa8b8', '#d8d0c0', '#5a5048', '#2a2a30',
  ],
  // The palest bellies sit about 8% darker in lightness than first picked: under golden-hour
  // light a cream near white bloomed (materials.ts also caps a look's belly luminance).
  belly: ['#dfcea7', '#d8c098', '#c8a878', '#e8c8a0', '#c0d0c8', '#b8b0c8', '#e6d8be', '#a89880'],
  membrane: [
    '#c86a4a', '#d89a5a', '#e8c070', '#9ac070', '#5aa890', '#5a88c0', '#8a6ac0', '#c06a9a',
    '#e8e0d0', '#6a5a50', '#3a3a48', '#d84a4a',
  ],
  eyes: ['#f0c040', '#e87830', '#60d0e0', '#90e060', '#d060d0', '#f0f0e0', '#e04040', '#4080f0'],
  skin: ['#f2d0b8', '#e6b896', '#d09a74', '#b07a56', '#8a5a3e', '#6a4230', '#4a2e22', '#f0dcc8'],
  hair: ['#1e1a18', '#3a2a20', '#6a4a30', '#a87a48', '#d8b070', '#e8d8b0', '#a03a2a', '#c86a3a', '#8a8a90', '#e8e8e8', '#4a6ac0', '#8a4ab0'],
  cloth: [
    '#7a5232', '#a8582a', '#c89048', '#d8c08a', '#4a6a3a', '#2f5a5a', '#2f4a6a', '#3a3a5a',
    '#6a3a5a', '#8a2a3a', '#e8e0d0', '#4a4440', '#2a2a2e', '#1f3a6a', '#c8a050', '#5a7a8a',
  ],
} as const;

/**
 * Breed defaults: a starting look per breed so switching breeds looks deliberate. Each secondary
 * (the mantle and markings) sits at least 0.2 under its primary in lightness (L*), a value step
 * that still reads from the chase camera.
 */
export const BREED_DEFAULT_COLORS: Record<BreedId, Pick<WyvernLook, 'primary' | 'secondary' | 'belly' | 'membrane' | 'eyes'>> = {
  // Olive-moss with a dark olive mantle and bright amber sails, as target renders 01 and 02 (G3);
  // was a cooler emerald '#3f7d5a' / '#23453b' with a duller '#d89a5a' membrane.
  harrier: { primary: '#586e46', secondary: '#2d3a28', belly: '#dfcea7', membrane: '#e89a40', eyes: '#f0c040' },
  skimmer: { primary: '#2f6f8f', secondary: '#23375a', belly: '#c0d0c8', membrane: '#5aa890', eyes: '#60d0e0' },
  // Storm-slate with a deep blue mantle and amber sails: mid-to-dark values, so the mount reads
  // against the white cloud sea even in full sun and haze (VIS-06). The slate sits a full step
  // under the cloud's value (the guide flies a galewing and must be found at a glance).
  galewing: { primary: '#4d6477', secondary: '#233148', belly: '#dbccb4', membrane: '#cf8a3c', eyes: '#4080f0' },
  ironback: { primary: '#6a5d52', secondary: '#2a2a30', belly: '#c8a878', membrane: '#b5562f', eyes: '#e87830' },
};

export const DEFAULT_WYVERN: WyvernLook = {
  breed: 'harrier',
  ...BREED_DEFAULT_COLORS.harrier,
  pattern: 'saddleback',
  horns: 'swept',
  frill: 'spines',
  tail: 'spade',
  saddle: 'rider',
  // Worn brown leather, as the target renders' tack (G3); was an oxblood '#7a3a2a' that read red.
  saddleColor: '#7a5232',
};

export const DEFAULT_RIDER: RiderLook = {
  build: 'medium',
  skin: '#d09a74',
  hair: 'ponytail',
  hairColor: '#3a2a20',
  outfit: 'flight',
  outfitPrimary: '#2f4a6a',
  outfitSecondary: '#c89048',
  headgear: 'goggles',
  scarf: 'long',
  scarfColor: '#a8582a',
  cape: 'none',
  capeColor: '#8a2a3a',
  chest: 'slate-scales',
  shoulderDrape: 'chlamys',
  waist: 'woven-sash',
  armWraps: 'linen-wraps',
  legWraps: 'leather-wraps',
  footwear: 'sandals',
  armorColor: '#586875',
  leatherColor: '#80634d',
};
