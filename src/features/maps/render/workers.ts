/**
 * A small pool of background builders (meshWorker.ts) for the map's heavy work:
 * terrain meshes and prop placements. A big job (loading a map, regenerating
 * it) is split across the pool and comes back in parts, each handed to the
 * caller as it lands, so the map fills in without the page ever freezing.
 * Without workers (an old browser, or one refusing to start), the caller
 * falls back to building in place.
 */
import type { TerrainGrid } from '../types';
import type { TerrainExtras } from './geometry';
import type { PackedMesh, WorkerReply, WorkerRequest } from './meshWorker';
import type { PropOptions, PropPlacements } from './props';

/** Edits touching this many chunks or fewer build in place: instant, and too small to stall. */
export const IN_PLACE_CHUNKS = 4;

let pool: Worker[] | null | undefined;
let nextJob = 1;
const waiting = new Map<number, { onPart: (reply: WorkerReply) => void; left: number }>();

function workers(): Worker[] | null {
  if (pool !== undefined) return pool;
  try {
    if (typeof Worker === 'undefined') return (pool = null);
    // One fewer than the cores, two to three of them: the main thread keeps a core to draw with.
    const size = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 4) - 1));
    pool = Array.from({ length: size }, () => {
      const w = new Worker(new URL('./meshWorker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (event: MessageEvent<WorkerReply>) => {
        const reply = event.data;
        const entry = waiting.get(reply.job);
        if (!entry) return;
        if (--entry.left <= 0) waiting.delete(reply.job);
        entry.onPart(reply);
      };
      // A builder that fails outright (a script error while loading) never replies: switch the pool off
      // and hand every job still waiting back to its caller, which builds it in place.
      w.onerror = (event) => {
        console.warn('Tome: background builder failed, building in place from now on:', event.message);
        pool?.forEach((other) => other.terminate());
        pool = null;
        const stuck = [...waiting.entries()];
        waiting.clear();
        for (const [job, entry] of stuck) entry.onPart({ type: 'error', job, message: event.message || 'worker failed' });
      };
      return w;
    });
  } catch {
    pool = null;
  }
  return pool;
}

/** Whether background building is available here. */
export const canBuildInBackground = () => workers() !== null;

/** Deals ids round-robin into one share per worker, so each gets a mix of busy and empty chunks. */
function shares<T>(ids: T[], n: number): T[][] {
  const out: T[][] = Array.from({ length: n }, () => []);
  ids.forEach((id, k) => out[k % n].push(id));
  return out.filter((s) => s.length);
}

function send(build: (job: number, chunks: number[]) => WorkerRequest, ids: number[], onPart: (reply: WorkerReply) => void): () => void {
  const pool = workers();
  if (!pool) return () => {};
  const parts = shares(ids, pool.length);
  const job = nextJob++;
  waiting.set(job, { onPart, left: parts.length });
  parts.forEach((chunks, n) => pool[n].postMessage(build(job, chunks)));
  // Cancelling drops the replies; the workers finish their share regardless.
  return () => waiting.delete(job);
}

/** Terrain meshes for these chunks, in the background; `onChunks` gets each part as it lands. */
export function buildMeshesInBackground(
  terrain: TerrainGrid,
  extras: TerrainExtras,
  ids: number[],
  onChunks: (chunks: { id: number; meshes: PackedMesh[] }[]) => void,
  onError: (message: string) => void
): () => void {
  return send((job, chunks) => ({ type: 'meshes', job, terrain, extras, chunks }), ids, (reply) => {
    if (reply.type === 'meshes') onChunks(reply.chunks);
    else if (reply.type === 'error') onError(reply.message);
  });
}

/** Prop placements for these chunks, in the background; `onPlaced` gets each part as it lands. */
export function placePropsInBackground(
  terrain: TerrainGrid,
  seed: number,
  options: PropOptions,
  ids: number[],
  onPlaced: (chunks: number[], placed: PropPlacements[]) => void,
  onError: (message: string) => void
): () => void {
  return send((job, chunks) => ({ type: 'props', job, terrain, seed, options, chunks }), ids, (reply) => {
    if (reply.type === 'props') onPlaced(reply.chunks, reply.placed);
    else if (reply.type === 'error') onError(reply.message);
  });
}
