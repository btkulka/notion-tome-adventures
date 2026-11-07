/* eslint-disable @typescript-eslint/no-explicit-any -- Notion page objects are untyped JSON, as in worker/notion. */
// DM-only browsing and editing of the reference content imported from Notion
// (migrations/0003_content.sql, filled by scripts/notion-import). Edits are
// overrides (worker/content/overrides.ts); the imported values are kept.
import { Hono, type Context } from 'hono';
import { currentDm, HttpError } from '../access';
import { applyOverrides, OverrideError, propertyFor, toProperty } from '../content/overrides';
import { syncRelations } from '../content/relations';
import { cellOf, cellsOf, columnsOf, imagesOf, relationIds, undashed, type PageRef } from '../content/values';
import type { AppEnv } from '../types';

/** Long text in a table listing is cut to this; the entry itself has it whole. */
const LISTING_TEXT = 280;

/** Select and multi-select values sent with each entry in the index, for its icon. */
const MAX_LABELS = 6;

interface TableRow {
  key: string;
  notion_database_id: string;
  name: string;
  schema: string;
  imported_at: number;
}

async function tablesByDatabase(db: D1Database): Promise<Map<string, string>> {
  const { results } = await db.prepare('SELECT key, notion_database_id FROM content_tables').all<{ key: string; notion_database_id: string }>();
  return new Map(results.map((t) => [undashed(t.notion_database_id), t.key]));
}

/** Titles and tables of the rows these ids point at, in one query. Ids that weren't imported are left out. */
async function lookUp(db: D1Database, ids: Iterable<string>): Promise<Map<string, Omit<PageRef, 'id'>>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const { results } = await db
    .prepare(
      `SELECT r.id, coalesce(json_extract(o.value, '$.title[0].plain_text'), r.title) AS title, r.table_key
         FROM content_rows r LEFT JOIN content_overrides o ON o.row_id = r.id AND json_extract(o.value, '$.type') = 'title'
        WHERE r.id IN (SELECT value FROM json_each(?))`
    )
    .bind(JSON.stringify(unique))
    .all<{ id: string; title: string; table_key: string }>();
  return new Map(results.map((r) => [r.id, { title: r.title, table: r.table_key }]));
}

/** The first image file in a page's content, found by SQLite so listings needn't load whole bodies. */
const BODY_FILE = "(SELECT j.value FROM json_tree(r.body) j WHERE j.key = 'tome_file' LIMIT 1) AS body_file";
const bodyImage = (file: string | null) => (file ? [{ type: 'image', image: { type: 'file', tome_file: file } }] : []);

const titleOf = (page: any): string => {
  const prop = Object.values<any>(page.properties ?? {}).find((p) => p?.type === 'title');
  return (prop?.title ?? []).map((t: any) => t.plain_text ?? '').join('');
};

