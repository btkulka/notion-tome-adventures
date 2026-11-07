// Client for the Worker's content routes (worker/api/content.ts): the reference
// tables imported from Notion. They change only when the import is re-run or the
// DM overrides a value, so responses are kept until an override invalidates them.
import { api } from '@/lib/api';

export interface TableSummary {
  key: string;
  /** The Notion database it was imported from; inline tables in page content point at it. */
  notionId: string;
  name: string;
  rows: number;
  /** Unix seconds. */
  importedAt: number;
}

export interface Column {
  name: string;
  /** The Notion property type. */
  type: string;
  options?: { name: string; color: string }[];
  /** Relations: the imported table they point at. */
  target?: string | null;
}

/** A linked row; `title` is null when it wasn't imported. */
export interface PageRef {
  id: string;
  title: string | null;
  table: string | null;
}

/** Files Notion hosts aren't served yet, so only external ones have a url. */
export interface FileRef {
  name: string;
  url: string | null;
}

export type Item = string | number | boolean | PageRef | FileRef;
export type Cell = null | string | number | boolean | Item[];

/** A small square picture and a full one for banners and cards; either may be missing or fail to load. */
export interface Images {
  thumb: string | null;
  image: string | null;
}

export interface Row {
  id: string;
  title: string;
  /** Unix seconds. */
  editedAt: number;
  cells: Record<string, Cell>;
  images: Images;
  /** Properties the DM has overridden. */
  overridden: string[];
}

export interface TableData {
  table: { key: string; name: string; importedAt: number; columns: Column[] };
  rows: Row[];
}

export interface EntrySummary {
  id: string;
  title: string;
  table: string;
  thumb: string | null;
  /** Its select and multi-select values, which pick its icon. */
  labels: string[];
}

/** A Notion block, with `children` nested in. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Block = { id: string; type: string; has_children?: boolean; children?: Block[] } & Record<string, any>;

export interface Entry {
  id: string;
  title: string;
  table: { key: string; name: string };
  columns: Column[];
  cells: Record<string, Cell>;
  /** Overridden properties: the value imported from Notion, and who changed it when. */
  overrides: Record<string, { original: Cell; updatedAt: number; by: string | null }>;
  images: Images;
  body: Block[];
  notionUrl: string | null;
  createdAt: number;
  editedAt: number;
}

/** What the DM can type for a property; worker/content/overrides.ts shapes it for Notion. */
export type EditValue = string | number | boolean | null | string[];

const cache = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();

/** Calls back after any override, so open views can reload. Returns the unsubscribe. */
export function onContentChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Forgets everything an override may have changed, keeps the entry it returned, and tells the open views. */
function changed(entry: Entry): Entry {
  cache.clear();
  cache.set(`/api/content/entries/${encodeURIComponent(entry.id)}`, Promise.resolve({ entry }));
  for (const listener of listeners) listener();
  return entry;
}

/** One request per path per visit; a failed one is forgotten so it can be retried. */
function cached<T>(path: string): Promise<T> {
  let hit = cache.get(path) as Promise<T> | undefined;
  if (!hit) {
    hit = api<T>(path);
    cache.set(path, hit);
    hit.catch(() => cache.delete(path));
  }
  return hit;
}

export const databaseApi = {
  tables: async () => (await cached<{ tables: TableSummary[] }>('/api/content/tables')).tables,
  table: (key: string) => cached<TableData>(`/api/content/tables/${encodeURIComponent(key)}`),
  entries: async () => (await cached<{ entries: EntrySummary[] }>('/api/content/entries')).entries,
  entry: async (id: string) => (await cached<{ entry: Entry }>(`/api/content/entries/${encodeURIComponent(id)}`)).entry,
  override: async (id: string, property: string, value: EditValue) =>
    changed((await api<{ entry: Entry }>(`/api/content/entries/${encodeURIComponent(id)}/overrides`, { method: 'PUT', body: { property, value } })).entry),
  restore: async (id: string, property: string) =>
    changed(
      (await api<{ entry: Entry }>(`/api/content/entries/${encodeURIComponent(id)}/overrides?property=${encodeURIComponent(property)}`, { method: 'DELETE' })).entry
    ),
};
