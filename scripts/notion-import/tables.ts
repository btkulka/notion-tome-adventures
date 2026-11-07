/**
 * The Notion databases moved into D1 (content_tables / content_rows), keyed by the
 * name the Worker uses for them. Ids are Notion database ids; see
 * docs/notion-inventory.md for where each lives, and for the one database left
 * out. The reference data ("Tables") the app only reads; the DM's edits to it are
 * overrides. The `owned` ones are game data and DM tools the app edits in D1:
 * Notion was only their starting point, so to-sql.ts writes them only when named,
 * since a re-import replaces every row. `pages` is not a database but the pages
 * outside any, with their content (export.ts finds them); its id only names the
 * table. Locations never had a Notion database of their own;
 * migrations/0006_game_data.sql makes theirs.
 */
export const TABLES: { key: string; notionId: string; owned?: true; pages?: true }[] = [
  // Monsters
  { key: 'monsters', notionId: '9af45a5a-517d-4e4e-85e6-c35dab99cc5f' },
  { key: 'monster_stats', notionId: '3943c6e5-2506-4ab7-aba4-e65f12381c3e' },
  { key: 'challenge_ratings', notionId: '7aaffcbc-b470-45f7-9257-0857aab93bb2' },
  { key: 'monster_types', notionId: 'f6d304ab-28c2-482e-95e6-ad097a3e5e4e' },
  { key: 'environments', notionId: '1e97c743-a611-4afc-948a-74cddd7b1fd7' },

  // Items
  { key: 'magic_items', notionId: '260151b2-7259-805b-ab3e-dc4b88d7e486' },
  { key: 'magic_item_rarities', notionId: '260151b2-7259-807f-a382-e3ebf867770c' },
  { key: 'magic_item_drops', notionId: '14c151b2-7259-8068-98a0-f9ee63ae154b' },
  { key: 'spell_scrolls', notionId: 'bf33ba36-9461-487e-8ac9-59301ca759cd' },
  { key: 'books', notionId: '01eabe7a-3906-4bfa-9a9d-44833e8de9cd' },
  { key: 'art', notionId: '04023a9a-e707-48d8-a6c1-7d7084d9f506' },
  { key: 'armor', notionId: 'b71ad314-df1d-4bfc-8f50-c7b196844a55' },
  { key: 'weapons', notionId: 'a3728de1-e6d1-4d15-84d8-b63af52f52f2' },
  { key: 'equipment', notionId: '9b82d092-c0d7-4f64-bee2-c8d88937b1c4' },
  { key: 'equipment_constants', notionId: '715465f1-78d7-499c-951e-375092077196' },
  { key: 'equipment_rarities', notionId: 'c55da8c0-38d8-4a32-a78f-25097cd17467' },
  { key: 'loot_drops', notionId: 'a1717ca1-95d4-4c86-975f-8256a6e8d8e7' },

  // Loot pricing (Tables / Loot Metadata)
  { key: 'loot_drop_rates', notionId: '1eb6fe3b-2370-4b61-8331-55f9b69f9636' },
  { key: 'loot_rarities', notionId: '419bdb41-8ad8-4a21-b1b3-fb2cdf6be464' },
  { key: 'loot_armor_constants', notionId: '62cff2ff-5867-43ed-8166-6fbabd8c3a74' },
  { key: 'loot_armor_rarities', notionId: 'bfe4e7bd-77bc-41ca-a29f-212abe4e6952' },
  { key: 'loot_book_constants', notionId: '307f6d4b-9c2a-40bb-b8bc-f9d8f40accbd' },
  { key: 'loot_book_rarities', notionId: '9fcc5039-9e55-4535-b376-7bc7358697f8' },
  { key: 'loot_libraries', notionId: '2dde79d6-3967-468d-9d7d-10dddfcca8ea' },
  { key: 'loot_magic_item_constants', notionId: '501247a2-b315-4e1e-b63a-d7418ffd97ff' },
  { key: 'loot_magic_item_rarities', notionId: 'da46ddd3-c752-4d76-a496-94ac75476877' },
  { key: 'loot_potion_constants', notionId: 'f5588bdc-2045-4f3e-a70d-44244efbd129' },
  { key: 'loot_potion_rarities', notionId: '5ffbd809-7376-46a6-95b5-61eb77931059' },
  { key: 'loot_spell_scroll_constants', notionId: '9aeaa0b4-34df-4bac-ba4f-5acaef3b08c8' },
  { key: 'loot_spell_scroll_rarities', notionId: '162dea58-2905-49a5-9a6f-bee43f574124' },
  { key: 'loot_weapon_constants', notionId: 'f0defe5c-0abe-47db-8070-067efbb2e3c5' },
  { key: 'loot_weapon_rarities', notionId: '151deee4-2787-4ff1-b96f-941dd5447c44' },

  // Shops and vessels
  { key: 'shops', notionId: 'ffaaf17a-a746-448e-b398-68d84d1df722' },
  { key: 'shop_traits', notionId: 'ac34f4cd-9adb-4630-a217-a6d812c87b62' },
  { key: 'vessels', notionId: '64b5d97d-6db0-4ce1-8ed7-061cef1518df' },
  { key: 'vessel_constants', notionId: 'e68c514f-f26a-4e19-ab39-7d9a428136a7' },
  { key: 'vessel_rarities', notionId: '21d0b11d-78a2-4a48-a10a-afe41605b7ee' },
  { key: 'cargo', notionId: '8ae9d339-0dd8-441b-a5a5-f7f3282f96f1' },
  { key: 'cargo_types', notionId: '96049c2e-1ae3-4dbd-ae58-825f7a8d64b2' },

  // Random encounter tables (Tables / Encounters Dashboard / Random Encounters)
  { key: 'random_encounters', notionId: 'b368ffec-2ced-464e-b760-0c1d2e723544' },
  { key: 'random_encounters_arctic', notionId: 'c02f15f5-53c7-4f28-ae0f-fe8f9d8913e8' },
  { key: 'random_encounters_roleplay', notionId: '1976492d-ac3c-4f07-8a8a-cb6ab5ee6dbf' },
  { key: 'random_encounters_space', notionId: '10a151b2-7259-80d0-a6e2-cb759f2d76bf' },
  { key: 'random_encounters_swamp', notionId: '1462ee4d-6c9c-44eb-862a-c347fc438f7d' },
  { key: 'random_encounters_urban', notionId: '10a151b2-7259-80c6-bd79-ce7194f56cab' },

  // Shop stock lists, side by side on the "Wares" page.
  { key: 'potion_wares', notionId: '490acea9-adbd-47b2-8355-2430ba07cb1b' },
  { key: 'equipment_wares', notionId: '10005286-9b90-4686-86e5-fd73aa015260' },
  { key: 'weapon_wares', notionId: '57177e96-6ff2-46b6-b168-2adbe40bdaa9' },
  { key: 'magic_item_wares', notionId: '062058f0-355c-4f79-ae2b-528080e45ad6' },
  { key: 'armor_wares', notionId: '317407cf-20ad-4b9b-8b0d-035d69838468' },
  { key: 'vessel_wares', notionId: 'e2fcb72f-fe57-4342-954f-52e34f23e43d' },

  // The older magic items list, which "Magic Items 2025" replaced; kept so nothing lives only in Notion.
  { key: 'magic_items_legacy', notionId: 'df79b05a-8eef-427b-80ac-09d9ee0f8ad4' },

  // Game data (Game Data, and Tables / Encounters Dashboard for encounters)
  { key: 'campaigns', notionId: '64f4ce8b-a6ce-4c93-a470-5b8f4eaa11c5', owned: true },
  { key: 'sessions', notionId: 'fcab715b-a48f-4d9c-beee-ac51e6aa84f3', owned: true },
  { key: 'encounters', notionId: '8c1b6f71-0af2-49c0-8b09-de042d1e1714', owned: true },
  { key: 'monster_instances', notionId: '264151b2-7259-80f1-ac3f-fc90c8b3fca3', owned: true },
  { key: 'players', notionId: '4d2f9e54-1632-4712-9253-4ff53ae545ae', owned: true },
  { key: 'favor', notionId: '14c151b2-7259-80dc-a1fe-f36aef39f0ff', owned: true },
  { key: 'character_stats', notionId: 'ef1c3510-c123-4eae-9641-6fa6283b4c7b', owned: true },
  { key: 'combat_accolades', notionId: '7dcabee4-fec7-405e-9661-c9164700a592', owned: true },
  { key: 'loot_drop_settings', notionId: '14c151b2-7259-8071-8ff9-f98b8c37c018', owned: true },

  // Journal (Game Data / Journal Data); `locations` and `characters` are taken by the suite's own.
  { key: 'journal_entries', notionId: 'a8f09903-926e-46a7-afda-c6d957dc615d', owned: true },
  { key: 'journal_characters', notionId: 'bd0373e4-a025-42d9-8b9e-f64d906ba93a', owned: true },
  { key: 'character_details', notionId: 'cdde651c-9834-47e2-8614-58b9e0f448b6', owned: true },
  { key: 'npcs', notionId: '5bab6924-3137-4d7d-a766-f7805ecacfcd', owned: true },
  { key: 'npc_details', notionId: 'fc8705c3-6878-4336-85fe-22ee795c5c9d', owned: true },
  { key: 'journal_locations', notionId: '134de4a9-b100-4305-a740-34af53288aee', owned: true },
  { key: 'location_details', notionId: '6667f6fd-aaaf-4860-8100-f2d25fbdb0bd', owned: true },
  { key: 'factions', notionId: '7ec0a57c-4e21-4a60-8451-270b48c3b6f2', owned: true },
  { key: 'faction_details', notionId: '157ab9f6-538a-49c6-b5d9-3b48d1525e69', owned: true },
  { key: 'ships', notionId: '586855a4-68ae-4aa0-b67a-ac81e2e500d3', owned: true },
  { key: 'ship_details', notionId: 'b6f9e339-0f5e-4dec-981a-80a1b8340764', owned: true },
  { key: 'documents', notionId: '144151b2-7259-80ae-afad-c7bb5ffd2f49', owned: true },

  // Dungeon Master tools
  { key: 'dm_tasks', notionId: 'cfa8169e-c423-4676-a129-09fba406ba96', owned: true },
  { key: 'encounter_generator', notionId: '17434334-c8d6-4f1c-8a1f-e5eeb695ff9a', owned: true },
  { key: 'encounter_templates', notionId: '262151b2-7259-80df-b7c5-cf9486b36a28', owned: true },
  { key: 'book_generator', notionId: '175151b2-7259-80dd-bbdb-d3ae97dcddfb', owned: true },
  { key: 'combat_drops', notionId: 'c0a8b27b-9389-4828-9bc8-2ca92cc575f5', owned: true },
  { key: 'loot_generator', notionId: '1ea55866-231c-48a1-9f9b-1deb8c792522', owned: true },
  // In the "Shroud over Starcrown Lodge (DM Notes)" page.
  { key: 'encounter_difficulty', notionId: 'd68f8fc2-735f-43f5-92f6-b26c61e3ad3f', owned: true },

  // Pages outside any database: the five top-level D&D pages and everything under them.
  { key: 'pages', notionId: '4b736b57-8735-4693-94fb-5c6669123a00', owned: true, pages: true },
];

export const EXPORT_DIR = '.notion-export';
