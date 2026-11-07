export type FogMode = 'dm' | 'player';

/**
 * How a tile's fog fade tints its vertices. Players see ink closing in (unknown
 * ground keeps only its silhouette); the DM sees the same gradient as a violet veil.
 */
export function fogTint(fade: number, mode: FogMode, out: number[] | Float32Array, offset = 0): void {
  if (mode === 'player') {
    const k = fade >= 0.999 ? 0.07 : 1 - fade * 0.95;
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
