/**
 * The weather overhead: cloud shadows drifting across the ground and water
 * (the ground and water shaders read `weatherUniforms` through CLOUD_SHADE_GLSL),
 * and see-through mist banks rolling over the map at two heights, the peaks
 * standing up through them. All of it follows the table's weather: a few wisps
 * when it's clear, a thick rolling blanket in fog. The mist fades near the
 * map's edges and as the camera zooms in, so it never hides what the DM is
 * working on.
 */
import * as THREE from 'three';
import { MAX_STEP, STEP_HEIGHT } from '../constants';
import type { Weather } from '../types';
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
