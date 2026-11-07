// Campaign membership and invites. Characters, and choosing one to play, are in characters.ts.
import { Hono } from 'hono';
import { currentDm, currentUser, HttpError, requireCampaignDm, requireMember } from '../access';
import type { AppEnv } from '../types';
import { characterInCampaign, seatStatements } from './characters';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function inviteCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join('');
}

const iso = (seconds: number | null) => (seconds === null ? null : new Date(seconds * 1000).toISOString());

export const campaignRoutes = new Hono<AppEnv>()
  /** The campaigns the caller belongs to. */
  .get('/campaigns/mine', async (c) => {
    const user = currentUser(c);
    const { results } = await c.env.DB.prepare('SELECT campaign_id, role, character_id FROM campaign_members WHERE user_id = ? ORDER BY joined_at')
      .bind(user.id)
      .all<{ campaign_id: string; role: string; character_id: string | null }>();
    return c.json({ campaigns: results.map((r) => ({ campaignId: r.campaign_id, role: r.role, characterId: r.character_id })) });
  })

  /** An allowlisted DM takes ownership of a Notion campaign. Idempotent for the owner. */
  .post('/campaigns/:id/claim', async (c) => {
    const user = currentDm(c);
    const campaignId = c.req.param('id');
    // Only a DM still on the allowlist holds a campaign; one who was removed is demoted when someone else claims it.
    const other = await c.env.DB.prepare(
      `SELECT 1 FROM campaign_members m JOIN users u ON u.id = m.user_id JOIN dm_allowlist a ON a.discord_id = u.discord_id
        WHERE m.campaign_id = ? AND m.role = 'dm' AND m.user_id <> ?`
    )
      .bind(campaignId, user.id)
      .first();
    if (other) throw new HttpError(409, 'Another DM already runs this campaign');
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE campaign_members SET role = 'player' WHERE campaign_id = ? AND role = 'dm' AND user_id <> ?").bind(campaignId, user.id),
      c.env.DB.prepare(
        "INSERT INTO campaign_members (campaign_id, user_id, role) VALUES (?, ?, 'dm') ON CONFLICT (campaign_id, user_id) DO UPDATE SET role = 'dm'"
      ).bind(campaignId, user.id),
    ]);
    return c.json({ ok: true });
  })

  .get('/campaigns/:id/members', async (c) => {
    await requireMember(c, c.req.param('id'));
    const { results } = await c.env.DB.prepare(
      `SELECT m.user_id, m.role, m.character_id, u.username, u.display_name, u.avatar_url
         FROM campaign_members m JOIN users u ON u.id = m.user_id
        WHERE m.campaign_id = ? ORDER BY m.joined_at`
    )
      .bind(c.req.param('id'))
      .all<{ user_id: string; role: string; character_id: string | null; username: string; display_name: string | null; avatar_url: string | null }>();
    return c.json({
      members: results.map((r) => ({
        userId: r.user_id,
        role: r.role,
        characterId: r.character_id,
        username: r.username,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
      })),
    });
  })

  /** The DM hands a player a character to play; it becomes theirs. */
  .patch('/campaigns/:id/members/:userId', async (c) => {
    const campaignId = c.req.param('id');
    const userId = c.req.param('userId');
    await requireCampaignDm(c, campaignId);
    const { characterId } = await c.req.json<{ characterId: string | null }>();
    const member = await c.env.DB.prepare('SELECT role FROM campaign_members WHERE campaign_id = ? AND user_id = ?').bind(campaignId, userId).first<{ role: string }>();
    if (!member) throw new HttpError(404, 'They are not part of this campaign');
    if (member.role !== 'player') throw new HttpError(400, 'Only players play characters');
    if (characterId) await characterInCampaign(c.env.DB, campaignId, characterId);
    await c.env.DB.batch(seatStatements(c.env.DB, campaignId, userId, characterId ?? null));
    return c.json({ ok: true });
  })

  /** The DM removes a member, or a member leaves. Their characters stay with the campaign, unclaimed. */
  .delete('/campaigns/:id/members/:userId', async (c) => {
    const { user, role } = await requireMember(c, c.req.param('id'));
    if (role !== 'dm' && user.id !== c.req.param('userId')) throw new HttpError(403, 'Only the DM can remove other players');
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE characters SET owner_id = NULL, updated_at = unixepoch() WHERE campaign_id = ? AND owner_id = ?').bind(c.req.param('id'), c.req.param('userId')),
      c.env.DB.prepare('DELETE FROM campaign_members WHERE campaign_id = ? AND user_id = ?').bind(c.req.param('id'), c.req.param('userId')),
    ]);
    return c.json({ ok: true });
  })

  .get('/campaigns/:id/invites', async (c) => {
    await requireCampaignDm(c, c.req.param('id'));
    const { results } = await c.env.DB.prepare('SELECT code, expires_at, max_uses, uses FROM campaign_invites WHERE campaign_id = ? ORDER BY created_at DESC')
      .bind(c.req.param('id'))
      .all<{ code: string; expires_at: number | null; max_uses: number | null; uses: number }>();
    return c.json({ invites: results.map((r) => ({ code: r.code, expiresAt: iso(r.expires_at), maxUses: r.max_uses, uses: r.uses })) });
  })

  .post('/campaigns/:id/invites', async (c) => {
    const user = await requireCampaignDm(c, c.req.param('id'));
    const { days = 7, maxUses = null } = await c.req.json<{ days?: number; maxUses?: number | null }>().catch(() => ({} as { days?: number; maxUses?: number | null }));
    const code = inviteCode();
    const expires = Math.floor(Date.now() / 1000) + Math.round(days * 86400);
    await c.env.DB.prepare('INSERT INTO campaign_invites (code, campaign_id, created_by, expires_at, max_uses) VALUES (?, ?, ?, ?, ?)')
      .bind(code, c.req.param('id'), user.id, expires, maxUses)
      .run();
    return c.json({ invite: { code, expiresAt: iso(expires), maxUses, uses: 0 } });
  })

  .delete('/invites/:code', async (c) => {
    const invite = await c.env.DB.prepare('SELECT campaign_id FROM campaign_invites WHERE code = ?').bind(c.req.param('code')).first<{ campaign_id: string }>();
    if (!invite) throw new HttpError(404, 'That invite does not exist');
    await requireCampaignDm(c, invite.campaign_id);
    await c.env.DB.prepare('DELETE FROM campaign_invites WHERE code = ?').bind(c.req.param('code')).run();
    return c.json({ ok: true });
  })

  /** A signed-in player redeems an invite. */
  .post('/join/:code', async (c) => {
    const user = currentUser(c);
    const code = c.req.param('code').trim().toUpperCase();
    const invite = await c.env.DB.prepare('SELECT campaign_id, expires_at, max_uses, uses FROM campaign_invites WHERE code = ?')
      .bind(code)
      .first<{ campaign_id: string; expires_at: number | null; max_uses: number | null; uses: number }>();
    if (!invite) throw new HttpError(404, 'That invite code does not exist');
    if (invite.expires_at !== null && invite.expires_at < Date.now() / 1000) throw new HttpError(400, 'That invite has expired');
    if (invite.max_uses !== null && invite.uses >= invite.max_uses) throw new HttpError(400, 'That invite has been used up');
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO campaign_members (campaign_id, user_id, role) VALUES (?, ?, 'player') ON CONFLICT (campaign_id, user_id) DO NOTHING").bind(invite.campaign_id, user.id),
      c.env.DB.prepare('UPDATE campaign_invites SET uses = uses + 1 WHERE code = ?').bind(code),
    ]);
    return c.json({ campaignId: invite.campaign_id });
  });
