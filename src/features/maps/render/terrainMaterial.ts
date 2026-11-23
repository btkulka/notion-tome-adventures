/**
 * The ground's and the water's shaders, built on three's Lambert and Phong
 * materials so lights, shadows, haze and the overlay keep working.
 *
 * Ground: every point blends the looks of the four cells around it (a texture
 * of cell layers, layers.ts), read through the same kind of fraying as the
 * ground's shape, so forest frays into grassland over a few hundred feet
 * instead of meeting it at an edge. Ground too steep to stand on shows rock,
 * projected from three sides so cliffs don't smear; the highest flats hold
 * snow; a slow brightness drift hides the textures' repeat.
 *
 * Water: one sheet coloured by the depth beneath it (a height texture of the
 * bed), from clear shallows to dark deeps, with foam where it laps the shore
 * and ripples that catch the sun.
 */
import * as THREE from 'three';
import { MAX_STEP, STEP_HEIGHT } from '../constants';
import type { TerrainGrid } from '../types';
import { cellLayers, GROUND_LAYERS, layerIndex } from './layers';
import { withOverlay, type OverlayUniforms } from './overlay';
import { carve, type Channels } from './channels';
import { CLOUD_SHADE_GLSL, CLOUD_SHADOW, weatherUniforms } from './clouds';
import { bedHeight, surfaceOf } from './surface';
import { TOP_REPEAT } from './geometry';

/** Height texture samples per cell side. */
const BED_RESOLUTION = 2;


// --- Ground ---------------------------------------------------------------

export interface GroundUniforms {
  [name: string]: THREE.IUniform;
  uLayers: { value: THREE.DataArrayTexture | null };
  uCells: { value: THREE.DataTexture };
  uCellCount: { value: THREE.Vector2 };
}

const GROUND_VERTEX_HEAD = /* glsl */ `
varying vec3 vGroundPos;
varying vec3 vGroundNormal;
`;

const GROUND_VERTEX_BODY = /* glsl */ `
vGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vGroundNormal = normal;
`;

const GROUND_FRAGMENT_HEAD = /* glsl */ `
uniform sampler2DArray uLayers;
uniform sampler2D uCells;
uniform vec2 uCellCount;
varying vec3 vGroundPos;
varying vec3 vGroundNormal;
// tomeNoise and tomeFray come from the overlay's head (overlay.ts FRAY_GLSL), which precedes this.
${CLOUD_SHADE_GLSL}
float groundLayerAt(vec2 cell) {
  ivec2 c = ivec2(clamp(cell, vec2(0.0), uCellCount - 1.0));
  return floor(texelFetch(uCells, c, 0).r * 255.0 + 0.5);
}
vec3 groundLook(float layer, vec2 uv, vec2 dx, vec2 dy) {
  return textureGrad(uLayers, vec3(uv, layer), dx, dy).rgb;
}
`;

const GROUND_FRAGMENT_BODY = /* glsl */ `
{
  vec2 p = vGroundPos.xz;
  // Fray where the cells are read, like the ground's own shape (surface.ts); soft marks read the same way.
  vec2 c = tomeFray(p) - 0.5;
  vec2 i0 = floor(c);
  vec2 s = smoothstep(0.5 - ${0.24.toFixed(2)}, 0.5 + ${0.24.toFixed(2)}, c - i0);
  vec2 uv = p / ${TOP_REPEAT.toFixed(2)};
  vec2 dx = dFdx(uv);
  vec2 dy = dFdy(uv);
  vec3 look =
      groundLook(groundLayerAt(i0), uv, dx, dy) * (1.0 - s.x) * (1.0 - s.y)
    + groundLook(groundLayerAt(i0 + vec2(1.0, 0.0)), uv, dx, dy) * s.x * (1.0 - s.y)
    + groundLook(groundLayerAt(i0 + vec2(0.0, 1.0)), uv, dx, dy) * (1.0 - s.x) * s.y
    + groundLook(groundLayerAt(i0 + vec2(1.0, 1.0)), uv, dx, dy) * s.x * s.y;

  // A slow drift in brightness, so the textures' repeat doesn't show across a map.
  look *= 0.9 + 0.2 * (0.5 + 0.5 * tomeNoise(p * 0.09 + vec2(5.2, 1.3)));

  vec3 n = normalize(vGroundNormal);
  // Rock where it's too steep to stand, seen from three sides so cliffs don't smear.
  float rock = smoothstep(0.86, 0.68, n.y);
  vec3 w = pow(abs(n), vec3(4.0));
  w /= (w.x + w.y + w.z);
  vec3 cliff =
      texture(uLayers, vec3(vGroundPos.zy * 0.5, ${layerIndex('cliff').toFixed(1)})).rgb * w.x
    + texture(uLayers, vec3(vGroundPos.xz * 0.5, ${layerIndex('cliff').toFixed(1)})).rgb * w.y
    + texture(uLayers, vec3(vGroundPos.xy * 0.5, ${layerIndex('cliff').toFixed(1)})).rgb * w.z;
  look = mix(look, cliff, rock);

  // Snow lies on the highest flats, whatever the biome below.
  float high = vGroundPos.y + tomeNoise(p * 0.8) * ${STEP_HEIGHT.toFixed(2)};
  float snow = smoothstep(${(STEP_HEIGHT * (MAX_STEP - 4.5)).toFixed(3)}, ${(STEP_HEIGHT * (MAX_STEP - 2.5)).toFixed(3)}, high) * smoothstep(0.6, 0.8, n.y);
  look = mix(look, groundLook(${layerIndex('snow').toFixed(1)}, uv, dx, dy), snow);

  // Shadows of the clouds drifting over.
  look *= 1.0 - ${CLOUD_SHADOW.toFixed(2)} * cloudShade(p);

  diffuseColor.rgb *= look;
}
`;

