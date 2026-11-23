/**
 * The ground's looks, as layers of one texture array (terrainMaterial.ts), and
 * which layer each cell shows. The shader blends the four cells around every
 * point, so a cell only names its look; how looks meet is the shader's job.
 */
import { Biome, isWater } from '../terrain/biomes';
import type { TerrainGrid } from '../types';

/** Texture-array order. Append only: the shader reads these indices. */
export const GROUND_LAYERS = ['grass', 'forest', 'taiga', 'swamp', 'desert', 'beach', 'hills', 'rock', 'snow', 'cobble', 'cliff'] as const;

export type GroundLayer = (typeof GROUND_LAYERS)[number];

export const LAYER_TEXTURE: Record<GroundLayer, string> = {
  grass: '/textures/terrain/grass.png',
  forest: '/textures/terrain/forest.png',
  taiga: '/textures/terrain/taiga.png',
  swamp: '/textures/terrain/swamp.png',
  desert: '/textures/terrain/desert.png',
  beach: '/textures/terrain/beach.png',
  hills: '/textures/terrain/hills.png',
  rock: '/textures/terrain/rock.png',
  snow: '/textures/terrain/snow.png',
  cobble: '/textures/terrain/cobble.png',
  cliff: '/textures/terrain/side-rock.png',
};

export const layerIndex = (layer: GroundLayer) => GROUND_LAYERS.indexOf(layer);

const BIOME_LAYER: Record<number, GroundLayer> = {
  [Biome.Beach]: 'beach',
  [Biome.Grassland]: 'grass',
  [Biome.Forest]: 'forest',
  [Biome.Taiga]: 'taiga',
  [Biome.Jungle]: 'forest',
  [Biome.Swamp]: 'swamp',
  [Biome.Desert]: 'desert',
  [Biome.Hills]: 'hills',
  [Biome.Mountain]: 'rock',
  [Biome.Snow]: 'snow',
};

const SIDES: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * The layer index each cell shows. Town squares are cobbles. A water cell's bed
 * takes the look of the land beside it (sand only where the land is beach), so
 * the shore doesn't grow a sand rim the land never had; open water's bed is sand.
 */
export function cellLayers(terrain: TerrainGrid, paved?: ReadonlySet<number>): Uint8Array {
  const { width: W, height: H, biomes } = terrain;
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (paved?.has(i)) {
      out[i] = layerIndex('cobble');
      continue;
    }
    if (!isWater(biomes[i])) {
      out[i] = layerIndex(BIOME_LAYER[biomes[i]] ?? 'grass');
      continue;
    }
    const x = i % W;
    const y = (i - x) / W;
    let layer: GroundLayer = 'beach';
    for (const [dx, dy] of SIDES) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (!isWater(biomes[n])) {
        layer = BIOME_LAYER[biomes[n]] ?? 'beach';
        break;
      }
    }
    out[i] = layerIndex(layer);
  }
  return out;
}
