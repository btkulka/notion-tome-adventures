/* eslint-disable @typescript-eslint/no-explicit-any -- Notion page objects are untyped JSON, as in worker/notion. */
// Notion property values as plain JSON for the database browser (worker/api/content.ts).
// Relations become the linked row's title, looked up by the caller from the ids
// that `relationIds` collects.

/** A linked row. `title` and `table` are null when it wasn't imported. */
export interface PageRef {
  id: string;
  title: string | null;
  table: string | null;
}

/** A file property entry. Files stored in Notion aren't hosted yet, so only external ones have a url. */
export interface FileRef {
  name: string;
  url: string | null;
}

export type Item = string | number | boolean | PageRef | FileRef;
export type Cell = null | string | number | boolean | Item[];

export interface Column {
  name: string;
  /** The Notion property type. */
  type: string;
  /** Select, multi-select and status options with their Notion colours. */
  options?: { name: string; color: string }[];
  /** Relations: the imported table they point at, if it was imported. */
  target?: string | null;
}

const plain = (rich: any[] | undefined): string => (rich ?? []).map((t) => t.plain_text ?? t.text?.content ?? '').join('');

/** Every page id a page's relations (including relation rollups) point at. */
export function relationIds(page: any): string[] {
  const ids: string[] = [];
  const walk = (prop: any) => {
    if (prop?.type === 'relation') for (const r of prop.relation ?? []) ids.push(r.id);
    if (prop?.type === 'rollup' && prop.rollup?.type === 'array') for (const p of prop.rollup.array ?? []) walk(p);
  };
  for (const prop of Object.values<any>(page.properties ?? {})) walk(prop);
  return ids;
}

function dateText(date: any): string | null {
  if (!date?.start) return null;
  return date.end ? `${date.start} → ${date.end}` : date.start;
}

/** One property value as a Cell. Text longer than `maxText` is cut short with an ellipsis. */
export function cellOf(prop: any, refs: Map<string, Omit<PageRef, 'id'>>, maxText = Infinity): Cell {
  const text = (s: string | null | undefined): string | null => {
    if (!s) return null;
    return s.length > maxText ? `${s.slice(0, maxText).trimEnd()}…` : s;
  };
  switch (prop?.type) {
    case 'title':
    case 'rich_text':
      return text(plain(prop[prop.type]));
    case 'url':
    case 'email':
    case 'phone_number':
      return prop[prop.type] || null;
    case 'number':
      return prop.number ?? null;
    case 'checkbox':
      return prop.checkbox === true;
    case 'select':
    case 'status':
      return prop[prop.type]?.name ?? null;
    case 'multi_select':
      return (prop.multi_select ?? []).map((o: any) => o.name);
    case 'date':
      return dateText(prop.date);
    case 'people':
      return (prop.people ?? []).map((p: any) => p.name).filter(Boolean);
    case 'files':
      return (prop.files ?? []).map((f: any) => ({ name: f.name ?? 'File', url: f.type === 'external' ? f.external?.url ?? null : null }));
    case 'relation':
      return (prop.relation ?? []).map((r: any) => ({ id: r.id, title: null, table: null, ...refs.get(r.id) }));
    case 'formula': {
      const f = prop.formula ?? {};
      if (f.type === 'date') return dateText(f.date);
      if (f.type === 'string') return text(f.string);
      return f[f.type] ?? null;
    }
    case 'rollup': {
      const r = prop.rollup ?? {};
      if (r.type === 'number') return r.number ?? null;
      if (r.type === 'date') return dateText(r.date);
      if (r.type !== 'array') return null;
      const items: Item[] = [];
      for (const p of r.array ?? []) {
        const v = cellOf(p, refs, maxText);
        if (Array.isArray(v)) items.push(...v);
        else if (v !== null) items.push(v);
      }
      return items;
    }
    case 'unique_id': {
      const u = prop.unique_id ?? {};
      if (u.number === null || u.number === undefined) return null;
      return u.prefix ? `${u.prefix}-${u.number}` : u.number;
    }
    case 'created_time':
    case 'last_edited_time':
      return prop[prop.type] ?? null;
    case 'created_by':
    case 'last_edited_by':
      return prop[prop.type]?.name ?? null;
    default:
      return null;
  }
}

