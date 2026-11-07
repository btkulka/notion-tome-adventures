/* eslint-disable @typescript-eslint/no-explicit-any -- Notion payloads are untyped JSON, as in worker/notion/client.ts. */
// Turns property values written the way Notion's API takes them (`pages.create`,
// `pages.update`) into the shape it returns them in, which is how content_rows
// stores pages and what the extractors read. Checked against the table's schema
// with Notion's rules: a property must exist, computed ones can't be written, and
// naming a select option the column doesn't have yet adds it.
import { NotionError } from '../notion/client';

const ANNOTATIONS = { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' };

const invalid = (message: string) => new NotionError(message, 400, 'validation_error');

/** Notion accepts ids with or without dashes; rows are stored dashed. */
export function dashed(id: string): string {
  const hex = id.replace(/-/g, '').toLowerCase();
  return hex.length === 32 ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` : id;
}

function richText(name: string, items: unknown): any[] {
  if (!Array.isArray(items)) throw invalid(`${name} should be a list of rich text items`);
  return items.map((item: any) => {
    // Already in the stored shape (a mention, or text read back from a page).
    if (typeof item?.plain_text === 'string') return item;
    const content = item?.text?.content;
    if (typeof content !== 'string') throw invalid(`${name} should be text`);
    if (content.length > 2000) throw invalid(`${name}: a rich text item is at most 2000 characters`);
    const link = item.text.link?.url ? { url: String(item.text.link.url) } : null;
    return {
      type: 'text',
      text: { content, link },
      annotations: { ...ANNOTATIONS, ...item.annotations },
      plain_text: content,
      href: link?.url ?? null,
    };
  });
}

/** An option of a select, status or multi-select column, added to the schema if it's new. */
function option(def: any, value: any): { id: string; name: string; color: string } {
  const options: any[] = ((def[def.type] ??= {}).options ??= []);
  const found = options.find((o) => (value?.id && o.id === value.id) || (value?.name !== undefined && o.name === value.name));
  if (found) return { id: found.id, name: found.name, color: found.color ?? 'default' };
  if (def.type === 'status') throw invalid(`${def.name}: there is no status named ${value?.name ?? value?.id}`);
  if (typeof value?.name !== 'string' || !value.name.trim()) throw invalid(`${def.name} needs an option name`);
  if (value.name.includes(',')) throw invalid(`${def.name}: option names can't contain commas`);
  const added = { id: crypto.randomUUID().slice(0, 8), name: value.name, color: value.color ?? 'default' };
  options.push(added);
  return added;
}

function text(def: any, value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw invalid(`${def.name} should be text`);
  return value;
}

/** The empty value Notion shows for a column a page hasn't set. Computed columns are left out. */
export function emptyProperty(def: any): any | undefined {
  const empty: Record<string, unknown> = {
    title: [], rich_text: [], number: null, select: null, status: null, multi_select: [], date: null,
    checkbox: false, url: null, email: null, phone_number: null, files: [], people: [], relation: [],
  };
  if (!(def.type in empty)) return undefined;
  return { id: def.id, type: def.type, [def.type]: empty[def.type], ...(def.type === 'relation' ? { has_more: false } : {}) };
}

/**
 * One property as stored, from the value written for it. `def` is the column in
 * the table's schema; new select options are added to it, so the caller saves the
 * schema when `added` comes back true.
 */
export function storedProperty(def: any, value: any): { property: any; added: boolean } {
  const before = JSON.stringify(def[def.type]?.options ?? null);
  const type = def.type;
  // Notion lets callers name the type ({ type: 'select', select: … }) or not.
  const v = value && typeof value === 'object' && type in value ? value[type] : undefined;
  if (v === undefined) throw invalid(`${def.name} is expected to be ${type}`);

  let stored: unknown;
  switch (type) {
    case 'title':
    case 'rich_text':
      stored = richText(def.name, v);
      break;
    case 'number':
      if (v !== null && (typeof v !== 'number' || !Number.isFinite(v))) throw invalid(`${def.name} should be a number`);
      stored = v;
      break;
    case 'checkbox':
      if (typeof v !== 'boolean') throw invalid(`${def.name} should be true or false`);
      stored = v;
      break;
    case 'url':
    case 'email':
    case 'phone_number':
      stored = text(def, v);
      break;
    case 'select':
    case 'status':
      stored = v === null ? null : option(def, v);
      break;
    case 'multi_select':
      if (!Array.isArray(v)) throw invalid(`${def.name} should be a list of options`);
      stored = v.map((o) => option(def, o));
      break;
    case 'date':
      if (v === null) stored = null;
      else if (typeof v?.start !== 'string' || Number.isNaN(Date.parse(v.start))) throw invalid(`${def.name} needs a start date`);
      else stored = { start: v.start, end: v.end ?? null, time_zone: v.time_zone ?? null };
      break;
    case 'relation':
      if (!Array.isArray(v) || v.some((r) => typeof r?.id !== 'string')) throw invalid(`${def.name} should be a list of page ids`);
      stored = v.map((r) => ({ id: dashed(r.id) }));
      break;
    case 'files':
      if (!Array.isArray(v)) throw invalid(`${def.name} should be a list of files`);
      stored = v.map((f: any) => {
        if (f?.type === 'file' && f.file) return f; // read back from a page
        const url = f?.external?.url;
        if (typeof url !== 'string') throw invalid(`${def.name}: only linked files can be written`);
        return { name: String(f.name ?? url).slice(0, 100), type: 'external', external: { url } };
      });
      break;
    default:
      throw invalid(`${def.name} is a ${type} property, which can't be written`);
  }

  const property = { id: def.id, type, [type]: stored, ...(type === 'relation' ? { has_more: false } : {}) };
  return { property, added: JSON.stringify(def[def.type]?.options ?? null) !== before };
}

/** The text of a page's title property, as content_rows.title keeps it. */
export function titleOf(page: any): string {
  const prop = Object.values<any>(page.properties ?? {}).find((p) => p?.type === 'title');
  return (prop?.title ?? []).map((t: any) => t.plain_text ?? '').join('');
}
