import { describe, expect, it } from 'vitest';
import { STEP_HEIGHT } from '../constants';
import { DEFAULT_GEN_PARAMS, generateOverworld } from '../gen/overworld';
import { MODEL_NAMES } from '../render/catalog';
import { allChunks, chunkBounds } from '../render/chunks';
import { modelForSite, placeProps, placePropsInBlocks, type PropPlacements } from '../render/props';
import { Biome, isWater } from '../terrain/biomes';
import { connectionMasks } from '../terrain/roads';
import type { TerrainGrid } from '../types';

const SEED = 4242;
const region = generateOverworld({ ...DEFAULT_GEN_PARAMS, seed: SEED, mountains: 0.8 });
const { width: W, height: H } = region.terrain;
const roads = connectionMasks(region.roads, W, H);
const rivers = connectionMasks(region.rivers, W, H);
const sites = region.settlements.map((s) => ({ x: s.x, y: s.y, pinType: s.pinType }));
const placements = placeProps(region.terrain, SEED, { roads, rivers, sites });

const all = (p: PropPlacements) => Object.entries(p).flatMap(([name, items]) => items!.map((item) => ({ name, ...item })));

describe('placeProps', () => {
  it('uses only models in the catalog', () => {
    for (const name of Object.keys(placements)) expect(MODEL_NAMES).toContain(name);
  });

  it('is deterministic', () => {
    expect(placeProps(region.terrain, SEED, { roads, rivers, sites })).toEqual(placements);
  });

  it('places the same props chunk by chunk as for the whole map', () => {
    const ids = allChunks(W, H);
    const parts = placePropsInBlocks(region.terrain, SEED, { roads, rivers, sites }, ids.map(chunkBounds));
    const key = (p: { name: string; x: number; y: number }) => `${p.name}@${p.x.toFixed(4)},${p.y.toFixed(4)}`;
    const chunked = parts.flatMap(all).map(key).sort();
    expect(chunked).toEqual(all(placements).map(key).sort());
  });

  it('dresses the land: trees, rocks, a settlement per pin, some landmarks', () => {
    const names = Object.keys(placements);
    expect(names.some((n) => n.startsWith('oak-') || n.startsWith('fir-'))).toBe(true);
    const settled = all(placements).filter((p) => /^(village|town|city|castle)-/.test(p.name));
    expect(settled.length).toBe(sites.length);
    expect(names.some((n) => /^(stones|ruin|bones|elfspire|temple|monolith|dwarfgate)-/.test(n))).toBe(true);
  });

  it('keeps props off water and rivers, and only roadside stones on roads', () => {
    const settledTiles = new Set(sites.map((s) => s.y * W + s.x));
    for (const p of all(placements)) {
      expect(isWater(region.terrain.biomes[p.tile])).toBe(false);
      if (settledTiles.has(p.tile)) continue;
      expect(rivers[p.tile], `${p.name} on a river`).toBe(0);
      if (roads[p.tile]) expect(['waystone-1', 'shrine-1']).toContain(p.name);
    }
  });

  it('turns roadside stones to face the road', () => {
    const stones = all(placements).filter((p) => p.name === 'waystone-1' || p.name === 'shrine-1');
    expect(stones.length).toBeGreaterThan(0);
    for (const s of stones) {
      const cx = (s.tile % W) + 0.5 - s.x;
      const cy = Math.floor(s.tile / W) + 0.5 - s.y;
      // The model's front (+Z) turned by `rotation` about +Y points at the tile centre.
      expect(Math.sin(s.rotation) * cx + Math.cos(s.rotation) * cy).toBeGreaterThan(0.3);
    }
  });
});

describe('modelForSite', () => {
  it('builds settlements in the culture of their biome', () => {
    expect(modelForSite('town', Biome.Taiga, 0)).toBe('town-north');
    expect(modelForSite('city', Biome.Desert, 0)).toBe('city-desert');
    expect(modelForSite('village', Biome.Jungle, 0)).toBe('village-marsh');
    expect(modelForSite('castle', Biome.Hills, 0)).toBe('castle-temperate');
  });

  it('gives other pins their marker, and encounters none', () => {
    expect(modelForSite('tower', Biome.Grassland, 0)).toBe('wizardtower-1');
    expect(modelForSite('cave', Biome.Mountain, 0)).toBe('cave-1');
    expect(['ruin-arch', 'ruin-head']).toContain(modelForSite('ruin', Biome.Desert, 0.7));
    expect(modelForSite('encounter', Biome.Grassland, 0)).toBeNull();
  });
});

describe('dwarven gates', () => {
  // Mountain peaks in a checkerboard with grassland two and a half steps below.
  const board = (): TerrainGrid => {
    const n = 22;
    const heights = new Uint8Array(n * n);
    const biomes = new Uint8Array(n * n);
    for (let i = 0; i < n * n; i++) {
      const peak = ((i % n) + Math.floor(i / n)) % 2 === 0;
      heights[i] = peak ? 13 : 10;
      biomes[i] = peak ? Biome.Mountain : Biome.Grassland;
    }
    return { width: n, height: n, heights, biomes };
  };

  it('stand on the low side of a cliff with their backs against it', () => {
    const terrain = board();
    let gates = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const g of placeProps(terrain, seed)['dwarfgate-1'] ?? []) {
        gates++;
        const tx = g.tile % terrain.width;
        const ty = Math.floor(g.tile / terrain.width);
        expect(terrain.biomes[g.tile]).toBe(Biome.Grassland);
        // The back (-Z turned by rotation) points at a taller neighbour.
        const bx = Math.round(-Math.sin(g.rotation));
        const by = Math.round(-Math.cos(g.rotation));
        const peak = (ty + by) * terrain.width + tx + bx;
        expect((terrain.heights[peak] - terrain.heights[g.tile]) * STEP_HEIGHT).toBeGreaterThan(0.55);
        // ...and sits 0.12 short of the edge between them.
        expect(Math.abs(g.x - (tx + 0.5 + bx * 0.38)) + Math.abs(g.y - (ty + 0.5 + by * 0.38))).toBeLessThan(1e-9);
      }
    }
    expect(gates).toBeGreaterThan(0);
  });
});
