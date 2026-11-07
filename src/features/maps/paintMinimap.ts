import { MAX_STEP } from './constants';
import { BIOMES, type BiomeId } from './terrain/biomes';
import type { TerrainGrid } from './types';

/**
 * Paints a region top-down, one pixel per tile: biome colour, shaded by height
 * and lit from the north-west.
 */
export function paintMinimap(canvas: HTMLCanvasElement, terrain: TerrainGrid, fade?: Float32Array | null) {
  const { width: W, height: H, heights, biomes } = terrain;
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const hex = BIOMES[biomes[i] as BiomeId]?.top ?? '#555555';
      const up = y > 0 ? heights[i - W] : heights[i];
      const left = x > 0 ? heights[i - 1] : heights[i];
      const light = 1 + (heights[i] - (up + left) / 2) * 0.08 + (heights[i] / MAX_STEP) * 0.15;
      const dim = fade ? 1 - fade[i] * 0.9 : 1;
      const k = Math.max(0.3, Math.min(1.35, light)) * dim;
      img.data[i * 4] = Math.min(255, parseInt(hex.slice(1, 3), 16) * k);
      img.data[i * 4 + 1] = Math.min(255, parseInt(hex.slice(3, 5), 16) * k);
      img.data[i * 4 + 2] = Math.min(255, parseInt(hex.slice(5, 7), 16) * k);
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
