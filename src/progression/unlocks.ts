// Unlock rules: which cosmetics a save has earned. The evaluator is pure (save in, newly earned
// cosmetic options out) so every unlock type is unit-tested without a browser; grantUnlocks()
// applies the result to a live save and announces it on the event bus.

import type { CosmeticSlot, Medal } from '../core/types';
import type { GameEventBus } from '../core/events';
import type { SaveData } from '../game/contracts';
import { COSMETICS, type CosmeticOption, type Unlock } from '../cosmetics/catalog';
import { isFeatherId, relicById } from './relics';

const RANK: Record<Medal, number> = { none: 0, bronze: 1, silver: 2, gold: 3 };

/** Medal ordering: true when `have` is at least as good as `need`. */
export function medalAtLeast(have: Medal, need: Medal): boolean {
  return RANK[have] >= RANK[need];
}

/** The better of two medals. */
export function bestMedal(a: Medal, b: Medal): Medal {
  return RANK[a] >= RANK[b] ? a : b;
}

export function featherCount(save: Pick<SaveData, 'collected'>): number {
  let n = 0;
  for (const id of save.collected) if (isFeatherId(id)) n++;
  return n;
}

/** Races holding at least `medal`. */
export function medalTally(save: Pick<SaveData, 'races'>, medal: Exclude<Medal, 'none'>): number {
  let n = 0;
  for (const r of Object.values(save.races)) if (r && medalAtLeast(r.medal, medal)) n++;
  return n;
}

/** How far a save is toward an unlock: `have` of `need` (both 0/1 for yes/no conditions). */
export function unlockProgress(unlock: Unlock, save: Pick<SaveData, 'collected' | 'races'>): { have: number; need: number } {
  switch (unlock.type) {
    case 'default':
      return { have: 1, need: 1 };
    case 'feathers':
      return { have: Math.min(unlock.count, featherCount(save)), need: unlock.count };
    case 'relic':
      return { have: save.collected.includes(unlock.relicId) ? 1 : 0, need: 1 };
    case 'medal': {
      const r = save.races[unlock.raceId];
      return { have: r && medalAtLeast(r.medal, unlock.medal) ? 1 : 0, need: 1 };
    }
    case 'medals':
      return { have: Math.min(unlock.count, medalTally(save, unlock.medal)), need: unlock.count };
  }
}

export function unlockSatisfied(unlock: Unlock, save: Pick<SaveData, 'collected' | 'races'>): boolean {
  const p = unlockProgress(unlock, save);
  return p.have >= p.need;
}

/** Key that identifies a cosmetic option uniquely (ids repeat across slots, e.g. 'long'). */
export function cosmeticKey(c: Pick<CosmeticOption, 'slot' | 'id'>): string {
  return `${c.slot}:${c.id}`;
}

/**
 * True when the save records this option as unlocked. Entries are plain ids (the save format),
 * or `slot:id` for an id that more than one slot uses.
 */
export function recordedUnlocked(save: Pick<SaveData, 'unlocked'>, c: Pick<CosmeticOption, 'slot' | 'id'>): boolean {
  return save.unlocked.includes(c.id) || save.unlocked.includes(cosmeticKey(c));
}

/**
 * PURE: the cosmetic options this save has earned but not yet recorded. Defaults are never
 * "newly unlocked". Order follows the catalog.
 */
export function evaluateUnlocks(save: Pick<SaveData, 'collected' | 'races' | 'unlocked'>, catalog: readonly CosmeticOption[] = COSMETICS): CosmeticOption[] {
  const out: CosmeticOption[] = [];
  for (const c of catalog) {
    // Garment availability is derived from the outfit; do not spam separate reward toasts.
    if (c.sourceOutfit) continue;
    if (c.unlock.type === 'default') continue;
    if (recordedUnlocked(save, c)) continue;
    if (unlockSatisfied(c.unlock, save)) out.push(c);
  }
  return out;
}

/** The id to record for an option: plain unless another non-default option shares the id. */
export function unlockEntry(c: CosmeticOption, catalog: readonly CosmeticOption[] = COSMETICS): string {
  const clash = catalog.some((o) => o !== c && o.id === c.id && o.unlock.type !== 'default');
  return clash ? cosmeticKey(c) : c.id;
}

const SLOT_LABEL: Record<CosmeticSlot, string> = {
  wyvernPattern: 'Wyvern markings',
  wyvernHorns: 'Wyvern horns',
  wyvernFrill: 'Wyvern crest',
  wyvernTail: 'Wyvern tail',
  saddle: 'Saddle',
  riderHair: 'Rider hair',
  riderOutfit: 'Rider outfit',
  riderHeadgear: 'Rider headgear',
  riderScarf: 'Rider scarf',
  riderCape: 'Rider cape',
  riderChest: 'Rider chest armor',
  riderDrape: 'Rider shoulder drape',
  riderWaist: 'Rider waist',
  riderArmWraps: 'Rider arm wraps',
  riderLegWraps: 'Rider leg wraps',
  riderFootwear: 'Rider footwear',
  riderTop: 'Rider top',
  riderTrousers: 'Rider trousers',
};

export function slotLabel(slot: CosmeticSlot): string {
  return SLOT_LABEL[slot];
}

/**
 * Record everything newly earned and announce it ('unlock' + a 'toast' each). Returns the
 * options granted. `quiet` records without announcing (catching up an old save at load).
 */
export function grantUnlocks(save: SaveData, events: GameEventBus | null, quiet = false, catalog: readonly CosmeticOption[] = COSMETICS): CosmeticOption[] {
  const fresh = evaluateUnlocks(save, catalog);
  for (const c of fresh) {
    save.unlocked.push(unlockEntry(c, catalog));
    if (quiet || !events) continue;
    events.emit('unlock', { cosmeticId: c.id, name: c.name, slot: c.slot });
    events.emit('toast', { text: `Unlocked: ${c.name}`, sub: slotLabel(c.slot), icon: 'unlock' });
  }
  return fresh;
}

/** Human-readable requirement for the stable UI ("Find 15 feathers", "Gold on Roost Loop"). */
export function describeUnlock(unlock: Unlock, raceName: (id: string) => string = (id) => id): string {
  const medal = (m: Exclude<Medal, 'none'>) => m[0].toUpperCase() + m.slice(1);
  switch (unlock.type) {
    case 'default':
      return 'Always available';
    case 'feathers':
      return `Find ${unlock.count} feather${unlock.count === 1 ? '' : 's'}`;
    case 'relic':
      return `Find the ${relicById(unlock.relicId)?.name ?? 'lost relic'}`;
    case 'medal':
      return `${medal(unlock.medal)} on ${raceName(unlock.raceId)}`;
    case 'medals':
      return `${medal(unlock.medal)} or better on ${unlock.count} races`;
  }
}
