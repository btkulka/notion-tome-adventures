import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PinType, TerrainGrid } from '../types';
import { farName } from './catalog';
import { allChunks, changedTiles, chunkBounds, chunkId, dirtyChunks } from './chunks';
import { propMaterial, usePropGeometry } from './models';
import { placePropsInBlocks, type Placement, type PropOptions, type PropPlacements } from './props';
import { fogTint, type FogMode } from './tint';

/** Below this zoom (pixels per tile) every prop draws its far version. */
const FAR_ZOOM = 30;

/** Far-view batches cover this many chunks a side, so a zoomed-out map stays a few hundred draws. */
const FAR_SPAN = 2;

const PIN_CODES: PinType[] = ['village', 'town', 'city', 'castle', 'ruin', 'dungeon', 'cave', 'tower', 'shrine', 'camp', 'landmark', 'encounter'];

interface Batch {
  mesh: THREE.InstancedMesh;
  items: Placement[];
}

interface Built {
  group: THREE.Group;
  batches: Batch[];
}

function buildBatches(placements: PropPlacements, geometry: (name: string) => THREE.BufferGeometry | undefined, far: boolean): Built {
  const group = new THREE.Group();
  const batches: Batch[] = [];
  for (const [name, items] of Object.entries(placements)) {
    const hi = geometry(name);
    if (!hi || !items?.length) continue;
    const geo = far ? geometry(farName(name as keyof PropPlacements)) ?? hi : hi;
    const mesh = new THREE.InstancedMesh(geo, propMaterial, items.length);
    mesh.raycast = () => {};
    group.add(mesh);
    batches.push({ mesh, items });
  }
  return { group, batches };
}

function dispose(built: Built | undefined) {
  if (!built) return;
  built.group.removeFromParent();
  built.batches.forEach(({ mesh }) => mesh.dispose());
}

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const position = new THREE.Vector3();
const scale = new THREE.Vector3();
const tint = [1, 1, 1];
const color = new THREE.Color();

