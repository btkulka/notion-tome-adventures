// Engraved line glyphs for entries without a picture, on a 24-unit grid drawn
// with square caps and mitred joins (the Tome rail style). The beast, undead,
// humanoid, dragon, location and item glyphs come from the Tome card design.

export const GLYPHS: Record<string, string> = {
  // Creatures
  aberration: 'M3 12l5-5h8l5 5-5 5H8z M12 10l2 2-2 2-2-2z M8 7L6 3 M16 7l2-4 M12 7V2',
  beast: 'M7 3c2 4 2 9-1 14 M12 3c2 5 2 11-1 18 M17 3c2 4 2 9-1 14',
  celestial: 'M12 9l3-3-3-3-3 3z M12 9v12 M12 12L4 8v5l8 3 M12 12l8-4v5l-8 3',
  construct: 'M6 6h12v12H6z M10 10h4v4h-4z M12 2v4 M12 18v4 M2 12h4 M18 12h4',
  dragon: 'M3 18c4-1 6-4 7-8 2 3 5 4 9 3-2 3-6 5-11 5z M10 10c0-3 1-5 3-7',
  elemental: 'M12 2l5 7-2 2 3 4-6 7-6-7 3-4-2-2z M12 13l2 3-2 3-2-3z',
  fey: 'M12 6v14 M12 8L5 4v8l7 2 M12 8l7-4v8l-7 2 M12 14l-5 5 M12 14l5 5',
  fiend: 'M5 3l3 7 M19 3l-3 7 M8 10h8l1 5-5 6-5-6z M10 14h.01 M14 14h.01',
  giant: 'M5 21L15 9 M13 7l3-4 5 2-1 5-4 2z M8 18l-3-3',
  humanoid: 'M5 11a7 7 0 0 1 14 0v6l-3 3H8l-3-3z M5 13h14 M12 4v9',
  monstrosity: 'M3 6l9 4 9-4-2 12H5z M7 10l2 4 2-3 2 3 2-4',
  ooze: 'M4 14l4-8h8l4 8-3 6H7z M10 14v3 M14 12v2',
  plant: 'M12 21V8 M12 8L5 3v6l7 4 M12 12l7-5v6l-7 4',
  undead: 'M12 3a8 8 0 0 0-8 8c0 3 1.5 5 3.5 6v3h9v-3c2-1 3.5-3 3.5-6a8 8 0 0 0-8-8z M9 12h.01 M15 12h.01',

  // Items
  ammunition: 'M5 19L19 5 M19 5h-6 M19 5v6 M5 19v-4 M5 19h4 M9 19l-2 2 M5 15l-2 2',
  amulet: 'M6 3l6 8 6-8 M12 11l4 5-4 5-4-5z',
  armor: 'M7 3l5 2 5-2 3 4-2 3v11H6V10L4 7z M12 5v16',
  art: 'M3 4h18v16H3z M3 16l5-6 4 4 3-3 6 5 M15 8h.01',
  book: 'M4 4h7l1 2 1-2h7v15h-7l-1 2-1-2H4z M12 6v15',
  coins: 'M8 3l4 4-4 4-4-4z M16 9l4 4-4 4-4-4z M8 13l4 4-4 4-4-4z',
  gem: 'M6 3h12l3 6-9 12L3 9z M3 9h18 M9 3l3 18 M15 3l-3 18',
  pack: 'M7 7h10l2 3v11H5V10z M9 7V4h6v3 M5 14h14 M10 14v3h4v-3',
  potion: 'M10 3h4 M10 3v6l-5 8v4h14v-4l-5-8V3 M7 15h10',
  ring: 'M9 9h6l3 3v4l-3 3H9l-3-3v-4z M10 4h4l2 2-4 3-4-3z',
  rod: 'M6 20L16 10 M16 10l-2-2 4-5 3 3-5 4z M9 17l-2-2',
  scroll: 'M6 4h13v13l-3 3H5V7z M6 4L4 7h4 M9 9h7 M9 12h7 M9 15h4',
  shield: 'M4 4h16v8l-8 9-8-9z M12 4v17',
  staff: 'M7 21l9-13 M16 8l-1-4 3-1 3 3-1 3z M10 16l-2-1',
  wand: 'M5 19L15 9 M17 3v3 M17 10v3 M12 7h3 M19 7h3',
  weapon: 'M20 4L9 15 M20 4h-5 M20 4v5 M7 13l4 4 M8 16l-4 4',

  // Places
  arctic: 'M12 2v20 M3 7l18 10 M21 7L3 17 M9 3l3 3 3-3 M9 21l3-3 3 3',
  cave: 'M2 20L7 6l5-3 5 3 5 14z M9 20v-5l3-3 3 3v5',
  desert: 'M12 3v2 M4 9l2 1 M20 9l-2 1 M7 13a5 5 0 0 1 10 0 M2 17h20 M5 21h14',
  forest: 'M12 2l6 8h-3l5 7H4l5-7H6z M12 17v5',
  hills: 'M2 18l5-6 5 6 4-4 6 4 M2 21h20',
  mountain: 'M2 20L9 7l4 6 3-4 6 11z M9 7l2 4',
  swamp: 'M3 18h18 M5 21h14 M8 18V8 M8 8L6 5 M12 18V5 M16 18v-8 M16 10l2-3',
  tower: 'M7 21V8l2-2V3h2v2h2V3h2v3l2 2v13z M10 21v-4h4v4 M10 11h4',
  waves: 'M2 8l5-3 5 3 5-3 5 3 M2 14l5-3 5 3 5-3 5 3 M2 20l5-3 5 3 5-3 5 3',

  // Everything else
  cargo: 'M4 7l8-4 8 4v10l-8 4-8-4z M4 7l8 4 8-4 M12 11v10',
  dice: 'M12 2l9 5v10l-9 5-9-5V7z M12 2L7 11h10z M7 11l-4 6 M17 11l4 6 M7 11l5 11 5-11',
  rank: 'M12 2l10 10-10 10L2 12z M12 7l5 5-5 5-5-5z',
  ship: 'M3 16h18l-3 5H6z M12 3v13 M12 4l7 10h-7 M12 6l-5 8h5',
  shop: 'M3 9l2-5h14l2 5z M3 9v2l3 2 3-2 3 2 3-2 3 2 3-2V9 M5 13v8h14v-8 M10 21v-5h4v5',
  diamond: 'M12 3l9 9-9 9-9-9z M12 8l4 4-4 4-4-4z',
};

