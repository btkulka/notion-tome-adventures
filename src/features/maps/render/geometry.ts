/**
 * Terrain geometry for the 3D diorama, as plain arrays so it stays testable
 * without WebGL. The ground is the smooth surface of surface.ts, sampled a few
 * times per cell into one mesh per chunk; its looks (biomes blending into each
 * other, rock on steep ground, snow on high flats) are painted by the ground
 * shader from a texture of cell layers (layers.ts, terrainMaterial.ts). Water
 * is a flat sheet at its surface over water cells and the shore beside them, so
 * the coastline is wherever the ground rises through it; the water shader
 * colours it by depth. Rivers and roads are ribbons along their curves
 * (channels.ts), the ground carved beneath them: water in its bed, roads on
 * level ground, stone decks where roads cross rivers. The map's outer
 * edge drops to an earthen base, like a diorama's plinth. Each vertex remembers
 * its tile so fog can recolour the terrain without rebuilding it.
 *
 * World axes: tile x → +X, tile y → +Z, height → +Y.
 */
import { STEP_HEIGHT } from '../constants';
import { isWater } from '../terrain/biomes';
import type { TerrainGrid } from '../types';
import { carve, type Channel, type Channels } from './channels';
import { bedHeight, surfaceOf, waterLevel, type Surface } from './surface';

/** One mesh (and material) each. */
export type SurfaceKey = 'ground' | 'water' | 'road' | 'river' | 'bridge' | 'earth' | 'waterSide';

export interface MeshData {
  positions: number[];
  normals: number[];
  uvs: number[];
  /** Tile index of each vertex (for fog). */
  tiles: number[];
  /** Triangles as vertex indices; absent means every three vertices are a triangle. */
  indices?: number[];
}

/** Triangles in a mesh, indexed or not. */
export const triangleCount = (m?: MeshData) => (m ? (m.indices ? m.indices.length : m.positions.length / 3) / 3 : 0);

export type TerrainMeshes = Partial<Record<SurfaceKey, MeshData>>;

export interface TerrainExtras {
  /** Road connection masks per tile (see `connectionMasks`): what props keep clear of. */
  roads?: Uint8Array;
  rivers?: Uint8Array;
  /** Tiles paved as town squares. */
  paved?: Set<number>;
  /** Rivers and roads as curves (channels.ts): drawn as ribbons, carved into the ground. */
  channels?: Channels;
  /** 'low' builds the ground a step coarser (Standard quality: phones, tablets, small machines). */
  detail?: 'low' | 'normal';
}

/** Tiles per repeat of a top texture. */
export const TOP_REPEAT = 2.5;
/** Steps per vertical repeat of a side texture. */
const SIDE_REPEAT_STEPS = 6;
/** Height the map's outer walls drop to. */
export const BASE_STEP = 1;
/** Lift of a road above its levelled bed, to keep it on top. */
const ROAD_LIFT = 0.018;
/** Lift of a river's ribbon above its water level. */
const RIVER_LIFT = 0.004;
/** Bridge deck: thickness under the road, parapet height, and how much wider than the road. */
const DECK = { thick: 0.06, parapet: 0.035, widen: 1.35 };

/**
 * Quads per cell side: fewer on big maps so the vertex count stays near a quarter
 * million per 128 × 128, and a step fewer again at low detail.
 */
export function subdivisions(terrain: TerrainGrid, detail: 'low' | 'normal' = 'normal'): number {
  const big = Math.max(terrain.width, terrain.height) > 160;
  return detail === 'low' ? (big ? 2 : 3) : big ? 3 : 4;
}

type V3 = [number, number, number];

function mesh(meshes: TerrainMeshes, key: SurfaceKey): MeshData {
  return (meshes[key] ??= { positions: [], normals: [], uvs: [], tiles: [] });
}

const topUv = (p: V3): [number, number] => [p[0] / TOP_REPEAT, p[2] / TOP_REPEAT];

