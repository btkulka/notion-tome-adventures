import { describe, expect, it } from 'vitest';
import type { NotionMagicItem } from '@/hooks/useNotionService';
import { rollDice } from '@/lib/coin-rolls';
import { selectWeightedItem } from '@/lib/treasure-generator';
import { mulberry32 } from '@/features/maps/gen/prng';
import { rarityTier, rollCarried, rollHoard, sortRarities } from '../treasure';

const item = (id: string, value: number, rarity = 'Common'): NotionMagicItem => ({
  id,
  name: id,
  value,
  rarity,
  consumable: false,
  wondrous: false,
  attunement: false,
  archived: false,
});

const pool = [
  item('candle', 5),
  item('potion', 50),
  item('rope', 20),
  item('cloak', 400, 'Uncommon'),
  item('ring', 4000, 'Rare'),
];

const total = (items: { value?: number }[]) => items.reduce((n, i) => n + (i.value ?? 0), 0);

describe('rollDice', () => {
  it('rolls nothing for the table\'s zero', () => {
    expect(rollDice('0')).toEqual({ formula: '0', total: 0, dice: [] });
  });

  it('keeps every die of a small roll', () => {
    const roll = rollDice('3d4', () => 0.999);
    expect(roll).toEqual({ formula: '3d4', total: 12, dice: [4, 4, 4] });
  });

  it('keeps only the total of a huge roll', () => {
    const roll = rollDice('1420d20', mulberry32(7));
    expect(roll.dice).toBeNull();
    expect(roll.total).toBeGreaterThanOrEqual(1420);
    expect(roll.total).toBeLessThanOrEqual(1420 * 20);
  });
});

describe('selectWeightedItem', () => {
  const weighted = [{ item: 'common', weight: 1 }, { item: 'uncommon', weight: 0.1 }];

  it('lands where the roll falls on the weights', () => {
    expect(selectWeightedItem(weighted, () => 0.5)).toBe('common');
    expect(selectWeightedItem(weighted, () => 0.95)).toBe('uncommon');
  });

  it('favours the heavier item about as often as its weight says', () => {
    const random = mulberry32(42);
    let common = 0;
    for (let i = 0; i < 4000; i++) if (selectWeightedItem(weighted, random) === 'common') common++;
    expect(common / 4000).toBeGreaterThan(0.88);
    expect(common / 4000).toBeLessThan(0.94);
  });
});

describe('rollCarried', () => {
  it('rolls one purse per creature', () => {
    const purses = rollCarried([{ cr: '1', count: 3 }, { cr: '5', count: 1 }], pool, mulberry32(1));
    expect(purses.map((p) => p.cr)).toEqual(['1', '1', '1', '5']);
  });

  it('pays for every item out of the creature\'s own coins', () => {
    const random = mulberry32(9);
    for (let i = 0; i < 300; i++) {
      for (const purse of rollCarried([{ cr: '4', count: 2 }], pool, random)) {
        expect(purse.left + total(purse.items)).toBe(purse.coins.total);
        expect(purse.left).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('gives a creature with no coins nothing', () => {
    const [purse] = rollCarried([{ cr: '1/8', count: 1 }], pool, mulberry32(3));
    expect(purse.coins.total).toBe(0);
    expect(purse.items).toEqual([]);
  });
});

describe('rollHoard', () => {
  it('spends no more than the hoard is worth, on distinct items, up to the cap', () => {
    const random = mulberry32(5);
    for (let i = 0; i < 300; i++) {
      const hoard = rollHoard(500, 3, pool, random);
      expect(hoard.items.length).toBeLessThanOrEqual(3);
      expect(new Set(hoard.items.map((t) => t.id)).size).toBe(hoard.items.length);
      expect(hoard.left + total(hoard.items)).toBe(500);
      expect(hoard.left).toBeGreaterThanOrEqual(0);
    }
  });

  it('stops when nothing else fits', () => {
    const hoard = rollHoard(30, 10, pool, mulberry32(2));
    expect(hoard.items.every((t) => (t.value ?? 0) <= 30)).toBe(true);
    expect(hoard.left).toBeLessThan(30);
  });
});

describe('rarities', () => {
  it('sorts along the tier scale, unknown ones last', () => {
    expect(sortRarities(['Rare', 'Homebrew', 'Common', 'Legendary', 'Rare'])).toEqual(['Common', 'Rare', 'Legendary', 'Homebrew']);
  });

  it('shares azure between Rare and CR 11–15', () => {
    expect(rarityTier('Rare')).toBe('azure');
    expect(rarityTier('very rare')).toBe('amethyst');
    expect(rarityTier(undefined)).toBe('bone');
  });
});
