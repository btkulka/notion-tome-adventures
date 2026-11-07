import { describe, expect, it } from 'vitest';
import { SEA_STEP } from '../constants';
import { DEFAULT_GEN_PARAMS, generateOverworld, PICKABLE_BIOMES } from '../gen/overworld';
import { Biome, isWater } from '../terrain/biomes';
import type { OverworldGenParams } from '../types';

const params = (overrides: Partial<OverworldGenParams> = {}): OverworldGenParams => ({
  ...DEFAULT_GEN_PARAMS,
  seed: 12345,
  ...overrides,
});

describe('generateOverworld', () => {
  it('is deterministic for a seed', () => {
    const a = generateOverworld(params());
    const b = generateOverworld(params());
    expect(a.terrain.heights).toEqual(b.terrain.heights);
    expect(a.terrain.biomes).toEqual(b.terrain.biomes);
    expect(a.rivers).toEqual(b.rivers);
    expect(a.roads).toEqual(b.roads);
    expect(a.settlements).toEqual(b.settlements);
  });

  it('produces a different region for a different seed', () => {
    const a = generateOverworld(params({ seed: 1 }));
    const b = generateOverworld(params({ seed: 2 }));
    expect(a.terrain.heights).not.toEqual(b.terrain.heights);
  });

  it('roughly honours the continent water fraction', () => {
    const { terrain } = generateOverworld(params());
    let ocean = 0;
    for (const b of terrain.biomes) if (b === Biome.Ocean || b === Biome.Shallows) ocean++;
    const fraction = ocean / terrain.biomes.length;
    expect(fraction).toBeGreaterThan(0.25);
    expect(fraction).toBeLessThan(0.45);
  });

  it('has no sea on a landlocked map', () => {
    const { terrain } = generateOverworld(params({ landShape: 'landlocked' }));
    expect(terrain.biomes.some((b) => b === Biome.Ocean || b === Biome.Shallows)).toBe(false);
  });

  it('keeps every height in range and the sea flat', () => {
    const { terrain } = generateOverworld(params({ seed: 99, mountains: 1 }));
    for (let i = 0; i < terrain.heights.length; i++) {
      const b = terrain.biomes[i];
      if (b === Biome.Ocean || b === Biome.Shallows) expect(terrain.heights[i]).toBe(SEA_STEP);
      else if (b !== Biome.Lake) expect(terrain.heights[i]).toBeGreaterThan(SEA_STEP);
    }
  });

  it('keeps land to gentle steps so it renders as slopes, with cliffs only in the mountains', () => {
    const { terrain } = generateOverworld(params({ seed: 5, mountains: 1 }));
    const { width: W, height: H, heights, biomes } = terrain;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (isWater(biomes[i])) continue;
        const allowed = biomes[i] === Biome.Mountain || biomes[i] === Biome.Snow ? 2 : 1;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const j = (y + dy) * W + x + dx;
          if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H) continue;
          expect(heights[i] - heights[j]).toBeLessThanOrEqual(allowed);
        }
      }
    }
  });

  it('puts shallows only along the coast', () => {
    const { terrain } = generateOverworld(params());
    const { width: W, height: H, biomes } = terrain;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (biomes[y * W + x] !== Biome.Shallows) continue;
        const touchesLand = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(
          ([dx, dy]) => !isWater(biomes[(y + dy) * W + x + dx]) || biomes[(y + dy) * W + x + dx] === Biome.Lake
        );
        expect(touchesLand).toBe(true);
      }
    }
  });

  it('runs every river downhill to water, the map edge, or another river', () => {
    for (const seed of [3, 17, 42, 1001]) {
      const { terrain, rivers } = generateOverworld(params({ seed }));
      const { width: W, height: H } = terrain;
      expect(rivers.length).toBeGreaterThan(0);
      const riverTiles = new Set<number>();
      for (const river of rivers) {
        for (let i = 1; i < river.length; i++) {
          const [ax, ay] = river[i - 1];
          const [bx, by] = river[i];
          expect(Math.max(Math.abs(ax - bx), Math.abs(ay - by))).toBe(1);
        }
        const [ex, ey] = river[river.length - 1];
        const end = ey * W + ex;
        const endsWell =
          isWater(terrain.biomes[end]) || ex === 0 || ey === 0 || ex === W - 1 || ey === H - 1 || riverTiles.has(end);
        expect(endsWell).toBe(true);
        for (const [x, y] of river) riverTiles.add(y * W + x);
      }
    }
  });

  it('places settlements on dry land and connects them by road over land', () => {
    const { terrain, settlements, roads } = generateOverworld(params({ seed: 7, landShape: 'landlocked' }));
    const { width: W } = terrain;
    expect(settlements.length).toBeGreaterThan(3);
    expect(settlements.length).toBeLessThanOrEqual(DEFAULT_GEN_PARAMS.settlements);
    for (const s of settlements) expect(isWater(terrain.biomes[s.y * W + s.x])).toBe(false);
    expect(new Set(settlements.map((s) => s.name)).size).toBe(settlements.length);
    expect(settlements.filter((s) => s.pinType === 'city').length).toBe(1);

    // A landlocked map is one landmass (lakes aside), so the tree should usually be complete.
    expect(roads.length).toBeGreaterThan(0);
    for (const road of roads) for (const [x, y] of road) expect(isWater(terrain.biomes[y * W + x])).toBe(false);
  });

  it('skips settlements and roads when asked', () => {
    const result = generateOverworld(params({ settlements: 0, roads: false, rivers: 0 }));
    expect(result.settlements).toEqual([]);
    expect(result.roads).toEqual([]);
    expect(result.rivers).toEqual([]);
  });
});

describe('picking biomes', () => {
  const landBiomes = (biomes: Uint8Array) => new Set([...biomes].filter((b) => !isWater(b)));

  it('treats every biome picked the same as no pick', () => {
    const a = generateOverworld(params());
    const b = generateOverworld(params({ biomes: [...PICKABLE_BIOMES] }));
    expect(b.terrain.biomes).toEqual(a.terrain.biomes);
    expect(b.settlements).toEqual(a.settlements);
  });

  it('uses only the picked biomes, and every picked lowland biome gets land', () => {
    const picked = [Biome.Desert, Biome.Jungle, Biome.Mountain];
    // A temperate climate would naturally make neither desert nor jungle.
    const { terrain, settlements } = generateOverworld(params({ biomes: picked, temperature: 0.4, mountains: 0.6 }));
    const used = landBiomes(terrain.biomes);
    for (const b of used) expect(picked).toContain(b);
    expect(used.has(Biome.Desert)).toBe(true);
    expect(used.has(Biome.Jungle)).toBe(true);
    expect(settlements.length).toBeGreaterThan(0);
  });

  it('still settles a frozen region of snow and taiga', () => {
    const { terrain, settlements } = generateOverworld(params({ biomes: [Biome.Snow, Biome.Taiga] }));
    for (const b of landBiomes(terrain.biomes)) expect([Biome.Snow, Biome.Taiga]).toContain(b);
    expect(settlements.length).toBeGreaterThan(0);
  });

  it('leaves the coast unsanded when beaches are off', () => {
    const { terrain } = generateOverworld(params({ biomes: PICKABLE_BIOMES.filter((b) => b !== Biome.Beach) }));
    expect(terrain.biomes.includes(Biome.Beach)).toBe(false);
  });
});
