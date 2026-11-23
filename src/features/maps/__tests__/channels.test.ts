import { describe, expect, it } from 'vitest';
import { BRIDGE_CLEARANCE, buildChannels, carve, nearest, riverHalf, ROAD_HALF } from '../render/channels';
import { bedHeight, surfaceOf } from '../render/surface';
import { Biome } from '../terrain/biomes';
import { createTerrain } from '../terrain/codec';
import type { TerrainGrid, TilePoint } from '../types';

/** Land sloping down to the east, so rivers flowing east run downhill. */
function slope(width: number, height: number): TerrainGrid {
  const t = createTerrain(width, height);
  t.biomes.fill(Biome.Grassland);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) t.heights[y * width + x] = Math.max(5, 14 - Math.floor(x / 3));
  return t;
}

const row = (y: number, x0: number, x1: number): TilePoint[] => Array.from({ length: x1 - x0 + 1 }, (_, k) => [x0 + k, y] as TilePoint);

describe('rivers and roads as curves', () => {
  it('stays close to the cells it was drawn through', () => {
    const t = slope(30, 12);
    const ch = buildChannels(t, [{ kind: 'river', points: row(6, 1, 28) }]);
    const c = ch.list[0];
    for (let i = 0; i < c.x.length; i++) expect(Math.abs(c.y[i] - 6.5)).toBeLessThan(0.5);
    expect(c.x[0]).toBeCloseTo(1.5, 0);
    expect(c.x[c.x.length - 1]).toBeCloseTo(28.5, 0);
  });

  it('runs into the middle of a town square, unpushed', () => {
    const t = slope(20, 10);
    const town = 5 * 20 + 10;
    const ch = buildChannels(t, [{ kind: 'road', points: row(5, 2, 17) }], new Set([town]));
    const c = ch.list[0];
    expect(c.x.some((x, i) => Math.abs(x - 10.5) < 1e-9 && Math.abs(c.y[i] - 5.5) < 1e-9)).toBe(true);
  });

  it('widens a river downstream and where a tributary joins', () => {
    const t = slope(40, 20);
    const main = row(10, 2, 37);
    const tributary: TilePoint[] = [[18, 2], [18, 3], [18, 4], [18, 5], [18, 6], [18, 7], [18, 8], [18, 9], [18, 10]];
    const ch = buildChannels(t, [{ kind: 'river', points: main }, { kind: 'river', points: tributary }]);
    const river = ch.list[0];
    const halfAt = (x: number) => nearest(ch, 'river', x, 10.5)!.half;
    expect(river.half[river.half.length - 1]).toBeGreaterThan(river.half[0]);
    // The tributary's nine cells join at x = 18: the river is wider just below than just above.
    expect(halfAt(19.5) - halfAt(16.5)).toBeGreaterThan(riverHalf(17) - riverHalf(15));
    // And the tributary meets the river where it joins.
    const trib = ch.list[1];
    const end = trib.x.length - 1;
    expect(nearest(ch, 'river', trib.x[end], trib.y[end], trib)!.d).toBeLessThan(1e-6);
  });

  it('never lets a river run uphill, even drawn the wrong way round', () => {
    const t = slope(30, 8);
    const upstream = row(4, 1, 28).reverse();
    const c = buildChannels(t, [{ kind: 'river', points: upstream }]).list[0];
    for (let i = 1; i < c.level.length; i++) expect(c.level[i]).toBeLessThanOrEqual(c.level[i - 1] + 1e-9);
    expect(c.x[0]).toBeLessThan(c.x[c.x.length - 1]);
  });

  it('cuts a river bed below the water and leaves land away from it alone', () => {
    const t = slope(30, 12);
    const ch = buildChannels(t, [{ kind: 'river', points: row(6, 1, 28) }]);
    const s = surfaceOf(t);
    const c = ch.list[0];
    const i = Math.floor(c.x.length / 2);
    const [x, y] = [c.x[i], c.y[i]];
    expect(carve(ch, x, y, bedHeight(s, x, y))).toBeLessThan(c.level[i]);
    expect(carve(ch, x, 1.5, bedHeight(s, x, 1.5))).toBe(bedHeight(s, x, 1.5));
  });

  it('levels a road across its width', () => {
    const t = createTerrain(20, 10);
    t.biomes.fill(Biome.Grassland);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 20; x++) t.heights[y * 20 + x] = 6 + (y > 5 ? 1 : 0);
    const ch = buildChannels(t, [{ kind: 'road', points: row(5, 1, 18) }]);
    const s = surfaceOf(t);
    const c = ch.list[0];
    const i = Math.floor(c.x.length / 2);
    const across = (d: number) => carve(ch, c.x[i], c.y[i] + d, bedHeight(s, c.x[i], c.y[i] + d));
    expect(Math.abs(across(ROAD_HALF * 0.8) - across(-ROAD_HALF * 0.8))).toBeLessThan(0.02);
  });

  it('carries a road over a river on a deck above the water', () => {
    const t = slope(30, 20);
    const river = row(10, 1, 28);
    const road: TilePoint[] = Array.from({ length: 18 }, (_, k) => [14, 1 + k] as TilePoint);
    const ch = buildChannels(t, [{ kind: 'river', points: river }, { kind: 'road', points: road }]);
    const r = ch.list.find((c) => c.kind === 'road')!;
    const over = r.bridge.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
    expect(over.length).toBeGreaterThan(0);
    for (const i of over) expect(r.level[i]).toBeGreaterThanOrEqual(nearest(ch, 'river', r.x[i], r.y[i])!.level + BRIDGE_CLEARANCE - 1e-9);
    // The deck stands clear above the carved river bed.
    const i = over[Math.floor(over.length / 2)];
    expect(r.level[i] - carve(ch, r.x[i], r.y[i], bedHeight(surfaceOf(t), r.x[i], r.y[i]))).toBeGreaterThan(BRIDGE_CLEARANCE);
  });

  it('marks the cells it touches, and the mark changes when the river does', () => {
    const t = slope(30, 12);
    const a = buildChannels(t, [{ kind: 'river', points: row(6, 1, 28) }]);
    const b = buildChannels(t, [{ kind: 'river', points: row(6, 1, 20) }]);
    expect(a.signature[6 * 30 + 10]).toBeGreaterThan(0);
    expect(a.signature[1 * 30 + 10]).toBe(0);
    expect(a.signature[6 * 30 + 24]).not.toBe(b.signature[6 * 30 + 24]);
  });
});
