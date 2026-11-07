-- Game data moves into the content store (0003_content.sql). Campaigns, sessions
-- and saved encounters are imported from Notion by scripts/notion-import like the
-- reference tables, but from then on the app edits them here (worker/content/
-- client.ts, pages.create and pages.update), so they are `owned`: written in
-- place, and left alone by a plain re-import. Reference tables stay read-only, with
-- the DM's edits kept apart as overrides (0004_content_overrides.sql).

ALTER TABLE content_tables ADD COLUMN owned INTEGER NOT NULL DEFAULT 0;

-- Locations, which map pins link to, never had a Notion database of their own
-- (setup-suite-notion was to make one). This is the one it would have made. No
-- Notion database stands behind the id; it only names the table to the
-- Notion-shaped API (databases.retrieve, relation targets). Campaign points at the
-- imported Campaigns table by its Notion id.
INSERT INTO content_tables (key, notion_database_id, name, schema, owned) VALUES (
  'locations',
  'cbb6257e-d37d-4ae7-a291-6f4203eed949',
  'Locations',
  json('{
    "Name": { "id": "title", "name": "Name", "type": "title", "title": {} },
    "Type": { "id": "type", "name": "Type", "type": "select", "select": { "options": [
      { "id": "region", "name": "Region", "color": "default" },
      { "id": "village", "name": "Village", "color": "default" },
      { "id": "town", "name": "Town", "color": "default" },
      { "id": "city", "name": "City", "color": "default" },
      { "id": "castle", "name": "Castle", "color": "default" },
      { "id": "ruin", "name": "Ruin", "color": "default" },
      { "id": "dungeon", "name": "Dungeon", "color": "default" },
      { "id": "cave", "name": "Cave", "color": "default" },
      { "id": "tower", "name": "Tower", "color": "default" },
      { "id": "shrine", "name": "Shrine", "color": "default" },
      { "id": "camp", "name": "Camp", "color": "default" },
      { "id": "landmark", "name": "Landmark", "color": "default" }
    ] } },
    "Campaign": { "id": "campaign", "name": "Campaign", "type": "relation", "relation": {
      "database_id": "64f4ce8b-a6ce-4c93-a470-5b8f4eaa11c5", "type": "single_property", "single_property": {} } },
    "Parent Location": { "id": "parent", "name": "Parent Location", "type": "relation", "relation": {
      "database_id": "cbb6257e-d37d-4ae7-a291-6f4203eed949", "type": "single_property", "single_property": {} } },
    "Player Description": { "id": "player", "name": "Player Description", "type": "rich_text", "rich_text": {} },
    "DM Notes": { "id": "dmnotes", "name": "DM Notes", "type": "rich_text", "rich_text": {} },
    "Image": { "id": "image", "name": "Image", "type": "files", "files": {} },
    "Map ID": { "id": "mapid", "name": "Map ID", "type": "rich_text", "rich_text": {} }
  }'),
  1
) ON CONFLICT (key) DO NOTHING;
