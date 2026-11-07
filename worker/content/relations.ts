/* eslint-disable @typescript-eslint/no-explicit-any -- Notion payloads are untyped JSON, as in worker/notion/client.ts. */
// Two-way relations. A relation column whose schema has `dual_property` is one end
// of a pair, and Notion kept the other end (a column in the target table) in step:
// link a session to a campaign and the campaign lists the session. D1 has to do
// that itself, so every write of such a column (worker/content/client.ts, and DM
// overrides in worker/api/content.ts) adds this row to the rows it now links and
// takes it off the ones it no longer does. In an owned table the other end is
// written in place; in a reference table, as an override, which survives a
// re-import. Rows that were never imported are skipped.

interface Change {
  /** The other end's column, by property id and by name. */
  propertyId?: string;
  propertyName?: string;
  add: boolean;
}

interface Target {
  id: string;
  page: string;
  owned: number;
  schema: string;
}

interface OverrideRow {
  row_id: string;
  property_id: string;
  property: string;
  value: string;
}

const idsOf = (prop: any): string[] => (prop?.type === 'relation' ? (prop.relation ?? []).map((r: any) => r.id) : []);

function adjust(prop: any, rowId: string, add: boolean) {
  const list: any[] = prop.relation ?? [];
  const has = list.some((r) => r.id === rowId);
  if (add && !has) prop.relation = [...list, { id: rowId }];
  if (!add && has) prop.relation = list.filter((r) => r.id !== rowId);
  prop.has_more = false;
}

/** The other end's column in the target table's schema: [name, definition]. */
function column(schema: Record<string, any>, change: Change): [string, any] | null {
  return (
    Object.entries<any>(schema).find(([, d]) => change.propertyId && d.id === change.propertyId) ??
    Object.entries<any>(schema).find(([n]) => n === change.propertyName) ??
    null
  );
}

/**
 * Statements that bring the other ends of `rowId`'s two-way relations in line with
 * a write. `before` and `after` are the written columns' values (stored shape) by
 * name; `before` lacks a column the row didn't have. `self` is the row's own page
 * when it is being written in the same batch, for relations from a table to itself.
 */
export async function syncRelations(
  db: D1Database,
  rowId: string,
  schema: Record<string, any>,
  before: Record<string, any>,
  after: Record<string, any>,
  self?: any
): Promise<D1PreparedStatement[]> {
  const changes = new Map<string, Change[]>();
  for (const [name, prop] of Object.entries(after)) {
    const dual = schema[name]?.relation?.dual_property;
    if (prop?.type !== 'relation' || schema[name]?.relation?.type !== 'dual_property' || !dual) continue;
    const old = new Set(idsOf(before[name]));
    const now = new Set(idsOf(prop));
    const note = (id: string, add: boolean) => {
      if (!changes.has(id)) changes.set(id, []);
      changes.get(id)!.push({ propertyId: dual.synced_property_id, propertyName: dual.synced_property_name, add });
    };
    for (const id of now) if (!old.has(id)) note(id, true);
    for (const id of old) if (!now.has(id)) note(id, false);
  }
  if (!changes.size) return [];

  const ids = JSON.stringify([...changes.keys()]);
  const { results: targets } = await db
    .prepare('SELECT r.id, r.page, t.owned, t.schema FROM content_rows r JOIN content_tables t ON t.key = r.table_key WHERE r.id IN (SELECT value FROM json_each(?))')
    .bind(ids)
    .all<Target>();
  const { results: overrides } = await db
    .prepare('SELECT row_id, property_id, property, value FROM content_overrides WHERE row_id IN (SELECT value FROM json_each(?))')
    .bind(ids)
    .all<OverrideRow>();

  const statements: D1PreparedStatement[] = [];
  const now = new Date().toISOString();

  // A table related to itself: the other end is on the page being written.
  if (self && changes.has(rowId) && !targets.some((t) => t.id === rowId)) {
    for (const change of changes.get(rowId)!) {
      const col = column(schema, change);
      if (!col) continue;
      self.properties[col[0]] ??= { id: col[1].id, type: 'relation', relation: [], has_more: false };
      adjust(self.properties[col[0]], rowId, change.add);
    }
  }

  for (const target of targets) {
    const targetSchema = JSON.parse(target.schema);
    const page = target.id === rowId && self ? self : JSON.parse(target.page);
    let pageChanged = false;
    for (const change of changes.get(target.id) ?? []) {
      const col = column(targetSchema, change);
      if (!col) continue;
      const [name, def] = col;
      const override = overrides.find((o) => o.row_id === target.id && (o.property_id === def.id || o.property === name));

      if (target.owned) {
        page.properties[name] ??= { id: def.id, type: 'relation', relation: [], has_more: false };
        adjust(page.properties[name], rowId, change.add);
        pageChanged = true;
      }
      // An override is what everyone sees, so it follows too; a reference row only ever changes through one.
      if (override || !target.owned) {
        const value = override ? JSON.parse(override.value) : structuredClone(page.properties[name] ?? { type: 'relation', relation: [] });
        adjust(value, rowId, change.add);
        delete value.id;
        statements.push(
          db
            .prepare(
              `INSERT INTO content_overrides (row_id, property_id, property, value, updated_by, updated_at) VALUES (?, ?, ?, ?, NULL, unixepoch())
                 ON CONFLICT (row_id, property_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
            )
            .bind(target.id, override?.property_id ?? def.id, name, JSON.stringify(value))
        );
        if (override) override.value = JSON.stringify(value);
        else overrides.push({ row_id: target.id, property_id: def.id, property: name, value: JSON.stringify(value) });
      }
    }
    if (pageChanged && page !== self) {
      page.last_edited_time = now;
      statements.push(db.prepare('UPDATE content_rows SET page = ?, updated_at = unixepoch() WHERE id = ?').bind(JSON.stringify(page), target.id));
    }
  }
  return statements;
}
