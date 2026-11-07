/* eslint-disable @typescript-eslint/no-explicit-any -- Notion page objects are untyped JSON, as in worker/notion. */
// DM overrides of imported content (migrations/0004_content_overrides.sql): each
// replaces one property of one row wherever the content is read, so the
// generators, filters and the database browser all see the DM's value while the
// imported original stays in content_rows.

export interface Override {
  row_id: string;
  property_id: string;
  property: string;
  value: string;
  updated_by: string | null;
  updated_at: number;
}

/** What an override replaced: the imported property, and the override itself. */
export interface Replaced {
  name: string;
  original: any;
  override: Override;
}

const MAX_TEXT = 20_000;
const MAX_ITEMS = 200;

/** The property an override is for: by Notion property id, or by name if the id is gone. */
export function propertyFor(page: any, override: Pick<Override, 'property_id' | 'property'>): string | null {
  const props = page.properties ?? {};
  const byId = Object.keys(props).find((name) => props[name]?.id === override.property_id);
  if (byId) return byId;
  return override.property in props ? override.property : null;
}

/**
 * Puts each row's overrides in place of the imported values, in place. Returns
 * what was replaced, by row id, so callers that show both can.
 */
export async function applyOverrides(db: D1Database, pages: any[]): Promise<Map<string, Replaced[]>> {
  const replaced = new Map<string, Replaced[]>();
  if (!pages.length) return replaced;
  const { results } = await db
    .prepare('SELECT row_id, property_id, property, value, updated_by, updated_at FROM content_overrides WHERE row_id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(pages.map((p) => p.id)))
    .all<Override>();
  if (!results.length) return replaced;
  const byId = new Map(pages.map((p) => [p.id, p]));
  for (const override of results) {
    const page = byId.get(override.row_id);
    const name = page ? propertyFor(page, override) : null;
    if (!name) continue;
    const original = page.properties[name];
    page.properties[name] = { ...JSON.parse(override.value), id: original.id };
    if (!replaced.has(page.id)) replaced.set(page.id, []);
    replaced.get(page.id)!.push({ name, original, override });
  }
  return replaced;
}

const richText = (content: string) =>
  content
    ? [
        {
          type: 'text',
          text: { content, link: null },
          annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' },
          plain_text: content,
          href: null,
        },
      ]
    : [];

export class OverrideError extends Error {}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') throw new OverrideError('Expected text');
  if (value.length > MAX_TEXT) throw new OverrideError(`Keep it under ${MAX_TEXT.toLocaleString()} characters`);
  return value;
}

function list(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) throw new OverrideError('Expected a list');
  if (value.length > MAX_ITEMS) throw new OverrideError(`At most ${MAX_ITEMS} values`);
  return [...new Set(value as string[])];
}

/**
 * The DM's edit as a Notion property value, shaped like the imported one so the
 * extractors and filters read it unchanged. `schema` is the column definition and
 * `current` the imported property (for formula and rollup result types).
 */
export function toProperty(schema: any, current: any, value: unknown): any {
  const type = schema?.type ?? current?.type;
  const color = (name: string) => schema?.[type]?.options?.find((o: any) => o.name === name)?.color ?? 'default';
  switch (type) {
    case 'title':
    case 'rich_text':
      return { type, [type]: richText(text(value).trim()) };
    case 'url':
    case 'email':
    case 'phone_number':
      return { type, [type]: text(value).trim() || null };
    case 'number':
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) throw new OverrideError('Expected a number');
      return { type, number: value };
    case 'checkbox':
      if (typeof value !== 'boolean') throw new OverrideError('Expected yes or no');
      return { type, checkbox: value };
    case 'select':
    case 'status': {
      const name = text(value).trim();
      return { type, [type]: name ? { name, color: color(name) } : null };
    }
    case 'multi_select':
      return { type, multi_select: list(value).map((name) => ({ name, color: color(name) })) };
    case 'date': {
      const start = text(value).trim();
      if (start && Number.isNaN(Date.parse(start))) throw new OverrideError('Expected a date');
      return { type, date: start ? { start, end: null, time_zone: null } : null };
    }
    case 'relation':
      return { type, relation: list(value).map((id) => ({ id })), has_more: false };
    case 'formula': {
      // Notion computes these; an override pins the result.
      if (typeof value === 'number' && Number.isFinite(value)) return { type, formula: { type: 'number', number: value } };
      if (typeof value === 'boolean') return { type, formula: { type: 'boolean', boolean: value } };
      if (value === null) return { type, formula: { type: current?.formula?.type ?? 'string', [current?.formula?.type ?? 'string']: null } };
      return { type, formula: { type: 'string', string: text(value) } };
    }
    case 'rollup':
      if (current?.rollup?.type !== 'number') throw new OverrideError('Only number rollups can be overridden');
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) throw new OverrideError('Expected a number');
      return { type, rollup: { type: 'number', number: value, function: current.rollup.function } };
    default:
      throw new OverrideError(`${type ?? 'This'} properties can't be overridden`);
  }
}