/** The ground's material: Lambert, vertex colours for fog, the overlay, and the blended looks. */
export function groundMaterial(overlay: OverlayUniforms, ground: GroundUniforms): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  return withOverlay(
    material,
    overlay,
    (shader) => {
      Object.assign(shader.uniforms, ground, weatherUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${GROUND_VERTEX_HEAD}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${GROUND_VERTEX_BODY}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${GROUND_FRAGMENT_HEAD}`)
        .replace('#include <map_fragment>', `#include <map_fragment>\n${GROUND_FRAGMENT_BODY}`);
    },
    '-ground-1'
  );
}

/** The cell-layer texture's uniforms, sized for a map; fill them with `updateCells`. */
export function groundUniforms(width: number, height: number): GroundUniforms {
  const cells = new THREE.DataTexture(new Uint8Array(width * height), width, height, THREE.RedFormat, THREE.UnsignedByteType);
  cells.magFilter = cells.minFilter = THREE.NearestFilter;
  cells.generateMipmaps = false;
  cells.needsUpdate = true;
  return { uLayers: { value: null }, uCells: { value: cells }, uCellCount: { value: new THREE.Vector2(width, height) } };
}

/** Writes each cell's layer (and town squares) into the ground's cell texture. */
export function updateCells(uniforms: GroundUniforms, terrain: TerrainGrid, paved?: ReadonlySet<number>): void {
  const texture = uniforms.uCells.value;
  (texture.image.data as Uint8Array).set(cellLayers(terrain, paved));
  texture.needsUpdate = true;
}

/**
 * The ground's looks as one texture array, in GROUND_LAYERS order. Every
 * texture is drawn at the first one's size, so differing files still fit.
 */
export function layerArray(textures: Record<string, THREE.Texture>): THREE.DataArrayTexture {
  const first = textures[GROUND_LAYERS[0]].image as { width: number; height: number };
  const size = first.width;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const data = new Uint8Array(size * size * 4 * GROUND_LAYERS.length);
  GROUND_LAYERS.forEach((layer, n) => {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(textures[layer].image as CanvasImageSource, 0, 0, size, size);
    data.set(ctx.getImageData(0, 0, size, size).data, n * size * size * 4);
  });
  const array = new THREE.DataArrayTexture(data, size, size, GROUND_LAYERS.length);
  array.format = THREE.RGBAFormat;
  array.type = THREE.UnsignedByteType;
  array.colorSpace = THREE.SRGBColorSpace;
  array.wrapS = array.wrapT = THREE.RepeatWrapping;
  array.minFilter = THREE.LinearMipmapLinearFilter;
  array.magFilter = THREE.LinearFilter;
  array.generateMipmaps = true;
  array.anisotropy = 8;
  array.needsUpdate = true;
  return array;
}

// --- Water ----------------------------------------------------------------

export interface WaterUniforms {
  [name: string]: THREE.IUniform;
  uBed: { value: THREE.DataTexture };
  uBedSize: { value: THREE.Vector2 };
  uTime: { value: number };
  uShallow: { value: THREE.Color };
  uDeep: { value: THREE.Color };
  uFoam: { value: THREE.Color };
}

const WATER_VERTEX_HEAD = /* glsl */ `
varying vec3 vWaterPos;
#ifdef TOME_RIVER
  varying vec2 vRiver;
#endif
`;

const WATER_VERTEX_BODY = /* glsl */ `
vWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
#ifdef TOME_RIVER
  vRiver = uv; // along the flow (tiles / 1.2), across the channel (-1..1)
#endif
`;

const WATER_FRAGMENT_HEAD = /* glsl */ `
uniform sampler2D uBed;
uniform vec2 uBedSize;
uniform float uTime;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uFoam;
varying vec3 vWaterPos;
#ifdef TOME_RIVER
  varying vec2 vRiver;
#endif
${CLOUD_SHADE_GLSL}
float waterDepth() {
  #ifdef TOME_RIVER
    // Deepest in the middle of the channel, shallow at its banks.
    float a = abs(vRiver.y);
    return mix(0.16, 0.015, a * a);
  #else
    vec2 t = (vWaterPos.xz * ${BED_RESOLUTION.toFixed(1)} + 0.5) / uBedSize;
    return max(0.0, vWaterPos.y - texture(uBed, t).r);
  #endif
}
vec2 waterRipple(vec2 p) {
  #ifdef TOME_RIVER
    // Ripples drift downstream.
    vec2 f = vec2(vRiver.x - uTime * 0.35, vRiver.y * 0.6);
    return vec2(tomeNoise(f * vec2(3.0, 2.0)), tomeNoise(f * vec2(7.0, 4.0) + 3.1));
  #else
    float a = tomeNoise(p * 2.6 + vec2(uTime * 0.13, uTime * 0.09));
    float b = tomeNoise(p * 6.1 - vec2(uTime * 0.21, -uTime * 0.16));
    return vec2(a, b);
  #endif
}
`;

