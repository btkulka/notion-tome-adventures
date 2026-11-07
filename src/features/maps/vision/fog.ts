/**
 * Fading fog of war. Instead of a hard edge between seen and unseen ground,
 * every tile gets a fade from 0 (in plain sight) to 1 (unknown):
 *
 * - visible tiles are clear, dimming slightly at the rim of the party's sight;
 * - explored tiles the party remembers sit at a constant half fade;
 * - unexplored tiles darken with distance from anything seen, so the known
 *   world dissolves into the dark over a few tiles instead of stopping dead.
 *
 * Renderers draw a tile with fade 1 as unknown ground and darken the rest by
 * their fade. Pins are a separate matter: hidden ones never reach players.
 */
import { getBit } from '../terrain/codec';

export const FOG_REMEMBERED = 0.5;

/** How many tiles the unexplored dark takes to close in completely. */
export const FOG_FADE_TILES = 3;

/** Fade on the outermost ring of visible tiles, and the next ring in. */
const RIM_FADE = [0.22, 0.08];

/**
 * Chamfer distance (orthogonal 1, diagonal √2) from every tile to the nearest
 * tile where `isSource` holds. Two passes, so it's linear in the map size.
 */
export function distanceTo(width: number, height: number, isSource: (i: number) => boolean): Float32Array {
  const dist = new Float32Array(width * height);
  for (let i = 0; i < dist.length; i++) dist[i] = isSource(i) ? 0 : Infinity;
  const relax = (i: number, x: number, y: number, dx: number, dy: number, cost: number) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
    const candidate = dist[ny * width + nx] + cost;
    if (candidate < dist[i]) dist[i] = candidate;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      relax(i, x, y, -1, 0, 1);
      relax(i, x, y, 0, -1, 1);
      relax(i, x, y, -1, -1, Math.SQRT2);
      relax(i, x, y, 1, -1, Math.SQRT2);
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      relax(i, x, y, 1, 0, 1);
      relax(i, x, y, 0, 1, 1);
      relax(i, x, y, 1, 1, Math.SQRT2);
      relax(i, x, y, -1, 1, Math.SQRT2);
    }
  }
  return dist;
}

/**
 * Per-tile fade (0..1).
 * @param visible one byte per tile, 1 where the party can see now (see `computeVisibility`)
 * @param explored bitset of tiles the party has seen before (`map_fog.explored`)
 */
export function fogFade(width: number, height: number, visible: Uint8Array, explored: Uint8Array): Float32Array {
  const size = width * height;
  const seen = (i: number) => visible[i] === 1 || getBit(explored, i);
  const toSeen = distanceTo(width, height, seen);
  const toUnseen = distanceTo(width, height, (i) => visible[i] !== 1);
  const fade = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    if (visible[i] === 1) {
      // toUnseen is 1 on the outermost visible ring (or √2 on its corners).
      const ring = Math.round(toUnseen[i]) - 1;
      fade[i] = ring >= 0 && ring < RIM_FADE.length && Number.isFinite(toUnseen[i]) ? RIM_FADE[ring] : 0;
    } else if (getBit(explored, i)) {
      fade[i] = FOG_REMEMBERED;
    } else if (!Number.isFinite(toSeen[i])) {
      fade[i] = 1;
    } else {
      fade[i] = Math.min(1, FOG_REMEMBERED + (1 - FOG_REMEMBERED) * (toSeen[i] / FOG_FADE_TILES));
    }
  }
  return fade;
}

/** Fade as bytes (0 clear … 255 unknown), ready for a fog DataTexture. */
export function fogTexels(fade: Float32Array): Uint8Array {
  const out = new Uint8Array(fade.length);
  for (let i = 0; i < fade.length; i++) out[i] = Math.round(Math.min(1, Math.max(0, fade[i])) * 255);
  return out;
}
