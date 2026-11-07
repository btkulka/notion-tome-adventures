// Maps, their objects and fog, the live session, travel log, and the live-table
// socket. Players read; only the campaign's DM writes. Hidden objects never
// leave the Worker for a player, over HTTP or the socket.
import { Hono, type Context } from 'hono';
import { HttpError, requireCampaignDm, requireMember } from '../access';
import { broadcast } from '../table';
import type { AppEnv } from '../types';

interface MapRow {
  id: string;
  campaign_id: string;
  parent_map_id: string | null;
  parent_pin_id: string | null;
  kind: string;
  name: string;
  width: number;
  height: number;
  scale: number;
  seed: number;
  gen_params: string | null;
  terrain: string;
  settings: string;
  version: number;
  thumbnail_key: string | null;
  updated_at: number;
}

interface ObjectRow {
  id: string;
  map_id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  rot: number;
  hidden: number;
  data: string;
}

interface TravelRow {
  id: string;
  campaign_id: string;
  map_id: string;
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
  path: string;
  minutes: number;
  miles: number;
  pace: string;
  started_at: number;
  encounter: string | null;
  created_at: number;
}

interface ObjectInput {
  id?: string;
  type: string;
  x?: number;
  y?: number;
  z?: number;
  rot?: number;
  hidden?: boolean;
  data?: unknown;
}

const parse = <T>(text: string | null, empty: T): T => {
  if (!text) return empty;
  try {
    return JSON.parse(text) as T;
  } catch {
    return empty;
  }
};

const summary = (r: MapRow) => ({
  id: r.id,
  campaignId: r.campaign_id,
  parentMapId: r.parent_map_id,
  parentPinId: r.parent_pin_id,
  kind: r.kind,
  name: r.name,
  width: r.width,
  height: r.height,
  scale: r.scale,
  seed: r.seed,
  version: r.version,
  thumbnailKey: r.thumbnail_key,
  updatedAt: new Date(r.updated_at * 1000).toISOString(),
});

const full = (r: MapRow) => ({
  ...summary(r),
  genParams: parse(r.gen_params, null),
  terrain: parse(r.terrain, { heights: '', biomes: '' }),
  settings: parse(r.settings, {}),
});

const object = (r: ObjectRow) => ({
  id: r.id,
  mapId: r.map_id,
  type: r.type,
  x: r.x,
  y: r.y,
  z: r.z,
  rot: r.rot,
  hidden: r.hidden === 1,
  data: parse(r.data, {}),
});

async function mapCampaign(c: Context<AppEnv>, mapId: string): Promise<string> {
  const row = await c.env.DB.prepare('SELECT campaign_id FROM maps WHERE id = ?').bind(mapId).first<{ campaign_id: string }>();
  if (!row) throw new HttpError(404, 'That map does not exist');
  return row.campaign_id;
}

const upsertObject = (db: D1Database, mapId: string, o: ObjectInput & { id: string }) =>
  db
    .prepare(
      `INSERT INTO map_objects (id, map_id, type, x, y, z, rot, hidden, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET type = excluded.type, x = excluded.x, y = excluded.y, z = excluded.z, rot = excluded.rot,
         hidden = excluded.hidden, data = excluded.data, updated_at = unixepoch()
       WHERE map_objects.map_id = excluded.map_id`
    )
    .bind(o.id, mapId, o.type, o.x ?? 0, o.y ?? 0, o.z ?? 0, o.rot ?? 0, o.hidden ? 1 : 0, JSON.stringify(o.data ?? {}));

const LIVE_FIELDS: Record<string, string> = {
  status: 'status',
  activeMapId: 'active_map_id',
  partyMapId: 'party_map_id',
  partyX: 'party_x',
  partyY: 'party_y',
  worldMinutes: 'world_minutes',
  weather: 'weather',
  notionSessionId: 'notion_session_id',
};

const live = (r: Record<string, unknown> | null) =>
  r && {
    campaignId: r.campaign_id,
    status: r.status,
    activeMapId: r.active_map_id,
    partyMapId: r.party_map_id,
    partyX: r.party_x,
    partyY: r.party_y,
    worldMinutes: r.world_minutes,
    weather: r.weather,
    notionSessionId: r.notion_session_id,
    updatedAt: new Date(Number(r.updated_at) * 1000).toISOString(),
  };

