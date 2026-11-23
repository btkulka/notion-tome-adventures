/**
 * The terrain's drawn-on layer: a tile grid and tile marks (brush footprints,
 * hovered regions, drop targets), done in the terrain's own fragment shader so
 * they hug slopes, stay one crisp pixel wide at any zoom, and cost no geometry.
 *
 * Marks live in a one-byte-per-tile texture holding a palette index; each mark
 * fills its tiles with a wash of its colour and outlines the edge of the set.
 * The tile under each pixel comes from where the pixel is in the world, so a
 * mark covers exactly its cells whatever the mesh looks like.
 *
 * Soft marks (a hovered or selected region) are read where the ground's looks
 * are (the same fraying as the ground shader), so they follow the land's
 * blended edges with a light wash and a thin rim, and fade in rather than snap.
 * Crisp marks (brushes, a single tile, drop targets) stay exact squares, since
 * they show which cells an edit touches.
 */
import * as THREE from 'three';
import type { TilePoint } from '../types';

/** Palette slots; index 0 means unmarked. */
export const MARK_SLOTS = 8;

export interface TileMark {
  tiles: Iterable<number | TilePoint>;
  color: string;
  /** Strength of the fill wash, 0..1. The outline is always drawn. */
  fill?: number;
  /** Follow the land's blended edges and fade in (regions), instead of exact squares. */
  soft?: boolean;
}

export interface OverlayUniforms {
  [name: string]: THREE.IUniform;
  uGrid: { value: number };
  uGridColor: { value: THREE.Color };
  uMask: { value: THREE.DataTexture };
  uMaskSize: { value: THREE.Vector2 };
  uPalette: { value: THREE.Vector4[] };
  /** 1 for a soft slot. */
  uSoft: { value: number[] };
  /** How far each slot has faded in, 0..1 (see `fadeMarks`). */
  uFade: { value: number[] };
  /** What each slot showed last, so a soft slot only fades in again when it changes. */
  uSeen: { value: string[] };
  /** 1 while any soft mark is shown; the shader skips its fraying otherwise. */
  uAnySoft: { value: number };
}

export function createOverlay(width: number, height: number): OverlayUniforms {
  const texture = new THREE.DataTexture(new Uint8Array(width * height), width, height, THREE.RedFormat, THREE.UnsignedByteType);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return {
    uGrid: { value: 0 },
    uGridColor: { value: new THREE.Color('#0B0A0C') },
    uMask: { value: texture },
    uMaskSize: { value: new THREE.Vector2(width, height) },
    uPalette: { value: Array.from({ length: MARK_SLOTS }, () => new THREE.Vector4()) },
    uSoft: { value: new Array(MARK_SLOTS).fill(0) },
    uFade: { value: new Array(MARK_SLOTS).fill(1) },
    uSeen: { value: new Array(MARK_SLOTS).fill('') },
    uAnySoft: { value: 0 },
  };
}

/**
 * Lays marks into a per-tile palette index; later marks win where they
 * overlap. Marks beyond the palette share its last slot.
 */
export function paintMarks(
  width: number,
  height: number,
  marks: TileMark[]
): { data: Uint8Array; palette: { color: string; fill: number; soft: boolean; seen: string }[] } {
  const data = new Uint8Array(width * height);
  const palette: { color: string; fill: number; soft: boolean; seen: string }[] = [];
  for (const mark of marks) {
    const fill = mark.fill ?? 0.22;
    const soft = mark.soft ?? false;
    let slot = palette.findIndex((p) => p.color === mark.color && p.fill === fill && p.soft === soft);
    if (slot < 0) {
      if (palette.length < MARK_SLOTS - 1) slot = palette.push({ color: mark.color, fill, soft, seen: '' }) - 1;
      else slot = palette.length - 1;
    }
    let count = 0;
    let first = -1;
    for (const t of mark.tiles) {
      const i = typeof t === 'number' ? t : t[0] >= 0 && t[1] >= 0 && t[0] < width && t[1] < height ? t[1] * width + t[0] : -1;
      if (i >= 0 && i < data.length) {
        data[i] = slot + 1;
        if (first < 0) first = i;
        count++;
      }
    }
    palette[slot].seen += `${first}:${count};`;
  }
  return { data, palette };
}