/** Pushes one vertex and returns its index. */
function vertex(m: MeshData, p: V3, n: V3, uv: [number, number], tile: number): number {
  m.positions.push(p[0], p[1], p[2]);
  m.normals.push(n[0], n[1], n[2]);
  m.uvs.push(uv[0], uv[1]);
  m.tiles.push(tile);
  return m.tiles.length - 1;
}

/** Adds a flat-shaded triangle wound so its normal faces `outward` (or up when omitted). */
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
  for (const p of [a, b, c]) vertex(m, p, n, uv(p), tile);
}

/** World height of the ground, carved by any rivers and roads. */
export function carvedHeight(s: Surface, channels: Channels | undefined, fx: number, fy: number): number {
  return carve(channels, fx, fy, bedHeight(s, fx, fy));
}

/**
 * World height of the top of the ground or water at fractional tile coordinates:
 * where pins, props and the cursor sit. Pass the map's channels to sit on carved ground.
 */
export function groundHeight(terrain: TerrainGrid, fx: number, fy: number, channels?: Channels): number {
  const s = surfaceOf(terrain);
  const ground = carvedHeight(s, channels, fx, fy);
  const w = waterLevel(s, fx, fy);
  return Number.isNaN(w) ? ground : Math.max(ground, w * STEP_HEIGHT);
}

/** A block of tiles, x1 and y1 exclusive. */
export interface TileBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const clampCell = (terrain: TerrainGrid, fx: number, fy: number) =>
  Math.min(terrain.height - 1, Math.max(0, Math.floor(fy))) * terrain.width + Math.min(terrain.width - 1, Math.max(0, Math.floor(fx)));

/** Meshes for every tile, or only those inside `bounds` (one render chunk). */
export function buildTerrainMeshes(terrain: TerrainGrid, extras: TerrainExtras = {}, bounds?: TileBounds): TerrainMeshes {
  const { width: W, height: H } = terrain;
  const s = surfaceOf(terrain);
  const meshes: TerrainMeshes = {};
  const b = bounds ?? { x0: 0, y0: 0, x1: W, y1: H };
  const x0 = Math.max(0, b.x0), y0 = Math.max(0, b.y0), x1 = Math.min(W, b.x1), y1 = Math.min(H, b.y1);
  if (x0 >= x1 || y0 >= y1) return meshes;

  const sub = subdivisions(terrain, extras.detail);
  const step = 1 / sub;
  const cols = (x1 - x0) * sub + 1;
  const rows = (y1 - y0) * sub + 1;

  // The ground's height at every vertex of the block, plus a ring around it for the normals at its edge.
  const gc = cols + 2;
  const hgt = new Float32Array(gc * (rows + 2));
  for (let r = -1; r <= rows; r++) {
    for (let c = -1; c <= cols; c++) hgt[(r + 1) * gc + c + 1] = carvedHeight(s, extras.channels, x0 + c * step, y0 + r * step);
  }
  const h = (c: number, r: number) => hgt[(r + 1) * gc + c + 1];

  // One ground mesh sharing its vertices; a vertex is made when a quad first needs it.
  const ground = mesh(meshes, 'ground');
  const made = new Int32Array(cols * rows).fill(-1);
  const at = (c: number, r: number) => {
    const k = r * cols + c;
    if (made[k] < 0) {
      const fx = x0 + c * step;
      const fy = y0 + r * step;
      const dx = (h(c + 1, r) - h(c - 1, r)) / (2 * step);
      const dz = (h(c, r + 1) - h(c, r - 1)) / (2 * step);
      const len = Math.hypot(dx, 1, dz);
      made[k] = vertex(ground, [fx, h(c, r), fy], [-dx / len, 1 / len, -dz / len], [fx / TOP_REPEAT, fy / TOP_REPEAT], clampCell(terrain, fx, fy));
    }
    return made[k];
  };
  const indices: number[] = (ground.indices = []);

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * W + x;
      const wet = isWater(terrain.biomes[i]);
      const level = wet ? s.water[i] : s.shore[i];
      // Ground wholly beneath a water cell's surface is hidden, so it isn't drawn. (A shore cell's
      // sheet covers only its edge by the water, so its ground is always drawn.)
      const hidden = wet ? level * STEP_HEIGHT - 0.01 : -Infinity;

      // Ground: sub × sub quads, each folded along its flatter diagonal.
      for (let b2 = 0; b2 < sub; b2++) {
        for (let a = 0; a < sub; a++) {
          const c = (x - x0) * sub + a;
          const r = (y - y0) * sub + b2;
          const h00 = h(c, r), h10 = h(c + 1, r), h01 = h(c, r + 1), h11 = h(c + 1, r + 1);
          if (Math.max(h00, h10, h01, h11) < hidden) continue;
          const v00 = at(c, r), v10 = at(c + 1, r), v01 = at(c, r + 1), v11 = at(c + 1, r + 1);
          // Counter-clockwise seen from above, so the faces point up.
          if (Math.abs(h00 - h11) <= Math.abs(h10 - h01)) indices.push(v00, v11, v10, v00, v01, v11);
          else indices.push(v00, v01, v10, v10, v01, v11);
        }
      }

      // Water: one flat quad at its surface over water cells and the shore beside them.
      if (!Number.isNaN(level)) addWater(meshes, s, x, y, level, sub);
    }
  }
  if (indices.length === 0) delete meshes.ground;

  if (extras.channels) extras.channels.list.forEach((c, n) => addChannel(meshes, terrain, c, n, x0, y0, x1, y1));
  addSkirt(meshes, s, x0, y0, x1, y1, sub);
  return meshes;
}