function dress(batches: Batch[], fade: Float32Array | null, fogMode: FogMode) {
  for (const { mesh, items } of batches) {
    items.forEach((p, n) => {
      const f = fade ? fade[p.tile] : 0;
      // Players don't see props on ground they've never seen.
      const s = fogMode === 'player' && f >= 0.999 ? 0 : p.scale;
      m.compose(position.set(p.x, p.z, p.y), q.setFromAxisAngle(up, p.rotation), scale.set(s, s, s));
      mesh.setMatrixAt(n, m);
      fogTint(f, fogMode, tint);
      mesh.setColorAt(n, color.setRGB(tint[0], tint[1], tint[2]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
}

/**
 * Trees, rocks, settlements and landmarks, built per chunk: an edit re-places
 * only the chunks it reaches. Near the camera each chunk draws full models
 * and the frustum culls what's off screen; zoomed out, groups of chunks draw
 * their low-poly versions.
 */
export function Props3D({
  terrain,
  seed,
  options,
  fade,
  fogMode,
  visible = true,
}: {
  terrain: TerrainGrid;
  seed: number;
  options: PropOptions;
  fade: Float32Array | null;
  fogMode: FogMode;
  visible?: boolean;
}) {
  const geometry = usePropGeometry();
  const state = useRef<{
    root: THREE.Group;
    near: THREE.Group;
    far: THREE.Group;
    inputs: { width: number; height: number; layers: Uint8Array[] } | null;
    placements: Map<number, PropPlacements>;
    nearBuilt: Map<number, Built>;
    farBuilt: Map<number, Built>;
    geometry: unknown;
  } | null>(null);
  if (!state.current) {
    const root = new THREE.Group();
    const near = new THREE.Group();
    const far = new THREE.Group();
    root.add(near, far);
    state.current = { root, near, far, inputs: null, placements: new Map(), nearBuilt: new Map(), farBuilt: new Map(), geometry: null };
  }
  const look = useRef({ fade, fogMode });
  look.current = { fade, fogMode };

  useLayoutEffect(() => {
    const s = state.current!;
    const { width: W, height: H } = terrain;
    const size = W * H;
    const sites = new Uint8Array(size);
    for (const site of options.sites ?? []) {
      if (site.x >= 0 && site.y >= 0 && site.x < W && site.y < H) sites[site.y * W + site.x] = PIN_CODES.indexOf(site.pinType) + 1;
    }
    const next = {
      width: W,
      height: H,
      layers: [terrain.heights.slice(), terrain.biomes.slice(), options.roads?.slice() ?? new Uint8Array(size), options.rivers?.slice() ?? new Uint8Array(size), sites],
    };
    const prev = s.inputs;
    let dirty: number[];
    if (!prev || prev.width !== W || prev.height !== H || s.geometry !== geometry) {
      dirty = allChunks(W, H);
      for (const id of [...s.nearBuilt.keys()]) dispose(s.nearBuilt.get(id));
      for (const id of [...s.farBuilt.keys()]) dispose(s.farBuilt.get(id));
      s.nearBuilt.clear();
      s.farBuilt.clear();
      s.placements.clear();
    } else {
      dirty = [...dirtyChunks(changedTiles(prev.layers.map((l, n) => [l, next.layers[n]] as [Uint8Array, Uint8Array]), size), W, H)];
    }
    s.inputs = next;
    s.geometry = geometry;
    if (dirty.length === 0) return;

    const placed = placePropsInBlocks(terrain, seed, options, dirty.map(chunkBounds));
    const fresh: Batch[] = [];
    const farDirty = new Set<number>();
    dirty.forEach((id, n) => {
      s.placements.set(id, placed[n]);
      dispose(s.nearBuilt.get(id));
      const built = buildBatches(placed[n], geometry, false);
      s.near.add(built.group);
      s.nearBuilt.set(id, built);
      fresh.push(...built.batches);
      farDirty.add(chunkId(Math.floor((id % 4096) / FAR_SPAN), Math.floor(Math.floor(id / 4096) / FAR_SPAN)));
    });
    for (const farId of farDirty) {
      const fx = farId % 4096;
      const fy = Math.floor(farId / 4096);
      const merged: PropPlacements = {};
      for (let dy = 0; dy < FAR_SPAN; dy++) {
        for (let dx = 0; dx < FAR_SPAN; dx++) {
          const part = s.placements.get(chunkId(fx * FAR_SPAN + dx, fy * FAR_SPAN + dy));
          if (!part) continue;
          for (const [name, items] of Object.entries(part)) (merged[name as keyof PropPlacements] ??= []).push(...items!);
        }
      }
      dispose(s.farBuilt.get(farId));
      const built = buildBatches(merged, geometry, true);
      s.far.add(built.group);
      s.farBuilt.set(farId, built);
      fresh.push(...built.batches);
    }
    dress(fresh, look.current.fade, look.current.fogMode);
  }, [terrain, seed, options, geometry]);

  // Fog changes re-dress every instance.
  const dressed = useRef(false);
  useLayoutEffect(() => {
    if (!dressed.current) {
      dressed.current = true;
      return;
    }
    const s = state.current!;
    for (const built of s.nearBuilt.values()) dress(built.batches, fade, fogMode);
    for (const built of s.farBuilt.values()) dress(built.batches, fade, fogMode);
  }, [fade, fogMode]);

  useEffect(
    () => () => {
      const s = state.current!;
      s.nearBuilt.forEach(dispose);
      s.farBuilt.forEach(dispose);
      s.nearBuilt.clear();
      s.farBuilt.clear();
      s.inputs = null;
    },
    []
  );

  useFrame(({ camera }) => {
    const s = state.current!;
    const close = (camera as THREE.OrthographicCamera).zoom >= FAR_ZOOM;
    s.near.visible = close;
    s.far.visible = !close;
    s.root.visible = visible;
  });

  return <primitive object={state.current.root} />;
}
