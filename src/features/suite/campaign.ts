import { useCallback, useEffect, useState } from 'react';
import { api, callEdgeFunction } from '@/lib/api';

/** Same shape and storage key the generator page uses, so both stay in sync. */
export interface SelectedCampaign {
  id: string;
  name: string;
  active: boolean;
  coverArt?: string;
}

const STORAGE_KEY = 'selectedCampaign';
const CHANGE_EVENT = 'selected-campaign-change';

function readSelected(): SelectedCampaign | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function useSelectedCampaign(): [SelectedCampaign | null, (campaign: SelectedCampaign | null) => void] {
  const [campaign, setCampaign] = useState<SelectedCampaign | null>(readSelected);

  useEffect(() => {
    const sync = () => setCampaign(readSelected());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = useCallback((next: SelectedCampaign | null) => {
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('Failed to persist selectedCampaign:', err);
    }
    setCampaign(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [campaign, update];
}

/** Makes the signed-in DM the owner of a Notion campaign. Safe to call repeatedly. */
export async function claimCampaign(campaignId: string): Promise<void> {
  await api(`/api/campaigns/${encodeURIComponent(campaignId)}/claim`, { method: 'POST' });
}

// --- Roster ---------------------------------------------------------------

export interface CampaignMember {
  userId: string;
  role: 'dm' | 'player';
  /** The character they play now (src/features/characters). */
  characterId: string | null;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

const campaignPath = (campaignId: string) => `/api/campaigns/${encodeURIComponent(campaignId)}`;

export async function listMembers(campaignId: string): Promise<CampaignMember[]> {
  return (await api<{ members: CampaignMember[] }>(`${campaignPath(campaignId)}/members`)).members;
}

/** The DM hands a player a character to play; it becomes theirs. */
export async function assignCharacter(campaignId: string, userId: string, characterId: string | null): Promise<void> {
  await api(`${campaignPath(campaignId)}/members/${encodeURIComponent(userId)}`, { method: 'PATCH', body: { characterId } });
}

export async function removeMember(campaignId: string, userId: string): Promise<void> {
  await api(`${campaignPath(campaignId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

// --- Invites --------------------------------------------------------------

export interface CampaignInvite {
  code: string;
  expiresAt: string | null;
  maxUses: number | null;
  uses: number;
}

export async function createInvite(campaignId: string, days = 7): Promise<CampaignInvite> {
  return (await api<{ invite: CampaignInvite }>(`${campaignPath(campaignId)}/invites`, { method: 'POST', body: { days } })).invite;
}

export async function listInvites(campaignId: string): Promise<CampaignInvite[]> {
  return (await api<{ invites: CampaignInvite[] }>(`${campaignPath(campaignId)}/invites`)).invites;
}

export async function revokeInvite(code: string): Promise<void> {
  await api(`/api/invites/${encodeURIComponent(code)}`, { method: 'DELETE' });
}

export function inviteUrl(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

// --- Locations ----------------------------------------------------------

export interface NotionLocation {
  id: string;
  url?: string;
  name: string;
  type: string;
  playerDescription: string;
  /** Present for the DM only. */
  dmNotes?: string;
  image: string | null;
  mapId?: string;
}

export const LOCATION_TYPES = [
  'Region', 'Village', 'Town', 'City', 'Castle', 'Ruin', 'Dungeon', 'Cave', 'Tower', 'Shrine', 'Camp', 'Landmark',
];

export const locationsApi = {
  list: async (campaignId: string): Promise<NotionLocation[]> =>
    (await callEdgeFunction('locations', { action: 'list', campaignId })).locations,
  get: async (campaignId: string, locationId: string): Promise<NotionLocation> =>
    (await callEdgeFunction('locations', { action: 'get', campaignId, locationId })).location,
  create: async (
    campaignId: string,
    fields: { name: string; type?: string; playerDescription?: string; mapId?: string }
  ): Promise<NotionLocation> => (await callEdgeFunction('locations', { action: 'create', campaignId, ...fields })).location,
  update: async (
    campaignId: string,
    locationId: string,
    fields: Partial<Pick<NotionLocation, 'name' | 'type' | 'playerDescription' | 'dmNotes' | 'mapId'>>
  ): Promise<NotionLocation> =>
    (await callEdgeFunction('locations', { action: 'update', campaignId, locationId, ...fields })).location,
};
