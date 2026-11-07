import React, { useId, useState } from 'react';
import {
  charactersApi,
  ddbCharacterId,
  errorText,
  LIGHT_SOURCES,
  MAX_LEVEL,
  MAX_NAME,
  type Character,
  type CharacterFields,
} from './api';
import './characters.css';

interface FormProps {
  campaignId: string;
  /** Edit this one; leave out to make a new character. */
  character?: Character;
  /** The DM's choice of whose it is: the campaign's players. Players never see it. */
  owners?: { id: string; name: string }[];
  /** On create: the owner plays the new character from now on. */
  play?: boolean;
  onSaved: (character: Character) => void;
  onCancel: () => void;
}

const toInt = (text: string, fallback: number) => {
  const n = Number.parseInt(text, 10);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Makes or edits a character. A D&D Beyond link does most of the work: the
 * sheet supplies name, race, class, level, portrait and darkvision. Without
 * one, every field is filled in by hand.
 */
export function CharacterForm({ campaignId, character, owners, play, onSaved, onCancel }: FormProps) {
  const id = useId();
  const editing = Boolean(character);
  const [link, setLink] = useState(character?.ddbUrl ?? '');
  const [byHand, setByHand] = useState(editing);
  const [name, setName] = useState(character?.name ?? '');
  const [race, setRace] = useState(character?.race ?? '');
  const [characterClass, setCharacterClass] = useState(character?.characterClass ?? '');
  const [level, setLevel] = useState(String(character?.level ?? 1));
  const [darkvision, setDarkvision] = useState(String(character?.darkvision ?? 0));
  const [lightSource, setLightSource] = useState(character?.lightSource ?? 'None');
  const [portraitUrl, setPortraitUrl] = useState(character?.portraitUrl ?? '');
  const [active, setActive] = useState(character?.active ?? true);
  const [ownerId, setOwnerId] = useState<string>(character?.ownerId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  // Keep the current owner choosable even if they no longer sit as a player (say, they became the DM).
  const ownerChoices =
    owners && character?.ownerId && !owners.some((o) => o.id === character.ownerId)
      ? [...owners, { id: character.ownerId, name: character.ownerName ?? 'Its current owner' }]
      : owners;

  const ddbId = ddbCharacterId(link);
  const linkTyped = link.trim() !== '';
  const linkBad = linkTyped && !ddbId;
  // A new character from a sheet takes its details from the sheet, so the hand-written ones stay hidden.
  const fromSheet = !editing && Boolean(ddbId);
  const showDetails = editing || (byHand && !fromSheet);

  const fail = (message: string) => {
    setError(message);
    setShake((n) => n + 1);
  };

  const fields = (): CharacterFields | null => {
    if (linkBad) {
      fail("That isn't a D&D Beyond character link. Copy it from your sheet's address bar.");
      return null;
    }
    const details: CharacterFields = {
      name: name.trim(),
      race: race.trim(),
      characterClass: characterClass.trim(),
      level: Math.min(MAX_LEVEL, Math.max(1, toInt(level, 1))),
      darkvision: Math.max(0, toInt(darkvision, 0)),
      portraitUrl: portraitUrl.trim() || null,
    };
    const always: CharacterFields = { lightSource, active };
    if (owners) always.ownerId = ownerId || null;

    if (!character) {
      if (ddbId) return { ...always, ddbUrl: link.trim(), play };
      if (!details.name) {
        fail(byHand ? 'Give the character a name.' : 'Paste a D&D Beyond link, or fill the character in by hand.');
        if (!byHand) setByHand(true);
        return null;
      }
      return { ...always, ...details, play };
    }

    if (!details.name) {
      fail('Give the character a name.');
      return null;
    }
    // Only what changed, so a field the sheet set isn't rewritten by an unrelated edit.
    const before: Record<string, unknown> = { ...character, portraitUrl: character.portraitUrl ?? null };
    const changed = Object.fromEntries(Object.entries({ ...details, ...always }).filter(([k, v]) => before[k] !== (v ?? null))) as CharacterFields;
    if (ddbId !== character.ddbId) changed.ddbUrl = ddbId ? link.trim() : null;
    return changed;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = fields();
    if (!body) return;
    setSaving(true);
    setError(null);
    try {
      const saved = character
        ? Object.keys(body).length ? await charactersApi.update(character.id, body) : character
        : await charactersApi.create(campaignId, body);
      onSaved(saved);
    } catch (err) {
      fail(errorText(err, 'Could not save the character'));
      setSaving(false);
    }
  };

  const submitLabel = saving
    ? fromSheet || (editing && ddbId && ddbId !== character?.ddbId) ? 'Reading the sheet…' : 'Saving…'
    : editing ? 'Save changes' : fromSheet ? 'Bring them in' : 'Add character';

  const linkHint = linkBad
    ? "That isn't a D&D Beyond character link."
    : ddbId
      ? editing && ddbId === character?.ddbId
        ? 'Linked. Sync from the card to copy the sheet again.'
        : 'The sheet fills in name, race, class, level, portrait and darkvision.'
      : 'Paste the link from your sheet’s address bar. D&D Beyond only shares sheets set to Public.';

  return (
    <form className="ch-form ch-pop" onSubmit={submit} noValidate aria-label={editing ? `Edit ${character!.name}` : 'New character'}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="t-h2">{editing ? `Edit ${character!.name}` : 'A new character'}</h3>
        <button type="button" className="t-btn t-btn--quiet t-btn--icon h-8 w-8 -mt-1" aria-label="Cancel" onClick={onCancel}>×</button>
      </div>

      <div className="ch-ddb">
        <label htmlFor={`${id}-ddb`} className="t-label text-gilt">D&amp;D Beyond sheet</label>
        <div className="ch-ddb-row">
          <input
            id={`${id}-ddb`}
            className="t-input"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.dndbeyond.com/characters/…"
            value={link}
            aria-invalid={linkBad || undefined}
            aria-describedby={`${id}-ddb-hint`}
            onChange={(e) => {
              setLink(e.target.value);
              setError(null);
            }}
          />
        </div>
        <span id={`${id}-ddb-hint`} className={`ch-hint ${linkBad ? 'text-blood-text' : ddbId ? 'ch-ok' : ''}`}>{linkHint}</span>
      </div>

      {!editing && !fromSheet && !byHand && (
        <button type="button" className="t-btn t-btn--quiet self-start -mt-2 px-0 text-gilt" onClick={() => setByHand(true)}>
          No sheet? Fill it in by hand
        </button>
      )}

      {showDetails && (
        <div className="ch-form-grid ch-rise">
          {editing && character?.ddbId && <span className="ch-hint ch-wide -mb-1">A sync from D&amp;D Beyond replaces name, race, class, level, portrait and darkvision.</span>}
          <Field id={`${id}-name`} label="Name" wide>
            <input id={`${id}-name`} className="t-input" maxLength={MAX_NAME} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!editing} />
          </Field>
          <Field id={`${id}-race`} label="Race">
            <input id={`${id}-race`} className="t-input" maxLength={MAX_NAME} placeholder="Hill Dwarf" value={race} onChange={(e) => setRace(e.target.value)} />
          </Field>
          <Field id={`${id}-class`} label="Class">
            <input id={`${id}-class`} className="t-input" maxLength={MAX_NAME} placeholder="Fighter" value={characterClass} onChange={(e) => setCharacterClass(e.target.value)} />
          </Field>
          <Field id={`${id}-level`} label="Level">
            <input id={`${id}-level`} className="t-input" type="number" min={1} max={MAX_LEVEL} value={level} onChange={(e) => setLevel(e.target.value)} />
          </Field>
          <Field id={`${id}-dv`} label="Darkvision (ft)">
            <input id={`${id}-dv`} className="t-input" type="number" min={0} step={5} value={darkvision} onChange={(e) => setDarkvision(e.target.value)} />
          </Field>
          <Field id={`${id}-portrait`} label="Portrait link" wide>
            <input id={`${id}-portrait`} className="t-input" type="url" inputMode="url" placeholder="https://…" value={portraitUrl} onChange={(e) => setPortraitUrl(e.target.value)} />
          </Field>
        </div>
      )}

      <div className="ch-form-grid">
        <Field id={`${id}-light`} label="Light source">
          <select id={`${id}-light`} className="t-input" value={lightSource} onChange={(e) => setLightSource(e.target.value)}>
            {LIGHT_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <div className="t-field">
          <span className="t-label" id={`${id}-party`}>Party</span>
          <div className="t-seg grid-cols-2" role="radiogroup" aria-labelledby={`${id}-party`}>
            <button type="button" role="radio" aria-checked={active} onClick={() => setActive(true)}>In party</button>
            <button type="button" role="radio" aria-checked={!active} onClick={() => setActive(false)}>Benched</button>
          </div>
        </div>
        {ownerChoices && (
          <Field id={`${id}-owner`} label="Played by">
            <select id={`${id}-owner`} className="t-input" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">No one yet</option>
              {ownerChoices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        )}
      </div>

      {error && <p key={shake} role="alert" className="m-0 text-blood-text text-[15px] ch-shake">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2.5">
        <button type="button" className="t-btn t-btn--quiet" onClick={onCancel}>Cancel</button>
        <button type="submit" className="t-btn t-btn--primary" disabled={saving}>{submitLabel}</button>
      </div>
    </form>
  );
}

function Field({ id, label, wide, children }: { id: string; label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`t-field ${wide ? 'ch-wide' : ''}`}>
      <label htmlFor={id} className="t-label">{label}</label>
      {children}
    </div>
  );
}
