// The table jukebox's library: YouTube videos and uploaded audio (bytes in R2
// under sounds/<campaign>/<id>), and the scenes the DM saves from it. Only the
// DM lists or changes the library; any member may stream a file, because the
// jukebox plays it on every player's device. What is playing now lives in the
// TableRoom (worker/table.ts), not here.
import { Hono, type Context } from 'hono';
import { HttpError, requireCampaignDm, requireMember } from '../access';
import type { AppEnv } from '../types';
import { cleanRef, SOUND_CATEGORIES, type SceneMix, type SoundCategory } from '../../src/features/sound/jukebox';
import { isPlaylistOnly, parseYouTube } from '../../src/features/sound/youtube';

/** Workers accept request bodies up to 100 MB. */
const MAX_UPLOAD = 100 * 1024 * 1024;
const AUDIO_TYPE = /^(audio\/[\w.+-]+|video\/(mp4|webm|ogg))$/;

interface SoundRow {
  id: string;
  campaign_id: string;
  name: string;
  category: SoundCategory;
  source: 'file' | 'youtube';
  file_key: string | null;
  mime: string | null;
  size: number | null;
  youtube_id: string | null;
  start_seconds: number;
  duration: number | null;
  created_at: number;
}

interface SceneRow {
  id: string;
  campaign_id: string;
  name: string;
  mix: string;
  updated_at: number;
}

const toSound = (r: SoundRow) => ({
  id: r.id,
  campaignId: r.campaign_id,
  name: r.name,
  category: r.category,
  source: r.source === 'youtube' ? { kind: 'youtube' as const, videoId: r.youtube_id!, start: r.start_seconds } : { kind: 'file' as const },
  duration: r.duration,
  size: r.size,
  mime: r.mime,
  createdAt: new Date(r.created_at * 1000).toISOString(),
});

const toScene = (r: SceneRow) => {
  let mix: SceneMix = { music: null, layers: [] };
  try {
    mix = JSON.parse(r.mix);
  } catch {
    // A scene that can't be read plays as silence.
  }
  return { id: r.id, campaignId: r.campaign_id, name: r.name, mix, updatedAt: new Date(r.updated_at * 1000).toISOString() };
};

const cleanName = (name: unknown, fallback: string) => (typeof name === 'string' && name.trim() ? name.trim().slice(0, 200) : fallback);

function category(value: unknown): SoundCategory {
  if (typeof value === 'string' && SOUND_CATEGORIES.includes(value as SoundCategory)) return value as SoundCategory;
  throw new HttpError(400, 'A sound is music, ambience or an effect');
}

function files(c: Context<AppEnv>): R2Bucket {
  if (!c.env.FILES) throw new HttpError(500, 'File storage (R2) is not set up for Tome yet, so only YouTube links can be added');
  return c.env.FILES;
}

async function soundRow(c: Context<AppEnv>, id: string): Promise<SoundRow> {
  const row = await c.env.DB.prepare('SELECT * FROM sounds WHERE id = ?').bind(id).first<SoundRow>();
  if (!row) throw new HttpError(404, 'That sound is not in the library');
  return row;
}

async function sceneRow(c: Context<AppEnv>, id: string): Promise<SceneRow> {
  const row = await c.env.DB.prepare('SELECT * FROM sound_scenes WHERE id = ?').bind(id).first<SceneRow>();
  if (!row) throw new HttpError(404, 'That scene does not exist');
  return row;
}

/** A scene's mix with only sounds that check out. */
function cleanMix(x: unknown): SceneMix {
  const m = (x ?? {}) as Partial<SceneMix>;
  const queue = (Array.isArray(m.music?.queue) ? m.music.queue : []).map(cleanRef).filter((r) => r !== null);
  const layers = (Array.isArray(m.layers) ? m.layers : []).flatMap((l) => {
    const sound = cleanRef(l?.sound);
    return sound ? [{ sound, volume: typeof l.volume === 'number' ? Math.min(1, Math.max(0, l.volume)) : 0.6 }] : [];
  });
  return {
    music: queue.length ? { queue, loop: m.music?.loop ?? 'queue', volume: typeof m.music?.volume === 'number' ? m.music.volume : 0.7 } : null,
    layers,
  };
}

/** One byte range from a Range header against an object of `size` bytes; null to send it all. */
function byteRange(header: string | undefined, size: number): { offset: number; length: number } | 'unsatisfiable' | null {
  const m = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (!m[1] && !m[2])) return null;
  if (!m[1]) {
    const length = Math.min(Number(m[2]), size);
    return length > 0 ? { offset: size - length, length } : 'unsatisfiable';
  }
  const offset = Number(m[1]);
  if (offset >= size) return 'unsatisfiable';
  const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  return end < offset ? 'unsatisfiable' : { offset, length: end - offset + 1 };
}

