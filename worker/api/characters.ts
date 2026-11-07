// Player characters. Any member keeps their own; the campaign's DM keeps
// everyone's and can add one for a player who hasn't joined yet. A linked D&D
// Beyond sheet fills in the details (read by src/lib/characters.ts).
import { Hono, type Context } from 'hono';
import { HttpError, requireCampaignDm, requireMember } from '../access';
import type { CampaignRole } from '../notion/context';
import type { AppEnv, SessionUser } from '../types';
import {
  ddbCharacterId,
  ddbServiceUrl,
  ddbSheetUrl,
  LIGHT_SOURCES,
  MAX_LEVEL,
  MAX_NAME,
  readDdbSheet,
  type DdbSheet,
} from '../../src/lib/characters';

interface CharacterRow {
  id: string;
  campaign_id: string;
  owner_id: string | null;
  owner_username: string | null;
  owner_display_name: string | null;
  played_by: string | null;
  name: string;
  race: string;
  class_name: string;
  level: number;
  portrait_url: string | null;
  darkvision: number;
  light_source: string;
  active: number;
  ddb_id: string | null;
  ddb_synced_at: number | null;
}

const SELECT = `
  SELECT c.*, u.username AS owner_username, u.display_name AS owner_display_name,
         (SELECT m.user_id FROM campaign_members m WHERE m.campaign_id = c.campaign_id AND m.character_id = c.id LIMIT 1) AS played_by
    FROM characters c LEFT JOIN users u ON u.id = c.owner_id`;

function toDto(r: CharacterRow) {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    ownerId: r.owner_id,
    ownerName: r.owner_id ? (r.owner_display_name ?? r.owner_username) : null,
    playedBy: r.played_by,
    name: r.name,
    race: r.race,
    characterClass: r.class_name,
    level: r.level,
    portraitUrl: r.portrait_url,
    darkvision: r.darkvision,
    lightSource: r.light_source,
    active: r.active === 1,
    ddbId: r.ddb_id,
    ddbUrl: r.ddb_id ? ddbSheetUrl(r.ddb_id) : null,
    ddbSyncedAt: r.ddb_synced_at === null ? null : new Date(r.ddb_synced_at * 1000).toISOString(),
  };
}

async function loadCharacter(db: D1Database, id: string): Promise<CharacterRow> {
  const row = await db.prepare(`${SELECT} WHERE c.id = ?`).bind(id).first<CharacterRow>();
  if (!row) throw new HttpError(404, 'That character does not exist');
  return row;
}

/** Its player and the campaign's DM may change a character; an unclaimed one is the DM's alone. */
async function requireEditor(c: Context<AppEnv>, row: CharacterRow): Promise<{ user: SessionUser; role: CampaignRole }> {
  const member = await requireMember(c, row.campaign_id);
  if (member.role !== 'dm' && row.owner_id !== member.user.id) throw new HttpError(403, 'Only its player or the DM can change this character');
  return member;
}

