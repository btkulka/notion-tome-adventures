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
    
    // Debug: Log total creatures before any filtering
    this.log(`Starting with ${this.creatures.length} total creatures in database`);
    
    if (params.environment && params.environment.trim() !== '' && params.environment.trim() !== 'Any') {
      this.log(`Filtering by environment: "${params.environment}"`);
      
      // Debug: Show sample creatures and their environments before filtering
      const sampleBefore = this.creatures.slice(0, 5);
      this.log(`Sample creatures before environment filter: ${sampleBefore.map(c => 
        `${c.name} (Envs: ${Array.isArray(c.environment) ? c.environment.join(', ') : c.environment || 'none'})`
      ).join(' | ')}`);
      
      // Apply environment filtering with case-insensitive comparison
      const targetEnvironment = params.environment.trim(); // Remove any extra whitespace
      this.log(`Filtering for exact environment match: "${targetEnvironment}" (case-insensitive)`);
      
      availableCreatures = this.creatures.filter(creature => {
        if (!creature.environment) {
          // Log creatures with no environment data
          console.log(`Creature "${creature.name}" has no environment data`);
          return false;
        }
        
        if (Array.isArray(creature.environment)) {
          // Check if any environment in the array matches (case-insensitive)
          const matches = creature.environment.some(env => {
            const creatureEnv = (env || '').toString().trim();
            const paramEnv = targetEnvironment.toString().trim();
            const isMatch = creatureEnv.toLowerCase() === paramEnv.toLowerCase();
            
            if (isMatch) {
              console.log(`✅ Environment match: creature "${creature.name}" env "${creatureEnv}" matches filter "${paramEnv}"`);
            }
            
            return isMatch;
          });
          
          // Debug log for creatures that don't match
          if (!matches) {
            console.log(`❌ No match for creature "${creature.name}" with environments [${creature.environment.join(', ')}] vs filter "${targetEnvironment}"`);
          }
          
          return matches;
        } else {
          // Single environment value
          const creatureEnv = (creature.environment || '').toString().trim();
          const paramEnv = targetEnvironment.toString().trim();
          const matches = creatureEnv.toLowerCase() === paramEnv.toLowerCase();
          
          if (matches) {
            console.log(`✅ Environment match: creature "${creature.name}" env "${creatureEnv}" matches filter "${paramEnv}"`);
          } else {
            console.log(`❌ No match for creature "${creature.name}" with environment "${creatureEnv}" vs filter "${paramEnv}"`);
          }
          
          return matches;
        }
      });
      
      this.log(`Environment filter (${params.environment}): ${availableCreatures.length} creatures`);
      
      // Debug: Show what creatures passed the environment filter
      if (availableCreatures.length > 0) {
        const sampleAfter = availableCreatures.slice(0, 3);
        this.log(`Sample creatures after environment filter: ${sampleAfter.map(c => 
          `${c.name} (Envs: ${Array.isArray(c.environment) ? c.environment.join(', ') : c.environment})`
        ).join(' | ')}`);
      } else {
        this.log(`⚠️ No creatures found for environment "${params.environment}"`);
        // Show all unique environments available
        const allEnvironments = new Set();
        this.creatures.forEach(creature => {
          if (creature.environment) {
            if (Array.isArray(creature.environment)) {
              creature.environment.forEach(env => {
                if (env && env !== 'Unknown' && env.trim() !== '') allEnvironments.add(env.trim());
              });
            } else if (creature.environment !== 'Unknown' && creature.environment.trim() !== '') {
              allEnvironments.add(creature.environment.trim());
            }
          }
        });
        this.log(`Available environments in database: ${Array.from(allEnvironments).join(', ')}`);
        
        // Show case-insensitive partial matches
        const partialMatches = Array.from(allEnvironments).filter((env: unknown) => {
          const envStr = String(env).toLowerCase();
          const paramStr = (params.environment || '').toLowerCase();
          return envStr.includes(paramStr) || paramStr.includes(envStr);
        });
        if (partialMatches.length > 0) {
          this.log(`Potential partial matches: ${partialMatches.join(', ')}`);
        }
        
        // Provide specific error message with available options
        const availableList = Array.from(allEnvironments).sort().join(', ');
        throw new Error(`No creatures found for environment "${params.environment}". Available environments: ${availableList}`);
      }
    } else {
      this.log(`Environment filter disabled (value: "${params.environment || 'undefined'}"): ${availableCreatures.length} creatures available`);
    }

    // Step 2: Filter monsters above XP threshold immediately
    availableCreatures = availableCreatures.filter(creature => 
      (creature.xp_value || 0) <= params.xpThreshold
    );
    this.log(`XP threshold filter (≤${params.xpThreshold}): ${availableCreatures.length} creatures`);

    // Step 3: Apply additional filters (CR range, creature type, size, alignment)
    availableCreatures = availableCreatures.filter(creature => {
      const cr = parseFloat(creature.challenge_rating.toString());
      if (cr < params.minCR || cr > params.maxCR) return false;
      
      // Debug logging for filtering
      const debugInfo = {
        name: creature.name,
        creatureType: creature.creature_type,
        size: creature.size,
        alignment: creature.alignment,
        paramCreatureType: params.creatureType,
        paramSize: params.size,
        paramAlignment: params.alignment
      };
      
      if (params.creatureType && params.creatureType !== 'Any') {
        const creatureType = (creature.creature_type || '').toString().trim();
        const paramType = params.creatureType.toString().trim();
        if (!creatureType || creatureType.toLowerCase() !== paramType.toLowerCase()) {
          console.log(`Filtered out ${creature.name} by creature type: "${creatureType}" !== "${paramType}"`);
          return false;
        }
      }
      
      if (params.size && params.size !== 'Any') {
        const creatureSize = (creature.size || '').toString().trim();
        const paramSize = params.size.toString().trim();
        if (!creatureSize || creatureSize.toLowerCase() !== paramSize.toLowerCase()) {
          console.log(`Filtered out ${creature.name} by size: "${creatureSize}" !== "${paramSize}"`);
          return false;
        }
      }
      
      if (params.alignment && params.alignment !== 'Any') {
        const creatureAlignment = (creature.alignment || '').toString().trim();
        const paramAlignment = params.alignment.toString().trim();
        if (!creatureAlignment || creatureAlignment.toLowerCase() !== paramAlignment.toLowerCase()) {
          console.log(`Filtered out ${creature.name} by alignment: "${creatureAlignment}" !== "${paramAlignment}"`);
          return false;
        }
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
    let encounterCreatureType: string | null = null;
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

      // Creature type inheritance: Set creature type from first monster
      if (encounterCreatureType === null && selectedMonster.creature_type) {
        encounterCreatureType = selectedMonster.creature_type;
        this.log(`Setting encounter creature type to: ${encounterCreatureType}`);
        
        // Filter future candidates by this creature type if creature type filter not already set
        if (!params.creatureType || params.creatureType === 'Any') {
          currentCandidates = currentCandidates.filter(creature => 
            !creature.creature_type || creature.creature_type === encounterCreatureType
          );
          this.log(`Filtered candidates by creature type: ${currentCandidates.length} remaining`);
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
