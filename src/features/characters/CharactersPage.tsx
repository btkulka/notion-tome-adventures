import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Shimmer } from '@/components/ui/tome-loading';
import { useAuth } from '@/features/auth/useAuth';
import { CharacterCard, SyncGlyph } from './CharacterCard';
import { CharacterForm } from './CharacterForm';
import { charactersApi, errorText, type Character } from './api';
import hero from '@/assets/dnd-hero-banner.jpg';
import './characters.css';

type Message = { id: string; text: string; bad?: boolean };

/** /play/:campaignId/characters — a player's own characters, and the rest of the company. */
export default function CharactersPage() {
  const { campaignId = '' } = useParams();
  const { profile } = useAuth();
  const me = profile?.id ?? '';
  const [params, setParams] = useSearchParams();
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(params.get('new') === '1');
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: string; what: 'sync' | 'play' | 'delete' } | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const load = useCallback(
    () => charactersApi.list(campaignId).then(setCharacters).catch((err) => setError(errorText(err, 'Could not read the characters'))),
    [campaignId]
  );
  useEffect(() => {
    load();
  }, [load]);

  const replace = (next: Character) => setCharacters((list) => list?.map((c) => (c.id === next.id ? next : c)) ?? null);

  const stopAdding = () => {
    setAdding(false);
    if (params.has('new')) setParams({}, { replace: true });
  };

  const run = async (character: Character, what: 'sync' | 'play' | 'delete', action: () => Promise<string | void>) => {
    setBusy({ id: character.id, what });
    setMessage(null);
    try {
      const text = await action();
      if (text) setMessage({ id: character.id, text });
    } catch (err) {
      setMessage({ id: character.id, text: errorText(err, 'That did not work'), bad: true });
    } finally {
      setBusy(null);
    }
  };

  const sync = (c: Character) =>
    run(c, 'sync', async () => {
      const fresh = await charactersApi.sync(c.id);
      replace(fresh);
      return fresh.level > c.level ? `Level ${fresh.level} now. Well earned.` : 'Copied from D&D Beyond.';
    });

  const play = (c: Character) =>
    run(c, 'play', async () => {
      await charactersApi.play(campaignId, c.id);
      await load();
    });

  const remove = (c: Character) => {
    if (!window.confirm(`Delete ${c.name}? Their D&D Beyond sheet stays as it is.`)) return;
    run(c, 'delete', async () => {
      await charactersApi.remove(c.id);
      setCharacters((list) => list?.filter((x) => x.id !== c.id) ?? null);
    });
  };

  const mine = characters?.filter((c) => c.ownerId === me) ?? [];
  const company = characters?.filter((c) => c.ownerId !== me) ?? [];
  const playing = mine.find((c) => c.playedBy === me) ?? null;

  return (
    <div className="ch-root t-root flex flex-col min-h-svh">
      <header
        className="min-h-[210px] flex items-end px-6 md:px-11 py-8 border-b border-gilt-deep bg-cover"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(10,10,11,0.25), rgba(10,10,11,0.96)), url(${hero})`, backgroundPosition: 'center 60%' }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4 w-full">
          <div className="flex flex-col gap-2.5">
            <span className="t-label text-gilt ch-rise">{playing ? `You play ${playing.name}` : 'You play no one yet'}</span>
            <h1 className="t-display ch-title-in">Your characters</h1>
            <span className="t-small text-[15px] ch-rise" style={{ '--i': 2 } as React.CSSProperties}>
              Link a D&amp;D Beyond sheet and the tome keeps the details. Sync after a level-up.
            </span>
          </div>
          <Link to={`/play/${encodeURIComponent(campaignId)}`} className="t-btn">Back to the table</Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1080px] flex flex-col gap-10 px-6 md:px-11 pt-8 pb-14">
        {error && <p role="alert" className="m-0 text-blood-text">{error}</p>}

        <section aria-labelledby="mine" className="flex flex-col gap-3.5">
          <div className="flex items-center gap-4">
            <h2 id="mine" className="t-h2">Yours</h2>
            <span className="ch-head-rule" />
          </div>

          {adding ? (
            <CharacterForm
              campaignId={campaignId}
              play={!playing}
              onCancel={stopAdding}
              onSaved={(c) => {
                stopAdding();
                setMessage({ id: c.id, text: c.ddbId ? 'Copied from D&D Beyond.' : 'Added.' });
                load();
              }}
            />
          ) : (
            <button type="button" className="ch-add" onClick={() => setAdding(true)}><i />Add a character</button>
          )}

          {characters === null && !error && [0, 1].map((i) => <Shimmer key={i} className="h-[118px]" />)}
          {characters !== null && mine.length === 0 && !adding && (
            <p className="t-body m-0">You have no characters here yet. Add one, or claim one from the company below.</p>
          )}
          {mine.map((c, i) =>
            editing === c.id ? (
              <CharacterForm
                key={c.id}
                campaignId={campaignId}
                character={c}
                onCancel={() => setEditing(null)}
                onSaved={(saved) => {
                  setEditing(null);
                  replace(saved);
                }}
              />
            ) : (
              <CharacterCard
                key={c.id}
                character={c}
                index={i}
                playing={c.playedBy === me}
                busy={busy?.id === c.id && busy.what !== 'sync'}
                message={message?.id === c.id ? message : null}
                actions={
                  <>
                    {c.playedBy !== me && (
                      <button type="button" className="t-btn" onClick={() => play(c)}>{busy?.id === c.id && busy.what === 'play' ? 'Sitting down…' : 'Play this one'}</button>
                    )}
                    {c.ddbId && (
                      <button type="button" className="t-btn" disabled={busy?.id === c.id} onClick={() => sync(c)}>
                        <SyncGlyph spinning={busy?.id === c.id && busy.what === 'sync'} />
                        {busy?.id === c.id && busy.what === 'sync' ? 'Syncing…' : 'Sync'}
                      </button>
                    )}
                    <button type="button" className="t-btn" onClick={() => setEditing(c.id)}>Edit</button>
                    <button type="button" className="t-btn t-btn--danger" onClick={() => remove(c)}>Delete</button>
                  </>
                }
              />
            )
          )}
        </section>

        <section aria-labelledby="company" className="flex flex-col gap-3.5">
          <div className="flex items-center gap-4">
            <h2 id="company" className="t-h2">The company</h2>
            <span className="ch-head-rule" />
          </div>
          {characters !== null && company.length === 0 && <p className="t-body m-0">No one else has brought a character yet.</p>}
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))' }}>
            {company.map((c, i) => (
              <CharacterCard
                key={c.id}
                character={c}
                index={i + mine.length}
                compact
                showOwner
                playing={Boolean(c.playedBy)}
                busy={busy?.id === c.id}
                message={message?.id === c.id ? message : null}
                actions={
                  c.ownerId === null ? (
                    <button type="button" className="t-btn" onClick={() => play(c)}>{busy?.id === c.id ? 'Claiming…' : 'Claim and play'}</button>
                  ) : undefined
                }
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
