// Base Notion page properties that all DTOs will have
export interface NotionPageBase {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
}

// Creature/Monster DTO - only fields with direct database mappings
export interface CreatureDTO extends NotionPageBase {
  name: string;
  size: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
  type: string; // Beast, Humanoid, Dragon, etc.
  subtype?: string;
  alignment: string;
  armor_class: number;
  hit_points: number;
  speed: {
    walk?: number;
  };
  challenge_rating: number;
  xp_value: number;
  environment: string[];
  languages?: string[];
  source: string;
}

// Environment DTO - only fields with direct database mappings
export interface EnvironmentDTO extends NotionPageBase {
  name: string;
  description: string;
  terrain_type: string[];
  climate: string;
  hazards?: string[];
  common_creatures: string[];
  survival_dc?: number;
  foraging_dc?: number;
  navigation_dc?: number;
}

// Generated Encounter DTO - based on actual encounter generation output
export interface EncounterDTO extends NotionPageBase {
  encounter_name: string;
  environment: string;
  total_xp: number;
  creatures: {
    name: string;
    quantity: number;
    challenge_rating: number;
    xp_value: number;
    total_xp: number;
  }[];
  generation_notes: string;
}

// Union type for DTOs with actual database mappings
export type NotionDTO = CreatureDTO | EnvironmentDTO | EncounterDTO;

// Helper types for common D&D concepts
export type DamageType = 
  | 'Acid' | 'Bludgeoning' | 'Cold' | 'Fire' | 'Force' 
  | 'Lightning' | 'Necrotic' | 'Piercing' | 'Poison' 
  | 'Psychic' | 'Radiant' | 'Slashing' | 'Thunder';

export type AbilityScore = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

export type CreatureSize = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';

export type ChallengeRating = 
  | 0 | 0.125 | 0.25 | 0.5 
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 
  | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30;