/**
 * Which tile is under the cursor, worked out from the heightfield instead of
 * raycasting the terrain meshes. The ray walks the grid cell by cell (a 2D DDA
 * over x/z) and stops at the first tile whose top or wall it meets, so a click
 * on a cliff face picks the tile the cliff belongs to. Cheap enough for every
 * pointer move, and testable without WebGL.
 */
import { MAX_STEP, STEP_HEIGHT } from '../constants';
import { foldDiagonal, surfaceHeight, type Corners } from '../terrain/slopes';
import type { TerrainGrid, TilePoint } from '../types';
import { tileCorners } from './geometry';

export type Vec3 = [number, number, number];

export interface TileHit {
  tile: TilePoint;
  /** Where the ray met the ground, in world units. */
  point: Vec3;
}

const EPS = 1e-12;

export function pickTile(terrain: TerrainGrid, origin: Vec3, dir: Vec3): TileHit | null {
  const { width: W, height: H } = terrain;
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = dir;
  // The camera always looks down; a level or rising ray never meets the ground.
  if (dy >= -EPS) return null;

  // Only the slab between the highest possible top and the base can hold a hit.
  let t0 = ((MAX_STEP + 1) * STEP_HEIGHT - oy) / dy;
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

  const at = (t: number): Vec3 => [ox + dx * t, oy + dy * t, oz + dz * t];
  const start = at(t0);
  let cx = Math.min(W - 1, Math.max(0, Math.floor(start[0])));
  let cz = Math.min(H - 1, Math.max(0, Math.floor(start[2])));
  const stepX = dx > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  let enter = t0;

  for (let guard = 0; guard < W + H + 2; guard++) {
    const tx = Math.abs(dx) < EPS ? Infinity : ((stepX > 0 ? cx + 1 : cx) - ox) / dx;
    const tz = Math.abs(dz) < EPS ? Infinity : ((stepZ > 0 ? cz + 1 : cz) - oz) / dz;
    const exit = Math.max(enter, Math.min(tx, tz, t1));
    const t = hitInCell(tileCorners(terrain, cx, cz), cx, cz, at, enter, exit);
    if (t !== null) return { tile: [cx, cz], point: at(t) };
    if (exit >= t1) return null;
    if (tx < tz) cx += stepX;
    else if (tz < tx) cz += stepZ;
    else {
      cx += stepX;
      cz += stepZ;
    }
    if (cx < 0 || cz < 0 || cx >= W || cz >= H) return null;
    enter = exit;
  }
  return null;
}

/**
 * Where (if anywhere) the ray meets this tile between `ta` and `tb`. Starting
 * below the surface means the ray came through the tile's wall. The top is two
 * triangles, so the height gap is linear on each side of the fold.
 */
function hitInCell(c: Corners, cx: number, cz: number, at: (t: number) => Vec3, ta: number, tb: number): number | null {
  const gap = (t: number) => {
    const p = at(t);
    const fx = Math.min(1, Math.max(0, p[0] - cx));
    const fz = Math.min(1, Math.max(0, p[2] - cz));
    return p[1] - surfaceHeight(c, fx, fz) * STEP_HEIGHT;
  };
  const first = gap(ta);
  if (first <= 0) return ta;

  const pa = at(ta);
  const pb = at(tb);
  const fold = foldDiagonal(c);
  const side = (p: Vec3) => (fold === 'nw-se' ? p[0] - cx - (p[2] - cz) : p[0] - cx + (p[2] - cz) - 1);
  const sa = side(pa);
  const sb = side(pb);
  const stops = sa * sb < 0 ? [ta + (tb - ta) * (sa / (sa - sb)), tb] : [tb];

  let prevT = ta;
  let prevGap = first;
  for (const t of stops) {
    const g = gap(t);
    if (g <= 0) return prevT + (t - prevT) * (prevGap / (prevGap - g));
    prevT = t;
    prevGap = g;
  }
  return null;
}
