import { describe, expect, it } from 'vitest';
import { DEFAULT_GEN_PARAMS, generateOverworld } from '../gen/overworld';
import { pinName, regionName, riverName } from '../gen/names';
import { mulberry32 } from '../gen/prng';
import { describePath, describeTile, regionNameIndex, type InspectContext } from '../inspect';
import { Biome } from '../terrain/biomes';
import { createTerrain } from '../terrain/codec';
import { labelRegions, labelSpot, regionKind, regionTiles } from '../terrain/regions';
import type { LabelObject, PathObject, PinObject } from '../types';

function grid(rows: string[]) {
  const key: Record<string, number> = { '.': Biome.Grassland, F: Biome.Forest, M: Biome.Mountain, S: Biome.Snow, '~': Biome.Ocean, s: Biome.Shallows };
  const t = createTerrain(rows[0].length, rows.length);
  rows.forEach((row, y) => [...row].forEach((c, x) => (t.biomes[y * t.width + x] = key[c])));
  t.heights.fill(6);
  return t;
}

const base = { mapId: 'm', z: 0, rot: 0, hidden: false };
const pin = (id: string, x: number, y: number, name: string): PinObject => ({
  ...base, id, type: 'pin', x, y, data: { pinType: 'village', name, notionLocationId: null, childMapId: null, autoReveal: true },
});
const road = (id: string, points: [number, number][], name?: string): PathObject => ({ ...base, id, type: 'path', x: points[0][0], y: points[0][1], data: { kind: 'road', points, name } });
const label = (id: string, x: number, y: number, text: string, hidden = false): LabelObject => ({ ...base, id, type: 'label', x, y, hidden, data: { text, size: 1 } });

describe('regions', () => {
  it('splits the map into connected stretches of one biome', () => {
    const t = grid(['FF..', 'FF..', '...F']);
    const r = labelRegions(t);
    expect(r.regions).toHaveLength(3);
    expect(r.ids[0]).toBe(r.ids[5]);
    expect(r.ids[0]).not.toBe(r.ids[11]); // the second wood doesn't touch the first
    expect(regionTiles(r, r.ids[11])).toEqual([11]);
    expect(r.regions[r.ids[2]].size).toBe(7);
  });

  it('keeps snowcaps part of their range and shallows part of their sea', () => {
    const t = grid(['MMSM', 'MSSM', '~~s~']);
    const r = labelRegions(t);
    expect(r.regions).toHaveLength(2);
    const range = r.regions[r.ids[0]];
    expect(range.biome).toBe(Biome.Mountain);
    expect(regionKind(range)).toBe('Mountains');
  });

  it('puts a label deep inside its region', () => {
    const t = grid(['.......', '.FFFFF.', '.FFFFF.', '.FFFFF.', '.......']);
    const r = labelRegions(t);
    const spot = labelSpot(r, r.ids[1 * 7 + 1]);
    expect([spot % 7, Math.floor(spot / 7)]).toEqual([3, 2]);
  });
});

describe('names', () => {
  it('names regions, rivers and places without repeating', () => {
    const rand = mulberry32(7);
    const taken = new Set<string>();
    const names = [
      ...Array.from({ length: 20 }, () => regionName(Biome.Forest, rand, taken)),
      ...Array.from({ length: 10 }, () => riverName(rand, taken)),
      ...Array.from({ length: 10 }, () => pinName('ruin', rand, taken)),
    ];
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((n) => n.length > 3)).toBe(true);
  });

  it('gives a generated region named rivers and named regions', () => {
    const region = generateOverworld({ ...DEFAULT_GEN_PARAMS, seed: 99 });
    expect(region.riverNames).toHaveLength(region.rivers.length);
    expect(region.labels.length).toBeGreaterThan(0);
    const regions = labelRegions(region.terrain);
    const named = new Set(region.labels.map((l) => regions.ids[l.y * region.terrain.width + l.x]));
    expect(named.size).toBe(region.labels.length); // one name per region
  });
});

describe('describeTile', () => {
  const t = grid(['FFF..', 'FFF..', '.....']);
  const regions = labelRegions(t);
  const ctx = (labels: LabelObject[], extra: Partial<InspectContext> = {}): InspectContext => ({
    terrain: t, scale: 1, regions, regionNames: regionNameIndex(regions, labels),
    pins: [pin('a', 0, 2, 'Ashford'), pin('b', 4, 2, 'Kelmere')],
    paths: [road('r', [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]])],
    ...extra,
  });

  it('titles a tile with its region name and kind', () => {
    const info = describeTile(ctx([label('l', 1, 1, 'the Gloamwood')]), [2, 0]);
    expect(info.title).toBe('the Gloamwood');
    expect(info.subtitle).toBe('Forest · 6.0 sq mi');
    expect(info.rows.find((r) => r.label === 'Ground')?.value).toBe('Forest · half pace');
  });

  it('falls back to the kind of land, and names a road by the places it joins', () => {
    const info = describeTile(ctx([]), [2, 2]);
    expect(info.title).toBe('Grassland');
    const row = info.rows.find((r) => r.tone === 'road');
    expect(row?.value).toBe('Road from Ashford to Kelmere · 4.0 mi');
    expect(info.rows.find((r) => r.label === 'Ground')?.value).toContain('full pace on the road');
  });

  it('keeps hidden names and unknown ground from players', () => {
    const hidden = describeTile(ctx([label('l', 1, 1, 'the Gloamwood', true)], { forPlayers: true }), [0, 0]);
    expect(hidden.title).toBe('Forest');
    const unknown = describeTile(ctx([], { forPlayers: true, fog: () => 'unknown' }), [0, 0]);
    expect(unknown.title).toBe('Unknown lands');
  });

  it('uses a road name when it has one', () => {
    expect(describePath(road('r', [[0, 2], [1, 3]], "the King's Road"), [], 2).name).toBe("the King's Road");
    expect(describePath(road('r', [[0, 2], [1, 3]]), [], 2).detail).toBe('2.8 mi');
  });
});
