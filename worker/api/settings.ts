// DM-only app settings. For now: who is on the DM allowlist.
import { Hono } from 'hono';
import { currentDm, HttpError } from '../access';
import type { AppEnv } from '../types';

/** Discord usernames are 2–32 lowercase letters, digits, `_` and `.`. */
const USERNAME = /^[a-z0-9_.]{2,32}$/;

export const settingsRoutes = new Hono<AppEnv>()
  .get('/settings/dms', async (c) => {
    currentDm(c);
    const { results } = await c.env.DB.prepare(
      `SELECT a.username, a.discord_id, a.note, u.username AS current_username, u.display_name, u.avatar_url
         FROM dm_allowlist a LEFT JOIN users u ON u.discord_id = a.discord_id
        ORDER BY a.rowid`
    ).all<{ username: string; discord_id: string | null; note: string | null; current_username: string | null; display_name: string | null; avatar_url: string | null }>();
    return c.json({
      dms: results.map((r) => ({
        username: r.username,
        discordId: r.discord_id,
        note: r.note,
        currentUsername: r.current_username,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
      })),
    });
  })

  /** Allowlist a Discord username. Someone who has signed in before is pinned to their account straight away. */
  .post('/settings/dms', async (c) => {
    currentDm(c);
    const body = await c.req.json<{ username?: string; note?: string }>().catch(() => ({} as { username?: string; note?: string }));
    const username = (body.username ?? '').trim().replace(/^@/, '').toLowerCase();
    if (!USERNAME.test(username)) throw new HttpError(400, 'That is not a Discord username');
    const note = body.note?.trim().slice(0, 200) || null;

    const known = await c.env.DB.prepare('SELECT discord_id FROM users WHERE lower(username) = ?').bind(username).first<{ discord_id: string }>();
    const existing = await c.env.DB.prepare('SELECT 1 FROM dm_allowlist WHERE lower(username) = ? OR discord_id = ?')
      .bind(username, known?.discord_id ?? null)
      .first();
    if (existing) throw new HttpError(409, `${username} is already a DM`);

    await c.env.DB.prepare('INSERT INTO dm_allowlist (username, discord_id, note) VALUES (?, ?, ?)').bind(username, known?.discord_id ?? null, note).run();
    return c.json({ ok: true }, 201);
  })

  /** Takes effect on the removed DM's next request. Nobody can remove themselves, so the list is never left empty. */
  .delete('/settings/dms/:username', async (c) => {
    const user = currentDm(c);
    const username = c.req.param('username').toLowerCase();
    const row = await c.env.DB.prepare('SELECT discord_id FROM dm_allowlist WHERE lower(username) = ?').bind(username).first<{ discord_id: string | null }>();
    if (!row) throw new HttpError(404, `${username} is not on the DM list`);
    if (row.discord_id === user.discordId) throw new HttpError(400, 'You cannot remove yourself; ask another DM to');
    await c.env.DB.prepare('DELETE FROM dm_allowlist WHERE lower(username) = ?').bind(username).run();
    return c.json({ ok: true });
  });
