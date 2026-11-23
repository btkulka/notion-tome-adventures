import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PinType, TerrainGrid } from '../types';
import { farName } from './catalog';
import { allChunks, changedTiles, chunkBounds, chunkId, dirtyChunks } from './chunks';
import { propMaterial, propMaterialFar, usePropGeometry, usePropMinis, type PropMini } from './models';
import { placePropsInBlocks, type Placement, type PropOptions, type PropPlacements } from './props';
import { canBuildInBackground, IN_PLACE_CHUNKS, placePropsInBackground } from './workers';
import { fogTint, type FogMode } from './tint';

/** Below this zoom (pixels per tile) every prop draws its far version. */
const FAR_ZOOM = 30;

/** Far-view batches cover this many chunks a side, so a zoomed-out map stays a few hundred draws. */
const FAR_SPAN = 2;

/** Props that stand at pins (settlements and landmarks), as opposed to scattered trees and rocks. */
const PIN_PROP = /^(village|town|city|castle|stones|monolith|ruin|dwarfgate|elfspire|bones|waystone|shrine|dungeon|cave|wizardtower|camp|temple|banner)-/;

const PIN_CODES: PinType[] = ['village', 'town', 'city', 'castle', 'ruin', 'dungeon', 'cave', 'tower', 'shrine', 'camp', 'landmark', 'encounter'];

interface Batch {
  mesh: THREE.InstancedMesh;
  items: Placement[];
}

interface Built {
  group: THREE.Group;
  batches: Batch[];
}

function buildBatches(placements: PropPlacements, geometry: (name: string) => THREE.BufferGeometry | undefined, far: boolean, minis: Map<string, PropMini> | null): Built {
  const group = new THREE.Group();
  const batches: Batch[] = [];
  for (const [name, items] of Object.entries(placements)) {
    const hi = geometry(name);
    if (!hi || !items?.length) continue;
    // A prop with a miniature draws it up close. Far away, trees and ground cover keep their
    // low-poly versions (hundreds of them), but settlements and landmarks, a handful at their pins, stay minis.
    const mini = far && !PIN_PROP.test(name) ? undefined : minis?.get(name);
    const geo = mini ? mini.geometry : far ? geometry(farName(name as keyof PropPlacements)) ?? hi : hi;
    const mesh = new THREE.InstancedMesh(geo, mini ? mini.material : far ? propMaterialFar : propMaterial, items.length);
    mesh.raycast = () => {};
    // Props stand in the sun's shadows and cast their own (when shadows are on; see SkyRig).
    mesh.castShadow = mesh.receiveShadow = true;
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
  const minis = usePropMinis(geometry);
  const state = useRef<{
    root: THREE.Group;
    near: THREE.Group;
    far: THREE.Group;
    inputs: { width: number; height: number; layers: Uint8Array[] } | null;
    placements: Map<number, PropPlacements>;
    nearBuilt: Map<number, Built>;
    farBuilt: Map<number, Built>;
    geometry: unknown;
    minis: unknown;
    /** The placement each chunk waits for, so a late background result never overwrites a newer one. */
    build: number;
    awaiting: Map<number, number>;
  } | null>(null);
  if (!state.current) {
    const root = new THREE.Group();
    const near = new THREE.Group();
    const far = new THREE.Group();
    root.add(near, far);
    state.current = { root, near, far, inputs: null, placements: new Map(), nearBuilt: new Map(), farBuilt: new Map(), geometry: null, minis: null, build: 0, awaiting: new Map() };
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
      layers: [
        terrain.heights.slice(), terrain.biomes.slice(), options.roads?.slice() ?? new Uint8Array(size), options.rivers?.slice() ?? new Uint8Array(size), sites,
        options.channels?.signature.slice() ?? new Uint8Array(size),
      ],
    };
    const prev = s.inputs;
    let dirty: number[];
    if (!prev || prev.width !== W || prev.height !== H || s.geometry !== geometry || s.minis !== minis) {
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
    s.minis = minis;
    if (dirty.length === 0) return;

    // Small edits place in place, at once; bigger jobs go to the background builders and land in parts.
    const build = ++s.build;
    for (const id of dirty) s.awaiting.set(id, build);
    if (dirty.length <= IN_PLACE_CHUNKS || !canBuildInBackground()) {
      apply(dirty, placePropsInBlocks(terrain, seed, options, dirty.map(chunkBounds)));
      return;
    }
    // Not cancelled when the inputs change again: each chunk takes only the placement it awaits.
    placePropsInBackground(
      terrain,
      seed,
      options,
      dirty,
      (ids, placed) => {
        const mine = ids.map((id, n) => [id, placed[n]] as const).filter(([id]) => s.awaiting.get(id) === build);
        if (mine.length) apply(mine.map(([id]) => id), mine.map(([, p]) => p));
      },
      (message) => {
        console.warn('Tome: background prop placement failed, placing in place:', message);
        const left = dirty.filter((id) => s.awaiting.get(id) === build);
        apply(left, placePropsInBlocks(terrain, seed, options, left.map(chunkBounds)));
      }
    );

    /** Builds the instanced props for these chunks, and the merged far batches they fall in. */
    function apply(ids: number[], placed: PropPlacements[]) {
      const fresh: Batch[] = [];
      const farDirty = new Set<number>();
      ids.forEach((id, n) => {
        s.placements.set(id, placed[n]);
        dispose(s.nearBuilt.get(id));
        const built = buildBatches(placed[n], geometry, false, minis);
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
        const built = buildBatches(merged, geometry, true, minis);
        s.far.add(built.group);
        s.farBuilt.set(farId, built);
        fresh.push(...built.batches);
      }
      dress(fresh, look.current.fade, look.current.fogMode);
    }
  }, [terrain, seed, options, geometry, minis]);

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
      // Background placements still on their way land nowhere.
      s.awaiting.clear();
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
