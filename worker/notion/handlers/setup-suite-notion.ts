// Once made the Locations database in Notion. Locations live in D1 now, in a table
// migrations/0006_game_data.sql creates, so there is nothing to set up; this
// reports that table in the shape the Campaign page expects.
// (Characters live in D1 too: worker/api/characters.ts.)
import type { Env } from '../../env'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export default async function handler(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const table = await env.DB.prepare("SELECT notion_database_id FROM content_tables WHERE key = 'locations'").first<{ notion_database_id: string }>()
    if (!table) return json({ error: 'The Locations table is missing; apply the D1 migrations (npm run db:migrate:local)' }, 500)
    return json({ created: [], locationsDatabaseId: table.notion_database_id, secretsConfigured: true })
  } catch (error) {
    console.error('Error in setup-suite-notion:', error)
    return json({ error: error instanceof Error ? error.message : 'Unknown error occurred' }, 500)
  }
}
