/**
 * The noise and fraying the ground shader blends cells through (overlay.ts
 * FRAY_GLSL), in TypeScript, so what's placed on the ground follows the same
 * edges the textures draw. The hash is float32-safe (no sine), and the maths
 * runs in float32 here, so CPU and GPU agree to within rounding.
 */

const f = Math.fround;
const fract = (v: number) => f(v - Math.floor(v));

/** How far either side of a cell edge (in cells) two looks blend: the shader's smoothstep(0.5 - BLEND, 0.5 + BLEND). */
export const BLEND = 0.24;

/** A 0..1 hash of a lattice point (Dave Hoskins' hash12, as in FRAY_GLSL). */
export function tomeHash(px: number, py: number): number {
  let x = fract(f(px * f(0.1031)));
  let y = fract(f(py * f(0.1031)));
  let z = fract(f(px * f(0.1031)));
  const k = f(33.33);
  const d = f(f(f(x * f(y + k)) + f(y * f(z + k))) + f(z * f(x + k)));
  x = f(x + d);
  y = f(y + d);
  z = f(z + d);
  return fract(f(f(x + y) * z));
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth value noise, about -1..1. */
export function tomeNoise(px: number, py: number): number {
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const fx = px - ix;
  const fy = py - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = mix(tomeHash(ix, iy), tomeHash(ix + 1, iy), ux);
  const b = mix(tomeHash(ix, iy + 1), tomeHash(ix + 1, iy + 1), ux);
  return mix(a, b, uy) * 2 - 1;
}

/** Where the cells are read from for the point (x, y): pushed by two octaves of noise. */
export function tomeFray(x: number, y: number): [number, number] {
  return [
    x + tomeNoise(x * 0.7 + 31.7, y * 0.7 - 12.3) * 0.36 + tomeNoise(x * 2.3 - 4.1, y * 2.3 + 9.4) * 0.09,
    y + tomeNoise(x * 0.7 - 17.9, y * 0.7 + 44.1) * 0.36 + tomeNoise(x * 2.3 + 7.3, y * 2.3 - 2.6) * 0.09,
  ];
}

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The four cells whose looks the ground shader blends at (x, y), with their
 * weights (summing to 1), clamped to the map.
 */
export function blendAt(width: number, height: number, x: number, y: number): { cells: [number, number, number, number]; weights: [number, number, number, number] } {
  const [qx, qy] = tomeFray(x, y);
  const cx = qx - 0.5;
  const cy = qy - 0.5;
  const ix = Math.floor(cx);
  const iy = Math.floor(cy);
  const sx = smoothstep(0.5 - BLEND, 0.5 + BLEND, cx - ix);
  const sy = smoothstep(0.5 - BLEND, 0.5 + BLEND, cy - iy);
  const cell = (dx: number, dy: number) =>
    Math.min(height - 1, Math.max(0, iy + dy)) * width + Math.min(width - 1, Math.max(0, ix + dx));
  return {
    cells: [cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)],
    weights: [(1 - sx) * (1 - sy), sx * (1 - sy), (1 - sx) * sy, sx * sy],
  };
}
