import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCached } from '@/lib/cached';
import { databaseApi, onContentChange, type EntrySummary, type TableData, type TableSummary } from './api';
import {
  compareCells,
  defaultColumns,
  facetMatches,
  facetsOf,
  formatDay,
  rowMatches,
  saveColumns,
  savedColumns,
  shelfOf,
  shelve,
} from './browse';
import { labelsOf, tierOfRow } from './cards';
import { CellValue } from './CellValue';
import { EntryPanel } from './EntryPanel';
import { Glyph, Thumb } from './Glyph';
import { glyphFor } from './glyphs';
import './database.css';

/** Rows drawn at a time; the rest wait behind "Show more". */
const PAGE = 200;
/** Rows past this many come in together rather than one after another. */
const STAGGER = 24;

const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);
const delay = (i: number) => ({ '--i': Math.min(i, STAGGER) }) as React.CSSProperties;

/** Browse the reference tables imported from Notion: one table at a time, or every entry by name. */
export default function DatabasePage() {
  const { tableKey } = useParams();
  const [params, setParams] = useSearchParams();
  const entryId = params.get('entry');
  const shelvesQuery = useCached(['content-tables'], () => databaseApi.tables());
  const tables = shelvesQuery.data ?? null;
  const error = shelvesQuery.error ? errorText(shelvesQuery.error, 'Could not read the database') : null;

  const open = useCallback((id: string) => setParams({ entry: id }), [setParams]);
  const close = useCallback(() => setParams({}), [setParams]);
  const table = tables?.find((t) => t.key === tableKey);

  return (
    <div className="t-root db-root h-svh flex overflow-hidden">
      <Shelves tables={tables} />
      <div className="flex-1 min-w-0 flex flex-col">
        {error && <p className="px-11 pt-6 m-0 text-blood-text" role="alert">{error}</p>}
        {tables?.length === 0 && <Empty />}
        {tables && tables.length > 0 && (
          tableKey
            ? table
              ? <TableView key={table.key} summary={table} tables={tables} selected={entryId} onOpen={open} />
              : <Missing tableKey={tableKey} />
            : <AllEntries tables={tables} selected={entryId} onOpen={open} />
        )}
        {tables === null && !error && <Loading label="Reading the shelves" />}
      </div>
      {entryId && <EntryPanel id={entryId} onClose={close} />}
    </div>
  );
}

