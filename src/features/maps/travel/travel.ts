/**
 * Overworld travel rules (PHB ch. 8): pace sets miles per hour, difficult
 * terrain halves speed, roads ignore terrain. The party travels up to eight
 * hours a day and camps until the next morning.
 */
import { aStar, indexEdgeKey } from '../gen/pathfind';
import { BIOMES, type BiomeId } from '../terrain/biomes';
import type { EncounterRules, TerrainGrid, TilePoint, TravelPace } from '../types';

export const PACE_MPH: Record<TravelPace, number> = { slow: 2, normal: 3, fast: 4 };
export const TRAVEL_HOURS_PER_DAY = 8;
export const DAY_START_HOUR = 8;
const MINUTES_PER_DAY = 24 * 60;

export interface TravelContext {
  terrain: TerrainGrid;
  milesPerTile: number;
  /** Tile edges covered by roads (see `collectEdges`). */
  roadEdges: Set<number>;
  pace: TravelPace;
}

export interface Route {
  path: TilePoint[];
  /** Travel minutes elapsed on arrival at each path index (0 at the start). */
  elapsed: number[];
  minutes: number;
  miles: number;
}

/** Minutes to move between two adjacent tiles, or Infinity if impassable. */
export function stepMinutes(ctx: TravelContext, from: number, to: number, diagonal: boolean): number {
  const biome = BIOMES[ctx.terrain.biomes[to] as BiomeId];
  if (!biome || biome.water) return Infinity;
  const onRoad = ctx.roadEdges.has(indexEdgeKey(from, to));
  const multiplier = onRoad ? 1 : biome.travelMultiplier;
  if (multiplier <= 0) return Infinity;
  const miles = ctx.milesPerTile * (diagonal ? Math.SQRT2 : 1);
  return (miles / (PACE_MPH[ctx.pace] * multiplier)) * 60;
}

export function planRoute(ctx: TravelContext, from: TilePoint, to: TilePoint): Route | null {
  const { width } = ctx.terrain;
  const result = aStar({
    width,
    height: ctx.terrain.height,
    start: from,
    goal: to,
    minStepCost: (ctx.milesPerTile / PACE_MPH[ctx.pace]) * 60,
    stepCost: (a, b, diagonal) => stepMinutes(ctx, a, b, diagonal),
  });
  if (!result) return null;

  const elapsed = [0];
  let miles = 0;
  for (let i = 1; i < result.path.length; i++) {
    const [ax, ay] = result.path[i - 1];
    const [bx, by] = result.path[i];
    const diagonal = ax !== bx && ay !== by;
    elapsed.push(elapsed[i - 1] + stepMinutes(ctx, ay * width + ax, by * width + bx, diagonal));
    miles += ctx.milesPerTile * (diagonal ? Math.SQRT2 : 1);
  }
  return { path: result.path, elapsed, minutes: elapsed[elapsed.length - 1], miles };
}

export interface CampStop {
  /** Path index where the party makes camp. */
  atIndex: number;
  start: number;
  end: number;
}

export interface EncounterCheck {
  /** Path index the check happens at (the party's position at that moment). */
  atIndex: number;
  /** World minutes when the check happens. */
  at: number;
  night: boolean;
}

export interface TravelSchedule {
  /** World minutes on arrival at each path index. */
  arrival: number[];
  camps: CampStop[];
  checks: EncounterCheck[];
  arrivesAt: number;
}

/** Lays a route onto the world clock: camps after each travel day, encounter checks on the rules' cadence. */
export function scheduleTravel(route: Route, startMinutes: number, rules: EncounterRules): TravelSchedule {
  const arrival = [startMinutes];
  const camps: CampStop[] = [];
  const checks: EncounterCheck[] = [];
  const dayLimit = TRAVEL_HOURS_PER_DAY * 60;
  const every = Math.max(15, rules.checkEveryHours * 60);
  let now = startMinutes;
  let today = 0;
  let total = 0;

  for (let i = 1; i < route.path.length; i++) {
    const dt = route.elapsed[i] - route.elapsed[i - 1];
    if (today > 0 && today + dt > dayLimit + 1e-6) {
      const end = nextMorning(now);
      camps.push({ atIndex: i - 1, start: now, end });
      if (rules.checkAtNight) checks.push({ atIndex: i - 1, at: now + (end - now) / 2, night: true });
      now = end;
      today = 0;
    }
    for (let k = Math.floor(total / every) + 1; k * every <= total + dt + 1e-6; k++) {
      checks.push({ atIndex: i, at: now + (k * every - total), night: false });
    }
    now += dt;
    today += dt;
    total += dt;
    arrival.push(now);
  }
  return { arrival, camps, checks, arrivesAt: now };
}

/** The next 08:00 strictly after `minutes`. */
export function nextMorning(minutes: number): number {
  const dayStart = Math.floor(minutes / MINUTES_PER_DAY) * MINUTES_PER_DAY;
  const morning = dayStart + DAY_START_HOUR * 60;
  return minutes < morning ? morning : morning + MINUTES_PER_DAY;
}

/** 0..1 fraction of the day (0 = midnight, 0.5 = noon). */
export function dayFraction(minutes: number): number {
  return (((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY) / MINUTES_PER_DAY;
}

export function isNight(minutes: number): boolean {
  const hour = dayFraction(minutes) * 24;
  return hour < 6 || hour >= 20;
}

/** "Day 3 · 14:30". Day 1 starts at minute 0. */
export function formatWorldTime(minutes: number): string {
  const day = Math.floor(minutes / MINUTES_PER_DAY) + 1;
  const ofDay = Math.floor(dayFraction(minutes) * MINUTES_PER_DAY + 1e-6);
  const hh = String(Math.floor(ofDay / 60)).padStart(2, '0');
  const mm = String(ofDay % 60).padStart(2, '0');
  return `Day ${day} · ${hh}:${mm}`;
}

export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const days = Math.floor(total / MINUTES_PER_DAY);
  const hours = Math.floor((total % MINUTES_PER_DAY) / 60);
  const mins = total % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins || parts.length === 0) parts.push(`${mins}m`);
  return parts.join(' ');
}

/** One random-encounter check: true when the d100 roll lands under the chance. */
export function rollCheck(chancePercent: number, rand: () => number = Math.random): boolean {
  return rand() * 100 < chancePercent;
}
