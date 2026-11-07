// Player characters (worker/api/characters.ts). Players keep their own; the DM
// keeps everyone's. A D&D Beyond link fills in the sheet's details.
import { api } from '@/lib/api';

export { LIGHT_SOURCES, MAX_LEVEL, MAX_NAME, ddbCharacterId, ddbSheetUrl } from '@/lib/characters';

export interface Character {
  id: string;
  campaignId: string;
  /** The player it belongs to; null until someone claims it. */
  ownerId: string | null;
  ownerName: string | null;
  /** The member playing it right now. */
  playedBy: string | null;
  name: string;
  race: string;
  /** "Fighter", or "Fighter 3 / Rogue 2" for a multiclass. */
  characterClass: string;
  level: number;
  portraitUrl: string | null;
  darkvision: number;
  lightSource: string;
  /** In the party: counts toward encounter budgets. */
  active: boolean;
  ddbId: string | null;
  ddbUrl: string | null;
  ddbSyncedAt: string | null;
}

/** What a create or edit sends. With `ddbUrl` the sheet supplies name, race, class, level, portrait and darkvision. */
export interface CharacterFields {
  name?: string;
  race?: string;
  characterClass?: string;
  level?: number;
  portraitUrl?: string | null;
  darkvision?: number;
  lightSource?: string;
  active?: boolean;
  ddbUrl?: string | null;
  /** DM only. */
  ownerId?: string | null;
  /** On create: the owner plays this one from now on. */
  play?: boolean;
}

export interface SyncAllResult {
  characters: Character[];
  synced: number;
  failures: { id: string; name: string; error: string }[];
}

const campaignPath = (campaignId: string) => `/api/campaigns/${encodeURIComponent(campaignId)}`;
const characterPath = (id: string) => `/api/characters/${encodeURIComponent(id)}`;

export const charactersApi = {
  list: async (campaignId: string): Promise<Character[]> =>
    (await api<{ characters: Character[] }>(`${campaignPath(campaignId)}/characters`)).characters,
  create: async (campaignId: string, fields: CharacterFields): Promise<Character> =>
    (await api<{ character: Character }>(`${campaignPath(campaignId)}/characters`, { method: 'POST', body: fields })).character,
  update: async (id: string, fields: CharacterFields): Promise<Character> =>
    (await api<{ character: Character }>(characterPath(id), { method: 'PATCH', body: fields })).character,
  remove: async (id: string): Promise<void> => {
    await api(characterPath(id), { method: 'DELETE' });
  },
  sync: async (id: string): Promise<Character> =>
    (await api<{ character: Character }>(`${characterPath(id)}/sync`, { method: 'POST' })).character,
  syncAll: (campaignId: string): Promise<SyncAllResult> =>
    api<SyncAllResult>(`${campaignPath(campaignId)}/characters/sync`, { method: 'POST' }),
  /** The signed-in player chooses who they play, or claims an unclaimed character. */
  play: async (campaignId: string, characterId: string | null): Promise<void> => {
    await api(`${campaignPath(campaignId)}/character`, { method: 'POST', body: { characterId } });
  },
};

// --- Formatting -------------------------------------------------------------

const TIERS = ['azure', 'verdant', 'amethyst', 'ember', 'bone'];

/** A steady enamel colour per character or person. */
export const tierFor = (id: string) => TIERS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 3) % TIERS.length];

export const initials = (name: string) =>
  name.split(/[\s_.]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

/** "Fighter 5"; a multiclass line already carries its levels. */
export function classAndLevel(c: Pick<Character, 'characterClass' | 'level'>): string {
  if (!c.characterClass) return `Level ${c.level}`;
  return /\d/.test(c.characterClass) ? c.characterClass : `${c.characterClass} ${c.level}`;
}

/** "Hill Dwarf · Fighter 5". */
export const characterLine = (c: Pick<Character, 'race' | 'characterClass' | 'level'>) => [c.race, classAndLevel(c)].filter(Boolean).join(' · ');

const LIGHT_PHRASES: Record<string, string> = {
  Torch: 'Carries a torch',
  Lantern: 'Carries a lantern',
  'Light cantrip': 'Casts Light',
  Other: 'Carries a light',
};

/** "Carries a lantern"; empty when they carry nothing. */
export const lightPhrase = (lightSource: string) => LIGHT_PHRASES[lightSource] ?? '';

export function syncedAgo(iso: string | null): string {
  if (!iso) return 'Not synced yet';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 2) return 'Synced just now';
  if (minutes < 60) return `Synced ${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'Synced an hour ago' : `Synced ${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Synced yesterday' : `Synced ${days} days ago`;
}

export const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
