import { useEffect, useImperativeHandle, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { azimuthFor, ELEVATION, groundAt, groundAxes, MAX_ZOOM, MIN_ZOOM, type CameraApi, type CameraPose, type CameraView, type GrabState } from './camera';

const DISTANCE = 120;
/** Keyboard pan speed, in screen pixels per second. */
const KEY_PAN_SPEED = 700;

export type { CameraApi, CameraPose, CameraView, GrabState } from './camera';

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);

const PAN_KEYS: Record<string, [number, number]> = {
  w: [0, 1], arrowup: [0, 1], s: [0, -1], arrowdown: [0, -1], a: [1, 0], arrowleft: [1, 0], d: [-1, 0], arrowright: [-1, 0],
};

/**
 * Orthographic isometric camera.
 *
 * - Pan: drag with `panButton`, the middle button, Space + left button, one finger, or WASD / arrows.
 * - Zoom: wheel or pinch, toward the cursor; + and − keys; 0 frames the map.
 * - Rotate: quarter turns with Q / E, the API, or a two-finger twist; N faces north again.
 */
export function CameraRig({
  width,
  height,
  initial,
  panButton,
  apiRef,
  onPoseChange,
  onGrab,
}: {
  width: number;
  height: number;
  initial?: Partial<CameraPose>;
  panButton: 0 | 2;
  apiRef?: MutableRefObject<CameraApi | null>;
  onPoseChange?: (pose: CameraPose) => void;
  onGrab?: (state: GrabState) => void;
}) {
  const { camera, gl, size, events } = useThree();
  const target = useRef(new THREE.Vector3(initial?.x ?? width / 2, 0, initial?.y ?? height / 2));
  const targetGoal = useRef(target.current.clone());
  const turns = useRef(initial?.turns ?? 0);
  const azimuth = useRef(azimuthFor(turns.current));
  const fitZoom = () => Math.max(MIN_ZOOM, Math.min(size.width, size.height) / ((width + height) * 0.62));
  const zoom = useRef(initial?.zoom ?? fitZoom());
  const zoomGoal = useRef(zoom.current);
  // Zooming keeps this ground point under this screen offset.
  const anchor = useRef<{ sx: number; sy: number; ground: [number, number] } | null>(null);
  // Until someone zooms, keep the whole map framed: the canvas can still be
  // settling its size when the rig mounts.
  const zoomed = useRef(initial?.zoom !== undefined);
  const listeners = useRef(new Set<(view: CameraView) => void>());
  const keys = useRef(new Set<string>());
  const space = useRef(false);
  const lastView = useRef<CameraView | null>(null);
  const lastPose = useRef<CameraPose | null>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const poseCallback = useRef(onPoseChange);
  poseCallback.current = onPoseChange;
  const grabCallback = useRef(onGrab);
  grabCallback.current = onGrab;

  useEffect(() => {
    if (zoomed.current || size.width === 0 || size.height === 0) return;
    zoom.current = zoomGoal.current = fitZoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, width, height]);

  const clamp = (v: THREE.Vector3) => {
    v.x = Math.min(width, Math.max(0, v.x));
    v.z = Math.min(height, Math.max(0, v.z));
  };
  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  const view = (): CameraView => ({ x: target.current.x, y: target.current.z, azimuth: azimuth.current, zoom: zoom.current, width: sizeRef.current.width, height: sizeRef.current.height });

  /** Zoom by `factor`, keeping the ground under screen offset (sx, sy) in place. */
  const zoomAbout = (factor: number, sx: number, sy: number) => {
    anchor.current = { sx, sy, ground: groundAt(view(), sx, sy) };
    zoomGoal.current = clampZoom(zoomGoal.current * factor);
    zoomed.current = true;
  };

  useImperativeHandle(apiRef, () => ({
    getPose: () => ({ x: targetGoal.current.x, y: targetGoal.current.z, turns: turns.current, zoom: zoomGoal.current }),
    setPose: (p) => {
      anchor.current = null;
      targetGoal.current.set(p.x, 0, p.y);
      clamp(targetGoal.current);
      turns.current = p.turns;
      zoomGoal.current = clampZoom(p.zoom);
      zoomed.current = true;
    },
    rotate: (direction) => {
      anchor.current = null;
      turns.current += direction;
    },
    zoomBy: (factor) => zoomAbout(factor, 0, 0),
    zoomTo: (z) => zoomAbout(clampZoom(z) / zoomGoal.current, 0, 0),
    focus: ([x, y], z) => {
      anchor.current = null;
      targetGoal.current.set(x + 0.5, 0, y + 0.5);
      if (z !== undefined) {
        zoomGoal.current = clampZoom(z);
        zoomed.current = true;
      }
    },
    panTo: (x, y) => {
      anchor.current = null;
      targetGoal.current.set(x, 0, y);
      clamp(targetGoal.current);
    },
    fit: () => {
      anchor.current = null;
      targetGoal.current.set(width / 2, 0, height / 2);
      zoomGoal.current = fitZoom();
      zoomed.current = false;
    },
    resetNorth: () => {
      anchor.current = null;
      turns.current = Math.round(turns.current / 4) * 4;
    },
    fitZoom,
    getView: view,
    subscribe: (listener) => {
      listeners.current.add(listener);
      listener(view());
      return () => listeners.current.delete(listener);
    },
    spaceHeld: () => space.current,
  }));

  // Pointer, wheel and keyboard handling.
  useEffect(() => {
    const el = gl.domElement;
    // Labels float over the canvas in this container; wheel and hover count there too.
    const host = (events.connected as HTMLElement | undefined) ?? el.parentElement ?? el;
    const pointers = new Map<number, { x: number; y: number }>();
    let panning = false;
    let inside = false;
    let pinch: { distance: number; angle: number } | null = null;
    let grab: GrabState = 'idle';

    const setGrab = () => {
      const next: GrabState = panning ? 'panning' : space.current && inside ? 'ready' : 'idle';
      if (next !== grab) {
        grab = next;
        grabCallback.current?.(grab);
      }
    };

    /** Moves the map with the pointer, as if dragging the ground by (dx, dy) pixels. */
    const panBy = (dx: number, dy: number) => {
      anchor.current = null;
      const { right, up } = groundAxes(azimuth.current);
      const z = zoom.current;
      const along = dy / z / Math.sin(ELEVATION);
      target.current.x += (-right[0] * dx) / z + up[0] * along;
      target.current.z += (-right[1] * dx) / z + up[1] * along;
      clamp(target.current);
      targetGoal.current.copy(target.current);
    };
    const offset = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      return [clientX - rect.left - rect.width / 2, clientY - rect.top - rect.height / 2] as const;
    };

    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (e.pointerType === 'touch') {
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), angle: Math.atan2(b.y - a.y, b.x - a.x) };
          panning = false;
        } else if (panButton === 0) panning = true;
      } else if (e.button === panButton || e.button === 1 || (e.button === 0 && space.current)) {
        panning = true;
        el.setPointerCapture(e.pointerId);
      }
      setGrab();
    };
    const onMove = (e: PointerEvent) => {
      const last = pointers.get(e.pointerId);
      if (!last) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const [sx, sy] = offset((a.x + b.x) / 2, (a.y + b.y) / 2);
        zoomAbout(distance / pinch.distance, sx, sy);
        pinch.distance = distance;
        const twist = Math.atan2(b.y - a.y, b.x - a.x) - pinch.angle;
        if (Math.abs(twist) > Math.PI / 5) {
          turns.current += twist > 0 ? -1 : 1;
          pinch.angle += twist;
        }
        return;
      }
      if (panning) panBy(dx, dy);
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) panning = false;
      setGrab();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      const delta = Math.max(-240, Math.min(240, e.deltaY * unit));
      // Trackpad pinches arrive as ctrl+wheel with small deltas.
      const factor = Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0016));
      const [sx, sy] = offset(e.clientX, e.clientY);
      zoomAbout(factor, sx, sy);
    };
    const onEnter = () => {
      inside = true;
      setGrab();
    };
    const onLeave = () => {
      inside = false;
      setGrab();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === ' ') {
        if (!inside && !space.current) return;
        e.preventDefault();
        space.current = true;
        setGrab();
      } else if (PAN_KEYS[key]) {
        keys.current.add(key);
        if (key.startsWith('arrow')) e.preventDefault();
      } else if (key === 'q') turns.current -= 1;
      else if (key === 'e') turns.current += 1;
      else if (key === '+' || key === '=') zoomAbout(1.35, 0, 0);
      else if (key === '-' || key === '_') zoomAbout(1 / 1.35, 0, 0);
      else if (key === '0' || key === 'home') apiRef?.current?.fit();
      else if (key === 'n') apiRef?.current?.resetNorth();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === ' ' && space.current) {
        e.preventDefault();
        space.current = false;
        setGrab();
      }
      keys.current.delete(key);
    };
    const onBlur = () => {
      keys.current.clear();
      space.current = false;
      setGrab();
    };
    const noMenu = (e: MouseEvent) => e.preventDefault();

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    host.addEventListener('pointerenter', onEnter);
    host.addEventListener('pointerleave', onLeave);
    host.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', noMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    el.style.touchAction = 'none';
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      host.removeEventListener('pointerenter', onEnter);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', noMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, events.connected, panButton, width, height]);

  useFrame((_, dt) => {
    // Keyboard panning, in screen pixels so it feels the same at any zoom.
    if (keys.current.size > 0) {
      let kx = 0;
      let ky = 0;
      for (const key of keys.current) {
        kx += PAN_KEYS[key]?.[0] ?? 0;
        ky += PAN_KEYS[key]?.[1] ?? 0;
      }
      if (kx || ky) {
        anchor.current = null;
        const step = KEY_PAN_SPEED * Math.min(dt, 0.05);
        const { right, up } = groundAxes(azimuth.current);
        const z = zoom.current;
        const along = (ky * step) / z / Math.sin(ELEVATION);
        targetGoal.current.x += (-right[0] * kx * step) / z + up[0] * along;
        targetGoal.current.z += (-right[1] * kx * step) / z + up[1] * along;
        clamp(targetGoal.current);
        target.current.copy(targetGoal.current);
      }
    }

    const goal = azimuthFor(turns.current);
    azimuth.current += (goal - azimuth.current) * Math.min(1, dt * 9);
    zoom.current += (zoomGoal.current - zoom.current) * Math.min(1, dt * 10);
    const a = anchor.current;
    if (a) {
      // Put the anchored ground point back under its screen offset at the new zoom.
      const { right, up } = groundAxes(azimuth.current);
      const along = -a.sy / (zoom.current * Math.sin(ELEVATION));
      target.current.x = a.ground[0] - (right[0] * a.sx) / zoom.current - up[0] * along;
      target.current.z = a.ground[1] - (right[1] * a.sx) / zoom.current - up[1] * along;
      clamp(target.current);
      targetGoal.current.copy(target.current);
      if (Math.abs(zoom.current - zoomGoal.current) < 1e-3 * zoomGoal.current) anchor.current = null;
    } else {
      target.current.lerp(targetGoal.current, Math.min(1, dt * 10));
    }

    const cam = camera as THREE.OrthographicCamera;
    const az = azimuth.current;
    cam.position.set(
      target.current.x + DISTANCE * Math.cos(ELEVATION) * Math.sin(az),
      target.current.y + DISTANCE * Math.sin(ELEVATION),
      target.current.z + DISTANCE * Math.cos(ELEVATION) * Math.cos(az)
    );
    cam.lookAt(target.current);
    if (Math.abs(cam.zoom - zoom.current) > 1e-3) {
      cam.zoom = zoom.current;
      cam.updateProjectionMatrix();
    }

    const now = view();
    const prev = lastView.current;
    if (!prev || Math.abs(prev.x - now.x) > 1e-4 || Math.abs(prev.y - now.y) > 1e-4 || Math.abs(prev.azimuth - now.azimuth) > 1e-5 || Math.abs(prev.zoom - now.zoom) > 1e-4 || prev.width !== now.width || prev.height !== now.height) {
      lastView.current = now;
      listeners.current.forEach((fn) => fn(now));
    }
    const pose: CameraPose = { x: targetGoal.current.x, y: targetGoal.current.z, turns: turns.current, zoom: zoomGoal.current };
    const lp = lastPose.current;
    if (!lp || lp.x !== pose.x || lp.y !== pose.y || lp.turns !== pose.turns || lp.zoom !== pose.zoom) {
      lastPose.current = pose;
      if (lp) poseCallback.current?.(pose);
    }
  });

  return null;
}
