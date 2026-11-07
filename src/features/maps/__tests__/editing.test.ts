import { describe, expect, it } from 'vitest';
import { SEA_STEP } from '../constants';
import { applyBiome, applyHeight, brushTiles, stepsBetween } from '../editing';
import { Biome } from '../terrain/biomes';
import { createTerrain } from '../terrain/codec';

function land(size = 5, step = 6) {
  const t = createTerrain(size, size);
  t.biomes.fill(Biome.Grassland);
  t.heights.fill(step);
  return t;
}

describe('editor brushes', () => {
  it('sizes brushes and clips them at the map edge', () => {
    const t = land();
    expect(brushTiles(t, [2, 2], 1)).toEqual([[2, 2]]);
    expect(brushTiles(t, [2, 2], 2)).toHaveLength(9);
    expect(brushTiles(t, [0, 0], 2)).toHaveLength(4);
  });

  it('raises and lowers land but never into the sea', () => {
    const t = land(3, SEA_STEP + 1);
    expect(applyHeight(t, [[1, 1]], 'raise')).toBe(1);
    expect(t.heights[4]).toBe(SEA_STEP + 2);
    expect(applyHeight(t, [[0, 0]], 'lower')).toBe(0);
    expect(t.heights[0]).toBe(SEA_STEP + 1);
  });

  it('flattens to a chosen height and smooths toward neighbours', () => {
    const t = land(3, 6);
    t.heights[4] = 12;
    applyHeight(t, [[1, 1]], 'smooth');
    expect(t.heights[4]).toBe(7);
    applyHeight(t, [[0, 0], [1, 0]], 'flatten', 9);
    expect([t.heights[0], t.heights[1]]).toEqual([9, 9]);
  });

  it('sinks land painted as sea and lifts sea painted as land', () => {
    const t = land(2, 8);
    applyBiome(t, [[0, 0]], Biome.Ocean);
    expect(t.heights[0]).toBe(SEA_STEP);
    applyBiome(t, [[0, 0]], Biome.Forest);
    expect(t.heights[0]).toBe(SEA_STEP + 1);
  });

  it('fills gaps between clicked tiles', () => {
    expect(stepsBetween([0, 0], [3, 1])).toEqual([[1, 1], [2, 1], [3, 1]]);
  });
});
