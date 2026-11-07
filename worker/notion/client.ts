// The Worker no longer talks to Notion: everything it read from there is in D1
// (worker/content/client.ts answers in Notion's API shapes), and
// scripts/notion-import is the only Notion client left. This error keeps
// Notion's status and code so handlers and filters report failures as before.

export class NotionError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}
