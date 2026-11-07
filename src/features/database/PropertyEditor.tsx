import React, { useEffect, useMemo, useState } from 'react';
import { databaseApi, type Cell, type Column, type EditValue, type Entry, type EntrySummary } from './api';
import { cellItems, compareText, isPageRef, itemText } from './browse';
import { CellValue } from './CellValue';
import { editorKind, type EditorKind } from './editing';
import { Glyph, Thumb } from './Glyph';
import { glyphFor } from './glyphs';

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Could not save that');

/**
 * One property of an entry: its value, a pencil to override it, and, once
 * overridden, the value imported from Notion with a way back to it.
 */
export function PropertyRow({ entry, column, index, onChange }: { entry: Entry; column: Column; index: number; onChange: (entry: Entry) => void }) {
  const cell = entry.cells[column.name] ?? null;
  const override = entry.overrides[column.name];
  const kind = editorKind(column, override ? override.original : cell);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<Entry>) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await action());
      setEditing(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`db-prop db-rise ${override ? 'is-edited' : ''} ${editing ? 'is-editing' : ''}`} style={{ '--i': index } as React.CSSProperties}>
      <dt className="t-label">
        {column.name}
        {override && (
          <span className="db-edited" title={`Changed${override.by ? ` by ${override.by}` : ''} on ${new Date(override.updatedAt * 1000).toLocaleDateString()}`}>
            <i className="t-diamond" /> Edited
          </span>
        )}
      </dt>
      <dd className="m-0 min-w-0 flex flex-col gap-2">
        {editing && kind ? (
          <Editor kind={kind} column={column} cell={cell} busy={busy} onSave={(v) => run(() => databaseApi.override(entry.id, column.name, v))} onCancel={() => setEditing(false)} />
        ) : (
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <CellValue column={column} cell={cell} />
            </div>
            {kind && (
              <button type="button" className="db-pencil" aria-label={`Change ${column.name}`} title={`Change ${column.name}`} onClick={() => setEditing(true)}>
                <Pencil />
              </button>
            )}
          </div>
        )}
        {override && !editing && (
          <div className="db-original">
            <span className="t-label">Notion</span>
            <span className="min-w-0 flex-1"><CellValue column={column} cell={override.original} /></span>
            <button type="button" className="db-restore" disabled={busy} onClick={() => run(() => databaseApi.restore(entry.id, column.name))}>
              Restore
            </button>
          </div>
        )}
        {error && <p className="m-0 text-blood-text text-[14px]" role="alert">{error}</p>}
      </dd>
    </div>
  );
}

export function Pencil() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16z M13 7l4 4" />
    </svg>
  );
}

function initial(kind: EditorKind, cell: Cell): EditValue {
  switch (kind) {
    case 'text':
    case 'paragraph':
    case 'choice':
      return typeof cell === 'string' ? cell : cell === null ? '' : itemText(cellItems(cell)[0] ?? '');
    case 'number':
      return typeof cell === 'number' ? String(cell) : '';
    case 'yesno':
      return cell === true;
    case 'date':
      return typeof cell === 'string' ? cell.split(' → ')[0].slice(0, 10) : '';
    case 'choices':
      return cellItems(cell).map(itemText);
    case 'links':
      return cellItems(cell).filter((i) => typeof i === 'object' && isPageRef(i)).map((i) => (i as { id: string }).id);
  }
}

/** The typed value the Worker expects for each kind of field. */
function finish(kind: EditorKind, value: EditValue): EditValue {
  if (kind === 'number') {
    const text = String(value ?? '').trim();
    return text === '' ? null : Number(text);
  }
  return value;
}

