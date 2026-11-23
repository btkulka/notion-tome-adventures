import { describe, expect, it } from 'vitest';
import { Biome } from '../terrain/biomes';
import { createTerrain } from '../terrain/codec';
import type { TerrainGrid } from '../types';
import { BASE_SIGHT, computeVisibility, sightRadius } from '../vision/overworld';

const day = { night: false, weather: 'clear' as const };

function flat(width = 21, height = 21, biome: number = Biome.Grassland, step = 6): TerrainGrid {
  const t = createTerrain(width, height);
  t.biomes.fill(biome);
  t.heights.fill(step);
  return t;
}

const at = (t: TerrainGrid, v: Uint8Array, x: number, y: number) => v[y * t.width + x] === 1;

describe('overworld vision', () => {
  it('sees the base radius on open ground', () => {
    const t = flat();
    const v = computeVisibility(t, [10, 10], day);
    expect(at(t, v, 10 + BASE_SIGHT, 10)).toBe(true);
    expect(at(t, v, 10 + BASE_SIGHT + 1, 10)).toBe(false);
  });

  it('halves sight at night and widens it from a mountain', () => {
    const t = flat();
    expect(sightRadius(t, [10, 10], { night: true, weather: 'clear' })).toBe(Math.floor(BASE_SIGHT / 2));
    t.biomes[10 * t.width + 10] = Biome.Mountain;
    expect(sightRadius(t, [10, 10], day)).toBe(BASE_SIGHT + 3);
  });

  it('always sees adjacent tiles, even in thick forest', () => {
    const t = flat(21, 21, Biome.Forest);
    const v = computeVisibility(t, [10, 10], { night: true, weather: 'fog' });
    expect(at(t, v, 11, 11)).toBe(true);
    expect(at(t, v, 9, 10)).toBe(true);
  });

  it('hides tiles behind a ridge', () => {
    const t = flat();
    for (let y = 0; y < t.height; y++) t.heights[y * t.width + 12] = 14; // wall of hills at x=12
    const v = computeVisibility(t, [10, 10], day);
    expect(at(t, v, 12, 10)).toBe(true); // the ridge itself
    expect(at(t, v, 13, 10)).toBe(false); // behind it
  });

  it('keeps tall peaks visible from twice the radius', () => {
    const t = flat(31, 31);
    t.heights[15 * t.width + 15 + BASE_SIGHT * 2] = 20;
    const v = computeVisibility(t, [15, 15], day);
    expect(at(t, v, 15 + BASE_SIGHT * 2, 15)).toBe(true);
    expect(at(t, v, 15 + BASE_SIGHT * 2 - 1, 15)).toBe(false);
  });

  it("sees a forest's treetops but not past them, unless looking down on it", () => {
    const quarter = { ...day, milesPerTile: 0.25 }; // 3 miles is 12 tiles
    const forest = (t: TerrainGrid) => {
      for (let y = 0; y < t.height; y++) for (const x of [8, 9]) t.biomes[y * t.width + x] = Biome.Forest;
      return t;
    };
    const t = forest(flat());
    const v = computeVisibility(t, [4, 10], quarter);
    expect(at(t, v, 8, 10)).toBe(true); // the near edge's treetops
    expect(at(t, v, 9, 10)).toBe(false); // deeper in
    expect(at(t, v, 12, 10)).toBe(false); // the open ground beyond
    const hill = forest(flat());
    hill.heights[10 * hill.width + 4] = 12; // standing on a rise
    expect(at(hill, computeVisibility(hill, [4, 10], quarter), 12, 10)).toBe(true);
  });

  it('reads the fine elevation, so a gentle rise blocks where it really is', () => {
    const t = flat();
    t.elevation = new Uint16Array(t.width * t.height).fill(6 * 256);
    // Half a step up across x = 11: the steps still say 6, the fine elevation says 6.6.
    for (let y = 0; y < t.height; y++) t.elevation[y * t.width + 11] = Math.round(6.6 * 256 + 2 * 256);
    const v = computeVisibility(t, [9, 10], day);
    expect(at(t, v, 12, 10)).toBe(false);
  });
});