type Rule = [RegExp, string];

const CREATURES: Rule[] = [
  [/\b(aberration|beholder)/, 'aberration'],
  [/\b(dragon|chromatic|metallic|wyrm|drake)/, 'dragon'],
  [/\b(undead|skeleton|zombie|lich|vampire|ghost|ghoul|wraith|wight|mummy)/, 'undead'],
  [/\b(fiend|devil|demon|yugoloth|imp\b)/, 'fiend'],
  [/\b(celestial|angel)/, 'celestial'],
  [/\b(construct|golem|animated)/, 'construct'],
  [/\b(elemental|genie|mephit)/, 'elemental'],
  [/\bfey\b|\b(dryad|sprite|pixie|hag)\b/, 'fey'],
  [/\b(giant|titan|ogre|troll)/, 'giant'],
  [/\bmonstrosit/, 'monstrosity'],
  [/\b(ooze|slime|pudding|jelly|cube)\b/, 'ooze'],
  [/\b(plant|blight|shambling|myconid)/, 'plant'],
  [/\b(beast|lycanthrope|wolf|bear|cat|crab|spider|snake|hawk|boar)/, 'beast'],
  [/\b(humanoid|goblinoid|goblin|kobold|gith|wizard|cleric|cultist|bandit|guard|knight|mage)/, 'humanoid'],
];

