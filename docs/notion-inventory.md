# Notion inventory (for the SQLite migration)

Every database under the D&D teamspace in Ben's personal Notion (btkulka@gmail.com),
taken 2026-11-02. IDs are the database IDs the public API (2022-06-28) takes.
Rows are Notion's own counts. ★ marks the eight the Worker read from Notion.

All of it is in D1 now, copied by `scripts/notion-import/` (list in `tables.ts`, keyed by
name), and the Worker no longer calls Notion. The Tables section is reference data the app
reads, with the DM's edits kept as overrides; the older Magic Items database, which Magic
Items 2025 replaced, came along as `magic_items_legacy`. Game Data (Monster Instances
included) and Dungeon Master are owned by D1: the app edits them there, and a re-import
writes them only when named. The pages outside any database, the five top-level pages
below and everything under them, are the `pages` table, with their content. Only the empty
untitled database under To Review was left behind.

81 databases, 4,446 rows as the public API returns them: the 74 below, plus seven this
inventory first missed (end of the page). The five big ones (Magic Items 2025, Magic
Items, Monster Stats, Monsters, Books) hold over half of them.

## Tables (reference data the app only reads)

| Database | ID | Rows | Cols |
|---|---|---:|---:|
| ★ Monsters | 9af45a5a-517d-4e4e-85e6-c35dab99cc5f | 407 | 16 |
| Monster Stats | 3943c6e5-2506-4ab7-aba4-e65f12381c3e | 472 | 8 |
| Challenge Ratings | 7aaffcbc-b470-45f7-9257-0857aab93bb2 | 34 | 3 |
| ★ Monster Types | f6d304ab-28c2-482e-95e6-ad097a3e5e4e | 28 | 4 |
| Monster Instances | 264151b2-7259-80f1-ac3f-fc90c8b3fca3 | 1 | 3 |
| ★ Environments | 1e97c743-a611-4afc-948a-74cddd7b1fd7 | 12 | 6 |
| ★ Magic Items 2025 | 260151b2-7259-805b-ab3e-dc4b88d7e486 | 1208 | 18 |
| Magic Items (older, title column "Magic Item") | df79b05a-8eef-427b-80ac-09d9ee0f8ad4 | 832 | 19 |
| ★ Magic Item Rarity (target of Magic Items 2025 → Rarity) | 260151b2-7259-807f-a382-e3ebf867770c | 5 | 6 |
| Magic Item Drops | 14c151b2-7259-8068-98a0-f9ee63ae154b | 37 | 6 |
| Spell Scrolls | bf33ba36-9461-487e-8ac9-59301ca759cd | 10 | 5 |
| Books | 01eabe7a-3906-4bfa-9a9d-44833e8de9cd | 96 | 12 |
| Armor | b71ad314-df1d-4bfc-8f50-c7b196844a55 | 13 | 13 |
| Weapons | a3728de1-e6d1-4d15-84d8-b63af52f52f2 | 40 | 14 |
| Loot Drops | a1717ca1-95d4-4c86-975f-8256a6e8d8e7 | 0 | 7 |
| Random Encounters | b368ffec-2ced-464e-b760-0c1d2e723544 | 0 | 6 |
| Art (Tables / Art) | 04023a9a-e707-48d8-a6c1-7d7084d9f506 | 6 | 2 |
| Equipment (Tables / Equipment) | 9b82d092-c0d7-4f64-bee2-c8d88937b1c4 | 24 | 10 |
| Equipment Constants | 715465f1-78d7-499c-951e-375092077196 | 1 | 2 |
| Equipment Rarities | c55da8c0-38d8-4a32-a78f-25097cd17467 | 5 | 3 |
| Shops (Tables / Shops) | ffaaf17a-a746-448e-b398-68d84d1df722 | 42 | 20 |
| Shop Traits | ac34f4cd-9adb-4630-a217-a6d812c87b62 | 20 | 5 |
| Vessels (Tables / Vessels) | 64b5d97d-6db0-4ce1-8ed7-061cef1518df | 22 | 9 |
| Cargo | 8ae9d339-0dd8-441b-a5a5-f7f3282f96f1 | 24 | 8 |
| Cargo Types | 96049c2e-1ae3-4dbd-ae58-825f7a8d64b2 | 10 | 7 |
| Vessel Constants | e68c514f-f26a-4e19-ab39-7d9a428136a7 | 1 | 3 |
| Vessel Rarities | 21d0b11d-78a2-4a48-a10a-afe41605b7ee | 5 | 3 |

