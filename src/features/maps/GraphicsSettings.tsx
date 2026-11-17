import { useEffect, useRef, useState } from 'react';
import { MODEL_DETAILS, useModelDetail, useRenderQuality } from './render/quality';

function Steps<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="t-seg" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

/**
 * Per-browser graphics steps: model detail (which prop GLB loads) and render
 * sharpness. Models start at Medium and render at High; the lower steps are
 * there for slower machines.
 */
export function GraphicsSettings() {
  const [detail, setDetail] = useModelDetail();
  const [quality, setQuality] = useRenderQuality();
  return (
    <div className="flex flex-col gap-2.5">
      <span className="t-label">Models</span>
      {/* No JSX type arguments (<Steps<T>>): the dev server's lovable-tagger breaks on them. T comes from value. */}
      <Steps label="Model detail" value={detail} options={MODEL_DETAILS} onChange={setDetail} />
      <span className="t-small text-[12.5px]">
        {detail === 'minis'
          ? 'Medium, with hand-painted hi-def miniatures in place of the props that have one, up close. The heaviest step.'
          : `${detail === 'medium' ? 'Dressed stonework, pointed windows, gilt finials, pennants and banners, runes that glow.' : 'Rounder towers, finer rocks and leaves, windows that light up at night.'} Each step up doubles the detail.`}
      </span>
      <span className="t-label mt-1">Render</span>
      <Steps label="Render quality" value={quality} options={['standard', 'high'] as const} onChange={setQuality} />
      <span className="t-small text-[12.5px]">High draws at twice the screen's sharpness and steps down by itself if this machine can't keep up.</span>
    </div>
  );
}

/** A toolbar button opening GraphicsSettings above it; closes on outside click or Escape. */
export function GraphicsMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button type="button" className={`t-btn h-12 w-12 px-0 justify-center ${open ? 'text-gilt-hi' : ''}`} aria-label="Graphics" title="Graphics" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden="true">
          <path d="M12 3 21 8 12 13 3 8z M3 12l9 5 9-5 M3 16l9 5 9-5" />
        </svg>
      </button>
      {open && (
        <div role="dialog" aria-label="Graphics" className="t-overlay t-pop absolute bottom-[calc(100%+12px)] right-0 z-40 w-[290px] p-4">
          <GraphicsSettings />
        </div>
      )}
    </div>
  );
}
