/* eslint-disable @typescript-eslint/no-explicit-any -- Notion payloads are untyped JSON, as in worker/notion/client.ts. */
// Reads the content imported from Notion (migrations/0003_content.sql) through
// the same methods as worker/notion/client.ts, so the handlers and extractors
// written against Notion work unchanged. Queries follow Notion's rules, including
// at most 100 results per call with a cursor for the rest. Tables the app owns
// (migrations/0006_game_data.sql: campaigns, sessions, encounters, locations) can
// also be written, with pages.create and pages.update, which keep two-way
// relations in step as Notion did (./relations.ts); reference tables can't, and
// the DM's edits to them are overrides instead.
import { NotionError } from '../notion/client';
import { compareBySorts, matchesFilter } from './filter';
import { applyOverrides } from './overrides';
import { syncRelations } from './relations';
import { dashed, emptyProperty, storedProperty, titleOf } from './write';

type Body = Record<string, any>;

const MAX_PAGE_SIZE = 100;
/** D1 allows 100 bound parameters per statement. */
const IDS_PER_QUERY = 90;

interface TableRow {
  key: string;
  notion_database_id: string;
  name: string;
  schema: string;
}

const readOnly = (name: string) =>
  new NotionError(`${name} is reference content imported from Notion; the DM edits it as overrides (worker/api/content.ts)`, 403, 'restricted_resource');

export class ContentClient {
  private cache = new Map<string, Promise<any | null>>();
  private queued: { id: string; resolve: (page: any | null) => void; reject: (err: unknown) => void }[] = [];

  constructor(private db: D1Database) {}

  /** A table by its key (`monsters`) or by the Notion database id it was imported from. */
  private async table(keyOrId: string): Promise<TableRow> {
    const row = await this.db
      .prepare('SELECT key, notion_database_id, name, schema FROM content_tables WHERE key = ? OR notion_database_id = ?')
      .bind(keyOrId, dashed(keyOrId))
      .first<TableRow>();
    if (!row) throw new NotionError(`No imported table ${keyOrId}; run the Notion import (scripts/notion-import)`, 404, 'object_not_found');
    return row;
  }

  /** Every page of a table that passes the filter, in Notion's order unless sorted. */
  private async matching({ database_id, filter, sorts }: Body): Promise<any[]> {
    const table = await this.table(database_id);
    const { results } = await this.db.prepare('SELECT page FROM content_rows WHERE table_key = ? ORDER BY rowid').bind(table.key).all<{ page: string }>();
    let pages = results.map((r) => JSON.parse(r.page));
    // The DM's overrides count as the value, for filters and sorts too.
    await applyOverrides(this.db, pages);
    if (filter) pages = pages.filter((p) => matchesFilter(p, filter));
    if (Array.isArray(sorts) && sorts.length) pages.sort(compareBySorts(sorts));
    for (const p of pages) this.cache.set(p.id, Promise.resolve(p));
    return pages;
  }

  databases = {
    query: async (params: Body) => {
      const pages = await this.matching(params);
      const start = params.start_cursor ? Number(params.start_cursor) : 0;
      const size = Math.min(Math.max(Number(params.page_size) || MAX_PAGE_SIZE, 1), MAX_PAGE_SIZE);
      const hasMore = start + size < pages.length;
      return {
        object: 'list',
        results: pages.slice(start, start + size),
        has_more: hasMore,
        next_cursor: hasMore ? String(start + size) : null,
        type: 'page_or_database',
        page_or_database: {},
      };
    },

    /** Like `query`, but every match in one response: D1 has no reason for Notion's 100-row pages. */
    queryAll: async (params: Body) => ({ object: 'list', results: await this.matching(params), has_more: false, next_cursor: null }),

    retrieve: async ({ database_id }: Body) => {
      const table = await this.table(database_id);
      return {
        object: 'database',
        id: table.notion_database_id,
        title: [{ type: 'text', text: { content: table.name, link: null }, plain_text: table.name, href: null }],
        properties: JSON.parse(table.schema),
      };
    },
  };

