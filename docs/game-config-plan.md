# Reorganizing the imported Notion tables: game config vs content

An analysis of the 48 tables `scripts/notion-import` put into D1 (45 reference tables
plus campaigns, sessions and encounters), taken from `.notion-export/data` on
2026-11-02, and a plan to sort them into **game config** (enumerations and the numbers
attached to them) and **content** (real things the DM browses, links and edits).

## Summary

Only 13 of the 48 tables describe real things. The rest are one of these:

- **Enumerations**, such as challenge ratings, creature types, rarities and shop traits.
  Each is a short fixed ladder. The app's code already depends on them, and several are
  hard-coded in the source as well.
- **Notion workarounds**, mostly the eight "Constants" tables. Notion formulas can only
  reach another table through a relation, so these exist to make that possible. They
  hold no information of their own.
- **Empty or unfinished** tables.

Across the 48 tables there are 68 relation columns. After the reorganization the
reference data keeps only two of them: magic item → base weapon and magic item → base
armor. The other 66 fall into four groups:

- The other side of a two-way link (a SQL link is stored once and queried from either end).
- Formula plumbing that becomes a config lookup.
- Classification links that become plain enum values on the row.
- Game-data links (session → campaign, players, encounters; cargo → ship), which belong
  to the game-data wave in `migrations/0006_game_data.sql`.

## 1. What each table really is

| Notion table(s) | Rows | What it is | Goes to |
|---|---:|---|---|
| Challenge Ratings | 34 | CR ladder with XP | config `challengeRatings` |
| Drop Rates (Loot Metadata) | 33 | per-CR gold dice, magic-item roll window, drop limit | gold dice merged into `challengeRatings`; the roll columns are dropped (decision 2) |
| Monster Types | 28 | 14 core types and 14 subtypes, each with a category and description | config `creatureTypes` |
| Environments | 12 | habitat list (description, climates, terrain) | config `environments` |
| Rarities, Magic Item Rarity ★, Magic Item Rarity (loot copy), Armor, Weapons, Book, Potion, Spell Scroll, Equipment and Vessel Rarities | 10 × 5 | **one** rarity ladder, defined ten times | config `rarities` |
| Shop Traits | 20 | four ladders: attitude, supply and wealth (multipliers) and artisan skill (bonus) | config `shops` |
| Magic Item Drops | 37 | a d100 → rarity table: Arcana theme only, every band "Common" except one row with no band | **delete** (decision 2) |
| Art | 6 | the start of an art-object catalog; 5 of 6 rows have no name yet | stays content, to be filled out (decision 7); its Type list goes to config |
| Equipment, Armor, Book, Magic Item, Potion, Spell Scroll, Weapons and Vessel Constants | 8 × 1 | each row only links to its five rarities so formulas can see them | **delete** |
| Loot Drops, Random Encounters | 0 | empty; Loot Drops links to the retired Magic Items database | **delete** |
| Libraries | 1 | one empty row linking a character to books | **delete** (rebuild with characters if ever wanted) |
| Monster Stats | 472 | ability scores, 1:1 with monsters | **fold into Monsters** as an Abilities sub-table |
| Arctic, Swamp, Urban, Space and Roleplay encounter tables | 121 | five d20 roll tables, four sharing one schema | **merge** into one Encounter Tables content table |
| Cargo Types | 10 | ship goods: Ballista, Ballista Bolt, Mangonel, Mangonel Stone, Giant Cannon, Giant Cannonball, Servant, Specialized Crew, PC Crew, Husbandry | becomes **Cargo**, a purchasable item table like Equipment (decision 8) |
| Cargo | 24 | each ship's hold, e.g. "Oakenfist Ballista Bolts ×21"; each row links to a Sovereign Ship, which wasn't imported | ship inventory (item × quantity) in game data, with Ships |
| Monsters, Magic Items 2025, Armor, Weapons, Equipment, Spell Scrolls, Books, Shops, Vessels, Art | — | real entities | stay content |
| Campaigns, Sessions, Encounters | — | owned game data (0006) | unchanged here |

