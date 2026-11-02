import type { TerrainGrid, StoredTerrain } from '../types';

/** Base64-encodes bytes. Chunked so large arrays don't overflow the argument limit. */
export function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function decodeBytes(encoded: string, expectedLength?: number): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (expectedLength !== undefined && bytes.length !== expectedLength) {
    throw new Error(`Corrupt map data: expected ${expectedLength} bytes, got ${bytes.length}`);
  }
  return bytes;
}

export function encodeTerrain(terrain: TerrainGrid): StoredTerrain {
  return {
    heights: encodeBytes(terrain.heights),
    biomes: encodeBytes(terrain.biomes),
  };
}

export function decodeTerrain(stored: StoredTerrain, width: number, height: number): TerrainGrid {
  const size = width * height;
  return {
    width,
    height,
    heights: decodeBytes(stored.heights, size),
    biomes: decodeBytes(stored.biomes, size),
  };
}

export function createTerrain(width: number, height: number): TerrainGrid {
  return {
    width,
    height,
    heights: new Uint8Array(width * height),
    biomes: new Uint8Array(width * height),
  };
}

export function cloneTerrain(terrain: TerrainGrid): TerrainGrid {
  return {
    width: terrain.width,
    height: terrain.height,
    heights: terrain.heights.slice(),
    biomes: terrain.biomes.slice(),
  };
}

// --- Bitsets (fog of war) -------------------------------------------------

export function createBitset(size: number): Uint8Array {
  return new Uint8Array(Math.ceil(size / 8));
}

export function getBit(bits: Uint8Array, index: number): boolean {
  return (bits[index >> 3] & (1 << (index & 7))) !== 0;
}

export function setBit(bits: Uint8Array, index: number, value: boolean): void {
  if (value) bits[index >> 3] |= 1 << (index & 7);
  else bits[index >> 3] &= ~(1 << (index & 7));
}

/** ORs `source` into `target`. Returns true if any bit changed. */
export function unionBits(target: Uint8Array, source: Uint8Array): boolean {
  let changed = false;
  for (let i = 0; i < target.length; i++) {
    const next = target[i] | source[i];
    if (next !== target[i]) {
      target[i] = next;
      changed = true;
    }
  }
  return changed;
}

export function countBits(bits: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < bits.length; i++) {
    let b = bits[i];
    while (b) {
      b &= b - 1;
      count++;
    }
  }
  return count;
}
