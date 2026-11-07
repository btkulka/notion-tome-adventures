// Discord sign-in and cookie sessions. The Worker runs the OAuth code flow
// itself; the browser only ever holds an opaque, HttpOnly session cookie.
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv, SessionUser } from './types';

const SESSION_COOKIE = 'tome_session';
const OAUTH_COOKIE = 'tome_oauth';
const SESSION_SECONDS = 30 * 24 * 60 * 60;

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 32): string {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function sha256(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/** Only same-site paths, so `?next=` can't bounce people elsewhere. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function origin(c: Context<AppEnv>): string {
  return c.env.PUBLIC_ORIGIN ?? new URL(c.req.url).origin;
}

function cookieOptions(c: Context<AppEnv>, maxAge: number) {
  return { httpOnly: true, secure: origin(c).startsWith('https://') || origin(c).includes('localhost'), sameSite: 'Lax' as const, path: '/', maxAge };
}

export async function loadUser(c: Context<AppEnv>): Promise<SessionUser | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.discord_id, u.username, u.display_name, u.avatar_url,
            EXISTS (SELECT 1 FROM dm_allowlist a WHERE a.discord_id = u.discord_id) AS is_dm
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > unixepoch()`
  )
    .bind(await sha256(token))
    .first<{ id: string; discord_id: string; username: string; display_name: string | null; avatar_url: string | null; is_dm: number }>();
  if (!row) return null;
  return {
    id: row.id,
    discordId: row.discord_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isDm: row.is_dm === 1,
  };
}

/**
 * Sign-in that skips Discord, for testing as the DM or as a player. On only when
 * .dev.vars sets DEV_LOGIN=1 and the page is opened on this machine (localhost),
 * so a phone on the LAN can't use it. Never set DEV_LOGIN as a production secret.
 */
function devLoginEnabled(c: Context<AppEnv>): boolean {
  const host = new URL(c.req.url).hostname;
  return c.env.DEV_LOGIN === '1' && (host === 'localhost' || host === '127.0.0.1');
}

interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export const authRoutes = new Hono<AppEnv>()
  .get('/discord', (c) => {
    if (!c.env.DISCORD_CLIENT_ID) return c.text('Discord sign-in is not configured (DISCORD_CLIENT_ID).', 500);
    const state = randomToken(16);
    const next = safeNext(c.req.query('next'));
    setCookie(c, OAUTH_COOKIE, `${state}|${next}`, cookieOptions(c, 600));
    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', c.env.DISCORD_CLIENT_ID);
    url.searchParams.set('scope', 'identify');
    url.searchParams.set('state', state);
    url.searchParams.set('redirect_uri', `${origin(c)}/auth/discord/callback`);
    url.searchParams.set('prompt', 'none');
    return c.redirect(url.toString());
  })

  .get('/discord/callback', async (c) => {
    const [expectedState, next] = (getCookie(c, OAUTH_COOKIE) ?? '').split('|');
    deleteCookie(c, OAUTH_COOKIE, { path: '/' });
    const code = c.req.query('code');
    if (!code || !expectedState || c.req.query('state') !== expectedState) {
      return c.redirect(`/login?error=${encodeURIComponent('Sign-in expired, please try again.')}`);
    }

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: c.env.DISCORD_CLIENT_ID ?? '',
        client_secret: c.env.DISCORD_CLIENT_SECRET ?? '',
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${origin(c)}/auth/discord/callback`,
      }),
    });
    if (!tokenRes.ok) return c.redirect(`/login?error=${encodeURIComponent('Discord did not accept the sign-in.')}`);
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const meRes = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } });
    if (!meRes.ok) return c.redirect(`/login?error=${encodeURIComponent('Could not read your Discord profile.')}`);
    const me = (await meRes.json()) as DiscordUser;

    const avatar = me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128` : null;
    const user = await c.env.DB.prepare(
      `INSERT INTO users (id, discord_id, username, display_name, avatar_url) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (discord_id) DO UPDATE SET username = excluded.username, display_name = excluded.display_name,
         avatar_url = excluded.avatar_url, updated_at = unixepoch()
       RETURNING id`
    )
      .bind(crypto.randomUUID(), me.id, me.username, me.global_name, avatar)
      .first<{ id: string }>();

    const token = randomToken();
    await c.env.DB.batch([
      // A DM allowlisted by username is pinned to this Discord account on first sign-in,
      // unless the account is already pinned to another row (it was renamed and re-added).
      c.env.DB.prepare(
        'UPDATE dm_allowlist SET discord_id = ? WHERE discord_id IS NULL AND lower(username) = lower(?) AND NOT EXISTS (SELECT 1 FROM dm_allowlist WHERE discord_id = ?)'
      ).bind(me.id, me.username, me.id),
      c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, unixepoch() + ?)').bind(await sha256(token), user!.id, SESSION_SECONDS),
      c.env.DB.prepare('DELETE FROM sessions WHERE expires_at < unixepoch()'),
    ]);
    setCookie(c, SESSION_COOKIE, token, cookieOptions(c, SESSION_SECONDS));
    return c.redirect(safeNext(next));
  })

  // Dev sign-in (see devLoginEnabled): who can be signed in as, then the sign-in itself.
  .get('/dev', async (c) => {
    if (!devLoginEnabled(c)) return c.json({ error: 'Not found' }, 404);
    const { results } = await c.env.DB.prepare(
      `SELECT u.id, u.username, u.display_name, u.avatar_url,
              EXISTS (SELECT 1 FROM dm_allowlist a WHERE a.discord_id = u.discord_id) AS is_dm
         FROM users u ORDER BY is_dm DESC, lower(u.username)`
    ).all<{ id: string; username: string; display_name: string | null; avatar_url: string | null; is_dm: number }>();
    return c.json({
      users: results.map((u) => ({ id: u.id, username: u.username, displayName: u.display_name, avatarUrl: u.avatar_url, isDm: u.is_dm === 1 })),
    });
  })

  /** Signs in as `userId`, or as a new test player (never on the DM allowlist) when it is left out. */
  .post('/dev', async (c) => {
    if (!devLoginEnabled(c)) return c.json({ error: 'Not found' }, 404);
    const { userId } = await c.req.json<{ userId?: string }>().catch(() => ({ userId: undefined }));
    let id = userId;
    if (id) {
      const exists = await c.env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(id).first();
      if (!exists) return c.json({ error: 'No such user' }, 404);
    } else {
      const tag = randomToken(2);
      const row = await c.env.DB.prepare('INSERT INTO users (id, discord_id, username, display_name) VALUES (?, ?, ?, ?) RETURNING id')
        .bind(crypto.randomUUID(), `dev-${tag}`, `test-player-${tag}`, `Test player ${tag}`)
        .first<{ id: string }>();
      id = row!.id;
    }
    const token = randomToken();
    await c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, unixepoch() + ?)').bind(await sha256(token), id, SESSION_SECONDS).run();
    setCookie(c, SESSION_COOKIE, token, cookieOptions(c, SESSION_SECONDS));
    return c.json({ ok: true });
  })

  .post('/logout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run();
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });
