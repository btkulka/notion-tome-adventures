/**
 * Comprehensive encounter generation system
 * Handles creature selection, balancing, and encounter creation
 */

import { XP_BY_CR } from './notion-utils.ts';

// Helper to calculate XP from CR
function calculateXPFromCR(cr: number | string): number {
  const crString = cr.toString();
  return XP_BY_CR[crString] || 0;
}

export interface EncounterParams {
  environment?: string;
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
  image_url?: string;
  creature_type?: string;
  size?: string;
  alignment?: string;
}

export interface GeneratedEncounter {
  environment: string;
  total_xp: number;
  creatures: CreatureInstance[];
  generation_notes: string;
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

  // Helper function to roll 1d4
  private rollD4(): number {
    return Math.floor(Math.random() * 4) + 1;
  }

  // Helper function to select random monster from candidates
  private selectRandomMonster(candidates: any[]): any {
    if (candidates.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
  }

  // Filter creatures by remaining XP budget
  private filterByXPBudget(creatures: any[], remainingXP: number): any[] {
    return creatures.filter(creature => (creature.xp_value || 0) <= remainingXP);
  }

  // Main generation method following the specified algorithm
  generate(params: EncounterParams): GeneratedEncounter | null {
    this.generationLog = [];
    this.log('Starting encounter generation with dice-based algorithm');
    this.log(`Parameters: ${JSON.stringify(params)}`);

    // Step 1: Filter by environment (if not "Any", all monsters on table)
    let availableCreatures = this.creatures;
    if (params.environment && params.environment !== 'Any') {
      this.log(`Filtering by environment: "${params.environment}"`);
      
      // Debug: Show sample creatures and their environments before filtering
      const sampleBefore = this.creatures.slice(0, 5);
      this.log(`Sample creatures before environment filter: ${sampleBefore.map(c => 
        `${c.name} (Envs: ${Array.isArray(c.environment) ? c.environment.join(', ') : c.environment || 'none'})`
      ).join(' | ')}`);
      
      // Check if environments are relations (placeholder values) and skip filtering if so
      const hasRelationEnvironments = this.creatures.some(c => 
        Array.isArray(c.environment) && c.environment.includes('Unknown')
      );
      
      if (hasRelationEnvironments) {
        this.log(`⚠️ Detected relation-based environments, skipping environment filter temporarily`);
        this.log(`All ${this.creatures.length} creatures available (relation resolution not yet implemented)`);
      } else {
        availableCreatures = this.creatures.filter(creature => 
          creature.environment && Array.isArray(creature.environment) && creature.environment.includes(params.environment)
        );
        this.log(`Environment filter (${params.environment}): ${availableCreatures.length} creatures`);
        
        // Debug: Show what creatures passed the environment filter
        if (availableCreatures.length > 0) {
          const sampleAfter = availableCreatures.slice(0, 3);
          this.log(`Sample creatures after environment filter: ${sampleAfter.map(c => 
            `${c.name} (Envs: ${c.environment.join(', ')})`
          ).join(' | ')}`);
        } else {
          this.log(`⚠️ No creatures found for environment "${params.environment}"`);
          // Show all unique environments available
          const allEnvironments = new Set();
          this.creatures.forEach(creature => {
            if (creature.environment && Array.isArray(creature.environment)) {
              creature.environment.forEach(env => allEnvironments.add(env));
            }
          });
          this.log(`Available environments in database: ${Array.from(allEnvironments).join(', ')}`);
        }
      }
    } else {
      this.log(`Environment "Any": ${availableCreatures.length} creatures available`);
    }

    // Step 2: Filter monsters above XP threshold immediately
    availableCreatures = availableCreatures.filter(creature => 
      (creature.xp_value || 0) <= params.xpThreshold
    );
    this.log(`XP threshold filter (≤${params.xpThreshold}): ${availableCreatures.length} creatures`);

    // Step 3: Apply additional filters (CR range, creature type, size)
    availableCreatures = availableCreatures.filter(creature => {
      const cr = parseFloat(creature.challenge_rating.toString());
      if (cr < params.minCR || cr > params.maxCR) return false;
      
      if (params.creatureType && params.creatureType !== 'Any') {
        if (!creature.creature_type || creature.creature_type !== params.creatureType) return false;
      }
      
      if (params.size && params.size !== 'Any') {
        if (!creature.size || creature.size !== params.size) return false;
      }
      
      return true;
    });
    this.log(`After all filters: ${availableCreatures.length} creatures available`);

    // Step 4: Check if we have monsters to pull from
    if (availableCreatures.length === 0) {
      throw new Error('No monsters available after filtering. Please adjust your criteria.');
    }

    // Step 5: Create encounter record
    const encounter: GeneratedEncounter = {
      environment: params.environment || 'Unknown',
      total_xp: 0,
      creatures: [],
      generation_notes: ''
    };

    let remainingXPBudget = params.xpThreshold;
    let totalMonstersAdded = 0;
    let encounterAlignment: string | null = null;
    let currentCandidates = [...availableCreatures];

    // Step 6-12: Generation loop
    while (totalMonstersAdded < params.maxMonsters && remainingXPBudget > 0) {
      this.log(`\n--- Generation Round ${totalMonstersAdded + 1} ---`);
      this.log(`Remaining XP budget: ${remainingXPBudget}`);
      this.log(`Available candidates: ${currentCandidates.length}`);

      // Filter candidates by remaining XP budget
      const affordableCandidates = this.filterByXPBudget(currentCandidates, remainingXPBudget);
      if (affordableCandidates.length === 0) {
        this.log('No affordable monsters remaining, ending generation');
        break;
      }

      // Step 6: Roll 1d4 to determine quantity
      const diceRoll = this.rollD4();
      this.log(`Rolled 1d${4}: ${diceRoll}`);

      // Select a monster at random
      const selectedMonster = this.selectRandomMonster(affordableCandidates);
      if (!selectedMonster) {
        this.log('No monster selected, ending generation');
        break;
      }

      this.log(`Selected monster: ${selectedMonster.name} (${selectedMonster.xp_value} XP each)`);

      // Step 8: Set alignment from first monster (alignment inheritance)
      if (encounterAlignment === null && selectedMonster.alignment) {
        encounterAlignment = selectedMonster.alignment;
        this.log(`Setting encounter alignment to: ${encounterAlignment}`);
        
        // Filter future candidates by this alignment if alignment filter not already set
        if (!params.alignment || params.alignment === 'Any') {
          currentCandidates = currentCandidates.filter(creature => 
            !creature.alignment || creature.alignment === encounterAlignment
          );
          this.log(`Filtered candidates by alignment: ${currentCandidates.length} remaining`);
        }
      }

      // Step 7 & 10: Determine how many of this monster we can afford
      const monsterXP = selectedMonster.xp_value || 0;
      const maxAffordable = Math.floor(remainingXPBudget / monsterXP);
      const quantityToAdd = Math.min(diceRoll, maxAffordable, params.maxMonsters - totalMonstersAdded);

      if (quantityToAdd <= 0) {
        this.log('Cannot afford any of this monster, trying different selection');
        // Remove this monster from candidates and try again
        currentCandidates = currentCandidates.filter(c => c.id !== selectedMonster.id);
        continue;
      }

      // Step 9: Add monster instances to encounter
      let existingCreature = encounter.creatures.find(c => c.id === selectedMonster.id);
      if (existingCreature) {
        existingCreature.quantity += quantityToAdd;
        existingCreature.total_xp += monsterXP * quantityToAdd;
      } else {
        encounter.creatures.push({
          id: selectedMonster.id,
          name: selectedMonster.name,
          challenge_rating: selectedMonster.challenge_rating,
          xp_value: monsterXP,
          quantity: quantityToAdd,
          total_xp: monsterXP * quantityToAdd,
          image_url: selectedMonster.image_url,
          creature_type: selectedMonster.creature_type,
          size: selectedMonster.size,
          alignment: selectedMonster.alignment
        });
      }

      const addedXP = monsterXP * quantityToAdd;
      encounter.total_xp += addedXP;
      remainingXPBudget -= addedXP;
      totalMonstersAdded += quantityToAdd;

      this.log(`Added ${quantityToAdd}x ${selectedMonster.name} for ${addedXP} XP`);
      this.log(`Total encounter XP: ${encounter.total_xp}, Monsters: ${totalMonstersAdded}/${params.maxMonsters}`);

      // Step 11: Check if we've reached limits
      if (totalMonstersAdded >= params.maxMonsters) {
        this.log('Reached maximum monster limit');
        break;
      }

      if (remainingXPBudget <= 0) {
        this.log('XP budget exhausted');
        break;
      }
    }

    // Calculate final encounter statistics
    const totalCreatureCount = encounter.creatures.reduce((sum, c) => sum + c.quantity, 0);

    encounter.generation_notes = this.generationLog.join('\n');
    
    this.log(`\n=== FINAL ENCOUNTER ===`);
    this.log(`Total XP: ${encounter.total_xp}`);
    this.log(`Creatures: ${totalCreatureCount}`);
    
    // TODO: Stub for future loot generation
    this.log('\n--- Loot Generation (TODO) ---');
    this.log('Loot generation will be implemented in future iteration');

    return encounter;
  }
}

// Factory function for creating encounter generators
export function createEncounterGenerator(creatures: any[]): EncounterGenerator {
  return new EncounterGenerator(creatures);
}
