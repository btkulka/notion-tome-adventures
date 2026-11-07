/**
 * Render chunks. The terrain and its props are built per block of tiles, and
 * an edit rebuilds only the blocks it can reach: a tile's slope and walls read
 * its neighbours' corners (two tiles out), and props read the same ground.
 */
import type { TileBounds } from './geometry';

/** Tiles per chunk side. */
export const CHUNK = 16;

/** How far a changed tile reaches into its neighbours' geometry and props. */
export const CHUNK_REACH = 2;

export const chunkId = (cx: number, cy: number) => cy * 4096 + cx;

export function chunkBounds(id: number): TileBounds {
  const cx = id % 4096;
  const cy = Math.floor(id / 4096);
  return { x0: cx * CHUNK, y0: cy * CHUNK, x1: (cx + 1) * CHUNK, y1: (cy + 1) * CHUNK };
}

export function allChunks(width: number, height: number): number[] {
  const ids: number[] = [];
  for (let cy = 0; cy * CHUNK < height; cy++) for (let cx = 0; cx * CHUNK < width; cx++) ids.push(chunkId(cx, cy));
  return ids;
}

/** Chunks touched by any changed tile, each reaching `reach` tiles out. */
export function dirtyChunks(changed: Iterable<number>, width: number, height: number, reach = CHUNK_REACH): Set<number> {
  const out = new Set<number>();
  const maxCx = Math.floor((width - 1) / CHUNK);
  const maxCy = Math.floor((height - 1) / CHUNK);
  for (const i of changed) {
    const x = i % width;
    const y = Math.floor(i / width);
    const cx0 = Math.max(0, Math.floor((x - reach) / CHUNK));
    const cx1 = Math.min(maxCx, Math.floor((x + reach) / CHUNK));
    const cy0 = Math.max(0, Math.floor((y - reach) / CHUNK));
    const cy1 = Math.min(maxCy, Math.floor((y + reach) / CHUNK));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) out.add(chunkId(cx, cy));
  }
  return out;
}

/** Tile indices where any pair of per-tile layers differs. */
export function changedTiles(pairs: [ArrayLike<number>, ArrayLike<number>][], size: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    for (const [a, b] of pairs) {
      if (a[i] !== b[i]) {
        out.push(i);
        break;
      }
    }
  }
  return out;
}
