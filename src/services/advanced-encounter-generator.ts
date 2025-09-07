/**
 * Enhanced Encounter Generation Service Layer
 * Abstracts all encounter generation logic with improved algorithms
 */

import { 
  CREATURE_SIZES, 
  ALIGNMENTS, 
  CREATURE_TYPES 
} from '@/utils/configuration-manager';

import { 
  difficultyUtils, 
  filterUtils, 
  encounterAlgorithms
} from '@/lib/encounter-algorithms';

import {
  getEncounterMultiplier
} from '@/lib/property-parsing';

export interface EncounterParameters {
  environment?: string;
  xpThreshold: number;
  maxMonsters: number;
  minCR: number;
  maxCR: number;
  alignment?: string;
  creatureType?: string;
  size?: string;
  partyLevel?: number;
  partySize?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Deadly';
  includeMultipleOfSame?: boolean;
  favorDiversity?: boolean;
  preferredCRRange?: [number, number];
}

export interface CreatureInstance {
  id: string;
  name: string;
  challenge_rating: number;
  xp_value: number;
  quantity: number;
  total_xp: number;
  creature_type?: string;
  alignment?: string;
  size?: string;
  environment?: string[];
}

export interface GeneratedEncounter {
  encounter_name: string;
  environment: string;
  difficulty: string;
  total_xp: number;
  adjusted_xp: number;
  multiplier_used: number;
  creatures: CreatureInstance[];
  generation_notes: string[];
  generation_metadata: {
    algorithm_used: string;
    attempts_made: number;
    creatures_considered: number;
    generation_time_ms: number;
    filter_summary: Record<string, any>;
  };
  tactical_notes?: string[];
  environmental_factors?: string[];
  scaling_suggestions?: {
    easier: string;
    harder: string;
  };
}

export interface CreaturePool {
  id: string;
  name: string;
  challenge_rating: number;
  xp_value: number;
  creature_type?: string;
  alignment?: string;
  size?: string;
  environment?: string[];
  armor_class?: number;
  hit_points?: number;
  speed?: string;
  damage_immunities?: string[];
  damage_resistances?: string[];
  damage_vulnerabilities?: string[];
  condition_immunities?: string[];
  special_abilities?: string[];
  legendary_actions?: boolean;
  lair_actions?: boolean;
}

export class AdvancedEncounterGenerator {
  private creatures: CreaturePool[];
  private generationLog: string[];
  private startTime: number;

  constructor(creatures: CreaturePool[]) {
    this.creatures = creatures;
    this.generationLog = [];
    this.startTime = Date.now();
  }

  private log(message: string): void {
    const timestamp = Date.now() - this.startTime;
    const logEntry = `[${timestamp}ms] ${message}`;
    console.log(`🎲 ${logEntry}`);
    this.generationLog.push(logEntry);
  }

  /**
   * Advanced creature filtering with multiple criteria
   */
  private filterCreatures(params: EncounterParameters): CreaturePool[] {
    this.log(`Filtering ${this.creatures.length} creatures with parameters: ${JSON.stringify(params)}`);

    let filtered = this.creatures.filter(creature => {
      // CR range filter
      if (creature.challenge_rating < params.minCR || creature.challenge_rating > params.maxCR) {
        return false;
      }

      // Environment filter
      if (params.environment && params.environment !== 'Any') {
        if (!creature.environment || !creature.environment.includes(params.environment)) {
          return false;
        }
      }

      // Alignment filter
      if (params.alignment && params.alignment !== 'Any') {
        if (!creature.alignment || creature.alignment !== params.alignment) {
          return false;
        }
      }

      // Creature type filter
      if (params.creatureType && params.creatureType !== 'Any') {
        if (!creature.creature_type || creature.creature_type !== params.creatureType) {
          return false;
        }
      }

      // Size filter
      if (params.size && params.size !== 'Any') {
        if (!creature.size || creature.size !== params.size) {
          return false;
        }
      }

      return true;
    });

    // Apply preferred CR range if specified
    if (params.preferredCRRange) {
      const [minPreferred, maxPreferred] = params.preferredCRRange;
      const preferred = filtered.filter(c => 
        c.challenge_rating >= minPreferred && c.challenge_rating <= maxPreferred
      );
      
      if (preferred.length > 0) {
        filtered = preferred;
        this.log(`Applied preferred CR range [${minPreferred}-${maxPreferred}], ${preferred.length} creatures remaining`);
      }
    }

    this.log(`Filtering complete: ${filtered.length} creatures available`);
    return filtered;
  }

