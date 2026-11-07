/**
 * The terrain's drawn-on layer: a tile grid and tile marks (brush footprints,
 * hovered regions, drop targets), done in the terrain's own fragment shader so
 * they hug slopes, stay one crisp pixel wide at any zoom, and cost no geometry.
 *
 * Marks live in a one-byte-per-tile texture holding a palette index; each mark
 * fills its tiles with a wash of its colour and outlines the edge of the set.
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
}

export interface OverlayUniforms {
  [name: string]: THREE.IUniform;
  uGrid: { value: number };
  uGridColor: { value: THREE.Color };
  uMask: { value: THREE.DataTexture };
  uMaskSize: { value: THREE.Vector2 };
  uPalette: { value: THREE.Vector4[] };
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
  };
}

/**
 * Lays marks into a per-tile palette index; later marks win where they
 * overlap. Marks beyond the palette share its last slot.
 */
export function paintMarks(width: number, height: number, marks: TileMark[]): { data: Uint8Array; palette: { color: string; fill: number }[] } {
  const data = new Uint8Array(width * height);
  const palette: { color: string; fill: number }[] = [];
  for (const mark of marks) {
    const fill = mark.fill ?? 0.22;
    let slot = palette.findIndex((p) => p.color === mark.color && p.fill === fill);
    if (slot < 0) {
      if (palette.length < MARK_SLOTS - 1) slot = palette.push({ color: mark.color, fill }) - 1;
      else slot = palette.length - 1;
    }
    for (const t of mark.tiles) {
      const i = typeof t === 'number' ? t : t[0] >= 0 && t[1] >= 0 && t[0] < width && t[1] < height ? t[1] * width + t[0] : -1;
      if (i >= 0 && i < data.length) data[i] = slot + 1;
    }
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
  });
}

const VERTEX_HEAD = /* glsl */ `
attribute float aTile;
varying float vOverlayTile;
varying vec3 vOverlayPos;
varying float vOverlayUp;
`;

const VERTEX_BODY = /* glsl */ `
vOverlayTile = aTile;
vOverlayPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vOverlayUp = normal.y;
`;

const FRAGMENT_HEAD = /* glsl */ `
uniform float uGrid;
uniform vec3 uGridColor;
uniform sampler2D uMask;
uniform vec2 uMaskSize;
uniform vec4 uPalette[${MARK_SLOTS}];
varying float vOverlayTile;
varying vec3 vOverlayPos;
varying float vOverlayUp;
float overlayMaskAt(vec2 t) {
  if (t.x < 0.0 || t.y < 0.0 || t.x >= uMaskSize.x || t.y >= uMaskSize.y) return 0.0;
  return floor(texture2D(uMask, (t + 0.5) / uMaskSize).r * 255.0 + 0.5);
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

  float tileIndex = floor(vOverlayTile + 0.5);
  vec2 tile = vec2(mod(tileIndex, uMaskSize.x), floor(tileIndex / uMaskSize.x));
  float mark = overlayMaskAt(tile);
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

/** Teaches a terrain material the overlay. Its geometry needs an `aTile` attribute (tile index per vertex). */
export function withOverlay<M extends THREE.MeshLambertMaterial>(material: M, uniforms: OverlayUniforms): M {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAGMENT_BODY}`);
  };
  material.customProgramCacheKey = () => 'tome-terrain-overlay-1';
  return material;
}
