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

/** 16-bit values as little-endian bytes, whatever the platform's own order. */
function wordsToBytes(words: Uint16Array): Uint8Array {
  const bytes = new Uint8Array(words.length * 2);
  for (let i = 0; i < words.length; i++) {
    bytes[i * 2] = words[i] & 0xff;
    bytes[i * 2 + 1] = words[i] >> 8;
  }
  return bytes;
}

function bytesToWords(bytes: Uint8Array): Uint16Array {
  const words = new Uint16Array(bytes.length >> 1);
  for (let i = 0; i < words.length; i++) words[i] = bytes[i * 2] | (bytes[i * 2 + 1] << 8);
  return words;
}

export function encodeTerrain(terrain: TerrainGrid): StoredTerrain {
  const stored: StoredTerrain = {
    heights: encodeBytes(terrain.heights),
    biomes: encodeBytes(terrain.biomes),
  };
  if (terrain.elevation) stored.elevation = encodeBytes(wordsToBytes(terrain.elevation));
  return stored;
}

export function decodeTerrain(stored: StoredTerrain, width: number, height: number): TerrainGrid {
  const size = width * height;
  const terrain: TerrainGrid = {
    width,
    height,
    heights: decodeBytes(stored.heights, size),
    biomes: decodeBytes(stored.biomes, size),
  };
  if (stored.elevation) terrain.elevation = bytesToWords(decodeBytes(stored.elevation, size * 2));
  return terrain;
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
  const copy: TerrainGrid = {
    width: terrain.width,
    height: terrain.height,
    heights: terrain.heights.slice(),
    biomes: terrain.biomes.slice(),
  };
  if (terrain.elevation) copy.elevation = terrain.elevation.slice();
  return copy;
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
