import { describe, expect, it } from 'vitest';
import { difficultyUtils } from '@/lib/encounter-algorithms';
import { collectEdges } from '../gen/pathfind';
import { Biome } from '../terrain/biomes';
import { createTerrain } from '../terrain/codec';
import type { EncounterRules, TerrainGrid, TilePoint } from '../types';
import {
  dayFraction,
  formatDuration,
  formatWorldTime,
  nextMorning,
  planRoute,
  scheduleTravel,
  type TravelContext,
} from '../travel/travel';

const rules: EncounterRules = { checkEveryHours: 4, chancePercent: 15, checkAtNight: true, difficulty: 'medium', maxMonsters: 6 };

function strip(biome: number, length = 11): TerrainGrid {
  const t = createTerrain(length, 1);
  t.biomes.fill(biome);
  t.heights.fill(6);
  return t;
}

const ctx = (terrain: TerrainGrid, roads: TilePoint[][] = []): TravelContext => ({
  terrain,
  milesPerTile: 1,
  roadEdges: collectEdges(roads, terrain.width),
  pace: 'normal',
});

describe('travel routing', () => {
  it('crosses open grassland at 3 mph', () => {
    const route = planRoute(ctx(strip(Biome.Grassland)), [0, 0], [9, 0])!;
    expect(route.miles).toBeCloseTo(9);
    expect(route.minutes).toBeCloseTo(9 * 20);
  });

  it('halves speed in forest, quarters it in mountains', () => {
    expect(planRoute(ctx(strip(Biome.Forest)), [0, 0], [9, 0])!.minutes).toBeCloseTo(9 * 40);
    expect(planRoute(ctx(strip(Biome.Mountain)), [0, 0], [9, 0])!.minutes).toBeCloseTo(9 * 80);
  });

  it('lets a road ignore difficult terrain', () => {
    const road: TilePoint[] = Array.from({ length: 10 }, (_, x) => [x, 0]);
    expect(planRoute(ctx(strip(Biome.Forest), [road]), [0, 0], [9, 0])!.minutes).toBeCloseTo(9 * 20);
  });

  it('prefers a detour over a slow straight line', () => {
    const t = createTerrain(9, 3);
    t.biomes.fill(Biome.Grassland);
    t.heights.fill(6);
    for (let x = 1; x < 8; x++) t.biomes[1 * 9 + x] = Biome.Mountain;
    const route = planRoute(ctx(t), [0, 1], [8, 1])!;
    expect(route.path.some(([, y]) => y !== 1)).toBe(true);
    expect(route.minutes).toBeLessThan(7 * 80);
  });

  it('refuses to walk on water', () => {
    const t = strip(Biome.Grassland);
    t.biomes[5] = Biome.Lake;
    expect(planRoute(ctx(t), [0, 0], [9, 0])).toBeNull();
  });
});

describe('travel schedule', () => {
  it('camps after eight hours and resumes at 08:00', () => {
    const t = strip(Biome.Grassland, 40);
    const route = planRoute(ctx(t), [0, 0], [36, 0])!; // 36 miles = 12h at 3 mph
    const start = 8 * 60; // Day 1, 08:00
    const schedule = scheduleTravel(route, start, rules);
    expect(schedule.camps).toHaveLength(1);
    expect(schedule.camps[0].start).toBe(start + 8 * 60);
    expect(schedule.camps[0].end).toBe(24 * 60 + 8 * 60);
    expect(schedule.arrivesAt).toBe(24 * 60 + 12 * 60);
    // Every 4 travel hours (3 checks over 12h) plus one at night.
    expect(schedule.checks.filter((c) => !c.night)).toHaveLength(3);
    expect(schedule.checks.filter((c) => c.night)).toHaveLength(1);
  });
});

describe('world clock', () => {
  it('formats day and time', () => {
    expect(formatWorldTime(0)).toBe('Day 1 · 00:00');
    expect(formatWorldTime(24 * 60 * 2 + 14 * 60 + 30)).toBe('Day 3 · 14:30');
    expect(dayFraction(12 * 60)).toBeCloseTo(0.5);
    expect(nextMorning(6 * 60)).toBe(8 * 60);
    expect(nextMorning(9 * 60)).toBe(32 * 60);
    expect(formatDuration(26 * 60 + 5)).toBe('1d 2h 5m');
  });
});

describe('party XP thresholds', () => {
  it('sums per-character thresholds across all twenty levels', () => {
    expect(difficultyUtils.thresholdsForLevels([1, 1, 1, 1]).medium).toBe(200);
    expect(difficultyUtils.thresholdsForLevels([20]).deadly).toBe(12700);
    expect(difficultyUtils.thresholdsForLevels([5, 6]).hard).toBe(750 + 900);
    expect(difficultyUtils.calculatePartyThresholds(11, 4).easy).toBe(3200);
    expect(difficultyUtils.thresholdsForLevels([25]).easy).toBe(2800);
  });
});
