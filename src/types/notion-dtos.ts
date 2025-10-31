/**
 * Notion DTO Type Definitions
 * These match the actual data returned by edge functions
 */

// =============================================================================
// BASE TYPES
// =============================================================================

export interface NotionPageBase {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
}

// =============================================================================
// ENTITY DTOs
// =============================================================================

/**
 * Creature/Monster DTO
 * Maps from Notion properties:
 * - name: 'Name' | 'Creature' | 'Monster'
 * - cr: 'CR' | 'Challenge Rating' | 'ChallengeRating'
 * - size: 'Size' | 'CreatureSize'
 * - type: 'Type' | 'Species' | 'Creature Type'
 * - alignment: 'Alignment'
 * - ac: 'AC' | 'ArmorClass' | 'Armor Class'
 * - hp: 'HP' | 'HitPoints' | 'Hit Points'
 * - environment: 'Environment' | 'Environments' | 'Terrain'
 * - xp: calculated from CR
 */
export interface CreatureDTO extends NotionPageBase {
  name: string;
  cr: string;
  size: string;
  type: string;
  alignment: string;
  ac: number;
  hp: number;
  environment: string[];
  xp: number;
}

/**
 * Environment DTO
 * Maps from Notion properties:
 * - name: 'Name' | 'Environment' | 'Title' | 'Environments' | 'EnvironmentName'
 * - description: 'Description' | 'Desc'
 * - terrain_type: 'TerrainType' | 'Terrain' | 'TerrainTypes'
 * - climate: 'Climate' | 'Weather' | 'ClimateType'
 * - hazards: 'Hazards' | 'Dangers'
 * - common_creatures: 'CommonCreatures' | 'Creatures' | 'TypicalCreatures'
 * - survival_dc: 'SurvivalDC' | 'DC'
 * - foraging_dc: 'ForagingDC' | 'ForageDC'
 * - navigation_dc: 'NavigationDC' | 'NavDC'
 * - shelter_availability: 'ShelterAvailability' | 'Shelter'
 * - water_availability: 'WaterAvailability' | 'Water'
 * - food_availability: 'FoodAvailability' | 'Food'
 */
export interface EnvironmentDTO extends NotionPageBase {
  name: string;
  description: string;
  terrain_type: string[];
  climate: string;
  hazards: string[];
  common_creatures: string[];
  survival_dc: number;
  foraging_dc: number;
  navigation_dc: number;
  shelter_availability: string;
  water_availability: string;
  food_availability: string;
}

/**
 * Session DTO
 * Maps from Notion properties:
 * - name: 'Name' | 'Session' | 'Title'
 * - date: 'Date' | 'SessionDate'
 * - description: 'Description' | 'Notes'
 */
export interface SessionDTO extends NotionPageBase {
  name: string;
  date: string;
  description: string;
}

/**
 * Generated Encounter DTO
 * Returned by generate-encounter edge function
 */
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

/**
 * Magic Item DTO
 * Maps from Notion properties:
 * - name: 'Name' | 'Item Name' | 'Magic Item'
 * - rarityRelation: 'Rarity' | 'Magic Item Rarity' (relation)
 * - baseWeaponRelation: 'Base Weapon' | 'Weapon' (relation)
 * - baseArmorRelation: 'Base Armor' | 'Armor' (relation)
 * - itemUrl: 'URL' | 'Item URL' | 'Link'
 * - imageUrl: 'Image URL' | 'Image' | 'ImageURL'
 * - tags: 'Tags' | 'Type' (multi-select)
 * - consumable: 'Consumable' (checkbox)
 * - wondrous: 'Wondrous' (checkbox)
 * - attunement: 'Attunement' | 'Requires Attunement' (checkbox)
 * - source: 'Source' | 'Book' (select)
 * - classRestriction: 'Class Restriction' | 'Class' (multi-select)
 * - archived: 'Archived' (checkbox)
 * - value: 'Value' | 'Gold Value' | 'GP' (number/formula)
 */
export interface MagicItemDTO extends NotionPageBase {
  name: string;
  rarityRelation?: string;
  baseWeaponRelation?: string;
  baseArmorRelation?: string;
  itemUrl?: string;
  imageUrl?: string;
  tags?: string[];
  consumable: boolean;
  wondrous: boolean;
  attunement: boolean;
  source?: string;
  classRestriction?: string[];
  archived: boolean;
  value?: number;
  rarity?: string; // Cached from rarity relation
}

// =============================================================================
// UNION TYPES
// =============================================================================

export type NotionDTO = CreatureDTO | EnvironmentDTO | SessionDTO | EncounterDTO | MagicItemDTO;

// =============================================================================
// D&D HELPER TYPES
// =============================================================================

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

export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  char: number;
}
