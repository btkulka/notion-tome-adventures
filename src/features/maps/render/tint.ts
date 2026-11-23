import { FOG_REMEMBERED } from '../vision/fog';

export type FogMode = 'dm' | 'player';

/**
 * How a tile's fog fade tints its vertices. Players see the dark closing in: unknown
 * ground is black, and the band before it is under rolling mist (clouds.ts); the DM
 * sees the same gradient as a violet veil.
 */
export function fogTint(fade: number, mode: FogMode, out: number[] | Float32Array, offset = 0): void {
  if (mode === 'player') {
    // Seen and remembered ground darkens with its fade; past the remembered half it closes to black.
    const edge = Math.min(1, Math.max(0, (fade - FOG_REMEMBERED) / (1 - FOG_REMEMBERED)));
    const k = fade <= FOG_REMEMBERED ? 1 - fade * 0.95 : (1 - FOG_REMEMBERED * 0.95) * (1 - edge * edge * (3 - 2 * edge));
    out[offset] = k;
    out[offset + 1] = k;
    out[offset + 2] = k;
    return;
  }
  const a = fade * 0.5;
  out[offset] = 1 - a * 0.45;
  out[offset + 1] = 1 - a * 0.55;
  out[offset + 2] = 1 - a * 0.2;
}
