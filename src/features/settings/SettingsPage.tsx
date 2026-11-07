import React, { useState } from 'react';
import { Loading, Shimmer } from '@/components/ui/tome-loading';
import { useAuth } from '@/features/auth/useAuth';
import { useCached } from '@/lib/cached';
import { settingsApi, type AllowlistedDm } from './api';

const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** DM-only settings for the whole suite, one framed section each. */
export default function SettingsPage() {
  return (
    <div className="t-root min-h-svh flex flex-col">
      <header className="flex flex-col gap-2 px-11 pt-7 pb-6 border-b border-rule">
        <span className="t-label">Tome</span>
        <h1 className="t-h1">Settings</h1>
      </header>
      <main className="w-full max-w-3xl px-11 py-8 flex flex-col gap-8">
        <DungeonMasters />
      </main>
    </div>
  );
}

function DungeonMasters() {
  const { profile } = useAuth();
  const roll = useCached(['dm-allowlist'], () => settingsApi.listDms());
  const dms: AllowlistedDm[] | null = roll.data ?? null;
  const [actionError, setError] = useState<string | null>(null);
  const error = actionError ?? (roll.error ? errorText(roll.error, 'Could not load the DM list') : null);
  const [username, setUsername] = useState('');
  const [note, setNote] = useState('');
  // Which change is in flight: 'add', or the username being removed.
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  /** Runs a change, then reloads the list. Resolves false if the Worker refused it. */
  const change = async (key: string, action: () => Promise<unknown>, fallback: string) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      await roll.reload();
      return true;
    } catch (err) {
      setError(errorText(err, fallback));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await change('add', () => settingsApi.addDm(username, note), 'Could not add that DM')) {
      setUsername('');
      setNote('');
    }
  };

  const remove = (name: string) => {
    setConfirming(null);
    change(name, () => settingsApi.removeDm(name), 'Could not remove that DM');
  };

  return (
    <section aria-labelledby="dms-heading" className="t-frame p-8 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id="dms-heading" className="t-h2">Dungeon Masters</h2>
        <p className="t-body m-0">
          These Discord accounts can open the DM tools and claim campaigns. Everyone else signs in as a player through an invite link.
        </p>
      </div>

      <ul className="m-0 p-0 list-none flex flex-col border-t border-rule">
        {dms === null && !error && (
          <>
            <li className="py-4 border-b border-rule"><Loading label="Reading the roll…" /></li>
            {[0, 1].map((i) => (
              <li key={i} aria-hidden="true" className="flex items-center gap-4 py-4 border-b border-rule">
                <Shimmer className="h-11 w-11 shrink-0" />
                <span className="flex flex-1 flex-col gap-2">
                  <Shimmer className="h-4 w-44 max-w-[60%]" />
                  <Shimmer className="h-3 w-64 max-w-[80%]" />
                </span>
              </li>
            ))}
          </>
        )}
        {dms?.map((dm) => {
          const isYou = dm.discordId !== null && dm.discordId === profile?.discordId;
          const name = dm.displayName ?? dm.currentUsername ?? dm.username;
          return (
            <li key={dm.username} className="flex flex-wrap items-center gap-4 py-4 border-b border-rule">
              {dm.avatarUrl ? (
                <img src={dm.avatarUrl} alt="" className="h-11 w-11 border border-gilt-deep" />
              ) : (
                <span className={`t-portrait${dm.discordId ? '' : ' t-portrait--away'}`}>{name.slice(0, 2).toUpperCase()}</span>
              )}
              <div className="flex-[1_1_200px] min-w-0 flex flex-col gap-0.5">
                <span className="flex items-center gap-3">
                  <span className="t-h3 truncate">{name}</span>
                  {isYou && <span className="t-label" style={{ color: 'var(--gilt)' }}>You</span>}
                </span>
                <span className="t-small">
                  @{dm.currentUsername ?? dm.username} · {dm.discordId ? 'Signed in' : 'Not signed in yet'}
                  {dm.note && ` · ${dm.note}`}
                </span>
              </div>
              {!isYou &&
                (confirming === dm.username ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="t-btn t-btn--danger" disabled={busy !== null} onClick={() => remove(dm.username)}>Remove {name}</button>
                    <button type="button" className="t-btn t-btn--quiet" onClick={() => setConfirming(null)}>Keep</button>
                  </div>
                ) : (
                  <button type="button" className="t-btn t-btn--quiet" disabled={busy !== null} onClick={() => setConfirming(dm.username)}>
                    {busy === dm.username ? 'Removing…' : 'Remove'}
                  </button>
                ))}
            </li>
          );
        })}
      </ul>

      <form onSubmit={add} className="flex flex-wrap items-end gap-4">
        <label className="t-field flex-[1_1_220px]">
          <span className="t-label">Discord username</span>
          <input
            className="t-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="thetexaswave"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </label>
        <label className="t-field flex-[1_1_220px]">
          <span className="t-label">Note</span>
          <input className="t-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Optional, e.g. runs the Thursday table" />
        </label>
        <button type="submit" className="t-btn t-btn--primary" disabled={busy !== null || !username.trim()}>{busy === 'add' ? 'Adding…' : 'Add DM'}</button>
      </form>
      <p className="t-small m-0">
        Use their Discord username, not their display name. It is matched until they first sign in, then tied to their account, so later
        renames don't matter. Removing a DM takes effect on their next click; they keep their seat in campaigns as a player.
      </p>
      {error && <p className="m-0 text-blood-text" role="alert">{error}</p>}
    </section>
  );
}
