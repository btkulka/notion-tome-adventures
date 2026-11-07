/** Loading the Blender-built prop models (see catalog.ts) and the one material they share. */
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { MODELS_URL } from './catalog';

/** Draco decoder, copied from three/examples/jsm/libs/draco/gltf into public/. */
const DRACO_PATH = '/draco/';

/**
 * Lifts the props' baked colours. The map camera mostly sees the sides the sun
 * doesn't reach, so at their true values the darker greens read as black.
 * scripts/models/build.py previews with the same factor (PROP_EXPOSURE).
 */
const PROP_EXPOSURE = 2.2;

/** Colour is baked into the models and form comes from their facets, so every prop shares this. */
export const propMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: new THREE.Color(PROP_EXPOSURE, PROP_EXPOSURE, PROP_EXPOSURE) });

/** The catalog's geometries by node name ('fir-1', 'fir-1_lo', ...). Suspends while the GLB loads. */
export function usePropGeometry(): (name: string) => THREE.BufferGeometry | undefined {
  const { nodes } = useGLTF(MODELS_URL, DRACO_PATH);
  return useMemo(() => (name: string) => (nodes[name] as THREE.Mesh | undefined)?.geometry, [nodes]);
}

useGLTF.preload(MODELS_URL, DRACO_PATH);
