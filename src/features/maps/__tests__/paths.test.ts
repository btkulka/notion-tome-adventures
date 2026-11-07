import { describe, expect, it } from 'vitest';
import { applyHeight } from '../editing';
import { History, objectSteps } from '../editor/history';
import { cutPaths, flowRiver, routeRoad } from '../editor/paths';
import { Biome } from '../terrain/biomes';
import { createTerrain } from '../terrain/codec';
import type { MapObject, PathObject, TilePoint } from '../types';

function land(width: number, height: number, step = 6) {
  const t = createTerrain(width, height);
  t.biomes.fill(Biome.Grassland);
  t.heights.fill(step);
  return t;
}

const base = { mapId: 'm', z: 0, rot: 0, hidden: false };
const path = (id: string, points: TilePoint[]): PathObject => ({ ...base, id, type: 'path', x: points[0][0], y: points[0][1], data: { kind: 'road', points } });

describe('routeRoad', () => {
  it('goes around a lake rather than through it', () => {
    const t = land(9, 5);
    for (let y = 0; y < 4; y++) t.biomes[y * 9 + 4] = Biome.Lake;
    const route = routeRoad(t, [1, 1], [7, 1])!;
    expect(route[0]).toEqual([1, 1]);
    expect(route[route.length - 1]).toEqual([7, 1]);
    expect(route.some(([x, y]) => x === 4 && y === 4)).toBe(true);
    for (const [x, y] of route) expect(t.biomes[y * 9 + x]).not.toBe(Biome.Lake);
  });

  it('gives up when the far side is across the water', () => {
    const t = land(5, 3);
    for (let y = 0; y < 3; y++) t.biomes[y * 5 + 2] = Biome.Ocean;
    expect(routeRoad(t, [0, 1], [4, 1])).toBeNull();
  });
});

describe('flowRiver', () => {
  it('runs downhill to the sea', () => {
    const t = land(8, 3);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 3; y++) t.heights[y * 8 + x] = 12 - x;
    for (let y = 0; y < 3; y++) t.biomes[y * 8 + 7] = Biome.Ocean;
    const river = flowRiver(t, [1, 1])!;
    expect(river[0]).toEqual([1, 1]);
    expect(river[river.length - 1][0]).toBe(7);
    for (let i = 1; i < river.length - 1; i++) expect(t.heights[river[i][1] * 8 + river[i][0]]).toBeLessThan(t.heights[river[i - 1][1] * 8 + river[i - 1][0]]);
  });

  it('fills a hollow and spills over its lowest lip', () => {
    const t = land(7, 7, 10);
    t.heights[3 * 7 + 3] = 8; // the hollow
    t.heights[3 * 7 + 4] = 9; // its lowest lip, to the east
    const river = flowRiver(t, [3, 3])!;
    expect(river[1]).toEqual([4, 3]);
    expect(river[river.length - 1][0]).toBe(6);
  });

  it('ends where it meets another river', () => {
    const t = land(9, 3);
    for (let x = 0; x < 9; x++) for (let y = 0; y < 3; y++) t.heights[y * 9 + x] = 12 - x;
    const rivers = new Uint8Array(27);
    rivers[1 * 9 + 5] = 1;
    expect(flowRiver(t, [1, 1], { rivers })!.at(-1)).toEqual([5, 1]);
  });
});

describe('cutPaths', () => {
  it('splits a path where it is erased and drops short scraps', () => {
    const road = path('r', [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);
    const { updated, created, removed } = cutPaths([road], new Set([2, 4]), 10);
    expect(updated[0].data.points).toEqual([[0, 0], [1, 0]]);
    expect(created).toHaveLength(0); // [3,0] alone and [5,0] alone are too short
    expect(removed).toHaveLength(0);
    expect(cutPaths([road], new Set([2]), 10).created[0].data.points).toEqual([[3, 0], [4, 0], [5, 0]]);
    expect(cutPaths([road], new Set([1, 3, 5]), 10).removed).toEqual([road]);
  });
});

describe('history', () => {
  it('undoes and redoes in order and knows what comes next', () => {
    const h = new History();
    const a = land(2, 2);
    const b = land(2, 2, 7);
    h.push({ kind: 'terrain', label: 'Raise ground', before: a, after: b });
    h.push({ kind: 'objects', label: 'Place a pin', before: [], after: [] });
    expect(h.nextUndo).toBe('Place a pin');
    expect(h.undo()?.label).toBe('Place a pin');
    expect(h.nextRedo).toBe('Place a pin');
    expect(h.undo()?.label).toBe('Raise ground');
    expect(h.undo()).toBeUndefined();
    expect(h.redo()?.label).toBe('Raise ground');
  });

  it('turns an object change into saves and deletes', () => {
    const kept = path('k', [[0, 0], [1, 0]]);
    const made = path('n', [[2, 0], [3, 0]]);
    const before: MapObject[] = [kept];
    const after: MapObject[] = [{ ...kept, hidden: true }, made];
    expect(objectSteps(after, before)).toEqual({ upsert: [kept], remove: ['n'] });
    expect(objectSteps(before, after)).toEqual({ upsert: after, remove: [] });
  });
});

describe('smoothing', () => {
  it('averages the ground as it was before the pass', () => {
    const t = land(3, 1, 6);
    t.heights[0] = 12;
    applyHeight(t, [[0, 0], [1, 0], [2, 0]], 'smooth');
    expect([...t.heights]).toEqual([9, 8, 6]);
  });
});
