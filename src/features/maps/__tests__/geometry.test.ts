import { describe, expect, it } from 'vitest';
import { STEP_HEIGHT } from '../constants';
import { buildTerrainMeshes, groundHeight, type MeshData } from '../render/geometry';
import { connectionMasks } from '../terrain/roads';
import { Biome } from '../terrain/biomes';
import { createTerrain } from '../terrain/codec';

function flat(width: number, height: number, step = 6) {
  const t = createTerrain(width, height);
  t.biomes.fill(Biome.Grassland);
  t.heights.fill(step);
  return t;
}

const triangles = (m?: MeshData) => (m ? m.positions.length / 9 : 0);
const allUp = (m: MeshData) => {
  for (let i = 1; i < m.normals.length; i += 3) if (m.normals[i] <= 0) return false;
  return true;
};

describe('terrain geometry', () => {
  it('gives every tile two top triangles facing up', () => {
    const meshes = buildTerrainMeshes(flat(3, 2));
    expect(triangles(meshes.grass)).toBe(12);
    expect(allUp(meshes.grass!)).toBe(true);
  });

  it('walls the map edge on all four sides down to the base', () => {
    const meshes = buildTerrainMeshes(flat(2, 2));
    // 8 outer edges × 2 triangles; no interior walls on flat ground.
    expect(triangles(meshes.earth)).toBe(16);
    const ys = meshes.earth!.positions.filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBeCloseTo(STEP_HEIGHT);
  });

  it('turns a one-step rise into a slope and a bigger one into a cliff', () => {
    const t = flat(3, 1);
    t.heights[2] = 7; // one step up at the east end
    const slope = buildTerrainMeshes(t);
    // The middle tile ramps up to meet the raised tile, so no wall between them.
    expect(groundHeight(t, 1.99, 0.5)).toBeCloseTo(7 * STEP_HEIGHT, 1);
    expect(groundHeight(t, 1.01, 0.5)).toBeCloseTo(6 * STEP_HEIGHT, 1);

    const u = flat(3, 1);
    u.heights[2] = 9;
    const cliff = buildTerrainMeshes(u);
    expect(triangles(cliff.cliff)).toBeGreaterThan(0);
    expect(triangles(slope.cliff)).toBe(0);
  });

  it('keeps water flat with dark side faces', () => {
    const t = flat(2, 1);
    t.biomes[0] = Biome.Ocean;
    t.heights[0] = 4;
    const meshes = buildTerrainMeshes(t);
    expect(triangles(meshes.ocean)).toBe(2);
    expect(triangles(meshes.waterSide)).toBeGreaterThan(0);
  });

  it('lays road pieces on the surface and paves town squares instead', () => {
    const t = flat(3, 1);
    const roads = connectionMasks([[[0, 0], [1, 0], [2, 0]]], 3, 1);
    const meshes = buildTerrainMeshes(t, { roads, paved: new Set([2]) });
    expect(triangles(meshes.road)).toBeGreaterThan(0);
    expect(triangles(meshes.cobble)).toBe(2);
    const roadYs = meshes.road!.positions.filter((_, i) => i % 3 === 1);
    expect(Math.min(...roadYs)).toBeGreaterThan(6 * STEP_HEIGHT);
  });

  it('tags every vertex with its tile', () => {
    const meshes = buildTerrainMeshes(flat(2, 2));
    expect(new Set(meshes.grass!.tiles)).toEqual(new Set([0, 1, 2, 3]));
    expect(meshes.grass!.tiles.length * 3).toBe(meshes.grass!.positions.length);
  });
});