const ITEMS: Rule[] = [
  [/\b(potion|elixir|philter|oil)\b/, 'potion'],
  [/\bscroll/, 'scroll'],
  [/\bring\b/, 'ring'],
  [/\bwand\b/, 'wand'],
  [/\bstaff\b/, 'staff'],
  [/\brod\b/, 'rod'],
  [/\bshield\b/, 'shield'],
  [/\b(armou?r|plate|mail|breastplate)\b/, 'armor'],
  [/\b(ammunition|arrows?|bolts?)\b/, 'ammunition'],
  [/\b(weapon|sword|axe|bow|dagger|mace|hammer|spear|blade|scimitar|rapier|halberd|glaive|trident|whip)/, 'weapon'],
  [/\b(amulet|necklace|periapt|medallion|talisman|brooch)/, 'amulet'],
  [/\b(book|tome|manual|libram|grimoire)/, 'book'],
  [/\b(painting|portrait|sculpture|statue|tapestry)\b/, 'art'],
];

const PLACES: Rule[] = [
  [/\b(arctic|tundra|ice|snow|frost)/, 'arctic'],
  [/\bdesert|dune/, 'desert'],
  [/\b(forest|wood|jungle)/, 'forest'],
  [/\b(swamp|marsh|bog|fen)/, 'swamp'],
  [/\b(coast|underwater|sea|ocean|river|lake)/, 'waves'],
  [/\b(underdark|cave|cavern|dungeon)/, 'cave'],
  [/\b(urban|city|town|village)/, 'tower'],
  [/\b(hill|grassland|plain|meadow)/, 'hills'],
  [/\bmountain|peak/, 'mountain'],
];

/** The glyph a table's rows fall back to, and which kind of name to read first. */
const TABLES: Record<string, { glyph: string; read: Rule[][] }> = {
  monsters: { glyph: 'beast', read: [CREATURES, ITEMS, PLACES] },
  monster_stats: { glyph: 'beast', read: [CREATURES] },
  monster_types: { glyph: 'beast', read: [CREATURES] },
  challenge_ratings: { glyph: 'rank', read: [] },
  environments: { glyph: 'mountain', read: [PLACES] },
  magic_items: { glyph: 'gem', read: [ITEMS] },
  magic_item_rarities: { glyph: 'gem', read: [] },
  magic_item_drops: { glyph: 'coins', read: [ITEMS] },
  spell_scrolls: { glyph: 'scroll', read: [] },
  books: { glyph: 'book', read: [] },
  art: { glyph: 'art', read: [] },
  armor: { glyph: 'armor', read: [ITEMS] },
  weapons: { glyph: 'weapon', read: [ITEMS] },
  equipment: { glyph: 'pack', read: [ITEMS] },
  equipment_constants: { glyph: 'pack', read: [] },
  equipment_rarities: { glyph: 'gem', read: [] },
  shops: { glyph: 'shop', read: [] },
  shop_traits: { glyph: 'shop', read: [] },
  vessels: { glyph: 'ship', read: [] },
  vessel_constants: { glyph: 'ship', read: [] },
  vessel_rarities: { glyph: 'ship', read: [] },
  cargo: { glyph: 'cargo', read: [ITEMS] },
  cargo_types: { glyph: 'cargo', read: [] },
};

function tableOf(key: string): { glyph: string; read: Rule[][] } {
  if (TABLES[key]) return TABLES[key];
  if (key.startsWith('loot_')) return { glyph: 'coins', read: [ITEMS] };
  if (key.startsWith('random_encounters')) return { glyph: 'dice', read: [CREATURES, PLACES] };
  return { glyph: 'diamond', read: [ITEMS, CREATURES, PLACES] };
}

/** The glyph for an entry: its type labels first, then its name, then its table's. */
export function glyphFor(table: string, title: string, labels: string[] = []): string {
  const { glyph, read } = tableOf(table);
  for (const text of [labels.join(' '), title]) {
    const words = text.toLowerCase();
    for (const rules of read) {
      const hit = rules.find(([pattern]) => pattern.test(words));
      if (hit) return hit[1];
    }
  }
  return glyph;
}
