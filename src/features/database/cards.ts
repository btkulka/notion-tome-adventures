// What a Tome card shows for an entry (TomeCard.tsx): the rank and tier band,
// the type line, a few numbers and a passage of text.
import type { Block, Cell, Column, Entry } from './api';
import { cellItems, isEmpty, itemText, tierOf } from './browse';
import { glyphFor } from './glyphs';

export interface CardFace {
  title: string;
  /** Top left: challenge rating, rarity, or the table. */
  rank: string;
  tier: string;
  xp: number | null;
  /** The italic type line, e.g. "Large beast, unaligned". */
  meta: string;
  text: string;
  stats: { label: string; value: string }[];
  /** STR to CHA with modifiers, when the entry or its linked stats row has them. */
  abilities: { label: string; score: number; modifier: string }[];
  art: string | null;
  glyph: string;
}

const XP_BY_CR: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900,
  '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000,
  '19': 22000, '20': 25000, '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000,
  '28': 120000, '29': 135000, '30': 155000,
};

const TEXT_COLUMN = /description|effect|summary|notes|text|lore/i;
const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

/** The linked row holding an entry's ability scores (Monsters → Monster Stats), if any. */
export function statsLinkOf(entry: Entry): string | null {
  const column = entry.columns.find((c) => c.type === 'relation' && /stats/i.test(c.name) && c.target);
  const ref = column ? cellItems(entry.cells[column.name] ?? null).find((i) => typeof i === 'object' && 'id' in i && i.title !== null) : null;
  return ref && typeof ref === 'object' && 'id' in ref ? ref.id : null;
}

function abilitiesOf(cells: Record<string, Cell>): CardFace['abilities'] {
  if (!ABILITIES.every((a) => typeof cells[a] === 'number')) return [];
  return ABILITIES.map((label) => {
    const score = cells[label] as number;
    const mod = Math.floor((score - 10) / 2);
    return { label, score, modifier: mod >= 0 ? `+${mod}` : `−${-mod}` };
  });
}
const TYPE_COLUMN = /type|categor|kind/i;
const MAX_TEXT = 360;

/** Values that say what kind of thing a row is: its selects, multi-selects and type relations. */
export function labelsOf(columns: Column[], cells: Record<string, Cell>): string[] {
  return columns
    .filter((c) => ['select', 'multi_select', 'status'].includes(c.type) || (c.type === 'relation' && TYPE_COLUMN.test(c.name)))
    .flatMap((c) => cellItems(cells[c.name] ?? null).map(itemText));
}

/** A row's tier: from its challenge rating or rarity, if it has one. */
export function tierOfRow(columns: Column[], cells: Record<string, Cell>): string | null {
  for (const column of columns) {
    if (!/challenge|^cr$|rarity/i.test(column.name)) continue;
    for (const item of cellItems(cells[column.name] ?? null)) {
      const tier = tierOf(column, itemText(item));
      if (tier) return tier;
    }
  }
  return null;
}

const plainText = (rich: { plain_text?: string }[] | undefined) => (rich ?? []).map((t) => t.plain_text ?? '').join('');

/** The first paragraphs of a page, as plain text. */
function opening(blocks: Block[]): string {
  const parts: string[] = [];
  const walk = (list: Block[]) => {
    for (const block of list) {
      if (parts.join(' ').length > MAX_TEXT) return;
      if (['paragraph', 'quote', 'callout'].includes(block.type)) {
        const text = plainText(block[block.type]?.rich_text).trim();
        if (text) parts.push(text);
      }
      if (block.children && block.type !== 'toggle') walk(block.children);
    }
  };
  walk(blocks);
  return parts.join(' ');
}

const clip = (text: string) => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT).replace(/\s+\S*$/, '')}…` : text);

/** The card for an entry; `stats` is its linked stats row when it has one (statsLinkOf). */
export function cardOf(entry: Entry, statsRow: Entry | null = null): CardFace {
  const { columns, cells } = entry;
  const named = (pattern: RegExp) => columns.find((c) => pattern.test(c.name) && !isEmpty(cells[c.name] ?? null));
  const text = (column: Column | undefined) => (column ? cellItems(cells[column.name]).map(itemText).join(', ') : '');

  const crColumn = named(/challenge|^cr$/i);
  const cr = text(crColumn).replace(/^CR\s*/i, '');
  const rarity = text(named(/rarity/i));
  const labels = labelsOf(columns, cells);

  let meta: string;
  if (cr) {
    const size = text(named(/^size$/i));
    const type = text(columns.find((c) => /type/i.test(c.name) && !/subtype|treasure/i.test(c.name) && !isEmpty(cells[c.name] ?? null)));
    const alignment = text(named(/alignment/i));
    meta = [[size, type.toLowerCase()].filter(Boolean).join(' '), alignment.toLowerCase()].filter(Boolean).join(', ');
  } else if (rarity) {
    const kind = text(named(/^(type|tags|category|item type)$/i)) || 'Item';
    const attune = columns.some((c) => /attune/i.test(c.name) && cells[c.name] === true);
    meta = `${kind}${attune ? ', requires attunement' : ''}`;
  } else {
    meta = [...new Set(labels)].slice(0, 3).join(' · ') || entry.table.name;
  }

  const abilities = abilitiesOf(cells).length ? abilitiesOf(cells) : statsRow ? abilitiesOf(statsRow.cells) : [];
  const stats = columns
    .filter((c) => c.type !== 'title' && !/^xp$|challenge|^cr$/i.test(c.name) && !ABILITIES.includes(c.name) && typeof cells[c.name] === 'number')
    .slice(0, 3)
    .map((c) => ({ label: c.name, value: (cells[c.name] as number).toLocaleString() }));

  const described = columns.find((c) => (c.type === 'rich_text' || c.type === 'formula') && TEXT_COLUMN.test(c.name) && typeof cells[c.name] === 'string');

  return {
    title: entry.title,
    rank: cr ? `CR ${cr}` : rarity || entry.table.name,
    tier: tierOfRow(columns, cells) ?? 'bone',
    xp: cr ? XP_BY_CR[cr] ?? null : null,
    meta,
    text: clip((described ? String(cells[described.name]) : '') || opening(entry.body)),
    stats,
    abilities,
    art: entry.images.image,
    glyph: glyphFor(entry.table.key, entry.title, labels),
  };
}
