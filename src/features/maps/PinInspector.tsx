import React, { useEffect, useState } from 'react';
import { Loading, Shimmer } from '@/components/ui/tome-loading';
import { locationsApi, type NotionLocation } from '@/features/suite/campaign';
import type { PinData, PinObject, PinType } from './types';

const PIN_TYPES: PinType[] = ['village', 'town', 'city', 'castle', 'ruin', 'dungeon', 'cave', 'tower', 'shrine', 'camp', 'landmark'];
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function PinInspector({
  pin,
  campaignId,
  onChange,
  onDelete,
}: {
  pin: PinObject;
  campaignId: string;
  onChange: (patch: { hidden?: boolean; data?: Partial<PinData> }) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const [name, setName] = useState(pin.data.name);
  const [location, setLocation] = useState<NotionLocation | null>(null);
  const [choices, setChoices] = useState<NotionLocation[] | null>(null);
  const [notionError, setNotionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listing, setListing] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => setName(pin.data.name), [pin.id, pin.data.name]);

  useEffect(() => {
    setLocation(null);
    setNotionError(null);
    if (!pin.data.notionLocationId) return;
    locationsApi
      .get(campaignId, pin.data.notionLocationId)
      .then(setLocation)
      .catch((err) => setNotionError(err instanceof Error ? err.message : 'Could not load the location'));
  }, [campaignId, pin.data.notionLocationId]);

  const loadChoices = async () => {
    setListing(true);
    try {
      setChoices(await locationsApi.list(campaignId));
    } catch (err) {
      setNotionError(err instanceof Error ? err.message : 'Could not list the locations');
    } finally {
      setListing(false);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await onDelete();
    } finally {
      setRemoving(false);
    }
  };

  const createLocation = async () => {
    setBusy(true);
    setNotionError(null);
    try {
      const created = await locationsApi.create(campaignId, { name: pin.data.name, type: titleCase(pin.data.pinType) });
      await onChange({ data: { notionLocationId: created.id } });
    } catch (err) {
      setNotionError(err instanceof Error ? err.message : 'Could not create the location');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3.5">
        <span className="t-sigil" style={{ width: 42, height: 42 }}>
          <span style={{ transform: 'rotate(-45deg)' }} className="font-display text-[11px] text-gilt">{pin.data.pinType.slice(0, 2).toUpperCase()}</span>
        </span>
        <div className="flex flex-col gap-1">
          <span className="t-label">Pin · {pin.data.pinType}</span>
          <span className="t-h2">{pin.data.name}</span>
        </div>
      </div>

      <div className="t-field">
        <label htmlFor="pin-name" className="t-label">Name</label>
        <input
          id="pin-name"
          className="t-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== pin.data.name && onChange({ data: { name: name.trim() } })}
        />
      </div>

      <div className="t-field">
        <label htmlFor="pin-type" className="t-label">Kind of place</label>
        <select id="pin-type" className="t-input" value={pin.data.pinType} onChange={(e) => onChange({ data: { pinType: e.target.value as PinType } })}>
          {PIN_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
        </select>
      </div>

      <div className="t-raised p-4 flex flex-col gap-2.5">
        <div className="flex justify-between items-baseline">
          <span className="t-label">Location</span>
          {location?.url && <a href={location.url} target="_blank" rel="noreferrer" className="text-[14px]">Open in Notion</a>}
        </div>
        {pin.data.notionLocationId && !location && !notionError && (
          <>
            <Loading label="Reading the location…" />
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-4 w-1/2" />
          </>
        )}
        {location && (
          <>
            <span className="t-h3">{location.name}</span>
            {location.playerDescription ? <p className="t-lore m-0 text-[16px]">{location.playerDescription}</p> : <span className="t-small">No player description yet.</span>}
            <span className="t-small text-[13px]">Players read this once the pin is revealed.</span>
            <button type="button" className="t-btn t-btn--quiet self-start h-9 px-0" onClick={() => onChange({ data: { notionLocationId: null } })}>Unlink</button>
          </>
        )}
        {!pin.data.notionLocationId && (
          <div className="flex flex-col gap-2.5">
            <button type="button" className="t-btn" disabled={busy} onClick={createLocation}>{busy ? 'Creating…' : `Make “${pin.data.name}” a location`}</button>
            {choices === null ? (
              <button type="button" className="t-btn t-btn--quiet" disabled={listing} onClick={loadChoices}>{listing ? 'Reading locations…' : 'Link an existing location'}</button>
            ) : (
              <select className="t-input" defaultValue="" onChange={(e) => e.target.value && onChange({ data: { notionLocationId: e.target.value } })} aria-label="Existing locations">
                <option value="" disabled>{choices.length ? 'Choose a location' : 'No locations in this campaign yet'}</option>
                {choices.map((l) => <option key={l.id} value={l.id}>{l.name}{l.type ? ` · ${l.type}` : ''}</option>)}
              </select>
            )}
          </div>
        )}
        {notionError && <span className="text-blood-text text-[14px]">{notionError}</span>}
      </div>

      <div className="flex flex-col">
        <label className="flex items-center justify-between gap-3 min-h-[52px] border-t border-rule">
          <span className="flex flex-col"><span className="font-semibold">Hidden from players</span><span className="t-small text-[13px]">Never sent to their browsers</span></span>
          <input type="checkbox" checked={pin.hidden} onChange={(e) => onChange({ hidden: e.target.checked })} className="h-[18px] w-[18px] accent-[#C4A35A]" />
        </label>
        <label className="flex items-center justify-between gap-3 min-h-[52px] border-y border-rule">
          <span className="flex flex-col"><span className="font-semibold">Reveal when sighted</span><span className="t-small text-[13px]">Appears once the party sees its tile</span></span>
          <input type="checkbox" checked={pin.data.autoReveal} onChange={(e) => onChange({ data: { autoReveal: e.target.checked } })} className="h-[18px] w-[18px] accent-[#C4A35A]" />
        </label>
      </div>

      <button type="button" className="t-btn t-btn--danger self-start" disabled={removing} onClick={remove}>{removing ? 'Removing…' : 'Remove pin'}</button>
    </div>
  );
}
