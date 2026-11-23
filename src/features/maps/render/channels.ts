/**
 * Rivers and roads as smooth curves over the grid, cut into the ground. The
 * paths stay what the rules read (cell by cell, for travel and sight); this is
 * how they're drawn.
 *
 * Each path's cells become control points: smoothed a little where they're
 * free, pushed by a smooth noise field so they meander, and joined by a
 * Catmull-Rom curve sampled a few times per tile. Points two paths share
 * (junctions, a tributary's mouth) aren't smoothed and are pushed by the same
 * field, so the curves meet; town squares aren't pushed at all, so roads run
 * into the middle of town.
 *
 * Rivers widen downstream and where tributaries join, and their water only ever
 * runs downhill: each sample sits a little below its banks and never above the
 * one upstream. The ground is carved into a bed with sloping banks. Roads level
 * the ground across their width, and where one crosses a river it rides a deck
 * above the water instead (a bridge).
 *
 * Pure and deterministic, so every client draws the same, and testable without WebGL.
 */
import { createNoise2D } from 'simplex-noise';
import { mulberry32 } from '../gen/prng';
import type { TerrainGrid, TilePoint } from '../types';
import { surfaceOf, topHeight } from './surface';

export type ChannelKind = 'river' | 'road';

export interface ChannelPath {
  kind: ChannelKind;
  points: TilePoint[];
}

/** One river or road, sampled along its curve. */
export interface Channel {
  kind: ChannelKind;
  x: number[];
  y: number[];
  /** Half the width, in tiles. */
  half: number[];
  /** World height: a river's water surface, a road's bed. */
  level: number[];
  /** Tiles along the curve from its start. */
  along: number[];
  /** Road samples that cross a river, on a bridge deck. */
  bridge: boolean[];
}

export interface Channels {
  width: number;
  height: number;
  list: Channel[];
  /** Segment refs (channel × 65536 + segment) whose reach touches each cell. */
  cells: Map<number, number[]>;
  /** Per cell, a code that changes when anything drawn or carved there changes (render chunks diff it). */
  signature: Uint8Array;
}

/** Curve samples per tile. */
const SAMPLES_PER_TILE = 4;
/** How far (tiles) the noise field pushes a control point. */
const MEANDER: Record<ChannelKind, number> = { river: 0.22, road: 0.08 };
/** A river's half width from the cells of river upstream of a point. */
export const riverHalf = (flowCells: number) => Math.min(0.32, 0.06 + 0.014 * Math.sqrt(flowCells));
export const ROAD_HALF = 0.075;
/** World height a river's water sits below its banks. */
const RIVER_SINK = 0.1;
/** World depth of a river's bed below its water, at its middle. */
const riverDepth = (half: number) => 0.05 + half * 0.4;
/** Tiles of sloping bank beyond a river's water. */
const riverBank = (half: number) => 0.18 + half * 0.8;
/** Tiles beyond a road's edge over which the levelled ground meets the land. */
const ROAD_SHOULDER = 0.12;
/** How far (world) a road may cut into or build up the ground to stay level. */
const ROAD_GRADE = 0.15;
/** World height a bridge deck clears the water by. */
export const BRIDGE_CLEARANCE = 0.1;
/** World height a road may climb per tile toward a bridge. */
const RAMP = 0.12;

const noise = createNoise2D(mulberry32(0x91f3));
const wander = (x: number, y: number): [number, number] => [noise(x * 0.45 + 3.3, y * 0.45 - 8.1), noise(x * 0.45 - 6.7, y * 0.45 + 2.9)];

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Consecutive repeats dropped. */
function distinct(points: TilePoint[]): TilePoint[] {
  const out: TilePoint[] = [];
  for (const p of points) if (!out.length || out[out.length - 1][0] !== p[0] || out[out.length - 1][1] !== p[1]) out.push(p);
  return out;
}

