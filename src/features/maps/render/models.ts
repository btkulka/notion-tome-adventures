/** Loading the Blender-built prop models (see catalog.ts) and the materials they share. */
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { MODEL_URLS, modelsUrl } from './catalog';
import minisIndex from './minis.json';
import propMaterials from './prop-materials.json';
import { readModelDetail, useModelDetail } from './quality';

/** Draco decoder, copied from three/examples/jsm/libs/draco/gltf into public/. */
const DRACO_PATH = '/draco/';

/**
 * Lifts the props' baked colours. The map camera mostly sees the sides the sun
 * doesn't reach, so at their true values the darker greens read as black.
 * scripts/models/build.py previews with the same factor (PROP_EXPOSURE).
 */
const PROP_EXPOSURE = 2.2;

/**
 * Face materials, in kit.MATERIALS order (scripts/models/kit.py): the GLB's
 * '_mat' attribute indexes this list. `scale` is pattern repeats per tile,
 * `strength` how far the pattern moves the colour (0 none, 1 full). The same
 * table drives build.py's preview sheets, so they show what the app draws.
 */
export const PROP_MATERIALS: { name: string; scale: number; strength: number }[] = propMaterials;
const WINDOW = PROP_MATERIALS.findIndex((m) => m.name === 'window');
const ARCANE = PROP_MATERIALS.findIndex((m) => m.name === 'arcane');

/** The pattern atlas from scripts/textures/generate-prop-patterns.ts: 4 cells a row, 512 px each inside a 16 px wrapped gutter. */
const ATLAS = { cols: 4, rows: Math.ceil(PROP_MATERIALS.length / 4), cell: 512, gutter: 16 };

const patterns = typeof window === 'undefined' ? null : new THREE.TextureLoader().load('/textures/props/patterns.png');
if (patterns) {
  patterns.colorSpace = THREE.NoColorSpace;
  patterns.anisotropy = 8;
  patterns.generateMipmaps = true;
  patterns.minFilter = THREE.LinearMipmapLinearFilter;
}

/** Shared by every prop material. SkyRig sets nightGlow (0 day … 1 night) each frame, which lights the windows. */
export const propUniforms = {
  uPatterns: { value: patterns },
  uPatternScale: { value: PROP_MATERIALS.map((m) => m.scale) },
  uPatternStrength: { value: PROP_MATERIALS.map((m) => m.strength) },
  uNightGlow: { value: 0 },
};

const N = PROP_MATERIALS.length;

const VERTEX_HEAD = /* glsl */ `
#include <common>
attribute float _mat;
varying float vTomeMat;
varying vec3 vTomeObj;
`;

const FRAGMENT_HEAD = /* glsl */ `
#include <common>
uniform sampler2D uPatterns;
uniform float uPatternScale[${N}];
uniform float uPatternStrength[${N}];
uniform float uNightGlow;
varying float vTomeMat;
varying vec3 vTomeObj;
`;

// Box projection in the model's own axes (+Y up after glTF), picked by the
// facet's own normal from screen derivatives, so stone courses stay level and
// each flat facet takes one projection. textureGrad keeps the wrap seamless.
const PATTERN = /* glsl */ `
#include <color_fragment>
int tomeMat = int(vTomeMat + 0.5);
{
  vec3 ox = dFdx(vTomeObj);
  vec3 oy = dFdy(vTomeObj);
  vec3 an = abs(normalize(cross(ox, oy)));
  vec2 p; vec2 gx; vec2 gy;
  if (an.y >= an.x && an.y >= an.z) { p = vTomeObj.xz; gx = ox.xz; gy = oy.xz; }
  else if (an.x >= an.z) { p = vTomeObj.zy; gx = ox.zy; gy = oy.zy; }
  else { p = vTomeObj.xy; gx = ox.xy; gy = oy.xy; }
  float s = uPatternScale[tomeMat];
  float side = ${ATLAS.cell + ATLAS.gutter * 2}.0;
  vec2 cellAt = vec2(float(tomeMat % ${ATLAS.cols}), float(${ATLAS.rows - 1} - tomeMat / ${ATLAS.cols}));
  vec2 local = (${ATLAS.gutter}.0 + fract(p * s) * ${ATLAS.cell}.0) / side;
  vec2 per = vec2(${ATLAS.cols}.0, ${ATLAS.rows}.0);
  vec2 k = s * (${ATLAS.cell}.0 / side) / per;
  float t = textureGrad(uPatterns, (cellAt + local) / per, gx * k, gy * k).r;
  diffuseColor.rgb *= mix(1.0, t * 2.0, uPatternStrength[tomeMat]);
}
`;

const GLOW = /* glsl */ `
#include <emissivemap_fragment>
int tomeGlow = int(vTomeMat + 0.5);
if (tomeGlow == ${WINDOW}) totalEmissiveRadiance += vec3(1.0, 0.58, 0.24) * 1.6 * uNightGlow;
// Runes and arcane light: always faintly lit, bright after dark.
if (tomeGlow == ${ARCANE}) totalEmissiveRadiance += vec3(0.42, 0.78, 1.0) * (0.45 + 1.35 * uNightGlow);
`;

