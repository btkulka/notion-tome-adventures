/**
 * Fallback encounter generator for when Supabase edge functions are unavailable
 * This uses the local advanced encounter generator with mock data
 */

import { createAdvancedEncounterGenerator, CreaturePool } from '@/services/advanced-encounter-generator';
import { NotionEncounterParams, GeneratedEncounter } from '@/types/encounter';

// Mock creature data for fallback
const MOCK_CREATURES: CreaturePool[] = [
  {
    id: '1',
    name: 'Goblin',
    challenge_rating: 0.25,
    xp_value: 50,
    creature_type: 'Humanoid',
    alignment: 'Neutral Evil',
    size: 'Small',
    environment: ['Forest', 'Hills', 'Swamp'],
    armor_class: 15,
    hit_points: 7,
    speed: '30 ft.',
    damage_immunities: [],
    damage_resistances: [],
    damage_vulnerabilities: [],
    condition_immunities: [],
    special_abilities: ['Nimble Escape'],
    legendary_actions: false,
    lair_actions: false
  },
  {
    id: '2',
    name: 'Orc',
    challenge_rating: 0.5,
    xp_value: 100,
    creature_type: 'Humanoid',
    alignment: 'Chaotic Evil',
    size: 'Medium',
    environment: ['Forest', 'Hills', 'Mountain'],
    armor_class: 13,
    hit_points: 15,
    speed: '30 ft.',
    damage_immunities: [],
    damage_resistances: [],
    damage_vulnerabilities: [],
    condition_immunities: [],
    special_abilities: ['Aggressive'],
    legendary_actions: false,
    lair_actions: false
  },
  {
    id: '3',
    name: 'Wolf',
    challenge_rating: 0.25,
    xp_value: 50,
    creature_type: 'Beast',
    alignment: 'Unaligned',
    size: 'Medium',
    environment: ['Forest', 'Grassland', 'Hills'],
    armor_class: 13,
    hit_points: 11,
    speed: '40 ft.',
    damage_immunities: [],
    damage_resistances: [],
    damage_vulnerabilities: [],
    condition_immunities: [],
    special_abilities: ['Keen Hearing and Smell', 'Pack Tactics'],
    legendary_actions: false,
    lair_actions: false
  },
  {
    id: '4',
    name: 'Brown Bear',
    challenge_rating: 1,
    xp_value: 200,
    creature_type: 'Beast',
    alignment: 'Unaligned',
    size: 'Large',
    environment: ['Forest', 'Hills'],
    armor_class: 11,
    hit_points: 34,
    speed: '40 ft., climb 30 ft.',
    damage_immunities: [],
    damage_resistances: [],
    damage_vulnerabilities: [],
    condition_immunities: [],
    special_abilities: ['Keen Smell'],
    legendary_actions: false,
    lair_actions: false
  },
  {
    id: '5',
    name: 'Owlbear',
    challenge_rating: 3,
    xp_value: 700,
    creature_type: 'Monstrosity',
    alignment: 'Unaligned',
    size: 'Large',
    environment: ['Forest'],
    armor_class: 13,
    hit_points: 59,
    speed: '40 ft.',
    damage_immunities: [],
    damage_resistances: [],
    damage_vulnerabilities: [],
    condition_immunities: [],
    special_abilities: ['Keen Sight and Smell'],
    legendary_actions: false,
    lair_actions: false
  },
  {
    id: '6',
    name: 'Troll',
    challenge_rating: 5,
    xp_value: 1800,
    creature_type: 'Giant',
    alignment: 'Chaotic Evil',
    size: 'Large',
    environment: ['Forest', 'Hills', 'Mountain', 'Swamp'],
    armor_class: 15,
    hit_points: 84,
    speed: '30 ft.',
    damage_immunities: [],
    damage_resistances: [],
    damage_vulnerabilities: ['acid', 'fire'],
    condition_immunities: [],
    special_abilities: ['Keen Smell', 'Regeneration'],
    legendary_actions: false,
    lair_actions: false
  },
  {
    id: '7',
    name: 'Hill Giant',
    challenge_rating: 5,
    xp_value: 1800,
    creature_type: 'Giant',
    alignment: 'Chaotic Evil',
    size: 'Huge',
    environment: ['Hills', 'Mountain'],
    armor_class: 13,
    hit_points: 105,
    speed: '40 ft.',
    damage_immunities: [],
    damage_resistances: [],
    damage_vulnerabilities: [],
    condition_immunities: [],
    special_abilities: [],
    legendary_actions: false,
    lair_actions: false
  },
  {
    id: '8',
    name: 'Dragon Wyrmling',
    challenge_rating: 2,
    xp_value: 450,
    creature_type: 'Dragon',
    alignment: 'Chaotic Evil',
    size: 'Medium',
    environment: ['Mountain', 'Desert'],
    armor_class: 17,
    hit_points: 38,
    speed: '30 ft., burrow 15 ft., fly 60 ft.',
    damage_immunities: ['fire'],
    damage_resistances: [],
    damage_vulnerabilities: [],
    condition_immunities: [],
    special_abilities: ['Blindsight', 'Darkvision'],
    legendary_actions: false,
    lair_actions: false
  },
  {
    id: '9',
    name: 'Skeleton',
    challenge_rating: 0.25,
    xp_value: 50,
    creature_type: 'Undead',
    alignment: 'Lawful Evil',
    size: 'Medium',
    environment: ['Underdark', 'Urban'],
    armor_class: 13,
    hit_points: 13,
    speed: '30 ft.',
    damage_immunities: ['poison'],
    damage_resistances: [],
    damage_vulnerabilities: ['bludgeoning'],
    condition_immunities: ['exhaustion', 'poisoned'],
    special_abilities: [],
    legendary_actions: false,
    lair_actions: false
  },
  {
    id: '10',
    name: 'Zombie',
    challenge_rating: 0.25,
    xp_value: 50,
    creature_type: 'Undead',
    alignment: 'Neutral Evil',
    size: 'Medium',
    environment: ['Underdark', 'Urban'],
    armor_class: 8,
    hit_points: 22,
    speed: '20 ft.',
    damage_immunities: ['poison'],
    damage_resistances: [],
    damage_vulnerabilities: [],
    condition_immunities: ['poisoned'],
    special_abilities: ['Undead Fortitude'],
    legendary_actions: false,
    lair_actions: false
  }
];

