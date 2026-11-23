/**
 * The weather overhead: cloud shadows drifting across the ground and water
 * (the ground and water shaders read `weatherUniforms` through CLOUD_SHADE_GLSL),
 * and see-through mist banks rolling over the map at two heights, the peaks
 * standing up through them. All of it follows the table's weather: a few wisps
 * when it's clear, a thick rolling blanket in fog. The mist fades near the
 * map's edges and as the camera zooms in, so it never hides what the DM is
 * working on. For players, fog of war is dark swirling smoke (fogMist): clear at
 * the explored edge, thickening to opaque where it meets the unknown dark.
 */
import * as THREE from 'three';
import { MAX_STEP, STEP_HEIGHT } from '../constants';
import type { Weather } from '../types';
import { FOG_REMEMBERED } from '../vision/fog';
import { FRAY_GLSL } from './overlay';

/** How much of the sky is cloud, and how much mist hangs over the land, per weather. */
export const WEATHER_CLOUDS: Record<Weather, { cover: number; mist: number }> = {
  clear: { cover: 0.28, mist: 0.18 },
  overcast: { cover: 0.72, mist: 0.4 },
  rain: { cover: 0.8, mist: 0.5 },
  storm: { cover: 0.9, mist: 0.6 },
  snow: { cover: 0.75, mist: 0.55 },
  fog: { cover: 0.85, mist: 1 },
};

/** Shared by every material that shows the weather. One wind for the whole map. */
export const weatherUniforms = {
  uCloudTime: { value: 0 },
  uCloudCover: { value: WEATHER_CLOUDS.clear.cover },
  uWind: { value: new THREE.Vector2(0.8, 0.35) },
};

/**
 * `float cloudShade(vec2 p)`: how deep in a cloud's shadow the ground at p is,
 * 0..1. Needs tomeNoise (the overlay's head) before it.
 */
export const CLOUD_SHADE_GLSL = /* glsl */ `
uniform float uCloudTime;
uniform float uCloudCover;
uniform vec2 uWind;
float cloudShade(vec2 p) {
  vec2 q = p * 0.045 + uWind * uCloudTime * 0.012;
  float n = tomeNoise(q) * 0.6 + tomeNoise(q * 2.3 + 7.1) * 0.3 + tomeNoise(q * 5.1 - 3.7) * 0.1;
  float t = mix(0.55, -0.45, uCloudCover);
  return smoothstep(t, t + 0.2, n);
}
`;

/** How dark a cloud's shadow is at its deepest. */
export const CLOUD_SHADOW = 0.3;

export interface MistUniforms {
  [name: string]: THREE.IUniform;
  uMist: { value: number };
  uFade: { value: number };
  uSize: { value: THREE.Vector2 };
  uLayer: { value: number };
}

const MIST_FRAGMENT_HEAD = /* glsl */ `
${FRAY_GLSL}
uniform float uCloudTime;
uniform vec2 uWind;
uniform float uMist;
uniform float uFade;
uniform vec2 uSize;
uniform float uLayer;
varying vec3 vMistPos;
`;

const MIST_FRAGMENT_BODY = /* glsl */ `
{
  vec2 p = vMistPos.xz;
  // Rolling banks: noise pushed along by the wind and folded over itself.
  vec2 drift = uWind * uCloudTime * (0.025 + uLayer * 0.015);
  vec2 q = (p + drift) * (0.06 + uLayer * 0.03) + vec2(uLayer * 17.3, -uLayer * 9.1);
  q += vec2(tomeNoise(q * 1.7 + uCloudTime * 0.01), tomeNoise(q * 1.7 - 4.2 - uCloudTime * 0.012)) * 0.6;
  float n = tomeNoise(q) * 0.55 + tomeNoise(q * 2.4 + 3.3) * 0.3 + tomeNoise(q * 6.0 - 1.7) * 0.15;
  float t = mix(0.5, -0.35, uMist);
  float density = smoothstep(t, t + 0.35, n);
  // Thin at the map's edges, so the mist doesn't hang off the plinth.
  float edge = min(min(p.x, p.y), min(uSize.x - p.x, uSize.y - p.y));
  density *= smoothstep(0.0, 6.0, edge);
  diffuseColor.a *= density * mix(0.32, 0.55, uMist) * uFade;
}
`;

