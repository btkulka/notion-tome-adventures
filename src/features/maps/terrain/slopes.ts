/**
 * Inclines on stepped terrain. Logic (travel, vision) keeps one height per tile;
 * rendering lifts a tile's corners toward any neighbour exactly one step higher,
 * so one-step rises read as slopes while bigger jumps stay cliffs.
 *
 * Corner order is NW, NE, SE, SW (x grows east, y grows south). A mask has one
 * bit per raised corner; its 16 values cover flat, 4 sides, 4 outer corners,
 * 4 inner corners and 2 saddles. A tile with all four corners raised stays a
 * flat pit rather than filling in.
 */
import { isWater } from './biomes';
import type { TerrainGrid } from '../types';

export const CORNER_NW = 1;
export const CORNER_NE = 2;
export const CORNER_SE = 4;
export const CORNER_SW = 8;

/** Corner heights in steps: [NW, NE, SE, SW]. */
export type Corners = [number, number, number, number];

export type SlopeKind = 'flat' | 'side' | 'outer' | 'inner' | 'saddle';

export interface SlopeShape {
  kind: SlopeKind;
  /**
   * Which way the high ground lies: a compass side for `side`, the raised corner
   * for `outer`, the one LOW corner for `inner`, the raised diagonal for `saddle`.
   */
  toward: 'n' | 'e' | 's' | 'w' | 'nw' | 'ne' | 'se' | 'sw' | 'nw-se' | 'ne-sw' | null;
}

/** The three neighbours (dx, dy) that share each corner with the tile. */
const CORNER_NEIGHBOURS: [number, number][][] = [
  [[-1, 0], [0, -1], [-1, -1]], // NW
  [[1, 0], [0, -1], [1, -1]], // NE
  [[1, 0], [0, 1], [1, 1]], // SE
  [[-1, 0], [0, 1], [-1, 1]], // SW
];

const SHAPES: Record<number, SlopeShape> = {
  0: { kind: 'flat', toward: null },
  1: { kind: 'outer', toward: 'nw' },
  2: { kind: 'outer', toward: 'ne' },
  4: { kind: 'outer', toward: 'se' },
  8: { kind: 'outer', toward: 'sw' },
  3: { kind: 'side', toward: 'n' },
  6: { kind: 'side', toward: 'e' },
  12: { kind: 'side', toward: 's' },
  9: { kind: 'side', toward: 'w' },
  5: { kind: 'saddle', toward: 'nw-se' },
  10: { kind: 'saddle', toward: 'ne-sw' },
  14: { kind: 'inner', toward: 'nw' },
  13: { kind: 'inner', toward: 'ne' },
  11: { kind: 'inner', toward: 'se' },
  7: { kind: 'inner', toward: 'sw' },
  15: { kind: 'flat', toward: null },
};

/** Raised-corner mask for a tile. Water stays flat and never lifts its neighbours. */
export function cornerMask(terrain: TerrainGrid, x: number, y: number): number {
  const { width: W, height: H, heights, biomes } = terrain;
  const i = y * W + x;
  if (isWater(biomes[i])) return 0;
  const h = heights[i];
  let mask = 0;
  for (let k = 0; k < 4; k++) {
    for (const [dx, dy] of CORNER_NEIGHBOURS[k]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (heights[j] === h + 1 && !isWater(biomes[j])) {
        mask |= 1 << k;
        break;
      }
    }
  }
  return mask === 15 ? 0 : mask;
}

export function cornersFromMask(height: number, mask: number): Corners {
  return [
    height + (mask & CORNER_NW ? 1 : 0),
    height + (mask & CORNER_NE ? 1 : 0),
    height + (mask & CORNER_SE ? 1 : 0),
    height + (mask & CORNER_SW ? 1 : 0),
  ];
}

export function cornerHeights(terrain: TerrainGrid, x: number, y: number): Corners {
  return cornersFromMask(terrain.heights[y * terrain.width + x], cornerMask(terrain, x, y));
}

export function slopeShape(mask: number): SlopeShape {
  return SHAPES[mask & 15];
}

/**
 * Which diagonal the top face folds along. Outer and inner corners fold along
 * the diagonal whose ends are level; saddles fold along the raised diagonal so
 * they read as a ridge.
 */
export function foldDiagonal(c: Corners): 'nw-se' | 'ne-sw' {
  const nwSeLevel = c[0] === c[2];
  const neSwLevel = c[1] === c[3];
  if (nwSeLevel && neSwLevel) return c[0] >= c[1] ? 'nw-se' : 'ne-sw';
  if (nwSeLevel) return 'nw-se';
  return 'ne-sw';
}

/** Surface height (in steps) at (fx, fy) inside the tile, both 0..1. */
export function surfaceHeight(c: Corners, fx: number, fy: number): number {
  const [nw, ne, se, sw] = c;
  if (foldDiagonal(c) === 'nw-se') {
    // Triangles NW-NE-SE (above the diagonal fx > fy) and NW-SE-SW.
    return fx >= fy ? nw + (ne - nw) * (fx - fy) + (se - nw) * fy : nw + (sw - nw) * (fy - fx) + (se - nw) * fx;
  }
  // Triangles NW-NE-SW (fx + fy < 1) and NE-SE-SW.
  return fx + fy <= 1 ? nw + (ne - nw) * fx + (sw - nw) * fy : se + (sw - se) * (1 - fx) + (ne - se) * (1 - fy);
}
