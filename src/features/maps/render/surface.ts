/**
 * The ground as one smooth surface over the grid. The grid stays the data
 * (travel, sight, fog and editing read a step per cell); this is only how it's
 * drawn. Each cell's level (its fine elevation, or for water the bed below the
 * surface) sits at the cell's centre, a cubic B-spline joins the centres, and
 * seeded noise roughens it by biome: crags in the mountains, swells in the
 * hills, almost none in the marsh. Coastlines fall where the ground crosses the
 * water's surface, so they curve instead of following cell edges.
 *
 * Pure and deterministic (a fixed noise seed), so every client draws the same
 * ground, and testable without WebGL. Cached per terrain object: edits clone
 * the terrain, so a new object always gets a fresh surface.
 */
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { SEA_STEP, STEP_HEIGHT } from '../constants';
import { mulberry32 } from '../gen/prng';
import { Biome, isWater } from '../terrain/biomes';
import { levelOf } from '../terrain/elevation';
import type { TerrainGrid } from '../types';

/** Steps of noise each biome adds to its ground, peak to trough about twice this. */
const ROUGHNESS: Record<number, number> = {
  [Biome.Ocean]: 0.2,
  [Biome.Shallows]: 0.15,
  [Biome.Lake]: 0.15,
  [Biome.Beach]: 0.08,
  [Biome.Grassland]: 0.22,
  [Biome.Forest]: 0.3,
  [Biome.Taiga]: 0.35,
  [Biome.Jungle]: 0.3,
  [Biome.Swamp]: 0.06,
  [Biome.Desert]: 0.4,
  [Biome.Hills]: 0.6,
  [Biome.Mountain]: 1.2,
  [Biome.Snow]: 1,
};

/** Land touching water keeps its noise this low, so the shore isn't speckled with puddles and islets. */
const SHORE_ROUGHNESS = 0.12;

/** How far (in cells) water deepens away from its shore. Also bounds how far an edit reaches (see chunks.ts). */
export const DEPTH_REACH = 4;

/** Noise frequency in cycles per cell: hummocks a few cells across, finer octaves on top. */
const DETAIL_FREQUENCY = 0.32;

/** Steps the river's surface sits below the banks it runs between. */
export const RIVER_SINK = 0.35;

export interface Surface {
  terrain: TerrainGrid;
  /** Ground level per cell, in steps: land's fine elevation, water's bed. */
  level: Float32Array;
  /** Noise amplitude per cell, in steps. */
  rough: Float32Array;
  /** Water surface per cell in steps, NaN on land. */
  water: Float32Array;
  /** Water surface over each land cell beside water (the shore the water laps onto), NaN elsewhere. */
  shore: Float32Array;
  /** The water cell each shore cell takes its look from, -1 elsewhere. */
  shoreOf: Int32Array;
}

const noise: NoiseFunction2D = createNoise2D(mulberry32(0x7043));

const cache = new WeakMap<TerrainGrid, Surface>();

/** The surface for a terrain, built once per terrain object. */
export function surfaceOf(terrain: TerrainGrid): Surface {
  let s = cache.get(terrain);
  if (!s) {
    s = buildSurface(terrain);
    cache.set(terrain, s);
  }
  return s;
}

const NEIGHBOURS_8: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function buildSurface(terrain: TerrainGrid): Surface {
  const { width: W, height: H, biomes, heights } = terrain;
  const size = W * H;
  const water = new Float32Array(size).fill(NaN);
  for (let i = 0; i < size; i++) if (isWater(biomes[i])) water[i] = biomes[i] === Biome.Lake ? heights[i] : SEA_STEP;

  // Distance (8-neighbour, capped) from every water cell to the nearest land.
  const toLand = new Uint8Array(size).fill(DEPTH_REACH);
  const queue: number[] = [];
  for (let i = 0; i < size; i++) {
    if (Number.isNaN(water[i])) {
      toLand[i] = 0;
      queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head];
    const next = toLand[c] + 1;
    if (next >= DEPTH_REACH) continue;
    const cx = c % W;
    const cy = (c - cx) / W;
    for (const [dx, dy] of NEIGHBOURS_8) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (toLand[n] > next) {
        toLand[n] = next;
        queue.push(n);
      }
    }
  }

  const level = new Float32Array(size);
  const rough = new Float32Array(size);
  const shore = new Float32Array(size).fill(NaN);
  const shoreOf = new Int32Array(size).fill(-1);
  for (let i = 0; i < size; i++) {
    rough[i] = ROUGHNESS[biomes[i]] ?? 0.2;
    if (!Number.isNaN(water[i])) {
      // Shallow by the shore, deeper out to DEPTH_REACH; lakes stay shallower than the sea.
      const d = toLand[i];
      level[i] = water[i] - (biomes[i] === Biome.Lake ? 0.45 + 0.3 * d : 0.4 + 0.45 * d);
      continue;
    }
    level[i] = levelOf(terrain, i);
    const x = i % W;
    const y = (i - x) / W;
    for (const [dx, dy] of NEIGHBOURS_8) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (Number.isNaN(water[n])) continue;
      rough[i] = Math.min(rough[i], SHORE_ROUGHNESS);
      // The higher water wins, so a lake's shore isn't flooded by the sea below it.
      if (Number.isNaN(shore[i]) || water[n] > shore[i]) {
        shore[i] = water[n];
        shoreOf[i] = n;
      }
    }
  }
  return { terrain, level, rough, water, shore, shoreOf };
}

