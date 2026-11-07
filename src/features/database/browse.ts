// How the database browser groups, orders, filters and colours imported tables.
import { crTier } from '@/features/table/encounters';
import type { Cell, Column, FileRef, Item, PageRef, Row, TableSummary } from './api';

export const isPageRef = (item: Item): item is PageRef => typeof item === 'object' && 'id' in item;
export const isFileRef = (item: Item): item is FileRef => typeof item === 'object' && !('id' in item);

export const cellItems = (cell: Cell): Item[] => (cell === null ? [] : Array.isArray(cell) ? cell : [cell]);
export const isEmpty = (cell: Cell) => cell === null || cell === '' || (Array.isArray(cell) && cell.length === 0);

export function itemText(item: Item): string {
  if (typeof item === 'boolean') return item ? 'Yes' : 'No';
  if (typeof item === 'number') return item.toLocaleString();
  if (typeof item === 'string') return item;
  return isPageRef(item) ? item.title ?? 'Unlinked page' : item.name;
}

export const cellText = (cell: Cell) => cellItems(cell).map(itemText).join(', ');

/** Sidebar shelves, in order. A table goes on the first shelf that claims it; the rest go under Other. */
const SHELVES: { label: string; claims: (key: string) => boolean }[] = [
  {
    label: 'Campaign',
    claims: (k) =>
      ['campaigns', 'sessions', 'encounters', 'locations', 'players', 'monster_instances', 'favor', 'character_stats', 'combat_accolades', 'loot_drop_settings'].includes(k),
  },
  {
    label: 'Journal',
    claims: (k) =>
      ['journal_entries', 'journal_characters', 'character_details', 'npcs', 'npc_details', 'journal_locations', 'location_details', 'factions', 'faction_details', 'ships', 'ship_details', 'documents'].includes(k),
  },
  {
    label: 'DM tools',
    claims: (k) => ['dm_tasks', 'encounter_generator', 'encounter_templates', 'encounter_difficulty', 'book_generator', 'combat_drops', 'loot_generator'].includes(k),
  },
  { label: 'Pages', claims: (k) => k === 'pages' },
  { label: 'Monsters', claims: (k) => ['monsters', 'monster_stats', 'challenge_ratings', 'monster_types', 'environments'].includes(k) },
  {
    label: 'Magic and gear',
    claims: (k) =>
      ['magic_items', 'magic_item_rarities', 'magic_item_drops', 'spell_scrolls', 'books', 'art', 'armor', 'weapons', 'equipment', 'equipment_constants', 'equipment_rarities', 'loot_drops'].includes(k),
  },
  { label: 'Loot pricing', claims: (k) => k.startsWith('loot_') },
  { label: 'Shops and vessels', claims: (k) => ['shops', 'shop_traits', 'vessels', 'vessel_constants', 'vessel_rarities', 'cargo', 'cargo_types'].includes(k) || k.endsWith('_wares') },
  { label: 'Random encounters', claims: (k) => k.startsWith('random_encounters') },
  // The older Magic Items database, which Magic Items 2025 replaced; kept for its links.
  { label: 'Legacy', claims: (k) => k.endsWith('_legacy') },
];

export function shelfOf(key: string): string {
  return SHELVES.find((s) => s.claims(key))?.label ?? 'Other';
}

export function shelve(tables: TableSummary[]): { label: string; tables: TableSummary[] }[] {
  const labels = [...SHELVES.map((s) => s.label), 'Other'];
  return labels.map((label) => ({ label, tables: tables.filter((t) => shelfOf(t.key) === label) })).filter((s) => s.tables.length);
}

/**
 * Columns to show first for tables the DM reads most. Names missing from a
 * table's schema are skipped; any table without a preset shows every column.
 */
const PRESETS: Record<string, string[]> = {
  monsters: ['Challenge Rating', 'CR', 'Monster Type', 'Type', 'Environments', 'Environment', 'Size', 'Alignment', 'Monster Subtype', 'AC', 'HP'],
  magic_items: ['Rarity', 'Type', 'Tags', 'Attunement', 'Requires Attunement', 'Consumable', 'Wondrous', 'Value', 'Source'],
};

/** Every column but the title, the table's preset ones first, for reading an entry top to bottom. */
export function readingOrder(key: string, columns: Column[]): Column[] {
  const rest = columns.filter((c) => c.type !== 'title');
  const preset = (PRESETS[key] ?? []).map((name) => rest.find((c) => c.name === name)).filter(Boolean) as Column[];
  return [...preset, ...rest.filter((c) => !preset.includes(c))];
}

/** Bookkeeping columns nobody browses by. */
const QUIET_TYPES = ['created_by', 'last_edited_by', 'created_time', 'last_edited_time', 'button', 'verification'];

/** The columns shown before the DM picks their own, title first. */
export function defaultColumns(key: string, columns: Column[]): string[] {
  const title = columns.filter((c) => c.type === 'title').map((c) => c.name);
  const preset = (PRESETS[key] ?? []).filter((name) => columns.some((c) => c.name === name && c.type !== 'title'));
  if (preset.length) return [...title, ...preset];
  return columns.filter((c) => !QUIET_TYPES.includes(c.type)).map((c) => c.name);
}

const RARITIES = ['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'];
/** As on the Tome card design: Common sits with the lowest challenge ratings. */
const RARITY_TIER = ['ash', 'verdant', 'azure', 'amethyst', 'ember', 'blood'];
/** Notion option colours on the Tome tier scale. */
const NOTION_TIER: Record<string, string> = {
  gray: 'ash',
  brown: 'bone',
  orange: 'ember',
  yellow: 'ember',
  green: 'verdant',
  blue: 'azure',
  purple: 'amethyst',
  pink: 'amethyst',
  red: 'blood',
};

