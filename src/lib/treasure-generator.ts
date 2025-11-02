import { MagicItemTreasure } from '@/types/encounter';

/**
 * Treasure Generation System
 *
 * Algorithm:
 * 1. After monster gold is generated, roll for treasure (25% chance)
 * 2. If treasure drops, select a weighted random item from the pool
 * 3. If item value <= monster's remaining gold, add to treasure and subtract value
 * 4. Roll again for another treasure drop (25% chance)
 * 5. Continue until roll fails or item value exceeds remaining gold
 */

const TREASURE_DROP_CHANCE = 0.25; // 25% chance

interface WeightedItem {
  item: any;
  weight: number;
}

/**
 * Calculate weight for a magic item based on rarity and properties
 */
export function getItemWeight(item: any): number {
  const rarity = item.rarity?.toLowerCase();
  const isWondrous = item.wondrous;

  // Base weights by rarity
  let weight = 1; // Common (base weight)

  switch (rarity) {
    case 'uncommon':
      weight = 0.1; // 10x less likely
      break;
    case 'rare':
      weight = 0.01; // 100x less likely
      break;
    case 'very rare':
      weight = 0.001; // 1000x less likely
      break;
    case 'legendary':
      weight = 0.0001; // 10,000x less likely
      break;
    case 'artifact':
      weight = 0.00001; // 100,000x less likely
      break;
  }

  // Wondrous items are 10,000x less likely
  if (isWondrous) {
    weight *= 0.0001;
  }

  return weight;
}

/**
 * Select a random item from a weighted pool
 */
export function selectWeightedItem(weightedItems: WeightedItem[], seed?: number): any | null {
  if (weightedItems.length === 0) return null;

  const totalWeight = weightedItems.reduce((sum, wi) => sum + wi.weight, 0);
  // Add microsecond timestamp and seed for better randomization
  const randomSeed = seed ? seed * 0.0001 : 0;
  let random = (Math.random() + randomSeed + (performance.now() % 1)) * totalWeight;

  for (const weightedItem of weightedItems) {
    random -= weightedItem.weight;
    if (random <= 0) {
      return weightedItem.item;
    }
  }

  // Fallback to last item if rounding causes issues
  return weightedItems[weightedItems.length - 1].item;
}

/**
 * Roll for treasure drop (25% chance)
 */
export function rollForTreasureDrop(): boolean {
  return Math.random() < TREASURE_DROP_CHANCE;
}

/**
 * Convert magic item to treasure format
 */
export function convertToTreasure(item: any): MagicItemTreasure {
  return {
    id: item.id,
    name: item.name,
    rarity: item.rarity,
    value: item.value,
    consumable: item.consumable || false,
    wondrous: item.wondrous || false,
    attunement: item.attunement || false,
    imageUrl: item.imageUrl,
    itemUrl: item.itemUrl
  };
}

/**
 * Generate treasure for a single monster
 *
 * @param monsterGold - The total gold the monster has
 * @param availableItems - Pool of magic items to select from
 * @returns Array of treasure items and remaining gold
 */
export function generateMonsterTreasure(
  monsterGold: number,
  availableItems: any[],
  instanceSeed?: number
): { treasure: MagicItemTreasure[], remainingGold: number } {
  const treasure: MagicItemTreasure[] = [];
  let remainingGold = monsterGold;

  // Filter items to only those with value
  const itemsWithValue = availableItems.filter(item => item.value && item.value > 0);

  if (itemsWithValue.length === 0) {
    console.warn('No items with value available for treasure generation');
    return { treasure, remainingGold };
  }

  // Create weighted pool
  const weightedItems: WeightedItem[] = itemsWithValue.map(item => ({
    item,
    weight: getItemWeight(item)
  }));

  // First roll for treasure
  if (!rollForTreasureDrop()) {
    return { treasure, remainingGold };
  }

  // Treasure generation loop
  let iteration = 0;
  while (true) {
    // Filter items that fit within budget
    const affordableItems = weightedItems.filter(wi => wi.item.value <= remainingGold);

    if (affordableItems.length === 0) {
      // No affordable items, exit loop
      break;
    }

    // Select a random affordable item with instance seed for better randomization
    const seed = instanceSeed ? instanceSeed + iteration : iteration;
    const selectedItem = selectWeightedItem(affordableItems, seed);

    if (!selectedItem) {
      break;
    }

    // Add to treasure and reduce gold
    treasure.push(convertToTreasure(selectedItem));
    remainingGold -= selectedItem.value || 0;

    // Roll for another treasure drop
    if (!rollForTreasureDrop()) {
      // No more treasure, exit loop
      break;
    }

    iteration++;
  }

  return { treasure, remainingGold };
}

/**
 * Generate treasure for all creatures in an encounter
 *
 * @param creatures - Array of creatures with gold values
 * @param availableItems - Pool of magic items to select from
 * @returns Updated creatures array with treasure
 */
export function generateEncounterTreasure(
  creatures: any[],
  availableItems: any[]
): any[] {
  return creatures.map(creature => {
    // If creature has individual gold amounts, generate treasure per instance
    if (creature.individualGold && Array.isArray(creature.individualGold)) {
      const treasurePerInstance: MagicItemTreasure[][] = [];
      const updatedIndividualGold: number[] = [];

      creature.individualGold.forEach((instanceGold: number, idx: number) => {
        if (instanceGold <= 0) {
          treasurePerInstance.push([]);
          updatedIndividualGold.push(instanceGold);
        } else {
          // Pass instance index as seed for better randomization
          const instanceSeed = Date.now() + idx * 1000;
          const { treasure, remainingGold } = generateMonsterTreasure(instanceGold, availableItems, instanceSeed);
          console.log(`[Treasure Gen] ${creature.name} instance ${idx}: ${instanceGold}gp -> ${treasure.length} items (${treasure.map(t => t.name).join(', ')})`);
          treasurePerInstance.push(treasure);
          updatedIndividualGold.push(remainingGold);
        }
      });

      // For backward compatibility, also generate for the total gold
      const totalGold = creature.gold || 0;
      const { treasure, remainingGold } = totalGold > 0
        ? generateMonsterTreasure(totalGold, availableItems)
        : { treasure: [], remainingGold: totalGold };

      return {
        ...creature,
        treasure, // Overall treasure (for summary)
        treasurePerInstance, // Treasure for each instance
        gold: remainingGold,
        individualGold: updatedIndividualGold
      };
    } else {
      // Legacy: single creature without instances
      const monsterGold = creature.gold || 0;

      if (monsterGold <= 0) {
        return { ...creature, treasure: [] };
      }

      const { treasure, remainingGold } = generateMonsterTreasure(monsterGold, availableItems);

      return {
        ...creature,
        treasure,
        gold: remainingGold
      };
    }
  });
}
