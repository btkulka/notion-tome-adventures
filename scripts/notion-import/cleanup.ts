/**
 * Fixes made to the exported Notion data before to-sql.ts writes it, so they survive a
 * re-import. Notion itself is left as it was. Magic Items 2025 links its rarities by id,
 * so write magic_items and magic_item_rarities together.
 *
 * - Removes duplicate magic items: the 2014 copy of an item the table also has from the
 *   2024 DMG, and entries that stand for a whole family another row or table covers.
 * - Renames items whose titles left out what they are.
 * - Adds the Artifact rarity, which Notion's Magic Item Rarity table didn't have.
 * - Fills in the rarities looked up in magic-item-rarities.ts, and records what a rarity
 *   depends on when the book gives it as "varies" (a new Rarity Varies column).
 */
import { MAGIC_ITEM_RARITIES, type Rarity } from './magic-item-rarities';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

interface Table {
  key: string;
  schema: Record<string, Json>;
  rows: { page: Json; body: Json }[];
}

/** Magic items dropped, by Notion page id. */
const REMOVED: Record<string, string> = {
  '260151b2-7259-813a-890e-e9aa1a10341e': 'Wand of Fireballs (2014)',
  '260151b2-7259-81d1-a001-c14e467ae3a9': 'Ruby of the War Mage (2014)',
  '260151b2-7259-8123-826e-db8a614012dd': 'Ring of Fire Resistance (2014)',
  '260151b2-7259-81fd-9ddc-f5c1b80166d9': 'portable hole (2014)',
  '260151b2-7259-81ad-afd0-efdcc1f35091': 'Lantern of Revealing (2014)',
  '260151b2-7259-8167-8e30-daee72c5d749': 'Ioun Stone of Reserve (2014)',
  '260151b2-7259-81b0-b41d-ee68cec1be89': 'handy haversack (2014)',
  '260151b2-7259-81bc-933c-df9d062eeffb': 'Spell Scroll (the Spell Scrolls table has one per spell level)',
  '260151b2-7259-8121-8837-d8b0ec440b53': 'Potions of Healing (one entry for four potions; the potions have rows of their own)',
};

/** Magic items retitled, by Notion page id. */
const RENAMED: Record<string, string> = {
  '260151b2-7259-8143-abee-ec4f6380b78f': 'Horn of Valhalla (Silver)',
  '260151b2-7259-810c-8235-e1728bb4651f': 'Horn of Valhalla (Brass)',
  '260151b2-7259-81ca-882d-fbf721885d30': 'Horn of Valhalla (Bronze)',
  '260151b2-7259-8154-9333-f6821958fc80': 'Yklwa, +1',
  '260151b2-7259-8108-b8fa-c6db3663a68c': 'Yklwa, +2',
  '260151b2-7259-81dd-804c-ea4c13a164f2': 'Yklwa, +3',
};

/** The Artifact row's id. Fixed, so links to it survive a re-import. */
const ARTIFACT_ID = 'ca229915-55a2-4211-bb0b-00b2d939f2fc';

const RARITY_TITLES: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  very_rare: 'Very Rare',
  legendary: 'Legendary',
  artifact: 'Artifact',
};

const VARIES = 'Rarity Varies';
const VARIES_ID = 'rvar';

const richText = (content: string) => [
  {
    type: 'text',
    text: { content, link: null },
    annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' },
    plain_text: content,
    href: null,
  },
];

const titleOf = (page: Json): string =>
  (Object.values<Json>(page.properties).find((p) => p.type === 'title')?.title ?? []).map((t: Json) => t.plain_text).join('');

function setTitle(page: Json, title: string) {
  const prop = Object.values<Json>(page.properties).find((p) => p.type === 'title');
  prop.title = richText(title);
}

/** The Artifact row, made from the Legendary one with its prices cleared: artifacts are priced one by one. */
function artifactRow(legendary: { page: Json; body: Json }) {
  const page = structuredClone(legendary.page);
  page.id = ARTIFACT_ID;
  page.url = null;
  page.public_url = null;
  for (const prop of Object.values<Json>(page.properties)) if (prop.type === 'number') prop.number = null;
  setTitle(page, RARITY_TITLES.artifact);
  return { page, body: [] };
}

export function clean(tables: Table[]) {
  const items = tables.find((t) => t.key === 'magic_items');
  const rarities = tables.find((t) => t.key === 'magic_item_rarities');
  if (!items || !rarities) return;

  if (!rarities.rows.some((r) => r.page.id === ARTIFACT_ID)) {
    const legendary = rarities.rows.find((r) => titleOf(r.page) === RARITY_TITLES.legendary);
    if (!legendary) throw new Error('Magic Item Rarity has no Legendary row to make Artifact from');
    rarities.rows.push(artifactRow(legendary));
  }
  const rarityIds = new Map(rarities.rows.map((r) => [titleOf(r.page), r.page.id]));

  items.rows = items.rows.filter((r) => !(r.page.id in REMOVED));
  items.schema[VARIES] = {
    id: VARIES_ID,
    name: VARIES,
    description: 'What the rarity depends on when the book gives it as "varies"; Rarity is then the lowest tier.',
    type: 'rich_text',
    rich_text: {},
  };

  for (const { page } of items.rows) {
    if (RENAMED[page.id]) setTitle(page, RENAMED[page.id]);
    const found = MAGIC_ITEM_RARITIES[page.id];
    if (found) {
      const id = rarityIds.get(RARITY_TITLES[found.rarity]);
      if (!id) throw new Error(`Magic Item Rarity has no ${RARITY_TITLES[found.rarity]} row`);
      page.properties.Rarity = { ...page.properties.Rarity, relation: [{ id }], has_more: false };
    }
    page.properties[VARIES] = { id: VARIES_ID, type: 'rich_text', rich_text: found?.varies ? richText(found.varies) : [] };
  }
}
