import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { MAX_ZOOM, MIN_ZOOM, type CameraApi } from '../render/camera';

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
    <path d={d} />
  </svg>
);

const toSlider = (zoom: number) => Math.log(zoom / MIN_ZOOM) / Math.log(MAX_ZOOM / MIN_ZOOM);
const fromSlider = (v: number) => MIN_ZOOM * Math.pow(MAX_ZOOM / MIN_ZOOM, v);

/**
 * Turn, zoom and frame the map: a compass that points north as the view turns
 * (click to face north again), a zoom bar on a log scale, and fit-to-map.
 */
export function CameraControls({ camera }: { camera: MutableRefObject<CameraApi | null> }) {
  const needle = useRef<SVGGElement>(null);
  const [zoom, setZoom] = useState(0.5);
  const [percent, setPercent] = useState(100);

  useEffect(() => {
    let off: (() => void) | undefined;
    let frame = 0;
    // The rig mounts with the canvas, a moment after us.
    const attach = () => {
      const api = camera.current;
      if (!api) {
        frame = requestAnimationFrame(attach);
        return;
      }
      off = api.subscribe((view) => {
        // Map north (−y) sits `azimuth` clockwise from screen-up: 45° in the default facing.
        needle.current?.setAttribute('transform', `rotate(${(view.azimuth * 180) / Math.PI} 20 20)`);
        setZoom(toSlider(view.zoom));
        setPercent(Math.round((view.zoom / api.fitZoom()) * 100));
      });
    };
    attach();
    return () => {
      cancelAnimationFrame(frame);
      off?.();
    };
  }, [camera]);

  return (
    <div className="t-overlay flex items-center gap-1 p-1" role="group" aria-label="Camera">
      <button type="button" className="t-hud-btn" aria-label="Turn left" title="Turn left (Q)" onClick={() => camera.current?.rotate(-1)}>
        <Icon d="M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5" />
      </button>
      <button type="button" className="t-hud-btn t-compass" aria-label="Reset the facing" title="Compass · click to reset the facing (N)" onClick={() => camera.current?.resetNorth()}>
        <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true">
          <rect x="6" y="6" width="28" height="28" transform="rotate(45 20 20)" fill="none" stroke="#2E2A30" />
          <g ref={needle}>
            <path d="M20 6 24 20H16Z" fill="#DEC27F" />
            <path d="M20 34 24 20H16Z" fill="#4A4248" />
            <text x="20" y="5.5" textAnchor="middle" fontSize="7" fontFamily="Cinzel, serif" fontWeight="700" fill="#DEC27F">N</text>
          </g>
        </svg>
      </button>
      <button type="button" className="t-hud-btn" aria-label="Turn right" title="Turn right (E)" onClick={() => camera.current?.rotate(1)}>
        <Icon d="M21 12a9 9 0 1 1-3-6.7L21 8 M21 3v5h-5" />
      </button>
      <span className="w-px h-7 bg-rule mx-1" />
      <button type="button" className="t-hud-btn" aria-label="Zoom out" title="Zoom out (−)" onClick={() => camera.current?.zoomBy(1 / 1.4)}>
        <Icon d="M5 12h14" />
      </button>
      <input
        type="range"
        aria-label="Zoom"
        min={0}
        max={1}
        step={0.001}
        value={zoom}
        onChange={(e) => camera.current?.zoomTo(fromSlider(Number(e.target.value)))}
        className="t-range w-[96px]"
      />
      <button type="button" className="t-hud-btn" aria-label="Zoom in" title="Zoom in (+)" onClick={() => camera.current?.zoomBy(1.4)}>
        <Icon d="M5 12h14 M12 5v14" />
      </button>
      <span className="t-num text-[13px] w-[44px] text-center" aria-live="polite">{percent}%</span>
      <button type="button" className="t-hud-btn" aria-label="Fit the map" title="Fit the map (0)" onClick={() => camera.current?.fit()}>
        <Icon d="M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5" />
      </button>
    </div>
  );
}