/**
 * A river or road's ribbon for the segments whose middle lies in this block:
 * river water at its level (uv: along the flow, across -1..1 for the shader),
 * a road on its levelled bed, and over rivers a stone deck with parapets.
 */
function addChannel(meshes: TerrainMeshes, terrain: TerrainGrid, c: Channel, n: number, x0: number, y0: number, x1: number, y1: number) {
  const last = c.x.length - 1;
  const side = (k: number): [number, number] => {
    const a = Math.max(0, k - 1);
    const b = Math.min(last, k + 1);
    const tx = c.x[b] - c.x[a];
    const ty = c.y[b] - c.y[a];
    const len = Math.hypot(tx, ty) || 1;
    return [-ty / len, tx / len];
  };
  const up: V3 = [0, 1, 0];
  for (let i = 0; i < last; i++) {
    const mx = (c.x[i] + c.x[i + 1]) / 2;
    const my = (c.y[i] + c.y[i + 1]) / 2;
    if (mx < x0 || mx >= x1 || my < y0 || my >= y1) continue;
    const ends = [i, i + 1];
    const tile = clampCell(terrain, mx, my);

    if (c.kind === 'river') {
      const m = mesh(meshes, 'river');
      const pts = ends.map((k) => {
        const [nx, ny] = side(k);
        const h = c.level[k] + RIVER_LIFT;
        const L: V3 = [c.x[k] + nx * c.half[k], h, c.y[k] + ny * c.half[k]];
        const R: V3 = [c.x[k] - nx * c.half[k], h, c.y[k] - ny * c.half[k]];
        return { L, R, u: c.along[k] / 1.2 };
      });
      const v = (p: V3, u: number, across: number) => vertex(m, p, up, [u, across], tile);
      const a = v(pts[0].L, pts[0].u, 1), b = v(pts[0].R, pts[0].u, -1), d = v(pts[1].L, pts[1].u, 1), e = v(pts[1].R, pts[1].u, -1);
      pushUp(m, a, b, d, e);
      continue;
    }

    const bridge = c.bridge[i] || c.bridge[i + 1];
    // Junctions overlap: each road a hair above the last, so they never flicker against each other.
    const lift = ROAD_LIFT + (n % 16) * 0.0006;
    const widen = bridge ? DECK.widen : 1;
    const pts = ends.map((k) => {
      const [nx, ny] = side(k);
      const h = c.level[k] + lift;
      const w = c.half[k] * widen;
      return { L: [c.x[k] + nx * w, h, c.y[k] + ny * w] as V3, R: [c.x[k] - nx * w, h, c.y[k] - ny * w] as V3 };
    });
    const roadUv = (p: V3): [number, number] => [p[0] / (TOP_REPEAT * 0.4), p[2] / (TOP_REPEAT * 0.4)];
    if (!bridge) {
      const top = mesh(meshes, 'road');
      const at = (p: V3) => vertex(top, p, up, roadUv(p), tile);
      pushUp(top, at(pts[0].L), at(pts[0].R), at(pts[1].L), at(pts[1].R));
      continue;
    }

    // A stone deck (its own unindexed mesh), its sides dropping below it, parapets along its edges.
    const stone = mesh(meshes, 'bridge');
    triangle(stone, pts[0].L, pts[0].R, pts[1].R, tile, roadUv);
    triangle(stone, pts[0].L, pts[1].R, pts[1].L, tile, roadUv);
    const sideUv = (p: V3): [number, number] => [(p[0] + p[2]) / 1.5, p[1] / 1.5];
    const [sx, sy] = side(i);
    for (const edge of ['L', 'R'] as const) {
      const [p, q] = [pts[0][edge], pts[1][edge]];
      const out: V3 = edge === 'L' ? [sx, 0, sy] : [-sx, 0, -sy];
      const below = (r: V3): V3 => [r[0], r[1] - DECK.thick, r[2]];
      const above = (r: V3): V3 => [r[0], r[1] + DECK.parapet, r[2]];
      triangle(stone, above(p), above(q), below(q), tile, sideUv, out);
      triangle(stone, above(p), below(q), below(p), tile, sideUv, out);
      // The parapet's top, a thin strip along the edge.
      const inward: V3 = [-out[0] * 0.012, 0, -out[2] * 0.012];
      const pi: V3 = [p[0] + inward[0], p[1] + DECK.parapet, p[2] + inward[2]];
      const qi: V3 = [q[0] + inward[0], q[1] + DECK.parapet, q[2] + inward[2]];
      triangle(stone, above(p), above(q), qi, tile, sideUv);
      triangle(stone, above(p), qi, pi, tile, sideUv);
    }
  }
}

