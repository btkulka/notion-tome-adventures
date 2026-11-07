-- DM edits to the imported reference content (content_rows). The imported page
-- stays exactly as Notion had it; an override replaces one property's value
-- wherever the content is read (worker/content/overrides.ts), and deleting it
-- restores the original. Keyed by the Notion property id, which survives a column
-- rename. Rows aren't foreign keys because a re-import deletes and re-adds them
-- under the same ids, and the overrides should outlive that.

CREATE TABLE content_overrides (
  row_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  -- The property's name when it was set, for reading the table by hand.
  property TEXT NOT NULL,
  -- The property in Notion's page-property shape, as JSON.
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (row_id, property_id)
);
