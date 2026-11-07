/* eslint-disable @typescript-eslint/no-explicit-any -- Notion payloads are untyped JSON. */
import { beforeEach, describe, expect, it } from 'vitest';
import { ContentClient } from '../client';
import { applyOverrides } from '../overrides';
import { syncRelations } from '../relations';
import { addRow, addTable, memoryD1, storedPage } from './memory-d1';

const CAMPAIGNS = 'c0000000-0000-4000-8000-000000000000';
const SESSIONS = 's0000000-0000-4000-8000-000000000000';
const PLAYERS = 'p0000000-0000-4000-8000-000000000000';
const NPCS = 'n0000000-0000-4000-8000-000000000000';

const C1 = 'c1000000-0000-4000-8000-000000000001';
const C2 = 'c2000000-0000-4000-8000-000000000002';
const P1 = 'a1000000-0000-4000-8000-000000000001';
/** A row Notion had but the import didn't. */
const GONE = 'f9000000-0000-4000-8000-000000000009';

const dual = (database_id: string, synced_property_name: string, synced_property_id: string) => ({
  type: 'relation',
  relation: { database_id, type: 'dual_property', dual_property: { synced_property_name, synced_property_id } },
});
const rel = (...ids: string[]) => ({ type: 'relation', relation: ids.map((i) => ({ id: i })), has_more: false });
const title = (text: string) => ({ id: 'title', type: 'title', title: [{ type: 'text', text: { content: text }, plain_text: text }] });
const linked = (page: any, name: string) => (page.properties[name]?.relation ?? []).map((r: any) => r.id);

let db: ReturnType<typeof memoryD1>;
let client: ContentClient;

beforeEach(() => {
  db = memoryD1();
  addTable(db, 'campaigns', CAMPAIGNS, { Campaign: { id: 'title', type: 'title', title: {} }, Sessions: { id: 'sess', ...dual(SESSIONS, 'Campaign', 'camp') } }, true);
  addTable(
    db,
    'sessions',
    SESSIONS,
    {
      Session: { id: 'title', type: 'title', title: {} },
      Campaign: { id: 'camp', ...dual(CAMPAIGNS, 'Sessions', 'sess') },
      Players: { id: 'plyr', ...dual(PLAYERS, 'Sessions', 'psess') },
      Notes: { id: 'note', type: 'relation', relation: { database_id: CAMPAIGNS, type: 'single_property', single_property: {} } },
    },
    true
  );
  // A reference table: its side of a link is kept as an override.
  addTable(db, 'players', PLAYERS, { Name: { id: 'title', type: 'title', title: {} }, Sessions: { id: 'psess', ...dual(SESSIONS, 'Players', 'plyr') } }, false);
  addTable(
    db,
    'npcs',
    NPCS,
    {
      Name: { id: 'title', type: 'title', title: {} },
      Allies: { id: 'ally', ...dual(NPCS, 'Allied With', 'alw') },
      'Allied With': { id: 'alw', ...dual(NPCS, 'Allies', 'ally') },
    },
    true
  );
  addRow(db, 'campaigns', C1, { Campaign: title('Vecna'), Sessions: { id: 'sess', ...rel() } });
  addRow(db, 'campaigns', C2, { Campaign: title('Saltmarsh'), Sessions: { id: 'sess', ...rel() } });
  addRow(db, 'players', P1, { Name: title('Ana'), Sessions: { id: 'psess', ...rel() } });
  client = new ContentClient(db);
});

const newSession = (properties: any = {}) =>
  client.pages.create({ parent: { database_id: 'sessions' }, properties: { Session: { title: [{ text: { content: 'One' } }] }, ...properties } });

