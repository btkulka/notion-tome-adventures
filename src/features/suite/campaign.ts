import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { callEdgeFunction } from '@/lib/supabase-client';
import type { Profile } from '@/features/auth/AuthProvider';

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
  const { error } = await supabase.rpc('claim_campaign', { cid: campaignId });
  if (error) throw new Error(error.message);
}

// --- Roster ---------------------------------------------------------------

export interface CampaignMember {
  userId: string;
  role: 'dm' | 'player';
  characterNotionId: string | null;
  profile: Profile | null;
}

export async function listMembers(campaignId: string): Promise<CampaignMember[]> {
  const { data: rows, error } = await supabase
    .from('campaign_members')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('joined_at');
  if (error) throw new Error(error.message);
  const ids = rows.map((r) => r.user_id);
  const { data: profiles, error: profileError } = ids.length
    ? await supabase.from('profiles').select('*').in('id', ids)
    : { data: [], error: null };
  if (profileError) throw new Error(profileError.message);
  return rows.map((r) => ({
    userId: r.user_id,
    role: r.role as CampaignMember['role'],
    characterNotionId: r.character_notion_id,
    profile: (profiles?.find((p) => p.id === r.user_id) as Profile) ?? null,
  }));
}

export async function assignCharacter(campaignId: string, userId: string, characterId: string | null): Promise<void> {
  const { error } = await supabase
    .from('campaign_members')
    .update({ character_notion_id: characterId })
    .eq('campaign_id', campaignId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function claimCharacter(campaignId: string, characterId: string): Promise<void> {
  const { error } = await supabase.rpc('claim_character', { cid: campaignId, character_id: characterId });
  if (error) throw new Error(error.message);
}

export async function removeMember(campaignId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('campaign_members').delete().eq('campaign_id', campaignId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// --- Invites --------------------------------------------------------------

export interface CampaignInvite {
  code: string;
  expiresAt: string | null;
  maxUses: number | null;
  uses: number;
}

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function inviteCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join('');
}

export async function createInvite(campaignId: string, userId: string, days = 7): Promise<CampaignInvite> {
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('campaign_invites')
    .insert({ code: inviteCode(), campaign_id: campaignId, created_by: userId, expires_at: expiresAt })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { code: data.code, expiresAt: data.expires_at, maxUses: data.max_uses, uses: data.uses };
}

export async function listInvites(campaignId: string): Promise<CampaignInvite[]> {
  const { data, error } = await supabase
    .from('campaign_invites')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data.map((d) => ({ code: d.code, expiresAt: d.expires_at, maxUses: d.max_uses, uses: d.uses }));
}

export async function revokeInvite(code: string): Promise<void> {
  const { error } = await supabase.from('campaign_invites').delete().eq('code', code);
  if (error) throw new Error(error.message);
}

export function inviteUrl(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

// --- Notion: characters, locations, setup ---------------------------------

export interface NotionCharacter {
  id: string;
  url: string;
  name: string;
  player: string;
  discordUsername: string;
  campaignIds: string[];
  level: number;
  characterClass: string;
  portrait: string | null;
  darkvision: number;
  lightSource: string;
  active: boolean;
}

export async function fetchCharacters(campaignId: string): Promise<NotionCharacter[]> {
  const result = await callEdgeFunction('characters', { campaignId });
  return result.characters;
}

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

export interface NotionSetupResult {
  created: string[];
  locationsDatabaseId: string;
  charactersDatabaseId: string;
  secretsConfigured: boolean;
}

export async function runNotionSetup(): Promise<NotionSetupResult> {
  return callEdgeFunction('setup-suite-notion');
}
