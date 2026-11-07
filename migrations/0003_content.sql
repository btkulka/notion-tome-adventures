-- Reference content moved out of Notion by scripts/notion-import: monsters, magic
-- items, environments, equipment, shops, vessels, loot and random encounter tables.
-- Each row keeps the Notion page object it came from (properties in Notion's public
-- API shape, ids unchanged) and its page content as Notion blocks, so relations
-- between rows, ids saved elsewhere (map settings) and the extractors in
-- worker/notion keep working. worker/content/client.ts queries these tables.
-- Game data the app edits (campaigns, sessions, encounters, locations) joined
-- them in 0006_game_data.sql.

CREATE TABLE content_tables (
  key TEXT PRIMARY KEY,
  notion_database_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  -- The Notion database's property definitions, as JSON.
  schema TEXT NOT NULL,
  imported_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE content_rows (
  -- The Notion page id; relations in other rows point at it.
  id TEXT PRIMARY KEY,
  table_key TEXT NOT NULL REFERENCES content_tables (key) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  -- The Notion page object, as JSON.
  page TEXT NOT NULL,
  -- The page content: Notion blocks, each with its `children`, as JSON.
  body TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX content_rows_table ON content_rows (table_key, title);
