/**
 * Comprehensive encounter generation system
 * Handles creature selection, balancing, and encounter creation
 */

import { XP_BY_CR, ENCOUNTER_MULTIPLIERS } from './notion-utils.ts';

// Helper to calculate XP from CR
function calculateXPFromCR(cr: number | string): number {
  const crString = cr.toString();
  return XP_BY_CR[crString] || 0;
}

// Calculate encounter multiplier based on number of monsters
function getEncounterMultiplier(numMonsters: number): number {
  if (numMonsters <= 1) return 1;
  if (numMonsters === 2) return 1.5;
  if (numMonsters >= 3 && numMonsters <= 6) return 2;
  if (numMonsters >= 7 && numMonsters <= 10) return 2.5;
  if (numMonsters >= 11 && numMonsters <= 14) return 3;
  if (numMonsters >= 15) return 4;
  return 1;
}

export interface EncounterParams {
  environment?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Deadly';
  xpThreshold: number;
  maxMonsters: number;
  minCR: number;
  maxCR: number;
  alignment?: string;
  creatureType?: string;
  size?: string;
}

export interface CreatureInstance {
  id: string;
  name: string;
  challenge_rating: number;
  xp_value: number;
  quantity: number;
  total_xp: number;
}

export interface GeneratedEncounter {
  environment: string;
  difficulty: string;
  total_xp: number;
  adjusted_xp: number;
  creatures: CreatureInstance[];
  generation_notes: string;
  multiplier_used: number;
}

export class EncounterGenerator {
  private creatures: any[];
  private generationLog: string[];

  constructor(creatures: any[]) {
    this.creatures = creatures;
    this.generationLog = [];
  }

  private log(message: string) {
    console.log(`🎲 ${message}`);
    this.generationLog.push(message);
  }

