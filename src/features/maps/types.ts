import type { GeneratedEncounter } from '@/types/encounter';

export type MapKind = 'overworld' | 'local';

/** Tile coordinate: x is the column, y is the row. */
export type TilePoint = [number, number];

export interface TerrainGrid {
  width: number;
  height: number;
  /** Elevation step per tile (0..MAX_STEP). Water tiles hold their surface step. */
  heights: Uint8Array;
  /** BiomeId per tile. */
  biomes: Uint8Array;
}

/** Terrain as stored in `maps.terrain` (base64-packed byte arrays). */
export interface StoredTerrain {
  heights: string;
  biomes: string;
}

export type LandShape =
  | 'continent'
  | 'island'
  | 'archipelago'
  | 'coast-north'
  | 'coast-south'
  | 'coast-east'
  | 'coast-west'
  | 'landlocked';

export interface OverworldGenParams {
  seed: number;
  width: number;
  height: number;
  landShape: LandShape;
  /** 0..1 — how much of the land is hills and mountains. */
  mountains: number;
  /** 0..1 — dry to wet. */
  moisture: number;
  /** 0..1 — cold to hot. */
  temperature: number;
  settlements: number;
  rivers: number;
  roads: boolean;
  /** Land biomes the region may use (see PICKABLE_BIOMES); absent means all of them. */
  biomes?: number[];
}

export type EncounterDifficulty = 'easy' | 'medium' | 'hard' | 'deadly';

export interface EncounterRules {
  /** Hours of travel between random encounter checks. */
  checkEveryHours: number;
  /** Chance (0..100) that a check produces an encounter. */
  chancePercent: number;
  /** Also check once per night spent camping. */
  checkAtNight: boolean;
  difficulty: EncounterDifficulty;
  maxMonsters: number;
}

/** A Notion Environment the DM mapped a biome to. */
export interface EnvironmentRef {
  id: string;
  name: string;
}

export interface MapSettings {
  /** BiomeId (as string key) → Notion Environments used for random encounters. */
  biomeEnvironments: Record<string, EnvironmentRef[]>;
  encounters: EncounterRules;
}

export interface MapDoc {
  id: string;
  campaignId: string;
  parentMapId: string | null;
  parentPinId: string | null;
  kind: MapKind;
  name: string;
  width: number;
  height: number;
  /** Miles per tile (overworld) or feet per cell (local). */
  scale: number;
  seed: number;
  genParams: OverworldGenParams | null;
  terrain: TerrainGrid;
  settings: MapSettings;
  version: number;
  thumbnailPath: string | null;
  updatedAt: string;
}

/** Library listing: everything except the terrain payload. */
export type MapSummary = Omit<MapDoc, 'terrain' | 'settings' | 'genParams'>;

// --- Map objects ----------------------------------------------------------

export type MapObjectType = 'pin' | 'path' | 'prop' | 'label' | 'light' | 'wall' | 'door' | 'token';

export type PinType =
  | 'village'
  | 'town'
  | 'city'
  | 'castle'
  | 'ruin'
  | 'dungeon'
  | 'cave'
  | 'tower'
  | 'shrine'
  | 'camp'
  | 'landmark'
  | 'encounter';

export interface PinData {
  pinType: PinType;
  name: string;
  notionLocationId: string | null;
  childMapId: string | null;
  /** Reveal to players automatically once the party has seen its tile. */
  autoReveal: boolean;
  /** Encounter pins carry the encounter that was rolled there. */
  encounter?: GeneratedEncounter;
}

export interface PathData {
  kind: 'river' | 'road';
  points: TilePoint[];
  /** "The King's Road", "the River Wyn". Unnamed roads are described by the places at their ends. */
  name?: string;
}

/** A name on the map. A label names the region (see terrain/regions.ts) of the tile it stands on. */
export interface LabelData {
  text: string;
  size: number;
}

/** Reserved for the combat layer; not rendered yet. */
export interface TokenData {
  name: string;
  notionCreatureId: string | null;
  characterId: string | null;
  size: string;
  stats?: { hp: number; maxHp: number; ac: number; conditions: string[]; initiative: number | null };
}

interface MapObjectBase<T extends MapObjectType, D> {
  id: string;
  mapId: string;
  type: T;
  x: number;
  y: number;
  z: number;
  rot: number;
  hidden: boolean;
  data: D;
}

export type PinObject = MapObjectBase<'pin', PinData>;
export type PathObject = MapObjectBase<'path', PathData>;
export type LabelObject = MapObjectBase<'label', LabelData>;
export type TokenObject = MapObjectBase<'token', TokenData>;
export type GenericObject = MapObjectBase<'prop' | 'light' | 'wall' | 'door', Record<string, unknown>>;

export type MapObject = PinObject | PathObject | LabelObject | TokenObject | GenericObject;

// --- Live table -----------------------------------------------------------

export type Weather = 'clear' | 'overcast' | 'rain' | 'storm' | 'snow' | 'fog';

export interface LiveSession {
  campaignId: string;
  status: 'live' | 'ended';
  activeMapId: string | null;
  partyMapId: string | null;
  partyX: number;
  partyY: number;
  /** In-game minutes since Day 1, 00:00. */
  worldMinutes: number;
  weather: Weather;
  notionSessionId: string | null;
  updatedAt: string;
}

export type TravelPace = 'slow' | 'normal' | 'fast';

export interface TravelLogEntry {
  id: string;
  campaignId: string;
  mapId: string;
  from: TilePoint;
  to: TilePoint;
  path: TilePoint[];
  minutes: number;
  miles: number;
  pace: TravelPace;
  startedAt: number;
  encounter: { atIndex: number; biome: string; summary: string } | null;
  createdAt: string;
}
