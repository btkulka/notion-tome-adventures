import { describe, expect, it } from 'vitest';
import { STEP_HEIGHT } from '../constants';
import { allChunks, changedTiles, chunkBounds, chunkId, dirtyChunks } from '../render/chunks';
import { buildTerrainMeshes, groundHeight } from '../render/geometry';
import { pickTile, type Vec3 } from '../render/pick';
import { Biome } from '../terrain/biomes';
import { createTerrain } from '../terrain/codec';

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
    expect(hit?.point[1]).toBeCloseTo(5 * STEP_HEIGHT);
  });

  it('meets the ground where an isometric ray crosses it', () => {
    const t = flat(8, 8);
    const ground: Vec3 = [4.3, 5 * STEP_HEIGHT, 6.7];
    const hit = pickTile(t, through(ground), ISO);
    expect(hit?.tile).toEqual([4, 6]);
    expect(hit?.point[0]).toBeCloseTo(4.3);
    expect(hit?.point[2]).toBeCloseTo(6.7);
  });

  it('stops at the wall of a tall tile instead of the ground behind it', () => {
    const t = flat(10, 10);
    t.heights[5 * 10 + 5] = 15;
    // Halfway up the pillar's camera-facing side; without the pillar this ray lands on tile (4, 4).
    const hit = pickTile(t, through([5.5, 3, 5.5]), ISO);
    expect(hit?.tile).toEqual([5, 5]);
    t.heights[5 * 10 + 5] = 5;
    expect(pickTile(t, through([5.5, 3, 5.5]), ISO)?.tile).toEqual([4, 4]);
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
    t.heights[3 * 20 + 17] = 9;
    const whole = buildTerrainMeshes(t);
    let grass = 0;
    let cliff = 0;
    for (const id of allChunks(20, 18)) {
      const part = buildTerrainMeshes(t, {}, chunkBounds(id));
      grass += part.grass?.positions.length ?? 0;
      cliff += part.cliff?.positions.length ?? 0;
    }
    expect(allChunks(20, 18)).toHaveLength(4);
    expect(grass).toBe(whole.grass!.positions.length);
    expect(cliff).toBe(whole.cliff!.positions.length);
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
