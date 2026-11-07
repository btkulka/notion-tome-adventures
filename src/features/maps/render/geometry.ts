/**
 * Terrain geometry for the 3D diorama, as plain arrays so it stays testable
 * without WebGL. One mesh per surface (texture): tile tops fold along their
 * slope diagonal, every exposed edge gets a side face down to its neighbour
 * (all four sides, since the camera rotates), and roads and rivers are strips
 * laid on the surface. Each vertex remembers its tile so fog can recolour the
 * terrain without rebuilding it.
 *
 * World axes: tile x → +X, tile y → +Z, height → +Y.
 */
import { STEP_HEIGHT } from '../constants';
import { Biome, isWater } from '../terrain/biomes';
import { DIRECTIONS, exitPoint } from '../terrain/roads';
import { cornerMask, cornersFromMask, foldDiagonal, surfaceHeight, type Corners } from '../terrain/slopes';
import type { TerrainGrid } from '../types';

export type SurfaceKey =
  | 'grass' | 'forest' | 'taiga' | 'swamp' | 'desert' | 'beach' | 'hills' | 'rock' | 'snow'
  | 'ocean' | 'shallows' | 'lake' | 'road' | 'cobble' | 'river' | 'earth' | 'cliff' | 'waterSide';

export const BIOME_SURFACE: Record<number, SurfaceKey> = {
  [Biome.Ocean]: 'ocean',
  [Biome.Shallows]: 'shallows',
  [Biome.Lake]: 'lake',
  [Biome.Beach]: 'beach',
  [Biome.Grassland]: 'grass',
  [Biome.Forest]: 'forest',
  [Biome.Taiga]: 'taiga',
  [Biome.Jungle]: 'forest',
  [Biome.Swamp]: 'swamp',
  [Biome.Desert]: 'desert',
  [Biome.Hills]: 'hills',
  [Biome.Mountain]: 'rock',
  [Biome.Snow]: 'snow',
};

export interface MeshData {
  positions: number[];
  normals: number[];
  uvs: number[];
  /** Tile index of each vertex (for fog). */
  tiles: number[];
}

export type TerrainMeshes = Partial<Record<SurfaceKey, MeshData>>;

export interface TerrainExtras {
  /** Road connection masks per tile (see `connectionMasks`). */
  roads?: Uint8Array;
  rivers?: Uint8Array;
  /** Tiles paved as town squares. */
  paved?: Set<number>;
}

/** Tiles per repeat of a top texture. */
export const TOP_REPEAT = 2.5;
/** Steps per vertical repeat of a side texture. */
const SIDE_REPEAT_STEPS = 6;
/** Height the map's outer walls drop to. */
export const BASE_STEP = 1;
/** Lift of roads and rivers above the ground, to keep them on top. */
const STRIP_LIFT = 0.025;

type V3 = [number, number, number];

function mesh(meshes: TerrainMeshes, key: SurfaceKey): MeshData {
  return (meshes[key] ??= { positions: [], normals: [], uvs: [], tiles: [] });
}

/** Adds a triangle wound so its normal faces `outward` (or up when omitted). */
function triangle(m: MeshData, a: V3, b: V3, c: V3, tile: number, uv: (p: V3) => [number, number], outward: V3 = [0, 1, 0]) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let n: V3 = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const len = Math.hypot(n[0], n[1], n[2]);
  if (len < 1e-9) return; // degenerate
  n = [n[0] / len, n[1] / len, n[2] / len];
  if (n[0] * outward[0] + n[1] * outward[1] + n[2] * outward[2] < 0) {
    [b, c] = [c, b];
    n = [-n[0], -n[1], -n[2]];
  }
  for (const p of [a, b, c]) {
    m.positions.push(p[0], p[1], p[2]);
    m.normals.push(n[0], n[1], n[2]);
    const [s, t] = uv(p);
    m.uvs.push(s, t);
    m.tiles.push(tile);
  }
}

const topUv = (p: V3): [number, number] => [p[0] / TOP_REPEAT, p[2] / TOP_REPEAT];

export function tileCorners(terrain: TerrainGrid, x: number, y: number): Corners {
  if (x < 0 || y < 0 || x >= terrain.width || y >= terrain.height) return [BASE_STEP, BASE_STEP, BASE_STEP, BASE_STEP];
  return cornersFromMask(terrain.heights[y * terrain.width + x], cornerMask(terrain, x, y));
}

/** World height of the ground at fractional tile coordinates. */
export function groundHeight(terrain: TerrainGrid, fx: number, fy: number): number {
  const x = Math.min(terrain.width - 1, Math.max(0, Math.floor(fx)));
  const y = Math.min(terrain.height - 1, Math.max(0, Math.floor(fy)));
  return surfaceHeight(tileCorners(terrain, x, y), Math.min(1, Math.max(0, fx - x)), Math.min(1, Math.max(0, fy - y))) * STEP_HEIGHT;
}

// Each edge: our two corner indices, the neighbour offset, the neighbour's
// matching corner indices, and the outward direction.
const EDGES: { ours: [number, number]; d: [number, number]; theirs: [number, number]; out: V3 }[] = [
  { ours: [0, 1], d: [0, -1], theirs: [3, 2], out: [0, 0, -1] }, // north
  { ours: [3, 2], d: [0, 1], theirs: [0, 1], out: [0, 0, 1] }, // south
  { ours: [0, 3], d: [-1, 0], theirs: [1, 2], out: [-1, 0, 0] }, // west
  { ours: [1, 2], d: [1, 0], theirs: [0, 3], out: [1, 0, 0] }, // east
];