export function applyMarks(uniforms: OverlayUniforms, marks: TileMark[]): void {
  const size = uniforms.uMaskSize.value;
  const { data, palette } = paintMarks(size.x, size.y, marks);
  const texture = uniforms.uMask.value;
  (texture.image.data as Uint8Array).set(data);
  texture.needsUpdate = true;
  const color = new THREE.Color();
  palette.forEach((p, n) => {
    color.set(p.color).convertSRGBToLinear();
    uniforms.uPalette.value[n + 1].set(color.r, color.g, color.b, p.fill);
    uniforms.uSoft.value[n + 1] = p.soft ? 1 : 0;
    // A soft mark fades in when it shows something new; one that stays put keeps its place.
    const seen = `${p.color}|${p.seen}`;
    if (!p.soft) uniforms.uFade.value[n + 1] = 1;
    else if (uniforms.uSeen.value[n + 1] !== seen) uniforms.uFade.value[n + 1] = 0;
    uniforms.uSeen.value[n + 1] = seen;
  });
  for (let n = palette.length + 1; n < MARK_SLOTS; n++) uniforms.uSeen.value[n] = '';
  uniforms.uAnySoft.value = palette.some((p) => p.soft) ? 1 : 0;
}

/** Moves soft marks' fade toward fully shown; call every frame. */
export function fadeMarks(uniforms: OverlayUniforms, dt: number): void {
  const k = 1 - Math.exp(-dt * 12);
  const fade = uniforms.uFade.value;
  for (let n = 1; n < MARK_SLOTS; n++) if (fade[n] < 1) fade[n] = fade[n] > 0.995 ? 1 : fade[n] + (1 - fade[n]) * k;
}

/**
 * Value noise and the fraying the ground shader reads its cells through
 * (terrainMaterial.ts), shared so soft marks follow the same edges.
 */
export const FRAY_GLSL = /* glsl */ `
float tomeHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tomeNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = mix(tomeHash(i), tomeHash(i + vec2(1.0, 0.0)), u.x);
  float b = mix(tomeHash(i + vec2(0.0, 1.0)), tomeHash(i + vec2(1.0, 1.0)), u.x);
  return mix(a, b, u.y) * 2.0 - 1.0;
}
vec2 tomeFray(vec2 p) {
  return p
    + vec2(tomeNoise(p * 0.7 + vec2(31.7, -12.3)), tomeNoise(p * 0.7 + vec2(-17.9, 44.1))) * 0.36
    + vec2(tomeNoise(p * 2.3 + vec2(-4.1, 9.4)), tomeNoise(p * 2.3 + vec2(7.3, -2.6))) * 0.09;
}
`;

const VERTEX_HEAD = /* glsl */ `
varying vec3 vOverlayPos;
varying float vOverlayUp;
`;

const VERTEX_BODY = /* glsl */ `
vOverlayPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vOverlayUp = normal.y;
`;

const FRAGMENT_HEAD = /* glsl */ `
uniform float uGrid;
uniform vec3 uGridColor;
uniform sampler2D uMask;
uniform vec2 uMaskSize;
uniform vec4 uPalette[${MARK_SLOTS}];
uniform float uSoft[${MARK_SLOTS}];
uniform float uFade[${MARK_SLOTS}];
uniform float uAnySoft;
varying vec3 vOverlayPos;
varying float vOverlayUp;
${FRAY_GLSL}
float overlayMaskAt(vec2 t) {
  if (t.x < 0.0 || t.y < 0.0 || t.x >= uMaskSize.x || t.y >= uMaskSize.y) return 0.0;
  return floor(texture2D(uMask, (t + 0.5) / uMaskSize).r * 255.0 + 0.5);
}
float overlaySoftAt(vec2 p) {
  float m = overlayMaskAt(floor(p));
  return m > 0.5 && uSoft[int(m)] > 0.5 ? m : 0.0;
}
`;