## 2. The 68 relation columns

| Kind | Columns | After |
|---|---|---|
| Reverse side of a two-way link | Challenge Ratings.Monsters, Environments.Monsters, Monster Types.Monsters, Monster Stats.Monster, every *X Rarities.X* back-link (Armor, Weapons, Books, Spell Scrolls, Equipment, Vessels, Magic Items), Campaigns.Sessions, Encounters.Sessions, Environments.Locations | gone; query the forward side |
| Formula plumbing | the eight Constants → Rarities links; every typed rarity → Rarities (to roll up Roll Limit); Shops."Shop Needs Pool" (the wealth ladder, so `Income Need` could index it); Spell Scrolls/Books/Weapons rollups of Base Value and multiplier | gone; config lookup |
| Classification links | Monsters → Challenge Rating, Monster Type, Monster Subtype (multi-select in Notion, never more than one), Environments (up to 6); each item table → Rarity; Shops → Attitude, Supply, Artisan Level; Magic Item Drops → Rarities; Cargo → Cargo Type | enum value on the row (single or list) |
| Empty self-links | Armor: Base Armor, Inherited Armor, Related back to Armor; Weapons: Base Weapon, Related back to Weapons (0 rows filled) | dropped |
| Links to databases that weren't imported | Loot Drops → old Magic Items, Libraries → Characters, Encounters → Encounter Generator, Environments → Locations (all empty) | dropped |
| Real links, reference data | Magic Items → Base Weapon (208 rows), Base Armor (158 rows) | **kept** |
| Real links, game data | Sessions → Campaign, Players, Best Combat, Best Roleplay, Encounters; Cargo → Ship | kept, in the game-data wave |

## 3. Problems the analysis turned up

1. **Computed values are frozen.** Formula and rollup columns (every Value, Base Value,
   Roll Limit and Rarity Multiplier, the Tags formulas, shop Balance, Income and Value
   Multiplier, cargo totals) hold whatever Notion computed at export time. If the DM
   overrides a rarity's multiplier in the database browser, no item's Value changes.
   Moving the numbers into config only works if these values are computed in code.
2. **The code already hard-codes this config, and it doesn't match Notion:**
   - `XP_BY_CR` exists twice, in `worker/notion/extractors.ts` and
     `src/features/database/cards.ts`. Both say CR 0 = 10 XP; Notion says 0.
   - `GOLD_BY_CR` in `src/lib/coin-rolls.ts`, which the Treasure page uses, is a different
     curve from Notion's Drop Rates: CR 1 is 3d4 vs 3d8, CR 4 is 4d20 vs 7d20, and CR 30
     is 190000d20 (about 2M gp) vs 100d1000 (about 50k gp).
   - `getItemWeight` in `src/lib/treasure-generator.ts` uses 10× steps (1, 0.1, 0.01…),
     while Notion's Roll Limits are d100 bands (0, 0.7, 0.945, 0.972, 0.99).
   - Rarity order and tier colours are spelled out again in `src/features/tools/treasure.ts`
     and `src/features/database/PropertyEditor.tsx`.
3. **The ten rarity tables agree with each other.** Where they overlap, the ★ Magic Item
   Rarity row matches the loot copies: weapon and armor multipliers, potion, magic item
   and book base values. Spell scroll base values and Roll Limit exist only in the loot
   tables. Equipment and vessel rarities carry no numbers at all.
4. **138 of the 1,208 magic items have no rarity.** The code handles an "Artifact" rarity,
   but Notion has none. Six of the unrated items are canonical artifacts: Wand of Orcus,
   Sword of Kas, Eye of Vecna, Demonomicon of Iggwilv, Book of Vile Darkness and Book of
   Exalted Deeds. Axe of the Dwarvish Lords is the only item tagged "Artifact", and it is
   rated Legendary.
