-- The table jukebox's library and saved scenes (worker/api/sounds.ts). What is
-- playing right now isn't here: the campaign's TableRoom Durable Object keeps
-- that in its own storage (worker/table.ts).

-- A campaign's sounds: YouTube videos, and audio files the DM uploaded, whose
-- bytes live in R2 under file_key.
CREATE TABLE sounds (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('music', 'ambience', 'effect')),
  source TEXT NOT NULL CHECK (source IN ('file', 'youtube')),
  file_key TEXT,
  mime TEXT,
  size INTEGER,
  youtube_id TEXT,
  start_seconds REAL NOT NULL DEFAULT 0,
  -- Playable seconds; NULL until measured (a YouTube video's length is learned when it first plays).
  duration REAL,
  created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK ((source = 'file' AND file_key IS NOT NULL) OR (source = 'youtube' AND youtube_id IS NOT NULL))
);
CREATE INDEX sounds_campaign ON sounds (campaign_id, category, created_at);

-- A named mix (music and layers) the DM brings in with one click. `mix` is a
-- SceneMix (src/features/sound/jukebox.ts) holding copies of the sounds.
CREATE TABLE sound_scenes (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mix TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX sound_scenes_campaign ON sound_scenes (campaign_id, created_at);
