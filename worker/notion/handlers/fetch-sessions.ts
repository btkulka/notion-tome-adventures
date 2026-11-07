import { ContentClient } from '../../content/client'
import type { Env } from '../../env'
import { extractSession, isValidSession } from '../extractors'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export default async function handler(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }


  try {
    // Moved from Notion into D1, where the app now edits it (migrations/0006_game_data.sql).
    const notion = new ContentClient(env.DB)
    const { searchQuery, campaignId } = await req.json<any>().catch(() => ({}))

    console.log('Fetching sessions with search:', searchQuery, 'campaignId:', campaignId)

    const query: any = { database_id: 'sessions' }

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

    const response = await notion.databases.queryAll(query)

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
}