/** Two triangles for a quad with corners a, b (one end, left and right) and d, e (the other end), facing up. */
function pushUp(m: MeshData, a: number, b: number, d: number, e: number) {
  const p = m.positions;
  const y = (k: number) => [p[k * 3], p[k * 3 + 2]];
  // Wind counter-clockwise seen from above, whichever way the ribbon runs.
  const [ax, az] = y(a), [bx, bz] = y(b), [dx, dz] = y(d);
  const cross = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
  const indices = (m.indices ??= []);
  if (cross > 0) indices.push(a, d, b, b, d, e);
  else indices.push(a, b, d, b, e, d);
}

/** How far (tiles) into a shore cell its water sheet reaches from the water beside it. */
const SHORE_REACH = 0.6;

/**
 * One cell's water sheet; the water shader colours it by the depth beneath. A
 * water cell is one quad. A shore cell's sheet only covers the strip nearest
 * the water, where the coastline can fall: beyond that the land may drop away
 * (a lake's outflow side), and a sheet there would hang in the air.
 */
function addWater(meshes: TerrainMeshes, s: Surface, x: number, y: number, level: number, sub: number) {
  const { terrain } = s;
  const m = mesh(meshes, 'water');
  const up: V3 = [0, 1, 0];
  const h = level * STEP_HEIGHT;
  const i = y * terrain.width + x;
  const wet = !Number.isNaN(s.water[i]);
  const parts = wet ? 1 : sub;
  const step = 1 / parts;
  // The neighbouring water this shore takes its level from.
  const near: [number, number][] = [];
  if (!wet) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= terrain.width || ny >= terrain.height) continue;
        if (s.water[ny * terrain.width + nx] === level) near.push([nx, ny]);
      }
    }
  }
  const toWater = (px: number, py: number) =>
    Math.min(...near.map(([nx, ny]) => Math.hypot(Math.max(nx - px, 0, px - nx - 1), Math.max(ny - py, 0, py - ny - 1))));
  const made = new Map<number, number>();
  const corner = (a: number, b: number) => {
    const k = b * (parts + 1) + a;
    let v = made.get(k);
    if (v === undefined) {
      const p: V3 = [x + a * step, h, y + b * step];
      // Fog: each corner takes its own tile, so fog fades across the sheet like the ground's.
      made.set(k, (v = vertex(m, p, up, topUv(p), clampCell(terrain, p[0], p[2]))));
    }
    return v;
  };
  for (let b = 0; b < parts; b++) {
    for (let a = 0; a < parts; a++) {
      if (!wet && toWater(x + (a + 0.5) * step, y + (b + 0.5) * step) > SHORE_REACH) continue;
      const v00 = corner(a, b), v10 = corner(a + 1, b), v01 = corner(a, b + 1), v11 = corner(a + 1, b + 1);
      // Counter-clockwise seen from above.
      (m.indices ??= []).push(v00, v01, v11, v00, v11, v10);
    }
  }
}