Random encounter tables (Tables / Encounters Dashboard / Random Encounters):

| Database | ID | Rows | Cols |
|---|---|---:|---:|
| Arctic Encounters - Combat | c02f15f5-53c7-4f28-ae0f-fe8f9d8913e8 | 23 | 6 |
| Roleplay - Generic | 1976492d-ac3c-4f07-8a8a-cb6ab5ee6dbf | 20 | 6 |
| Space - Combat Encounters | 10a151b2-7259-80d0-a6e2-cb759f2d76bf | 23 | 6 |
| Swamp - Combat | 1462ee4d-6c9c-44eb-862a-c347fc438f7d | 23 | 6 |
| Urban Encounters - Combat | 10a151b2-7259-80c6-bd79-ce7194f56cab | 32 | 7 |

Loot pricing (Tables / Loot Metadata), mostly one-row "constants" and five-row rarity ladders:

| Database | ID | Rows | Cols |
|---|---|---:|---:|
| Drop Rates | 1eb6fe3b-2370-4b61-8331-55f9b69f9636 | 33 | 10 |
| Rarities | 419bdb41-8ad8-4a21-b1b3-fb2cdf6be464 | 5 | 2 |
| Armor Constants | 62cff2ff-5867-43ed-8166-6fbabd8c3a74 | 1 | 2 |
| Armor Rarities | bfe4e7bd-77bc-41ca-a29f-212abe4e6952 | 5 | 4 |
| Book Constants | 307f6d4b-9c2a-40bb-b8bc-f9d8f40accbd | 1 | 2 |
| Book Rarities | 9fcc5039-9e55-4535-b376-7bc7358697f8 | 5 | 4 |
| Libraries | 2dde79d6-3967-468d-9d7d-10dddfcca8ea | 1 | 4 |
| Magic Item Constants | 501247a2-b315-4e1e-b63a-d7418ffd97ff | 1 | 2 |
| Magic Item Rarity (loot copy, title "Magic Item Rarity") | da46ddd3-c752-4d76-a496-94ac75476877 | 5 | 5 |
| Potion Constants | f5588bdc-2045-4f3e-a70d-44244efbd129 | 1 | 2 |
| Potion Rarity | 5ffbd809-7376-46a6-95b5-61eb77931059 | 5 | 5 |
| Spell Scroll Constants | 9aeaa0b4-34df-4bac-ba4f-5acaef3b08c8 | 1 | 2 |
| Spell Scroll Rarities | 162dea58-2905-49a5-9a6f-bee43f574124 | 5 | 4 |
| Weapons Constants | f0defe5c-0abe-47db-8070-067efbb2e3c5 | 1 | 2 |
| Weapons Rarities | 151deee4-2787-4ff1-b96f-941dd5447c44 | 5 | 4 |

## Game Data (campaign and journal data the DM edits)

