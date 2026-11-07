/**
 * Regions: connected stretches of one kind of land or water, the units a map
 * names ("the Gloamwood", "the Greyspine Mountains"). Snow joins the mountains
 * it caps and shallows join their sea, so a range or an ocean stays one region.
 * Regions are derived from the terrain on the fly; a name is a label object
 * standing on any tile of the region.
 */
import type { TileBounds } from '../render/geometry';
import type { TerrainGrid } from '../types';
import { Biome, BIOMES, type BiomeId } from './biomes';

/** Biomes that merge into one region when they touch. */
const GROUP: Partial<Record<BiomeId, number>> = {
  [Biome.Shallows]: Biome.Ocean,
  [Biome.Snow]: Biome.Mountain,
};
const groupOf = (biome: number) => GROUP[biome as BiomeId] ?? biome;

/** What a region is called when it has no name, by its main biome. */
const KIND: Record<BiomeId, string> = {
  [Biome.Ocean]: 'Open sea',
  [Biome.Shallows]: 'Shallow sea',
  [Biome.Lake]: 'Lake',
  [Biome.Beach]: 'Coast',
  [Biome.Grassland]: 'Grassland',
  [Biome.Forest]: 'Forest',
  [Biome.Taiga]: 'Pinewood',
  [Biome.Jungle]: 'Jungle',
  [Biome.Swamp]: 'Marsh',
  [Biome.Desert]: 'Desert',
  [Biome.Hills]: 'Hills',
  [Biome.Mountain]: 'Mountains',
  [Biome.Snow]: 'Snowfields',
};

export interface Region {
  id: number;
  /** The biome most of its tiles have. */
  biome: BiomeId;
  size: number;
  bounds: TileBounds;
}

export interface RegionMap {
  width: number;
  height: number;
  /** Region id per tile. */
  ids: Int32Array;
  regions: Region[];
}

export const regionKind = (region: Pick<Region, 'biome'>) => KIND[region.biome] ?? BIOMES[region.biome]?.name ?? 'Land';

/** Labels every tile with its region (4-connected). Linear in the map size. */
export function labelRegions(terrain: TerrainGrid): RegionMap {
  const { width: W, height: H, biomes } = terrain;
  const ids = new Int32Array(W * H).fill(-1);
  const regions: Region[] = [];
  const stack: number[] = [];
  const counts = new Map<number, number>();
  for (let start = 0; start < ids.length; start++) {
    if (ids[start] !== -1) continue;
    const id = regions.length;
    const group = groupOf(biomes[start]);
    const bounds = { x0: W, y0: H, x1: 0, y1: 0 };
    counts.clear();
    let size = 0;
    ids[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W;
      const y = (i - x) / W;
      size++;
      counts.set(biomes[i], (counts.get(biomes[i]) ?? 0) + 1);
      if (x < bounds.x0) bounds.x0 = x;
      if (y < bounds.y0) bounds.y0 = y;
      if (x + 1 > bounds.x1) bounds.x1 = x + 1;
      if (y + 1 > bounds.y1) bounds.y1 = y + 1;
      const visit = (j: number) => {
        if (ids[j] === -1 && groupOf(biomes[j]) === group) {
          ids[j] = id;
          stack.push(j);
        }
      };
      if (x > 0) visit(i - 1);
      if (x < W - 1) visit(i + 1);
      if (y > 0) visit(i - W);
      if (y < H - 1) visit(i + W);
    }
    let biome = biomes[start] as BiomeId;
    for (const [b, n] of counts) if (n > (counts.get(biome) ?? 0)) biome = b as BiomeId;
    regions.push({ id, biome, size, bounds });
  }
  return { width: W, height: H, ids, regions };
}

export function regionTiles(map: RegionMap, id: number): number[] {
  const out: number[] = [];
  const r = map.regions[id];
  if (!r) return out;
  for (let y = r.bounds.y0; y < r.bounds.y1; y++) {
    for (let x = r.bounds.x0; x < r.bounds.x1; x++) {
      const i = y * map.width + x;
      if (map.ids[i] === id) out.push(i);
    }
  }
  return out;
}

/**
 * The tile deepest inside a region (farthest from its border or the map's
 * edge), nearest its middle among equals: where its name reads best.
 */
export function labelSpot(map: RegionMap, id: number): number {
  const { width: W, height: H, ids } = map;
  const tiles = regionTiles(map, id);
  if (tiles.length === 0) return -1;
  const seen = new Set<number>();
  let frontier: number[] = [];
  let cx = 0;
  let cy = 0;
  for (const i of tiles) {
    const x = i % W;
    const y = (i - x) / W;
    cx += x / tiles.length;
    cy += y / tiles.length;
    const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1 || ids[i - 1] !== id || ids[i + 1] !== id || ids[i - W] !== id || ids[i + W] !== id;
    if (edge) {
      seen.add(i);
      frontier.push(i);
    }
  }
  let deepest = frontier;
  while (frontier.length) {
    deepest = frontier;
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= ids.length || ids[j] !== id || seen.has(j)) continue;
        seen.add(j);
        next.push(j);
      }
    }
    frontier = next;
  }
  const off = (i: number) => Math.hypot((i % W) - cx, Math.floor(i / W) - cy);
  return deepest.reduce((best, i) => (off(i) < off(best) ? i : best), deepest[0]);
}
