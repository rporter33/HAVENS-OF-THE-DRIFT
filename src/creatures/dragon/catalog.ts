// The dragon's parts and the elders' looks (gate G12a; Q48).
//
// Parts are interchangeable across every flight's dragon (Q48a): one body, one skeleton, each part
// riding named bones. The elders' dragons are characters whose looks are authored here (Q48c), so
// parts carry no unlocks. Only parts with a source are listed: today, the white elder's set as
// render 08 shows it. Further options come from the part-variant sheets in the model kit.

import { DRAGON_PART_SLOTS, type DragonFlight, type DragonLook, type DragonPartSlot } from './look';

export interface DragonPartOption {
  slot: DragonPartSlot;
  id: string;
  name: string;
  description: string;
}

export const DRAGON_PARTS: DragonPartOption[] = [
  { slot: 'horns', id: 'branching', name: 'Branching Horns', description: 'Long swept-back horns that branch into tines, pale as old bone.' },
  { slot: 'whiskers', id: 'long', name: 'Long Whiskers', description: 'Two fine whiskers from the upper lip, long enough to reach the ground at rest.' },
  { slot: 'frill', id: 'finCrest', name: 'Fin Crest', description: 'Swept-back cheek fins and a row of spines along the neck and back.' },
  { slot: 'tail', id: 'fin', name: 'Tail Fin', description: 'A low fin along the top of the last third of the tail.' },
  { slot: 'pattern', id: 'plates', name: 'Flight Plates', description: "Broad plates in the flight's accent along the back, neck and tail; pale below." },
];

export function dragonPartsFor(slot: DragonPartSlot): DragonPartOption[] {
  return DRAGON_PARTS.filter((p) => p.slot === slot);
}

/**
 * The elders' dragons, one per flight (Q13: one dragon elder per clan). Only the white elder has a
 * source: render 08, so its look is the white flight's palette unshifted with render 08's parts.
 * Its name, and whether it speaks, are open (Q47f).
 */
export const ELDER_DRAGONS: Partial<Record<DragonFlight, DragonLook>> = {
  white: {
    flight: 'white',
    hueShift: 0,
    parts: { horns: 'branching', whiskers: 'long', frill: 'finCrest', tail: 'fin', pattern: 'plates' },
  },
};

/** True when every slot holds a listed part for that slot. */
export function hasValidParts(look: DragonLook): boolean {
  return DRAGON_PART_SLOTS.every((slot) => DRAGON_PARTS.some((p) => p.slot === slot && p.id === look.parts[slot]));
}
