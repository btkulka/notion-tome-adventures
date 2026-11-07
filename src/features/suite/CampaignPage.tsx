import React, { useState } from 'react';
import { Loading, Shimmer } from '@/components/ui/tome-loading';
import { useCached } from '@/lib/cached';
import { CampaignGate } from './CampaignGate';
import {
  assignCharacter,
  createInvite,
  inviteUrl,
  listInvites,
  listMembers,
  removeMember,
  revokeInvite,
  useSelectedCampaign,
  type CampaignInvite,
  type CampaignMember,
  type SelectedCampaign,
} from './campaign';
import { CharacterCard, CharacterPortrait, SheetLink, SyncGlyph } from '@/features/characters/CharacterCard';
import { CharacterForm } from '@/features/characters/CharacterForm';
import { characterLine, charactersApi, errorText, initials, type Character } from '@/features/characters/api';
import hero from '@/assets/dnd-hero-banner.jpg';

const seated = (n: number) => (n === 0 ? 'No players seated yet' : n === 1 ? 'One player seated' : `${n} players seated`);
const memberName = (m: CampaignMember) => m.displayName ?? m.username;

/** /campaign — who sits at the table, the characters they play, and invites. */
const NO_CHARACTERS: Character[] = [];

export default function CampaignPage() {
  return <CampaignGate>{(campaign) => <Campaign campaign={campaign} />}</CampaignGate>;
}