  /**
   * Calculate encounter multiplier based on number of monsters
   */
  private getEncounterMultiplier(numMonsters: number): number {
    return getEncounterMultiplier(numMonsters);
  }

  /**
   * Generate single creature encounter
   */
  private generateSingleCreature(creatures: CreaturePool[], targetXP: number): GeneratedEncounter | null {
    this.log('Attempting single creature encounter');
    
    // Find creature closest to target XP
    let bestCreature: CreaturePool | null = null;
    let bestScore = -1;

    for (const creature of creatures) {
      const xp = creature.xp_value;
      if (xp <= 0) continue;

      // Score based on how close to target (prefer slightly under)
      let score;
      if (xp <= targetXP) {
        score = xp / targetXP; // 0 to 1 scale, higher is better
      } else {
        score = targetXP / xp * 0.8; // Penalty for going over
      }

      if (score > bestScore) {
        bestScore = score;
        bestCreature = creature;
      }
    }

    if (!bestCreature) return null;

    this.log(`Selected single creature: ${bestCreature.name} (${bestCreature.xp_value} XP)`);

    return this.createEncounterResult(
      [{ creature: bestCreature, quantity: 1 }],
      'Single Creature',
      targetXP
    );
  }

  /**
   * Generate multiple identical creatures encounter
   */
  private generateMultipleIdentical(
    creatures: CreaturePool[], 
    targetXP: number, 
    maxQuantity: number
  ): GeneratedEncounter | null {
    this.log(`Attempting multiple identical creatures (max ${maxQuantity})`);

    for (const creature of creatures) {
      const xp = creature.xp_value;
      if (xp <= 0) continue;

      for (let quantity = 2; quantity <= maxQuantity; quantity++) {
        const totalXP = xp * quantity;
        const multiplier = this.getEncounterMultiplier(quantity);
        const adjustedXP = totalXP * multiplier;

        // Check if this combination is close to target
        if (adjustedXP >= targetXP * 0.6 && adjustedXP <= targetXP * 1.4) {
          this.log(`Selected ${quantity}x ${creature.name} (${totalXP} base XP, ${adjustedXP} adjusted)`);
          
          return this.createEncounterResult(
            [{ creature, quantity }],
            'Multiple Identical',
            targetXP
          );
        }
      }
    }

    return null;
  }

  /**
   * Generate mixed creature encounter using improved algorithm
   */
  private generateMixedEncounter(
    creatures: CreaturePool[], 
    targetXP: number, 
    maxCreatures: number
  ): GeneratedEncounter | null {
    this.log(`Attempting mixed encounter (max ${maxCreatures} types)`);

    // Sort creatures by XP efficiency
    const sortedCreatures = [...creatures].sort((a, b) => (b.xp_value || 0) - (a.xp_value || 0));
    
    const selected: Array<{ creature: CreaturePool; quantity: number }> = [];
    let currentXP = 0;
    const availableCreatures = [...sortedCreatures];

    while (selected.length < maxCreatures && currentXP < targetXP * 0.9) {
      let bestCreature: CreaturePool | null = null;
      let bestScore = -1;

      for (const creature of availableCreatures) {
        const xp = creature.xp_value || 0;
        if (xp <= 0) continue;

        const newTotal = currentXP + xp;
        const remainingBudget = targetXP - newTotal;
        
        // Score based on multiple factors
        let score = 0;
        
        // Efficiency: how much of remaining budget this uses
        if (remainingBudget >= 0) {
          score += (xp / targetXP) * 100; // Prefer higher XP creatures
          score += (targetXP - remainingBudget) / targetXP * 50; // Prefer using more budget
        } else {
          score = 10; // Small score for going over budget
        }

        // Diversity bonus
        const hasType = selected.some(s => s.creature.creature_type === creature.creature_type);
        if (!hasType) {
          score += 20; // Bonus for type diversity
        }

        if (score > bestScore) {
          bestScore = score;
          bestCreature = creature;
        }
      }

      if (!bestCreature) break;

      // Add creature and remove from available
      selected.push({ creature: bestCreature, quantity: 1 });
      currentXP += bestCreature.xp_value || 0;
      
      const index = availableCreatures.indexOf(bestCreature);
      if (index > -1) {
        availableCreatures.splice(index, 1);
      }

      this.log(`Added ${bestCreature.name} (${bestCreature.xp_value} XP), total: ${currentXP} XP`);
    }

    if (selected.length === 0) return null;

    return this.createEncounterResult(selected, 'Mixed Creatures', targetXP);
  }