/** An inline form for one property, shaped by its type. Enter saves, Escape backs out. */
export function Editor({
  kind,
  column,
  cell,
  busy,
  onSave,
  onCancel,
}: {
  kind: EditorKind;
  column: Column;
  cell: Cell;
  busy: boolean;
  onSave: (value: EditValue) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<EditValue>(() => initial(kind, cell));
  const numberInvalid = kind === 'number' && String(value ?? '').trim() !== '' && !Number.isFinite(Number(value));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numberInvalid) onSave(finish(kind, value));
  };

  return (
    <form
      className="db-editor"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      {kind === 'text' && <input className="t-input" autoFocus value={String(value ?? '')} onChange={(e) => setValue(e.target.value)} />}
      {kind === 'paragraph' && (
        <textarea
          className="t-input db-textarea"
          autoFocus
          rows={Math.min(12, Math.max(3, String(value ?? '').length / 48))}
          value={String(value ?? '')}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit();
          }}
        />
      )}
      {kind === 'number' && (
        <input className={`t-input ${numberInvalid ? 'is-invalid' : ''}`} autoFocus inputMode="decimal" value={String(value ?? '')} onChange={(e) => setValue(e.target.value)} placeholder="Empty" />
      )}
      {kind === 'date' && <input className="t-input" type="date" autoFocus value={String(value ?? '')} onChange={(e) => setValue(e.target.value)} />}
      {kind === 'yesno' && (
        <div className="t-seg grid-cols-2" role="radiogroup" aria-label={column.name}>
          {[true, false].map((v) => (
            <button key={String(v)} type="button" role="radio" aria-checked={value === v} onClick={() => setValue(v)}>
              {v ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      )}
      {kind === 'choice' && <Choice column={column} value={String(value ?? '')} onChange={setValue} />}
      {kind === 'choices' && <Choices column={column} value={(value as string[]) ?? []} onChange={setValue} />}
      {kind === 'links' && <Links column={column} cell={cell} value={(value as string[]) ?? []} onChange={setValue} />}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="t-btn t-btn--primary h-9 text-[12px]" disabled={busy || numberInvalid}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="t-btn t-btn--quiet h-9 text-[12px]" onClick={onCancel}>
          Cancel
        </button>
        {kind === 'paragraph' && <span className="t-small text-[12px]">Ctrl+Enter saves</span>}
      </div>
    </form>
  );
}

/** One option: the table's own, or a new one typed in. */
function Choice({ column, value, onChange }: { column: Column; value: string; onChange: (v: string) => void }) {
  const options = column.options?.map((o) => o.name) ?? [];
  const list = `db-options-${column.name.replace(/\W+/g, '-')}`;
  return (
    <div className="flex flex-col gap-2">
      <input className="t-input" autoFocus list={list} value={value} onChange={(e) => onChange(e.target.value)} placeholder="None" />
      <datalist id={list}>{options.map((o) => <option key={o} value={o} />)}</datalist>
      {options.length > 0 && options.length <= 24 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button key={o} type="button" className={`db-chip t-chip h-7 ${o === value ? 't-chip--on' : ''}`} onClick={() => onChange(o === value ? '' : o)}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Several options: toggle the table's own, or add new ones. */
function Choices({ column, value, onChange }: { column: Column; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const options = [...new Set([...(column.options?.map((o) => o.name) ?? []), ...value])];
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  const add = () => {
    const name = draft.trim();
    if (name && !value.includes(name)) onChange([...value, name]);
    setDraft('');
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
        {options.map((o) => (
          <button key={o} type="button" className={`db-chip t-chip h-7 ${value.includes(o) ? 't-chip--on' : ''}`} aria-pressed={value.includes(o)} onClick={() => toggle(o)}>
            {o}
          </button>
        ))}
      </div>
      <input
        className="t-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Add another, then Enter"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && draft.trim()) {
            e.preventDefault();
            add();
          }
        }}
      />
    </div>
  );
}

/** Rows of the linked table, searched by name; the chosen ones sit on top. */
function Links({ column, cell, value, onChange }: { column: Column; cell: Cell; value: string[]; onChange: (v: string[]) => void }) {
  const [entries, setEntries] = useState<EntrySummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    databaseApi.entries().then(setEntries, (err) => setError(errorText(err)));
  }, []);

  // Rarities by the ladder, challenge ratings by value, everything else by name.
  const options = useMemo(() => (entries ?? []).filter((e) => e.table === column.target).sort((a, b) => compareText(a.title, b.title)), [entries, column.target]);
  const titles = useMemo(() => {
    const map = new Map(options.map((o) => [o.id, o.title]));
    for (const item of cellItems(cell)) if (typeof item === 'object' && isPageRef(item) && item.title) map.set(item.id, item.title);
    return map;
  }, [options, cell]);
  const q = query.trim().toLowerCase();
  const matches = options.filter((o) => !value.includes(o.id) && (!q || o.title.toLowerCase().includes(q))).slice(0, 40);

  if (!column.target) return <p className="m-0 t-small">The table this links to wasn't imported, so its rows can't be picked here.</p>;

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <button key={id} type="button" className="db-chip t-chip t-chip--on h-7" title="Remove" onClick={() => onChange(value.filter((v) => v !== id))}>
              {titles.get(id) ?? 'Unlinked page'} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
      <input className="t-input" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Find in ${column.name}`} />
      {error && <p className="m-0 text-blood-text text-[14px]">{error}</p>}
      {!entries && !error && <span className="t-small">Reading the shelf…</span>}
      <ul className="m-0 p-0 list-none max-h-56 overflow-y-auto border border-rule">
        {matches.map((o, i) => (
          <li key={o.id}>
            <button type="button" className="db-pick db-rise" style={{ '--i': Math.min(i, 12) } as React.CSSProperties} onClick={() => onChange([...value, o.id])}>
              <Thumb src={o.thumb} glyph={glyphFor(o.table, o.title, o.labels)} className="h-7 w-7" />
              <span className="flex-1 truncate">{o.title}</span>
              <Glyph name="diamond" size={12} className="db-pick-add" />
            </button>
          </li>
        ))}
        {entries && matches.length === 0 && <li className="t-small px-3 py-2">Nothing else matches.</li>}
      </ul>
    </div>
  );
}
