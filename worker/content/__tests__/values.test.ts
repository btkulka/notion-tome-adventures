import { describe, expect, it } from 'vitest';
import { cellOf, cellsOf, columnsOf, relationIds } from '../values';

const rich = (text: string) => [{ type: 'text', text: { content: text, link: null }, plain_text: text, href: null }];

const CR_ID = '7aaffcbc-b470-45f7-9257-0857aab93bb2';
const HALF = 'aaaaaaaa-0000-0000-0000-000000000001';
const MISSING = 'aaaaaaaa-0000-0000-0000-000000000002';
const refs = new Map([[HALF, { title: '1/2', table: 'challenge_ratings' }]]);

const goblin = {
  id: 'g',
  properties: {
    'Monster Name': { id: 'title', type: 'title', title: rich('Goblin') },
    'Challenge Rating': { id: 'cr', type: 'relation', relation: [{ id: HALF }, { id: MISSING }], has_more: false },
    Size: { id: 'sz', type: 'select', select: { name: 'Small', color: 'green' } },
    Tags: { id: 'tg', type: 'multi_select', multi_select: [{ name: 'Humanoid' }, { name: 'Goblinoid' }] },
    AC: { id: 'ac', type: 'number', number: 15 },
    Lore: { id: 'lo', type: 'rich_text', rich_text: rich('Small, black-hearted humanoids that lair in despoiled dungeons.') },
    XP: { id: 'xp', type: 'rollup', rollup: { type: 'array', function: 'show_original', array: [{ type: 'number', number: 100 }] } },
    Types: { id: 'ty', type: 'rollup', rollup: { type: 'array', function: 'show_original', array: [{ type: 'relation', relation: [{ id: HALF }] }] } },
    Value: { id: 'val', type: 'formula', formula: { type: 'number', number: 5 } },
    Seen: { id: 'se', type: 'formula', formula: { type: 'date', date: { start: '2026-01-01', end: '2026-01-03' } } },
    Art: { id: 'ar', type: 'files', files: [{ name: 'goblin.png', type: 'file', file: { url: 'https://s3/expired' } }, { name: 'ext', type: 'external', external: { url: 'https://x/y.png' } }] },
    Archived: { id: 'ab', type: 'checkbox', checkbox: false },
    Ref: { id: 'id', type: 'unique_id', unique_id: { prefix: 'MON', number: 7 } },
  },
};

describe('relationIds', () => {
  it('collects relation ids, including those inside relation rollups', () => {
    expect(relationIds(goblin)).toEqual([HALF, MISSING, HALF]);
  });
});

describe('cellOf', () => {
  it('names linked rows and leaves rows that were not imported untitled', () => {
    expect(cellOf(goblin.properties['Challenge Rating'], refs)).toEqual([
      { id: HALF, title: '1/2', table: 'challenge_ratings' },
      { id: MISSING, title: null, table: null },
    ]);
  });

  it('flattens selects, multi-selects, numbers, checkboxes and unique ids', () => {
    expect(cellOf(goblin.properties.Size, refs)).toBe('Small');
    expect(cellOf(goblin.properties.Tags, refs)).toEqual(['Humanoid', 'Goblinoid']);
    expect(cellOf(goblin.properties.AC, refs)).toBe(15);
    expect(cellOf(goblin.properties.Archived, refs)).toBe(false);
    expect(cellOf(goblin.properties.Ref, refs)).toBe('MON-7');
  });

  it('flattens rollup arrays and formula results', () => {
    expect(cellOf(goblin.properties.XP, refs)).toEqual([100]);
    expect(cellOf(goblin.properties.Types, refs)).toEqual([{ id: HALF, title: '1/2', table: 'challenge_ratings' }]);
    expect(cellOf(goblin.properties.Value, refs)).toBe(5);
    expect(cellOf(goblin.properties.Seen, refs)).toBe('2026-01-01 → 2026-01-03');
  });

  it('only gives files a url when Notion does not host them', () => {
    expect(cellOf(goblin.properties.Art, refs)).toEqual([
      { name: 'goblin.png', url: null },
      { name: 'ext', url: 'https://x/y.png' },
    ]);
  });

  it('cuts long text to the limit and treats empty text as no value', () => {
    expect(cellOf(goblin.properties.Lore, refs, 12)).toBe('Small, black…');
    expect(cellOf({ type: 'rich_text', rich_text: [] }, refs)).toBeNull();
    expect(cellOf(undefined, refs)).toBeNull();
  });
});

describe('columnsOf', () => {
  it('puts the title first, keeps select options and points relations at imported tables', () => {
    const columns = columnsOf(
      {
        Size: { type: 'select', select: { options: [{ name: 'Small', color: 'green' }] } },
        'Challenge Rating': { type: 'relation', relation: { database_id: CR_ID } },
        Campaign: { type: 'relation', relation: { database_id: '64f4ce8b-a6ce-4c93-a470-5b8f4eaa11c5' } },
        'Monster Name': { type: 'title', title: {} },
      },
      new Map([[CR_ID.replace(/-/g, ''), 'challenge_ratings']])
    );
    expect(columns.map((c) => c.name)).toEqual(['Monster Name', 'Size', 'Challenge Rating', 'Campaign']);
    expect(columns[1].options).toEqual([{ name: 'Small', color: 'green' }]);
    expect(columns[2].target).toBe('challenge_ratings');
    expect(columns[3].target).toBeNull();
    expect(cellsOf(goblin, columns, refs)).toMatchObject({ 'Monster Name': 'Goblin', Size: 'Small', Campaign: null });
  });
});
