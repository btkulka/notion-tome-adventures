/**
 * Road (and river) tiles. A path of adjacent tiles becomes a per-tile mask of
 * the directions it leaves in, so each tile can draw its own piece: an end, a
 * straight, a bend, a fork or a crossing, including diagonal links.
 */
import type { TilePoint } from '../types';

/** Bit order: N, NE, E, SE, S, SW, W, NW (y grows south). */
export const DIRECTIONS: TilePoint[] = [
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

export type RoadPiece = 'none' | 'end' | 'straight' | 'bend' | 'fork' | 'crossing';

export function directionIndex(dx: number, dy: number): number {
  return DIRECTIONS.findIndex(([x, y]) => x === dx && y === dy);
}

/** Connection mask per tile for a set of paths. Non-adjacent steps are ignored. */
export function connectionMasks(paths: TilePoint[][], width: number, height: number): Uint8Array {
  const masks = new Uint8Array(width * height);
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1];
      const [bx, by] = path[i];
      const dir = directionIndex(bx - ax, by - ay);
      if (dir < 0) continue;
      if (ax < 0 || ay < 0 || ax >= width || ay >= height || bx < 0 || by < 0 || bx >= width || by >= height) continue;
      masks[ay * width + ax] |= 1 << dir;
      masks[by * width + bx] |= 1 << ((dir + 4) % 8);
    }
  }
  return masks;
}

export function connections(mask: number): number[] {
  const dirs: number[] = [];
  for (let d = 0; d < 8; d++) if (mask & (1 << d)) dirs.push(d);
  return dirs;
}

export function roadPiece(mask: number): RoadPiece {
  const dirs = connections(mask);
  if (dirs.length === 0) return 'none';
  if (dirs.length === 1) return 'end';
  if (dirs.length === 2) return (dirs[1] - dirs[0]) % 8 === 4 ? 'straight' : 'bend';
  if (dirs.length === 3) return 'fork';
  return 'crossing';
}

/**
 * Where a connection leaves the tile, in tile-local coordinates (0..1): edge
 * midpoints for N/E/S/W, corners for the diagonals.
 */
export function exitPoint(direction: number): [number, number] {
  const [dx, dy] = DIRECTIONS[direction];
  return [0.5 + dx * 0.5, 0.5 + dy * 0.5];
}