describe('two-way relations', () => {
  it('a new row appears on the rows it links to', async () => {
    const s = await newSession({ Campaign: { relation: [{ id: C1 }] } });
    expect(linked(storedPage(db, C1), 'Sessions')).toEqual([s.id]);
    expect(linked(storedPage(db, C2), 'Sessions')).toEqual([]);
  });

  it('moving a link takes the row off the old target and puts it on the new one', async () => {
    const s = await newSession({ Campaign: { relation: [{ id: C1 }] } });
    await client.pages.update({ page_id: s.id, properties: { Campaign: { relation: [{ id: C2 }] } } });
    expect(linked(storedPage(db, C1), 'Sessions')).toEqual([]);
    expect(linked(storedPage(db, C2), 'Sessions')).toEqual([s.id]);
  });

  it('keeps links the target already had', async () => {
    const a = await newSession({ Campaign: { relation: [{ id: C1 }] } });
    const b = await newSession({ Campaign: { relation: [{ id: C1 }] } });
    expect(linked(storedPage(db, C1), 'Sessions')).toEqual([a.id, b.id]);
  });

  it('writes the other end in a reference table as an override, leaving the import alone', async () => {
    const s = await newSession({ Players: { relation: [{ id: P1 }] } });
    expect(linked(storedPage(db, P1), 'Sessions')).toEqual([]);
    const shown = storedPage(db, P1);
    await applyOverrides(db, [shown]);
    expect(linked(shown, 'Sessions')).toEqual([s.id]);

    await client.pages.update({ page_id: s.id, properties: { Players: { relation: [] } } });
    const after = storedPage(db, P1);
    await applyOverrides(db, [after]);
    expect(linked(after, 'Sessions')).toEqual([]);
  });

  it('updates an override on the other end, since that is what shows', async () => {
    db.sql
      .prepare("INSERT INTO content_overrides (row_id, property_id, property, value) VALUES (?, 'sess', 'Sessions', ?)")
      .run(C2, JSON.stringify(rel(GONE)));
    const s = await newSession({ Campaign: { relation: [{ id: C2 }] } });
    const shown = storedPage(db, C2);
    await applyOverrides(db, [shown]);
    expect(linked(shown, 'Sessions')).toEqual([GONE, s.id]);
    expect(linked(storedPage(db, C2), 'Sessions')).toEqual([s.id]);
  });

  it('handles a table related to itself, including a row linked to itself', async () => {
    const a = await client.pages.create({ parent: { database_id: 'npcs' }, properties: { Name: { title: [{ text: { content: 'A' } }] } } });
    const b = await client.pages.create({ parent: { database_id: 'npcs' }, properties: { Name: { title: [{ text: { content: 'B' } }] }, Allies: { relation: [{ id: a.id }] } } });
    expect(linked(storedPage(db, a.id), 'Allied With')).toEqual([b.id]);
    expect(linked(storedPage(db, b.id), 'Allies')).toEqual([a.id]);

    await client.pages.update({ page_id: a.id, properties: { Allies: { relation: [{ id: a.id }] } } });
    const self = storedPage(db, a.id);
    expect(linked(self, 'Allies')).toEqual([a.id]);
    expect(linked(self, 'Allied With')).toEqual([b.id, a.id]);
  });

  it('leaves one-way relations and rows that were never imported alone', async () => {
    const s = await newSession({ Notes: { relation: [{ id: C1 }] }, Campaign: { relation: [{ id: GONE }] } });
    expect(linked(storedPage(db, C1), 'Sessions')).toEqual([]);
    expect(linked(storedPage(db, s.id), 'Campaign')).toEqual([GONE]);
  });

  it('reads the changes from what was shown before, for the browser\'s overrides', async () => {
    const s = await newSession({ Campaign: { relation: [{ id: C1 }] } });
    const schema = JSON.parse((db.sql.prepare("SELECT schema FROM content_tables WHERE key = 'sessions'").get() as any).schema);
    const statements = await syncRelations(db, s.id, schema, { Campaign: rel(C1) }, { Campaign: rel(C1, C2) });
    await db.batch(statements);
    expect(linked(storedPage(db, C1), 'Sessions')).toEqual([s.id]);
    expect(linked(storedPage(db, C2), 'Sessions')).toEqual([s.id]);
  });
});
