/**
 * Seeded overworld generator. Pure: the same params always produce the same
 * region, so a map can be regenerated from its stored seed.
 *
 * Pipeline: warped fBm heightmap → land-shape mask → sea level by quantile →
 * ridged mountains → priority-flood (drainage + lakes) → rivers → climate →
 * biomes → stepped heights → settlements → roads → names.
 */
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { MAX_STEP, SEA_STEP } from '../constants';
import { Biome, type BiomeId } from '../terrain/biomes';
import { createTerrain } from '../terrain/codec';
import type { LandShape, OverworldGenParams, PinType, TerrainGrid, TilePoint } from '../types';
import { MinHeap } from './heap';
import { labelRegions, labelSpot } from '../terrain/regions';
import { placeName, regionName, riverName } from './names';
import { aStar, NEIGHBORS_8 } from './pathfind';
import { mulberry32 } from './prng';

export interface GeneratedSettlement {
  x: number;
  y: number;
  pinType: Extract<PinType, 'village' | 'town' | 'city' | 'castle'>;
  name: string;
}

/** A region's name, standing on the tile where it reads best. */
export interface GeneratedLabel {
  x: number;
  y: number;
  text: string;
}

export interface GeneratedOverworld {
  terrain: TerrainGrid;
  rivers: TilePoint[][];
  /** One per river, in the same order. */
  riverNames: string[];
  roads: TilePoint[][];
  settlements: GeneratedSettlement[];
  labels: GeneratedLabel[];
}

/** Smallest region (in tiles) worth a name, by its main biome. Beaches never get one. */
const NAMED_REGION_SIZE: Partial<Record<BiomeId, number>> = {
  [Biome.Ocean]: 80,
  [Biome.Lake]: 6,
  [Biome.Grassland]: 70,
  [Biome.Forest]: 24,
  [Biome.Taiga]: 24,
  [Biome.Jungle]: 24,
  [Biome.Swamp]: 14,
  [Biome.Desert]: 30,
  [Biome.Hills]: 20,
  [Biome.Mountain]: 18,
  [Biome.Snow]: 20,
};
/** Names per map: about one per 450 tiles, 5 to 14. */
const namedRegions = (width: number, height: number) => Math.min(14, Math.max(5, Math.round((width * height) / 450)));

export const DEFAULT_GEN_PARAMS: Omit<OverworldGenParams, 'seed'> = {
  width: 64,
  height: 64,
  landShape: 'continent',
  mountains: 0.5,
  moisture: 0.5,
  temperature: 0.5,
  settlements: 9,
  rivers: 5,
  roads: true,
};

const WATER_FRACTION: Record<LandShape, number> = {
  continent: 0.35,
  island: 0.55,
  archipelago: 0.62,
  'coast-north': 0.3,
  'coast-south': 0.3,
  'coast-east': 0.3,
  'coast-west': 0.3,
  landlocked: 0,
};

/** How much a road prefers each biome (lower is easier). Water is impassable. */
export const ROAD_COST: Partial<Record<BiomeId, number>> = {
  [Biome.Beach]: 1.2,
  [Biome.Grassland]: 1,
  [Biome.Forest]: 1.8,
  [Biome.Taiga]: 2,
  [Biome.Jungle]: 3,
  [Biome.Swamp]: 3.5,
  [Biome.Desert]: 1.6,
  [Biome.Hills]: 2.2,
  [Biome.Mountain]: 6,
  [Biome.Snow]: 3,
};

/** Land biomes the DM can switch off when generating. Water follows the land shape. */
export const PICKABLE_BIOMES: BiomeId[] = [
  Biome.Grassland, Biome.Forest, Biome.Taiga, Biome.Jungle, Biome.Swamp,
  Biome.Desert, Biome.Beach, Biome.Hills, Biome.Mountain, Biome.Snow,
];

/** Biomes that can cover low ground. A region needs at least one. */
export const LOWLAND_BIOMES: BiomeId[] = [Biome.Grassland, Biome.Forest, Biome.Taiga, Biome.Jungle, Biome.Swamp, Biome.Desert, Biome.Snow];

/** Where each lowland biome sits in (temperature, moisture), both ranked 0..1 across the land. */
const CLIMATE: Partial<Record<BiomeId, [number, number]>> = {
  [Biome.Snow]: [0.05, 0.4],
  [Biome.Taiga]: [0.22, 0.75],
  [Biome.Grassland]: [0.5, 0.3],
  [Biome.Forest]: [0.5, 0.7],
  [Biome.Swamp]: [0.62, 0.95],
  [Biome.Desert]: [0.88, 0.1],
  [Biome.Jungle]: [0.88, 0.8],
};