5. **Monster Stats is messy.** 315 rows are linked to monsters. Of the 157 unlinked rows,
   141 duplicate a monster's existing stats. The other 16 are two copies each for 8
   monsters with no linked stats (Lemure, Lacedon Ghoul, Kuo-toa and its Whip, Monitor
   and Archpriest, Young Copper Dragon, Young Bronze Dragon), and each pair agrees. Four
   duplicates disagree with the linked copy (Fiend Cultist CON, Bullywug Bog Sage DEX,
   Aberrant Cultist CON, and a blank Berserker). 84 monsters have no stats at all.
6. **Redundant columns.** Monsters."Monster Tags" repeats the CR, type, size and alignment
   as tags. Magic Items.Tags repeats the rarity, theme and base weapon or armor names.
   "Treasure Type 1" and Magic Items."Class Restriction" are empty.
7. **The same vocabulary is spelled differently in different tables.** Size, Alignment and
   Source each have their own option list per table. Source is "Dungeon Master's Guide
   (5e)" in Armor but "Dungeon Master's Guide" in Weapons.

## 4. Target shape

### Game config

- **Where it lives:** a typed module both the Worker and the app import
  (`shared/game-config/`, added to both tsconfigs). It holds every enumeration's ids and
  order, plus default labels, descriptions and numbers. The defaults are seeded from Ben's
  Notion values, not the SRD, because Notion holds his tuned economy.
- **How the DM edits it, in two layers.** Global settings are the default, and each
  campaign can override them. Edits go in a new D1 table:

  ```sql
  game_settings (scope TEXT, section TEXT, value TEXT, updated_by TEXT, updated_at INTEGER,
                 PRIMARY KEY (scope, section))
  ```

  - `scope` is `'global'` or a campaign id. It is a string rather than NULL, because NULLs
    don't keep a SQLite primary key unique.
  - `value` is a sparse JSON patch holding only the values that were changed, so one
    campaign tweaking one rarity's price doesn't freeze the rest of the section.
  - Values are merged in the order code defaults ← global ← campaign.
- **The Game settings page** in the DM suite has a Global view and a view for the selected
  campaign. There is one tab per section, with ladders shown as editable grids. Each value
  shows where it comes from (default, global or campaign) and has a reset that removes
  just that layer's edit, the same pattern as content overrides.
- **Ids are fixed in code; numbers are editable.** Code branches on the ids (XP budgets,
  loot rolls, tier colours), so the UI never renames or deletes an id. The attached
  numbers are homebrew tuning and are always editable. Open lists (creature subtypes,
  environments, sources) also let the DM add entries; an entry can't be removed while
  rows use it. New entries can only be added globally, because the monsters and items
  that use them are shared by every campaign. A campaign overrides numbers and labels,
  not the lists themselves.
- **Reads take a campaign.** Config is read with an optional campaign id. The encounter
  generator, treasure rolls and travel use the campaign they run in. The database browser
  calculates values like item prices for the campaign selected in the suite
  (`useSelectedCampaign`), or from the global settings when no campaign is selected.

Sections:

