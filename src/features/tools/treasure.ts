// The treasure generator's rolls. Coins come from the challenge-rating table the
// encounter generator uses; magic items come from the Magic Items table, picked
// with the same rarity weights (src/lib/treasure-generator.ts). Nothing here
// invents items.
import type { NotionMagicItem } from '@/hooks/useNotionService';
import { GOLD_BY_CR, rollDice, type DiceRoll } from '@/lib/coin-rolls';
import { convertToTreasure, generateMonsterTreasure, getItemWeight, selectWeightedItem } from '@/lib/treasure-generator';
import type { MagicItemTreasure } from '@/types/encounter';

export const CHALLENGE_RATINGS = Object.keys(GOLD_BY_CR);

export interface CreatureGroup {
  cr: string;
  count: number;
}

/** What one creature carries: its coin roll, the items it bought with those coins, and what's left. */
export interface Purse {
  cr: string;
  coins: DiceRoll;
  items: MagicItemTreasure[];
  left: number;
}

/**
 * Loot for each creature, as encounter loot is rolled: coins by challenge rating, then a
 * 1 in 4 chance of an item the coins can pay for, again and again until a roll fails.
 */
export function rollCarried(groups: CreatureGroup[], pool: NotionMagicItem[], random: () => number = Math.random): Purse[] {
  return groups.flatMap(({ cr, count }) =>
    Array.from({ length: count }, () => {
      const coins = rollDice(GOLD_BY_CR[cr] ?? '0', random);
      const { treasure, remainingGold } = generateMonsterTreasure(coins.total, pool, random);
      return { cr, coins, items: treasure, left: remainingGold };
    })
  );
}

export interface Hoard {
  worth: number;
  items: MagicItemTreasure[];
  /** Coins: the worth the items didn't use. */
  left: number;
}

/** A cache of a set worth: distinct items drawn by rarity weight while they still fit, up to `maxItems`. */
export function rollHoard(worth: number, maxItems: number, pool: NotionMagicItem[], random: () => number = Math.random): Hoard {
  let left = worth;
  const items: MagicItemTreasure[] = [];
  let candidates = pool.filter((item) => (item.value ?? 0) > 0).map((item) => ({ item, weight: getItemWeight(item) }));
  while (items.length < maxItems) {
    const pick: NotionMagicItem | null = selectWeightedItem(candidates.filter((c) => c.item.value <= left), random);
    if (!pick) break;
    items.push(convertToTreasure(pick));
    left -= pick.value;
    candidates = candidates.filter((c) => c.item !== pick);
  }
  return { worth, items, left };
}

/** Rarity on the tier scale: a Rare item and a CR 11–15 creature share azure. */
const RARITY_TIER: Record<string, string> = {
  common: 'ash',
  uncommon: 'verdant',
  rare: 'azure',
  'very rare': 'amethyst',
  legendary: 'ember',
  artifact: 'blood',
};
const TIER_ORDER = Object.keys(RARITY_TIER);

export const rarityTier = (rarity?: string) => RARITY_TIER[(rarity ?? '').toLowerCase()] ?? 'bone';

/** Rarities in tier order; ones off the scale go last, alphabetically. */
export function sortRarities(rarities: Iterable<string>): string[] {
  const rank = (r: string) => {
    const i = TIER_ORDER.indexOf(r.toLowerCase());
    return i < 0 ? TIER_ORDER.length : i;
  };
  return [...new Set(rarities)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