/** The biomes a region may use, or null when nothing is switched off. */
export function allowedBiomes(params: Pick<OverworldGenParams, 'biomes'>): Set<BiomeId> | null {
  if (!params.biomes) return null;
  const allowed = new Set(params.biomes.filter((b): b is BiomeId => PICKABLE_BIOMES.includes(b as BiomeId)));
  return PICKABLE_BIOMES.every((b) => allowed.has(b)) ? null : allowed;
}

/** Depth (in land-height rank) a depression must have before it holds a lake. */
const LAKE_DEPTH = 0.09;

/** Lakes smaller than this many tiles are left dry. */
const MIN_LAKE_TILES = 4;

export function generateOverworld(params: OverworldGenParams): GeneratedOverworld {
  const { width: W, height: H } = params;
  const size = W * H;
  const S = Math.max(W, H);
  const rand = mulberry32(params.seed);
  const elevationNoise = createNoise2D(rand);
  const warpNoise = createNoise2D(rand);
  const ridgeNoise = createNoise2D(rand);
  const moistureNoise = createNoise2D(rand);
  const temperatureNoise = createNoise2D(rand);

  // 1. Raw elevation with domain warp and the land-shape mask.
  const raw = new Float32Array(size);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x / S) * 2.5;
      const ny = (y / S) * 2.5;
      const wx = fbm(warpNoise, nx + 3.1, ny + 7.7, 3);
      const wy = fbm(warpNoise, nx - 5.3, ny + 1.9, 3);
      const e = fbm(elevationNoise, nx + 0.8 * wx, ny + 0.8 * wy, 5) * 0.5 + 0.5;
      raw[y * W + x] = applyLandShape(e, x, y, W, H, params.landShape);
    }
  }

  // 2. Sea level from the target water fraction. Water depth goes to -1..0; land
  //    is rank-normalised to 0..1 so the mountains slider sets how much land is
  //    high ground regardless of how the noise happened to fall.
  const waterFraction = WATER_FRACTION[params.landShape];
  const sorted = Float32Array.from(raw).sort();
  const minRaw = sorted[0];
  const maxRaw = sorted[size - 1];
  const sea = waterFraction > 0 ? sorted[Math.floor(waterFraction * (size - 1))] : minRaw - 1e-6;

  const h = new Float32Array(size);
  const landTiles: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const e = raw[i];
      if (e <= sea) {
        h[i] = -(sea - e) / (sea - minRaw + 1e-6);
        continue;
      }
      let t = (e - sea) / (maxRaw - sea + 1e-6);
      const ridge = 1 - Math.abs(fbm(ridgeNoise, (x / S) * 4, (y / S) * 4, 4));
      t += params.mountains * ridge * ridge * ridge * smoothstep(0.05, 0.5, t) * 0.9;
      h[i] = t;
      landTiles.push(i);
    }
  }
  landTiles.sort((a, b) => h[a] - h[b]);
  landTiles.forEach((i, rank) => {
    h[i] = landTiles.length > 1 ? Math.max(1e-4, rank / (landTiles.length - 1)) : 0.5;
  });
  const mountainFraction = 0.03 + 0.12 * params.mountains;
  const hillFraction = 0.07 + 0.16 * params.mountains;
  const thresholds = {
    snow: 1 - mountainFraction * 0.35,
    mountain: 1 - mountainFraction,
    hills: 1 - mountainFraction - hillFraction,
  };

  // 3. Priority-flood: fills depressions and gives every land tile a downhill direction.
  const filled = Float32Array.from(h);
  const downstream = new Int32Array(size).fill(-1);
  const visited = new Uint8Array(size);
  const heap = new MinHeap();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (h[i] <= 0 || x === 0 || y === 0 || x === W - 1 || y === H - 1) {
        visited[i] = 1;
        heap.push(i, filled[i]);
      }
    }
  }
  while (heap.size > 0) {
    const c = heap.pop()!;
    const cx = c % W;
    const cy = Math.floor(c / W);
    for (const [dx, dy] of NEIGHBORS_8) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (visited[n]) continue;
      visited[n] = 1;
      filled[n] = Math.max(h[n], filled[c] + 1e-5);
      downstream[n] = c;
      heap.push(n, filled[n]);
    }
  }

  const isOcean = (i: number) => h[i] <= 0;
  const lake = new Uint8Array(size);
  for (let i = 0; i < size; i++) if (h[i] > 0 && filled[i] - h[i] > LAKE_DEPTH) lake[i] = 1;
  removeSmallRegions(lake, W, H, MIN_LAKE_TILES);
  const isWaterTile = (i: number) => isOcean(i) || lake[i] === 1;

  // 4. Rivers: trace downhill from high, spaced-out springs.
  const riverTile = new Uint8Array(size);
  const rivers: TilePoint[][] = [];
  if (params.rivers > 0) {
    const springs: number[] = [];
    for (let i = 0; i < size; i++) {
      const x = i % W;
      const y = Math.floor(i / W);
      if (h[i] > 0.3 && !lake[i] && x > 1 && y > 1 && x < W - 2 && y < H - 2) springs.push(i);
    }
    const springScore = springs.map((i) => h[i] + rand() * 0.4);
    const order = springs.map((_, k) => k).sort((a, b) => springScore[b] - springScore[a]);
    const spacing = Math.max(4, (S / (params.rivers + 1)) * 0.8);
    const sources: TilePoint[] = [];

    for (const k of order) {
      if (rivers.length >= params.rivers) break;
      const start = springs[k];
      const sx = start % W;
      const sy = Math.floor(start / W);
      if (riverTile[start] || sources.some(([x, y]) => Math.hypot(x - sx, y - sy) < spacing)) continue;

      const path: number[] = [start];
      let cur = start;
      while (downstream[cur] !== -1 && !isOcean(cur) && path.length < size) {
        cur = downstream[cur];
        path.push(cur);
        if (riverTile[cur]) break;
      }
      if (path.length < 6) continue;

      for (const i of path) if (!isOcean(i)) riverTile[i] = 1;
      rivers.push(path.map((i) => [i % W, Math.floor(i / W)] as TilePoint));
      sources.push([sx, sy]);
    }
  }

  // 5. Climate.
  const waterDistance = distanceField(W, H, (i) => isWaterTile(i) || riverTile[i] === 1, 8);
  const temperature = new Float32Array(size);
  const moisture = new Float32Array(size);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const land = Math.max(0, h[i]);
      const latitude = ((y + 0.5) / H - 0.5) * 0.3;
      temperature[i] = params.temperature + latitude + fbm(temperatureNoise, (x / S) * 2, (y / S) * 2, 3) * 0.15 - land * 0.25;
      moisture[i] =
        params.moisture + fbm(moistureNoise, (x / S) * 3, (y / S) * 3, 4) * 0.3 + (1 - Math.min(waterDistance[i], 8) / 8) * 0.2 - 0.1;
    }
  }

  // 6. Biomes and stepped heights. When the DM has switched biomes off, the
  //    lowland is split by ranked climate so every biome left on gets land; the
  //    sliders still lean the split toward hot or wet.
  const allowed = allowedBiomes(params);
  const climateRank = { temperature: new Float32Array(size), moisture: new Float32Array(size) };
  if (allowed) {
    const land: number[] = [];
    for (let i = 0; i < size; i++) if (!isOcean(i) && !lake[i]) land.push(i);
    for (const key of ['temperature', 'moisture'] as const) {
      const values = key === 'temperature' ? temperature : moisture;
      const order = [...land].sort((a, b) => values[a] - values[b]);
      order.forEach((i, rank) => (climateRank[key][i] = order.length > 1 ? rank / (order.length - 1) : 0.5));
    }
  }
  const lean = [(params.temperature - 0.5) * 0.5, (params.moisture - 0.5) * 0.5] as const;
  const terrain = createTerrain(W, H);
  const landStep = (t: number) => SEA_STEP + 1 + Math.round(Math.pow(Math.min(1, Math.max(0, t)), 2) * (MAX_STEP - SEA_STEP - 1));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (isOcean(i)) {
        terrain.biomes[i] = Biome.Ocean;
        terrain.heights[i] = SEA_STEP;
        continue;
      }
      if (lake[i]) {
        terrain.biomes[i] = Biome.Lake;
        terrain.heights[i] = Math.max(SEA_STEP, landStep(filled[i]) - 1);
        continue;
      }
      terrain.heights[i] = landStep(h[i]);
      terrain.biomes[i] = allowed
        ? pickedBiome(h[i], temperature[i], climateRank.temperature[i] + lean[0], climateRank.moisture[i] + lean[1], thresholds, allowed)
        : landBiome(h[i], temperature[i], moisture[i], thresholds);
    }
  }
  limitSlopes(terrain, isWaterTile);
  // Shallows: the band of sea along the coast.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!isOcean(i)) continue;
      const nearLand = NEIGHBORS_8.some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < W && ny < H && !isOcean(ny * W + nx);
      });
      if (nearLand) terrain.biomes[i] = Biome.Shallows;
    }
  }
  // Beaches: lowest land touching the sea, unless it's frozen.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (allowed?.has(Biome.Beach) === false) continue;
      if (isWaterTile(i) || terrain.heights[i] !== SEA_STEP + 1 || temperature[i] < 0.2) continue;
      if (terrain.biomes[i] === Biome.Mountain || terrain.biomes[i] === Biome.Swamp) continue;
      const touchesSea = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < W && ny < H && isOcean(ny * W + nx);
      });
      if (touchesSea) terrain.biomes[i] = Biome.Beach;
    }
  }

  // 7. Settlements.
  const settlements = placeSettlements(params, terrain, h, riverTile, isWaterTile, rand);

  // 8. Roads: a minimum spanning tree over settlements, routed with A*.
  const roads: TilePoint[][] = [];
  if (params.roads && settlements.length > 1) {
    const roadTile = new Uint8Array(size);
    for (const [a, b] of spanningTree(settlements)) {
      const route = aStar({
        width: W,
        height: H,
        start: [settlements[a].x, settlements[a].y],
        goal: [settlements[b].x, settlements[b].y],
        minStepCost: 0.35,
        stepCost: (from, to, diagonal) => {
          if (isWaterTile(to)) return Infinity;
          const base = ROAD_COST[terrain.biomes[to] as BiomeId] ?? 1;
          let cost = base * (diagonal ? Math.SQRT2 : 1);
          cost += Math.abs(terrain.heights[to] - terrain.heights[from]) * 0.8;
          if (riverTile[to] && !riverTile[from]) cost += 3;
          if (roadTile[to]) cost = Math.max(0.35, cost * 0.35);
          return cost;
        },
      });
      if (!route) continue; // different landmasses
      for (const [x, y] of route.path) roadTile[y * W + x] = 1;
      roads.push(route.path);
    }
  }

  // 9. Names for the rivers and the larger regions. Drawn last so they never
  // change the land a seed makes.
  const taken = new Set(settlements.map((s) => s.name));
  const riverNames = rivers.map(() => riverName(rand, taken));
  const regions = labelRegions(terrain);
  const labels = regions.regions
    .filter((r) => r.size >= (NAMED_REGION_SIZE[r.biome] ?? Infinity))
    .sort((a, b) => b.size - a.size)
    .slice(0, namedRegions(W, H))
    .map((r) => {
      const spot = labelSpot(regions, r.id);
      return { x: spot % W, y: Math.floor(spot / W), text: regionName(r.biome, rand, taken) };
    });

  return { terrain, rivers, riverNames, roads, settlements, labels };
}

