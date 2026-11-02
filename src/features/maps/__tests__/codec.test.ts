import { describe, expect, it } from 'vitest';
import {
  countBits,
  createBitset,
  createTerrain,
  decodeBytes,
  decodeTerrain,
  encodeBytes,
  encodeTerrain,
  getBit,
  setBit,
  unionBits,
} from '../terrain/codec';

describe('terrain codec', () => {
  it('round-trips bytes, including large arrays', () => {
    const bytes = new Uint8Array(128 * 128);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31) & 0xff;
    expect(decodeBytes(encodeBytes(bytes))).toEqual(bytes);
  });

  it('round-trips a terrain grid', () => {
    const terrain = createTerrain(5, 3);
    terrain.heights.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    terrain.biomes.fill(4);
    const decoded = decodeTerrain(encodeTerrain(terrain), 5, 3);
    expect(decoded.heights).toEqual(terrain.heights);
    expect(decoded.biomes).toEqual(terrain.biomes);
  });

  it('rejects data of the wrong size', () => {
    const stored = encodeTerrain(createTerrain(4, 4));
    expect(() => decodeTerrain(stored, 5, 5)).toThrow(/Corrupt map data/);
  });
});

describe('bitsets', () => {
  it('sets, clears and counts bits', () => {
    const bits = createBitset(20);
    setBit(bits, 0, true);
    setBit(bits, 9, true);
    setBit(bits, 19, true);
    expect(getBit(bits, 9)).toBe(true);
    expect(getBit(bits, 10)).toBe(false);
    expect(countBits(bits)).toBe(3);
    setBit(bits, 9, false);
    expect(countBits(bits)).toBe(2);
  });

  it('reports whether a union changed anything', () => {
    const a = createBitset(16);
    const b = createBitset(16);
    setBit(b, 3, true);
    expect(unionBits(a, b)).toBe(true);
    expect(unionBits(a, b)).toBe(false);
    expect(getBit(a, 3)).toBe(true);
  });
});
