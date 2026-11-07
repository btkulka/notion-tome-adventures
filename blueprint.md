# D&D Notion Tome Adventures - AI Agent Blueprint

## Project Overview
A Notion-backed dungeon master suite: the encounter and loot generators, plus an isometric overworld map that remote players explore live. Campaign content comes from Notion; the app's own data (maps, sessions, memberships) lives in Cloudflare D1. Everything is served by one Cloudflare Worker.

## 🚨 CRITICAL CONSTRAINTS - NEVER VIOLATE THESE

### 1. NO FALLBACK DATA POLICY
- **NEVER** create, use, or implement any form of mock, default, or fallback data
- **NEVER** add hardcoded arrays of creatures, environments, or any game data
- **NEVER** implement fallback logic that provides alternate data when Notion fails
- When Notion integration fails, the application should fail gracefully with error messages
- Empty states should show loading indicators or error messages, NOT placeholder content
- Seeded procedural generation (maps, place names) is user-requested content, not fallback data. A biome with no mapped Notion Environment must produce an explicit error, never default monsters.

### 2. ONE WORKER OWNS ALL DATA ACCESS
- The browser only talks to the Worker (`/api/*`, `/auth/*`); **NEVER** call Notion or D1 from the frontend
- Notion is reached only through `worker/notion/` with the integration key held as a Worker secret
- D1 holds app-authored data only: users and sessions, campaign membership and invites, player characters, maps, map objects, fog, live sessions, travel log, asset records
- Access rules live in `worker/access.ts`. Every route checks the caller's role before touching campaign data; players never receive hidden map objects

### 3. NOTION DATABASE DEPENDENCY
- Reference content (monsters, magic items, environments, equipment, loot and shop tables) was imported from Notion into D1 (`content_tables` / `content_rows`, see `scripts/notion-import/`) and is read from there
- Sessions, campaigns, encounters and locations still MUST come from Notion until they move too. Player characters live in D1 (below)
- Configuration errors should result in clear error messages, not workarounds

## Architecture Overview

### Frontend (React + TypeScript + Vite)
- React 18, Vite (dev server on port 1974, proxying `/api` and `/auth` to the Worker on 8787), shadcn/ui + Tailwind, React Router
- `src/lib/api.ts` is the only HTTP client: `api()` for app routes, `callEdgeFunction()` for the Notion proxies
- Feature code lives in `src/features/<feature>/` (auth, suite, maps, tools). Map logic under `src/features/maps/` (generator, slopes, roads, vision, travel) is pure and unit-tested
- The DM's home is the live table (`/table`). Generators sit under the rail's Tools flyout at `/tools/<name>` (encounters, treasure); add a tool to `TOOLS` in `SuiteShell.tsx`
- Loot rules shared with the Worker live in dependency-free `src/lib/` modules: `coin-rolls.ts` (coins by CR) is imported by both the treasure tool and `generate-encounter`

### Backend (Cloudflare Worker, `worker/`)
- `worker/index.ts` routes requests (Hono); static assets are served by the platform (`wrangler.toml`)
- `worker/auth.ts`: Discord OAuth code flow and HttpOnly cookie sessions (token hashes stored in D1)
- `worker/notion/`: the Notion proxies (formerly Supabase edge functions) behind a small REST client (`client.ts`)
- `worker/content/`: reads the content imported from Notion with the same methods as the Notion client, so handlers and extractors work unchanged. Row ids are the Notion page ids
- `worker/api/`: campaigns, invites, characters, maps, fog, live session, travel log, DM settings (the allowlist)
- Characters (`worker/api/characters.ts`): players add and edit their own, the DM any. A linked D&D Beyond sheet is read from its public character service (it must be set to Public) for name, race, class, level, portrait and darkvision; `src/lib/characters.ts` parses links and sheets for both sides
- `worker/table.ts`: a Durable Object per campaign relaying live-table WebSocket messages by audience (DM / players)
- `migrations/`: D1 schema (`npm run db:migrate:local` / `db:migrate:remote`)

### Roles
- DMs are Discord accounts in `dm_allowlist` (matched by username until first sign-in, then pinned to the Discord id); DMs add and remove each other under Settings (`/settings`). Removing a DM drops their DM powers in every campaign on their next request
- Players join a campaign with an invite code; a DM claims a Notion campaign before running it
- On first reaching the table a player brings a character (a D&D Beyond link, or one already in the campaign) and manages theirs at `/play/:campaignId/characters`; the DM manages the whole party under Campaign

## Environment Configuration
Worker secrets (`wrangler secret put …`, or `.dev.vars` locally — see `.dev.vars.example`):
```bash
DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET   # Discord app, redirect <origin>/auth/discord/callback
NOTION_API_KEY
MONSTERS_DATABASE_ID, ENVIRONMENTS_DATABASE_ID, SESSIONS_DATABASE_ID, ENCOUNTERS_DATABASE_ID,
CAMPAIGNS_DATABASE_ID, MAGIC_ITEMS_DATABASE_ID, MAGIC_ITEM_RARITIES_DATABASE_ID
PUBLIC_ORIGIN                               # optional; the origin players use
```
LOCATIONS_DATABASE_ID is written to D1 `app_settings` by the suite setup function.