/** `rank` is the tile's land-height rank (0 lowest, 1 highest). */
function landBiome(
  rank: number,
  temp: number,
  wet: number,
  thresholds: { snow: number; mountain: number; hills: number },
): BiomeId {
  if (rank > thresholds.mountain) return rank > thresholds.snow || temp < 0.15 ? Biome.Snow : Biome.Mountain;
  if (rank > thresholds.hills) return temp < 0.1 ? Biome.Snow : Biome.Hills;
  if (temp < 0.15) return wet > 0.45 ? Biome.Taiga : Biome.Snow;
  if (temp < 0.35) return wet > 0.5 ? Biome.Taiga : Biome.Grassland;
  if (temp < 0.7) {
    if (wet > 0.7 && rank < 0.25) return Biome.Swamp;
    if (wet > 0.48) return Biome.Forest;
    return wet > 0.15 ? Biome.Grassland : Biome.Desert;
  }
  if (wet > 0.72 && rank < 0.2) return Biome.Swamp;
  if (wet > 0.6) return Biome.Jungle;
  return wet > 0.35 ? Biome.Grassland : Biome.Desert;
}

/**
 * Biome for a land tile when only some biomes are allowed. High ground keeps
 * its band if hills, mountains or snow are on; otherwise it joins the lowland,
 * which goes to the allowed biome nearest in ranked climate (`t`, `w`). Swamp
 * only claims low ground.
 */
