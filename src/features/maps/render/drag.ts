import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { TilePoint } from '../types';

/** Tile under a screen point, or null off the map (see MapView). */
export type Picker = (clientX: number, clientY: number) => TilePoint | null;

export interface DragOptions {
  pick?: Picker | null;
  onClick?: () => void;
  /** Called as the dragged thing passes over each new tile. */
  onMove?: (tile: TilePoint) => void;
  /** Dropped on a tile; omitted means the thing can't be dragged. */
  onDrop?: (tile: TilePoint) => void;
}

/**
 * Pointer handlers that let an on-map label be clicked or dragged to another
 * tile. A press that moves more than a few pixels is a drag; otherwise a click.
 */
export function dragHandlers({ pick, onClick, onMove, onDrop }: DragOptions) {
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const el = e.currentTarget;
      const start = { x: e.clientX, y: e.clientY };
      let dragging = false;
      let last: TilePoint | null = null;
      el.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        if (!onDrop || !pick) return;
        if (!dragging && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 5) {
          dragging = true;
          el.style.cursor = 'grabbing';
        }
        if (!dragging) return;
        const tile = pick(ev.clientX, ev.clientY);
        if (tile && (!last || tile[0] !== last[0] || tile[1] !== last[1])) {
          last = tile;
          onMove?.(tile);
        }
      };
      const end = (ev: PointerEvent) => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', end);
        el.removeEventListener('pointercancel', end);
        el.style.cursor = '';
        if (ev.type === 'pointercancel') return;
        if (dragging) {
          if (last) onDrop?.(last);
        } else onClick?.();
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    },
    // Keyboard activation (Enter, Space) still selects; pointer clicks are handled above.
    onClick: (e: ReactMouseEvent) => {
      if (e.detail === 0) onClick?.();
    },
  };
}
