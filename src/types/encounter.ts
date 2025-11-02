export interface EncounterParams {
  environment: string[];
  xpThreshold: number;
  maxMonsters: number;
  alignment: string[];
  creatureType: string[];
  creatureSubtype: string[];
  size: string[];
  minCR: number;
  maxCR: number;
}

export interface NotionEncounterParams {
  environment: string[];
  xpThreshold: number;
  maxMonsters: number;
  alignment?: string[];
  creatureType?: string[];
  creatureSubtype?: string[];
  size?: string[];
  includeEnvironmentCreatures?: boolean;
  minCR?: string;
  maxCR?: string;
}

export interface MagicItemTreasure {
  id: string;
  name: string;
  rarity?: string;
  value?: number;
  consumable: boolean;
  wondrous: boolean;
  attunement: boolean;
  imageUrl?: string;
  itemUrl?: string;
}

export interface GeneratedEncounter {
  encounter_name: string;
  environment: string;
  difficulty?: string;
  total_xp: number;
  total_gold?: number;
  adjusted_xp?: number;
  creatures: Array<{
    id: string;
    name: string;
    quantity: number;
    challenge_rating: string | number;
    xp_value: number;
    total_xp: number;
    image_url?: string;
    creature_type: string;
    creature_subtype?: string;
    size: string;
    alignment: string;
    treasure_type?: string;
    gold?: number;
    goldRoll?: string;
    individualGold?: number[];
    goldRolls?: string[];
    treasure?: MagicItemTreasure[];
    treasurePerInstance?: MagicItemTreasure[][];
  }>;
  generation_notes: string;
}
