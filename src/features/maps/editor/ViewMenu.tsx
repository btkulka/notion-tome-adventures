import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ViewSettings } from './viewSettings';

/** A popover opening to the right of a button on the tool rail; closes on outside click or Escape. */
function Popover({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
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
      <button type="button" aria-label={label} title={label} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)} className={`t-rail-btn ${open ? 't-rail-btn--on' : ''}`}>
        {icon}
        <span className="font-display font-semibold text-[8.5px] tracking-[0.12em] uppercase">{label}</span>
      </button>
      {open && (
        <div role="dialog" aria-label={label} className="t-overlay t-pop absolute left-[calc(100%+10px)] bottom-0 z-40 w-[290px] max-h-[80vh] overflow-y-auto p-4 flex flex-col gap-3">
          {children}
        </div>
      )}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="flex flex-col">
        <span className="font-semibold text-[15px]">{label}</span>
        {hint && <span className="t-small text-[12.5px]">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-[17px] w-[17px] accent-[#C4A35A]" />
    </label>
  );
}

export function ViewMenu({ settings, onChange }: { settings: ViewSettings; onChange: (patch: Partial<ViewSettings>) => void }) {
  return (
    <Popover
      label="View"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden="true">
          <path d="M12 3 21 8 12 13 3 8z M3 12l9 5 9-5 M3 16l9 5 9-5" />
        </svg>
      }
    >
      <span className="t-label">Layers</span>
      <Toggle label="Grid" hint="Tile lines on the ground (G)" checked={settings.grid} onChange={(grid) => onChange({ grid })} />
      <div className={`flex items-center gap-3 ${settings.grid ? '' : 'opacity-40'}`}>
        <label htmlFor="grid-opacity" className="t-small w-[64px]">Strength</label>
        <input
          id="grid-opacity"
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          disabled={!settings.grid}
          value={settings.gridOpacity}
          onChange={(e) => onChange({ gridOpacity: Number(e.target.value) })}
          className="t-range flex-1"
        />
        <span className="t-num text-[13px] w-[36px] text-right">{Math.round(settings.gridOpacity * 100)}%</span>
      </div>
      <Toggle label="Region names" hint="The Gloamwood, the Greyspine…" checked={settings.regionNames} onChange={(regionNames) => onChange({ regionNames })} />
      <Toggle label="Place labels" checked={settings.pinLabels} onChange={(pinLabels) => onChange({ pinLabels })} />
      <Toggle label="Scenery" hint="Hide trees and rocks to sculpt" checked={settings.scenery} onChange={(scenery) => onChange({ scenery })} />
      <span className="t-label mt-1">Help</span>
      <Toggle label="Hover details" hint="Region, ground, roads under the cursor" checked={settings.tooltips} onChange={(tooltips) => onChange({ tooltips })} />
      <Toggle label="Overview map" checked={settings.minimap} onChange={(minimap) => onChange({ minimap })} />
    </Popover>
  );
}

const KEYS: [string, string][] = [
  ['1 – 9', 'Pick a tool'],
  ['W A S D · arrows', 'Pan'],
  ['Right or middle drag', 'Pan'],
  ['Space + drag', 'Pan with any tool'],
  ['Wheel · pinch', 'Zoom toward the cursor'],
  ['+ / −', 'Zoom'],
  ['0', 'Fit the map'],
  ['Q / E', 'Turn the view'],
  ['N', 'Reset the facing'],
  ['[ / ]', 'Brush size'],
  ['Shift + paint', 'Lower ground · hide fog'],
  ['Alt + click', 'Pick up a biome'],
  ['Enter', 'Finish a road or river'],
  ['Backspace', 'Take back the last leg'],
  ['Delete', 'Remove what’s selected'],
  ['Esc', 'Cancel · deselect'],
  ['Ctrl + Z / Ctrl + Shift + Z', 'Undo · redo'],
  ['G', 'Grid on or off'],
];

export function ShortcutsMenu() {
  return (
    <Popover
      label="Keys"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden="true">
          <path d="M3 6h18v12H3z M7 10h1 M11 10h1 M15 10h1 M7 14h10" />
        </svg>
      }
    >
      <span className="t-label">Keyboard and mouse</span>
      <dl className="m-0 flex flex-col gap-1.5">
        {KEYS.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-[13.5px]">
            <dt className="font-display text-[11px] font-semibold tracking-[0.08em] text-gilt-hi pt-0.5">{k}</dt>
            <dd className="m-0 text-bone-2 text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </Popover>
  );
}
