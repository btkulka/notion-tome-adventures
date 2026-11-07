import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { TerrainGrid } from '../types';
import { allChunks, changedTiles, chunkBounds, dirtyChunks } from './chunks';
import { buildTerrainMeshes, type SurfaceKey, type TerrainExtras } from './geometry';
import { withOverlay, type OverlayUniforms } from './overlay';
import { fogTint, type FogMode } from './tint';

const TEXTURES: Record<Exclude<SurfaceKey, 'waterSide' | 'river'>, string> = {
  grass: '/textures/terrain/grass.png',
  forest: '/textures/terrain/forest.png',
  taiga: '/textures/terrain/taiga.png',
  swamp: '/textures/terrain/swamp.png',
  desert: '/textures/terrain/desert.png',
  beach: '/textures/terrain/beach.png',
  hills: '/textures/terrain/hills.png',
  rock: '/textures/terrain/rock.png',
  snow: '/textures/terrain/snow.png',
  ocean: '/textures/terrain/ocean.png',
  shallows: '/textures/terrain/shallows.png',
  lake: '/textures/terrain/lake.png',
  road: '/textures/terrain/road.png',
  cobble: '/textures/terrain/cobble.png',
  earth: '/textures/terrain/side-earth.png',
  cliff: '/textures/terrain/side-rock.png',
};

const WATER: SurfaceKey[] = ['ocean', 'shallows', 'lake', 'river'];

interface ChunkMesh {
  key: SurfaceKey;
  geometry: THREE.BufferGeometry;
  tiles: number[];
}

interface Chunk {
  id: number;
  meshes: ChunkMesh[];
}

/** Everything a chunk's geometry is built from, per tile, to diff against the next edit. */
interface Inputs {
  width: number;
  height: number;
  layers: Uint8Array[];
}

function inputsOf(terrain: TerrainGrid, extras: TerrainExtras): Inputs {
  const size = terrain.width * terrain.height;
  const paved = new Uint8Array(size);
  extras.paved?.forEach((i) => (paved[i] = 1));
  return {
    width: terrain.width,
    height: terrain.height,
    layers: [terrain.heights.slice(), terrain.biomes.slice(), extras.roads?.slice() ?? new Uint8Array(size), extras.rivers?.slice() ?? new Uint8Array(size), paved],
  };
}

function buildChunk(terrain: TerrainGrid, extras: TerrainExtras, id: number): Chunk {
  const built = buildTerrainMeshes(terrain, extras, chunkBounds(id));
  const meshes = Object.entries(built).map(([key, data]) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data!.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data!.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data!.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(data!.tiles.length * 3).fill(1), 3));
    geometry.setAttribute('aTile', new THREE.Float32BufferAttribute(data!.tiles, 1));
    geometry.computeBoundingSphere();
    return { key: key as SurfaceKey, geometry, tiles: data!.tiles };
  });
  return { id, meshes };
}

/**
 * Terrain chunks that rebuild only where the ground, roads, rivers or paving
 * changed since the last render: a brush stroke touches a chunk or four, not
 * the whole map.
 */
function useTerrainChunks(terrain: TerrainGrid, extras: TerrainExtras): Chunk[] {
  const cache = useRef<{ inputs: Inputs | null; chunks: Map<number, Chunk>; retired: THREE.BufferGeometry[] }>({ inputs: null, chunks: new Map(), retired: [] });

  const chunks = useMemo(() => {
    const c = cache.current;
    const next = inputsOf(terrain, extras);
    const prev = c.inputs;
    let dirty: Iterable<number>;
    if (!prev || prev.width !== next.width || prev.height !== next.height) {
      for (const chunk of c.chunks.values()) c.retired.push(...chunk.meshes.map((m) => m.geometry));
      c.chunks.clear();
      dirty = allChunks(terrain.width, terrain.height);
    } else {
      const changed = changedTiles(prev.layers.map((layer, n) => [layer, next.layers[n]] as [Uint8Array, Uint8Array]), terrain.width * terrain.height);
      dirty = dirtyChunks(changed, terrain.width, terrain.height);
    }
    for (const id of dirty) {
      const old = c.chunks.get(id);
      if (old) c.retired.push(...old.meshes.map((m) => m.geometry));
      c.chunks.set(id, buildChunk(terrain, extras, id));
    }
    c.inputs = next;
    return [...c.chunks.values()];
  }, [terrain, extras]);

  useEffect(() => {
    const c = cache.current;
    c.retired.forEach((g) => g.dispose());
    c.retired = [];
  }, [chunks]);

  useEffect(
    () => () => {
      for (const chunk of cache.current.chunks.values()) chunk.meshes.forEach((m) => m.geometry.dispose());
    },
    []
  );

  return chunks;
}

const TerrainChunk = memo(function TerrainChunk({
  chunk,
  materials,
  fade,
  fogMode,
}: {
  chunk: Chunk;
  materials: Partial<Record<SurfaceKey, THREE.Material>>;
  fade: Float32Array | null;
  fogMode: FogMode;
}) {
  // Fog rewrites vertex colours only; geometry stays put.
  useLayoutEffect(() => {
    for (const { geometry, tiles } of chunk.meshes) {
      const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
      const arr = colors.array as Float32Array;
      if (!fade) arr.fill(1);
      else for (let v = 0; v < tiles.length; v++) fogTint(fade[tiles[v]], fogMode, arr, v * 3);
      colors.needsUpdate = true;
    }
  }, [chunk, fade, fogMode]);

  return (
    <>
      {chunk.meshes.map(({ key, geometry }) => (
        <mesh key={key} geometry={geometry} material={materials[key]} />
      ))}
    </>
  );
});

export function Terrain({
  terrain,
  extras,
  fade,
  fogMode,
  overlay,
}: {
  terrain: TerrainGrid;
  extras: TerrainExtras;
  fade: Float32Array | null;
  fogMode: FogMode;
  overlay: OverlayUniforms;
}) {
  const textures = useTexture(TEXTURES) as Record<string, THREE.Texture>;
  useMemo(() => {
    for (const tex of Object.values(textures)) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.needsUpdate = true;
    }
  }, [textures]);

  const chunks = useTerrainChunks(terrain, extras);

  const materials = useMemo(() => {
    const out: Partial<Record<SurfaceKey, THREE.MeshLambertMaterial>> = {};
    for (const key of Object.keys(TEXTURES) as (keyof typeof TEXTURES)[]) {
      out[key] = withOverlay(new THREE.MeshLambertMaterial({ map: textures[key], vertexColors: true }), overlay);
    }
    out.river = withOverlay(new THREE.MeshLambertMaterial({ map: textures.shallows, vertexColors: true }), overlay);
    out.waterSide = withOverlay(new THREE.MeshLambertMaterial({ color: '#14283A', vertexColors: true }), overlay);
    return out;
  }, [textures, overlay]);

  useEffect(() => () => Object.values(materials).forEach((m) => m?.dispose()), [materials]);

  // Water drifts slowly.
  useFrame((_, dt) => {
    for (const key of WATER) {
      const tex = key === 'river' ? textures.shallows : textures[key];
      if (!tex) continue;
      tex.offset.x += dt * 0.004;
      tex.offset.y += dt * 0.0025;
    }
  });

  return (
    <group>
      {chunks.map((chunk) => (
        <TerrainChunk key={chunk.id} chunk={chunk} materials={materials} fade={fade} fogMode={fogMode} />
      ))}
    </group>
  );
}