/** Counts up to a number when it first shows. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setShown(value);
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      // A frame can start before the effect ran, so its time can be earlier than start.
      const t = Math.min(1, Math.max(0, now - start) / 700);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown.toLocaleString()}</>;
}

function Loading({ label }: { label: string }) {
  return (
    <div className="px-6 md:px-11 py-8 flex flex-col gap-3" role="status" aria-label={label}>
      <span className="t-small">{label}…</span>
      {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="db-skeleton h-9" style={{ ...delay(i), width: `${96 - i * 9}%` }} />)}
    </div>
  );
}

const shelfLink = ({ isActive }: { isActive: boolean }) => `db-shelf db-rise ${isActive ? 'is-active' : ''}`;

function Shelves({ tables }: { tables: TableSummary[] | null }) {
  const total = tables?.reduce((n, t) => n + t.rows, 0) ?? 0;
  let i = 0;
  return (
    <nav aria-label="Tables" className="hidden md:flex w-[264px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-rule bg-[rgba(18,17,19,0.75)] px-4 py-6">
      <NavLink to="/database" end className={shelfLink} style={delay(i++)}>
        <Glyph name="rank" size={16} className="db-shelf-mark" />
        <span className="flex-1 font-semibold">All entries</span>
        {total > 0 && <span className="t-small"><CountUp value={total} /></span>}
      </NavLink>
      {tables === null &&
        [0, 1, 2, 3, 4].map((n) => <div key={n} aria-hidden="true" className="db-skeleton h-[38px]" style={{ ...delay(n + 1), width: `${92 - n * 8}%` }} />)}
      {tables &&
        shelve(tables).map((shelf) => (
          <div key={shelf.label} className="flex flex-col">
            <span className="t-label px-3 pb-1.5 db-rise" style={delay(i++)}>{shelf.label}</span>
            {shelf.tables.map((t) => (
              <NavLink key={t.key} to={`/database/${t.key}`} className={shelfLink} style={delay(i++)}>
                <Glyph name={glyphFor(t.key, t.name)} size={16} className="db-shelf-mark" />
                <span className="flex-1 truncate">{t.name}</span>
                <span className="t-small">{t.rows.toLocaleString()}</span>
              </NavLink>
            ))}
          </div>
        ))}
    </nav>
  );
}

/** The table picker where the shelves don't fit. */
function NarrowPicker({ tables, value }: { tables: TableSummary[]; value: string }) {
  const navigate = useNavigate();
  return (
    <label className="t-field md:hidden">
      <span className="t-label">Table</span>
      <select className="t-input" value={value} onChange={(e) => navigate(e.target.value ? `/database/${e.target.value}` : '/database')}>
        <option value="">All entries</option>
        {shelve(tables).map((shelf) => (
          <optgroup key={shelf.label} label={shelf.label}>
            {shelf.tables.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function Header({ label, title, glyph, detail, children }: { label: string; title: string; glyph: string; detail?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="db-header shrink-0 flex flex-col gap-5 px-6 md:px-11 pt-7 pb-6 border-b border-rule">
      <div className="flex items-center gap-5">
        <span className="db-header-sigil" aria-hidden="true">
          <Glyph key={glyph} name={glyph} size={26} stroke={1.3} draw />
        </span>
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="t-label db-rise">{label}</span>
          <h1 key={title} className="t-h1 db-title-in">{title}</h1>
          {detail && <span className="t-small db-rise" style={delay(2)}>{detail}</span>}
        </div>
      </div>
      {children}
    </header>
  );
}

function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="t-field flex-[1_1_260px] max-w-md db-rise" style={delay(3)}>
      <span className="t-label">Search</span>
      <span className="db-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" aria-hidden="true">
          <path d="M10 3l7 7-7 7-7-7z M15 15l6 6" />
        </svg>
        <input className="t-input" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false} />
      </span>
    </label>
  );
}

function TableView({ summary, tables, selected, onOpen }: { summary: TableSummary; tables: TableSummary[]; selected: string | null; onOpen: (id: string) => void }) {
  const tableQuery = useCached(['content-table', summary.key], () => databaseApi.table(summary.key));
  const data: TableData | null = tableQuery.data ?? null;
  const error = tableQuery.error ? errorText(tableQuery.error, 'Could not open this table') : null;
  const reloadTable = tableQuery.reload;
  const [query, setQuery] = useState('');
  const [facetValues, setFacetValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ column: string; direction: 1 | -1 } | null>(null);
  const [chosen, setChosen] = useState<string[] | null>(() => savedColumns(summary.key));
  const [limit, setLimit] = useState(PAGE);
  const search = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => onContentChange(() => void reloadTable()), [reloadTable]);

  const columns = useMemo(() => data?.table.columns ?? [], [data]);
  // Nothing here recalculates Notion's formulas and rollups, so those columns are a snapshot.
  const computed = columns.some((c) => c.type === 'formula' || c.type === 'rollup');
  const shown = useMemo(() => {
    const names = chosen ?? defaultColumns(summary.key, columns);
    const title = columns.find((c) => c.type === 'title');
    // The title always leads, even if a saved choice predates a renamed column; the rest keep the chosen order.
    return [title, ...names.map((n) => columns.find((c) => c.name === n && c !== title))].filter(Boolean) as typeof columns;
  }, [chosen, columns, summary.key]);
  const facets = useMemo(() => (data ? facetsOf(columns, data.rows, shown.map((c) => c.name)) : []), [data, columns, shown]);

  const rows = useMemo(() => {
    if (!data) return [];
    // A filter on a column that stopped being offered (columns changed) no longer applies.
    const active = facets.filter((f) => facetValues[f.column]).map((f) => [f.column, facetValues[f.column]] as const);
    const kept = data.rows.filter((row) => rowMatches(row, search) && active.every(([column, value]) => facetMatches(row, column, value)));
    if (sort) kept.sort((a, b) => compareCells(a.cells[sort.column] ?? null, b.cells[sort.column] ?? null, sort.direction));
    return kept;
  }, [data, facets, search, facetValues, sort]);

  useEffect(() => setLimit(PAGE), [search, facetValues, sort]);

  const cycleSort = (column: string) =>
    setSort((s) => (s?.column !== column ? { column, direction: 1 } : s.direction === 1 ? { column, direction: -1 } : null));

  const choose = (names: string[] | null) => {
    setChosen(names);
    saveColumns(summary.key, names);
  };

  const filtering = search !== '' || facets.some((f) => facetValues[f.column]);

  return (
    <>
      <Header
        label={`Database · ${shelfOf(summary.key)}`}
        title={summary.name}
        glyph={glyphFor(summary.key, summary.name)}
        detail={
          <>
            <CountUp value={summary.rows} /> {summary.rows === 1 ? 'entry' : 'entries'} · imported from Notion {formatDay(summary.importedAt)}
            {computed && ' · formula and rollup columns keep the values Notion had then'}
          </>
        }
      >
        <NarrowPicker tables={tables} value={summary.key} />
        {data && (
          <div className="flex flex-wrap items-end gap-4">
            <Search value={query} onChange={setQuery} placeholder={`Search ${summary.name.toLowerCase()}`} />
            {facets.map((f, i) => (
              <label key={f.column} className="t-field flex-[0_1_180px] min-w-[140px] db-rise" style={delay(4 + i)}>
                <span className="t-label truncate">{f.column}</span>
                <select
                  className={`t-input db-select ${facetValues[f.column] ? 't-input--focus is-set' : ''}`}
                  value={facetValues[f.column] ?? ''}
                  onChange={(e) => setFacetValues((v) => ({ ...v, [f.column]: e.target.value }))}
                >
                  <option value="">Any</option>
                  {f.values.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
            ))}
            <ColumnPicker
              columns={columns.filter((c) => c.type !== 'title').map((c) => c.name)}
              shown={shown.map((c) => c.name)}
              onChange={(names) => choose([...columns.filter((c) => c.type === 'title').map((c) => c.name), ...names])}
              onReset={() => choose(null)}
              customised={chosen !== null}
            />
            {filtering && (
              <button type="button" className="t-btn t-btn--quiet db-pop" onClick={() => { setQuery(''); setFacetValues({}); }}>
                Clear
              </button>
            )}
          </div>
        )}
      </Header>

      {error && <p className="px-6 md:px-11 pt-6 m-0 text-blood-text" role="alert">{error}</p>}
      {!data && !error && <Loading label={`Opening ${summary.name}`} />}

      {data && (
        <>
          <div className="shrink-0 px-6 md:px-11 py-3 t-small border-b border-rule">
            <span key={`${rows.length}-${filtering}`} className="db-pop inline-block">
              {filtering ? `${rows.length.toLocaleString()} of ${data.rows.length.toLocaleString()}` : `${data.rows.length.toLocaleString()} entries`}
            </span>
            {sort && ` · sorted by ${sort.column}${sort.direction === -1 ? ', descending' : ''}`}
          </div>
          <main className="flex-1 min-h-0 overflow-auto">
            <table className="w-full border-collapse text-[15px]">
              <thead>
                <tr className="border-b border-rule bg-ink-1">
                  {shown.map((c, i) => {
                    const sorted = sort?.column === c.name ? sort.direction : 0;
                    return (
                      <th
                        key={c.name}
                        scope="col"
                        aria-sort={sorted === 1 ? 'ascending' : sorted === -1 ? 'descending' : 'none'}
                        className={`sticky top-0 z-10 bg-ink-1 p-0 text-left font-normal ${i === 0 ? 'left-0 z-20 pl-3 md:pl-8' : ''}`}
                      >
                        <button type="button" onClick={() => cycleSort(c.name)} className={`db-sort t-label ${sorted ? 'is-sorted' : ''}`}>
                          {c.name}
                          <SortMark direction={sorted} />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((row, index) => {
                  const isOpen = row.id === selected;
                  const tier = tierOfRow(columns, row.cells);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => onOpen(row.id)}
                      className={`db-row db-rise group ${isOpen ? 'is-open' : ''} ${tier ? `tier-${tier}` : ''}`}
                      style={delay(index % PAGE)}
                    >
                      {shown.map((c, i) =>
                        i === 0 ? (
                          <th key={c.name} scope="row" className="db-row-head sticky left-0 z-[1] text-left font-normal align-middle py-2 pl-6 md:pl-11 pr-3 min-w-[240px] max-w-[360px]">
                            <span className="flex items-center gap-3">
                              <Thumb src={row.images.thumb} glyph={glyphFor(summary.key, row.title, labelsOf(columns, row.cells))} tier={tier} />
                              <button type="button" className="db-row-title" onClick={(e) => { e.stopPropagation(); onOpen(row.id); }}>
                                {row.title || 'Untitled'}
                              </button>
                              {row.overridden.length > 0 && <i className="t-diamond db-row-edited" title={`Changed here: ${row.overridden.join(', ')}`} />}
                            </span>
                          </th>
                        ) : (
                          <td key={c.name} className={`align-middle px-3 py-2 text-bone-2 min-w-[90px] max-w-[360px] ${row.overridden.includes(c.name) ? 'db-cell-edited' : ''}`}>
                            <CellValue column={c} cell={row.cells[c.name] ?? null} compact />
                          </td>
                        )
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && <p className="px-6 md:px-11 py-8 m-0 t-small db-pop">Nothing matches. Loosen the search or a filter.</p>}
            {rows.length > limit && (
              <div className="px-6 md:px-11 py-6">
                <button type="button" className="t-btn" onClick={() => setLimit((n) => n + PAGE)}>
                  Show {Math.min(PAGE, rows.length - limit).toLocaleString()} more
                </button>
              </div>
            )}
          </main>
        </>
      )}
    </>
  );
}

function SortMark({ direction }: { direction: number }) {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" className={`db-sort-mark ${direction === -1 ? 'is-down' : ''} ${direction ? 'is-on' : ''}`}>
      <path d="M1 7h8L5 2z" fill="currentColor" />
    </svg>
  );
}

function ColumnPicker({
  columns,
  shown,
  onChange,
  onReset,
  customised,
}: {
  columns: string[];
  shown: string[];
  onChange: (names: string[]) => void;
  onReset: () => void;
  customised: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const toggle = (name: string) => {
    const current = shown.filter((n) => columns.includes(n));
    onChange(current.includes(name) ? current.filter((n) => n !== name) : [...current, name]);
  };

  return (
    <details ref={ref} className="relative db-rise" style={delay(9)}>
      <summary className="t-btn list-none [&::-webkit-details-marker]:hidden">Columns</summary>
      <div className="db-menu t-overlay absolute left-0 sm:left-auto sm:right-0 top-[calc(100%+6px)] z-30 w-[280px] max-h-[60vh] overflow-y-auto p-2 flex flex-col">
        {columns.map((name, i) => (
          <label key={name} className="db-menu-item db-rise" style={delay(i)}>
            <input type="checkbox" className="accent-[#C4A35A]" checked={shown.includes(name)} onChange={() => toggle(name)} />
            <span className="truncate">{name}</span>
          </label>
        ))}
        {customised && (
          <button type="button" className="t-btn t-btn--quiet mt-1 self-start" onClick={onReset}>
            Back to the defaults
          </button>
        )}
      </div>
    </details>
  );
}

function AllEntries({ tables, selected, onOpen }: { tables: TableSummary[]; selected: string | null; onOpen: (id: string) => void }) {
  const entriesQuery = useCached(['content-entries'], () => databaseApi.entries());
  const entries: EntrySummary[] | null = entriesQuery.data ?? null;
  const error = entriesQuery.error ? errorText(entriesQuery.error, 'Could not list the entries') : null;
  const reloadEntries = entriesQuery.reload;
  const [query, setQuery] = useState('');
  const [shelf, setShelf] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const search = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => onContentChange(() => void reloadEntries()), [reloadEntries]);

  const names = useMemo(() => new Map(tables.map((t) => [t.key, t.name])), [tables]);
  const shelves = useMemo(() => shelve(tables).map((s) => s.label), [tables]);
  const total = tables.reduce((n, t) => n + t.rows, 0);
  const rows = useMemo(() => {
    if (!entries) return [];
    const kept = entries.filter((e) => (!shelf || shelfOf(e.table) === shelf) && (!search || e.title.toLowerCase().includes(search)));
    // Names that start with the search come first.
    return search ? kept.sort((a, b) => Number(!a.title.toLowerCase().startsWith(search)) - Number(!b.title.toLowerCase().startsWith(search))) : kept;
  }, [entries, search, shelf]);

  useEffect(() => setLimit(PAGE), [search, shelf]);

  return (
    <>
      <Header label="Database" title="All entries" glyph="rank" detail={<><CountUp value={total} /> entries in {tables.length} tables imported from Notion</>}>
        <NarrowPicker tables={tables} value="" />
        <div className="flex flex-wrap items-end gap-4">
          <Search value={query} onChange={setQuery} placeholder="A monster, an item, a shop…" />
          <label className="t-field flex-[0_1_220px] min-w-[160px] db-rise" style={delay(4)}>
            <span className="t-label">Shelf</span>
            <select className={`t-input db-select ${shelf ? 't-input--focus is-set' : ''}`} value={shelf} onChange={(e) => setShelf(e.target.value)}>
              <option value="">Every shelf</option>
              {shelves.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
      </Header>

      {error && <p className="px-6 md:px-11 pt-6 m-0 text-blood-text" role="alert">{error}</p>}
      {!entries && !error && <Loading label="Gathering every entry" />}

      {entries && (
        <>
          <div className="shrink-0 px-6 md:px-11 py-3 t-small border-b border-rule">
            <span key={rows.length} className="db-pop inline-block">
              {rows.length === entries.length ? `${entries.length.toLocaleString()} entries` : `${rows.length.toLocaleString()} of ${entries.length.toLocaleString()}`}
            </span>
          </div>
          <main className="flex-1 min-h-0 overflow-y-auto">
            <ul className="m-0 p-0 list-none">
              {rows.slice(0, limit).map((e, index) => (
                <li key={e.id} className="db-rise" style={delay(index % PAGE)}>
                  <button type="button" onClick={() => onOpen(e.id)} className={`db-row db-entry ${e.id === selected ? 'is-open' : ''}`}>
                    <Thumb src={e.thumb} glyph={glyphFor(e.table, e.title, e.labels)} />
                    <span className="db-row-title flex-1 min-w-0 truncate">{e.title}</span>
                    <span className="t-small shrink-0 truncate max-w-[45%]">{names.get(e.table) ?? e.table}</span>
                  </button>
                </li>
              ))}
            </ul>
            {rows.length === 0 && <p className="px-6 md:px-11 py-8 m-0 t-small db-pop">No entry by that name.</p>}
            {rows.length > limit && (
              <div className="px-6 md:px-11 py-6">
                <button type="button" className="t-btn" onClick={() => setLimit((n) => n + PAGE)}>
                  Show {Math.min(PAGE, rows.length - limit).toLocaleString()} more
                </button>
              </div>
            )}
          </main>
        </>
      )}
    </>
  );
}

function Empty() {
  return (
    <>
      <Header label="Database" title="Nothing on the shelves yet" glyph="book" />
      <div className="px-6 md:px-11 py-8 max-w-2xl flex flex-col gap-3 db-rise">
        <p className="t-body m-0">
          Monsters, magic items and the other reference tables are copied over from Notion by the import in <code>scripts/notion-import</code>. Once it
          has run, every table and entry shows up here.
        </p>
        <p className="t-small m-0">
          <code>npm run notion:export</code>, then <code>npm run notion:sql</code> and <code>npm run notion:apply:local</code> (or <code>:remote</code>), and{' '}
          <code>npm run notion:files</code> for the pictures.
        </p>
      </div>
    </>
  );
}

function Missing({ tableKey }: { tableKey: string }) {
  return (
    <>
      <Header label="Database" title="No such table" glyph="diamond" />
      <p className="px-6 md:px-11 py-8 m-0 t-body db-rise">
        Nothing called <code>{tableKey}</code> was imported. <NavLink to="/database">See every entry</NavLink>.
      </p>
    </>
  );
}