## Development Guidelines

### When Adding New Features
1. **Data Requirements**: Determine what Notion database fields are needed
2. **Worker**: Add or change a handler under `worker/notion/handlers/` (Notion) or `worker/api/` (D1), with an access check
3. **Frontend Integration**: Call it through `src/lib/api.ts` (or the `useNotionService` hook for Notion)
4. **Error Handling**: Implement proper error states without fallbacks
5. **Testing**: Test with real Notion data only

### Error Handling Strategy
- **Network Errors**: Show connection error messages
- **Data Errors**: Display validation error details
- **Empty Results**: Show "no data found" messages with setup instructions
- **Configuration Errors**: Provide clear setup guidance
- **Never**: Hide errors with mock data or fallbacks

### Code Patterns to Follow
```typescript
// ✅ CORRECT: Fail when no data
const [environments, setEnvironments] = useState<Environment[]>([]);

useEffect(() => {
  const loadData = async () => {
    try {
      const result = await fetchEnvironments();
      if (result?.environments?.length > 0) {
        setEnvironments(result.environments);
      } else {
        setEnvironments([]); // Empty array, no fallbacks
      }
    } catch (error) {
      console.error('Failed to load:', error);
      setEnvironments([]); // Fail gracefully
    }
  };
  loadData();
}, []);
```

```typescript
// ❌ WRONG: Never do this
const defaultEnvironments = ['Forest', 'Dungeon']; // NO DEFAULTS
if (environments.length === 0) {
  return defaultEnvironments; // NO FALLBACKS
}
```

### File Organization
```
src/
├── features/           # Suite features: auth, suite shell, maps (pure logic + UI)
├── components/         # Shared UI (shadcn/ui in components/ui)
├── hooks/  lib/  pages/  services/  types/  utils/
worker/
├── index.ts            # Routes (Hono); static assets come from wrangler.toml
├── auth.ts access.ts   # Discord sign-in, sessions, role checks
├── api/                # D1-backed routes
├── notion/             # Notion client, extractors, handlers
├── content/            # D1 reader for content imported from Notion
└── table.ts            # Live-table Durable Object
migrations/             # D1 schema
scripts/textures/       # Procedural terrain texture generator (npm run textures)
scripts/notion-import/  # Notion → D1 import: notion:export, notion:sql, notion:apply:local|remote
public/textures/        # Generated textures served to the map renderer
```

## Common Tasks and Patterns

### Adding a Notion function
1. Add `worker/notion/handlers/<name>.ts` exporting `handler(req, env, ctx)`
2. Register it in `worker/notion/routes.ts` with its access level (`dm` or `member`)
3. Call it from the frontend with `callEdgeFunction('<name>', body)`

### Adding an app route
1. Add it under `worker/api/`, checking access first (`requireMember`, `requireCampaignDm`, `currentDm`)
2. If it changes live-table state, `broadcast()` the change; send hidden data to the `dm` audience only
3. Schema changes go in a new numbered file under `migrations/`

### Local development
1. `cp .dev.vars.example .dev.vars` and fill in the Discord and Notion values
2. `npm run db:migrate:local`, then `npm run dev:api` (Worker on 8787) and `npm run dev` (Vite on 1974)

## Security Considerations
- The Notion key and Discord secret are Worker secrets, never in frontend code
- Sessions are HttpOnly cookies; D1 stores only the SHA-256 of each session token
- Players never receive hidden map objects, over HTTP or the live-table socket
- Notion handlers that serve players (`locations`) check campaign membership and strip DM-only fields
- A character can be changed only by its player or the campaign's DM; an unclaimed one by the DM, until a player claims it by playing it

## Deployment Process
1. `npx wrangler d1 create tome` once, and put its id in `wrangler.toml`
2. `npm run db:migrate:remote`
3. Set secrets with `npx wrangler secret put <NAME>`
4. `npm run deploy` (builds the app and deploys the Worker)

## Troubleshooting Common Issues

### "No environments/creatures found"
- Check the Notion key and database ids in the Worker secrets
- Confirm the Notion integration is shared with those databases
- Read the Worker logs (`npx wrangler tail`)

### Sign-in loops back to the login page
- The Discord app's redirect must be exactly `<origin>/auth/discord/callback`
- In local dev set `PUBLIC_ORIGIN=http://localhost:1974` so Discord returns through the Vite proxy

### "DM tools only"
- The Discord username must be in `dm_allowlist` (seeded with `thetexaswave` by the first migration; after that, add DMs under Settings)

---

## For AI Agents: Key Reminders

1. **Read this blueprint** before making any changes to understand constraints
2. **Never implement fallback data** - the application should fail rather than show fake data
3. **All data goes through the Worker** - no Notion or database calls from the browser
4. **Check access in every route** - there is no database-level row security
5. **Maintain error transparency** - users should see real errors, not hidden failures
6. **Keep map logic pure and tested** - `src/features/maps/` modules have unit tests (`npm test`)
7. **Update this blueprint** if you add new architectural constraints or patterns
