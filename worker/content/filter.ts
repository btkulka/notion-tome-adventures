/* eslint-disable @typescript-eslint/no-explicit-any -- Notion page objects and filters are untyped JSON, as in worker/notion. */
// Notion database query filters and sorts, evaluated against stored page objects
// (https://developers.notion.com/reference/post-database-query-filter). Relative
// date conditions (past_week and so on) and rollup filters are not supported.
import { NotionError } from '../notion/client';

type Page = any;
type Condition = Record<string, any>;

const plain = (rich: any[] | undefined): string => (rich ?? []).map((t) => t.plain_text ?? t.text?.content ?? '').join('');

function findProperty(page: Page, name: string): any {
  const props = page.properties ?? {};
  const prop = props[name] ?? Object.values(props).find((p: any) => p?.id === name);
  if (!prop) throw new NotionError(`Could not find property with name or id: ${name}`, 400, 'validation_error');
  return prop;
}

function textOf(prop: any): string {
  switch (prop?.type) {
    case 'title':
    case 'rich_text':
      return plain(prop[prop.type]);
    case 'url':
    case 'email':
    case 'phone_number':
      return prop[prop.type] ?? '';
    case 'select':
    case 'status':
      return prop[prop.type]?.name ?? '';
    case 'formula':
      return prop.formula?.string ?? '';
    default:
      return '';
  }
}

function numberOf(prop: any): number | null {
  if (prop?.type === 'number') return prop.number ?? null;
  if (prop?.type === 'formula') return prop.formula?.number ?? null;
  if (prop?.type === 'rollup') return prop.rollup?.number ?? null;
  if (prop?.type === 'unique_id') return prop.unique_id?.number ?? null;
  return null;
}

function checkboxOf(prop: any): boolean {
  if (prop?.type === 'formula') return prop.formula?.boolean === true;
  return prop?.checkbox === true;
}

function namesOf(prop: any): string[] {
  if (prop?.type === 'multi_select') return (prop.multi_select ?? []).map((o: any) => o.name);
  const one = prop?.select?.name ?? prop?.status?.name;
  return one ? [one] : [];
}

function idsOf(prop: any): string[] {
  if (prop?.type === 'relation') return (prop.relation ?? []).map((r: any) => r.id);
  if (prop?.type === 'people' || prop?.type === 'created_by' || prop?.type === 'last_edited_by') {
    const people = prop.type === 'people' ? prop.people : [prop[prop.type]];
    return (people ?? []).filter(Boolean).map((p: any) => p.id);
  }
  return [];
}

function dateOf(prop: any): string | null {
  switch (prop?.type) {
    case 'date':
      return prop.date?.start ?? null;
    case 'created_time':
    case 'last_edited_time':
      return prop[prop.type] ?? null;
    case 'formula':
      return prop.formula?.date?.start ?? null;
    default:
      return null;
  }
}

/** Ids compare without dashes, as Notion accepts either form. */
const sameId = (a: string, b: string) => a.replace(/-/g, '').toLowerCase() === b.replace(/-/g, '').toLowerCase();

function unsupported(kind: string, condition: Condition): never {
  throw new NotionError(`Unsupported ${kind} filter condition: ${Object.keys(condition).join(', ')}`, 400, 'validation_error');
}

function matchText(value: string, c: Condition): boolean {
  const v = value.toLowerCase();
  if ('equals' in c) return value === c.equals;
  if ('does_not_equal' in c) return value !== c.does_not_equal;
  if ('contains' in c) return v.includes(String(c.contains).toLowerCase());
  if ('does_not_contain' in c) return !v.includes(String(c.does_not_contain).toLowerCase());
  if ('starts_with' in c) return v.startsWith(String(c.starts_with).toLowerCase());
  if ('ends_with' in c) return v.endsWith(String(c.ends_with).toLowerCase());
  if (c.is_empty) return value === '';
  if (c.is_not_empty) return value !== '';
  return unsupported('text', c);
}

function matchNumber(value: number | null, c: Condition): boolean {
  if (c.is_empty) return value === null;
  if (c.is_not_empty) return value !== null;
  if (value === null) return 'does_not_equal' in c;
  if ('equals' in c) return value === c.equals;
  if ('does_not_equal' in c) return value !== c.does_not_equal;
  if ('greater_than' in c) return value > c.greater_than;
  if ('less_than' in c) return value < c.less_than;
  if ('greater_than_or_equal_to' in c) return value >= c.greater_than_or_equal_to;
  if ('less_than_or_equal_to' in c) return value <= c.less_than_or_equal_to;
  return unsupported('number', c);
}

function matchCheckbox(value: boolean, c: Condition): boolean {
  if ('equals' in c) return value === c.equals;
  if ('does_not_equal' in c) return value !== c.does_not_equal;
  return unsupported('checkbox', c);
}

