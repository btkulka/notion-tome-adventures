-- DMs manage the allowlist from Settings (worker/api/settings.ts), which keys
-- rows by username, so each name may appear only once.
CREATE UNIQUE INDEX dm_allowlist_username ON dm_allowlist (lower(username));
