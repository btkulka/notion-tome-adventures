-- Player characters, kept here instead of a Notion database so players can add
-- and edit their own (worker/api/characters.ts checks who may). A character
-- belongs to one campaign and to the player who plays it; the DM can add one for
-- someone who hasn't joined yet (owner_id NULL) for that player to claim later.
-- Sheets stay on D&D Beyond: ddb_id links one, and a sync copies its name, race,
-- class, level, portrait and darkvision into these columns.

CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  owner_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  race TEXT NOT NULL DEFAULT '',
  -- "Fighter", or "Fighter 3 / Rogue 2" for a multiclass.
  class_name TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 20),
  portrait_url TEXT,
  darkvision INTEGER NOT NULL DEFAULT 0 CHECK (darkvision >= 0),
  light_source TEXT NOT NULL DEFAULT 'None',
  -- In the party: active characters set the encounter XP budget.
  active INTEGER NOT NULL DEFAULT 1,
  ddb_id TEXT,
  ddb_synced_at INTEGER,
  created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX characters_campaign ON characters (campaign_id, name);
CREATE INDEX characters_owner ON characters (owner_id);
-- One D&D Beyond sheet is one character per campaign.
CREATE UNIQUE INDEX characters_ddb ON characters (campaign_id, ddb_id) WHERE ddb_id IS NOT NULL;

-- The character a member plays right now. It held a Notion page id; nothing was
-- ever stored in it, and it now points at characters.id.
ALTER TABLE campaign_members RENAME COLUMN character_notion_id TO character_id;