/** Colour is baked into the models and form comes from their facets, so every prop shares a material: patterned near, plain far. */
function propMaterialWith(patterned: boolean) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: new THREE.Color(PROP_EXPOSURE, PROP_EXPOSURE, PROP_EXPOSURE) });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, propUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', VERTEX_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTomeMat = _mat;\nvTomeObj = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', FRAGMENT_HEAD).replace('#include <emissivemap_fragment>', GLOW);
    if (patterned) shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', PATTERN);
  };
  material.customProgramCacheKey = () => (patterned ? 'tome-props-patterned' : 'tome-props-far');
  return material;
}

export const propMaterial = propMaterialWith(true);
/** Far zoom: no patterns (they'd shimmer at a few pixels per facet), windows still glow. */
export const propMaterialFar = propMaterialWith(false);

/**
 * The catalog's geometries by node name ('fir-1', 'fir-1_lo', ...) at the
 * viewer's model detail. Suspends while the GLB loads; changing the setting
 * loads the other tier in place.
 */
export function usePropGeometry(): (name: string) => THREE.BufferGeometry | undefined {
  const [detail] = useModelDetail();
  const { nodes } = useGLTF(modelsUrl(detail), DRACO_PATH);
  return useMemo(() => (name: string) => (nodes[name] as THREE.Mesh | undefined)?.geometry, [nodes]);
}

if (typeof window !== 'undefined') useGLTF.preload(modelsUrl(readModelDetail()), DRACO_PATH);

/** A hi-def miniature, fitted to its prop's box and ready to instance. */
export interface PropMini {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

/** The web miniatures (scripts/models/minis/web.py writes minis.json beside this file). */
export const MINIS: { name: string; url: string; triangles?: number; concept?: string }[] = minisIndex;
const NO_MINIS: string[] = [];

/**
 * Lifts the minis' painted textures, as PROP_EXPOSURE lifts the baked colours:
 * the map camera sees mostly the shaded sides.
 */
const MINI_EXPOSURE = 1.6;

const size = new THREE.Vector3();
const hiSize = new THREE.Vector3();
const centre = new THREE.Vector3();
const hiCentre = new THREE.Vector3();

/**
 * A loaded miniature's mesh scaled to fit inside its Blender prop's box (the
 * same height, or the same footprint if that's smaller), centred on it and
 * standing on its base, with a matte copy of its painted material.
 */
export function fitMini(scene: THREE.Object3D, hi: THREE.BufferGeometry): PropMini | null {
  let mesh: THREE.Mesh | undefined;
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
  });
  if (!mesh) return null;
  const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  geo.computeBoundingBox();
  if (!hi.boundingBox) hi.computeBoundingBox();
  const box = geo.boundingBox!;
  const hiBox = hi.boundingBox!;
  box.getSize(size);
  hiBox.getSize(hiSize);
  box.getCenter(centre);
  hiBox.getCenter(hiCentre);
  const s = Math.min(hiSize.y / size.y, Math.max(hiSize.x, hiSize.z) / Math.max(size.x, size.z));
  geo.translate(-centre.x, -box.min.y, -centre.z).scale(s, s, s).translate(hiCentre.x, hiBox.min.y, hiCentre.z);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).clone() as THREE.MeshStandardMaterial;
  material.color.multiplyScalar(MINI_EXPOSURE);
  material.metalness = 0;
  material.roughness = 0.9;
  return { geometry: geo, material };
}

/** Loads one miniature GLB (suspends), for the models library. */
export function useMiniScene(url: string): THREE.Object3D {
  return (useGLTF(url, DRACO_PATH) as unknown as { scene: THREE.Object3D }).scene;
}

/** Both detail tiers' geometries at once, for the models library (the map loads only the viewer's tier). */
export function useTierGeometry(): Record<keyof typeof MODEL_URLS, (name: string) => THREE.BufferGeometry | undefined> {
  const low = useGLTF(MODEL_URLS.low, DRACO_PATH).nodes;
  const medium = useGLTF(MODEL_URLS.medium, DRACO_PATH).nodes;
  return useMemo(
    () => ({
      low: (name: string) => (low[name] as THREE.Mesh | undefined)?.geometry,
      medium: (name: string) => (medium[name] as THREE.Mesh | undefined)?.geometry,
    }),
    [low, medium]
  );
}

/**
 * At the 'minis' model detail, every prop that has a miniature by name,
 * fitted to its prop (fitMini). Null at the other details, which load
 * nothing extra.
 */
export function usePropMinis(geometry: (name: string) => THREE.BufferGeometry | undefined): Map<string, PropMini> | null {
  const [detail] = useModelDetail();
  const on = detail === 'minis' && MINIS.length > 0;
  const loaded = useGLTF(on ? MINIS.map((m) => m.url) : NO_MINIS, DRACO_PATH) as unknown as { scene: THREE.Object3D }[];
  return useMemo(() => {
    if (!on) return null;
    const minis = new Map<string, PropMini>();
    loaded.forEach((gltf, n) => {
      const hi = geometry(MINIS[n].name);
      const mini = hi && fitMini(gltf.scene, hi);
      if (mini) minis.set(MINIS[n].name, mini);
    });
    return minis;
  }, [on, loaded, geometry]);
}
