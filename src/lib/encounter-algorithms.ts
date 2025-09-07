/**
 * Shared encounter generation utilities and algorithms
 * Eliminates duplication between different encounter generation services
 */

import { 
  XP_BY_CR, 
  calculateXPFromCR, 
  getEncounterMultiplier 
} from '@/lib/property-parsing';

export interface EncounterCreature {
  id: string;
  name: string;
  challenge_rating: number;
  xp_value: number;
  creature_type?: string;
  alignment?: string;
  size?: string;
  environment?: string[];
}

export interface EncounterSelection {
  creature: EncounterCreature;
  quantity: number;
}

export interface EncounterResult {
  total_xp: number;
  adjusted_xp: number;
  multiplier_used: number;
  difficulty: string;
  creatures: Array<{
    id: string;
    name: string;
    challenge_rating: number;
    xp_value: number;
    quantity: number;
    total_xp: number;
  }>;
}

/**
 * Difficulty calculation utilities
 */
export const difficultyUtils = {
  /**
   * Calculate encounter difficulty based on adjusted XP vs target
   */
  calculateDifficulty(adjustedXP: number, targetXP: number): string {
    if (adjustedXP <= targetXP * 0.5) return 'Easy';
    if (adjustedXP <= targetXP) return 'Medium';
    if (adjustedXP <= targetXP * 1.5) return 'Hard';
    return 'Deadly';
  },

  /**
   * Calculate XP thresholds for a party
   */
  calculatePartyThresholds(partyLevel: number, partySize: number = 4): {
    easy: number;
    medium: number;
    hard: number;
    deadly: number;
  } {
    const baseThresholds = {
      1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
      2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
      3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
      4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
      5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
      // Add more levels as needed
    };

    const thresholds = baseThresholds[partyLevel as keyof typeof baseThresholds] || baseThresholds[5];
    
    return {
      easy: thresholds.easy * partySize,
      medium: thresholds.medium * partySize,
      hard: thresholds.hard * partySize,
      deadly: thresholds.deadly * partySize
    };
  }
};

/**
 * Creature filtering utilities
 */
export const filterUtils = {
  /**
   * Filter creatures by multiple criteria
   */
  filterCreatures(
    creatures: EncounterCreature[],
    filters: {
      minCR?: number;
      maxCR?: number;
      environment?: string;
      alignment?: string;
      creatureType?: string;
      size?: string;
      preferredCRRange?: [number, number];
    }
  ): EncounterCreature[] {
    let filtered = creatures.filter(creature => {
      // CR range
      if (filters.minCR !== undefined && creature.challenge_rating < filters.minCR) return false;
      if (filters.maxCR !== undefined && creature.challenge_rating > filters.maxCR) return false;

      // Environment
      if (filters.environment && filters.environment !== 'Any') {
        if (!creature.environment?.includes(filters.environment)) return false;
      }

      // Alignment
      if (filters.alignment && filters.alignment !== 'Any') {
        if (creature.alignment !== filters.alignment) return false;
      }

      // Creature type
      if (filters.creatureType && filters.creatureType !== 'Any') {
        if (creature.creature_type !== filters.creatureType) return false;
      }

      // Size
      if (filters.size && filters.size !== 'Any') {
        if (creature.size !== filters.size) return false;
      }

      return true;
    });

    // Apply preferred CR range
    if (filters.preferredCRRange) {
      const [minPreferred, maxPreferred] = filters.preferredCRRange;
      const preferred = filtered.filter(c => 
        c.challenge_rating >= minPreferred && c.challenge_rating <= maxPreferred
      );
      
      if (preferred.length > 0) {
        filtered = preferred;
      }
    }

    return filtered;
  },

  /**
   * Sort creatures by different criteria
   */
  sortCreatures(
    creatures: EncounterCreature[],
    sortBy: 'xp' | 'cr' | 'name' | 'type' = 'xp',
    ascending: boolean = false
  ): EncounterCreature[] {
    const sorted = [...creatures].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'xp':
          comparison = (a.xp_value || 0) - (b.xp_value || 0);
          break;
        case 'cr':
          comparison = a.challenge_rating - b.challenge_rating;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          comparison = (a.creature_type || '').localeCompare(b.creature_type || '');
          break;
      }
      
      return ascending ? comparison : -comparison;
    });

    return sorted;
  }
};

/**
 * Encounter generation algorithms
 */