/** Control points for a path's cells: smoothed where free, pushed by the meander field unless still. */
function controlPoints(cells: TilePoint[], kind: ChannelKind, shared: Set<number>, still: ReadonlySet<number>, W: number): [number, number][] {
  let pts = cells.map(([x, y]) => [x + 0.5, y + 0.5] as [number, number]);
  const fixed = cells.map(([x, y], k) => k === 0 || k === cells.length - 1 || shared.has(y * W + x) || still.has(y * W + x));
  for (let pass = 0; pass < 2; pass++) {
    pts = pts.map((p, k) => (fixed[k] ? p : [p[0] * 0.5 + (pts[k - 1][0] + pts[k + 1][0]) * 0.25, p[1] * 0.5 + (pts[k - 1][1] + pts[k + 1][1]) * 0.25]));
  }
  const amp = MEANDER[kind];
  return pts.map((p, k) => {
    const [cx, cy] = cells[k];
    if (still.has(cy * W + cx)) return p;
    const [ox, oy] = wander(cx + 0.5, cy + 0.5);
    return [p[0] + ox * amp, p[1] + oy * amp];
  });
}

/** Catmull-Rom samples through control points, each with the control index it came from (fractional). */
function sampleCurve(pts: [number, number][]): { x: number[]; y: number[]; at: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  const at: number[] = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const m = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * SAMPLES_PER_TILE));
    for (let j = 0; j < m; j++) {
      const t = j / m;
      const t2 = t * t;
      const t3 = t2 * t;
      const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      x.push(cr(p0[0], p1[0], p2[0], p3[0]));
      y.push(cr(p0[1], p1[1], p2[1], p3[1]));
      at.push(i + t);
    }
  }
  x.push(pts[n - 1][0]);
  y.push(pts[n - 1][1]);
  at.push(n - 1);
  return { x, y, at };
}

const lengths = (x: number[], y: number[]) => {
  const along = [0];
  for (let i = 1; i < x.length; i++) along.push(along[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]));
  return along;
};

/** Moving average over ±r samples. */
function smooth(values: number[], r: number): number[] {
  return values.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let k = Math.max(0, i - r); k <= Math.min(values.length - 1, i + r); k++) {
      sum += values[k];
      n++;
    }
    return sum / n;
  });
}

/**
 * Curves for a map's rivers and roads. `still` is the cells curves pass through
 * dead centre (town squares).
 */