/** A block of tiles, x1 and y1 exclusive. */
export interface TileBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Meshes for every tile, or only those inside `bounds` (one render chunk). */
export function buildTerrainMeshes(terrain: TerrainGrid, extras: TerrainExtras = {}, bounds?: TileBounds): TerrainMeshes {
  const { width: W, height: H, biomes } = terrain;
  const meshes: TerrainMeshes = {};
  const { x0, y0, x1, y1 } = bounds ?? { x0: 0, y0: 0, x1: W, y1: H };

  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      const i = y * W + x;
      const b = biomes[i];
      const c = tileCorners(terrain, x, y);
      const corner = (k: number): V3 => [x + (k === 1 || k === 2 ? 1 : 0), c[k] * STEP_HEIGHT, y + (k >= 2 ? 1 : 0)];
      const NW = corner(0), NE = corner(1), SE = corner(2), SW = corner(3);

      // Top, folded along its slope diagonal.
      const top = mesh(meshes, extras.paved?.has(i) ? 'cobble' : BIOME_SURFACE[b] ?? 'grass');
      if (foldDiagonal(c) === 'nw-se') {
        triangle(top, NW, NE, SE, i, topUv);
        triangle(top, NW, SE, SW, i, topUv);
      } else {
        triangle(top, NW, NE, SW, i, topUv);
        triangle(top, NE, SE, SW, i, topUv);
      }

      // Side faces wherever this tile stands above its neighbour along an edge.
      for (const edge of EDGES) {
        const n = tileCorners(terrain, x + edge.d[0], y + edge.d[1]);
        const [k1, k2] = edge.ours;
        const top1 = c[k1], top2 = c[k2];
        const bottom1 = Math.min(n[edge.theirs[0]], top1);
        const bottom2 = Math.min(n[edge.theirs[1]], top2);
        if (top1 <= bottom1 && top2 <= bottom2) continue;
        const drop = Math.max(top1 - bottom1, top2 - bottom2);
        // The map's outer wall is the diorama's earthen base; inland, tall drops are rock.
        const outside = x + edge.d[0] < 0 || y + edge.d[1] < 0 || x + edge.d[0] >= W || y + edge.d[1] >= H;
        const rocky = b === Biome.Hills || b === Biome.Mountain || b === Biome.Snow;
        const key: SurfaceKey = isWater(b) ? 'waterSide' : rocky || (!outside && drop >= 3) ? 'cliff' : 'earth';
        const m = mesh(meshes, key);
        const P1 = corner(k1), P2 = corner(k2);
        const B1: V3 = [P1[0], bottom1 * STEP_HEIGHT, P1[2]];
        const B2: V3 = [P2[0], bottom2 * STEP_HEIGHT, P2[2]];
        const alongX = edge.out[2] !== 0;
        const sideUv = (p: V3): [number, number] => [(alongX ? p[0] : p[2]) / 2, p[1] / (SIDE_REPEAT_STEPS * STEP_HEIGHT)];
        triangle(m, P1, P2, B2, i, sideUv, edge.out);
        triangle(m, P1, B2, B1, i, sideUv, edge.out);
      }

      if (!isWater(b)) {
        if (extras.rivers?.[i]) addStrips(meshes, 'river', x, y, c, extras.rivers[i], 0.15, i);
        if (extras.roads?.[i] && !extras.paved?.has(i)) addStrips(meshes, 'road', x, y, c, extras.roads[i], 0.12, i);
      }
    }
  }
  return meshes;
}

/** A road or river piece: a strip from the tile centre to each connected exit, plus a centre plate. */
function addStrips(meshes: TerrainMeshes, key: SurfaceKey, x: number, y: number, c: Corners, mask: number, halfWidth: number, tile: number) {
  const m = mesh(meshes, key);
  const at = (fx: number, fy: number): V3 => {
    const cx = Math.min(1, Math.max(0, fx));
    const cy = Math.min(1, Math.max(0, fy));
    return [x + fx, (surfaceHeight(c, cx, cy) + STRIP_LIFT / STEP_HEIGHT) * STEP_HEIGHT, y + fy];
  };
  for (let d = 0; d < DIRECTIONS.length; d++) {
    if (!(mask & (1 << d))) continue;
    const [ex, ey] = exitPoint(d);
    const len = Math.hypot(ex - 0.5, ey - 0.5);
    const nx = (-(ey - 0.5) / len) * halfWidth;
    const ny = ((ex - 0.5) / len) * halfWidth;
    const mx = (0.5 + ex) / 2;
    const my = (0.5 + ey) / 2;
    // Two segments so the strip bends with the slope fold.
    for (const [ax, ay, bx, by] of [[0.5, 0.5, mx, my], [mx, my, ex, ey]]) {
      const A1 = at(ax + nx, ay + ny), A2 = at(ax - nx, ay - ny), B1 = at(bx + nx, by + ny), B2 = at(bx - nx, by - ny);
      triangle(m, A1, B1, B2, tile, topUv);
      triangle(m, A1, B2, A2, tile, topUv);
    }
  }
  const P1 = at(0.5 - halfWidth, 0.5 - halfWidth), P2 = at(0.5 + halfWidth, 0.5 - halfWidth);
  const P3 = at(0.5 + halfWidth, 0.5 + halfWidth), P4 = at(0.5 - halfWidth, 0.5 + halfWidth);
  triangle(m, P1, P2, P3, tile, topUv);
  triangle(m, P1, P3, P4, tile, topUv);
}
