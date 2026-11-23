import { describe, expect, it } from 'vitest';
import { STEP_HEIGHT } from '../constants';
import { allChunks, changedTiles, chunkBounds, chunkId, dirtyChunks } from '../render/chunks';
import { buildTerrainMeshes, groundHeight, triangleCount } from '../render/geometry';
import { pickTile, type Vec3 } from '../render/pick';
import { Biome } from '../terrain/biomes';
import { cloneTerrain, createTerrain } from '../terrain/codec';

function flat(width: number, height: number, step = 5) {
  const t = createTerrain(width, height);
  t.biomes.fill(Biome.Grassland);
  t.heights.fill(step);
  return t;
}

/** The map camera's view direction at its default facing. */
const ISO: Vec3 = [-1 / Math.sqrt(3), -1 / Math.sqrt(3), -1 / Math.sqrt(3)];
/** A ray along ISO passing through `p`. */
const through = (p: Vec3): Vec3 => [p[0] - ISO[0] * 60, p[1] - ISO[1] * 60, p[2] - ISO[2] * 60];

describe('pickTile', () => {
  it('finds the tile straight below on flat ground', () => {
    const t = flat(8, 8);
    const hit = pickTile(t, [3.5, 40, 2.5], [0, -1, 0]);
    expect(hit?.tile).toEqual([3, 2]);
    expect(hit?.point[1]).toBeCloseTo(groundHeight(t, 3.5, 2.5), 3);
    expect(hit?.point[1]).toBeCloseTo(5 * STEP_HEIGHT, 0);
  });

  it('meets the ground where an isometric ray crosses it', () => {
    const t = flat(8, 8);
    const ground: Vec3 = [4.3, groundHeight(t, 4.3, 6.7), 6.7];
    const hit = pickTile(t, through(ground), ISO);
    expect(hit?.tile).toEqual([4, 6]);
    expect(hit?.point[0]).toBeCloseTo(4.3, 2);
    expect(hit?.point[2]).toBeCloseTo(6.7, 2);
  });

  it('stops at a tall hill instead of the ground behind it', () => {
    const t = flat(10, 10);
    const behind: Vec3 = [4.5, groundHeight(t, 4.5, 4.5), 4.5];
    expect(pickTile(t, through(behind), ISO)?.tile).toEqual([4, 4]);
    // Edits clone the terrain (the surface is cached per terrain object), as the editor does.
    const hill = cloneTerrain(t);
    hill.heights[5 * 10 + 5] = 20;
    // The same ray now meets the hill's camera-facing slope first: nearer the camera and higher up.
    const hit = pickTile(hill, through(behind), ISO)!;
    expect(hit.point[0]).toBeGreaterThan(behind[0] + 0.2);
    expect(hit.point[1]).toBeGreaterThan(behind[1] + 0.2);
    expect(hit.point[1]).toBeCloseTo(groundHeight(hill, hit.point[0], hit.point[2]), 3);
  });

  it('follows slopes', () => {
    const t = flat(6, 3);
    t.heights[1 * 6 + 3] = 6; // the tile west of it ramps up
    const ground: Vec3 = [2.6, groundHeight(t, 2.6, 1.4), 1.4];
    const hit = pickTile(t, through(ground), ISO);
    expect(hit?.tile).toEqual([2, 1]);
    expect(hit?.point[1]).toBeCloseTo(ground[1], 3);
  });

  it('misses past the edge of the map', () => {
    const t = flat(4, 4);
    expect(pickTile(t, [-3, 40, 2], [0, -1, 0])).toBeNull();
    expect(pickTile(t, through([20, 1.5, 20]), ISO)).toBeNull();
  });
});

describe('render chunks', () => {
  it('covers the map with blocks that build the same terrain as a whole', () => {
    const t = flat(20, 18);
    t.heights[3 * 20 + 17] = 20;
    t.biomes[10 * 20 + 2] = Biome.Lake;
    const whole = buildTerrainMeshes(t);
    const keys = ['ground', 'earth', 'water'] as const;
    const sums = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const id of allChunks(20, 18)) {
      const part = buildTerrainMeshes(t, {}, chunkBounds(id));
      for (const k of keys) sums[k] += triangleCount(part[k]);
    }
    expect(allChunks(20, 18)).toHaveLength(4);
    expect(triangleCount(whole.water)).toBeGreaterThan(0);
    for (const k of keys) expect(sums[k]).toBe(triangleCount(whole[k]));
  });

  it('dirties the neighbouring chunk when an edit sits near its border', () => {
    expect(dirtyChunks([5 * 40 + 5], 40, 40)).toEqual(new Set([chunkId(0, 0)]));
    expect(dirtyChunks([5 * 40 + 15], 40, 40)).toEqual(new Set([chunkId(0, 0), chunkId(1, 0)]));
    expect(dirtyChunks([15 * 40 + 15], 40, 40)).toEqual(new Set([chunkId(0, 0), chunkId(1, 0), chunkId(0, 1), chunkId(1, 1)]));
  });

  it('lists the tiles where any layer changed', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 9, 3, 4]);
    const c = new Uint8Array([0, 0, 0, 0]);
    const d = new Uint8Array([0, 0, 0, 1]);
    expect(changedTiles([[a, b], [c, d]], 4)).toEqual([1, 3]);
  });
});