function pickedBiome(
  rank: number,
  temp: number,
  t: number,
  w: number,
  thresholds: { snow: number; mountain: number; hills: number },
  allowed: Set<BiomeId>,
): BiomeId {
  const cold = temp < 0.15;
  if (rank > thresholds.mountain) {
    if (allowed.has(Biome.Snow) && (rank > thresholds.snow || cold)) return Biome.Snow;
    if (allowed.has(Biome.Mountain)) return Biome.Mountain;
    if (allowed.has(Biome.Hills)) return Biome.Hills;
  } else if (rank > thresholds.hills) {
    if (allowed.has(Biome.Hills)) return cold && allowed.has(Biome.Snow) ? Biome.Snow : Biome.Hills;
    if (allowed.has(Biome.Mountain) && rank > (thresholds.hills + thresholds.mountain) / 2) return Biome.Mountain;
  }
  let best: BiomeId | null = null;
  let bestDistance = Infinity;
  for (const biome of LOWLAND_BIOMES) {
    if (!allowed.has(biome)) continue;
    const [ct, cw] = CLIMATE[biome]!;
    const distance = (t - ct) ** 2 + (w - cw) ** 2 + (biome === Biome.Swamp ? Math.max(0, rank - 0.3) * 2 : 0);
    if (distance < bestDistance) {
      best = biome;
      bestDistance = distance;
    }
  }
  return best ?? (allowed.has(Biome.Hills) ? Biome.Hills : allowed.has(Biome.Mountain) ? Biome.Mountain : Biome.Grassland);
}

