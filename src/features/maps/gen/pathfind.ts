import type { TilePoint } from '../types';
import { MinHeap } from './heap';

export const NEIGHBORS_8: TilePoint[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export interface AStarOptions {
  width: number;
  height: number;
  start: TilePoint;
  goal: TilePoint;
  /**
   * Cost of stepping from tile index `from` to its neighbour `to`.
   * Return Infinity for an impassable step.
   */
  stepCost: (from: number, to: number, diagonal: boolean) => number;
  /** Lowest possible cost of a straight step; keeps the heuristic admissible. */
  minStepCost: number;
  /** Diagonal moves can't cut between two blocked orthogonal tiles. */
  diagonals?: boolean;
}

export interface PathResult {
  path: TilePoint[];
  cost: number;
}

/** A* over a tile grid with octile distance. Returns null when the goal is unreachable. */
export function aStar(opts: AStarOptions): PathResult | null {
  const { width, height, start, goal, stepCost, minStepCost } = opts;
  const diagonals = opts.diagonals ?? true;
  const size = width * height;
  const startIdx = start[1] * width + start[0];
  const goalIdx = goal[1] * width + goal[0];
  if (!inBounds(start, width, height) || !inBounds(goal, width, height)) return null;
  if (startIdx === goalIdx) return { path: [start], cost: 0 };

  const g = new Float64Array(size).fill(Infinity);
  const came = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const heap = new MinHeap();
  const gx = goal[0];
  const gy = goal[1];

  const heuristic = (idx: number) => {
    const dx = Math.abs((idx % width) - gx);
    const dy = Math.abs(Math.floor(idx / width) - gy);
    return minStepCost * (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy));
  };

  g[startIdx] = 0;
  heap.push(startIdx, heuristic(startIdx));

  while (heap.size > 0) {
    const current = heap.pop()!;
    if (current === goalIdx) break;
    if (closed[current]) continue;
    closed[current] = 1;
    const cx = current % width;
    const cy = Math.floor(current / width);

    for (let n = 0; n < (diagonals ? 8 : 4); n++) {
      const [dx, dy] = NEIGHBORS_8[n];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (closed[next]) continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal) {
        // No squeezing between two impassable orthogonal tiles.
        const a = cy * width + nx;
        const b = ny * width + cx;
        if (!Number.isFinite(stepCost(current, a, false)) && !Number.isFinite(stepCost(current, b, false))) continue;
      }
      const cost = stepCost(current, next, diagonal);
      if (!Number.isFinite(cost)) continue;
      const tentative = g[current] + cost;
      if (tentative < g[next]) {
        g[next] = tentative;
        came[next] = current;
        heap.push(next, tentative + heuristic(next));
      }
    }
  }

  if (!Number.isFinite(g[goalIdx])) return null;
  const path: TilePoint[] = [];
  for (let idx = goalIdx; idx !== -1; idx = came[idx]) {
    path.push([idx % width, Math.floor(idx / width)]);
  }
  path.reverse();
  return { path, cost: g[goalIdx] };
}

function inBounds([x, y]: TilePoint, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

/** Undirected key for the edge between two adjacent tile indices. */
export function indexEdgeKey(ia: number, ib: number): number {
  return ia < ib ? ia * 1_000_003 + ib : ib * 1_000_003 + ia;
}

/** Undirected key for the edge between two adjacent tiles. */
export function edgeKey(a: TilePoint, b: TilePoint, width: number): number {
  return indexEdgeKey(a[1] * width + a[0], b[1] * width + b[0]);
}

/** Every adjacent-tile edge used by a set of paths (roads, rivers). */
export function collectEdges(paths: TilePoint[][], width: number): Set<number> {
  const edges = new Set<number>();
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) edges.add(edgeKey(path[i - 1], path[i], width));
  }
  return edges;
}