| Section | Entries | Per entry |
|---|---|---|
| `rarities` | common, uncommon, rare, very_rare, legendary, artifact | label, tier colour, loot weight (the code's 10× steps), base price for magic item / potion / spell scroll / book, weapon and armor multipliers. Artifact is marked `special`: it has no ladder price, so each artifact carries its own value |
| `challengeRatings` | 0, 1/8, 1/4, 1/2, 1–30 | numeric value, XP, gold dice (count × sides, from Drop Rates), note |
| `creatureTypes` | 14 core types + subtypes | name, category (core / subtype / special), description |
| `environments` | 12 | name, description, climates, terrain features |
| `shops` | attitude, supply and wealth ladders (5 each), artisan skill (5) | multiplier or bonus; the income rule now in the `Latest Income` formula |
| `loot` | drop chance (1 in 4 today), treasure types, item themes | — |
| `vocabularies` | sizes, alignments, sources, character classes, abilities and skills, weapon class and range, armor class, shop types, cargo kinds, art object types | label (and order) |

### Content

The entity tables stay in `content_rows`. Each classification relation becomes a
`select` or `multi_select` property whose options come from config **when the table is
read**, so a subtype added in Game settings shows up everywhere straight away. The value
stores the config id, and the label is filled in on read. Computed values come from a new
`worker/content/derived.ts` and appear read-only in the editor, marked "from Game
settings".

| Table | Enum columns (were relations or loose selects) | Computed on read | Dropped |
|---|---|---|---|
| Monsters | CR, type, subtype, environments[], size, alignment, treasure types[] | XP | Monster Stats link, Monster Tags, Treasure Type 1 |
| Monsters → **Abilities** sub-table | — | modifiers | the Monster Stats table |
| Magic Items | rarity, themes[], source | Value, tags | Tags multi-select, Class Restriction |
| Armor, Weapons | rarity, class, range (weapons), source | Value | empty self-links, rarity rollups |
| Equipment | rarity, source, class restriction[] | — | — |
| Spell Scrolls, Books | rarity (books: comprehension skill) | Base Value, Value | rollups |
| Vessels | rarity, size, kind[] | tags | — |
| Shops | shop type, attitude, supply, artisan | multipliers, balance, income need | Shop Needs Pool |
| Cargo (was Cargo Types) | cargo kind[] (weaponry, ammunition, crew, husbandry) | monthly upkeep | — |
| Art | art object type[] | — | — |
| Encounter Tables (new, from 5) | table (arctic / swamp / urban / space / roleplay), type, NPC attitude, difficulty | — | — |

**Monster Abilities.** STR, DEX, CON, INT, WIS and CHA move onto the monster as a grouped
sub-table, shown as a stat block in the entry view. `statsLinkOf` in `cards.ts` and the
second lookup it costs go away. The merge copies the 315 linked rows, fills the 8 monsters
above from their unlinked copies, and keeps the linked copy wherever the 4 duplicates
disagree. The 84 monsters with no stats stay blank to fill in. AC, HP and speed can join
the same group later.

**Why keep the Notion-shaped store.** The database browser, the editor, overrides,
`ContentClient` and the extractors all read Notion page shape, and 0006 just built game
data on top of it. Turning relations into config-backed selects gets the reorganization
done without rewriting all of that. Proper per-entity SQL tables remain a later step for
the in-app editors, and this plan makes that easier: enum columns become plain ids, so
they map straight onto `TEXT` columns.

## 5. Steps

Each step ships on its own.

1. **Decisions.** Settled on 2026-11-02 (section 6), apart from the few still open.
2. **Game config, read-only.** Add the `shared/game-config/` module. A one-off script
   reads `.notion-export/data` and writes the defaults file, which is then committed and
   owned by the code. Notion stops being the source for config, and the import no longer
   brings these tables in. Then replace the hard-coded tables:
   - both `XP_BY_CR` copies and `CR_VALUES`;
   - `GOLD_BY_CR`, now using the Drop Rates dice;
   - the weights in `getItemWeight`, carried over as they are plus `artifact`;
   - `TREASURE_DROP_CHANCE`, `RARITY_TIER` and the PropertyEditor ladder.

   Unit tests pin the defaults to the export's numbers. One behaviour change: the
   Treasure page's coin rolls switch to the Drop Rates curve.
3. **Editable settings, two layers.** Add the `game_settings` migration (0007) with
   `scope`. Add Worker routes behind `currentDm`:
   - `GET /game-settings?campaign=` returns the merged values with each value's source;
   - `PUT` and `DELETE /game-settings/:scope/:section` change one layer.

   Then build the Game settings page with its Global and campaign views.
4. **Import transform.** In `scripts/notion-import/to-sql.ts`:
   - turn classification relations into enum selects using the config ids;
   - fold Monster Stats into Monsters;
   - merge the five encounter tables;
   - drop the dead columns and tables;
   - stop writing formula and rollup values;
   - keep `cleanup.ts`'s magic item fixes (decision 6), moving its rarity links onto the
     enum.

   Re-import the reference tables locally, check, then remote. Owned tables are untouched.
5. **Carry existing edits across**, in the same deploy as step 4. A one-off script, with
   a dry run shown first:
   - Content overrides on rows of deleted tables (for example a rarity multiplier) become
     global `game_settings` values.
   - Overrides on converted relation properties are rewritten to the new select value.
   - In `maps.settings`, each map's `biomeEnvironments` is rewritten from Notion page ids
     to config environment ids.
6. **Derived values.** Add `worker/content/derived.ts`: Value for items, shop
   multipliers, balance and income, and XP for monsters. The editor shows these read-only.
7. **Simplify the readers.** `extractors.ts`, `fetch-creatures`, `generate-encounter` and
   `fetch-magic-items` read enum values instead of resolving relations, which removes
   most of the relation round trips in the encounter generator. `MapSettingsPanel` lists
   environments from config instead of `fetch-environments`. Update `browse.ts` groups,
   `glyphs.ts`, `scripts/notion-import/tables.ts` and `docs/notion-inventory.md`.

## 6. Decisions and open questions

Decided by Ben on 2026-11-02:

1. **Gold by CR uses Notion's Drop Rates**, baked into the config defaults.
   `GOLD_BY_CR` in `coin-rolls.ts` is retired. Drop Rates has no CR 0 row, so CR 0 drops
   no gold, the same as CR 1/8.
2. **Item rarity odds use the code's 10× weights** (`getItemWeight`) and its 1-in-4
   drop chance. *What follows from that:* Notion's own odds mechanism isn't carried into
   config. That means the rarity Roll Limits, Drop Rates' Min. Roll, Max Roll and Drop
   Limit columns, and the Magic Item Drops table. The numbers stay in
   `.notion-export/data` if they're ever wanted.
3. **Settings have two layers:** global is the default, and each campaign can override
   it (section 4).
4. **Artifact is a rarity of its own**, above Legendary, for special items. It has no
   ladder price and keeps the code's weight. It is assigned as in step 4.

5. **CR 0 gives no XP** (0, as in Notion). Both `XP_BY_CR` copies say 10 and are
   replaced in step 2.
6. **Unrated magic items:** look each one up and assign its rarity. Done on 2026-11-02 in
   `scripts/notion-import/magic-item-rarities.ts`, from D&D Beyond's magic item list.
   - 76 items have a rarity, including 9 artifacts. Whelm and Wave became artifacts in
     2024, and Axe of the Dwarvish Lords moves from Legendary to Artifact.
   - 61 items the book gives as "varies" (59 Enspelled items, Wraps of Unarmed Prowess,
     Wand of the War Mage) take their lowest tier, Uncommon. What the rarity depends on is
     kept in a Rarity Varies column for the treasure and shop tools to use.
   - `scripts/notion-import/cleanup.ts` applies all of this on import. It also removes 9
     duplicates (the 2014 copies of Wand of Fireballs, Ruby of the War Mage, Ring of Fire
     Resistance, Portable Hole, Lantern of Revealing, Ioun Stone of Reserve and Handy
     Haversack, plus the catch-all Spell Scroll and Potions of Healing entries) and
     retitles the Horn of Valhalla and Yklwa rows. Applied to local D1 on 2026-11-02:
     1,199 items, none without a rarity. Remote D1 gets it with the next remote import,
     which needs migration 0006 there first.
7. **Art stays** as a content table and gets filled out later.
8. **Cargo is a purchasable item.** Cargo Types becomes the Cargo item table: value,
   weight, supply weight, daily upkeep and kind, bought like Equipment. The per-ship
   Cargo rows become ship inventory (item × quantity) when Sovereign Ships moves to game
   data.