export function buildChannels(terrain: TerrainGrid, paths: ChannelPath[], still: ReadonlySet<number> = new Set()): Channels {
  const { width: W, height: H } = terrain;
  const s = surfaceOf(terrain);
  const list: Channel[] = [];

  for (const kind of ['river', 'road'] as const) {
    // Cells each kind's paths share: junctions and mouths, where curves must meet.
    let ofKind = paths.filter((p) => p.kind === kind).map((p) => distinct(p.points)).filter((c) => c.length >= 2);
    if (kind === 'river') {
      // Rivers run downhill: flip any drawn upstream.
      ofKind = ofKind.map((c) => {
        const a = c[0];
        const b = c[c.length - 1];
        return topHeight(s, a[0] + 0.5, a[1] + 0.5) < topHeight(s, b[0] + 0.5, b[1] + 0.5) ? [...c].reverse() : c;
      });
    }
    const count = new Map<number, number>();
    for (const c of ofKind) for (const k of new Set(c.map(([x, y]) => y * W + x))) count.set(k, (count.get(k) ?? 0) + 1);
    const shared = new Set([...count].filter(([, n]) => n > 1).map(([k]) => k));

    // Rivers: cells of river upstream of each point, tributaries included.
    const flowAt: ((k: number) => number)[] = [];
    if (kind === 'river') {
      const index = ofKind.map((c) => new Map(c.map(([x, y], k) => [y * W + x, k] as [number, number])));
      const inflow = ofKind.map(() => [] as [number, number][]);
      const memo = new Map<number, number>();
      const endFlow = (a: number, seen: Set<number>): number => {
        if (memo.has(a)) return memo.get(a)!;
        if (seen.has(a)) return ofKind[a].length;
        seen.add(a);
        const total = ofKind[a].length + inflow[a].reduce((sum, [, b]) => sum + endFlow(b, seen), 0);
        memo.set(a, total);
        return total;
      };
      ofKind.forEach((c, a) => {
        const [ex, ey] = c[c.length - 1];
        const mouth = ey * W + ex;
        ofKind.forEach((_, b) => {
          if (b !== a && index[b].has(mouth) && index[b].get(mouth)! < ofKind[b].length - 1) inflow[b].push([index[b].get(mouth)!, a]);
        });
      });
      ofKind.forEach((_, b) => {
        const joins = inflow[b].map(([k, a]) => [k, endFlow(a, new Set())] as [number, number]);
        flowAt[b] = (k: number) => k + 1 + joins.reduce((sum, [at, f]) => sum + (at <= k ? f : 0), 0);
      });
    }

    ofKind.forEach((cells, n) => {
      const curve = sampleCurve(controlPoints(cells, kind, shared, still, W));
      const along = lengths(curve.x, curve.y);
      const bank = curve.x.map((x, i) => topHeight(s, x, curve.y[i]));
      let half: number[];
      let level: number[];
      if (kind === 'river') {
        half = curve.at.map((t) => {
          const k = Math.floor(t);
          const f = t - k;
          return riverHalf(flowAt[n](k) * (1 - f) + flowAt[n](Math.min(cells.length - 1, k + 1)) * f);
        });
        level = [];
        for (let i = 0; i < bank.length; i++) level.push(Math.min(i ? level[i - 1] : Infinity, bank[i] - RIVER_SINK));
      } else {
        half = curve.x.map(() => ROAD_HALF);
        level = smooth(smooth(bank, 4), 4);
      }
      list.push({ kind, x: curve.x, y: curve.y, half, level, along, bridge: curve.x.map(() => false) });
    });
  }

  const ch: Channels = { width: W, height: H, list, cells: new Map(), signature: new Uint8Array(W * H) };
  index(ch);

  // A tributary's water drops to meet the river it joins, the last stretch ramping down to it.
  for (const c of list) {
    if (c.kind !== 'river') continue;
    const end = c.x.length - 1;
    const into = nearest(ch, 'river', c.x[end], c.y[end], c);
    if (!into || into.d > 0.05) continue;
    c.level[end] = Math.min(c.level[end], into.level);
    for (let i = end - 1; i >= 0; i--) c.level[i] = Math.min(c.level[i], c.level[i + 1] + 0.05 * (c.along[i + 1] - c.along[i]));
  }

  // Bridges: road samples over a river's water ride a deck above it; the road ramps up to meet it.
  for (const c of list) {
    if (c.kind !== 'road') continue;
    let any = false;
    for (let i = 0; i < c.x.length; i++) {
      const r = nearest(ch, 'river', c.x[i], c.y[i]);
      if (r && r.d < r.half + 0.06) {
        c.bridge[i] = true;
        c.level[i] = Math.max(c.level[i], r.level + BRIDGE_CLEARANCE);
        any = true;
      }
    }
    if (!any) continue;
    for (let i = 1; i < c.x.length; i++) c.level[i] = Math.max(c.level[i], c.level[i - 1] - RAMP * (c.along[i] - c.along[i - 1]));
    for (let i = c.x.length - 2; i >= 0; i--) c.level[i] = Math.max(c.level[i], c.level[i + 1] - RAMP * (c.along[i + 1] - c.along[i]));
  }

  // What's drawn in each cell, for the render chunks to diff.
  for (const [cell, refs] of ch.cells) {
    let code = 0;
    for (const ref of refs) {
      const c = list[Math.floor(ref / 65536)];
      const i = ref % 65536;
      code = (code * 31 + Math.round(c.half[i] * 997) + Math.round(c.level[i] * 1009) + (c.bridge[i] ? 7 : 0) + c.x.length) % 251;
    }
    ch.signature[cell] = code + 1;
  }
  return ch;
}