  // Filter creatures based on parameters
  private filterCreatures(params: EncounterParams): any[] {
    this.log(`Filtering ${this.creatures.length} available creatures`);
    
    let filtered = this.creatures.filter(creature => {
      // CR range filter
      const cr = parseFloat(creature.challenge_rating.toString());
      if (cr < params.minCR || cr > params.maxCR) {
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
        if (!creature.type || creature.type !== params.creatureType) {
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

    this.log(`After filtering: ${filtered.length} creatures remain`);
    
    if (filtered.length === 0) {
      this.log('No creatures match the specified criteria, using fallback selection');
      // Fallback: use creatures within CR range only
      filtered = this.creatures.filter(creature => {
        const cr = parseFloat(creature.challenge_rating.toString());
        return cr >= params.minCR && cr <= params.maxCR;
      });
      this.log(`Fallback selection: ${filtered.length} creatures`);
    }

    return filtered;
  }

  // Calculate encounter multiplier based on number of monsters
  private getEncounterMultiplier(numMonsters: number): number {
    if (numMonsters <= 0) return 1;
    if (numMonsters === 1) return 1;
    if (numMonsters === 2) return 1.5;
    if (numMonsters >= 3 && numMonsters <= 6) return 2;
    if (numMonsters >= 7 && numMonsters <= 10) return 2.5;
    if (numMonsters >= 11 && numMonsters <= 14) return 3;
    if (numMonsters >= 15) return 4;
    return 1;
  }

  // Try to build an encounter with the given parameters
  private buildEncounter(availableCreatures: any[], params: EncounterParams): GeneratedEncounter | null {
    const targetXP = params.xpThreshold;
    const maxCreatures = Math.min(params.maxMonsters, 6); // Cap at 6 for complexity
    
    this.log(`Building encounter for ${targetXP} XP with max ${maxCreatures} creatures`);

    // Sort creatures by XP value for better selection
    const sortedCreatures = [...availableCreatures].sort((a, b) => (a.xp_value || 0) - (b.xp_value || 0));
    
    // Try different combinations
    const attempts = [
      () => this.trySimpleEncounter(sortedCreatures, targetXP),
      () => this.tryMultipleCreatures(sortedCreatures, targetXP, 2),
      () => this.tryMultipleCreatures(sortedCreatures, targetXP, 3),
      () => this.tryMultipleCreatures(sortedCreatures, targetXP, 4),
      () => this.tryMixedEncounter(sortedCreatures, targetXP, maxCreatures)
    ];

    for (const attempt of attempts) {
      const result = attempt();
      if (result && result.total_xp > 0) {
        const multiplier = this.getEncounterMultiplier(result.creatures.reduce((sum, c) => sum + c.quantity, 0));
        result.adjusted_xp = Math.round(result.total_xp * multiplier);
        result.multiplier_used = multiplier;
        
        // Determine difficulty
        const adjustedXP = result.adjusted_xp;
        if (adjustedXP <= targetXP * 0.5) {
          result.difficulty = 'Easy';
        } else if (adjustedXP <= targetXP) {
          result.difficulty = 'Medium';
        } else if (adjustedXP <= targetXP * 1.5) {
          result.difficulty = 'Hard';
        } else {
          result.difficulty = 'Deadly';
        }

        this.log(`Successfully built ${result.difficulty} encounter: ${result.total_xp} base XP (${result.adjusted_xp} adjusted)`);
        return result;
      }
    }

    return null;
  }

  // Try single creature encounter
  private trySimpleEncounter(creatures: any[], targetXP: number): GeneratedEncounter | null {
    this.log('Attempting single creature encounter');
    
    // Find creature closest to target XP
    let bestCreature: any = null;
    let bestDifference = Infinity;

    for (const creature of creatures) {
      const xp = creature.xp_value || 0;
      if (xp > 0) {
        const difference = Math.abs(targetXP - xp);
        if (difference < bestDifference) {
          bestDifference = difference;
          bestCreature = creature;
        }
      }
    }

    if (!bestCreature) return null;

    this.log(`Selected single creature: ${bestCreature.name} (${bestCreature.xp_value} XP)`);

    return {
      environment: '',
      difficulty: 'Medium',
      total_xp: bestCreature.xp_value,
      adjusted_xp: bestCreature.xp_value,
      multiplier_used: 1,
      creatures: [{
        id: bestCreature.id,
        name: bestCreature.name,
        challenge_rating: bestCreature.challenge_rating,
        xp_value: bestCreature.xp_value,
        quantity: 1,
        total_xp: bestCreature.xp_value
      }],
      generation_notes: this.generationLog.join('\n')
    };
  }

  // Try multiple instances of same creature
  private tryMultipleCreatures(creatures: any[], targetXP: number, maxQuantity: number): GeneratedEncounter | null {
    this.log(`Attempting ${maxQuantity} identical creatures encounter`);

    for (const creature of creatures) {
      const xp = creature.xp_value || 0;
      if (xp <= 0) continue;

      for (let quantity = 2; quantity <= maxQuantity; quantity++) {
        const totalXP = xp * quantity;
        const multiplier = this.getEncounterMultiplier(quantity);
        const adjustedXP = totalXP * multiplier;

        if (adjustedXP >= targetXP * 0.5 && adjustedXP <= targetXP * 2) {
          this.log(`Selected ${quantity}x ${creature.name} (${totalXP} total XP)`);
          
          return {
            environment: '',
            difficulty: 'Medium',
            total_xp: totalXP,
            adjusted_xp: Math.round(adjustedXP),
            multiplier_used: multiplier,
            creatures: [{
              id: creature.id,
              name: creature.name,
              challenge_rating: creature.challenge_rating,
              xp_value: xp,
              quantity: quantity,
              total_xp: totalXP
            }],
            generation_notes: this.generationLog.join('\n')
          };
        }
      }
    }

    return null;
  }

  // Try mixed creature encounter
  private tryMixedEncounter(creatures: any[], targetXP: number, maxCreatures: number): GeneratedEncounter | null {
    this.log(`Attempting mixed encounter with max ${maxCreatures} creature types`);

    // Simple greedy algorithm: add creatures until we approach target
    const selected: { creature: any; quantity: number }[] = [];
    let currentXP = 0;
    const availableCreatures = [...creatures];

    while (selected.length < maxCreatures && currentXP < targetXP) {
      // Find creature that gets us closest to target without going too far over
      let bestCreature: any = null;
      let bestScore = -1;

      for (const creature of availableCreatures) {
        const xp = creature.xp_value || 0;
        if (xp <= 0) continue;

        const newTotal = currentXP + xp;
        const remainingXP = targetXP - newTotal;
        
        // Score based on how close we get to target (prefer not going over)
        let score;
        if (remainingXP >= 0) {
          score = 1000 - remainingXP; // Closer to target is better
        } else {
          score = 500 + remainingXP; // Penalty for going over, but still possible
        }

        if (score > bestScore) {
          bestScore = score;
          bestCreature = creature;
        }
      }

      if (!bestCreature) break;

      // Add this creature
      selected.push({ creature: bestCreature, quantity: 1 });
      currentXP += bestCreature.xp_value || 0;
      
      // Remove from available to avoid duplicates
      const index = availableCreatures.indexOf(bestCreature);
      if (index > -1) {
        availableCreatures.splice(index, 1);
      }

      this.log(`Added ${bestCreature.name} (${bestCreature.xp_value} XP), total: ${currentXP} XP`);
    }

    if (selected.length === 0) return null;

    const totalCreatures = selected.reduce((sum, s) => sum + s.quantity, 0);
    const multiplier = this.getEncounterMultiplier(totalCreatures);

    return {
      environment: '',
      difficulty: 'Medium',
      total_xp: currentXP,
      adjusted_xp: Math.round(currentXP * multiplier),
      multiplier_used: multiplier,
      creatures: selected.map(s => ({
        id: s.creature.id,
        name: s.creature.name,
        challenge_rating: s.creature.challenge_rating,
        xp_value: s.creature.xp_value || 0,
        quantity: s.quantity,
        total_xp: (s.creature.xp_value || 0) * s.quantity
      })),
      generation_notes: this.generationLog.join('\n')
    };
  }

  // Main generation method
  generate(params: EncounterParams): GeneratedEncounter | null {
    this.generationLog = [];
    this.log('Starting encounter generation');
    this.log(`Parameters: ${JSON.stringify(params)}`);

    // Filter creatures based on criteria
    const availableCreatures = this.filterCreatures(params);
    
    if (availableCreatures.length === 0) {
      this.log('No creatures available for encounter generation');
      return null;
    }

    // Build the encounter
    const encounter = this.buildEncounter(availableCreatures, params);
    
    if (encounter) {
      encounter.environment = params.environment || 'Unknown';
      encounter.generation_notes = this.generationLog.join('\n');
    }

    return encounter;
  }
}

// Factory function for creating encounter generators
export function createEncounterGenerator(creatures: any[]): EncounterGenerator {
  return new EncounterGenerator(creatures);
}