/**
 * Lowers land until no tile stands more than one step above any neighbour (two
 * in mountains and snow), so most of the land reads as slopes and only real
 * high ground keeps cliffs. Water never moves.
 */
function limitSlopes(terrain: TerrainGrid, isWaterTile: (i: number) => boolean): void {
  const { width: W, height: H, heights, biomes } = terrain;
  const allowed = (i: number) => (biomes[i] === Biome.Mountain || biomes[i] === Biome.Snow ? 2 : 1);
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (isWaterTile(i)) continue;
        for (const [dx, dy] of NEIGHBORS_8) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const cap = heights[ny * W + nx] + allowed(i);
          if (heights[i] > cap) {
            heights[i] = cap;
            changed = true;
          }
        }
      }
    }
  }
}

/** Clears connected regions (4-neighbour) of set cells smaller than `minSize`. */
function removeSmallRegions(mask: Uint8Array, W: number, H: number, minSize: number): void {
  const seen = new Uint8Array(W * H);
  for (let start = 0; start < W * H; start++) {
    if (!mask[start] || seen[start]) continue;
    const region = [start];
    seen[start] = 1;
    for (let head = 0; head < region.length; head++) {
      const c = region[head];
      const cx = c % W;
      const cy = Math.floor(c / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (mask[n] && !seen[n]) {
          seen[n] = 1;
          region.push(n);
        }
      }
    }
    if (region.length < minSize) for (const i of region) mask[i] = 0;
  }
}