function matchSelect(names: string[], c: Condition): boolean {
  if ('equals' in c) return names[0] === c.equals;
  if ('does_not_equal' in c) return names[0] !== c.does_not_equal;
  if (c.is_empty) return names.length === 0;
  if (c.is_not_empty) return names.length > 0;
  return unsupported('select', c);
}

function matchList(values: string[], c: Condition, same: (a: string, b: string) => boolean): boolean {
  if ('contains' in c) return values.some((v) => same(v, c.contains));
  if ('does_not_contain' in c) return !values.some((v) => same(v, c.does_not_contain));
  if (c.is_empty) return values.length === 0;
  if (c.is_not_empty) return values.length > 0;
  return unsupported('list', c);
}

function matchDate(value: string | null, c: Condition): boolean {
  if (c.is_empty) return value === null;
  if (c.is_not_empty) return value !== null;
  if (value === null) return false;
  const t = Date.parse(value);
  const at = (d: string) => Date.parse(d);
  // A bare date (no time) matches the whole day.
  if ('equals' in c) return c.equals.length <= 10 ? value.slice(0, 10) === c.equals : t === at(c.equals);
  if ('before' in c) return t < at(c.before);
  if ('after' in c) return t > at(c.after);
  if ('on_or_before' in c) return t <= at(c.on_or_before);
  if ('on_or_after' in c) return t >= at(c.on_or_after);
  return unsupported('date', c);
}

function matchFormula(prop: any, c: Condition): boolean {
  if (c.string) return matchText(prop.formula?.string ?? '', c.string);
  if (c.number) return matchNumber(prop.formula?.number ?? null, c.number);
  if (c.checkbox) return matchCheckbox(prop.formula?.boolean === true, c.checkbox);
  if (c.date) return matchDate(prop.formula?.date?.start ?? null, c.date);
  return unsupported('formula', c);
}

const TEXT_TYPES = ['title', 'rich_text', 'url', 'email', 'phone_number'];

/** Whether a page satisfies a Notion filter object (property, timestamp or and/or compound). */
export function matchesFilter(page: Page, filter: any): boolean {
  if (Array.isArray(filter.and)) return filter.and.every((f: any) => matchesFilter(page, f));
  if (Array.isArray(filter.or)) return filter.or.some((f: any) => matchesFilter(page, f));

  if (filter.timestamp) {
    const key = filter.timestamp as 'created_time' | 'last_edited_time';
    return matchDate(page[key] ?? null, filter[key] ?? {});
  }

  const prop = findProperty(page, filter.property);
  const kind = Object.keys(filter).find((k) => k !== 'property' && k !== 'type');
  const c = kind ? filter[kind] : {};
  if (kind && TEXT_TYPES.includes(kind)) return matchText(textOf(prop), c);
  switch (kind) {
    case 'number':
      return matchNumber(numberOf(prop), c);
    case 'checkbox':
      return matchCheckbox(checkboxOf(prop), c);
    case 'select':
    case 'status':
      return matchSelect(namesOf(prop), c);
    case 'multi_select':
      return matchList(namesOf(prop), c, (a, b) => a === b);
    case 'relation':
    case 'people':
    case 'created_by':
    case 'last_edited_by':
      return matchList(idsOf(prop), c, sameId);
    case 'date':
    case 'created_time':
    case 'last_edited_time':
      return matchDate(dateOf(prop), c);
    case 'formula':
      return matchFormula(prop, c);
    default:
      throw new NotionError(`Unsupported filter type: ${kind ?? '(none)'}`, 400, 'validation_error');
  }
}

/** A value to order by: numbers as numbers, everything else as text. Empty sorts last. */
function sortValue(page: Page, sort: any): number | string | null {
  if (sort.timestamp) return page[sort.timestamp] ?? null;
  const prop = findProperty(page, sort.property);
  const n = numberOf(prop);
  if (n !== null) return n;
  if (prop.type === 'checkbox') return prop.checkbox ? 1 : 0;
  const text = TEXT_TYPES.includes(prop.type) || prop.type === 'select' || prop.type === 'status' || prop.type === 'formula'
    ? textOf(prop)
    : prop.type === 'multi_select'
      ? namesOf(prop).join(', ')
      : dateOf(prop) ?? '';
  return text === '' ? null : text;
}

/** Comparator for Notion `sorts` (earlier entries take precedence). */
export function compareBySorts(sorts: any[]): (a: Page, b: Page) => number {
  return (a, b) => {
    for (const sort of sorts) {
      const x = sortValue(a, sort);
      const y = sortValue(b, sort);
      if (x === y) continue;
      if (x === null) return 1;
      if (y === null) return -1;
      const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      if (order !== 0) return sort.direction === 'descending' ? -order : order;
    }
    return 0;
  };
}