/** The title YouTube gives a video, or an error when it can't be played outside YouTube. */
async function youTubeTitle(videoId: string): Promise<string | null> {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return null;
  }
  if (res.status === 401 || res.status === 403) throw new HttpError(400, "That video's owner doesn't allow it to play outside YouTube");
  if (res.status === 404 || res.status === 400) throw new HttpError(400, 'YouTube has no public video at that link');
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { title?: string } | null;
  return body?.title?.trim() || null;
}

export const soundRoutes = new Hono<AppEnv>()
  .get('/campaigns/:id/sounds', async (c) => {
    await requireCampaignDm(c, c.req.param('id'));
    const { results } = await c.env.DB.prepare('SELECT * FROM sounds WHERE campaign_id = ? ORDER BY created_at DESC').bind(c.req.param('id')).all<SoundRow>();
    return c.json({ sounds: results.map(toSound), uploads: Boolean(c.env.FILES) });
  })

  /** Adds a YouTube video. The same video at the same start is only kept once per category. */
  .post('/campaigns/:id/sounds/youtube', async (c) => {
    const campaignId = c.req.param('id');
    const user = await requireCampaignDm(c, campaignId);
    const body = await c.req.json<{ url?: string; category?: string; name?: string }>().catch(() => ({} as { url?: string; category?: string; name?: string }));
    const cat = category(body.category);
    const url = (body.url ?? '').trim();
    const link = parseYouTube(url);
    if (!link) {
      throw new HttpError(400, isPlaylistOnly(url) ? 'Playlists can\'t be added yet. Open one video from it and paste that link.' : 'That is not a YouTube video link');
    }
    const existing = await c.env.DB.prepare('SELECT * FROM sounds WHERE campaign_id = ? AND category = ? AND youtube_id = ? AND start_seconds = ?')
      .bind(campaignId, cat, link.videoId, link.start)
      .first<SoundRow>();
    if (existing) return c.json({ sound: toSound(existing), existing: true });

    const title = await youTubeTitle(link.videoId);
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO sounds (id, campaign_id, name, category, source, youtube_id, start_seconds, created_by) VALUES (?, ?, ?, ?, 'youtube', ?, ?, ?)`
    )
      .bind(id, campaignId, cleanName(body.name, title ?? `YouTube ${link.videoId}`), cat, link.videoId, link.start, user.id)
      .run();
    return c.json({ sound: toSound(await soundRow(c, id)), existing: false });
  })

  /** Uploads an audio file. The body is the file itself; name, category and duration ride in the query. */
  .put('/campaigns/:id/sounds/upload', async (c) => {
    const campaignId = c.req.param('id');
    const user = await requireCampaignDm(c, campaignId);
    const bucket = files(c);
    const cat = category(c.req.query('category'));
    const mime = (c.req.header('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
    if (!AUDIO_TYPE.test(mime)) throw new HttpError(400, 'That file is not audio Tome can play');
    const size = Number(c.req.header('Content-Length'));
    if (!Number.isFinite(size) || size <= 0) throw new HttpError(400, 'The upload arrived without its size');
    if (size > MAX_UPLOAD) return c.json({ error: 'That file is over 100 MB' }, 413);
    if (!c.req.raw.body) throw new HttpError(400, 'The upload was empty');

    const duration = Number(c.req.query('duration'));
    const id = crypto.randomUUID();
    const key = `sounds/${campaignId}/${id}`;
    await bucket.put(key, c.req.raw.body, { httpMetadata: { contentType: mime } });
    await c.env.DB.prepare(
      `INSERT INTO sounds (id, campaign_id, name, category, source, file_key, mime, size, duration, created_by) VALUES (?, ?, ?, ?, 'file', ?, ?, ?, ?, ?)`
    )
      .bind(id, campaignId, cleanName(c.req.query('name'), 'Untitled'), cat, key, mime, size, Number.isFinite(duration) && duration > 0 ? duration : null, user.id)
      .run();
    return c.json({ sound: toSound(await soundRow(c, id)) });
  })

  .patch('/sounds/:id', async (c) => {
    const row = await soundRow(c, c.req.param('id'));
    await requireCampaignDm(c, row.campaign_id);
    const body = await c.req.json<{ name?: string; category?: string; duration?: number }>().catch(() => ({} as { name?: string; category?: string; duration?: number }));
    const name = body.name === undefined ? row.name : cleanName(body.name, row.name);
    const cat = body.category === undefined ? row.category : category(body.category);
    const duration = typeof body.duration === 'number' && Number.isFinite(body.duration) && body.duration > 0 ? body.duration : row.duration;
    await c.env.DB.prepare('UPDATE sounds SET name = ?, category = ?, duration = ? WHERE id = ?').bind(name, cat, duration, row.id).run();
    return c.json({ sound: toSound({ ...row, name, category: cat, duration }) });
  })

  .delete('/sounds/:id', async (c) => {
    const row = await soundRow(c, c.req.param('id'));
    await requireCampaignDm(c, row.campaign_id);
    if (row.file_key && c.env.FILES) await c.env.FILES.delete(row.file_key);
    await c.env.DB.prepare('DELETE FROM sounds WHERE id = ?').bind(row.id).run();
    return c.json({ ok: true });
  })

  /** Streams an uploaded file, with byte ranges so players can join a track midway. */
  .get('/sounds/:id/file', async (c) => {
    const row = await soundRow(c, c.req.param('id'));
    await requireMember(c, row.campaign_id);
    if (!row.file_key) throw new HttpError(404, 'That sound plays from YouTube');
    const bucket = files(c);

    const headers = new Headers({ 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=31536000, immutable' });
    const rangeHeader = c.req.header('Range');
    if (rangeHeader) {
      const head = await bucket.head(row.file_key);
      if (!head) throw new HttpError(404, 'That file is missing from storage');
      const range = byteRange(rangeHeader, head.size);
      if (range === 'unsatisfiable') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${head.size}` } });
      if (range) {
        const part = await bucket.get(row.file_key, { range });
        if (!part) throw new HttpError(404, 'That file is missing from storage');
        part.writeHttpMetadata(headers);
        headers.set('ETag', part.httpEtag);
        headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`);
        headers.set('Content-Length', String(range.length));
        return new Response(part.body, { status: 206, headers });
      }
    }
    const obj = await bucket.get(row.file_key);
    if (!obj) throw new HttpError(404, 'That file is missing from storage');
    obj.writeHttpMetadata(headers);
    headers.set('ETag', obj.httpEtag);
    headers.set('Content-Length', String(obj.size));
    return new Response(obj.body, { headers });
  })

  .get('/campaigns/:id/sound-scenes', async (c) => {
    await requireCampaignDm(c, c.req.param('id'));
    const { results } = await c.env.DB.prepare('SELECT * FROM sound_scenes WHERE campaign_id = ? ORDER BY created_at').bind(c.req.param('id')).all<SceneRow>();
    return c.json({ scenes: results.map(toScene) });
  })

  .post('/campaigns/:id/sound-scenes', async (c) => {
    const campaignId = c.req.param('id');
    await requireCampaignDm(c, campaignId);
    const body = await c.req.json<{ name?: string; mix?: unknown }>().catch(() => ({} as { name?: string; mix?: unknown }));
    const mix = cleanMix(body.mix);
    if (!mix.music && !mix.layers.length) throw new HttpError(400, 'Nothing is playing to save as a scene');
    const id = crypto.randomUUID();
    await c.env.DB.prepare('INSERT INTO sound_scenes (id, campaign_id, name, mix) VALUES (?, ?, ?, ?)')
      .bind(id, campaignId, cleanName(body.name, 'Scene'), JSON.stringify(mix))
      .run();
    return c.json({ scene: toScene(await sceneRow(c, id)) });
  })

  .put('/sound-scenes/:id', async (c) => {
    const row = await sceneRow(c, c.req.param('id'));
    await requireCampaignDm(c, row.campaign_id);
    const body = await c.req.json<{ name?: string; mix?: unknown }>().catch(() => ({} as { name?: string; mix?: unknown }));
    const name = body.name === undefined ? row.name : cleanName(body.name, row.name);
    const mix = body.mix === undefined ? row.mix : JSON.stringify(cleanMix(body.mix));
    await c.env.DB.prepare('UPDATE sound_scenes SET name = ?, mix = ?, updated_at = unixepoch() WHERE id = ?').bind(name, mix, row.id).run();
    return c.json({ scene: toScene(await sceneRow(c, row.id)) });
  })

  .delete('/sound-scenes/:id', async (c) => {
    const row = await sceneRow(c, c.req.param('id'));
    await requireCampaignDm(c, row.campaign_id);
    await c.env.DB.prepare('DELETE FROM sound_scenes WHERE id = ?').bind(row.id).run();
    return c.json({ ok: true });
  });