/** The plinth: the map's outer edge drops from the ground (and any water over it) to the base. */
function addSkirt(meshes: TerrainMeshes, s: Surface, x0: number, y0: number, x1: number, y1: number, sub: number) {
  const { width: W, height: H } = s.terrain;
  const base = BASE_STEP * STEP_HEIGHT;
  const step = 1 / sub;
  const sides: { on: boolean; along: 'x' | 'z'; at: number; from: number; to: number; out: V3 }[] = [
    { on: y0 === 0, along: 'x', at: 0, from: x0, to: x1, out: [0, 0, -1] },
    { on: y1 === H, along: 'x', at: H, from: x0, to: x1, out: [0, 0, 1] },
    { on: x0 === 0, along: 'z', at: 0, from: y0, to: y1, out: [-1, 0, 0] },
    { on: x1 === W, along: 'z', at: W, from: y0, to: y1, out: [1, 0, 0] },
  ];
  for (const side of sides) {
    if (!side.on) continue;
    const segments = Math.round((side.to - side.from) * sub);
    for (let k = 0; k < segments; k++) {
      const u = side.from + k * step;
      const v = u + step;
      const P = (t: number): [number, number] => (side.along === 'x' ? [t, side.at] : [side.at, t]);
      const [ax, az] = P(u);
      const [bx, bz] = P(v);
      const ga = bedHeight(s, ax, az);
      const gb = bedHeight(s, bx, bz);
      // The tile just inside the edge, for fog.
      const tile = clampCell(s.terrain, Math.min(W - 0.5, (ax + bx) / 2), Math.min(H - 0.5, (az + bz) / 2));
      const sideUv = (p: V3): [number, number] => [(side.along === 'x' ? p[0] : p[2]) / 2, p[1] / (SIDE_REPEAT_STEPS * STEP_HEIGHT)];
      const earth = mesh(meshes, 'earth');
      triangle(earth, [ax, ga, az], [bx, gb, bz], [bx, base, bz], tile, sideUv, side.out);
      triangle(earth, [ax, ga, az], [bx, base, bz], [ax, base, az], tile, sideUv, side.out);
      // Water standing over the edge shows as a dark band above the ground.
      const level = isWater(s.terrain.biomes[tile]) ? s.water[tile] : s.shore[tile];
      if (Number.isNaN(level)) continue;
      const wh = level * STEP_HEIGHT;
      if (wh <= Math.min(ga, gb)) continue;
      const wet = mesh(meshes, 'waterSide');
      const ta = Math.min(ga, wh), tb = Math.min(gb, wh);
      triangle(wet, [ax, wh, az], [bx, wh, bz], [bx, tb, bz], tile, sideUv, side.out);
      triangle(wet, [ax, wh, az], [bx, tb, bz], [ax, ta, az], tile, sideUv, side.out);
    }
  }
}