  /**
   * Create standardized encounter result
   */
  private createEncounterResult(
    selection: Array<{ creature: CreaturePool; quantity: number }>,
    algorithmUsed: string,
    targetXP: number
  ): GeneratedEncounter {
    const totalXP = selection.reduce((sum, s) => sum + (s.creature.xp_value * s.quantity), 0);
    const totalCreatures = selection.reduce((sum, s) => sum + s.quantity, 0);
    const multiplier = this.getEncounterMultiplier(totalCreatures);
    const adjustedXP = Math.round(totalXP * multiplier);

    // Determine difficulty
    let difficulty: string;
    if (adjustedXP <= targetXP * 0.6) difficulty = 'Easy';
    else if (adjustedXP <= targetXP) difficulty = 'Medium';
    else if (adjustedXP <= targetXP * 1.5) difficulty = 'Hard';
    else difficulty = 'Deadly';

    // Generate encounter name
    const creatureNames = selection.map(s => 
      s.quantity > 1 ? `${s.quantity} ${s.creature.name}s` : s.creature.name
    );
    const encounterName = creatureNames.join(' & ');

    // Create creature instances
    const creatures: CreatureInstance[] = selection.map(s => ({
      id: s.creature.id,
      name: s.creature.name,
      challenge_rating: s.creature.challenge_rating,
      xp_value: s.creature.xp_value,
      quantity: s.quantity,
      total_xp: s.creature.xp_value * s.quantity,
      creature_type: s.creature.creature_type,
      alignment: s.creature.alignment,
      size: s.creature.size,
      environment: s.creature.environment
    }));

    // Generate tactical notes
    const tacticalNotes = this.generateTacticalNotes(selection);
    
    // Generate scaling suggestions
    const scalingSuggestions = this.generateScalingSuggestions(selection, targetXP);

    return {
      encounter_name: encounterName,
      environment: '', // Will be set by caller
      difficulty,
      total_xp: totalXP,
      adjusted_xp: adjustedXP,
      multiplier_used: multiplier,
      creatures,
      generation_notes: [...this.generationLog],
      generation_metadata: {
        algorithm_used: algorithmUsed,
        attempts_made: 1, // Could track this in the future
        creatures_considered: this.creatures.length,
        generation_time_ms: Date.now() - this.startTime,
        filter_summary: {
          total_available: this.creatures.length,
          creatures_used: selection.length,
          total_monsters: totalCreatures
        }
      },
      tactical_notes: tacticalNotes,
      scaling_suggestions: scalingSuggestions
    };
  }

  /**
   * Generate tactical combat notes
   */
  private generateTacticalNotes(selection: Array<{ creature: CreaturePool; quantity: number }>): string[] {
    const notes: string[] = [];

    // Analyze creature types
    const types = new Set(selection.map(s => s.creature.creature_type).filter(Boolean));
    if (types.size > 1) {
      notes.push('Diverse creature types provide varied combat abilities and tactics');
    }

    // Check for legendary creatures
    const hasLegendary = selection.some(s => s.creature.legendary_actions);
    if (hasLegendary) {
      notes.push('Contains legendary creatures - expect dynamic action economy');
    }

    // Check for multiple of same creature
    const multiples = selection.filter(s => s.quantity > 1);
    if (multiples.length > 0) {
      notes.push('Multiple identical creatures can coordinate attacks effectively');
    }

    // Size variety
    const sizes = new Set(selection.map(s => s.creature.size).filter(Boolean));
    if (sizes.size > 1) {
      notes.push('Varied creature sizes create interesting battlefield positioning');
    }

    return notes;
  }

