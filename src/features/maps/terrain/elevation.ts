/**
 * Fine elevation (`TerrainGrid.elevation`) and the whole steps the rules read.
 * A land tile's step is its fine elevation rounded, kept between the shore and
 * MAX_STEP; a water tile holds its surface step in both. Edits change the fine
 * value and re-derive the step, so the two never disagree.
 */
import { ELEVATION_PER_STEP, MAX_STEP, SEA_STEP } from '../constants';
import { isWater } from './biomes';
import type { TerrainGrid } from '../types';

const E = ELEVATION_PER_STEP;

/** Lowest and highest fine elevation a land tile may hold (their steps round to the shore and MAX_STEP). */
export const LAND_ELEVATION_MIN = Math.ceil((SEA_STEP + 0.5) * E);
export const LAND_ELEVATION_MAX = Math.floor((MAX_STEP + 0.5) * E) - 1;

/** The step a land tile with this fine elevation stands on. */
export const landStepOf = (elevation: number) => Math.max(SEA_STEP + 1, Math.min(MAX_STEP, Math.round(elevation / E)));

export const clampLandElevation = (elevation: number) => Math.max(LAND_ELEVATION_MIN, Math.min(LAND_ELEVATION_MAX, Math.round(elevation)));

/** A tile's ground in steps, with fractions where the map has fine elevation. */
export function levelOf(terrain: TerrainGrid, i: number): number {
  return terrain.elevation ? terrain.elevation[i] / E : terrain.heights[i];
}

/** Gives a map drawn from steps alone a fine elevation layer to edit, matching its steps. */
export function ensureElevation(terrain: TerrainGrid): Uint16Array {
  if (!terrain.elevation) {
    terrain.elevation = new Uint16Array(terrain.width * terrain.height);
    for (let i = 0; i < terrain.heights.length; i++) terrain.elevation[i] = terrain.heights[i] * E;
  }
  return terrain.elevation;
}

/** Sets a tile's fine elevation and its step: land is clamped and rounded, water holds its surface. */
export function setElevation(terrain: TerrainGrid, i: number, elevation: number): void {
  const fine = ensureElevation(terrain);
  if (isWater(terrain.biomes[i])) {
    const step = Math.max(0, Math.min(MAX_STEP, Math.round(elevation / E)));
    terrain.heights[i] = step;
    fine[i] = step * E;
    return;
  }
  const value = clampLandElevation(elevation);
  fine[i] = value;
  terrain.heights[i] = landStepOf(value);
}
