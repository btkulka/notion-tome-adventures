import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { databaseApi, type Entry } from './api';
import { cardOf, statsLinkOf } from './cards';
import { Glyph } from './Glyph';

/**
 * An entry as a Tome card (the card design on the Tome canvas), alone on a dark
 * stage. The card leans toward the pointer and catches the light; Escape or a
 * click outside it puts it away.
 */
export function CardLightbox({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const [statsRow, setStatsRow] = useState<Entry | null>(null);
  const face = useMemo(() => cardOf(entry, statsRow), [entry, statsRow]);
  const card = useRef<HTMLElement>(null);
  const [artFailed, setArtFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const close = () => {
    setLeaving(true);
    window.setTimeout(onClose, 180);
  };

  useEffect(() => {
    const link = statsLinkOf(entry);
    if (link) databaseApi.entry(link).then(setStatsRow, () => setStatsRow(null));
  }, [entry]);

  useEffect(() => {
    // Capture, so Escape closes the card before the entry panel underneath sees it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lean = (e: React.PointerEvent) => {
    const el = card.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${((0.5 - y) * 16).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${((x - 0.5) * 20).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    el.dataset.lean = 'on';
  };

  const settle = () => {
    const el = card.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    delete el.dataset.lean;
  };

  const art = face.art && !artFailed ? face.art : null;

  return createPortal(
    <div className={`db-lightbox ${leaving ? 'is-leaving' : ''}`} role="dialog" aria-modal="true" aria-label={`${face.title}, as a card`} onClick={close}>
      <div className="db-card-stage" onClick={(e) => e.stopPropagation()}>
        <article ref={card} className={`db-card tier-${face.tier}`} onPointerMove={lean} onPointerLeave={settle}>
          <div className="db-card-art">
            {art ? (
              <img src={art} alt="" onError={() => setArtFailed(true)} />
            ) : (
              <div className="db-card-emblem">
                <span className="db-card-emblem-frame">
                  <Glyph name={face.glyph} size={84} stroke={0.9} draw />
                </span>
              </div>
            )}
            <div className="db-card-fade" />
          </div>
          <div className="db-card-band" />
          <i className="db-card-pip" />
          <header className="db-card-top">
            <span className="db-card-rank">
              <i className="t-diamond" />
              {face.rank}
            </span>
            {face.xp !== null && <span className="t-num text-[14px]">{face.xp.toLocaleString()} XP</span>}
          </header>
          <div className="db-card-foot">
            <h3 className="db-card-title">{face.title}</h3>
            {face.meta && <span className="db-card-meta">{face.meta}</span>}
            {(face.stats.length > 0 || face.abilities.length > 0 || face.text) && <div className="t-rule"><i /></div>}
            {face.abilities.length > 0 && (
              <dl className="db-card-abilities">
                {face.abilities.map((a) => (
                  <div key={a.label}>
                    <dt>{a.label}</dt>
                    <dd className="t-num">{a.score}</dd>
                    <dd className="db-card-mod">{a.modifier}</dd>
                  </div>
                ))}
              </dl>
            )}
            {face.stats.length > 0 && (
              <dl className="db-card-stats">
                {face.stats.map((s) => (
                  <div key={s.label}>
                    <dt>{s.label}</dt>
                    <dd className="t-num">{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {face.text && <p className="db-card-text">{face.text}</p>}
          </div>
          <div className="db-card-sheen" />
        </article>
        <div className="db-card-actions">
          <span className="t-small">{entry.table.name}</span>
          <button type="button" className="t-btn t-btn--quiet" onClick={close}>Put it away</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
