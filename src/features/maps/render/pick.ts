/**
 * Which tile is under the cursor, worked out from the surface instead of
 * raycasting the terrain meshes. The ray is clipped to the map's box, marched
 * in short steps until it drops below the top of the ground or water, then the
 * crossing is refined by bisection. A ray that enters through the plinth (the
 * map's outer wall) picks the edge tile it came through. Cheap enough for every
 * pointer move, and testable without WebGL.
 */
import { MAX_STEP, STEP_HEIGHT } from '../constants';
import type { TerrainGrid, TilePoint } from '../types';
import { surfaceOf, topHeight } from './surface';

export type Vec3 = [number, number, number];

export interface TileHit {
  tile: TilePoint;
  /** Where the ray met the ground, in world units. */
  point: Vec3;
}

const EPS = 1e-12;

/** Horizontal distance (in tiles) between samples along the ray. */
const MARCH = 0.2;

/** Headroom above MAX_STEP for the ground's noise. */
const CEILING_STEPS = 2.5;

export function pickTile(terrain: TerrainGrid, origin: Vec3, dir: Vec3): TileHit | null {
  const { width: W, height: H } = terrain;
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = dir;
  // The camera always looks down; a level or rising ray never meets the ground.
  if (dy >= -EPS) return null;

  // Only the slab between the highest possible top and the floor can hold a hit.
  let t0 = ((MAX_STEP + CEILING_STEPS) * STEP_HEIGHT - oy) / dy;
  let t1 = -oy / dy;
  const clip = (o: number, d: number, max: number) => {
    if (Math.abs(d) < EPS) return o >= 0 && o <= max;
    let a = -o / d;
    let b = (max - o) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    return true;
  };
  if (!clip(ox, dx, W) || !clip(oz, dz, H) || t0 > t1) return null;

  const s = surfaceOf(terrain);
  const at = (t: number): Vec3 => [ox + dx * t, oy + dy * t, oz + dz * t];
  const gap = (t: number) => {
    const p = at(t);
    return p[1] - topHeight(s, Math.min(W, Math.max(0, p[0])), Math.min(H, Math.max(0, p[2])));
  };
  const hit = (t: number): TileHit => {
    const p = at(t);
    return { tile: [Math.min(W - 1, Math.max(0, Math.floor(p[0]))), Math.min(H - 1, Math.max(0, Math.floor(p[2])))], point: p };
  };

  // Entering below the top means the ray came through the plinth.
  if (gap(t0) <= 0) return hit(t0);

  const horizontal = Math.hypot(dx, dz);
  // A steep ray covers little ground per unit; step by height then, so the surface's swells aren't skipped.
  const dt = horizontal > EPS ? Math.min(MARCH / horizontal, (0.1 * STEP_HEIGHT) / -dy) : (0.1 * STEP_HEIGHT) / -dy;
  let prev = t0;
  for (let t = t0 + dt; prev < t1; t += dt) {
    const tt = Math.min(t, t1);
    if (gap(tt) <= 0) {
      let lo = prev;
      let hi = tt;
      for (let k = 0; k < 20; k++) {
        const mid = (lo + hi) / 2;
        if (gap(mid) > 0) lo = mid;
        else hi = mid;
      }
      return hit(hi);
    }
    prev = tt;
  }
  return null;
}