| Database | ID | Rows | Cols |
|---|---|---:|---:|
| ★ Campaigns | 64f4ce8b-a6ce-4c93-a470-5b8f4eaa11c5 | 3 | 5 |
| ★ Sessions (Game Metadata) | fcab715b-a48f-4d9c-beee-ac51e6aa84f3 | 39 | 8 |
| ★ Encounters (Tables / Encounters Dashboard) | 8c1b6f71-0af2-49c0-8b09-de042d1e1714 | 1 | 13 |
| Players | 4d2f9e54-1632-4712-9253-4ff53ae545ae | 9 | 13 |
| Favor | 14c151b2-7259-80dc-a1fe-f36aef39f0ff | 2 | 4 |
| Character Stats (Game Metadata) | ef1c3510-c123-4eae-9641-6fa6283b4c7b | 1 | 3 |
| Combat Accolades (Game Metadata) | 7dcabee4-fec7-405e-9661-c9164700a592 | 9 | 7 |
| Loot Drop Settings (Game Metadata) | 14c151b2-7259-8071-8ff9-f98b8c37c018 | 1 | 6 |
| Journal Entries | a8f09903-926e-46a7-afda-c6d957dc615d | 82 | 12 |
| Characters | bd0373e4-a025-42d9-8b9e-f64d906ba93a | 20 | 10 |
| Character Details | cdde651c-9834-47e2-8614-58b9e0f448b6 | 20 | 7 |
| NPCs | 5bab6924-3137-4d7d-a766-f7805ecacfcd | 24 | 8 |
| NPC Details | fc8705c3-6878-4336-85fe-22ee795c5c9d | 24 | 10 |
| Locations | 134de4a9-b100-4305-a740-34af53288aee | 24 | 10 |
| Location Details | 6667f6fd-aaaf-4860-8100-f2d25fbdb0bd | 25 | 10 |
| Factions | 7ec0a57c-4e21-4a60-8451-270b48c3b6f2 | 8 | 8 |
| Faction Details | 157ab9f6-538a-49c6-b5d9-3b48d1525e69 | 8 | 11 |
| Sovereign Ships | 586855a4-68ae-4aa0-b67a-ac81e2e500d3 | 6 | 16 |
| Ship Details | b6f9e339-0f5e-4dec-981a-80a1b8340764 | 6 | 10 |
| Documents | 144151b2-7259-80ae-afad-c7bb5ffd2f49 | 4 | 6 |

The Journal Data tables come in pairs (NPCs + NPC Details, Locations + Location Details, …).
The suite's own Locations table (never a Notion database; `migrations/0006_game_data.sql` makes it in D1) is
separate from these. Player characters never got a suite database; they live in D1 (`characters`).

## Dungeon Master (DM tooling)

| Database | ID | Rows | Cols |
|---|---|---:|---:|
| Tasks | cfa8169e-c423-4676-a129-09fba406ba96 | 35 | 8 |
| Encounter Generator | 17434334-c8d6-4f1c-8a1f-e5eeb695ff9a | 1 | 15 |
| Encounter Templates | 262151b2-7259-80df-b7c5-cf9486b36a28 | 0 | 12 |
| Book Generator | 175151b2-7259-80dd-bbdb-d3ae97dcddfb | 48 | 10 |
| Combat Drops | c0a8b27b-9389-4828-9bc8-2ca92cc575f5 | 15 | 34 |
| Loot Generator | 1ea55866-231c-48a1-9f9b-1deb8c792522 | 1 | 17 |
| (untitled, under To Review) | 25e151b2-7259-804e-b112-cef89956c195 | 0 | 1 |

Not covered: pages outside the five D&D top-level pages (Dungeon Master, Metagame,
Campaign Dashboard, Game Data, Tables). Metagame and Campaign Dashboard hold only
views of databases listed above.

## Found by the import (missing above)

| Database | ID | Rows | Cols |
|---|---|---:|---:|
| Potions Wares (the Wares page) | 490acea9-adbd-47b2-8355-2430ba07cb1b | 70 | 17 |
| Equipment Wares | 10005286-9b90-4686-86e5-fd73aa015260 | 69 | 17 |
| Weapon Wares | 57177e96-6ff2-46b6-b168-2adbe40bdaa9 | 92 | 18 |
| Magic Item Wares | 062058f0-355c-4f79-ae2b-528080e45ad6 | 95 | 18 |
| Armor Wares | 317407cf-20ad-4b9b-8b0d-035d69838468 | 98 | 19 |
| Vessel Wares | e2fcb72f-fe57-4342-954f-52e34f23e43d | 5 | 17 |
| Encounter Difficulty (Shroud over Starcrown Lodge, DM Notes) | d68f8fc2-735f-43f5-92f6-b26c61e3ad3f | 20 | 7 |

Six more database blocks in Metagame (3), Campaign Dashboard (2) and the Starcrown DM
Notes (1) are linked views: the API offers no data behind them, and they hold no rows of
their own. Documents shows 4 rows in Notion but the API returns 3; the fourth is most
likely a page template, which the API doesn't expose.