function dashedId(raw: string): string {
  const hex = undashed(raw);
  return hex.length === 32 ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` : raw;
}

interface EntryRow {
  id: string;
  title: string;
  page: string;
  body: string;
  created_at: number;
  updated_at: number;
  key: string;
  name: string;
  schema: string;
}

async function loadEntry(db: D1Database, rawId: string): Promise<EntryRow> {
  const row = await db
    .prepare(
      `SELECT r.id, r.title, r.page, r.body, r.created_at, r.updated_at, t.key, t.name, t.schema
         FROM content_rows r JOIN content_tables t ON t.key = r.table_key WHERE r.id = ?`
    )
    .bind(dashedId(rawId))
    .first<EntryRow>();
  if (!row) throw new HttpError(404, 'That entry was not imported from Notion');
  return row;
}

/**
 * When a two-way relation's shown value changes from what the row shows now (its
 * override, or the imported value) to `next`, the rows at the other end follow
 * (worker/content/relations.ts).
 */
async function syncShown(db: D1Database, row: EntryRow, name: string, next: any): Promise<D1PreparedStatement[]> {
  if (next?.type !== 'relation') return [];
  const shown = JSON.parse(row.page);
  await applyOverrides(db, [shown]);
  return syncRelations(db, row.id, JSON.parse(row.schema), { [name]: shown.properties[name] }, { [name]: next });
}

/** One entry in full, with the DM's overrides applied and the imported values beside them. */
async function entryJson(c: Context<AppEnv>, row: EntryRow) {
  const db = c.env.DB;
  const page = JSON.parse(row.page);
  const body = JSON.parse(row.body);
  const replaced = (await applyOverrides(db, [page])).get(page.id) ?? [];
  const columns = columnsOf(JSON.parse(row.schema), await tablesByDatabase(db));
  const originals = replaced.map((r) => r.original);
  const refs = await lookUp(db, [...relationIds(page), ...relationIds({ properties: Object.fromEntries(replaced.map((r) => [r.name, r.original])) })]);

  const editors = [...new Set(replaced.map((r) => r.override.updated_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (editors.length) {
    const { results } = await db
      .prepare('SELECT id, coalesce(display_name, username) AS name FROM users WHERE id IN (SELECT value FROM json_each(?))')
      .bind(JSON.stringify(editors))
      .all<{ id: string; name: string }>();
    for (const u of results) names.set(u.id, u.name);
  }

  return {
    entry: {
      id: row.id,
      title: titleOf(page) || row.title,
      table: { key: row.key, name: row.name },
      columns,
      cells: cellsOf(page, columns, refs),
      overrides: Object.fromEntries(
        replaced.map((r, i) => [
          r.name,
          { original: cellOf(originals[i], refs), updatedAt: r.override.updated_at, by: r.override.updated_by ? names.get(r.override.updated_by) ?? null : null },
        ])
      ),
      images: imagesOf(page, body),
      body,
      notionUrl: page.url ?? null,
      createdAt: row.created_at,
      editedAt: row.updated_at,
    },
  };
}

export const contentRoutes = new Hono<AppEnv>()
  /** Every imported table with its row count, in import order. */
  .get('/content/tables', async (c) => {
    currentDm(c);
    const { results } = await c.env.DB.prepare(
      `SELECT t.key, t.notion_database_id, t.name, t.imported_at, (SELECT COUNT(*) FROM content_rows r WHERE r.table_key = t.key) AS rows
         FROM content_tables t ORDER BY t.rowid`
    ).all<{ key: string; notion_database_id: string; name: string; imported_at: number; rows: number }>();
    return c.json({
      tables: results.map((t) => ({ key: t.key, notionId: t.notion_database_id, name: t.name, rows: t.rows, importedAt: t.imported_at })),
    });
  })

  /** One table: its columns and every row's values (overrides applied), relations named. */
  .get('/content/tables/:key', async (c) => {
    currentDm(c);
    const table = await c.env.DB.prepare('SELECT key, notion_database_id, name, schema, imported_at FROM content_tables WHERE key = ?')
      .bind(c.req.param('key'))
      .first<TableRow>();
    if (!table) throw new HttpError(404, `No imported table called ${c.req.param('key')}`);

    const columns = columnsOf(JSON.parse(table.schema), await tablesByDatabase(c.env.DB));
    const { results } = await c.env.DB.prepare(`SELECT r.id, r.page, r.updated_at, ${BODY_FILE} FROM content_rows r WHERE r.table_key = ? ORDER BY r.rowid`)
      .bind(table.key)
      .all<{ id: string; page: string; updated_at: number; body_file: string | null }>();
    const rows = results.map((r) => ({ ...r, page: JSON.parse(r.page) }));
    const replaced = await applyOverrides(c.env.DB, rows.map((r) => r.page));
    const refs = await lookUp(c.env.DB, rows.flatMap((r) => relationIds(r.page)));

    return c.json({
      table: { key: table.key, name: table.name, importedAt: table.imported_at, columns },
      rows: rows.map((r) => ({
        id: r.id,
        title: titleOf(r.page),
        editedAt: r.updated_at,
        cells: cellsOf(r.page, columns, refs, LISTING_TEXT),
        images: imagesOf(r.page, bodyImage(r.body_file)),
        overridden: (replaced.get(r.id) ?? []).map((x) => x.name),
      })),
    });
  })

  /** Every imported row by title, with a picture and a few labels, for searching across tables. */
  .get('/content/entries', async (c) => {
    currentDm(c);
    const { results } = await c.env.DB.prepare(
      `SELECT r.id, r.table_key, coalesce(json_extract(o.value, '$.title[0].plain_text'), r.title) AS title,
              json_extract(r.page, '$.icon') AS icon, json_extract(r.page, '$.cover') AS cover,
              (SELECT json_group_object(p.key, json(p.value)) FROM json_each(r.page, '$.properties') p
                WHERE json_extract(p.value, '$.type') IN ('url', 'files', 'select', 'multi_select')) AS props,
              ${BODY_FILE}
         FROM content_rows r LEFT JOIN content_overrides o ON o.row_id = r.id AND json_extract(o.value, '$.type') = 'title'
        WHERE coalesce(json_extract(o.value, '$.title[0].plain_text'), r.title) <> ''
        ORDER BY 3 COLLATE NOCASE`
    ).all<{ id: string; table_key: string; title: string; icon: string | null; cover: string | null; props: string | null; body_file: string | null }>();

    const none = new Map<string, Omit<PageRef, 'id'>>();
    return c.json({
      entries: results.map((r) => {
        const properties = JSON.parse(r.props ?? '{}');
        const page = { icon: r.icon ? JSON.parse(r.icon) : null, cover: r.cover ? JSON.parse(r.cover) : null, properties };
        const labels = Object.values<any>(properties)
          .filter((p) => p.type === 'select' || p.type === 'multi_select')
          .flatMap((p) => [cellOf(p, none)].flat())
          .filter((v): v is string => typeof v === 'string')
          .slice(0, MAX_LABELS);
        return { id: r.id, title: r.title, table: r.table_key, thumb: imagesOf(page, bodyImage(r.body_file)).thumb, labels };
      }),
    });
  })

  /** One row in full: every property (with any override's original) and the page content as Notion blocks. */
  .get('/content/entries/:id', async (c) => {
    currentDm(c);
    return c.json(await entryJson(c, await loadEntry(c.env.DB, c.req.param('id'))));
  })

  /** Overrides one property. Setting it back to the imported value removes the override. */
  .put('/content/entries/:id/overrides', async (c) => {
    const user = currentDm(c);
    const row = await loadEntry(c.env.DB, c.req.param('id'));
    const body = await c.req.json<{ property?: string; value?: unknown }>().catch(() => ({}) as { property?: string; value?: unknown });
    const page = JSON.parse(row.page);
    const name = body.property ?? '';
    const current = page.properties?.[name];
    if (!current) throw new HttpError(400, `${row.name} has no property called ${name}`);

    let value: any;
    try {
      value = toProperty(JSON.parse(row.schema)[name], current, body.value ?? null);
    } catch (err) {
      if (err instanceof OverrideError) throw new HttpError(400, err.message);
      throw err;
    }

    const none = new Map<string, Omit<PageRef, 'id'>>();
    const same = JSON.stringify(cellOf(value, none)) === JSON.stringify(cellOf(current, none));
    const write = same
      ? c.env.DB.prepare('DELETE FROM content_overrides WHERE row_id = ? AND (property_id = ? OR property = ?)').bind(row.id, current.id, name)
      : c.env.DB.prepare(
          `INSERT INTO content_overrides (row_id, property_id, property, value, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, unixepoch())
             ON CONFLICT (row_id, property_id) DO UPDATE SET property = excluded.property, value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`
        ).bind(row.id, current.id ?? name, name, JSON.stringify(value), user.id);
    await c.env.DB.batch([write, ...(await syncShown(c.env.DB, row, name, same ? current : value))]);
    return c.json(await entryJson(c, row));
  })

  /** Back to the imported value. */
  .delete('/content/entries/:id/overrides', async (c) => {
    currentDm(c);
    const row = await loadEntry(c.env.DB, c.req.param('id'));
    const name = c.req.query('property') ?? '';
    const page = JSON.parse(row.page);
    const id = page.properties?.[name]?.id ?? null;
    const { results } = await c.env.DB.prepare('SELECT property_id, property FROM content_overrides WHERE row_id = ?').bind(row.id).all<{ property_id: string; property: string }>();
    const match = results.find((o) => propertyFor(page, o) === name || o.property_id === id);
    if (match) {
      const synced = page.properties?.[name] ? await syncShown(c.env.DB, row, name, page.properties[name]) : [];
      await c.env.DB.batch([c.env.DB.prepare('DELETE FROM content_overrides WHERE row_id = ? AND property_id = ?').bind(row.id, match.property_id), ...synced]);
    }
    return c.json(await entryJson(c, row));
  });
