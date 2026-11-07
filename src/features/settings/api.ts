// Client for the Worker's DM-only settings routes (worker/api/settings.ts).
import { api } from '@/lib/api';

export interface AllowlistedDm {
  /** The name it was allowlisted under; also its key. */
  username: string;
  /** Set once they have signed in, which ties the row to their Discord account. */
  discordId: string | null;
  note: string | null;
  currentUsername: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export const settingsApi = {
  listDms: async () => (await api<{ dms: AllowlistedDm[] }>('/api/settings/dms')).dms,
  addDm: (username: string, note: string) => api('/api/settings/dms', { body: { username, note } }),
  removeDm: (username: string) => api(`/api/settings/dms/${encodeURIComponent(username)}`, { method: 'DELETE' }),
};
