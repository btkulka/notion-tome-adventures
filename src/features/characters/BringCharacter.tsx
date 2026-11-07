import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CharacterPortrait } from './CharacterCard';
import { characterLine, charactersApi, ddbCharacterId, errorText, tierFor, type Character } from './api';
import './characters.css';

interface Props {
  campaignId: string;
  /** Everyone in the campaign; the player may take their own or an unclaimed one. */
  characters: Character[];
  userId: string;
  onSeated: (character: Character) => void;
  onSkip: () => void;
}

/**
 * A player's first stop at a table where they play no one yet: paste a D&D
 * Beyond link, or take a character they (or the DM) already made.
 */
export function BringCharacter({ campaignId, characters, userId, onSeated, onSkip }: Props) {
  const choices = characters.filter((c) => (c.ownerId === userId || c.ownerId === null) && (!c.playedBy || c.playedBy === userId));
  const [link, setLink] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState<'link' | 'pick' | null>(null);
  // Shown beside whichever control it came from; `n` replays the shake on a repeat.
  const [error, setError] = useState<{ text: string; n: number; from: 'link' | 'pick' } | null>(null);
  const [seated, setSeated] = useState<Character | null>(null);

  const fail = (from: 'link' | 'pick', err: unknown, fallback: string) => setError((e) => ({ text: errorText(err, fallback), n: (e?.n ?? 0) + 1, from }));

  const bring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ddbCharacterId(link)) {
      fail('link', null, link.trim() ? "That isn't a D&D Beyond character link. Copy it from your sheet's address bar." : 'Paste the link to your D&D Beyond sheet first.');
      return;
    }
    setBusy('link');
    setError(null);
    try {
      setSeated(await charactersApi.create(campaignId, { ddbUrl: link.trim(), play: true }));
    } catch (err) {
      fail('link', err, 'Could not read that sheet');
    } finally {
      setBusy(null);
    }
  };

  const take = async () => {
    const character = choices.find((c) => c.id === chosen);
    if (!character) return;
    setBusy('pick');
    setError(null);
    try {
      await charactersApi.play(campaignId, character.id);
      setSeated({ ...character, ownerId: userId, playedBy: userId });
    } catch (err) {
      fail('pick', err, 'Could not take that seat');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="ch-root t-root min-h-svh flex items-center justify-center p-6">
      <section aria-label={seated ? `${seated.name} takes a seat` : 'Who are you playing?'} className="t-frame ch-pop w-full max-w-[560px] flex flex-col gap-5 px-7 sm:px-9 py-8">
        {seated ? (
          <div className="ch-seat">
            <span className="ch-seat-flare" />
            <CharacterPortrait character={seated} size={132} />
            <span className="t-label text-gilt">Takes a seat at the table</span>
            <h1 className="t-h1">{seated.name}</h1>
            <span className="ch-line">{characterLine(seated)}</span>
            <button type="button" className="t-btn t-btn--primary t-btn--lg mt-2" onClick={() => onSeated(seated)} autoFocus>To the table</button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <span className="t-label text-gilt">Before you sit down</span>
              <h1 className="t-h1 ch-title-in">Who are you playing?</h1>
              <p className="t-body m-0">Paste your D&amp;D Beyond character link and the tome copies the rest. The sheet must be set to Public.</p>
            </div>

            <form className="flex flex-col gap-2.5" onSubmit={bring} noValidate>
              <label htmlFor="bring-ddb" className="t-label">D&amp;D Beyond sheet</label>
              <div className="flex flex-wrap gap-2.5">
                <input
                  id="bring-ddb"
                  className="t-input flex-[1_1_260px] min-w-0"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://www.dndbeyond.com/characters/…"
                  value={link}
                  aria-invalid={Boolean(link.trim() && !ddbCharacterId(link)) || undefined}
                  onChange={(e) => {
                    setLink(e.target.value);
                    setError(null);
                  }}
                  autoFocus
                />
                <button type="submit" className="t-btn t-btn--primary" disabled={busy !== null}>{busy === 'link' ? 'Reading the sheet…' : 'Bring them in'}</button>
              </div>
              {error?.from === 'link' && <p key={error.n} role="alert" className="m-0 text-blood-text text-[15px] ch-shake">{error.text}</p>}
            </form>

            {choices.length > 0 && (
              <>
                <div className="t-rule"><i /></div>
                <span className="t-label">Or take one already here</span>
                <div role="radiogroup" aria-label="Characters" className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {choices.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={chosen === c.id}
                      onClick={() => setChosen(c.id)}
                      className={`ch-pick ch-rise tier-${tierFor(c.id)}`}
                      style={{ '--i': i, opacity: chosen && chosen !== c.id ? 0.6 : 1 } as React.CSSProperties}
                    >
                      <CharacterPortrait character={c} size={52} />
                      <span className="t-h3 text-[13px] text-center">{c.name}</span>
                      <span className={`text-[12px] text-center ${c.ownerId ? 't-small' : 'text-gilt'}`}>{c.ownerId ? characterLine(c) : `Unclaimed · ${characterLine(c)}`}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="t-btn" disabled={!chosen || busy !== null} onClick={take}>{busy === 'pick' ? 'Taking your seat…' : 'This one is mine'}</button>
                {error?.from === 'pick' && <p key={error.n} role="alert" className="m-0 text-blood-text text-[15px] ch-shake">{error.text}</p>}
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Link to={`/play/${encodeURIComponent(campaignId)}/characters?new=1`} className="text-[15px]">No sheet? Make one by hand</Link>
              <button type="button" className="t-btn t-btn--quiet h-9 px-2" onClick={onSkip}>Not now</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
