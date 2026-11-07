/**
 * Words for what's on a tile: the region and its name, the ground, the roads
 * and rivers through it, any place standing there. Feeds the map's hover
 * tooltip and the editor's inspector.
 */
import { SEA_STEP } from './constants';
import { BIOMES, type BiomeId } from './terrain/biomes';
import { regionKind, type RegionMap } from './terrain/regions';
import type { LabelObject, PathObject, PinObject, TerrainGrid, TilePoint } from './types';

export type FogState = 'visible' | 'remembered' | 'unknown';

export interface TileInfoRow {
  label: string;
  value: string;
  tone?: 'road' | 'river' | 'pin' | 'muted';
}

export interface TileInfo {
  /** The region's name, or what kind of land it is. */
  title: string;
  /** Under a name: the kind of land and its size. */
  subtitle: string | null;
  rows: TileInfoRow[];
}

export interface InspectContext {
  terrain: TerrainGrid;
  /** Miles per tile. */
  scale: number;
  regions: RegionMap;
  /** Region id → the label naming it. */
  regionNames: Map<number, LabelObject>;
  pins: PinObject[];
  paths: PathObject[];
  fog?: (tile: number) => FogState;
  forPlayers?: boolean;
}

/** Which label names which region: the first label standing on a region's ground. */
export function regionNameIndex(regions: RegionMap, labels: LabelObject[]): Map<number, LabelObject> {
  const out = new Map<number, LabelObject>();
  for (const label of labels) {
    const x = Math.floor(label.x);
    const y = Math.floor(label.y);
    if (x < 0 || y < 0 || x >= regions.width || y >= regions.height) continue;
    const id = regions.ids[y * regions.width + x];
    if (!out.has(id)) out.set(id, label);
  }
  return out;
}

export const sameTile = (a: TilePoint, b: TilePoint) => a[0] === b[0] && a[1] === b[1];

export function pathsThrough(paths: PathObject[], tile: TilePoint): PathObject[] {
  return paths.filter((p) => p.data.points.some((q) => sameTile(q, tile)));
}

export function pinsAt(pins: PinObject[], tile: TilePoint): PinObject[] {
  return pins.filter((p) => Math.floor(p.x) === tile[0] && Math.floor(p.y) === tile[1]);
}

/** Length in miles; diagonal steps count √2. */
export function pathMiles(path: PathObject, scale: number): number {
  let tiles = 0;
  const pts = path.data.points;
  for (let i = 1; i < pts.length; i++) tiles += pts[i][0] !== pts[i - 1][0] && pts[i][1] !== pts[i - 1][1] ? Math.SQRT2 : 1;
  return tiles * scale;
}

export const formatMiles = (miles: number) => `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;

/** The place (if any) at or beside one end of a path. */
function placeNear(pins: PinObject[], [x, y]: TilePoint): PinObject | undefined {
  return pins.find((p) => Math.abs(Math.floor(p.x) - x) <= 1 && Math.abs(Math.floor(p.y) - y) <= 1);
}

export function describePath(path: PathObject, pins: PinObject[], scale: number): { name: string; detail: string } {
  const pts = path.data.points;
  const miles = formatMiles(pathMiles(path, scale));
  const a = pts.length ? placeNear(pins, pts[0]) : undefined;
  const b = pts.length > 1 ? placeNear(pins, pts[pts.length - 1]) : undefined;
  const ends = a && b && a.id !== b.id ? `${a.data.name} to ${b.data.name}` : a || b ? `by ${(a ?? b)!.data.name}` : null;
  if (path.data.name) return { name: path.data.name, detail: ends ? `${miles} · ${ends}` : miles };
  if (path.data.kind === 'road') {
    const name = a && b && a.id !== b.id ? `Road from ${a.data.name} to ${b.data.name}` : a || b ? `Road to ${(a ?? b)!.data.name}` : 'Unnamed road';
    return { name, detail: miles };
  }
  return { name: 'Unnamed river', detail: ends ? `${miles} · ${ends}` : miles };
}

const PACE: [number, string][] = [[1, 'Full pace'], [0.5, 'Half pace'], [0.25, 'Quarter pace']];

export function describeTile(ctx: InspectContext, tile: TilePoint): TileInfo {
  const { terrain, regions } = ctx;
  const i = tile[1] * terrain.width + tile[0];
  const fog = ctx.fog?.(i);
  if (ctx.forPlayers && fog === 'unknown') return { title: 'Unknown lands', subtitle: null, rows: [] };

  const biome = BIOMES[terrain.biomes[i] as BiomeId];
  const region = regions.regions[regions.ids[i]];
  const label = region ? ctx.regionNames.get(region.id) : undefined;
  const named = label && !(ctx.forPlayers && label.hidden) ? label.data.text : null;
  const area = region ? region.size * ctx.scale * ctx.scale : 0;
  const kind = region ? regionKind(region) : biome.name;
  const rows: TileInfoRow[] = [];

  for (const pin of pinsAt(ctx.pins, tile)) {
    if (ctx.forPlayers && pin.hidden) continue;
    rows.push({ label: pin.data.pinType, value: pin.data.name + (pin.hidden ? ' (hidden)' : ''), tone: 'pin' });
  }
  const through = pathsThrough(ctx.paths, tile);
  for (const path of through) {
    if (ctx.forPlayers && path.hidden) continue;
    const { name, detail } = describePath(path, ctx.pins, ctx.scale);
    rows.push({ label: path.data.kind, value: `${name} · ${detail}`, tone: path.data.kind });
  }

  if (biome.water) rows.push({ label: 'Ground', value: `${biome.name} · impassable on foot` });
  else {
    const onRoad = through.some((p) => p.data.kind === 'road' && !(ctx.forPlayers && p.hidden));
    const pace = PACE.find(([k]) => biome.travelMultiplier >= k)?.[1] ?? 'Slow going';
    rows.push({ label: 'Ground', value: `${biome.name} · ${onRoad ? 'full pace on the road' : pace.toLowerCase()}` });
    rows.push({ label: 'Height', value: `${terrain.heights[i] - SEA_STEP} steps above the sea`, tone: 'muted' });
  }
  if (!ctx.forPlayers && fog) {
    rows.push({ label: 'Players', value: fog === 'visible' ? 'In sight of the company' : fog === 'remembered' ? 'Explored' : 'Unexplored', tone: 'muted' });
  }

  const size = region && region.size > 1 ? `${area < 10 ? area.toFixed(1) : Math.round(area)} sq mi` : null;
  return {
    title: named ?? kind,
    subtitle: named ? [kind, size].filter(Boolean).join(' · ') : size,
    rows,
  };
}
