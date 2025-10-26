import { Client } from 'https://deno.land/x/notion_sdk@v2.2.3/src/mod.ts'
import { extractSession, isValidSession } from '../_shared/notion-extractors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const notionApiKey = Deno.env.get('NOTION_API_KEY')
    const sessionsDbId = Deno.env.get('SESSIONS_DATABASE_ID')

    if (!notionApiKey || !sessionsDbId) {
      return new Response(
        JSON.stringify({ error: 'Notion configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const notion = new Client({ auth: notionApiKey })
    const { searchQuery, campaignId } = await req.json().catch(() => ({}))

    console.log('Fetching sessions with search:', searchQuery, 'campaignId:', campaignId)

    const query: any = { database_id: sessionsDbId }

    // Build filters
    const filters: any[] = []

    if (searchQuery) {
      filters.push({
        property: 'Session',
        title: { contains: searchQuery }
      })
    }

    if (campaignId) {
      filters.push({
        property: 'Campaign',
        relation: { contains: campaignId }
      })
    }

    // Apply filters if any
    if (filters.length === 1) {
      query.filter = filters[0]
    } else if (filters.length > 1) {
      query.filter = {
        and: filters
      }
    }

    const response = await notion.databases.query(query)

    console.log(`Found ${response.results.length} raw pages`)

    // Extract sessions using unified extractor
    const sessions = response.results
      .map(page => extractSession(page))
      .filter(isValidSession)

    console.log(`Extracted ${sessions.length} valid sessions`)

    return new Response(
      JSON.stringify({ sessions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error fetching sessions:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
