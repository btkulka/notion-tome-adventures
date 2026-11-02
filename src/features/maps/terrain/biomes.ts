/**
 * Overworld biome table. Biome ids are stored per tile in `terrain.biomes`, so
 * existing values must never be renumbered — only appended.
 */

export const Biome = {
  Ocean: 0,
  Shallows: 1,
  Lake: 2,
  Beach: 3,
  Grassland: 4,
  Forest: 5,
  Taiga: 6,
  Jungle: 7,
  Swamp: 8,
  Desert: 9,
  Hills: 10,
  Mountain: 11,
  Snow: 12,
} as const;

export type BiomeId = (typeof Biome)[keyof typeof Biome];

/** Logical prop keys; `render/props.ts` decides what each one looks like. */
export type PropKey =
  | 'tree.round'
  | 'tree.pine'
  | 'tree.palm'
  | 'tree.dead'
  | 'bush'
  | 'rock'
  | 'boulder'
  | 'cactus'
  | 'reed';

export interface BiomeDef {
  id: BiomeId;
  key: string;
  name: string;
  /** Top face colour. */
  top: string;
  /** Side face colour. */
  side: string;
  water: boolean;
  /** Fraction of normal travel speed off-road. 0 means impassable on foot. */
  travelMultiplier: number;
  /** Extra tiles of sight radius when the party stands in this biome. */
  visionBonus: number;
  /** Steps of canopy this biome adds when it sits between a viewer and a target. */
  canopy: number;
  /** 5e environment names, used to suggest the Notion Environment mapping. */
  environmentHints: string[];
  /** Props scattered on each tile: expected count per tile. */
  scatter: { prop: PropKey; perTile: number }[];
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  [Biome.Ocean]: {
    id: Biome.Ocean, key: 'ocean', name: 'Ocean', top: '#1f4e79', side: '#163a5a', water: true,
    travelMultiplier: 0, visionBonus: 0, canopy: 0,
    environmentHints: ['Underwater', 'Coastal', 'Ocean', 'Sea'], scatter: [],
  },
  [Biome.Shallows]: {
    id: Biome.Shallows, key: 'shallows', name: 'Shallows', top: '#2f7fa8', side: '#1f5f80', water: true,
    travelMultiplier: 0, visionBonus: 0, canopy: 0,
    environmentHints: ['Coastal', 'Underwater'], scatter: [],
  },
  [Biome.Lake]: {
    id: Biome.Lake, key: 'lake', name: 'Lake', top: '#3a86a8', side: '#2a6680', water: true,
    travelMultiplier: 0, visionBonus: 0, canopy: 0,
    environmentHints: ['Lake', 'Freshwater', 'Coastal'], scatter: [],
  },
  [Biome.Beach]: {
    id: Biome.Beach, key: 'beach', name: 'Beach', top: '#e3d29a', side: '#b9a46c', water: false,
    travelMultiplier: 1, visionBonus: 0, canopy: 0,
    environmentHints: ['Coastal', 'Coast', 'Beach'], scatter: [{ prop: 'rock', perTile: 0.3 }],
  },
  [Biome.Grassland]: {
    id: Biome.Grassland, key: 'grassland', name: 'Grassland', top: '#7fb35a', side: '#6b5136', water: false,
    travelMultiplier: 1, visionBonus: 0, canopy: 0,
    environmentHints: ['Grassland', 'Plains', 'Grasslands'],
    scatter: [{ prop: 'bush', perTile: 0.8 }, { prop: 'tree.round', perTile: 0.25 }, { prop: 'rock', perTile: 0.15 }],
  },
  [Biome.Forest]: {
    id: Biome.Forest, key: 'forest', name: 'Forest', top: '#3f7d3a', side: '#5a442c', water: false,
    travelMultiplier: 0.5, visionBonus: -1, canopy: 2,
    environmentHints: ['Forest', 'Woodland', 'Woods'],
    scatter: [{ prop: 'tree.round', perTile: 5 }, { prop: 'tree.pine', perTile: 1 }, { prop: 'bush', perTile: 1 }],
  },
  [Biome.Taiga]: {
    id: Biome.Taiga, key: 'taiga', name: 'Taiga', top: '#4f7a5c', side: '#4d3f30', water: false,
    travelMultiplier: 0.5, visionBonus: -1, canopy: 2,
    environmentHints: ['Forest', 'Arctic', 'Taiga'],
    scatter: [{ prop: 'tree.pine', perTile: 5 }, { prop: 'rock', perTile: 0.4 }],
  },
  [Biome.Jungle]: {
    id: Biome.Jungle, key: 'jungle', name: 'Jungle', top: '#2f8a3e', side: '#4f3a22', water: false,
    travelMultiplier: 0.5, visionBonus: -1, canopy: 3,
    environmentHints: ['Jungle', 'Forest', 'Rainforest'],
    scatter: [{ prop: 'tree.palm', perTile: 3 }, { prop: 'tree.round', perTile: 3 }, { prop: 'bush', perTile: 2 }],
  },
  [Biome.Swamp]: {
    id: Biome.Swamp, key: 'swamp', name: 'Swamp', top: '#5d6e3f', side: '#463a28', water: false,
    travelMultiplier: 0.5, visionBonus: -1, canopy: 1,
    environmentHints: ['Swamp', 'Marsh', 'Bog'],
    scatter: [{ prop: 'reed', perTile: 3 }, { prop: 'tree.dead', perTile: 1 }, { prop: 'bush', perTile: 0.6 }],
  },
  [Biome.Desert]: {
    id: Biome.Desert, key: 'desert', name: 'Desert', top: '#d9b26a', side: '#a9824a', water: false,
    travelMultiplier: 1, visionBonus: 1, canopy: 0,
    environmentHints: ['Desert', 'Badlands', 'Wasteland'],
    scatter: [{ prop: 'cactus', perTile: 0.5 }, { prop: 'rock', perTile: 0.4 }],
  },
  [Biome.Hills]: {
    id: Biome.Hills, key: 'hills', name: 'Hills', top: '#8fa35a', side: '#6e5a3c', water: false,
    travelMultiplier: 0.5, visionBonus: 1, canopy: 0,
    environmentHints: ['Hill', 'Hills', 'Highlands'],
    scatter: [{ prop: 'rock', perTile: 0.8 }, { prop: 'bush', perTile: 0.6 }, { prop: 'tree.round', perTile: 0.3 }],
  },
  [Biome.Mountain]: {
    id: Biome.Mountain, key: 'mountain', name: 'Mountain', top: '#8a8178', side: '#6b635b', water: false,
    travelMultiplier: 0.25, visionBonus: 3, canopy: 0,
    environmentHints: ['Mountain', 'Mountains'],
    scatter: [{ prop: 'boulder', perTile: 1 }, { prop: 'tree.pine', perTile: 0.4 }],
  },
  [Biome.Snow]: {
    id: Biome.Snow, key: 'snow', name: 'Snow', top: '#eef2f5', side: '#9aa3ab', water: false,
    travelMultiplier: 0.5, visionBonus: 1, canopy: 0,
    environmentHints: ['Arctic', 'Tundra', 'Snow', 'Mountain'],
    scatter: [{ prop: 'rock', perTile: 0.3 }, { prop: 'tree.pine', perTile: 0.3 }],
  },
};

export const BIOME_LIST: BiomeDef[] = Object.values(BIOMES).sort((a, b) => a.id - b.id);

export function isWater(biome: number): boolean {
  return BIOMES[biome as BiomeId]?.water ?? false;
}

/**
 * Suggests Notion Environments for a biome by matching its hints against the
 * environment names. Returns only real matches — an empty list means the DM has
 * to map it by hand.
 */
export function suggestEnvironments<T extends { name: string }>(biome: BiomeDef, environments: T[]): T[] {
  const hints = biome.environmentHints.map((h) => h.toLowerCase());
  const exact = environments.filter((env) => hints.includes(env.name.trim().toLowerCase()));
  if (exact.length > 0) return exact;
  return environments.filter((env) => {
    const name = env.name.trim().toLowerCase();
    return hints.some((h) => name.includes(h) || h.includes(name));
  });
}