  pages = {
    retrieve: async ({ page_id }: Body) => {
      const page = await this.load(page_id);
      if (!page) throw new NotionError(`Could not find page with ID: ${page_id}.`, 404, 'object_not_found');
      return page;
    },

    /** Several pages in one round trip, skipping ids that aren't imported. */
    retrieveMany: async (ids: string[]) => (await Promise.all(ids.map((id) => this.load(id)))).filter(Boolean),

    /** A new row: `properties` as Notion takes them, every other column empty. Page content isn't written. */
    create: async ({ parent, properties = {}, children }: Body) => {
      if (children?.length) throw new NotionError('Page content (children) is not stored for new rows', 400, 'validation_error');
      const table = await this.writable(parent?.database_id);
      const schema = JSON.parse(table.schema);
      const written = this.convert(schema, properties);
      const now = new Date();
      const page: any = {
        object: 'page',
        id: crypto.randomUUID(),
        created_time: now.toISOString(),
        last_edited_time: now.toISOString(),
        cover: null,
        icon: null,
        parent: { type: 'database_id', database_id: table.notion_database_id },
        archived: false,
        in_trash: false,
        properties: {},
        // No Notion page stands behind a row made here.
        url: '',
        public_url: null,
      };
      for (const [name, def] of Object.entries<any>(schema)) {
        const value = written.properties[name] ?? emptyProperty(def);
        if (value) page.properties[name] = value;
      }
      // Before the row is written: a relation to its own table can land on the new page itself.
      const synced = await syncRelations(this.db, page.id, schema, {}, written.properties, page);
      const seconds = Math.floor(now.getTime() / 1000);
      await this.db.batch([
        this.db
          .prepare('INSERT INTO content_rows (id, table_key, title, page, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(page.id, table.key, titleOf(page), JSON.stringify(page), '[]', seconds, seconds),
        ...synced,
        ...this.saveSchema(table.key, schema, written.added),
      ]);
      if (synced.length) this.cache.clear();
      this.cache.set(page.id, Promise.resolve(page));
      return page;
    },

    /** Sets the given properties of a row; the rest stay. A write replaces any override of the same property. */
    update: async ({ page_id, properties = {} }: Body) => {
      const id = dashed(String(page_id ?? ''));
      const row = await this.db
        .prepare('SELECT r.page, t.key, t.name, t.schema, t.owned FROM content_rows r JOIN content_tables t ON t.key = r.table_key WHERE r.id = ?')
        .bind(id)
        .first<{ page: string; key: string; name: string; schema: string; owned: number }>();
      if (!row) throw new NotionError(`Could not find page with ID: ${page_id}.`, 404, 'object_not_found');
      if (!row.owned) throw readOnly(row.name);
      const schema = JSON.parse(row.schema);
      const written = this.convert(schema, properties);
      const page = JSON.parse(row.page);
      // What the row showed before, overrides and all, is what the other ends of its relations agree with.
      const shown = JSON.parse(row.page);
      await applyOverrides(this.db, [shown]);
      Object.assign(page.properties, written.properties);
      page.last_edited_time = new Date().toISOString();
      const synced = await syncRelations(this.db, id, schema, shown.properties, written.properties, page);
      await this.db.batch([
        this.db.prepare('UPDATE content_rows SET page = ?, title = ?, updated_at = unixepoch() WHERE id = ?').bind(JSON.stringify(page), titleOf(page), id),
        this.db
          .prepare('DELETE FROM content_overrides WHERE row_id = ? AND property_id IN (SELECT value FROM json_each(?))')
          .bind(id, JSON.stringify(Object.values<any>(written.properties).map((p) => p.id))),
        ...synced,
        ...this.saveSchema(row.key, schema, written.added),
      ]);
      if (synced.length) this.cache.clear();
      this.cache.delete(id);
      return this.pages.retrieve({ page_id: id });
    },
  };

  /** A table the app owns, for writing. The flag is read apart from `table` so reads work before 0006 is applied. */
  private async writable(keyOrId: unknown): Promise<TableRow> {
    const table = await this.table(String(keyOrId ?? ''));
    const flag = await this.db.prepare('SELECT owned FROM content_tables WHERE key = ?').bind(table.key).first<{ owned: number }>();
    if (!flag?.owned) throw readOnly(table.name);
    return table;
  }

  /** Written properties in the stored shape, by column name, checked against the schema. */
  private convert(schema: Record<string, any>, properties: Body): { properties: Record<string, any>; added: boolean } {
    const out: Record<string, any> = {};
    let added = false;
    for (const [name, value] of Object.entries(properties)) {
      // Notion takes a column by name or by property id.
      const entry = Object.entries<any>(schema).find(([n, d]) => n === name || d.id === name);
      if (!entry) throw new NotionError(`${name} is not a property that exists.`, 400, 'validation_error');
      // A shallow copy for the name in messages; new select options still land in the schema.
      const result = storedProperty({ ...entry[1], name: entry[0] }, value);
      out[entry[0]] = result.property;
      added ||= result.added;
    }
    return { properties: out, added };
  }

  /** Keeps select options a write added, as Notion does. */
  private saveSchema(key: string, schema: Record<string, any>, added: boolean): D1PreparedStatement[] {
    return added ? [this.db.prepare('UPDATE content_tables SET schema = ? WHERE key = ?').bind(JSON.stringify(schema), key)] : [];
  }

  /** Lookups made close together share one query; each page is read at most once per client. */
  private load(id: string): Promise<any | null> {
    const key = dashed(id);
    let page = this.cache.get(key);
    if (!page) {
      page = new Promise((resolve, reject) => {
        if (this.queued.push({ id: key, resolve, reject }) === 1) setTimeout(() => this.flush(), 0);
      });
      this.cache.set(key, page);
    }
    return page;
  }

  private async flush() {
    const batch = this.queued.splice(0);
    try {
      const found = new Map<string, any>();
      for (let i = 0; i < batch.length; i += IDS_PER_QUERY) {
        const ids = batch.slice(i, i + IDS_PER_QUERY).map((b) => b.id);
        const { results } = await this.db
          .prepare(`SELECT page FROM content_rows WHERE id IN (${ids.map(() => '?').join(', ')})`)
          .bind(...ids)
          .all<{ page: string }>();
        for (const r of results) {
          const page = JSON.parse(r.page);
          found.set(page.id, page);
        }
      }
      await applyOverrides(this.db, [...found.values()]);
      for (const b of batch) b.resolve(found.get(b.id) ?? null);
    } catch (err) {
      for (const b of batch) {
        this.cache.delete(b.id);
        b.reject(err);
      }
    }
  }
}