function placeSettlements(
  params: OverworldGenParams,
  terrain: TerrainGrid,
  h: Float32Array,
  riverTile: Uint8Array,
  isWaterTile: (i: number) => boolean,
  rand: () => number,
): GeneratedSettlement[] {
  const { width: W, height: H } = terrain;
  if (params.settlements <= 0) return [];
  const biomeBonus: Partial<Record<BiomeId, number>> = {
    [Biome.Grassland]: 0.4,
    [Biome.Forest]: 0.1,
    [Biome.Hills]: 0.1,
    [Biome.Beach]: 0.2,
    [Biome.Desert]: -0.4,
    [Biome.Taiga]: -0.1,
    [Biome.Jungle]: -0.2,
  };
  // A DM who picked only harsh biomes still gets settlements in snow and swamp.
  const excluded = new Set<number>(allowedBiomes(params) ? [Biome.Mountain] : [Biome.Mountain, Biome.Snow, Biome.Swamp]);
  if (allowedBiomes(params)) biomeBonus[Biome.Snow] = biomeBonus[Biome.Swamp] = -0.3;
  const near = (x: number, y: number, test: (i: number) => boolean) =>
    NEIGHBORS_8.some(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < W && ny < H && test(ny * W + nx);
    });

  const candidates: { i: number; score: number }[] = [];
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const i = y * W + x;
      if (isWaterTile(i) || excluded.has(terrain.biomes[i])) continue;
      let score = 1 - h[i] * 1.2 + (biomeBonus[terrain.biomes[i] as BiomeId] ?? 0) + rand() * 0.35;
      if (riverTile[i] || near(x, y, (n) => riverTile[n] === 1)) score += 0.8;
      if (near(x, y, (n) => h[n] <= 0)) score += 0.5;
      else if (near(x, y, isWaterTile)) score += 0.4;
      candidates.push({ i, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const spacing = Math.max(3, Math.sqrt((W * H) / params.settlements) * 0.55);
  const picked: { x: number; y: number; biome: number }[] = [];
  for (const { i } of candidates) {
    if (picked.length >= params.settlements) break;
    const x = i % W;
    const y = Math.floor(i / W);
    if (picked.some((p) => Math.hypot(p.x - x, p.y - y) < spacing)) continue;
    picked.push({ x, y, biome: terrain.biomes[i] });
  }

  const taken = new Set<string>();
  const towns = Math.max(1, Math.floor(picked.length / 4));
  const castles = Math.max(1, Math.floor(picked.length / 8));
  let castleCount = 0;
  return picked.map((p, rank) => {
    let pinType: GeneratedSettlement['pinType'] = 'village';
    if (rank === 0 && picked.length >= 4) pinType = 'city';
    else if (rank <= towns) pinType = 'town';
    else if (p.biome === Biome.Hills && castleCount < castles) {
      pinType = 'castle';
      castleCount++;
    }
    return { x: p.x, y: p.y, pinType, name: placeName(rand, taken) };
  });
}

/** Prim's minimum spanning tree over straight-line distance. Returns index pairs. */
function spanningTree(points: { x: number; y: number }[]): [number, number][] {
  const inTree = new Set<number>([0]);
  const edges: [number, number][] = [];
  while (inTree.size < points.length) {
    let best: [number, number] | null = null;
    let bestDist = Infinity;
    for (const a of inTree) {
      for (let b = 0; b < points.length; b++) {
        if (inTree.has(b)) continue;
        const d = Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
        if (d < bestDist) {
          bestDist = d;
          best = [a, b];
        }
      }
    }
    if (!best) break;
    inTree.add(best[1]);
    edges.push(best);
  }
  return edges;
}

/** Breadth-first distance (in tiles) to the nearest tile matching `isSource`, capped at `cap`. */
function distanceField(W: number, H: number, isSource: (i: number) => boolean, cap: number): Uint8Array {
  const dist = new Uint8Array(W * H).fill(cap);
  const queue: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (isSource(i)) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head];
    const next = dist[c] + 1;
    if (next >= cap) continue;
    const cx = c % W;
    const cy = Math.floor(c / W);
    for (const [dx, dy] of NEIGHBORS_8) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (dist[n] > next) {
        dist[n] = next;
        queue.push(n);
      }
    }
  }
  return dist;
}

function applyLandShape(e: number, x: number, y: number, W: number, H: number, shape: LandShape): number {
  const u = ((x + 0.5) / W) * 2 - 1;
  const v = ((y + 0.5) / H) * 2 - 1;
  const radial = Math.hypot(u, v) / Math.SQRT2;
  const square = Math.max(Math.abs(u), Math.abs(v));
  switch (shape) {
    case 'continent':
      return e * 0.75 + 0.35 - smoothstep(0.55, 1, 0.5 * radial * Math.SQRT2 + 0.5 * square) * 0.7;
    case 'island':
      return e * 0.6 + 0.45 - smoothstep(0.25, 0.85, radial * Math.SQRT2) * 0.9;
    case 'archipelago':
      return e * 0.9 + 0.1 - smoothstep(0.75, 1, square) * 0.4;
    case 'coast-north':
      return e - (1 - smoothstep(0, 0.45, (v + 1) / 2)) * 0.6;
    case 'coast-south':
      return e - (1 - smoothstep(0, 0.45, (1 - v) / 2)) * 0.6;
    case 'coast-west':
      return e - (1 - smoothstep(0, 0.45, (u + 1) / 2)) * 0.6;
    case 'coast-east':
      return e - (1 - smoothstep(0, 0.45, (1 - u) / 2)) * 0.6;
    case 'landlocked':
      return e;
  }
}

function fbm(noise: NoiseFunction2D, x: number, y: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
