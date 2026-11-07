import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { TileInfo } from '../inspect';

const TONE: Record<string, string> = {
  road: '#DEC27F',
  river: '#8FC3E8',
  pin: '#E6DDC8',
  muted: '#8F8572',
};

/**
 * What's under the cursor, in a plate that follows it around the map and
 * flips away from the edges. Positioned straight from pointer events, so
 * moving the mouse re-renders nothing.
 */
export function MapTooltip({ container, info, compact }: { container: RefObject<HTMLElement>; info: TileInfo | null; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Listens on the window so the pointer is known from the first move, before
  // the container's ref is attached.
  useLayoutEffect(() => {
    const place = () => {
      const host = container.current;
      const el = ref.current;
      const p = last.current;
      if (!host || !el || !p) return;
      const rect = host.getBoundingClientRect();
      const x = p.x - rect.left;
      const y = p.y - rect.top;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const left = x + 18 + w > rect.width - 8 ? x - 14 - w : x + 18;
      const top = y + 20 + h > rect.height - 8 ? y - 12 - h : y + 20;
      el.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
    };
    const move = (e: PointerEvent) => {
      last.current = { x: e.clientX, y: e.clientY };
      place();
    };
    window.addEventListener('pointermove', move, { passive: true });
    place();
    return () => window.removeEventListener('pointermove', move);
  }, [container, info]);

  if (!info) return null;
  const rows = compact ? info.rows.filter((r) => r.label === 'Ground' || r.label === 'Height') : info.rows;
  return (
    <div ref={ref} role="tooltip" className="t-overlay t-tooltip pointer-events-none absolute left-0 top-0 z-20 max-w-[320px] px-3.5 py-2.5 flex flex-col gap-1.5">
      <div className="flex flex-col">
        <span className="font-display text-[14px] font-semibold tracking-[0.06em] text-bone leading-tight">{info.title}</span>
        {info.subtitle && <span className="t-label text-[10px]">{info.subtitle}</span>}
      </div>
      {rows.length > 0 && (
        <dl className="m-0 flex flex-col gap-1 border-t border-rule pt-1.5">
          {rows.map((r, n) => (
            <div key={n} className="flex gap-2.5 text-[13px] leading-snug">
              <dt className="t-label text-[9.5px] w-[52px] shrink-0 pt-[3px]" style={{ color: r.tone && r.tone !== 'muted' ? TONE[r.tone] : undefined }}>{r.label}</dt>
              <dd className="m-0" style={{ color: r.tone === 'muted' ? TONE.muted : '#E6DDC8' }}>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
