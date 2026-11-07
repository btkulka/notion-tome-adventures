import { describe, expect, it } from 'vitest';
import { emptyProperty, storedProperty, titleOf } from '../write';
import { extractLocation } from '../../notion/suite-extractors';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- schema columns are untyped JSON, as in the code under test.
const column = (name: string, type: string, extra: object = {}): any => ({ id: name.slice(0, 3).toLowerCase(), name, type, [type]: {}, ...extra });

describe('storedProperty', () => {
  it('turns written text into the stored rich-text shape the extractors read', () => {
    const { property } = storedProperty(column('Name', 'title'), { title: [{ text: { content: 'Alder Hollow' } }] });
    expect(property).toEqual({
      id: 'nam',
      type: 'title',
      title: [
        {
          type: 'text',
          text: { content: 'Alder Hollow', link: null },
          annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' },
          plain_text: 'Alder Hollow',
          href: null,
        },
      ],
    });
  });

  it('finds select options by name and adds new ones to the column, as Notion does', () => {
    const def = column('Type', 'select', { select: { options: [{ id: 'town', name: 'Town', color: 'blue' }] } });
    expect(storedProperty(def, { select: { name: 'Town' } })).toEqual({ property: { id: 'typ', type: 'select', select: { id: 'town', name: 'Town', color: 'blue' } }, added: false });
    const added = storedProperty(def, { select: { name: 'Ruin' } });
    expect(added.added).toBe(true);
    expect(def.select.options.map((o) => o.name)).toEqual(['Town', 'Ruin']);
    expect(storedProperty(def, { select: null }).property.select).toBeNull();
  });

  it('refuses status names the column lacks, since Notion won\'t add them', () => {
    const def = column('Stage', 'status', { status: { options: [{ id: 'a', name: 'Done', color: 'green' }] } });
    expect(() => storedProperty(def, { status: { name: 'Nope' } })).toThrow(/no status named Nope/);
  });

  it('dashes relation ids and marks the list complete', () => {
    const { property } = storedProperty(column('Campaign', 'relation'), { relation: [{ id: 'ff39fc2f2de74572b14d921cc9e71bc3' }] });
    expect(property).toEqual({ id: 'cam', type: 'relation', relation: [{ id: 'ff39fc2f-2de7-4572-b14d-921cc9e71bc3' }], has_more: false });
  });

  it('checks values against the column type', () => {
    expect(() => storedProperty(column('XP', 'number'), { number: 'lots' })).toThrow(/should be a number/);
    expect(() => storedProperty(column('XP', 'number'), { rich_text: [] })).toThrow(/expected to be number/);
    expect(() => storedProperty(column('Total', 'formula'), { formula: {} })).toThrow(/can't be written/);
    expect(() => storedProperty(column('When', 'date'), { date: { start: 'someday' } })).toThrow(/start date/);
    expect(() => storedProperty(column('Notes', 'rich_text'), { rich_text: [{ text: { content: 'x'.repeat(2001) } }] })).toThrow(/2000/);
  });

  it('keeps linked files and leaves Notion-hosted ones as they were read', () => {
    const hosted = { name: 'a.png', type: 'file', file: { url: 'https://s3/a' }, tome_file: 'p/a.png' };
    const { property } = storedProperty(column('Image', 'files'), { files: [{ name: 'map', external: { url: 'https://x/m.png' } }, hosted] });
    expect(property.files).toEqual([{ name: 'map', type: 'external', external: { url: 'https://x/m.png' } }, hosted]);
  });
});

describe('a row written this way', () => {
  it('reads back through the location extractor', () => {
    const name = storedProperty(column('Name', 'title'), { title: [{ text: { content: 'Test Keep' } }] }).property;
    const notes = storedProperty(column('DM Notes', 'rich_text'), { rich_text: [{ text: { content: 'a'.repeat(2000) } }, { text: { content: 'b' } }] }).property;
    const page = { id: 'p', url: '', properties: { Name: name, 'DM Notes': notes, 'Map ID': emptyProperty(column('Map ID', 'rich_text')) } };
    expect(extractLocation(page)).toMatchObject({ name: 'Test Keep', dmNotes: `${'a'.repeat(2000)}b`, mapId: '', url: '' });
    expect(titleOf(page)).toBe('Test Keep');
  });

  it('leaves computed columns out when empty', () => {
    expect(emptyProperty(column('Total', 'rollup'))).toBeUndefined();
    expect(emptyProperty(column('Links', 'relation'))).toEqual({ id: 'lin', type: 'relation', relation: [], has_more: false });
  });
});