  /**
   * Generate scaling suggestions for easier/harder encounters
   */
  private generateScalingSuggestions(
    selection: Array<{ creature: CreaturePool; quantity: number }>,
    targetXP: number
  ): { easier: string; harder: string } {
    const totalCreatures = selection.reduce((sum, s) => sum + s.quantity, 0);
    
    let easier: string;
    let harder: string;

    if (selection.length === 1 && selection[0].quantity === 1) {
      // Single creature
      easier = 'Use a creature with 1-2 CR lower, or reduce hit points by 25%';
      harder = 'Add a second creature of similar CR, or increase CR by 1-2';
    } else if (selection.length === 1) {
      // Multiple identical
      easier = `Remove ${Math.max(1, Math.floor(selection[0].quantity / 2))} creature(s)`;
      harder = `Add ${Math.min(2, Math.floor(selection[0].quantity / 2))} more creature(s)`;
    } else {
      // Mixed encounter
      easier = 'Remove the highest CR creature or reduce quantities by 1';
      harder = 'Add another creature type or increase all quantities by 1';
    }

    return { easier, harder };
  }

  /**
   * Main generation method with multiple algorithms
   */
  generate(params: EncounterParameters): GeneratedEncounter | null {
    this.startTime = Date.now();
    this.generationLog = [];
    
    this.log('Starting advanced encounter generation');
    this.log(`Target XP: ${params.xpThreshold}, Max Monsters: ${params.maxMonsters}`);

    // Filter available creatures
    const availableCreatures = this.filterCreatures(params);
    
    if (availableCreatures.length === 0) {
      this.log('No creatures available after filtering');
      return null;
    }

    // Try different generation algorithms in order of preference
    const algorithms = [
      () => this.generateSingleCreature(availableCreatures, params.xpThreshold),
      () => this.generateMultipleIdentical(availableCreatures, params.xpThreshold, Math.min(4, params.maxMonsters)),
      () => this.generateMixedEncounter(availableCreatures, params.xpThreshold, Math.min(3, params.maxMonsters)),
      () => this.generateMultipleIdentical(availableCreatures, params.xpThreshold, Math.min(6, params.maxMonsters)),
      () => this.generateMixedEncounter(availableCreatures, params.xpThreshold, params.maxMonsters)
    ];

    for (const algorithm of algorithms) {
      const result = algorithm();
      if (result && result.total_xp > 0) {
        result.environment = params.environment || 'Unknown';
        this.log(`Successfully generated encounter using ${result.generation_metadata.algorithm_used}`);
        return result;
      }
    }

    this.log('All generation algorithms failed');
    return null;
  }
}

// Factory function
export function createAdvancedEncounterGenerator(creatures: CreaturePool[]): AdvancedEncounterGenerator {
  return new AdvancedEncounterGenerator(creatures);
}

// Utility functions for encounter analysis
export const encounterUtils = {
  /**
   * Analyze encounter balance
   */
  analyzeBalance: (encounter: GeneratedEncounter, partyLevel: number, partySize: number = 4): {
    isBalanced: boolean;
    warnings: string[];
    suggestions: string[];
  } => {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check CR spread
    const crs = encounter.creatures.map(c => c.challenge_rating);
    const minCR = Math.min(...crs);
    const maxCR = Math.max(...crs);
    
    if (maxCR - minCR > 3) {
      warnings.push('Large CR spread may create unbalanced combat');
    }

    // Check for save-or-die effects (would need creature ability data)
    const highCRCreatures = encounter.creatures.filter(c => c.challenge_rating > partyLevel + 2);
    if (highCRCreatures.length > 0) {
      warnings.push('Contains creatures significantly above party level');
    }

    // Action economy analysis
    const totalMonsters = encounter.creatures.reduce((sum, c) => sum + c.quantity, 0);
    if (totalMonsters > partySize * 1.5) {
      warnings.push('High monster count may overwhelm action economy');
      suggestions.push('Consider using fewer, stronger creatures');
    }

    return {
      isBalanced: warnings.length === 0,
      warnings,
      suggestions
    };
  },

  /**
   * Generate combat recommendations
   */
  generateCombatTips: (encounter: GeneratedEncounter): string[] => {
    const tips: string[] = [];

    // Initiative tips
    if (encounter.creatures.reduce((sum, c) => sum + c.quantity, 0) > 4) {
      tips.push('Consider grouping identical creatures for faster initiative');
    }

    // Terrain suggestions
    tips.push('Use terrain features to create dynamic combat positioning');

    // Pacing suggestions
    if (encounter.difficulty === 'Deadly') {
      tips.push('Consider having reinforcements arrive in waves');
    }

    return tips;
  }
};
