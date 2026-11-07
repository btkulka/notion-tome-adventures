/**
 * Copies the Notion databases in tables.ts into .notion-export/ for to-sql.ts,
 * and (the `pages` entry) the pages that aren't rows of any database.
 *
 *   npm run notion:export                      # tables not exported yet
 *   npm run notion:export -- --refresh         # all tables again
 *   npm run notion:export -- monsters weapons  # just these
 *
 * For each row it keeps the page object (formula values included), fills in
 * relations and long text that Notion cuts off at 25 items, and copies the page
 * content as blocks with their children. Files stored in Notion are only served
 * from links that expire within the hour, so they are downloaded to
 * .notion-export/files/ and each one is tagged with `tome_file`, its path there.
 * Reads NOTION_API_KEY from the environment or .dev.vars.
 */
import fs from 'node:fs';
import path from 'node:path';
import { EXPORT_DIR, TABLES } from './tables';

const NOTION_VERSION = '2022-06-28';
/** Notion allows about three requests a second per integration. */
const MIN_GAP_MS = 350;
const CONCURRENCY = 3;
const MAX_DEPTH = 8;

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function apiKey(): string {
  if (process.env.NOTION_API_KEY) return process.env.NOTION_API_KEY;
  const vars = fs.existsSync('.dev.vars') ? fs.readFileSync('.dev.vars', 'utf8') : '';
  const key = vars.match(/^NOTION_API_KEY=(.+)$/m)?.[1]?.trim();
  if (!key) throw new Error('Set NOTION_API_KEY in .dev.vars (or the environment) first.');
  return key;
}

let key = '';
let lastStart = 0;
let requests = 0;