export const encounterAlgorithms = {
  /**
   * Generate single creature encounter
   */
  singleCreature(creatures: EncounterCreature[], targetXP: number): EncounterSelection[] | null {
    let bestCreature: EncounterCreature | null = null;
    let bestScore = -1;

    for (const creature of creatures) {
      const xp = creature.xp_value || 0;
      if (xp <= 0) continue;

      // Score based on proximity to target
      let score;
      if (xp <= targetXP) {
        score = xp / targetXP; // Prefer creatures closer to target
      } else {
        score = targetXP / xp * 0.7; // Penalty for exceeding target
      }

      if (score > bestScore) {
        bestScore = score;
        bestCreature = creature;
      }
    }

    return bestCreature ? [{ creature: bestCreature, quantity: 1 }] : null;
  },

  /**
   * Generate multiple identical creatures encounter
   */
  multipleIdentical(
    creatures: EncounterCreature[], 
    targetXP: number, 
    maxQuantity: number = 6
  ): EncounterSelection[] | null {
    for (const creature of creatures) {
      const xp = creature.xp_value || 0;
      if (xp <= 0) continue;

      for (let quantity = 2; quantity <= maxQuantity; quantity++) {
        const totalXP = xp * quantity;
        const multiplier = getEncounterMultiplier(quantity);
        const adjustedXP = totalXP * multiplier;

        // Check if this fits our target
        if (adjustedXP >= targetXP * 0.5 && adjustedXP <= targetXP * 1.6) {
          return [{ creature, quantity }];
        }
      }
    }

    return null;
  },

  /**
   * Generate mixed creatures encounter using greedy algorithm
   */
  mixedCreatures(
    creatures: EncounterCreature[], 
    targetXP: number, 
    maxTypes: number = 4
  ): EncounterSelection[] | null {
    const sortedCreatures = filterUtils.sortCreatures(creatures, 'xp', false);
    const selected: EncounterSelection[] = [];
    let currentXP = 0;
    const availableCreatures = [...sortedCreatures];

    while (selected.length < maxTypes && currentXP < targetXP * 0.9) {
      let bestCreature: EncounterCreature | null = null;
      let bestScore = -1;

      for (const creature of availableCreatures) {
        const xp = creature.xp_value || 0;
        if (xp <= 0) continue;

        const newTotal = currentXP + xp;
        const remainingBudget = targetXP - newTotal;
        
        // Scoring algorithm
        let score = 0;
        
        if (remainingBudget >= 0) {
          score += (xp / targetXP) * 100; // XP efficiency
          score += ((targetXP - remainingBudget) / targetXP) * 50; // Budget usage
        } else {
          score = Math.max(0, 20 - Math.abs(remainingBudget) / targetXP * 100); // Penalty for overspend
        }

        // Diversity bonus
        const hasType = selected.some(s => s.creature.creature_type === creature.creature_type);
        if (!hasType) {
          score += 25;
        }

        if (score > bestScore) {
          bestScore = score;
          bestCreature = creature;
        }
      }

      if (!bestCreature || bestScore <= 0) break;

      // Add creature
      selected.push({ creature: bestCreature, quantity: 1 });
      currentXP += bestCreature.xp_value || 0;
      
      // Remove from available
      const index = availableCreatures.indexOf(bestCreature);
      if (index > -1) {
        availableCreatures.splice(index, 1);
      }
    }

    return selected.length > 0 ? selected : null;
  }
};

/**
 * Create encounter result from selection
 */
export function createEncounterResult(
  selection: EncounterSelection[],
  targetXP: number
): EncounterResult {
  const totalXP = selection.reduce((sum, s) => sum + (s.creature.xp_value * s.quantity), 0);
  const totalCreatures = selection.reduce((sum, s) => sum + s.quantity, 0);
  const multiplier = getEncounterMultiplier(totalCreatures);
  const adjustedXP = Math.round(totalXP * multiplier);
  const difficulty = difficultyUtils.calculateDifficulty(adjustedXP, targetXP);

  const creatures = selection.map(s => ({
    id: s.creature.id,
    name: s.creature.name,
    challenge_rating: s.creature.challenge_rating,
    xp_value: s.creature.xp_value,
    quantity: s.quantity,
    total_xp: s.creature.xp_value * s.quantity
  }));

  return {
    total_xp: totalXP,
    adjusted_xp: adjustedXP,
    multiplier_used: multiplier,
    difficulty,
    creatures
  };
}

/**
 * Encounter generation strategy selector
 */
export function generateEncounter(
  creatures: EncounterCreature[],
  targetXP: number,
  maxCreatures: number = 6,
  strategies: Array<'single' | 'multiple' | 'mixed'> = ['single', 'multiple', 'mixed']
): EncounterResult | null {
  for (const strategy of strategies) {
    let selection: EncounterSelection[] | null = null;

    switch (strategy) {
      case 'single':
        selection = encounterAlgorithms.singleCreature(creatures, targetXP);
        break;
      case 'multiple':
        selection = encounterAlgorithms.multipleIdentical(creatures, targetXP, maxCreatures);
        break;
      case 'mixed':
        selection = encounterAlgorithms.mixedCreatures(creatures, targetXP, Math.min(4, maxCreatures));
        break;
    }

    if (selection && selection.length > 0) {
      return createEncounterResult(selection, targetXP);
    }
  }

  return null;
}