/** How far from its middle a channel's carving and drawing reach, in tiles. */
const reachOf = (c: Channel, i: number) => (c.kind === 'river' ? c.half[i] + riverBank(c.half[i]) : c.half[i] + ROAD_SHOULDER) + 0.05;

/** Files every segment under each cell its reach touches. */
function index(ch: Channels): void {
  ch.cells.clear();
  ch.list.forEach((c, n) => {
    for (let i = 0; i + 1 < c.x.length; i++) {
      const r = Math.max(reachOf(c, i), reachOf(c, i + 1));
      const x0 = Math.max(0, Math.floor(Math.min(c.x[i], c.x[i + 1]) - r));
      const x1 = Math.min(ch.width - 1, Math.floor(Math.max(c.x[i], c.x[i + 1]) + r));
      const y0 = Math.max(0, Math.floor(Math.min(c.y[i], c.y[i + 1]) - r));
      const y1 = Math.min(ch.height - 1, Math.floor(Math.max(c.y[i], c.y[i + 1]) + r));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const k = y * ch.width + x;
          let refs = ch.cells.get(k);
          if (!refs) ch.cells.set(k, (refs = []));
          refs.push(n * 65536 + i);
        }
      }
    }
  });
}

export interface Nearest {
  channel: Channel;
  /** Distance from the curve, in tiles. */
  d: number;
  half: number;
  level: number;
  along: number;
  bridge: boolean;
}

/** The nearest point on any channel of a kind whose reach covers (fx, fy), skipping `except`. */
export function nearest(ch: Channels | undefined, kind: ChannelKind, fx: number, fy: number, except?: Channel): Nearest | null {
  if (!ch) return null;
  const refs = ch.cells.get(Math.floor(fy) * ch.width + Math.floor(fx));
  if (!refs) return null;
  let best: Nearest | null = null;
  for (const ref of refs) {
    const c = ch.list[Math.floor(ref / 65536)];
    if (c.kind !== kind || c === except) continue;
    const i = ref % 65536;
    const ax = c.x[i], ay = c.y[i], bx = c.x[i + 1], by = c.y[i + 1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((fx - ax) * dx + (fy - ay) * dy) / len2)) : 0;
    const d = Math.hypot(fx - (ax + dx * t), fy - (ay + dy * t));
    if (best && d >= best.d) continue;
    best = {
      channel: c,
      d,
      half: c.half[i] + (c.half[i + 1] - c.half[i]) * t,
      level: c.level[i] + (c.level[i + 1] - c.level[i]) * t,
      along: c.along[i] + (c.along[i + 1] - c.along[i]) * t,
      bridge: t < 0.5 ? c.bridge[i] : c.bridge[i + 1],
    };
  }
  return best;
}

/** The ground at (fx, fy), world height `ground`, with river beds cut into it and roads levelled across it. */
export function carve(ch: Channels | undefined, fx: number, fy: number, ground: number): number {
  if (!ch || !ch.cells.has(Math.floor(fy) * ch.width + Math.floor(fx))) return ground;
  let h = ground;
  const r = nearest(ch, 'river', fx, fy);
  if (r) {
    const reach = r.half + riverBank(r.half);
    if (r.d < reach) {
      // A rounded bed under the water, then banks rising back to the land.
      const bed = r.d < r.half ? r.level - riverDepth(r.half) * (1 - (r.d / r.half) ** 2) : r.level - 0.01;
      const w = smoothstep(r.half * 0.9, reach, r.d);
      h = Math.min(h, bed + (ground - bed) * w);
    }
  }
  const q = nearest(ch, 'road', fx, fy);
  if (q && !q.bridge && q.d < q.half + ROAD_SHOULDER) {
    const target = Math.max(ground - ROAD_GRADE, Math.min(ground + ROAD_GRADE, q.level));
    const w = 1 - smoothstep(q.half, q.half + ROAD_SHOULDER, q.d);
    h += (target - h) * w;
  }
  return h;
}