const WATER_FRAGMENT_BODY = /* glsl */ `
{
  vec2 p = vWaterPos.xz;
  float depth = waterDepth();
  vec3 water = mix(uShallow, uDeep, 1.0 - exp(-depth * 3.4));
  vec2 r = waterRipple(p);
  water *= 1.0 + (r.x * 0.6 + r.y * 0.4) * 0.07;
  #ifdef TOME_RIVER
    // A little white water along the banks, streaming with the flow.
    float edge = smoothstep(0.72, 0.98, abs(vRiver.y));
    water = mix(water, uFoam, edge * smoothstep(0.1, 0.7, r.x + 0.3) * 0.55);
  #else
    // Foam where the water laps the shore, broken up and drifting.
    float lap = 1.0 - smoothstep(0.0, 0.075, depth);
    float froth = smoothstep(-0.15, 0.55, tomeNoise(p * 5.5 + vec2(uTime * 0.25, -uTime * 0.1)) + 0.45 * sin(depth * 70.0 - uTime * 1.4));
    water = mix(water, uFoam, lap * froth * 0.85);
  #endif
  water *= 1.0 - ${CLOUD_SHADOW.toFixed(2)} * cloudShade(p);
  diffuseColor.rgb *= water;
}
`;

const WATER_NORMAL = /* glsl */ `
{
  // Ripples tilt the surface a little so the sun glints off it.
  vec2 p = vWaterPos.xz;
  float e = 0.05;
  float h0 = tomeNoise(p * 4.0 + vec2(uTime * 0.2, uTime * 0.15));
  float hx = tomeNoise((p + vec2(e, 0.0)) * 4.0 + vec2(uTime * 0.2, uTime * 0.15));
  float hz = tomeNoise((p + vec2(0.0, e)) * 4.0 + vec2(uTime * 0.2, uTime * 0.15));
  vec3 tilt = (viewMatrix * vec4(-(hx - h0) / e, 0.0, -(hz - h0) / e, 0.0)).xyz;
  normal = normalize(normal + tilt * 0.035);
}
`;

/** The water's material: Phong for the sun's glint, vertex colours for fog, the overlay, and depth colour. */
export function waterMaterial(overlay: OverlayUniforms, water: WaterUniforms, river = false): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: new THREE.Color('#4F5D6A') });
  if (river) material.defines = { TOME_RIVER: '' };
  return withOverlay(
    material,
    overlay,
    (shader) => {
      Object.assign(shader.uniforms, water, weatherUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${WATER_VERTEX_HEAD}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${WATER_VERTEX_BODY}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${WATER_FRAGMENT_HEAD}`)
        .replace('#include <map_fragment>', `#include <map_fragment>\n${WATER_FRAGMENT_BODY}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${WATER_NORMAL}`);
    },
    river ? '-river-1' : '-water-1'
  );
}

/** The water's uniforms, with a bed texture sized for a map; fill it with `updateBed`. */
export function waterUniforms(width: number, height: number): WaterUniforms {
  return {
    uBed: { value: bedTexture(width, height) },
    uBedSize: { value: new THREE.Vector2(width * BED_RESOLUTION + 1, height * BED_RESOLUTION + 1) },
    uTime: { value: 0 },
    uShallow: { value: new THREE.Color('#4E9A93') },
    uDeep: { value: new THREE.Color('#0D2740') },
    uFoam: { value: new THREE.Color('#D9E4DF') },
  };
}

function bedTexture(width: number, height: number): THREE.DataTexture {
  const w = width * BED_RESOLUTION + 1;
  const h = height * BED_RESOLUTION + 1;
  const texture = new THREE.DataTexture(new Uint16Array(w * h), w, h, THREE.RedFormat, THREE.HalfFloatType);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** Samples the ground (the sea and lake beds included, rivers' cuts too) into the water's bed texture, for its depth. */
export function updateBed(uniforms: WaterUniforms, terrain: TerrainGrid, channels?: Channels): void {
  const s = surfaceOf(terrain);
  const texture = uniforms.uBed.value;
  const data = texture.image.data as Uint16Array;
  const w = terrain.width * BED_RESOLUTION + 1;
  const h = terrain.height * BED_RESOLUTION + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fx = x / BED_RESOLUTION;
      const fy = y / BED_RESOLUTION;
      data[y * w + x] = THREE.DataUtils.toHalfFloat(carve(channels, fx, fy, bedHeight(s, fx, fy)));
    }
  }
  texture.needsUpdate = true;
}
