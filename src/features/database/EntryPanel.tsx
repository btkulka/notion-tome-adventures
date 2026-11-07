import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { databaseApi, type Entry } from './api';
import { formatDay, isEmpty, readingOrder } from './browse';
import { labelsOf, tierOfRow } from './cards';
import { editorKind } from './editing';
import { Glyph } from './Glyph';
import { glyphFor } from './glyphs';
import { NotionBlocks } from './NotionBlocks';
import { Editor, Pencil, PropertyRow } from './PropertyEditor';
import { CardLightbox } from './TomeCard';

/**
 * One entry in full, in a drawer over the right edge: a banner, its properties
 * (each can be overridden), then its page content. It can also be laid out as a card.
 */
export function EntryPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);
  const [asCard, setAsCard] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    setEntry(null);
    setError(null);
    setAsCard(false);
    setEditingTitle(false);
    setHeroFailed(false);
    databaseApi.entry(id).then(
      (e) => live && setEntry(e),
      (err) => live && setError(err instanceof Error ? err.message : 'Could not open that entry')
    );
    scroller.current?.scrollTo(0, 0);
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const titleColumn = entry?.columns.find((c) => c.type === 'title');
  const rest = useMemo(() => (entry ? readingOrder(entry.table.key, entry.columns) : []), [entry]);
  const filled = rest.filter((c) => entry && (!isEmpty(entry.cells[c.name] ?? null) || entry.overrides[c.name]));
  const blank = rest.filter((c) => !filled.includes(c));
  const shown = showEmpty ? rest : filled;
  const tier = entry ? tierOfRow(entry.columns, entry.cells) : null;
  const glyph = entry ? glyphFor(entry.table.key, entry.title, labelsOf(entry.columns, entry.cells)) : 'diamond';
  const hero = entry?.images.image && !heroFailed ? entry.images.image : null;
  const edits = entry ? Object.keys(entry.overrides).length : 0;

  const saveTitle = async (value: unknown) => {
    if (!entry || !titleColumn) return;
    setBusy(true);
    try {
      setEntry(await databaseApi.override(entry.id, titleColumn.name, value as string));
      setEditingTitle(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename it');
    } finally {
      setBusy(false);
    }
  };

  const restoreTitle = async () => {
    if (!entry || !titleColumn) return;
    setRestoring(true);
    try {
      setEntry(await databaseApi.restore(entry.id, titleColumn.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore the name');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <aside
      aria-label={entry?.title ?? 'Entry'}
      className={`db-panel t-overlay bg-ink-1 fixed bottom-0 right-0 top-[var(--suite-bar,0px)] z-50 w-full sm:w-[min(580px,calc(100vw-4rem))] flex flex-col border-y-0 border-r-0 border-l-gilt-deep ${tier ? `tier-${tier}` : ''}`}
    >
      <div ref={scroller} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className={`db-hero ${hero ? 'has-image' : ''}`}>
          {hero ? (
            <img key={hero} src={hero} alt="" onError={() => setHeroFailed(true)} />
          ) : (
            <div className="db-hero-emblem">
              <span key={glyph} className="db-hero-sigil">
                <Glyph name={glyph} size={64} stroke={1} draw />
              </span>
            </div>
          )}
          <div className="db-hero-fade" />
          <div className="db-hero-band" />
          <button type="button" className="db-close t-btn t-btn--icon" aria-label="Close" title="Close (Esc)" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" aria-hidden="true">
              <path d="M5 5l14 14 M19 5L5 19" />
            </svg>
          </button>
          <header className="db-hero-title">
            {entry ? (
              <Link to={`/database/${entry.table.key}?entry=${entry.id}`} className="t-label db-rise self-start" style={{ color: 'var(--gilt)' }}>
                {entry.table.name}
              </Link>
            ) : (
              <span className="t-label">Entry</span>
            )}
            {editingTitle && entry && titleColumn ? (
              <Editor kind="text" column={titleColumn} cell={entry.title} busy={busy} onSave={saveTitle} onCancel={() => setEditingTitle(false)} />
            ) : (
              <div className="flex items-start gap-2">
                <h2 key={entry?.id ?? 'loading'} className="t-h1 db-title-in break-words flex-1 min-w-0">{entry?.title || (error ? 'Not found' : 'Turning to the page…')}</h2>
                {entry && titleColumn && editorKind(titleColumn, entry.title) && (
                  <button type="button" className="db-pencil mt-2" aria-label="Rename" title="Rename" onClick={() => setEditingTitle(true)}>
                    <Pencil />
                  </button>
                )}
              </div>
            )}
            {entry && titleColumn && entry.overrides[titleColumn.name] && (
              <span className="db-original">
                <span className="t-label">Notion</span>
                <span className="flex-1 min-w-0 truncate">{String(entry.overrides[titleColumn.name].original ?? '')}</span>
                <button type="button" className="db-restore" disabled={restoring || busy} onClick={restoreTitle}>
                  {restoring ? 'Restoring…' : 'Restore'}
                </button>
              </span>
            )}
          </header>
        </div>

        {entry && (
          <div className="flex flex-wrap items-center gap-2 px-7 pt-4 pb-1">
            <button type="button" className="t-btn t-btn--primary db-rise" style={{ '--i': 1 } as React.CSSProperties} onClick={() => setAsCard(true)}>
              <Glyph name="rank" size={16} />
              Open as card
            </button>
            {entry.notionUrl && (
              <a href={entry.notionUrl} target="_blank" rel="noreferrer" className="t-btn t-btn--quiet db-rise" style={{ '--i': 2 } as React.CSSProperties}>
                Open in Notion
              </a>
            )}
            {edits > 0 && (
              <span className="db-edited db-rise ml-auto" style={{ '--i': 3 } as React.CSSProperties}>
                <i className="t-diamond" /> {edits} {edits === 1 ? 'value' : 'values'} changed from Notion
              </span>
            )}
          </div>
        )}

        <div className="px-7 py-6 flex flex-col gap-7">
          {error && <p className="m-0 text-blood-text" role="alert">{error}</p>}
          {!entry && !error && (
            <div className="flex flex-col gap-3" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="db-skeleton h-6" style={{ '--i': i, width: `${90 - i * 12}%` } as React.CSSProperties} />)}
            </div>
          )}

          {entry && shown.length > 0 && (
            <dl className="m-0 flex flex-col">
              {shown.map((column, i) => (
                <PropertyRow key={`${entry.id}-${column.name}`} entry={entry} column={column} index={Math.min(i, 16)} onChange={setEntry} />
              ))}
            </dl>
          )}
          {entry && blank.length > 0 && (
            <button type="button" className="db-more self-start" onClick={() => setShowEmpty((v) => !v)}>
              <i className="t-diamond t-diamond--hollow" />
              {showEmpty ? 'Hide the empty fields' : `Fill in ${blank.length} empty ${blank.length === 1 ? 'field' : 'fields'}`}
            </button>
          )}

          {entry && entry.body.length > 0 && (
            <>
              <div className="t-rule db-rule-in"><i /></div>
              <div className="db-body flex flex-col gap-3"><NotionBlocks blocks={entry.body} /></div>
            </>
          )}

          {entry && (
            <footer className="mt-auto pt-4 border-t border-rule flex flex-wrap items-center justify-between gap-3 t-small">
              <span>Imported from Notion · edited there {formatDay(entry.editedAt)}</span>
            </footer>
          )}
        </div>
      </div>
      {asCard && entry && <CardLightbox entry={entry} onClose={() => setAsCard(false)} />}
    </aside>
  );
}