/** A mist layer's material: Lambert, so the sun and sky light it like the land, with noise for its banks. */
export function mistMaterial(uniforms: MistUniforms): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ color: '#F4F6FA', transparent: true, depthWrite: false });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, weatherUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMistPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMistPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${MIST_FRAGMENT_HEAD}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${MIST_FRAGMENT_BODY}`);
  };
  material.customProgramCacheKey = () => 'tome-mist-1';
  return material;
}

/** World heights of the two mist layers: one through the hills, one among the peaks. */
export const MIST_HEIGHTS = [STEP_HEIGHT * (MAX_STEP * 0.42), STEP_HEIGHT * (MAX_STEP * 0.7)];

/** How much of the mist shows at this zoom (the map's own fit zoom is 1): gone by 6×. */
export const mistFade = (relativeZoom: number) => 1 - Math.min(1, Math.max(0, (relativeZoom - 2.2) / 3.8));

// --- Fog of war ---------------------------------------------------------------

/**
 * How thick the fog of war is over a tile with this fog fade (vision/fog.ts), for
 * players: clear on ground they see or remember, then feathering from fully
 * see-through at the explored edge to fully opaque where it meets the dark.
 */
export function fogMist(fade: number): number {
  if (fade <= FOG_REMEMBERED) return 0;
  const t = Math.min(1, (fade - FOG_REMEMBERED) / (0.97 - FOG_REMEMBERED));
  return t * t * (3 - 2 * t);
}

export interface FogMistUniforms {
  [name: string]: THREE.IUniform;
  uFogMist: { value: THREE.DataTexture };
  uFogSize: { value: THREE.Vector2 };
  uFogDark: { value: THREE.Color };
  uFogWisp: { value: THREE.Color };
}

/** A tile-per-texel map of fogMist, filtered so the fog's edge is soft; fill it with `updateFogMist`. */
export function fogMistUniforms(width: number, height: number): FogMistUniforms {
  const texture = new THREE.DataTexture(new Uint8Array(width * height), width, height, THREE.RedFormat, THREE.UnsignedByteType);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return {
    uFogMist: { value: texture },
    uFogSize: { value: new THREE.Vector2(width, height) },
    uFogDark: { value: new THREE.Color('#040507') },
    uFogWisp: { value: new THREE.Color('#1D212B') },
  };
}

export function updateFogMist(uniforms: FogMistUniforms, fade: Float32Array | null): void {
  const texture = uniforms.uFogMist.value;
  const data = texture.image.data as Uint8Array;
  if (!fade) data.fill(0);
  else for (let i = 0; i < data.length; i++) data[i] = Math.round(fogMist(fade[i]) * 255);
  texture.needsUpdate = true;
}

const FOG_MIST_HEAD = /* glsl */ `
${FRAY_GLSL}
uniform sampler2D uFogMist;
uniform vec2 uFogSize;
uniform vec3 uFogDark;
uniform vec3 uFogWisp;
uniform float uCloudTime;
uniform vec2 uWind;
varying vec3 vFogPos;
`;

const FOG_MIST_BODY = /* glsl */ `
{
  vec2 p = vFogPos.xz;
  float t = uCloudTime;
  // Swirls: the fog map is read through two slowly turning angle fields, so its edge flows and curls.
  vec2 s1 = p * 0.16;
  float a1 = tomeNoise(s1 + vec2(t * 0.045, -t * 0.03)) * 6.2832;
  float a2 = tomeNoise(s1 * 2.3 + vec2(-t * 0.07, t * 0.05) + 7.7) * 6.2832;
  vec2 swirl = vec2(cos(a1), sin(a1)) * 0.85 + vec2(cos(a2), sin(a2)) * 0.35;
  float amount = texture(uFogMist, (p + swirl) / uFogSize).r;
  // Smoke inside it, turning the other way and drifting with the wind.
  vec2 q = (p - swirl * 1.4) * 0.3 + uWind * t * 0.02;
  float smoke = tomeNoise(q) * 0.55 + tomeNoise(q * 2.2 + 3.1) * 0.3 + tomeNoise(q * 4.8 - 1.7) * 0.15;
  // Feathered from clear at the explored edge to opaque in the dark; the smoke only moves the feather.
  float alpha = clamp(amount + smoke * 1.4 * amount * (1.0 - amount), 0.0, 1.0);
  // Dark smoke, its wisps a shade lighter where it's thin, so the turning shows.
  diffuseColor.rgb = mix(uFogDark, uFogWisp, clamp(0.5 + smoke * 0.8, 0.0, 1.0) * (1.0 - amount * 0.7));
  diffuseColor.a = smoothstep(0.0, 1.0, alpha);
}
`;

/** World height the fog of war floats above the ground it covers, low enough to swallow undergrowth. */
export const FOG_MIST_LIFT = 0.3;

/**
 * The fog of war: dark, swirling smoke drawn over the ground and water meshes
 * (the same geometry, lifted a little), unlit so it stays dark by day; its
 * thickness from the fog map, its swirls from turning noise.
 */
export function fogMistMaterial(uniforms: FogMistUniforms): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: '#040507',
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, weatherUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFogPos;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\ntransformed.y += ${FOG_MIST_LIFT.toFixed(3)};\nvFogPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FOG_MIST_HEAD}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FOG_MIST_BODY}`);
  };
  material.customProgramCacheKey = () => 'tome-fog-mist-2';
  return material;
}