function Campaign({ campaign }: { campaign: SelectedCampaign }) {
  const [, setSelected] = useSelectedCampaign();
  // Kept across visits (lib/cached.ts): coming back shows the roster at once and refreshes quietly.
  const roster = useCached(['campaign-members', campaign.id], () => listMembers(campaign.id));
  const cast = useCached(['campaign-characters', campaign.id], () => charactersApi.list(campaign.id));
  const members = roster.data ?? null;
  const setMembers = roster.set;
  const reload = roster.reload;
  // A failed read shows an empty list with the reason beside it.
  const characters = cast.data ?? (cast.error ? NO_CHARACTERS : null);
  const setCharacters = cast.set;
  const loadCharacters = cast.reload;
  const charactersError = cast.error ? errorText(cast.error, 'Could not read the characters') : null;
  const [actionError, setError] = useState<string | null>(null);
  const error = actionError ?? (roster.error ? errorText(roster.error, 'Could not load the roster') : null);
  const [removing, setRemoving] = useState<string | null>(null);

  const assign = async (member: CampaignMember, characterId: string | null) => {
    setMembers((list) => list.map((m) => (m.userId === member.userId ? { ...m, characterId } : m)));
    try {
      await assignCharacter(campaign.id, member.userId, characterId);
    } catch (err) {
      setError(errorText(err, 'Could not assign the character'));
    }
    // Handing over a character changes whose it is, so both lists move.
    reload();
    loadCharacters();
  };

  const remove = async (member: CampaignMember) => {
    if (!window.confirm(`Remove ${memberName(member)} from ${campaign.name}? Their characters stay, unclaimed.`)) return;
    setRemoving(member.userId);
    try {
      await removeMember(campaign.id, member.userId);
      await Promise.all([reload(), loadCharacters()]);
    } catch (err) {
      setError(errorText(err, 'Could not remove them'));
    } finally {
      setRemoving(null);
    }
  };

  const players = members?.filter((m) => m.role === 'player') ?? [];
  const free = characters?.filter((c) => !c.playedBy) ?? [];

  return (
    <div className="flex flex-col min-h-svh">
      <header
        className="min-h-[210px] flex items-end px-6 md:px-11 py-8 border-b border-gilt-deep bg-cover"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(10,10,11,0.25), rgba(10,10,11,0.96)), url(${hero})`, backgroundPosition: 'center 60%' }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4 w-full">
          <div className="flex flex-col gap-2.5">
            <span className="t-label text-gilt">Campaign · you run this table</span>
            <h1 className="t-display">{campaign.name}</h1>
            <span className="t-small text-[15px]">{members ? seated(players.length) : 'Gathering the roster…'}</span>
          </div>
          <button type="button" className="t-btn" onClick={() => setSelected(null)}>Switch campaign</button>
        </div>
      </header>

      <div className="flex-1 flex flex-wrap gap-8 px-6 md:px-11 pt-8 pb-12 items-start">
        <section aria-label="The table" className="flex-[999_1_560px] min-w-0 flex flex-col gap-4">
          <div className="flex flex-wrap justify-between items-baseline gap-2">
            <h2 className="t-h2">At the table</h2>
            <span className="t-small">Players bring their own characters from D&amp;D Beyond after joining.</span>
          </div>
          {error && <p className="m-0 text-blood-text">{error}</p>}
          <div className="t-panel flex flex-col">
            {members === null && !error && [0, 1, 2].map((i) => (
              <div key={i} aria-hidden="true" className={`flex items-center gap-3.5 px-4 py-3.5 ${i ? 'border-t border-rule' : ''}`}>
                <Shimmer className="h-11 w-11 shrink-0" />
                <span className="flex flex-1 flex-col gap-2">
                  <Shimmer className="h-4 w-40 max-w-[60%]" />
                  <Shimmer className="h-3 w-24 max-w-[40%]" />
                </span>
              </div>
            ))}
            {members?.map((m, i) => {
              const character = characters?.find((c) => c.id === m.characterId);
              const leaving = removing === m.userId;
              return (
                <div
                  key={m.userId}
                  aria-busy={leaving}
                  className={`grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_48px] items-center gap-4 px-4 py-3.5 ${i ? 'border-t border-rule' : ''} ${leaving ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="t-portrait shrink-0" style={m.role === 'dm' ? { borderColor: 'var(--gilt)' } : undefined}>
                      {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(memberName(m))}
                    </span>
                    <span className="flex flex-col min-w-0">
                      <strong className="font-semibold truncate">{memberName(m)}</strong>
                      <span className="t-small text-[13px] truncate">{leaving ? 'Removing…' : m.username}</span>
                    </span>
                  </div>
                  {m.role === 'dm' ? (
                    <span className="t-label text-gilt">Dungeon master</span>
                  ) : m.characterId && characters === null ? (
                    <Shimmer className="h-[52px]" />
                  ) : character ? (
                    <div className="t-raised flex items-center gap-3 px-3 py-2 min-w-0">
                      <CharacterPortrait character={character} size={36} />
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="t-h3 text-[14px] truncate">{character.name}</span>
                        <span className="t-small text-[13px] truncate">{characterLine(character)}</span>
                      </span>
                      {character.ddbUrl && <span className="hidden sm:inline text-[13px] shrink-0"><SheetLink character={character} /></span>}
                    </div>
                  ) : (
                    <div className="t-field">
                      <label htmlFor={`assign-${m.userId}`} className="t-label text-gilt">Plays no one yet</label>
                      <select
                        id={`assign-${m.userId}`}
                        className="t-input border-dashed border-gilt-deep"
                        value=""
                        disabled={!free.length}
                        onChange={(e) => e.target.value && assign(m, e.target.value)}
                      >
                        <option value="">{characters === null ? 'Reading characters…' : free.length ? 'Hand them a character…' : 'No free characters'}</option>
                        {free.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}, {characterLine(c).toLowerCase()}{c.ownerName && c.ownerId !== m.userId ? ` (${c.ownerName}'s)` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {m.role === 'player' ? (
                    <MemberMenu
                      name={memberName(m)}
                      hasCharacter={Boolean(character)}
                      onUnassign={() => assign(m, null)}
                      onRemove={() => remove(m)}
                    />
                  ) : <span />}
                </div>
              );
            })}
          </div>

          <PartyPanel
            campaignId={campaign.id}
            characters={characters}
            error={charactersError}
            players={players}
            onChange={setCharacters}
            reload={() => {
              loadCharacters();
              reload();
            }}
          />
        </section>

        <InvitePanel campaignId={campaign.id} />
      </div>
    </div>
  );
}

function MemberMenu({ name, hasCharacter, onUnassign, onRemove }: { name: string; hasCharacter: boolean; onUnassign: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" aria-label={`Options for ${name}`} aria-expanded={open} className="t-btn t-btn--icon t-btn--quiet w-10 h-10" onClick={() => setOpen((o) => !o)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
      </button>
      {open && (
        <div className="t-overlay absolute right-0 top-11 z-10 flex flex-col min-w-[200px] py-1" onMouseLeave={() => setOpen(false)}>
          {hasCharacter && <button type="button" className="t-btn t-btn--quiet justify-start h-10 px-4" onClick={() => { setOpen(false); onUnassign(); }}>Unassign character</button>}
          <button type="button" className="t-btn t-btn--quiet justify-start h-10 px-4 text-blood-text" onClick={() => { setOpen(false); onRemove(); }}>Remove from campaign</button>
        </div>
      )}
    </div>
  );
}

