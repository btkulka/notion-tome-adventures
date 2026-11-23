import { expect, it } from 'vitest';
import { DEFAULT_GEN_PARAMS, generateOverworld } from '../gen/overworld';
import { buildChannels } from '../render/channels';
import { allChunks, chunkBounds } from '../render/chunks';
import { buildTerrainMeshes, triangleCount } from '../render/geometry';
import type { PackedMesh, WorkerReply } from '../render/meshWorker';
import { placePropsInBlocks } from '../render/props';
import { connectionMasks } from '../terrain/roads';

it('builds in the background exactly what building in place builds', async () => {
  const r = generateOverworld({ ...DEFAULT_GEN_PARAMS, seed: 4242, width: 64, height: 64 });
  const paths = [...r.rivers.map((points) => ({ kind: 'river' as const, points })), ...r.roads.map((points) => ({ kind: 'road' as const, points }))];
  const sites = r.settlements.map((s) => ({ x: s.x, y: s.y, pinType: s.pinType }));
  const extras = {
    roads: connectionMasks(r.roads, 64, 64),
    rivers: connectionMasks(r.rivers, 64, 64),
    paved: new Set(sites.map((s) => s.y * 64 + s.x)),
    sites,
    channels: buildChannels(r.terrain, paths),
  };
  // What's sent must survive structured cloning, as postMessage does.
  const sent = structuredClone({ terrain: r.terrain, extras });

  const replies: WorkerReply[] = [];
  const self = { postMessage: (m: WorkerReply) => replies.push(m), onmessage: null as null | ((e: { data: unknown }) => void) };
  (globalThis as unknown as { self: typeof self }).self = self;
  await import('../render/meshWorker');
  const ids = allChunks(64, 64);
  self.onmessage!({ data: { type: 'meshes', job: 1, terrain: sent.terrain, extras: sent.extras, chunks: ids } });
  self.onmessage!({ data: { type: 'props', job: 2, terrain: sent.terrain, seed: 7, options: sent.extras, chunks: ids } });

  const meshes = replies[0];
  expect(meshes.type).toBe('meshes');
  if (meshes.type !== 'meshes') return;
  const ground = meshes.chunks[0].meshes.find((m: PackedMesh) => m.key === 'ground')!;
  expect(ground.positions).toBeInstanceOf(Float32Array);
  expect(ground.indices).toBeInstanceOf(Uint32Array);
  expect(ground.indices!.length / 3).toBe(triangleCount(buildTerrainMeshes(r.terrain, extras, chunkBounds(ids[0])).ground));

  const props = replies[1];
  expect(props.type).toBe('props');
  if (props.type !== 'props') return;
  expect(JSON.stringify(props.placed)).toBe(JSON.stringify(placePropsInBlocks(r.terrain, 7, extras, ids.map(chunkBounds))));
});