async function notion(method: 'GET' | 'POST', url: string, body?: Json): Promise<Json> {
  for (let attempt = 0; ; attempt++) {
    const wait = lastStart + MIN_GAP_MS - Date.now();
    lastStart = Math.max(Date.now(), lastStart + MIN_GAP_MS);
    if (wait > 0) await sleep(wait);
    requests++;
    const res = await fetch(`https://api.notion.com/v1/${url}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      await sleep(Number(res.headers.get('Retry-After') ?? 0) * 1000 || 1000 * 2 ** attempt);
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(`${method} ${url}: ${data.message ?? res.status}`), { status: res.status, code: data.code });
    delete data.request_id;
    return data;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function paginate(method: 'GET' | 'POST', url: string, body: Json = {}): Promise<{ results: Json[]; last: Json }> {
  const results: Json[] = [];
  let cursor: string | undefined;
  let last: Json;
  do {
    const sep = url.includes('?') ? '&' : '?';
    last =
      method === 'GET'
        ? await notion('GET', `${url}${sep}page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`)
        : await notion('POST', url, { ...body, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    results.push(...last.results);
    cursor = last.has_more ? last.next_cursor : undefined;
  } while (cursor);
  return { results, last };
}

/** Relations, people and rich text come back cut off at 25 items; fetch the rest. */
const CAPPED = ['relation', 'people', 'title', 'rich_text'];

async function completeProperties(page: Json) {
  for (const prop of Object.values<Json>(page.properties)) {
    const items = prop[prop.type];
    const cut = prop.type === 'relation' ? prop.has_more === true || items?.length >= 25 : CAPPED.includes(prop.type) && items?.length >= 25;
    if (!cut) continue;
    // Property ids come already URL-encoded.
    const { results } = await paginate('GET', `pages/${page.id}/properties/${prop.id}`);
    prop[prop.type] = results.map((item) => item[item.type]);
    if (prop.type === 'relation') prop.has_more = false;
  }
}

/**
 * The page content: every block, with `children` nested in, down to MAX_DEPTH.
 * `intoPages` false leaves sub-pages as links, for the pages table, where each is a row.
 */
async function blocks(id: string, depth = 0, intoPages = true): Promise<Json[]> {
  const { results } = await paginate('GET', `blocks/${id}/children`);
  for (const block of results) {
    // A child database is another table; its rows are not this page's content.
    const into = block.type !== 'child_database' && (intoPages || block.type !== 'child_page');
    if (block.has_children && into && depth < MAX_DEPTH) block.children = await blocks(block.id, depth + 1, intoPages);
  }
  return results;
}

/** Ids of the blocks of one type anywhere in some content. */
function blockIds(list: Json[], type: string, out: string[] = []): string[] {
  for (const block of list) {
    if (block.type === type) out.push(block.id);
    if (block.children) blockIds(block.children, type, out);
  }
  return out;
}

let fileCount = 0;
let fileBytes = 0;

/** Downloads a Notion-hosted file ({ type: 'file', file: { url } }) and tags it with its local path. */
async function keepFile(holder: Json, owner: string, filesDir: string) {
  if (holder?.type !== 'file' || !holder.file?.url) return;
  const name = decodeURIComponent(new URL(holder.file.url).pathname.split('/').pop() ?? 'file').replace(/[^\w.-]+/g, '_').slice(-80);
  const rel = `${owner}/${name}`;
  const target = path.join(filesDir, rel);
  if (!fs.existsSync(target)) {
    const res = await fetch(holder.file.url);
    if (!res.ok) {
      console.warn(`  could not download ${rel}: ${res.status}`);
      return;
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    fileBytes += bytes.length;
  }
  fileCount++;
  holder.tome_file = rel;
}

async function keepFiles(page: Json, body: Json[], filesDir: string) {
  await keepFile(page.cover, `${page.id}/cover`, filesDir);
  await keepFile(page.icon, `${page.id}/icon`, filesDir);
  for (const prop of Object.values<Json>(page.properties)) {
    if (prop.type !== 'files') continue;
    for (const [i, f] of (prop.files ?? []).entries()) await keepFile(f, `${page.id}/${prop.id.replace(/\W+/g, '_')}-${i}`, filesDir);
  }
  const walk = async (list: Json[]) => {
    for (const block of list) {
      const media = block[block.type];
      if (['image', 'file', 'pdf', 'video', 'audio'].includes(block.type)) await keepFile(media, block.id, filesDir);
      if (block.children) await walk(block.children);
    }
  };
  await walk(body);
}

async function pool<T>(items: T[], size: number, work: (item: T, index: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await work(items[i], i);
    }
  }));
}

async function exportTable(key: string, notionId: string, dataDir: string, filesDir: string) {
  const started = Date.now();
  const before = { requests, fileCount, fileBytes };
  const database = await notion('GET', `databases/${notionId}`);
  const name = (database.title ?? []).map((t: Json) => t.plain_text).join('') || key;
  const { results: pages } = await paginate('POST', `databases/${notionId}/query`);
  const rows: { page: Json; body: Json[] }[] = new Array(pages.length);
  await pool(pages, CONCURRENCY, async (page, i) => {
    await completeProperties(page);
    const body = await blocks(page.id);
    await keepFiles(page, body, filesDir);
    rows[i] = { page, body };
  });
  const out = { key, notionDatabaseId: database.id, name, schema: database.properties, exportedAt: new Date().toISOString(), rows };
  fs.writeFileSync(path.join(dataDir, `${key}.json`), JSON.stringify(out));
  const kb = Math.round((fileBytes - before.fileBytes) / 1024);
  console.log(
    `${key.padEnd(28)} ${String(rows.length).padStart(5)} rows  ${String(requests - before.requests).padStart(5)} requests  ` +
      `${fileCount - before.fileCount} files (${kb} KB)  ${Math.round((Date.now() - started) / 1000)}s`
  );
}

/**
 * The pages that aren't database rows (the top-level D&D pages and everything
 * under them), as one table: what search finds, plus any sub-page it hasn't
 * indexed, reached through the content. Also says which databases Notion has that
 * tables.ts doesn't list.
 */
async function exportPages(key: string, notionId: string, dataDir: string, filesDir: string) {
  const started = Date.now();
  const before = { requests, fileCount, fileBytes };
  const { results: found } = await paginate('POST', 'search', { filter: { property: 'object', value: 'page' } });
  const live = (p: Json) => !p.archived && !p.in_trash;
  const seen = new Set<string>(found.map((p) => p.id));
  const queue = found.filter((p) => p.parent?.type !== 'database_id' && live(p));
  const rows: { page: Json; body: Json[] }[] = [];
  const childDatabases = new Set<string>();
  while (queue.length) {
    await pool(queue.splice(0), CONCURRENCY, async (page) => {
      await completeProperties(page);
      const body = await blocks(page.id, 0, false);
      await keepFiles(page, body, filesDir);
      rows.push({ page, body });
      for (const id of blockIds(body, 'child_database')) childDatabases.add(id);
      for (const id of blockIds(body, 'child_page')) {
        if (seen.has(id)) continue;
        seen.add(id);
        const child = await notion('GET', `pages/${id}`);
        if (live(child)) queue.push(child);
      }
    });
  }
  rows.sort((a, b) => a.page.created_time.localeCompare(b.page.created_time));
  const schema = { title: { id: 'title', name: 'title', type: 'title', title: {} } };
  const out = { key, notionDatabaseId: notionId, name: 'Pages', schema, exportedAt: new Date().toISOString(), rows };
  fs.writeFileSync(path.join(dataDir, `${key}.json`), JSON.stringify(out));
  const kb = Math.round((fileBytes - before.fileBytes) / 1024);
  console.log(
    `${key.padEnd(28)} ${String(rows.length).padStart(5)} rows  ${String(requests - before.requests).padStart(5)} requests  ` +
      `${fileCount - before.fileCount} files (${kb} KB)  ${Math.round((Date.now() - started) / 1000)}s`
  );

  const { results: databases } = await paginate('POST', 'search', { filter: { property: 'object', value: 'database' } });
  const listed = new Set(TABLES.map((t) => t.notionId));
  const unlisted = new Map<string, string>();
  for (const db of databases) if (!listed.has(db.id)) unlisted.set(db.id, (db.title ?? []).map((t: Json) => t.plain_text).join('') || 'Untitled');
  for (const id of childDatabases) if (!listed.has(id) && !unlisted.has(id)) unlisted.set(id, '(inline in a page)');
  console.log(`  Notion has ${databases.length} databases; not in tables.ts:`);
  for (const [id, title] of unlisted) console.log(`    ${id}  ${title}`);
}

async function main() {
  key = apiKey();
  const args = process.argv.slice(2);
  const refresh = args.includes('--refresh');
  const only = args.filter((a) => !a.startsWith('--'));
  const dataDir = path.join(EXPORT_DIR, 'data');
  const filesDir = path.join(EXPORT_DIR, 'files');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(filesDir, { recursive: true });

  const unknown = only.filter((k) => !TABLES.some((t) => t.key === k));
  if (unknown.length) throw new Error(`Unknown table(s): ${unknown.join(', ')}`);

  const failed: string[] = [];
  for (const { key, notionId, pages } of TABLES) {
    if (only.length && !only.includes(key)) continue;
    if (!only.length && !refresh && fs.existsSync(path.join(dataDir, `${key}.json`))) {
      console.log(`${key.padEnd(28)} already exported (use --refresh to redo)`);
      continue;
    }
    try {
      await (pages ? exportPages : exportTable)(key, notionId, dataDir, filesDir);
    } catch (err) {
      const e = err as { status?: number; message: string };
      console.error(`${key.padEnd(28)} FAILED: ${e.message}`);
      if (e.status === 404) console.error('  Share it with the integration: in Notion open Tables, then ••• → Connections → add the integration.');
      failed.push(key);
    }
  }
  console.log(`\n${requests} requests, ${fileCount} files (${Math.round(fileBytes / 1024)} KB) downloaded.`);
  if (failed.length) {
    console.error(`Failed: ${failed.join(', ')}`);
    process.exit(1);
  }
  console.log('Next: npm run notion:sql');
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