const FRAGMENT_BODY = /* glsl */ `
{
  // Fog darkens the vertex colour; the overlay fades out with what's unknown.
  float overlaySeen = 1.0;
  #ifdef USE_COLOR
    overlaySeen = smoothstep(0.08, 0.35, max(vColor.r, max(vColor.g, vColor.b)));
  #endif
  float onTop = step(0.5, vOverlayUp);
  vec2 fw = max(fwidth(vOverlayPos.xz), vec2(1e-4));

  vec2 cell = fract(vOverlayPos.xz);
  vec2 edgePx = min(cell, 1.0 - cell) / fw;
  float gridLine = 1.0 - smoothstep(0.2, 1.1, min(edgePx.x, edgePx.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, uGridColor, gridLine * uGrid * onTop * overlaySeen);

  // The tile under this pixel, from where it is in the world.
  vec2 tile = floor(vOverlayPos.xz);
  float mark = overlayMaskAt(tile);
  if (mark > 0.5 && uSoft[int(mark)] > 0.5) mark = 0.0;

  // Soft marks: read through the fraying, washed lightly, with a thin rim where the set ends.
  vec2 frayedAt = vOverlayPos.xz;
  float soft = 0.0;
  if (uAnySoft > 0.5 && mark < 0.5) {
    frayedAt = tomeFray(vOverlayPos.xz);
    soft = overlaySoftAt(frayedAt);
  }
  if (soft > 0.5) {
    vec4 col = uPalette[int(soft)];
    float shown = uFade[int(soft)] * overlaySeen;
    diffuseColor.rgb = mix(diffuseColor.rgb, col.rgb, col.a * shown);
    totalEmissiveRadiance += col.rgb * col.a * shown * 0.3;
    float rim = 0.0;
    vec2 px = fw * 1.6;
    if (overlaySoftAt(frayedAt + vec2(px.x, 0.0)) != soft || overlaySoftAt(frayedAt - vec2(px.x, 0.0)) != soft
      || overlaySoftAt(frayedAt + vec2(0.0, px.y)) != soft || overlaySoftAt(frayedAt - vec2(0.0, px.y)) != soft) rim = 1.0;
    rim *= shown * mix(0.5, 1.0, onTop);
    diffuseColor.rgb = mix(diffuseColor.rgb, col.rgb, rim * 0.7);
    totalEmissiveRadiance += col.rgb * rim * 0.5;
  }

  if (mark > 0.5) {
    vec4 col = uPalette[int(mark)];
    // Walls take half the wash, so a marked cliff reads as marked without turning to paint.
    float wash = col.a * overlaySeen * mix(0.45, 1.0, onTop);
    diffuseColor.rgb = mix(diffuseColor.rgb, col.rgb, wash);
    totalEmissiveRadiance += col.rgb * wash * 0.3;
    vec2 local = clamp(vOverlayPos.xz - tile, 0.0, 1.0);
    vec4 toEdge = vec4(local.y / fw.y, (1.0 - local.y) / fw.y, local.x / fw.x, (1.0 - local.x) / fw.x);
    float outline = 0.0;
    if (overlayMaskAt(tile + vec2(0.0, -1.0)) != mark) outline = max(outline, 1.0 - smoothstep(1.2, 2.4, toEdge.x));
    if (overlayMaskAt(tile + vec2(0.0, 1.0)) != mark) outline = max(outline, 1.0 - smoothstep(1.2, 2.4, toEdge.y));
    if (overlayMaskAt(tile + vec2(-1.0, 0.0)) != mark) outline = max(outline, 1.0 - smoothstep(1.2, 2.4, toEdge.z));
    if (overlayMaskAt(tile + vec2(1.0, 0.0)) != mark) outline = max(outline, 1.0 - smoothstep(1.2, 2.4, toEdge.w));
    outline *= onTop * overlaySeen;
    diffuseColor.rgb = mix(diffuseColor.rgb, col.rgb, outline);
    totalEmissiveRadiance += col.rgb * outline * 0.8;
  }
}
`;

/**
 * Teaches a terrain material the overlay. `extend` adds a material's own shader
 * changes (the ground's and water's looks), and `key` names that variant. Its
 * changes go in first, so the overlay's head (with FRAY_GLSL) comes before
 * theirs and they can use it.
 */
export function withOverlay<M extends THREE.Material>(
  material: M,
  uniforms: OverlayUniforms,
  extend?: (shader: THREE.WebGLProgramParametersWithUniforms) => void,
  key = ''
): M {
  material.onBeforeCompile = (shader) => {
    extend?.(shader);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAGMENT_BODY}`);
  };
  material.customProgramCacheKey = () => `tome-terrain-overlay-2${key}`;
  return material;
}