export function generateFallbackEncounter(params: NotionEncounterParams): GeneratedEncounter {
  console.log('🎲 Using fallback encounter generator with mock data');
  
  const generator = createAdvancedEncounterGenerator(MOCK_CREATURES);
  
  const encounterParams = {
    environment: params.environment || 'Any',
    xpThreshold: params.xpThreshold,
    maxMonsters: params.maxMonsters,
    minCR: parseFloat(params.minCR || '0'),
    maxCR: parseFloat(params.maxCR || '20'),
    alignment: params.alignment,
    creatureType: params.creatureType,
    size: params.size,
    partyLevel: 4, // Default party level
    partySize: 4,  // Default party size
    difficulty: 'Medium' as const,
    includeMultipleOfSame: true,
    favorDiversity: true
  };

  const result = generator.generate(encounterParams);
  
  if (!result) {
    // Create a basic encounter if generation fails
    const basicCreature = MOCK_CREATURES.find(c => 
      c.xp_value <= params.xpThreshold && 
      (!params.environment || params.environment === 'Any' || c.environment?.includes(params.environment))
    ) || MOCK_CREATURES[0];

    return {
      encounter_name: basicCreature.name,
      environment: params.environment || 'Forest',
      difficulty: 'Medium',
      total_xp: basicCreature.xp_value,
      adjusted_xp: basicCreature.xp_value,
      creatures: [{
        id: basicCreature.id,
        name: basicCreature.name,
        quantity: 1,
        challenge_rating: basicCreature.challenge_rating.toString(),
        xp_value: basicCreature.xp_value,
        total_xp: basicCreature.xp_value
      }],
      generation_notes: 'Used fallback encounter generator with limited creature database. This is a basic encounter generated with mock data. For full functionality, configure your Notion integration.'
    };
  }

  // Convert to the expected format
  return {
    encounter_name: result.encounter_name,
    environment: result.environment,
    difficulty: result.difficulty,
    total_xp: result.total_xp,
    adjusted_xp: result.adjusted_xp,
    creatures: result.creatures.map(creature => ({
      id: creature.id,
      name: creature.name,
      quantity: creature.quantity,
      challenge_rating: creature.challenge_rating.toString(),
      xp_value: creature.xp_value,
      total_xp: creature.xp_value * creature.quantity
    })),
    generation_notes: result.generation_notes.join('\n') + '\n\nGenerated using fallback mock creature database. Configure Notion for full functionality.'
  };
}
