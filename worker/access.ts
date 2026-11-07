// Who may do what. This replaces database row-level security: every route that
// touches campaign data checks the caller's role here first.
import type { Context } from 'hono';
import type { CampaignRole } from './notion/context';
import type { AppEnv, SessionUser } from './types';

export class HttpError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 500 | 502, message: string) {
    super(message);
  }
}

export function currentUser(c: Context<AppEnv>): SessionUser {
  const user = c.get('user');
  if (!user) throw new HttpError(401, 'Sign in with Discord to use this');
  return user;
}

export function currentDm(c: Context<AppEnv>): SessionUser {
  const user = currentUser(c);
  if (!user.isDm) throw new HttpError(403, 'Only the DM can use this');
  return user;
}

/** A DM taken off the allowlist keeps their seat but loses DM powers. */
export async function campaignRole(db: D1Database, userId: string, campaignId: string): Promise<CampaignRole | null> {
  const row = await db
    .prepare(
      `SELECT m.role, EXISTS (SELECT 1 FROM users u JOIN dm_allowlist a ON a.discord_id = u.discord_id WHERE u.id = m.user_id) AS allowlisted
         FROM campaign_members m WHERE m.campaign_id = ? AND m.user_id = ?`
    )
    .bind(campaignId, userId)
    .first<{ role: CampaignRole; allowlisted: number }>();
  if (!row) return null;
  return row.role === 'dm' && row.allowlisted !== 1 ? 'player' : row.role;
}

export async function requireMember(c: Context<AppEnv>, campaignId: string): Promise<{ user: SessionUser; role: CampaignRole }> {
  const user = currentUser(c);
  const role = await campaignRole(c.env.DB, user.id, campaignId);
  if (!role) throw new HttpError(403, 'You are not part of this campaign');
  return { user, role };
}

export async function requireCampaignDm(c: Context<AppEnv>, campaignId: string): Promise<SessionUser> {
  const { user, role } = await requireMember(c, campaignId);
  if (role !== 'dm') throw new HttpError(403, 'Only the DM can do that');
  return user;
}

/** `app.onError` handler: thrown HttpErrors become JSON responses. */
export function handleError(err: Error, c: Context<AppEnv>): Response {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error('Unhandled error:', err);
  return c.json({ error: err.message || 'Unknown error' }, 500);
}
