import type { ReactNode } from 'react';
import type { HeightMode } from '../editing';
import { BIOMES, type BiomeId } from '../terrain/biomes';
import type { PinType } from '../types';
import { MAX_BRUSH, PAINTABLE, PIN_DRAG_TYPE, PIN_TYPES, type PathMode, type Tool } from './tools';

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="t-seg" style={{ gridTemplateColumns: `repeat(${options.length}, auto)` }}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} title={o.title} className="px-3 h-[34px]" onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const Rule = () => <span className="w-px h-6 bg-rule" />;
const Hint = ({ children }: { children: ReactNode }) => <span className="t-small text-[13px]">{children}</span>;
const Title = ({ children }: { children: ReactNode }) => <span className="t-label" style={{ color: 'var(--gilt)' }}>{children}</span>;

export interface ToolOptionsProps {
  tool: Tool;
  brush: number;
  setBrush: (n: number) => void;
  heightMode: HeightMode;
  setHeightMode: (m: HeightMode) => void;
  paintBiome: BiomeId;
  setPaintBiome: (b: BiomeId) => void;
  fogMode: 'reveal' | 'hide';
  setFogMode: (m: 'reveal' | 'hide') => void;
  pathMode: PathMode;
  setPathMode: (m: PathMode) => void;
  draftLength: number;
  onFinish: () => void;
  onCancel: () => void;
  onUndoLeg: () => void;
  pinType: PinType;
  setPinType: (t: PinType) => void;
  measured: string | null;
  hasParty: boolean;
}

/** The bar across the top of the map with the current tool's settings. */
export function ToolOptions(p: ToolOptionsProps) {
  const brush = (
    <>
      <Rule />
      <label htmlFor="brush-size" className="t-small">Size</label>
      <input id="brush-size" type="range" min={1} max={MAX_BRUSH} value={p.brush} onChange={(e) => p.setBrush(Number(e.target.value))} className="t-range w-[96px]" />
      <span className="t-num w-4 text-center">{p.brush}</span>
    </>
  );

  let body: ReactNode = null;
  if (p.tool === 'select') {
    body = (
      <>
        <Title>Select</Title>
        <Hint>Click a place, road, river or region to inspect it · drag labels to move them · drag the ground to pan</Hint>
      </>
    );
  } else if (p.tool === 'height') {
    body = (
      <>
        <Title>Ground</Title>
        <Seg
          label="Height brush"
          value={p.heightMode}
          onChange={p.setHeightMode}
          options={[
            { value: 'raise', label: 'Raise' },
            { value: 'lower', label: 'Lower' },
            { value: 'smooth', label: 'Smooth' },
            { value: 'flatten', label: 'Flatten', title: 'Level everything to the height where the stroke began' },
          ]}
        />
        {brush}
        <Hint>Shift inverts · one-step rises become slopes</Hint>
      </>
    );
  } else if (p.tool === 'biome') {
    body = (
      <>
        <Title>Biome</Title>
        <div className="flex gap-1" role="radiogroup" aria-label="Biome to paint">
          {PAINTABLE.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-label={BIOMES[b].name}
              title={BIOMES[b].name}
              aria-checked={p.paintBiome === b}
              onClick={() => p.setPaintBiome(b)}
              className="t-swatch"
              style={{ background: BIOMES[b].top }}
            />
          ))}
        </div>
        <span className="font-semibold text-[14px] w-[84px]">{BIOMES[p.paintBiome].name}</span>
        {brush}
        <Hint>Alt-click the map to pick up its biome</Hint>
      </>
    );
  } else if (p.tool === 'fog') {
    body = (
      <>
        <Title>Fog</Title>
        <Seg label="Fog brush" value={p.fogMode} onChange={p.setFogMode} options={[{ value: 'reveal', label: 'Reveal' }, { value: 'hide', label: 'Hide' }]} />
        {brush}
        <Hint>Shift inverts</Hint>
      </>
    );
  } else if (p.tool === 'road' || p.tool === 'river') {
    const road = p.tool === 'road';
    body = (
      <>
        <Title>{road ? 'Road' : 'River'}</Title>
        <Seg
          label={road ? 'Road tool' : 'River tool'}
          value={p.pathMode}
          onChange={p.setPathMode}
          options={[
            { value: 'auto', label: road ? 'Route' : 'Flow', title: road ? 'Click waypoints; the road finds its way between them' : 'Click a spring; the river runs downhill to water' },
            { value: 'draw', label: 'Draw', title: 'Drag or click to lay it tile by tile' },
            { value: 'erase', label: 'Erase', title: `Brush over a ${p.tool} to cut it` },
          ]}
        />
        {p.pathMode === 'erase' && brush}
        {p.pathMode !== 'erase' && p.draftLength === 0 && (
          <Hint>{road ? (p.pathMode === 'auto' ? 'Click where the road starts' : 'Drag or click to lay the road') : p.pathMode === 'auto' ? 'Hover to preview, click a spring to run it' : 'Drag or click to lay the river'}</Hint>
        )}
        {p.draftLength > 0 && (
          <>
            <Hint>{p.draftLength === 1 ? '1 tile' : `${p.draftLength} tiles`} · Enter finishes</Hint>
            <button type="button" className="t-btn h-[34px]" disabled={p.draftLength < 2} onClick={p.onFinish}>Finish</button>
            <button type="button" className="t-btn t-btn--quiet h-[34px] px-2" onClick={p.onUndoLeg}>Back</button>
            <button type="button" className="t-btn t-btn--quiet h-[34px] px-2" onClick={p.onCancel}>Cancel</button>
          </>
        )}
      </>
    );
  } else if (p.tool === 'pin') {
    body = (
      <>
        <Title>Place</Title>
        <div className="flex flex-wrap gap-1 max-w-[560px]" role="radiogroup" aria-label="Kind of place">
          {PIN_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={p.pinType === t}
              draggable
              title={`${titleCase(t)} · click the map, or drag this onto it`}
              onDragStart={(e) => {
                e.dataTransfer.setData(PIN_DRAG_TYPE, t);
                e.dataTransfer.effectAllowed = 'copy';
                p.setPinType(t);
              }}
              onClick={() => p.setPinType(t)}
              className="t-chip t-chip--drag"
            >
              <i className="t-diamond" style={{ width: 6, height: 6 }} />
              {titleCase(t)}
            </button>
          ))}
        </div>
        <Hint>New places start hidden</Hint>
      </>
    );
  } else if (p.tool === 'party') {
    body = <Hint>{p.hasParty ? 'Click a tile, or drag the banner, to move the company' : 'Click a tile to place the company on this map'}</Hint>;
  } else if (p.tool === 'measure') {
    body = (
      <>
        <Title>Measure</Title>
        <Hint>{p.measured ?? 'Click two tiles to measure the way between them, roads included'}</Hint>
      </>
    );
  }
  if (!body) return null;
  return <div className="t-overlay t-toolbar absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center justify-center gap-3 px-3.5 py-2 max-w-[calc(100%-32px)]">{body}</div>;
}