/** Cubic B-spline weights for the four samples around fraction t. */
function bspline(t: number, out: number[]): void {
  const t2 = t * t;
  const t3 = t2 * t;
  out[0] = (1 - 3 * t + 3 * t2 - t3) / 6;
  out[1] = (4 - 6 * t2 + 3 * t3) / 6;
  out[2] = (1 + 3 * t + 3 * t2 - 3 * t3) / 6;
  out[3] = t3 / 6;
}

const wx = [0, 0, 0, 0];
const wy = [0, 0, 0, 0];

/** Smooth per-cell field at fractional tile coordinates (cell centres at +0.5). */
function sample(s: Surface, field: Float32Array, fx: number, fy: number): number {
  const { width: W, height: H } = s.terrain;
  const cx = fx - 0.5;
  const cy = fy - 0.5;
  const ix = Math.floor(cx);
  const iy = Math.floor(cy);
  bspline(cx - ix, wx);
  bspline(cy - iy, wy);
  let sum = 0;
  for (let j = 0; j < 4; j++) {
    const y = Math.min(H - 1, Math.max(0, iy - 1 + j));
    let row = 0;
    for (let k = 0; k < 4; k++) {
      const x = Math.min(W - 1, Math.max(0, ix - 1 + k));
      row += wx[k] * field[y * W + x];
    }
    sum += wy[j] * row;
  }
  return sum;
}

/** Seeded fractal noise, about -1..1. */
function detail(fx: number, fy: number): number {
  let sum = 0;
  let amp = 1;
  let freq = DETAIL_FREQUENCY;
  let norm = 0;
  for (let o = 0; o < 4; o++) {
    sum += amp * noise(fx * freq, fy * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

/**
 * Where to look up which cell's look a spot takes: the spot pushed up to about
 * 0.45 of a tile by smooth noise, so a forest frays into the grassland beside it
 * instead of meeting it along a cell edge.
 */
export function frayed(fx: number, fy: number): [number, number] {
  const ox = noise(fx * 0.7 + 31.7, fy * 0.7 - 12.3) * 0.36 + noise(fx * 1.9 - 4.1, fy * 1.9 + 9.4) * 0.07;
  const oy = noise(fx * 0.7 - 17.9, fy * 0.7 + 44.1) * 0.36 + noise(fx * 1.9 + 7.3, fy * 1.9 - 2.6) * 0.07;
  return [fx + ox, fy + oy];
}

/**
 * Ground (or river- and sea-bed) height in steps at fractional tile coordinates.
 * The cells are read through the same fraying as the biomes, so shorelines and
 * hillsides wander instead of tracing the grid's staircase, and a coast's look
 * changes where its ground does.
 */
export function groundLevel(s: Surface, fx: number, fy: number): number {
  const [wx, wy] = frayed(fx, fy);
  return sample(s, s.level, wx, wy) + detail(fx, fy) * sample(s, s.rough, wx, wy);
}

/** Ground height in world units. */
export const bedHeight = (s: Surface, fx: number, fy: number) => groundLevel(s, fx, fy) * STEP_HEIGHT;

/** Water surface in steps over the cell at (fx, fy), counting a shore cell's lapping water; NaN when dry. */
export function waterLevel(s: Surface, fx: number, fy: number): number {
  const { width: W, height: H } = s.terrain;
  const x = Math.min(W - 1, Math.max(0, Math.floor(fx)));
  const y = Math.min(H - 1, Math.max(0, Math.floor(fy)));
  const i = y * W + x;
  return Number.isNaN(s.water[i]) ? s.shore[i] : s.water[i];
}

/** The top of whatever is there, ground or water, in world units: where pins, props and the cursor sit. */
export function topHeight(s: Surface, fx: number, fy: number): number {
  const ground = groundLevel(s, fx, fy);
  const w = waterLevel(s, fx, fy);
  return (Number.isNaN(w) ? ground : Math.max(ground, w)) * STEP_HEIGHT;
}

/** Upward unit normal of the ground at (fx, fy), from its slope over `eps` tiles. */
export function groundNormal(s: Surface, fx: number, fy: number, eps = 0.125): [number, number, number] {
  const dx = (bedHeight(s, fx + eps, fy) - bedHeight(s, fx - eps, fy)) / (2 * eps);
  const dz = (bedHeight(s, fx, fy + eps) - bedHeight(s, fx, fy - eps)) / (2 * eps);
  const len = Math.hypot(dx, 1, dz);
  return [-dx / len, 1 / len, -dz / len];
}
