/* eslint-disable @typescript-eslint/no-explicit-any -- a test double for D1's untyped rows. */
// Enough of D1 for the content store's tests, over Node's built-in SQLite, with the
// content tables made by the real migrations.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { DatabaseSync as Sync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

// Vite 5 doesn't know node:sqlite is built in, so it's loaded past the bundler.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: typeof Sync };

const MIGRATIONS = ['0003_content.sql', '0004_content_overrides.sql', '0006_game_data.sql'];

export function memoryD1(): D1Database & { sql: Sync } {
  const sql = new DatabaseSync(':memory:');
  const dir = fileURLToPath(new URL('../../../migrations/', import.meta.url));
  for (const file of MIGRATIONS) sql.exec(fs.readFileSync(path.join(dir, file), 'utf8'));

  const statement = (query: string, params: unknown[] = []): any => ({
    bind: (...values: unknown[]) => statement(query, values),
    first: async (column?: string) => {
      const row: any = sql.prepare(query).get(...(params as any[]));
      if (!row) return null;
      return column ? row[column] : { ...row };
    },
    all: async () => ({ results: sql.prepare(query).all(...(params as any[])).map((r: any) => ({ ...r })), success: true, meta: {} }),
    run: async () => ({ success: true, meta: { changes: Number(sql.prepare(query).run(...(params as any[])).changes) } }),
    runNow: () => sql.prepare(query).run(...(params as any[])),
  });

  return {
    sql,
    prepare: (query: string) => statement(query),
    batch: async (statements: any[]) => {
      sql.exec('BEGIN');
      try {
        const out = statements.map((s) => s.runNow());
        sql.exec('COMMIT');
        return out;
      } catch (err) {
        sql.exec('ROLLBACK');
        throw err;
      }
    },
  } as any;
}

/** Adds a table to the content store, as an import would. */
export function addTable(db: ReturnType<typeof memoryD1>, key: string, databaseId: string, schema: Record<string, any>, owned: boolean) {
  for (const [name, def] of Object.entries(schema)) def.name ??= name;
  db.sql.prepare('INSERT INTO content_tables (key, notion_database_id, name, schema, owned) VALUES (?, ?, ?, ?, ?)').run(key, databaseId, key, JSON.stringify(schema), owned ? 1 : 0);
}

/** Adds an imported row with the given properties in the stored shape. */
export function addRow(db: ReturnType<typeof memoryD1>, key: string, id: string, properties: Record<string, any>) {
  const page = { object: 'page', id, url: `https://www.notion.so/${id.replace(/-/g, '')}`, properties };
  db.sql.prepare('INSERT INTO content_rows (id, table_key, title, page, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 0)').run(id, key, '', JSON.stringify(page), '[]');
}

/** A row's stored page, overrides not applied. */
export function storedPage(db: ReturnType<typeof memoryD1>, id: string): any {
  const row: any = db.sql.prepare('SELECT page FROM content_rows WHERE id = ?').get(id);
  return row ? JSON.parse(row.page) : null;
}
