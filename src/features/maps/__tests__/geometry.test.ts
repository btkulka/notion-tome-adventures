import { describe, expect, it } from 'vitest';
import { SEA_STEP, STEP_HEIGHT } from '../constants';
import { BASE_STEP, buildTerrainMeshes, groundHeight, subdivisions, triangleCount, type MeshData } from '../render/geometry';
import { buildChannels } from '../render/channels';
import { cellLayers, layerIndex } from '../render/layers';
import { bedHeight, surfaceOf } from '../render/surface';
import { Biome } from '../terrain/biomes';
import { createTerrain } from '../terrain/codec';
import type { TilePoint } from '../types';

function flat(width: number, height: number, step = 6) {
  const t = createTerrain(width, height);
  t.biomes.fill(Biome.Grassland);
  t.heights.fill(step);
  return t;
}

const triangles = (m?: MeshData) => triangleCount(m);
const allUp = (m: MeshData) => {
  for (let i = 1; i < m.normals.length; i += 3) if (m.normals[i] <= 0) return false;
  return true;
};
const ys = (m: MeshData) => m.positions.filter((_, i) => i % 3 === 1);

describe('terrain geometry', () => {
  it('covers every tile with one ground mesh of small upward-facing quads', () => {
    const t = flat(3, 2);
    const sub = subdivisions(t);
    const meshes = buildTerrainMeshes(t);
    expect(triangles(meshes.ground)).toBe(3 * 2 * sub * sub * 2);
    // Neighbouring quads share their corners.
    expect(meshes.ground!.tiles.length).toBe((3 * sub + 1) * (2 * sub + 1));
    expect(allUp(meshes.ground!)).toBe(true);
  });

  it('drops the map edge on all four sides to the base', () => {
    const t = flat(2, 2);
    const sub = subdivisions(t);
    const meshes = buildTerrainMeshes(t);
    // 8 outer cell edges, sub segments each, 2 triangles a segment; nothing inland.
    expect(triangles(meshes.earth)).toBe(8 * sub * 2);
    expect(Math.min(...ys(meshes.earth!))).toBeCloseTo(BASE_STEP * STEP_HEIGHT);
  });

  it('rises smoothly to higher ground, with no walls between cells', () => {
    const t = flat(6, 1);
    t.heights[4] = t.heights[5] = 9;
    let prev = groundHeight(t, 0.5, 0.5);
    for (let x = 0.55; x <= 5.5; x += 0.05) {
      const h = groundHeight(t, x, 0.5);
      expect(Math.abs(h - prev)).toBeLessThan(0.12);
      prev = h;
    }
    expect(groundHeight(t, 5.5, 0.5) - groundHeight(t, 0.5, 0.5)).toBeGreaterThan(2 * STEP_HEIGHT);
  });

  it('draws fine elevation where the map has it, between the steps', () => {
    const t = flat(5, 5);
    t.elevation = new Uint16Array(25).fill(6 * 256 + 128); // six and a half steps
    expect(groundHeight(t, 2.5, 2.5)).toBeGreaterThan(6.2 * STEP_HEIGHT);
    expect(groundHeight(t, 2.5, 2.5)).toBeLessThan(6.8 * STEP_HEIGHT);
  });

  it('lays water as one flat sheet that the shore rises through, with a dark band on the map edge', () => {
    const t = flat(6, 1, SEA_STEP + 1);
    for (const i of [0, 1, 2]) {
      t.biomes[i] = Biome.Ocean;
      t.heights[i] = SEA_STEP;
    }
    const meshes = buildTerrainMeshes(t);
    // A quad over each of the three sea cells, and the strip of the shore cell nearest them (0.6 of a tile).
    const sub = subdivisions(t);
    const strip = Array.from({ length: sub }, (_, a) => (a + 0.5) / sub).filter((d) => d <= 0.6).length;
    expect(triangles(meshes.water)).toBe(3 * 2 + strip * sub * 2);
    for (const y of ys(meshes.water!)) expect(y).toBeCloseTo(SEA_STEP * STEP_HEIGHT);
    const s = surfaceOf(t);
    expect(bedHeight(s, 0.5, 0.5)).toBeLessThan(SEA_STEP * STEP_HEIGHT);
    expect(bedHeight(s, 5.5, 0.5)).toBeGreaterThan(SEA_STEP * STEP_HEIGHT);
    // Pins on the water sit on its surface, not the sea bed.
    expect(groundHeight(t, 0.5, 0.5)).toBeCloseTo(SEA_STEP * STEP_HEIGHT);
    expect(triangles(meshes.waterSide)).toBeGreaterThan(0);
  });

  it('leaves out ground hidden under deep water', () => {
    const t = flat(12, 1, SEA_STEP + 1);
    for (let i = 0; i < 9; i++) {
      t.biomes[i] = Biome.Ocean;
      t.heights[i] = SEA_STEP;
    }
    const sub = subdivisions(t);
    expect(triangles(buildTerrainMeshes(t).ground)).toBeLessThan(12 * sub * sub * 2);
  });

  it('draws rivers and roads as ribbons over their carved ground, and a bridge where they cross', () => {
    const t = flat(20, 20);
    const river: TilePoint[] = Array.from({ length: 18 }, (_, k) => [1 + k, 10] as TilePoint);
    const road: TilePoint[] = Array.from({ length: 18 }, (_, k) => [10, 1 + k] as TilePoint);
    const channels = buildChannels(t, [{ kind: 'river', points: river }, { kind: 'road', points: road }]);
    const meshes = buildTerrainMeshes(t, { channels });
    expect(triangles(meshes.river)).toBeGreaterThan(0);
    expect(triangles(meshes.road)).toBeGreaterThan(0);
    expect(triangles(meshes.bridge)).toBeGreaterThan(0);
    const p = meshes.road!.positions;
    for (let v = 0; v < p.length; v += 3) expect(p[v + 1]).toBeGreaterThan(groundHeight(t, p[v], p[v + 2], channels));
    // The water sits in its bed, below the land either side.
    const w = meshes.river!.positions;
    for (let v = 0; v < w.length; v += 3) expect(w[v + 1]).toBeLessThan(groundHeight(t, w[v], 4.5));
  });

  it('tags every vertex with its tile', () => {
    const meshes = buildTerrainMeshes(flat(2, 2));
    expect(new Set(meshes.ground!.tiles)).toEqual(new Set([0, 1, 2, 3]));
    expect(meshes.ground!.tiles.length * 3).toBe(meshes.ground!.positions.length);
  });
});

describe('ground layers', () => {
  it('gives each land cell its biome look and town squares cobbles', () => {
    const t = flat(3, 1);
    t.biomes[1] = Biome.Forest;
    t.biomes[2] = Biome.Jungle;
    const layers = cellLayers(t, new Set([0]));
    expect([...layers]).toEqual([layerIndex('cobble'), layerIndex('forest'), layerIndex('forest')]);
  });

  it('gives a water cell the look of the land beside it, and open water sand', () => {
    const t = flat(4, 1);
    t.biomes[0] = Biome.Snow;
    t.biomes[1] = Biome.Ocean;
    t.biomes[2] = Biome.Ocean;
    t.biomes[3] = Biome.Ocean;
    const layers = cellLayers(t);
    expect(layers[1]).toBe(layerIndex('snow'));
    expect(layers[3]).toBe(layerIndex('beach'));
  });
});
