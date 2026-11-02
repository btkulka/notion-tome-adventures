// Characters database: the party, and which Discord user plays whom.
//   { campaignId } → characters in that campaign (any member may ask)
import { Client } from 'https://deno.land/x/notion_sdk@v2.2.3/src/mod.ts'
import { requireMember } from '../_shared/auth.ts'
import { extractCharacter } from '../_shared/suite-extractors.ts'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { campaignId } = await req.json().catch(() => ({}))
    if (!campaignId) return json({ error: 'campaignId is required' }, 400)

    const caller = await requireMember(req, campaignId)
    if (caller instanceof Response) return caller

    const notionApiKey = Deno.env.get('NOTION_API_KEY')
    const charactersDbId = Deno.env.get('CHARACTERS_DATABASE_ID')
    if (!notionApiKey || !charactersDbId) {
      return json({ error: 'Characters database not configured: set CHARACTERS_DATABASE_ID (run suite setup first)' }, 500)
    }
    const notion = new Client({ auth: notionApiKey })

    const response: any = await notion.databases.query({
      database_id: charactersDbId,
      filter: { property: 'Campaign', relation: { contains: campaignId } },
      sorts: [{ property: 'Name', direction: 'ascending' }],
      page_size: 100,
    })
    return json({ characters: response.results.map(extractCharacter) })
  } catch (error) {
    console.error('Error in characters:', error)
    return json({ error: error instanceof Error ? error.message : 'Unknown error occurred' }, 500)
  }
})
