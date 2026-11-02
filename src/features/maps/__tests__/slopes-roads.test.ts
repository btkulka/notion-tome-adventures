import { describe, expect, it } from 'vitest';
import { connectionMasks, exitPoint, roadPiece } from '../terrain/roads';
import { Biome } from '../terrain/biomes';
import { createTerrain } from '../terrain/codec';
import {
  CORNER_NE,
  CORNER_NW,
  CORNER_SE,
  CORNER_SW,
  cornerMask,
  cornersFromMask,
  foldDiagonal,
  slopeShape,
  surfaceHeight,
} from '../terrain/slopes';
import type { TerrainGrid } from '../types';

/** 3×3 grid of land at step 6 with the given (dx, dy) neighbours of the centre raised to 7. */
function around(raised: [number, number][], step = 7): TerrainGrid {
  const t = createTerrain(3, 3);
  t.biomes.fill(Biome.Grassland);
  t.heights.fill(6);
  for (const [dx, dy] of raised) t.heights[(1 + dy) * 3 + 1 + dx] = step;
  return t;
}

describe('slope corners', () => {
  it('stays flat with level neighbours', () => {
    expect(cornerMask(around([]), 1, 1)).toBe(0);
  });

  it('raises a side toward one higher edge neighbour', () => {
    expect(cornerMask(around([[0, -1]]), 1, 1)).toBe(CORNER_NW | CORNER_NE);
    expect(cornerMask(around([[1, 0]]), 1, 1)).toBe(CORNER_NE | CORNER_SE);
    expect(cornerMask(around([[0, 1]]), 1, 1)).toBe(CORNER_SE | CORNER_SW);
    expect(cornerMask(around([[-1, 0]]), 1, 1)).toBe(CORNER_SW | CORNER_NW);
    expect(slopeShape(CORNER_NW | CORNER_NE)).toEqual({ kind: 'side', toward: 'n' });
  });

  it('raises one corner toward a diagonal neighbour', () => {
    expect(cornerMask(around([[1, -1]]), 1, 1)).toBe(CORNER_NE);
    expect(cornerMask(around([[-1, 1]]), 1, 1)).toBe(CORNER_SW);
    expect(slopeShape(CORNER_NE)).toEqual({ kind: 'outer', toward: 'ne' });
  });

  it('makes an inner corner between two higher edges', () => {
    const mask = cornerMask(around([[0, -1], [1, 0]]), 1, 1);
    expect(mask).toBe(CORNER_NW | CORNER_NE | CORNER_SE);
    expect(slopeShape(mask)).toEqual({ kind: 'inner', toward: 'sw' });
  });

  it('makes a saddle between two opposite diagonals', () => {
    const mask = cornerMask(around([[-1, -1], [1, 1]]), 1, 1);
    expect(mask).toBe(CORNER_NW | CORNER_SE);
    expect(slopeShape(mask).kind).toBe('saddle');
  });

  it('keeps a pit flat instead of filling it', () => {
    expect(cornerMask(around([[0, -1], [0, 1]]), 1, 1)).toBe(0);
  });

  it('leaves cliffs (two or more steps) alone', () => {
    expect(cornerMask(around([[0, -1]], 8), 1, 1)).toBe(0);
  });

  it('never slopes water, nor lifts toward it', () => {
    const t = around([[0, -1]]);
    t.biomes[4] = Biome.Lake;
    expect(cornerMask(t, 1, 1)).toBe(0);
    const u = around([[0, -1]]);
    u.biomes[1] = Biome.Lake;
    expect(cornerMask(u, 1, 1)).toBe(0);
  });

  it('names every one of the 16 masks', () => {
    const kinds = Array.from({ length: 16 }, (_, m) => slopeShape(m).kind);
    expect(kinds.filter((k) => k === 'side')).toHaveLength(4);
    expect(kinds.filter((k) => k === 'outer')).toHaveLength(4);
    expect(kinds.filter((k) => k === 'inner')).toHaveLength(4);
    expect(kinds.filter((k) => k === 'saddle')).toHaveLength(2);
  });
});

describe('slope surface', () => {
  it('folds corners along the level diagonal', () => {
    expect(foldDiagonal(cornersFromMask(6, CORNER_NE))).toBe('nw-se');
    expect(foldDiagonal(cornersFromMask(6, CORNER_NW))).toBe('ne-sw');
    expect(foldDiagonal(cornersFromMask(6, CORNER_NW | CORNER_NE | CORNER_SE))).toBe('nw-se');
  });

  it('interpolates heights across the face', () => {
    const side = cornersFromMask(6, CORNER_NW | CORNER_NE);
    expect(surfaceHeight(side, 0.5, 0)).toBeCloseTo(7);
    expect(surfaceHeight(side, 0.5, 1)).toBeCloseTo(6);
    expect(surfaceHeight(side, 0.3, 0.5)).toBeCloseTo(6.5);
    const corner = cornersFromMask(6, CORNER_NE);
    expect(surfaceHeight(corner, 1, 0)).toBeCloseTo(7);
    expect(surfaceHeight(corner, 0, 1)).toBeCloseTo(6);
    // The centre sits on the level fold; halfway toward the raised corner is half a step up.
    expect(surfaceHeight(corner, 0.5, 0.5)).toBeCloseTo(6);
    expect(surfaceHeight(corner, 0.75, 0.25)).toBeCloseTo(6.5);
  });
});

describe('road pieces', () => {
  it('builds masks from paths, diagonals included', () => {
    const masks = connectionMasks([[[0, 1], [1, 1], [2, 1]], [[1, 1], [2, 2]]], 3, 3);
    expect(roadPiece(masks[3])).toBe('end');
    expect(roadPiece(masks[4])).toBe('fork');
    expect(roadPiece(masks[5])).toBe('end');
    expect(roadPiece(masks[8])).toBe('end');
  });

  it('tells straights from bends', () => {
    const straight = connectionMasks([[[1, 0], [1, 1], [1, 2]]], 3, 3);
    expect(roadPiece(straight[4])).toBe('straight');
    const bend = connectionMasks([[[0, 1], [1, 1], [1, 0]]], 3, 3);
    expect(roadPiece(bend[4])).toBe('bend');
    const diagonal = connectionMasks([[[0, 0], [1, 1], [2, 2]]], 3, 3);
    expect(roadPiece(diagonal[4])).toBe('straight');
  });

  it('exits through edge midpoints and corners', () => {
    expect(exitPoint(0)).toEqual([0.5, 0]);
    expect(exitPoint(3)).toEqual([1, 1]);
  });
});