const CR_TEXT = /^(?:CR\s*)?(\d+(?:\/\d+)?)$/i;
const isCrColumn = (column: Column) => /challenge|^cr$/i.test(column.name);

/** A tier for a value: rarities and challenge ratings by the generator's scale, select options by their Notion colour. */
export function tierOf(column: Column, text: string): string | null {
  const rarity = RARITIES.indexOf(text.toLowerCase());
  if (rarity >= 0) return RARITY_TIER[rarity];
  const cr = isCrColumn(column) ? CR_TEXT.exec(text.trim()) : null;
  if (cr) return crTier(cr[1]);
  const color = column.options?.find((o) => o.name === text)?.color;
  return (color && NOTION_TIER[color]) || null;
}

/** Rarities by the ladder, challenge ratings and other numbers by value; null for anything else. */
function rank(text: string): number | null {
  const rarity = RARITIES.indexOf(text.toLowerCase());
  if (rarity >= 0) return rarity;
  const cr = CR_TEXT.exec(text.trim());
  if (!cr) return null;
  const [n, d] = cr[1].split('/').map(Number);
  return d ? n / d : n;
}

export function compareText(a: string, b: string): number {
  const x = rank(a);
  const y = rank(b);
  if (x !== null && y !== null && x !== y) return x - y;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** Orders two cells, empty ones last whichever way the column is sorted. */
export function compareCells(a: Cell, b: Cell, direction: 1 | -1): number {
  if (isEmpty(a) || isEmpty(b)) return Number(isEmpty(a)) - Number(isEmpty(b));
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * direction;
  if (typeof a === 'boolean' && typeof b === 'boolean') return (Number(b) - Number(a)) * direction;
  const x = cellItems(a)[0];
  const y = cellItems(b)[0];
  if (typeof x === 'number' && typeof y === 'number') return (x - y) * direction;
  return compareText(itemText(x), itemText(y)) * direction;
}

/** Most columns a table offers as dropdown filters, and the most values one may have. */
const MAX_FACETS = 4;
const MAX_FACET_VALUES = 40;
const FACET_TYPES = ['select', 'status', 'multi_select', 'relation', 'checkbox', 'rollup'];

export interface Facet {
  column: string;
  values: string[];
}

/** Columns worth filtering by: the shown ones first, then others, each with a handful of distinct values. */
export function facetsOf(columns: Column[], rows: Row[], shown: string[]): Facet[] {
  const place = (c: Column) => (shown.includes(c.name) ? shown.indexOf(c.name) : Infinity);
  const candidates = [...columns].sort((a, b) => place(a) - place(b));
  const facets: Facet[] = [];
  for (const column of candidates) {
    if (facets.length >= MAX_FACETS) break;
    if (!FACET_TYPES.includes(column.type)) continue;
    const values = new Set<string>();
    for (const row of rows) {
      for (const item of cellItems(row.cells[column.name])) {
        if (typeof item === 'object' && isFileRef(item)) continue;
        values.add(itemText(item));
      }
      if (values.size > MAX_FACET_VALUES) break;
    }
    if (values.size < 2 || values.size > MAX_FACET_VALUES) continue;
    facets.push({ column: column.name, values: [...values].sort(compareText) });
  }
  return facets;
}

/** Whether a row's title or any of its values contains the search text (already lower-cased). */
export function rowMatches(row: Row, query: string): boolean {
  if (!query) return true;
  if (row.title.toLowerCase().includes(query)) return true;
  return Object.values(row.cells).some((cell) => cellText(cell).toLowerCase().includes(query));
}

export const facetMatches = (row: Row, column: string, value: string) => cellItems(row.cells[column]).some((item) => itemText(item) === value);

const COLUMN_STORE = 'tome.database.columns.';

/** The columns the DM chose for a table on this device, if any. */
export function savedColumns(key: string): string[] | null {
  try {
    const saved = JSON.parse(localStorage.getItem(COLUMN_STORE + key) ?? 'null');
    return Array.isArray(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function saveColumns(key: string, names: string[] | null) {
  try {
    if (names) localStorage.setItem(COLUMN_STORE + key, JSON.stringify(names));
    else localStorage.removeItem(COLUMN_STORE + key);
  } catch {
    // Private windows can refuse storage; the choice then lasts until reload.
  }
}

/** A Notion page id in a link, for links between Notion pages (`/<id>`, notion.so URLs). */
export function notionPageId(href: string | null | undefined): string | null {
  if (!href || !(href.startsWith('/') || /notion\.(so|site|com)/.test(href))) return null;
  const match = href.replace(/-/g, '').match(/([0-9a-f]{32})(?:[?#].*)?$/i);
  return match ? match[1] : null;
}

export const formatDay = (unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const DATE_TYPES = ['date', 'created_time', 'last_edited_time'];

/** A Notion date or date range (`start → end`) for reading. Dates without a time stay in their own day. */
export function formatDates(text: string): string {
  return text
    .split(' → ')
    .map((part) => {
      const at = new Date(part.length <= 10 ? `${part}T00:00:00` : part);
      if (Number.isNaN(at.getTime())) return part;
      const day = at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      return part.length <= 10 ? day : `${day}, ${at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
    })
    .join(' – ');
}
