// Pure terrain edits used by the editor's brushes. Each returns the tiles it
// changed so callers can skip no-op saves.
import { MAX_STEP, SEA_STEP } from './constants';
import { Biome, isWater, type BiomeId } from './terrain/biomes';
import type { TerrainGrid, TilePoint } from './types';

export type HeightMode = 'raise' | 'lower' | 'smooth' | 'flatten';

/** Tiles within a square brush of `size` (1 = single tile) centred on `at`. */
export function brushTiles(terrain: TerrainGrid, [cx, cy]: TilePoint, size: number): TilePoint[] {
  const out: TilePoint[] = [];
  const r = size - 1;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= terrain.width || y >= terrain.height) continue;
      if (Math.hypot(x - cx, y - cy) <= r + 0.5) out.push([x, y]);
    }
  }
  return out;
}

export function applyHeight(terrain: TerrainGrid, tiles: TilePoint[], mode: HeightMode, flattenTo?: number): number {
  const { width: W, heights, biomes } = terrain;
  // Smoothing averages the ground as it was, not as this pass leaves it.
  const before = mode === 'smooth' ? heights.slice() : heights;
  let changed = 0;
  for (const [x, y] of tiles) {
    const i = y * W + x;
    if (isWater(biomes[i])) continue;
    let next = heights[i];
    if (mode === 'raise') next += 1;
    else if (mode === 'lower') next -= 1;
    else if (mode === 'flatten' && flattenTo !== undefined) next = flattenTo;
    else if (mode === 'smooth') {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= terrain.height) continue;
          sum += before[ny * W + nx];
          n++;
        }
      }
      next = Math.round(sum / n);
    }
    next = Math.max(SEA_STEP + 1, Math.min(MAX_STEP, next));
    if (next !== heights[i]) {
      heights[i] = next;
      changed++;
    }
  }
  return changed;
}

/** Paints a biome. Turning land to water sinks it; turning water to land raises it to the shore. */
export function applyBiome(terrain: TerrainGrid, tiles: TilePoint[], biome: BiomeId): number {
  const { width: W, heights, biomes } = terrain;
  let changed = 0;
  for (const [x, y] of tiles) {
    const i = y * W + x;
    if (biomes[i] === biome) continue;
    const wasWater = isWater(biomes[i]);
    biomes[i] = biome;
    if (biome === Biome.Ocean || biome === Biome.Shallows) heights[i] = SEA_STEP;
    else if (biome === Biome.Lake) heights[i] = Math.max(SEA_STEP, heights[i] - 1);
    else if (wasWater) heights[i] = SEA_STEP + 1;
    changed++;
  }
  return changed;
}

/** Fills the gap between two tiles with king-move steps, so clicks can skip tiles. */
export function stepsBetween([ax, ay]: TilePoint, [bx, by]: TilePoint): TilePoint[] {
  const out: TilePoint[] = [];
  let x = ax;
  let y = ay;
  while (x !== bx || y !== by) {
    x += Math.sign(bx - x);
    y += Math.sign(by - y);
    out.push([x, y]);
  }
  return out;
}
