export interface EncounterParams {
  environment: string;
  xpThreshold: number;
  maxMonsters: number;
  alignment: string;
  creatureType: string;
  size: string;
  minCR: number;
  maxCR: number;
}

export interface NotionEncounterParams {
  environment: string;
  difficulty: string;
  xpThreshold: number;
  maxMonsters: number;
  alignment?: string;
  creatureType?: string;
  size?: string;
  includeEnvironmentCreatures?: boolean;
  minCR?: string;
  maxCR?: string;
}

export interface GeneratedEncounter {
  encounter_name: string;
  environment: string;
  difficulty: string;
  total_xp: number;
  adjusted_xp: number;
  creatures: Array<{
    name: string;
    quantity: number;
    challenge_rating: string;
    xp_value: number;
  }>;
  generation_notes: string;
}