export const mapRoutes = new Hono<AppEnv>()
  .get('/campaigns/:id/maps', async (c) => {
    await requireCampaignDm(c, c.req.param('id'));
    const { results } = await c.env.DB.prepare('SELECT * FROM maps WHERE campaign_id = ? ORDER BY updated_at DESC').bind(c.req.param('id')).all<MapRow>();
    return c.json({ maps: results.map(summary) });
  })

  .post('/campaigns/:id/maps', async (c) => {
    const user = await requireCampaignDm(c, c.req.param('id'));
    const body = await c.req.json<{
      name: string;
      kind: 'overworld' | 'local';
      width: number;
      height: number;
      scale?: number;
      seed?: number;
      genParams?: unknown;
      terrain: unknown;
      settings?: unknown;
      parentMapId?: string | null;
      parentPinId?: string | null;
      objects?: ObjectInput[];
    }>();
    const id = crypto.randomUUID();
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO maps (id, campaign_id, parent_map_id, parent_pin_id, kind, name, width, height, scale, seed, gen_params, terrain, settings, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, c.req.param('id'), body.parentMapId ?? null, body.parentPinId ?? null, body.kind, body.name, body.width, body.height,
        body.scale ?? 1, body.seed ?? 0, body.genParams ? JSON.stringify(body.genParams) : null, JSON.stringify(body.terrain),
        JSON.stringify(body.settings ?? {}), user.id
      ),
      ...(body.objects ?? []).map((o) => upsertObject(c.env.DB, id, { ...o, id: o.id ?? crypto.randomUUID() })),
    ]);
    return c.json({ id });
  })

  .get('/maps/:id', async (c) => {
    await requireMember(c, await mapCampaign(c, c.req.param('id')));
    const row = await c.env.DB.prepare('SELECT * FROM maps WHERE id = ?').bind(c.req.param('id')).first<MapRow>();
    return c.json({ map: full(row!) });
  })

  /** Optimistic concurrency: the write only lands if `version` is still current. */
  .put('/maps/:id', async (c) => {
    const campaignId = await mapCampaign(c, c.req.param('id'));
    await requireCampaignDm(c, campaignId);
    const body = await c.req.json<{ version: number; name?: string; terrain?: unknown; settings?: unknown; genParams?: unknown; thumbnailKey?: string | null }>();
    const sets: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => {
      sets.push(`${column} = ?`);
      values.push(value);
    };
    if (body.name !== undefined) set('name', body.name);
    if (body.terrain !== undefined) set('terrain', JSON.stringify(body.terrain));
    if (body.settings !== undefined) set('settings', JSON.stringify(body.settings));
    if (body.genParams !== undefined) set('gen_params', JSON.stringify(body.genParams));
    if (body.thumbnailKey !== undefined) set('thumbnail_key', body.thumbnailKey);
    const result = await c.env.DB.prepare(
      `UPDATE maps SET ${[...sets, 'version = version + 1', 'updated_at = unixepoch()'].join(', ')} WHERE id = ? AND version = ?`
    )
      .bind(...values, c.req.param('id'), body.version)
      .run();
    if (result.meta.changes === 0) throw new HttpError(409, 'This map changed in another window. Reload to get the latest version.');
    await broadcast(c.env, campaignId, 'all', { type: 'map', mapId: c.req.param('id'), version: body.version + 1 });
    return c.json({ version: body.version + 1 });
  })

  .delete('/maps/:id', async (c) => {
    await requireCampaignDm(c, await mapCampaign(c, c.req.param('id')));
    await c.env.DB.prepare('DELETE FROM maps WHERE id = ?').bind(c.req.param('id')).run();
    return c.json({ ok: true });
  })

  .get('/maps/:id/objects', async (c) => {
    const { role } = await requireMember(c, await mapCampaign(c, c.req.param('id')));
    const sql = role === 'dm' ? 'SELECT * FROM map_objects WHERE map_id = ?' : 'SELECT * FROM map_objects WHERE map_id = ? AND hidden = 0';
    const { results } = await c.env.DB.prepare(sql).bind(c.req.param('id')).all<ObjectRow>();
    return c.json({ objects: results.map(object) });
  })

  .put('/maps/:id/objects', async (c) => {
    const mapId = c.req.param('id');
    const campaignId = await mapCampaign(c, mapId);
    await requireCampaignDm(c, campaignId);
    const { objects } = await c.req.json<{ objects: ObjectInput[] }>();
    const withIds = objects.map((o) => ({ ...o, id: o.id ?? crypto.randomUUID() }));
    if (withIds.length) await c.env.DB.batch(withIds.map((o) => upsertObject(c.env.DB, mapId, o)));
    const saved = withIds.map((o) => ({ id: o.id, mapId, type: o.type, x: o.x ?? 0, y: o.y ?? 0, z: o.z ?? 0, rot: o.rot ?? 0, hidden: Boolean(o.hidden), data: o.data ?? {} }));
    await Promise.all([
      broadcast(c.env, campaignId, 'dm', { type: 'objects', mapId, upsert: saved, remove: [] }),
      broadcast(c.env, campaignId, 'players', {
        type: 'objects',
        mapId,
        upsert: saved.filter((o) => !o.hidden),
        remove: saved.filter((o) => o.hidden).map((o) => o.id),
      }),
    ]);
    return c.json({ objects: saved });
  })

  .delete('/maps/:id/objects/:objectId', async (c) => {
    const mapId = c.req.param('id');
    const campaignId = await mapCampaign(c, mapId);
    await requireCampaignDm(c, campaignId);
    await c.env.DB.prepare('DELETE FROM map_objects WHERE id = ? AND map_id = ?').bind(c.req.param('objectId'), mapId).run();
    await broadcast(c.env, campaignId, 'all', { type: 'objects', mapId, upsert: [], remove: [c.req.param('objectId')] });
    return c.json({ ok: true });
  })

  .get('/maps/:id/fog', async (c) => {
    await requireMember(c, await mapCampaign(c, c.req.param('id')));
    const row = await c.env.DB.prepare('SELECT explored FROM map_fog WHERE map_id = ?').bind(c.req.param('id')).first<{ explored: string }>();
    return c.json({ explored: row?.explored ?? null });
  })

  .put('/maps/:id/fog', async (c) => {
    const mapId = c.req.param('id');
    const campaignId = await mapCampaign(c, mapId);
    await requireCampaignDm(c, campaignId);
    const { explored } = await c.req.json<{ explored: string }>();
    await c.env.DB.prepare(
      'INSERT INTO map_fog (map_id, explored) VALUES (?, ?) ON CONFLICT (map_id) DO UPDATE SET explored = excluded.explored, updated_at = unixepoch()'
    )
      .bind(mapId, explored)
      .run();
    await broadcast(c.env, campaignId, 'all', { type: 'fog', mapId, explored });
    return c.json({ ok: true });
  })

  .get('/campaigns/:id/live', async (c) => {
    await requireMember(c, c.req.param('id'));
    const row = await c.env.DB.prepare('SELECT * FROM live_sessions WHERE campaign_id = ?').bind(c.req.param('id')).first<Record<string, unknown>>();
    return c.json({ live: live(row) });
  })

  /** Partial update of the live session; creates it on first write. */
  .put('/campaigns/:id/live', async (c) => {
    const campaignId = c.req.param('id');
    await requireCampaignDm(c, campaignId);
    const body = await c.req.json<Record<string, unknown>>();
    const fields = Object.keys(body).filter((k) => k in LIVE_FIELDS);
    const columns = fields.map((k) => LIVE_FIELDS[k]);
    const values = fields.map((k) => body[k] ?? null);
    // A session only goes live when the DM starts it, not when the party is first placed.
    const insertColumns = columns.includes('status') ? columns : [...columns, 'status'];
    const insertValues = columns.includes('status') ? values : [...values, 'ended'];
    await c.env.DB.prepare(
      `INSERT INTO live_sessions (campaign_id${insertColumns.map((col) => `, ${col}`).join('')}) VALUES (?${insertColumns.map(() => ', ?').join('')})
       ON CONFLICT (campaign_id) DO UPDATE SET ${[...columns.map((col) => `${col} = excluded.${col}`), 'updated_at = unixepoch()'].join(', ')}`
    )
      .bind(campaignId, ...insertValues)
      .run();
    const row = await c.env.DB.prepare('SELECT * FROM live_sessions WHERE campaign_id = ?').bind(campaignId).first<Record<string, unknown>>();
    await broadcast(c.env, campaignId, 'all', { type: 'live', live: live(row) });
    return c.json({ live: live(row) });
  })

  .post('/campaigns/:id/travel', async (c) => {
    const campaignId = c.req.param('id');
    await requireCampaignDm(c, campaignId);
    const t = await c.req.json<{ mapId: string; from: [number, number]; to: [number, number]; path: [number, number][]; minutes: number; miles: number; pace: string; startedAt: number; encounter?: unknown }>();
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO travel_log (id, campaign_id, map_id, from_x, from_y, to_x, to_y, path, minutes, miles, pace, started_at, encounter)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, campaignId, t.mapId, t.from[0], t.from[1], t.to[0], t.to[1], JSON.stringify(t.path), t.minutes, t.miles, t.pace, t.startedAt, t.encounter ? JSON.stringify(t.encounter) : null)
      .run();
    return c.json({ id });
  })

  .get('/campaigns/:id/travel', async (c) => {
    await requireCampaignDm(c, c.req.param('id'));
    const { results } = await c.env.DB.prepare('SELECT * FROM travel_log WHERE campaign_id = ? ORDER BY created_at DESC LIMIT 100')
      .bind(c.req.param('id'))
      .all<TravelRow>();
    return c.json({
      log: results.map((r) => ({
        id: r.id, campaignId: r.campaign_id, mapId: r.map_id, from: [r.from_x, r.from_y], to: [r.to_x, r.to_y], path: parse(r.path, []),
        minutes: r.minutes, miles: r.miles, pace: r.pace, startedAt: r.started_at, encounter: parse(r.encounter, null),
        createdAt: new Date(r.created_at * 1000).toISOString(),
      })),
    });
  })

  /** WebSocket into the campaign's live table. */
  .get('/campaigns/:id/table', async (c) => {
    const { user, role } = await requireMember(c, c.req.param('id'));
    if (c.req.header('Upgrade') !== 'websocket') throw new HttpError(400, 'Expected a WebSocket upgrade');
    const stub = c.env.TABLE.get(c.env.TABLE.idFromName(c.req.param('id')));
    const headers = new Headers(c.req.raw.headers);
    headers.set('X-User-Id', user.id);
    headers.set('X-Role', role);
    headers.set('X-Name', user.displayName ?? user.username);
    headers.set('X-Avatar', user.avatarUrl ?? '');
    return stub.fetch('https://table/connect', { headers });
  });
