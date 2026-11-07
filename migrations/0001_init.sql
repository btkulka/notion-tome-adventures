-- DM suite on Cloudflare D1 (SQLite). Notion stays the source of truth for
-- campaign content; these tables hold app-authored data only. Campaign ids are
-- Notion page ids. Access rules live in the Worker (worker/access.ts), which is
-- the only thing that talks to this database. Times are unix seconds.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- id is the SHA-256 of the cookie token, so a copied database holds no live sessions.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX sessions_user ON sessions (user_id);

-- Discord accounts allowed to run campaigns. A row is matched by username until
-- that account first signs in, then pinned to its permanent Discord id.
CREATE TABLE dm_allowlist (
  username TEXT NOT NULL,
  discord_id TEXT UNIQUE,
  note TEXT
);
INSERT INTO dm_allowlist (username, note) VALUES ('thetexaswave', 'Campaign owner');

-- Settings the app writes for itself, e.g. Notion database ids created by suite setup.
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE campaign_members (
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('dm', 'player')),
  character_notion_id TEXT,
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (campaign_id, user_id)
);
CREATE INDEX campaign_members_user ON campaign_members (user_id);

CREATE TABLE campaign_invites (
  code TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER,
  max_uses INTEGER,
  uses INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX campaign_invites_campaign ON campaign_invites (campaign_id);

CREATE TABLE maps (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  parent_map_id TEXT REFERENCES maps (id) ON DELETE SET NULL,
  parent_pin_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('overworld', 'local')),
  name TEXT NOT NULL,
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 256),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 256),
  scale REAL NOT NULL DEFAULT 1,
  seed INTEGER NOT NULL DEFAULT 0,
  gen_params TEXT,
  terrain TEXT NOT NULL,
  settings TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  thumbnail_key TEXT,
  created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX maps_campaign ON maps (campaign_id);
CREATE INDEX maps_parent ON maps (parent_map_id);

-- Hidden objects are never returned to players (worker/api/maps.ts).
CREATE TABLE map_objects (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL REFERENCES maps (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pin', 'path', 'prop', 'label', 'light', 'wall', 'door', 'token')),
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  z REAL NOT NULL DEFAULT 0,
  rot REAL NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX map_objects_map ON map_objects (map_id);

-- Explored tiles for the shared party view, as a base64 bitset.
CREATE TABLE map_fog (
  map_id TEXT PRIMARY KEY REFERENCES maps (id) ON DELETE CASCADE,
  explored TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE live_sessions (
  campaign_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  active_map_id TEXT REFERENCES maps (id) ON DELETE SET NULL,
  party_map_id TEXT REFERENCES maps (id) ON DELETE SET NULL,
  party_x REAL NOT NULL DEFAULT 0,
  party_y REAL NOT NULL DEFAULT 0,
  world_minutes INTEGER NOT NULL DEFAULT 480,
  weather TEXT NOT NULL DEFAULT 'clear' CHECK (weather IN ('clear', 'overcast', 'rain', 'storm', 'snow', 'fog')),
  notion_session_id TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE travel_log (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  map_id TEXT NOT NULL REFERENCES maps (id) ON DELETE CASCADE,
  from_x INTEGER NOT NULL,
  from_y INTEGER NOT NULL,
  to_x INTEGER NOT NULL,
  to_y INTEGER NOT NULL,
  path TEXT NOT NULL,
  minutes REAL NOT NULL,
  miles REAL NOT NULL,
  pace TEXT NOT NULL CHECK (pace IN ('slow', 'normal', 'fast')),
  started_at INTEGER NOT NULL,
  encounter TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX travel_log_campaign ON travel_log (campaign_id, created_at DESC);

-- Generated art and uploads; the bytes live in R2 under `key`.
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  campaign_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('texture', 'token', 'backdrop', 'handout', 'underlay', 'thumbnail')),
  key TEXT NOT NULL,
  prompt TEXT,
  seed INTEGER,
  workflow TEXT,
  created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
