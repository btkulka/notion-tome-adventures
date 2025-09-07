// Base Notion page properties that all DTOs will have
export interface NotionPageBase {
  id: string;
  created_time: string;
  last_edited_time: string;
  created_by: string;
  last_edited_by: string;
  cover?: string;
  icon?: string;
  parent: string;
  archived: boolean;
  url: string;
}

// Creature/Monster DTO
export interface CreatureDTO extends NotionPageBase {
  name: string;
  size: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
  type: string; // Beast, Humanoid, Dragon, etc.
  subtype?: string;
  alignment: string;
  armor_class: number;
  armor_description?: string;
  hit_points: number;
  hit_dice: string;
  speed: {
    walk?: number;
    fly?: number;
    swim?: number;
    climb?: number;
    burrow?: number;
  };
  ability_scores: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  saving_throws?: Record<string, number>;
  skills?: Record<string, number>;
  damage_resistances?: string[];
  damage_immunities?: string[];
  damage_vulnerabilities?: string[];
  condition_immunities?: string[];
  senses?: string[];
  languages?: string[];
  challenge_rating: number;
  xp_value: number;
  proficiency_bonus: number;
  environment: string[];
  source: string;
  page_number?: number;
  legendary_actions?: number;
  actions?: string; // JSON string of actions array
  legendary_actions_description?: string;
  special_abilities?: string; // JSON string of abilities array
  spellcasting?: string; // JSON string of spellcasting info
}

// Spell DTO
export interface SpellDTO extends NotionPageBase {
  name: string;
  level: number;
  school: 'Abjuration' | 'Conjuration' | 'Divination' | 'Enchantment' | 'Evocation' | 'Illusion' | 'Necromancy' | 'Transmutation';
  casting_time: string;
  range: string;
  components: {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    material_description?: string;
  };
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  at_higher_levels?: string;
  classes: string[]; // Which classes can cast this spell
  source: string;
  page_number?: number;
  damage_type?: string;
  save_type?: string;
  attack_type?: 'ranged' | 'melee' | null;
}

// Item/Equipment DTO
export interface ItemDTO extends NotionPageBase {
  name: string;
  type: 'Weapon' | 'Armor' | 'Shield' | 'Adventuring Gear' | 'Tool' | 'Mount' | 'Vehicle' | 'Trade Good' | 'Magic Item';
  subtype?: string;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Very Rare' | 'Legendary' | 'Artifact';
  description: string;
  weight?: number;
  cost?: {
    quantity: number;
    unit: 'cp' | 'sp' | 'ep' | 'gp' | 'pp';
  };
  source: string;
  page_number?: number;
  
  // Weapon specific properties
  damage?: {
    dice: string;
    type: string;
  };
  properties?: string[]; // Finesse, Heavy, Light, etc.
  weapon_category?: 'Simple' | 'Martial';
  weapon_type?: 'Melee' | 'Ranged';
  
  // Armor specific properties
  armor_class?: {
    base: number;
    dex_bonus: boolean;
    max_bonus?: number;
  };
  strength_requirement?: number;
  stealth_disadvantage?: boolean;
  armor_category?: 'Light' | 'Medium' | 'Heavy' | 'Shield';
  
  // Magic item properties
  attunement_required?: boolean;
  charges?: number;
  recharge?: string;
  magic_bonus?: number;
  spell_save_dc?: number;
  spell_attack_bonus?: number;
}

// Environment DTO
export interface EnvironmentDTO extends NotionPageBase {
  name: string;
  description: string;
  terrain_type: string[];
  climate: string;
  hazards?: string[];
  common_creatures: string[]; // References to creature names/IDs
  typical_encounters?: string; // JSON string of encounter ideas
  travel_pace_modifier?: number;
  survival_dc?: number;
  foraging_dc?: number;
  navigation_dc?: number;
  shelter_availability: 'Abundant' | 'Common' | 'Scarce' | 'None';
  water_availability: 'Abundant' | 'Common' | 'Scarce' | 'None';
  food_availability: 'Abundant' | 'Common' | 'Scarce' | 'None';
}

// Generated Encounter DTO
export interface EncounterDTO extends NotionPageBase {
  encounter_name: string;
  environment: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Deadly';
  total_xp: number;
  adjusted_xp?: number;
  creatures: {
    name: string;
    quantity: number;
    cr: number;
    xp_each: number;
    total_xp: number;
  }[];
  description?: string;
  tactics?: string;
  treasure?: string;
  complications?: string[];
  location_details?: string;
  generation_parameters: {
    xp_threshold: number;
    max_monsters: number;
    min_cr: number;
    max_cr: number;
    alignment_filter?: string;
    type_filter?: string;
    size_filter?: string;
    environment_filter: string;
  };
  generation_log: string[];
  notes?: string;
  dm_notes?: string;
  used_in_session?: boolean;
  session_date?: string;
}

// NPC DTO (if you have NPCs)
export interface NPCDTO extends NotionPageBase {
  name: string;
  race: string;
  class?: string;
  level?: number;
  background?: string;
  alignment: string;
  armor_class: number;
  hit_points: number;
  speed: number;
  ability_scores: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  skills?: Record<string, number>;
  languages?: string[];
  challenge_rating?: number;
  location?: string;
  faction?: string;
  role: 'Ally' | 'Enemy' | 'Neutral' | 'Quest Giver' | 'Merchant' | 'Noble' | 'Commoner';
  personality_traits?: string[];
  ideals?: string[];
  bonds?: string[];
  flaws?: string[];
  description: string;
  notes?: string;
  equipment?: string[];
  spells_known?: string[];
}

// Location DTO (if you track locations)
export interface LocationDTO extends NotionPageBase {
  name: string;
  type: 'City' | 'Town' | 'Village' | 'Dungeon' | 'Landmark' | 'Geographic Feature' | 'Building' | 'Room';
  parent_location?: string; // Reference to parent location
  population?: number;
  government?: string;
  notable_npcs?: string[]; // References to NPC IDs
  shops?: string[];
  services?: string[];
  description: string;
  history?: string;
  secrets?: string;
  hooks?: string[];
  dangers?: string[];
  treasure?: string[];
  map_reference?: string;
  climate?: string;
  terrain?: string[];
}

// Session Log DTO (for tracking campaigns)
export interface SessionLogDTO extends NotionPageBase {
  session_number: number;
  session_date: string;
  party_level: number;
  party_members: string[];
  location: string;
  encounters_used: string[]; // References to encounter IDs
  npcs_met: string[]; // References to NPC IDs
  treasure_found?: string[];
  xp_awarded?: number;
  story_beats: string[];
  player_notes?: string;
  dm_notes?: string;
  next_session_prep?: string[];
}

// Union type for all DTOs
export type NotionDTO = 
  | CreatureDTO 
  | SpellDTO 
  | ItemDTO 
  | EnvironmentDTO 
  | EncounterDTO 
  | NPCDTO 
  | LocationDTO 
  | SessionLogDTO;

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