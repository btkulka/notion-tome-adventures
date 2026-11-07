import { useMemo } from 'react';
import { createBitset, decodeBytes } from './terrain/codec';
import { isNight } from './travel/travel';
import type { TerrainGrid, TilePoint, Weather } from './types';
import { fogFade } from './vision/fog';
import { computeVisibility } from './vision/overworld';

export function exploredBits(terrain: TerrainGrid, stored: string | null): Uint8Array {
  const size = terrain.width * terrain.height;
  if (!stored) return createBitset(size);
  const bits = decodeBytes(stored);
  return bits.length === Math.ceil(size / 8) ? bits : createBitset(size);
}

/**
 * Per-tile fade for a map: what the party sees from where it stands (if it's on
 * this map), on top of what it has explored before.
 */
export function useFog(
  terrain: TerrainGrid | null,
  explored: Uint8Array | null,
  party: TilePoint | null,
  worldMinutes: number,
  weather: Weather
): { fade: Float32Array | null; visible: Uint8Array | null } {
  return useMemo(() => {
    if (!terrain || !explored) return { fade: null, visible: null };
    const visible = party
      ? computeVisibility(terrain, party, { night: isNight(worldMinutes), weather })
      : new Uint8Array(terrain.width * terrain.height);
    return { fade: fogFade(terrain.width, terrain.height, visible, explored), visible };
  }, [terrain, explored, party, worldMinutes, weather]);
}
