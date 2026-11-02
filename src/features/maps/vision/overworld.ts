/**
 * Overworld party vision. Deterministic, so the DM client can compute it and
 * write the result to `map_fog` while player clients compute the same "visible
 * right now" set locally.
 */
import { MAX_STEP } from '../constants';
import { BIOMES, type BiomeId } from '../terrain/biomes';
import type { TerrainGrid, TilePoint, Weather } from '../types';

export interface VisionOptions {
  night: boolean;
  weather: Weather;
}

/** Sight radius in tiles on open ground in clear daylight. */
export const BASE_SIGHT = 3;

/** Steps the party's eye sits above the tile it stands on. */
const EYE_HEIGHT = 1.5;

/** Peaks at or above this step stay visible from twice the sight radius. */
const LANDMARK_STEP = Math.round(MAX_STEP * 0.6);

export function sightRadius(terrain: TerrainGrid, at: TilePoint, opts: VisionOptions): number {
  const biome = BIOMES[terrain.biomes[at[1] * terrain.width + at[0]] as BiomeId];
  let radius = BASE_SIGHT + (biome?.visionBonus ?? 0);
  if (opts.night) radius = Math.floor(radius / 2);
  if (opts.weather === 'fog' || opts.weather === 'storm' || opts.weather === 'snow') radius -= 1;
  return Math.max(1, radius);
}

/**
 * Tiles the party can see from `at`, as a 0/1 byte per tile. Neighbouring
 * tiles are always visible; beyond that, terrain and canopy block line of sight.
 */
export function computeVisibility(terrain: TerrainGrid, at: TilePoint, opts: VisionOptions): Uint8Array {
  const { width: W, height: H, heights, biomes } = terrain;
  const visible = new Uint8Array(W * H);
  const radius = sightRadius(terrain, at, opts);
  const landmarkRadius = radius * 2;
  const [px, py] = at;
  const eye = heights[py * W + px] + EYE_HEIGHT;

  const blockerHeight = (i: number) => heights[i] + (BIOMES[biomes[i] as BiomeId]?.canopy ?? 0);

  for (let y = Math.max(0, py - landmarkRadius); y <= Math.min(H - 1, py + landmarkRadius); y++) {
    for (let x = Math.max(0, px - landmarkRadius); x <= Math.min(W - 1, px + landmarkRadius); x++) {
      const i = y * W + x;
      const dist = Math.hypot(x - px, y - py);
      if (dist <= 1.5) {
        visible[i] = 1;
        continue;
      }
      const isLandmark = heights[i] >= LANDMARK_STEP;
      if (dist > radius + 0.5 && !(isLandmark && dist <= landmarkRadius + 0.5)) continue;
      if (hasLineOfSight(px, py, eye, x, y, heights[i], W, blockerHeight)) visible[i] = 1;
    }
  }
  return visible;
}

/**
 * Walks the tiles between viewer and target. The target is hidden when any tile
 * in between rises above the sight line at that point.
 */
function hasLineOfSight(
  x0: number,
  y0: number,
  eye: number,
  x1: number,
  y1: number,
  targetHeight: number,
  width: number,
  blockerHeight: (i: number) => number,
): boolean {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    if (x === x1 && y === y1) break;
    const lineHeight = eye + (targetHeight - eye) * t;
    if (blockerHeight(y * width + x) > lineHeight) return false;
  }
  return true;
}

/** Visibility along a route: everything seen from each step. */
export function visibilityAlong(terrain: TerrainGrid, path: TilePoint[], opts: VisionOptions): Uint8Array {
  const seen = new Uint8Array(terrain.width * terrain.height);
  for (const step of path) {
    const v = computeVisibility(terrain, step, opts);
    for (let i = 0; i < seen.length; i++) if (v[i]) seen[i] = 1;
  }
  return seen;
}