/** Reads a public sheet. Private and missing sheets are the caller's to fix, so they come back as 400s. */
async function fetchDdbSheet(ddbId: string): Promise<DdbSheet> {
  let res: Response;
  try {
    res = await fetch(ddbServiceUrl(ddbId), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new HttpError(502, "D&D Beyond didn't answer. Try again in a moment.");
  }
  if (res.status === 403) {
    throw new HttpError(400, "That sheet is private. On D&D Beyond, open the character's settings, set Character Privacy to Public, then try again.");
  }
  if (res.status === 404) throw new HttpError(400, 'D&D Beyond has no character at that link.');
  const body = (await res.json().catch(() => null)) as { success?: boolean; data?: unknown } | null;
  if (!res.ok || !body?.success || !body.data) throw new HttpError(502, `D&D Beyond couldn't send that sheet (HTTP ${res.status}). Try again in a moment.`);
  return readDdbSheet(body.data);
}

const sheetColumns = (sheet: DdbSheet) => ({
  name: sheet.name || 'Unnamed character',
  race: sheet.race,
  class_name: sheet.characterClass,
  level: sheet.level,
  portrait_url: sheet.portraitUrl,
  darkvision: sheet.darkvision,
  ddb_synced_at: Math.floor(Date.now() / 1000),
});

/** What a create or edit may send. `ddbUrl: null` unlinks the sheet. */
interface CharacterInput {
  name?: string;
  race?: string;
  characterClass?: string;
  level?: number;
  portraitUrl?: string | null;
  darkvision?: number;
  lightSource?: string;
  active?: boolean;
  ddbUrl?: string | null;
  ownerId?: string | null;
  /** On create: the owner plays this one from now on. */
  play?: boolean;
}

type Columns = Partial<{
  name: string;
  race: string;
  class_name: string;
  level: number;
  portrait_url: string | null;
  darkvision: number;
  light_source: string;
  active: number;
  ddb_id: string | null;
  ddb_synced_at: number | null;
}>;

const shortText = (value: unknown, field: string, max = MAX_NAME): string => {
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text`);
  const text = value.trim();
  if (text.length > max) throw new HttpError(400, `${field} is too long`);
  return text;
};

const wholeNumber = (value: unknown, field: string, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new HttpError(400, `${field} must be a whole number from ${min} to ${max}`);
  }
  return value;
};

/** Checks every field sent and maps it to its column; fields left out stay as they are. */
function readInput(body: CharacterInput): Columns {
  const cols: Columns = {};
  if (body.name !== undefined) {
    cols.name = shortText(body.name, 'Name');
    if (!cols.name) throw new HttpError(400, 'Give the character a name');
  }
  if (body.race !== undefined) cols.race = shortText(body.race, 'Race');
  if (body.characterClass !== undefined) cols.class_name = shortText(body.characterClass, 'Class');
  if (body.level !== undefined) cols.level = wholeNumber(body.level, 'Level', 1, MAX_LEVEL);
  if (body.darkvision !== undefined) cols.darkvision = wholeNumber(body.darkvision, 'Darkvision', 0, 1000);
  if (body.portraitUrl !== undefined) {
    const url = body.portraitUrl === null ? '' : shortText(body.portraitUrl, 'Portrait link', 2048);
    if (url && !/^https:\/\/\S+$/.test(url)) throw new HttpError(400, 'The portrait must be an https:// image link');
    cols.portrait_url = url || null;
  }
  if (body.lightSource !== undefined) {
    if (!(LIGHT_SOURCES as readonly string[]).includes(body.lightSource)) throw new HttpError(400, `Light source must be one of ${LIGHT_SOURCES.join(', ')}`);
    cols.light_source = body.lightSource;
  }
  if (body.active !== undefined) cols.active = body.active ? 1 : 0;
  if (body.ddbUrl !== undefined) {
    if (body.ddbUrl === null || body.ddbUrl.trim() === '') {
      cols.ddb_id = null;
      cols.ddb_synced_at = null;
    } else {
      const id = ddbCharacterId(body.ddbUrl);
      if (!id) throw new HttpError(400, "That isn't a D&D Beyond character link. Copy it from the sheet's address bar.");
      cols.ddb_id = id;
    }
  }
  return cols;
}

async function assertSheetFree(db: D1Database, campaignId: string, ddbId: string, exceptId: string | null): Promise<void> {
  const other = await db
    .prepare('SELECT name FROM characters WHERE campaign_id = ? AND ddb_id = ? AND id IS NOT ?')
    .bind(campaignId, ddbId, exceptId)
    .first<{ name: string }>();
  if (other) throw new HttpError(409, `That sheet is already in this campaign as ${other.name}`);
}

async function assertPlayer(db: D1Database, campaignId: string, userId: string): Promise<void> {
  const row = await db.prepare("SELECT 1 FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND role = 'player'").bind(campaignId, userId).first();
  if (!row) throw new HttpError(400, 'Characters can only belong to players in this campaign');
}

/**
 * Sits a member down with a character: it becomes theirs, and no one else plays
 * it any more. Callers check that the member may take it.
 */
export function seatStatements(db: D1Database, campaignId: string, userId: string, characterId: string | null): D1PreparedStatement[] {
  if (characterId === null) {
    return [db.prepare('UPDATE campaign_members SET character_id = NULL WHERE campaign_id = ? AND user_id = ?').bind(campaignId, userId)];
  }
  return [
    db.prepare('UPDATE campaign_members SET character_id = NULL WHERE campaign_id = ? AND character_id = ? AND user_id <> ?').bind(campaignId, characterId, userId),
    db.prepare('UPDATE characters SET owner_id = ?, updated_at = unixepoch() WHERE id = ? AND owner_id IS NOT ?').bind(userId, characterId, userId),
    db.prepare('UPDATE campaign_members SET character_id = ? WHERE campaign_id = ? AND user_id = ?').bind(characterId, campaignId, userId),
  ];
}

/** The character to seat, checked against the campaign. */
export async function characterInCampaign(db: D1Database, campaignId: string, characterId: string): Promise<CharacterRow> {
  const row = await loadCharacter(db, characterId);
  if (row.campaign_id !== campaignId) throw new HttpError(404, 'That character is not in this campaign');
  return row;
}

function updateStatement(db: D1Database, id: string, cols: Columns): D1PreparedStatement | null {
  const keys = Object.keys(cols) as (keyof Columns)[];
  if (keys.length === 0) return null;
  return db
    .prepare(`UPDATE characters SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = unixepoch() WHERE id = ?`)
    .bind(...keys.map((k) => cols[k] ?? null), id);
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
}

export const characterRoutes = new Hono<AppEnv>()
  /** Everyone in the party: any member may look. */
  .get('/campaigns/:id/characters', async (c) => {
    await requireMember(c, c.req.param('id'));
    const { results } = await c.env.DB.prepare(`${SELECT} WHERE c.campaign_id = ? ORDER BY c.name COLLATE NOCASE`).bind(c.req.param('id')).all<CharacterRow>();
    return c.json({ characters: results.map(toDto) });
  })

  /**
   * A player adds one of their own; the DM adds one for anyone, or for no one yet.
   * With a D&D Beyond link the sheet supplies the details.
   */
  .post('/campaigns/:id/characters', async (c) => {
    const campaignId = c.req.param('id');
    const { user, role } = await requireMember(c, campaignId);
    const body = await c.req.json<CharacterInput>().catch(() => ({}) as CharacterInput);
    const cols = readInput(body);

    let ownerId: string | null = user.id;
    if (role === 'dm') {
      ownerId = body.ownerId ?? null;
      if (ownerId) await assertPlayer(c.env.DB, campaignId, ownerId);
    } else if (body.ownerId !== undefined && body.ownerId !== user.id) {
      throw new HttpError(403, 'Only the DM can make a character for someone else');
    }

    if (cols.ddb_id) {
      await assertSheetFree(c.env.DB, campaignId, cols.ddb_id, null);
      Object.assign(cols, sheetColumns(await fetchDdbSheet(cols.ddb_id)));
    }
    if (!cols.name) throw new HttpError(400, 'Give the character a name, or link a D&D Beyond sheet');

    const id = crypto.randomUUID();
    const keys = Object.keys(cols) as (keyof Columns)[];
    const writes = [
      c.env.DB.prepare(
        `INSERT INTO characters (id, campaign_id, owner_id, created_by, ${keys.join(', ')}) VALUES (?, ?, ?, ?, ${keys.map(() => '?').join(', ')})`
      ).bind(id, campaignId, ownerId, user.id, ...keys.map((k) => cols[k] ?? null)),
    ];
    // The owner plays it if they asked to, or if they had no one to play.
    if (ownerId) {
      const seat = await c.env.DB.prepare('SELECT character_id FROM campaign_members WHERE campaign_id = ? AND user_id = ?').bind(campaignId, ownerId).first<{ character_id: string | null }>();
      if (body.play || !seat?.character_id) writes.push(...seatStatements(c.env.DB, campaignId, ownerId, id));
    }
    try {
      await c.env.DB.batch(writes);
    } catch (err) {
      if (isUniqueViolation(err)) throw new HttpError(409, 'That sheet is already in this campaign');
      throw err;
    }
    return c.json({ character: toDto(await loadCharacter(c.env.DB, id)) }, 201);
  })

  .patch('/characters/:characterId', async (c) => {
    const row = await loadCharacter(c.env.DB, c.req.param('characterId'));
    const { role } = await requireEditor(c, row);
    const body = await c.req.json<CharacterInput>().catch(() => ({}) as CharacterInput);
    const cols = readInput(body);

    if (cols.ddb_id && cols.ddb_id !== row.ddb_id) {
      await assertSheetFree(c.env.DB, row.campaign_id, cols.ddb_id, row.id);
      Object.assign(cols, sheetColumns(await fetchDdbSheet(cols.ddb_id)));
    }

    const writes: D1PreparedStatement[] = [];
    const update = updateStatement(c.env.DB, row.id, cols);
    if (update) writes.push(update);
    if (body.ownerId !== undefined && body.ownerId !== row.owner_id) {
      if (role !== 'dm') throw new HttpError(403, 'Only the DM can hand a character to someone else');
      if (body.ownerId) await assertPlayer(c.env.DB, row.campaign_id, body.ownerId);
      writes.push(
        c.env.DB.prepare('UPDATE characters SET owner_id = ? WHERE id = ?').bind(body.ownerId, row.id),
        // Whoever played it gives it up with it.
        c.env.DB.prepare('UPDATE campaign_members SET character_id = NULL WHERE campaign_id = ? AND character_id = ?').bind(row.campaign_id, row.id),
      );
    }
    if (writes.length) {
      try {
        await c.env.DB.batch(writes);
      } catch (err) {
        if (isUniqueViolation(err)) throw new HttpError(409, 'That sheet is already in this campaign');
        throw err;
      }
    }
    return c.json({ character: toDto(await loadCharacter(c.env.DB, row.id)) });
  })

  .delete('/characters/:characterId', async (c) => {
    const row = await loadCharacter(c.env.DB, c.req.param('characterId'));
    await requireEditor(c, row);
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE campaign_members SET character_id = NULL WHERE campaign_id = ? AND character_id = ?').bind(row.campaign_id, row.id),
      c.env.DB.prepare('DELETE FROM characters WHERE id = ?').bind(row.id),
    ]);
    return c.json({ ok: true });
  })

  /** Copies the linked sheet again: after a level-up, a new portrait, a new race. */
  .post('/characters/:characterId/sync', async (c) => {
    const row = await loadCharacter(c.env.DB, c.req.param('characterId'));
    await requireEditor(c, row);
    if (!row.ddb_id) throw new HttpError(400, 'Link a D&D Beyond sheet first');
    await updateStatement(c.env.DB, row.id, sheetColumns(await fetchDdbSheet(row.ddb_id)))!.run();
    return c.json({ character: toDto(await loadCharacter(c.env.DB, row.id)) });
  })

  /** The DM refreshes every linked sheet at once; one that fails doesn't stop the rest. */
  .post('/campaigns/:id/characters/sync', async (c) => {
    const campaignId = c.req.param('id');
    await requireCampaignDm(c, campaignId);
    const { results: linked } = await c.env.DB.prepare('SELECT id, name, ddb_id FROM characters WHERE campaign_id = ? AND ddb_id IS NOT NULL')
      .bind(campaignId)
      .all<{ id: string; name: string; ddb_id: string }>();
    const fetched = await Promise.allSettled(linked.map((r) => fetchDdbSheet(r.ddb_id)));
    const writes: D1PreparedStatement[] = [];
    const failures: { id: string; name: string; error: string }[] = [];
    fetched.forEach((result, i) => {
      if (result.status === 'fulfilled') writes.push(updateStatement(c.env.DB, linked[i].id, sheetColumns(result.value))!);
      else failures.push({ id: linked[i].id, name: linked[i].name, error: result.reason instanceof Error ? result.reason.message : 'Sync failed' });
    });
    if (writes.length) await c.env.DB.batch(writes);
    const { results } = await c.env.DB.prepare(`${SELECT} WHERE c.campaign_id = ? ORDER BY c.name COLLATE NOCASE`).bind(campaignId).all<CharacterRow>();
    return c.json({ characters: results.map(toDto), synced: writes.length, failures });
  })

  /** A player chooses which of their characters they play, or claims one the DM left unclaimed. */
  .post('/campaigns/:id/character', async (c) => {
    const campaignId = c.req.param('id');
    const { user, role } = await requireMember(c, campaignId);
    if (role === 'dm') throw new HttpError(400, 'The DM runs the table rather than playing a character');
    const { characterId } = await c.req.json<{ characterId: string | null }>();
    if (characterId) {
      const row = await characterInCampaign(c.env.DB, campaignId, characterId);
      if (row.owner_id && row.owner_id !== user.id) throw new HttpError(403, `${row.name} belongs to another player`);
    }
    await c.env.DB.batch(seatStatements(c.env.DB, campaignId, user.id, characterId ?? null));
    return c.json({ ok: true });
  });
