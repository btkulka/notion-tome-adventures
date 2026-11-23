/// <reference lib="webworker" />
/**
 * The map's background builder (workers.ts runs a few): terrain meshes and prop
 * placements for blocks of chunks, off the main thread so loading a map or
 * regenerating it never freezes the page. Everything it calls is plain
 * TypeScript (no three.js); meshes go back as typed arrays, transferred.
 */
import type { TerrainGrid } from '../types';
import { chunkBounds } from './chunks';
import { buildTerrainMeshes, type MeshData, type TerrainExtras } from './geometry';
import { placePropsInBlocks, type PropOptions } from './props';

export interface PackedMesh {
  key: string;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  tiles: Uint32Array;
  indices?: Uint32Array;
}

export type WorkerRequest =
  | { type: 'meshes'; job: number; terrain: TerrainGrid; extras: TerrainExtras; chunks: number[] }
  | { type: 'props'; job: number; terrain: TerrainGrid; seed: number; options: PropOptions; chunks: number[] };

export type WorkerReply =
  | { type: 'meshes'; job: number; chunks: { id: number; meshes: PackedMesh[] }[] }
  | { type: 'props'; job: number; chunks: number[]; placed: ReturnType<typeof placePropsInBlocks> }
  | { type: 'error'; job: number; message: string };

function pack(key: string, m: MeshData): PackedMesh {
  return {
    key,
    positions: new Float32Array(m.positions),
    normals: new Float32Array(m.normals),
    uvs: new Float32Array(m.uvs),
    tiles: new Uint32Array(m.tiles),
    indices: m.indices ? new Uint32Array(m.indices) : undefined,
  };
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === 'meshes') {
      const transfer: ArrayBuffer[] = [];
      const chunks = msg.chunks.map((id) => {
        const built = buildTerrainMeshes(msg.terrain, msg.extras, chunkBounds(id));
        const meshes = Object.entries(built).map(([key, data]) => {
          const p = pack(key, data!);
          transfer.push(p.positions.buffer as ArrayBuffer, p.normals.buffer as ArrayBuffer, p.uvs.buffer as ArrayBuffer, p.tiles.buffer as ArrayBuffer);
          if (p.indices) transfer.push(p.indices.buffer as ArrayBuffer);
          return p;
        });
        return { id, meshes };
      });
      (self as unknown as Worker).postMessage({ type: 'meshes', job: msg.job, chunks } satisfies WorkerReply, transfer);
    } else {
      const placed = placePropsInBlocks(msg.terrain, msg.seed, msg.options, msg.chunks.map(chunkBounds));
      (self as unknown as Worker).postMessage({ type: 'props', job: msg.job, chunks: msg.chunks, placed } satisfies WorkerReply);
    }
  } catch (err) {
    (self as unknown as Worker).postMessage({ type: 'error', job: msg.job, message: err instanceof Error ? err.message : String(err) } satisfies WorkerReply);
  }
};
