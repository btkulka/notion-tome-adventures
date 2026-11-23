import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { TerrainGrid } from '../types';
import { allChunks, changedTiles, chunkBounds, dirtyChunks } from './chunks';
import { buildTerrainMeshes, type SurfaceKey, type TerrainExtras } from './geometry';
import { LAYER_TEXTURE } from './layers';
import { fogMistMaterial, fogMistUniforms, updateFogMist } from './clouds';
import { fadeMarks, withOverlay, type OverlayUniforms } from './overlay';
import { groundMaterial, groundUniforms, layerArray, updateBed, updateCells, waterMaterial, waterUniforms } from './terrainMaterial';
import { fogTint, type FogMode } from './tint';

/** The ground's looks (one texture array) plus the road and the plinth's earth. */
const TEXTURES: Record<string, string> = {
  ...LAYER_TEXTURE,
  road: '/textures/terrain/road.png',
  earth: '/textures/terrain/side-earth.png',
};

/** What casts and catches the sun's shadow. */
const SHADOWS: Partial<Record<SurfaceKey, { cast: boolean; receive: boolean }>> = {
  ground: { cast: true, receive: true },
  earth: { cast: true, receive: true },
  water: { cast: false, receive: true },
  river: { cast: false, receive: true },
  road: { cast: false, receive: true },
  bridge: { cast: true, receive: true },
};

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
  layers: (Uint8Array | Uint16Array)[];
}

function inputsOf(terrain: TerrainGrid, extras: TerrainExtras): Inputs {
  const size = terrain.width * terrain.height;
  const paved = new Uint8Array(size);
  extras.paved?.forEach((i) => (paved[i] = 1));
  return {
    width: terrain.width,
    height: terrain.height,
    layers: [
      terrain.heights.slice(), terrain.biomes.slice(), terrain.elevation?.slice() ?? new Uint16Array(size),
      extras.roads?.slice() ?? new Uint8Array(size), extras.rivers?.slice() ?? new Uint8Array(size), paved,
      extras.channels?.signature.slice() ?? new Uint8Array(size),
    ],
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
    if (data!.indices) geometry.setIndex(data!.indices);
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
      const changed = changedTiles(prev.layers.map((layer, n) => [layer, next.layers[n]] as [ArrayLike<number>, ArrayLike<number>]), terrain.width * terrain.height);
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

/** Meshes the fog-of-war mist is drawn over. */
const MISTED: SurfaceKey[] = ['ground', 'water'];

const TerrainChunk = memo(function TerrainChunk({
  chunk,
  materials,
  fade,
  fogMode,
  mist,
}: {
  chunk: Chunk;
  materials: Partial<Record<SurfaceKey, THREE.Material>>;
  fade: Float32Array | null;
  fogMode: FogMode;
  /** The fog-of-war mist's material, for players. */
  mist: THREE.Material | null;
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
        <mesh key={key} geometry={geometry} material={materials[key]} castShadow={SHADOWS[key]?.cast ?? false} receiveShadow={SHADOWS[key]?.receive ?? false} />
      ))}
      {mist &&
        chunk.meshes
          .filter(({ key }) => MISTED.includes(key))
          .map(({ key, geometry }) => <mesh key={`mist-${key}`} geometry={geometry} material={mist} renderOrder={5} raycast={() => null} />)}
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

  // The ground's looks as one texture array, built once from the loaded images.
  const layers = useMemo(() => layerArray(textures), [textures]);
  useEffect(() => () => layers.dispose(), [layers]);

  // Which look each cell shows, and the bed's height for the water's depth: textures sized to the map.
  const ground = useMemo(() => groundUniforms(terrain.width, terrain.height), [terrain.width, terrain.height]);
  const water = useMemo(() => waterUniforms(terrain.width, terrain.height), [terrain.width, terrain.height]);
  useEffect(() => () => ground.uCells.value.dispose(), [ground]);
  useEffect(() => () => water.uBed.value.dispose(), [water]);
  ground.uLayers.value = layers;
  useMemo(() => updateCells(ground, terrain, extras.paved), [ground, terrain, extras.paved]);
  useMemo(() => updateBed(water, terrain, extras.channels), [water, terrain, extras.channels]);

  const materials = useMemo(() => {
    const out: Partial<Record<SurfaceKey, THREE.Material>> = {};
    // Roads and rivers lie on the ground: nudge them toward the camera so the ground's swells never poke through.
    const draped = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
    out.ground = groundMaterial(overlay, ground);
    out.water = waterMaterial(overlay, water);
    out.river = Object.assign(waterMaterial(overlay, water, true), draped);
    out.road = withOverlay(new THREE.MeshLambertMaterial({ map: textures.road, vertexColors: true, ...draped }), overlay);
    out.earth = withOverlay(new THREE.MeshLambertMaterial({ map: textures.earth, vertexColors: true }), overlay);
    out.bridge = withOverlay(new THREE.MeshLambertMaterial({ map: textures.cliff, vertexColors: true }), overlay);
    out.waterSide = withOverlay(new THREE.MeshLambertMaterial({ color: '#14283A', vertexColors: true }), overlay);
    return out;
  }, [textures, overlay, ground, water]);

  useEffect(() => () => Object.values(materials).forEach((m) => m?.dispose()), [materials]);

  // Fog of war for players: rolling mist over the band where the known gives way to the unknown.
  const fog = useMemo(() => fogMistUniforms(terrain.width, terrain.height), [terrain.width, terrain.height]);
  useEffect(() => () => fog.uFogMist.value.dispose(), [fog]);
  const mist = useMemo(() => fogMistMaterial(fog), [fog]);
  useEffect(() => () => mist.dispose(), [mist]);
  const misty = fogMode === 'player' && fade !== null;
  useMemo(() => updateFogMist(fog, misty ? fade : null), [fog, fade, misty]);

  // The water moves, and a newly hovered region fades in.
  useFrame((_, dt) => {
    water.uTime.value += dt;
    fadeMarks(overlay, dt);
  });

  return (
    <group>
      {chunks.map((chunk) => (
        <TerrainChunk key={chunk.id} chunk={chunk} materials={materials} fade={fade} fogMode={fogMode} mist={misty ? mist : null} />
      ))}
    </group>
  );
}
