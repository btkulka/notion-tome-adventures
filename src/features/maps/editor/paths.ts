/**
 * Road and river tools: a road routed over the land the way the generator
 * routes them, a river that finds its own way downhill to water, and an
 * eraser that cuts paths into pieces.
 */
import { MinHeap } from '../gen/heap';
import { ROAD_COST } from '../gen/overworld';
import { aStar } from '../gen/pathfind';
import { isWater, type BiomeId } from '../terrain/biomes';
import type { PathObject, TerrainGrid, TilePoint } from '../types';

export interface PathContext {
  /** Connection masks (see terrain/roads.ts); non-zero where a road or river runs. */
  roads?: Uint8Array;
  rivers?: Uint8Array;
}

/** The cheapest road between two tiles: around water, wary of climbs, glad to join roads already built. */
export function routeRoad(terrain: TerrainGrid, from: TilePoint, to: TilePoint, ctx: PathContext = {}): TilePoint[] | null {
  const { width, height, biomes, heights } = terrain;
  const result = aStar({
    width,
    height,
    start: from,
    goal: to,
    minStepCost: 0.35,
    stepCost: (a, b, diagonal) => {
      if (isWater(biomes[b])) return Infinity;
      let cost = (ROAD_COST[biomes[b] as BiomeId] ?? 1) * (diagonal ? Math.SQRT2 : 1);
      cost += Math.abs(heights[b] - heights[a]) * 0.8;
      if (ctx.rivers?.[b] && !ctx.rivers[a]) cost += 3;
      if (ctx.roads?.[b]) cost = Math.max(0.35, cost * 0.35);
      return cost;
    },
  });
  return result && result.path.length > 1 ? result.path : null;
}

const NEIGHBOURS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/**
 * The course water takes from `source`: always into the lowest ground it can
 * reach, filling hollows until it spills over, until it meets open water, joins
 * another river or runs off the map. Null if it can't get anywhere.
 */
export function flowRiver(terrain: TerrainGrid, source: TilePoint, ctx: PathContext = {}): TilePoint[] | null {
  const { width: W, height: H, biomes, heights } = terrain;
  const start = source[1] * W + source[0];
  if (source[0] < 0 || source[1] < 0 || source[0] >= W || source[1] >= H || isWater(biomes[start])) return null;
  const came = new Int32Array(W * H).fill(-2);
  const heap = new MinHeap();
  let order = 0;
  came[start] = -1;
  heap.push(start, heights[start] * 1e7);
  while (heap.size > 0) {
    const i = heap.pop()!;
    const x = i % W;
    const y = (i - x) / W;
    const outlet = i !== start && (isWater(biomes[i]) || Boolean(ctx.rivers?.[i]) || x === 0 || y === 0 || x === W - 1 || y === H - 1);
    if (outlet) {
      const path: TilePoint[] = [];
      for (let j = i; j !== -1; j = came[j]) path.push([j % W, Math.floor(j / W)]);
      return path.reverse();
    }
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (came[j] !== -2) continue;
      came[j] = i;
      // Lowest ground first; among equals, the nearest, straight steps before diagonal ones.
      heap.push(j, heights[j] * 1e7 + ++order * 2 + (dx && dy ? 1 : 0));
    }
  }
  return null;
}

/** A new path piece, ready to save. */
export type PathDraft = Pick<PathObject, 'type' | 'x' | 'y' | 'hidden' | 'data'>;

/**
 * Cuts paths where they cross erased tiles. A path keeps its id for its first
 * surviving piece; later pieces become new paths, and pieces shorter than two
 * tiles disappear.
 */
export function cutPaths(paths: PathObject[], erased: Set<number>, width: number): { updated: PathObject[]; created: PathDraft[]; removed: PathObject[] } {
  const updated: PathObject[] = [];
  const created: PathDraft[] = [];
  const removed: PathObject[] = [];
  for (const path of paths) {
    const pts = path.data.points;
    if (!pts.some(([x, y]) => erased.has(y * width + x))) continue;
    const runs: TilePoint[][] = [[]];
    for (const p of pts) {
      if (erased.has(p[1] * width + p[0])) {
        if (runs[runs.length - 1].length) runs.push([]);
      } else runs[runs.length - 1].push(p);
    }
    const kept = runs.filter((r) => r.length >= 2);
    if (kept.length === 0) {
      removed.push(path);
      continue;
    }
    updated.push({ ...path, x: kept[0][0][0], y: kept[0][0][1], data: { ...path.data, points: kept[0] } });
    for (const run of kept.slice(1)) {
      created.push({ type: 'path', x: run[0][0], y: run[0][1], hidden: path.hidden, data: { ...path.data, points: run } });
    }
  }
  return { updated, created, removed };
}
