import { useEffect, useState } from 'react';
import { describePath, type TileInfo } from '../inspect';
import { regionKind, type Region } from '../terrain/regions';
import type { LabelObject, PathObject, PinObject } from '../types';
import { COLORS } from './tools';

/** A text field that commits on Enter or blur, with an optional dice button that suggests a name. */
function NameField({ id, label, value, placeholder, onCommit, onSuggest }: { id: string; label: string; value: string; placeholder?: string; onCommit: (v: string) => void; onSuggest?: () => string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = (v = text) => {
    const trimmed = v.trim();
    if (trimmed !== value) onCommit(trimmed);
  };
  return (
    <div className="t-field">
      <label htmlFor={id} className="t-label">{label}</label>
      <div className="flex gap-1.5">
        <input
          id={id}
          className="t-input"
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setText(value);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        {onSuggest && (
          <button
            type="button"
            className="t-btn t-btn--icon shrink-0"
            aria-label="Suggest a name"
            title="Suggest a name"
            onClick={() => {
              const name = onSuggest();
              setText(name);
              onCommit(name);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden="true">
              <path d="M12 2 21 7v10l-9 5-9-5V7z M12 2v20 M3 7l9 5 9-5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function Check({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 min-h-[52px] border-y border-rule">
      <span className="flex flex-col"><span className="font-semibold">{label}</span><span className="t-small text-[13px]">{hint}</span></span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-[18px] w-[18px] accent-[#C4A35A]" />
    </label>
  );
}

function Header({ kicker, title, color }: { kicker: string; title: string; color: string }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="t-sigil" style={{ width: 38, height: 38, borderColor: color }}>
        <span className="t-diamond" style={{ background: color, transform: 'none', width: 8, height: 8 }} />
      </span>
      <div className="flex flex-col gap-1 min-w-0">
        <span className="t-label">{kicker}</span>
        <span className="t-h2 break-words">{title}</span>
      </div>
    </div>
  );
}

export function PathInspector({
  path,
  pins,
  scale,
  onChange,
  onDelete,
  onFocus,
  onSuggest,
}: {
  path: PathObject;
  pins: PinObject[];
  scale: number;
  onChange: (patch: { hidden?: boolean; data?: Partial<PathObject['data']> }) => void;
  onDelete: () => void;
  onFocus: () => void;
  onSuggest: () => string;
}) {
  const { name, detail } = describePath(path, pins, scale);
  const road = path.data.kind === 'road';
  return (
    <div className="flex flex-col gap-5">
      <Header kicker={road ? 'Road' : 'River'} title={name} color={road ? COLORS.road : COLORS.river} />
      <span className="t-small -mt-2">{detail} · {path.data.points.length} tiles</span>
      <NameField id="path-name" label="Name" value={path.data.name ?? ''} placeholder={road ? 'Named after the places it joins' : 'Unnamed'} onCommit={(v) => onChange({ data: { name: v || undefined } })} onSuggest={onSuggest} />
      <div className="flex flex-col gap-2">
        <span className="t-label">Kind</span>
        <div role="radiogroup" aria-label="Kind" className="t-seg" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <button type="button" role="radio" aria-checked={road} onClick={() => onChange({ data: { kind: 'road' } })}>Road</button>
          <button type="button" role="radio" aria-checked={!road} onClick={() => onChange({ data: { kind: 'river' } })}>River</button>
        </div>
      </div>
      <Check label="Hidden from players" hint="A secret way: never sent to their browsers" checked={path.hidden} onChange={(hidden) => onChange({ hidden })} />
      <div className="flex gap-2">
        <button type="button" className="t-btn" onClick={onFocus}>Show on map</button>
        <button type="button" className="t-btn t-btn--danger" onClick={onDelete}>Remove</button>
      </div>
    </div>
  );
}

export function TileInspector({
  info,
  tile,
  region,
  label,
  onName,
  onLabelChange,
  onRemoveName,
  onSuggest,
}: {
  info: TileInfo;
  tile: [number, number];
  region: Region | null;
  label: LabelObject | null;
  onName: (text: string) => void;
  onLabelChange: (patch: { hidden?: boolean }) => void;
  onRemoveName: () => void;
  onSuggest: () => string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Header kicker={`Tile ${tile[0]}, ${tile[1]}`} title={info.title} color={COLORS.gilt} />
      {info.subtitle && <span className="t-small -mt-2">{info.subtitle}</span>}
      <dl className="m-0 flex flex-col border-y border-rule">
        {info.rows.map((r, n) => (
          <div key={n} className="flex gap-3 py-2 border-t border-rule first:border-t-0 text-[14.5px]">
            <dt className="t-label text-[10px] w-[64px] shrink-0 pt-1">{r.label}</dt>
            <dd className="m-0 text-bone-2">{r.value}</dd>
          </div>
        ))}
      </dl>
      {region && region.size > 1 && (
        <div className="t-raised p-4 flex flex-col gap-3">
          <span className="t-label">This {regionKind(region).toLowerCase()} · {region.size} tiles</span>
          <NameField
            id="region-name"
            label={label ? 'Region name' : 'Name this region'}
            value={label?.data.text ?? ''}
            placeholder="The Gloamwood…"
            onCommit={(v) => (v ? onName(v) : label && onRemoveName())}
            onSuggest={onSuggest}
          />
          {label && (
            <>
              <label className="flex items-center justify-between gap-3">
                <span className="flex flex-col"><span className="font-semibold">Hidden from players</span><span className="t-small text-[13px]">Otherwise shown once they've seen it</span></span>
                <input type="checkbox" checked={label.hidden} onChange={(e) => onLabelChange({ hidden: e.target.checked })} className="h-[18px] w-[18px] accent-[#C4A35A]" />
              </label>
              <span className="t-small text-[13px]">Drag the name on the map to move it; it names whichever region it stands in.</span>
              <button type="button" className="t-btn t-btn--quiet self-start h-9 px-0" onClick={onRemoveName}>Remove the name</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