/** Every character in the campaign: the DM adds, edits, syncs and deletes any of them. */
function PartyPanel({
  campaignId,
  characters,
  error,
  players,
  onChange,
  reload,
}: {
  campaignId: string;
  characters: Character[] | null;
  error: string | null;
  players: CampaignMember[];
  onChange: (characters: Character[]) => void;
  reload: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; bad?: boolean } | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [allResult, setAllResult] = useState<{ text: string; failures: string[] } | null>(null);

  const owners = players.map((p) => ({ id: p.userId, name: memberName(p) }));
  const linked = characters?.filter((c) => c.ddbId).length ?? 0;
  const inParty = characters?.filter((c) => c.active).length ?? 0;
  const replace = (next: Character) => characters && onChange(characters.map((c) => (c.id === next.id ? next : c)));

  const sync = async (c: Character) => {
    setBusy(c.id);
    setMessage(null);
    try {
      const fresh = await charactersApi.sync(c.id);
      replace(fresh);
      setMessage({ id: c.id, text: fresh.level > c.level ? `Level ${fresh.level} now.` : 'Copied from D&D Beyond.' });
    } catch (err) {
      setMessage({ id: c.id, text: errorText(err, 'Sync failed'), bad: true });
    } finally {
      setBusy(null);
    }
  };

  const syncAll = async () => {
    setSyncingAll(true);
    setAllResult(null);
    try {
      const result = await charactersApi.syncAll(campaignId);
      onChange(result.characters);
      setAllResult({
        text: result.synced === 1 ? 'Copied one sheet from D&D Beyond.' : `Copied ${result.synced} sheets from D&D Beyond.`,
        failures: result.failures.map((f) => `${f.name}: ${f.error}`),
      });
    } catch (err) {
      setAllResult({ text: errorText(err, 'Sync failed'), failures: [] });
    } finally {
      setSyncingAll(false);
    }
  };

  const remove = async (c: Character) => {
    if (!window.confirm(`Delete ${c.name}${c.ownerName ? `, ${c.ownerName}'s character` : ''}? Their D&D Beyond sheet stays as it is.`)) return;
    setBusy(c.id);
    try {
      await charactersApi.remove(c.id);
      reload();
    } catch (err) {
      setMessage({ id: c.id, text: errorText(err, 'Could not delete'), bad: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="party" className="ch-root flex flex-col gap-3.5 mt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id="party" className="t-h2">The party</h2>
        <span className="t-small">
          {characters === null ? 'Counting heads…' : `${inParty} in the party${linked ? ` · ${linked} linked to D&D Beyond` : ''}`}
        </span>
        <span className="ch-head-rule" />
        {linked > 0 && (
          <button type="button" className="t-btn h-10" disabled={syncingAll} onClick={syncAll}>
            <SyncGlyph spinning={syncingAll} />
            {syncingAll ? 'Syncing…' : 'Sync all'}
          </button>
        )}
      </div>
      {allResult && (
        <div role="status" className="ch-rise flex flex-col gap-1 text-[14px]">
          <span className={allResult.failures.length ? '' : 'ch-ok'}>{allResult.text}</span>
          {allResult.failures.map((f) => <span key={f} className="text-blood-text">{f}</span>)}
        </div>
      )}
      {error && <p className="m-0 text-blood-text">{error}</p>}

      {adding ? (
        <CharacterForm
          campaignId={campaignId}
          owners={owners}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            reload();
          }}
        />
      ) : (
        <button type="button" className="ch-add" onClick={() => setAdding(true)}><i />Add a character</button>
      )}

      {characters === null && !error && [0, 1].map((i) => <Shimmer key={i} className="h-[100px]" />)}
      {characters?.length === 0 && !adding && (
        <p className="t-body m-0">No characters yet. Players add theirs when they join, or add one here and hand it to them.</p>
      )}
      {characters?.map((c, i) =>
        editing === c.id ? (
          <CharacterForm
            key={c.id}
            campaignId={campaignId}
            character={c}
            owners={owners}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        ) : (
          <CharacterCard
            key={c.id}
            character={c}
            index={i}
            compact
            showOwner
            playing={Boolean(c.playedBy)}
            busy={busy === c.id}
            message={message?.id === c.id ? message : null}
            actions={
              <>
                {c.ddbId && (
                  <button type="button" className="t-btn" disabled={busy === c.id} onClick={() => sync(c)}>
                    <SyncGlyph spinning={busy === c.id} />
                    Sync
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
  );
}

function InvitePanel({ campaignId }: { campaignId: string }) {
  const invitesQuery = useCached(['invites', campaignId], () => listInvites(campaignId));
  const invites = invitesQuery.data ?? null;
  const setInvites = invitesQuery.set;
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [actionError, setError] = useState<string | null>(null);
  const error = actionError ?? (invitesQuery.error ? invitesQuery.error.message || 'Could not load invites' : null);

  const live = invites?.find((i) => (!i.expiresAt || new Date(i.expiresAt) > new Date()) && (i.maxUses === null || i.uses < i.maxUses)) ?? null;

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const invite = await createInvite(campaignId, 7);
      setInvites((list) => [invite, ...(list ?? [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create an invite');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (code: string) => {
    setRevoking(true);
    try {
      await revokeInvite(code);
      setInvites((list) => list.filter((i) => i.code !== code));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke the invite');
    } finally {
      setRevoking(false);
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('The browser blocked the clipboard; copy the link by hand.');
    }
  };

  return (
    <aside aria-label="Invite" className="t-frame flex-[1_1_320px] max-w-[380px] flex flex-col gap-4 p-7">
      <div className="flex items-center gap-4">
        <span className="t-sigil" style={{ width: 46, height: 46 }}>
          <svg width="24" height="24" viewBox="0 0 256 256" aria-hidden="true">
            <g fill="none" stroke="#C4A35A" strokeWidth="14" strokeLinejoin="miter"><polygon points="128,40 204,84 204,172 128,216 52,172 52,84" /><polygon points="128,84 82,168 174,168" /></g>
          </svg>
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="t-h2">Summon a player</h2>
          <span className="t-small text-[14px]">They sign in with Discord and take a seat.</span>
        </div>
      </div>

      {live ? (
        <>
          <div className="t-raised flex flex-col items-center gap-2 p-5">
            <span className="t-label">Invite code</span>
            <span className="font-display font-bold text-[36px] tracking-[0.22em] text-gilt">{live.code}</span>
            <span className="t-small break-all text-center">{inviteUrl(live.code).replace(/^https?:\/\//, '')}</span>
          </div>
          <button type="button" className="t-btn t-btn--primary" onClick={() => copy(live.code)}>{copied ? 'Copied' : 'Copy invite link'}</button>
          <div className="flex justify-between items-center t-small">
            <span>{describeInvite(live)}</span>
            <button type="button" className="t-btn t-btn--quiet h-8 px-0 text-blood-text" disabled={revoking} onClick={() => revoke(live.code)}>{revoking ? 'Revoking…' : 'Revoke'}</button>
          </div>
        </>
      ) : invites === null ? (
        !error && (
          <div className="t-raised flex flex-col items-center gap-3 p-5">
            <Loading label="Looking for an open invite…" />
            <Shimmer className="h-9 w-48" />
            <Shimmer className="h-3 w-56 max-w-full" />
          </div>
        )
      ) : (
        <p className="t-body m-0">No open invite. Make one and send the link to your players.</p>
      )}
      {error && <span className="text-blood-text text-[14px]">{error}</span>}
      <div className="t-rule"><i /></div>
      <button type="button" className="t-btn" disabled={busy} onClick={create}>{busy ? 'Creating…' : live ? 'Create a new code' : 'Create an invite'}</button>
    </aside>
  );
}

function describeInvite(invite: CampaignInvite): string {
  const parts: string[] = [];
  if (invite.expiresAt) {
    const days = Math.max(0, Math.ceil((new Date(invite.expiresAt).getTime() - Date.now()) / 86400000));
    parts.push(days <= 1 ? 'Expires within a day' : `Expires in ${days} days`);
  }
  parts.push(invite.uses === 0 ? 'unused' : invite.uses === 1 ? 'used once' : `used ${invite.uses} times`);
  return parts.join(' · ');
}
