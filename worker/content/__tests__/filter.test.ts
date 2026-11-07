import { describe, expect, it } from 'vitest';
import { compareBySorts, matchesFilter } from '../filter';

const rich = (text: string) => [{ type: 'text', text: { content: text, link: null }, plain_text: text, href: null }];

function page(id: string, props: { name: string; cr?: number; size?: string; tags?: string[]; env?: string[]; archived?: boolean; value?: number }) {
  return {
    object: 'page',
    id,
    created_time: '2025-07-24T22:08:00.000Z',
    properties: {
      Name: { id: 'title', type: 'title', title: rich(props.name) },
      CR: { id: 'cr', type: 'number', number: props.cr ?? null },
      Size: { id: 'sz', type: 'select', select: props.size ? { name: props.size } : null },
      Tags: { id: 'tg', type: 'multi_select', multi_select: (props.tags ?? []).map((name) => ({ name })) },
      Environments: { id: 'env', type: 'relation', relation: (props.env ?? []).map((envId) => ({ id: envId })), has_more: false },
      Archived: { id: 'ar', type: 'checkbox', checkbox: props.archived ?? false },
      Value: { id: 'val', type: 'formula', formula: { type: 'number', number: props.value ?? null } },
    },
  };
}

const goblin = page('1', { name: 'Goblin', cr: 0.25, size: 'Small', tags: ['Humanoid'], env: ['1e97c743-a611-4afc-948a-74cddd7b1fd7'], value: 5 });
const dragon = page('2', { name: 'Adult Red Dragon', cr: 17, size: 'Huge', tags: ['Dragon'], archived: true, value: 900 });

describe('matchesFilter', () => {
  it('matches title text case-insensitively for contains, exactly for equals', () => {
    expect(matchesFilter(dragon, { property: 'Name', title: { contains: 'red drag' } })).toBe(true);
    expect(matchesFilter(dragon, { property: 'Name', title: { equals: 'adult red dragon' } })).toBe(false);
    expect(matchesFilter(goblin, { property: 'Name', title: { starts_with: 'gob' } })).toBe(true);
  });

  it('compares numbers, selects, multi-selects and checkboxes', () => {
    expect(matchesFilter(dragon, { property: 'CR', number: { greater_than_or_equal_to: 17 } })).toBe(true);
    expect(matchesFilter(goblin, { property: 'Size', select: { equals: 'Small' } })).toBe(true);
    expect(matchesFilter(goblin, { property: 'Tags', multi_select: { contains: 'Dragon' } })).toBe(false);
    expect(matchesFilter(dragon, { property: 'Archived', checkbox: { equals: false } })).toBe(false);
  });

  it('matches relations by page id with or without dashes', () => {
    expect(matchesFilter(goblin, { property: 'Environments', relation: { contains: '1e97c743a6114afc948a74cddd7b1fd7' } })).toBe(true);
    expect(matchesFilter(dragon, { property: 'Environments', relation: { is_empty: true } })).toBe(true);
  });

  it('reads formula results and property ids', () => {
    expect(matchesFilter(dragon, { property: 'Value', formula: { number: { greater_than: 100 } } })).toBe(true);
    expect(matchesFilter(goblin, { property: 'sz', select: { equals: 'Small' } })).toBe(true);
  });

  it('combines and/or compounds', () => {
    const smallOrHuge = { or: [{ property: 'Size', select: { equals: 'Small' } }, { property: 'Size', select: { equals: 'Huge' } }] };
    const live = { and: [smallOrHuge, { property: 'Archived', checkbox: { equals: false } }] };
    expect([goblin, dragon].filter((p) => matchesFilter(p, live)).map((p) => p.id)).toEqual(['1']);
  });

  it('rejects unknown properties the way Notion does', () => {
    expect(() => matchesFilter(goblin, { property: 'Environment', multi_select: { contains: 'Forest' } })).toThrow(/Could not find property/);
  });
});

describe('compareBySorts', () => {
  it('orders by number, then puts empty values last', () => {
    const blank = page('3', { name: 'Unknown' });
    const sorted = [dragon, blank, goblin].sort(compareBySorts([{ property: 'CR', direction: 'ascending' }]));
    expect(sorted.map((p) => p.id)).toEqual(['1', '2', '3']);
  });

  it('orders text descending', () => {
    const sorted = [goblin, dragon].sort(compareBySorts([{ property: 'Name', direction: 'descending' }]));
    expect(sorted.map((p) => p.id)).toEqual(['1', '2']);
  });
});
