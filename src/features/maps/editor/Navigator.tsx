import { useCallback, useEffect, useMemo, useRef, type MutableRefObject, type PointerEvent } from 'react';
import { paintMinimap } from '../paintMinimap';
import { viewFootprint, type CameraApi, type CameraView } from '../render/camera';
import type { PinObject, TerrainGrid, TilePoint } from '../types';

const SIZE = 184;

/**
 * The whole region in miniature with the camera's footprint drawn on it.
 * Click or drag anywhere to fly the view there.
 */
export function Navigator({
  terrain,
  fade,
  pins,
  party,
  camera,
}: {
  terrain: TerrainGrid;
  fade: Float32Array | null;
  pins: PinObject[];
  party: TilePoint | null;
  camera: MutableRefObject<CameraApi | null>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const base = useMemo(() => document.createElement('canvas'), []);
  const view = useRef<CameraView | null>(null);
  const frame = useRef(0);
  const scale = SIZE / Math.max(terrain.width, terrain.height);
  const cssW = Math.round(terrain.width * scale);
  const cssH = Math.round(terrain.height * scale);

  const draw = useCallback(() => {
    frame.current = 0;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== cssW * dpr) canvas.width = cssW * dpr;
    if (canvas.height !== cssH * dpr) canvas.height = cssH * dpr;
    const k = scale * dpr;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

    const diamond = (x: number, y: number, r: number, fill: string) => {
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = dpr;
      ctx.strokeStyle = '#0A0A0B';
      ctx.stroke();
    };
    for (const p of pins) diamond((p.x + 0.5) * k, (p.y + 0.5) * k, 3 * dpr, p.hidden ? '#8D6FBF' : '#C4A35A');
    if (party) diamond((party[0] + 0.5) * k, (party[1] + 0.5) * k, 4.5 * dpr, '#DEC27F');

    const v = view.current;
    if (v) {
      const corners = viewFootprint(v);
      ctx.beginPath();
      corners.forEach(([x, y], n) => (n ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
      ctx.closePath();
      ctx.fillStyle = 'rgba(222,194,127,0.1)';
      ctx.fill();
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeStyle = '#DEC27F';
      ctx.stroke();
    }
  }, [base, cssW, cssH, scale, pins, party]);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    paintMinimap(base, terrain, fade);
    schedule();
  }, [base, terrain, fade, schedule]);

  useEffect(schedule, [schedule]);

  useEffect(() => {
    let off: (() => void) | undefined;
    let wait = 0;
    const attach = () => {
      if (!camera.current) {
        wait = requestAnimationFrame(attach);
        return;
      }
      off = camera.current.subscribe((v) => {
        view.current = v;
        schedule();
      });
    };
    attach();
    return () => {
      cancelAnimationFrame(wait);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      off?.();
    };
  }, [camera, schedule]);

  const fly = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    camera.current?.panTo(((e.clientX - rect.left) / rect.width) * terrain.width, ((e.clientY - rect.top) / rect.height) * terrain.height);
  };

  return (
    <div className="t-overlay p-1.5">
      <canvas
        ref={ref}
        style={{ width: cssW, height: cssH, display: 'block', cursor: 'pointer', touchAction: 'none' }}
        aria-label="Overview map: click or drag to move the view"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fly(e);
        }}
        onPointerMove={(e) => e.buttons & 1 && fly(e)}
      />
    </div>
  );
}