/**
 * Pictures for a row. `thumb` is a small square (an icon, else a crop of the
 * cover); `image` the full picture for banners and cards (the cover first).
 */
export interface Images {
  thumb: string | null;
  image: string | null;
}

/** Where scripts/notion-import/files.ts puts the import's downloads of Notion-hosted files. */
const FILES = '/notion-files/';
const IMAGE_FILE = /\.(png|jpe?g|gif|webp|avif)$/i;
const IMAGE_PROPERTY = /image|portrait|token|avatar|art\b|picture|thumbnail/i;

/** A Notion file holder's picture: external links as they are, downloaded files as a thumbnail or web-sized copy. */
function source(holder: any, size: 'thumb' | 'full'): string | null {
  if (holder?.type === 'external') return holder.external?.url || null;
  if (holder?.type !== 'file' || !holder.tome_file || !IMAGE_FILE.test(holder.tome_file)) return null;
  return `${FILES}${holder.tome_file.split('/').map(encodeURIComponent).join('/')}.${size === 'thumb' ? 'thumb' : 'full'}.webp`;
}

/** The first image block in a page's content. */
function firstImage(blocks: any[]): any {
  for (const block of blocks ?? []) {
    if (block.type === 'image') return block.image;
    const nested = firstImage(block.children);
    if (nested) return nested;
  }
  return null;
}

/** A row's pictures from its icon, cover, image links, file properties and (when given) page content. */
export function imagesOf(page: any, body: any[] = []): Images {
  const props = Object.entries<any>(page.properties ?? {});
  const linked = props
    .filter(([name, p]) => p?.type === 'url' && IMAGE_PROPERTY.test(name) && /^https?:\/\//.test(p.url ?? ''))
    .map(([, p]) => ({ type: 'external', external: { url: p.url } }));
  const files = props.flatMap(([, p]) => (p?.type === 'files' ? p.files ?? [] : [])).filter((f: any) => IMAGE_FILE.test(f.name ?? '') || f.type === 'file');
  const inBody = firstImage(body);
  const pick = (size: 'thumb' | 'full', ...holders: any[]) => holders.map((h) => source(h, size)).find(Boolean) ?? null;
  return {
    thumb: pick('thumb', page.icon, page.cover, ...files, ...linked, inBody),
    image: pick('full', page.cover, ...files, ...linked, inBody, page.icon),
  };
}

/** Notion database ids compare without dashes. */
export const undashed = (id: string) => id.replace(/-/g, '').toLowerCase();

/** The table's columns, title first, from the Notion database schema. `tableByDatabase` is keyed by undashed database id. */
export function columnsOf(schema: Record<string, any>, tableByDatabase: Map<string, string>): Column[] {
  const columns = Object.entries(schema).map(([name, def]): Column => {
    const column: Column = { name, type: def.type };
    const options = def[def.type]?.options;
    if (Array.isArray(options)) column.options = options.map((o: any) => ({ name: o.name, color: o.color ?? 'default' }));
    if (def.type === 'relation') column.target = tableByDatabase.get(undashed(def.relation?.database_id ?? '')) ?? null;
    return column;
  });
  return [...columns.filter((c) => c.type === 'title'), ...columns.filter((c) => c.type !== 'title')];
}

/** Every column's cell for a page, keyed by column name. */
export function cellsOf(page: any, columns: Column[], refs: Map<string, Omit<PageRef, 'id'>>, maxText?: number): Record<string, Cell> {
  const cells: Record<string, Cell> = {};
  for (const { name } of columns) cells[name] = cellOf(page.properties?.[name], refs, maxText);
  return cells;
}
