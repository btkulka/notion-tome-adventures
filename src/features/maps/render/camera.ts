/** Isometric camera maths shared by the rig, the navigator and the camera controls. */
import type { TilePoint } from '../types';

/** True isometric elevation: the camera looks down the (1, 1, 1) diagonal. */
export const ELEVATION = Math.atan(1 / Math.SQRT2);
export const MIN_ZOOM = 4;
export const MAX_ZOOM = 140;

export interface CameraPose {
  /** Ground point the camera looks at, in tile units. */
  x: number;
  y: number;
  /** Quarter turns from the default north-east facing. */
  turns: number;
  zoom: number;
}

/** What is on screen this frame, mid-animation included. */
export interface CameraView {
  x: number;
  y: number;
  /** Radians; see azimuthFor. */
  azimuth: number;
  /** Pixels per tile. */
  zoom: number;
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
}

export type GrabState = 'idle' | 'ready' | 'panning';

export interface CameraApi {
  getPose(): CameraPose;
  setPose(pose: CameraPose): void;
  rotate(direction: 1 | -1): void;
  zoomBy(factor: number): void;
  zoomTo(zoom: number): void;
  focus(tile: TilePoint, zoom?: number): void;
  panTo(x: number, y: number): void;
  /** Frame the whole map. */
  fit(): void;
  /** Turn back to the default facing by the shortest way. */
  resetNorth(): void;
  fitZoom(): number;
  getView(): CameraView;
  /** Calls `listener` on every frame the view moves. Returns the unsubscribe. */
  subscribe(listener: (view: CameraView) => void): () => void;
  /** Space is held over the map: the left button pans instead of using a tool. */
  spaceHeld(): boolean;
}

export const azimuthFor = (turns: number) => Math.PI / 4 + (turns * Math.PI) / 2;

/** Screen-right and screen-up, projected onto the ground (x, z). */
export function groundAxes(azimuth: number): { right: [number, number]; up: [number, number] } {
  return { right: [Math.cos(azimuth), -Math.sin(azimuth)], up: [-Math.sin(azimuth), -Math.cos(azimuth)] };
}

/** Ground point (tile units) under a screen offset from the canvas centre, y down. */
export function groundAt(view: Pick<CameraView, 'x' | 'y' | 'azimuth' | 'zoom'>, sx: number, sy: number): [number, number] {
  const { right, up } = groundAxes(view.azimuth);
  const along = -sy / (view.zoom * Math.sin(ELEVATION));
  return [view.x + (right[0] * sx) / view.zoom + up[0] * along, view.y + (right[1] * sx) / view.zoom + up[1] * along];
}

/** The four ground corners of what the camera sees, ignoring terrain height. */
export function viewFootprint(view: CameraView): [number, number][] {
  const w = view.width / 2;
  const h = view.height / 2;
  return [groundAt(view, -w, -h), groundAt(view, w, -h), groundAt(view, w, h), groundAt(view, -w, h)];
}
