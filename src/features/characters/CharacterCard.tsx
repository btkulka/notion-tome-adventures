import React, { useState } from 'react';
import { characterLine, initials, lightPhrase, syncedAgo, tierFor, type Character } from './api';
import './characters.css';

/** The character's portrait, or their initials when there is none (or it won't load). */
export function CharacterPortrait({ character, size = 84 }: { character: Pick<Character, 'id' | 'name' | 'portraitUrl'>; size?: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = character.portraitUrl && character.portraitUrl !== failedUrl ? character.portraitUrl : null;
  return (
    <span className={`ch-portrait tier-${tierFor(character.id)}`} style={{ '--size': `${size}px` } as React.CSSProperties}>
      {url ? <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} /> : initials(character.name)}
    </span>
  );
}

export function SheetLink({ character }: { character: Pick<Character, 'ddbUrl' | 'name'> }) {
  if (!character.ddbUrl) return null;
  return (
    <a className="ch-sheet" href={character.ddbUrl} target="_blank" rel="noreferrer" aria-label={`${character.name} on D&D Beyond (opens in a new tab)`}>
      D&amp;D Beyond sheet
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden="true">
        <path d="M7 17 17 7 M9 7h8v8" />
      </svg>
    </a>
  );
}

interface CardProps {
  character: Character;
  /** Position in its list, for the staggered entrance. */
  index?: number;
  compact?: boolean;
  /** Someone sits at the table as this character. */
  playing?: boolean;
  /** Say whose it is: for the DM, and for the rest of the company. */
  showOwner?: boolean;
  busy?: boolean;
  /** A line under the card's details, such as a failed sync. */
  message?: { text: string; bad?: boolean } | null;
  actions?: React.ReactNode;
}

/** A character as a card: portrait, who they are, what they see by, and their sheet. */
export function CharacterCard({ character: c, index = 0, compact, playing, showOwner, busy, message, actions }: CardProps) {
  const owner = c.ownerName ? `${c.ownerName}'s` : 'Unclaimed';
  return (
    <article
      aria-label={c.name}
      aria-busy={busy || undefined}
      className={`ch-card ch-rise tier-${tierFor(c.id)} ${compact ? 'ch-card--compact' : ''} ${playing ? 'is-playing' : ''} ${c.active ? '' : 'is-benched'}`}
      style={{ '--i': index } as React.CSSProperties}
    >
      <CharacterPortrait character={c} size={compact ? 56 : 84} />
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
          <div className="flex flex-col gap-1 min-w-0">
            <h3 className="ch-name">{c.name}</h3>
            <span className="ch-line">{characterLine(c)}</span>
          </div>
          {playing ? (
            <span className="ch-badge"><i className="t-diamond" />Playing</span>
          ) : !c.active ? (
            <span className="ch-badge ch-badge--quiet">Benched</span>
          ) : null}
        </div>
        {(showOwner || c.darkvision > 0 || lightPhrase(c.lightSource)) && (
          <div className="flex flex-wrap gap-1.5">
            {showOwner && <span className={`ch-chip ${c.ownerName ? '' : 'text-gilt'}`}><i className="t-diamond" />{owner}</span>}
            {c.darkvision > 0 && <span className="ch-chip">Darkvision {c.darkvision} ft</span>}
            {lightPhrase(c.lightSource) && <span className="ch-chip">{lightPhrase(c.lightSource)}</span>}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-0.5">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {c.ddbUrl ? (
              <>
                <SheetLink character={c} />
                <span className="t-small text-[13px]">{syncedAgo(c.ddbSyncedAt)}</span>
              </>
            ) : (
              <span className="t-small text-[13px]">No D&amp;D Beyond sheet linked</span>
            )}
          </span>
          {actions && <div className="ch-actions">{actions}</div>}
        </div>
        {message && <span role="status" className={`text-[14px] ch-rise ${message.bad ? 'text-blood-text' : 'ch-ok'}`}>{message.text}</span>}
      </div>
    </article>
  );
}

/** The refresh glyph for Sync buttons; it turns while the sheet is being read. */
export function SyncGlyph({ spinning }: { spinning?: boolean }) {
  return (
    <svg className={spinning ? 'ch-spin' : undefined} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden="true">
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8 M4 4v4h4 M4 13a8 8 0 0 0 14.3 4.9L20 16 M20 20v-4h-4" />
    </svg>
  );
}
