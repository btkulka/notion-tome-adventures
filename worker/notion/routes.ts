// POST /api/notion/:fn: what were the Notion proxies (Supabase edge functions
// before that). They answer from D1 now (worker/content/client.ts); the names stay
// so the app's calls don't change.
import { Hono } from 'hono';
import { campaignRole, currentDm, currentUser, HttpError } from '../access';
import type { Env } from '../env';
import type { AppEnv } from '../types';
import type { NotionContext } from './context';
import debugEnvironments from './handlers/debug-environments';
import discoverNotionDatabases from './handlers/discover-notion-databases';
import fetchCampaigns from './handlers/fetch-campaigns';
import fetchCreatures from './handlers/fetch-creatures';
import fetchEnvironments from './handlers/fetch-environments';
import fetchMagicItems from './handlers/fetch-magic-items';
import fetchSessions from './handlers/fetch-sessions';
import generateEncounter from './handlers/generate-encounter';
import getNotionSchema from './handlers/get-notion-schema';
import locations from './handlers/locations';
import saveEncounter from './handlers/save-encounter';
import setupSuiteNotion from './handlers/setup-suite-notion';
import simpleDebug from './handlers/simple-debug';

type Handler = (req: Request, env: Env, ctx: NotionContext) => Promise<Response>;

/** `dm`: allowlisted DMs only. `member`: any signed-in user; the handler checks campaign membership. */
const FUNCTIONS: Record<string, { handler: Handler; access: 'dm' | 'member' }> = {
  'generate-encounter': { handler: generateEncounter, access: 'dm' },
  'fetch-creatures': { handler: fetchCreatures, access: 'dm' },
  'fetch-environments': { handler: fetchEnvironments, access: 'dm' },
  'fetch-sessions': { handler: fetchSessions, access: 'dm' },
  'fetch-campaigns': { handler: fetchCampaigns, access: 'dm' },
  'fetch-magic-items': { handler: fetchMagicItems, access: 'dm' },
  'save-encounter': { handler: saveEncounter, access: 'dm' },
  'discover-notion-databases': { handler: discoverNotionDatabases, access: 'dm' },
  'get-notion-schema': { handler: getNotionSchema, access: 'dm' },
  'debug-environments': { handler: debugEnvironments, access: 'dm' },
  'simple-debug': { handler: simpleDebug, access: 'dm' },
  'setup-suite-notion': { handler: setupSuiteNotion, access: 'dm' },
  locations: { handler: locations, access: 'member' },
};

export const notionRoutes = new Hono<AppEnv>().post('/:fn', async (c) => {
  const entry = FUNCTIONS[c.req.param('fn')];
  if (!entry) throw new HttpError(404, `No Notion function named ${c.req.param('fn')}`);
  const user = entry.access === 'dm' ? currentDm(c) : currentUser(c);
  const ctx: NotionContext = { campaignRole: (campaignId) => campaignRole(c.env.DB, user.id, campaignId) };

  return entry.handler(c.req.raw, c.env, ctx);
});
