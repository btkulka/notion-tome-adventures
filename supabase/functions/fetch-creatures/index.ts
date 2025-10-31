import { Client } from 'https://deno.land/x/notion_sdk@v2.2.3/src/mod.ts'
import { extractCreature, isValidCreature } from '../_shared/notion-extractors.ts'

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
    const monstersDbId = Deno.env.get('MONSTERS_DATABASE_ID')

    if (!notionApiKey || !monstersDbId) {
      return new Response(
        JSON.stringify({ error: 'Notion configuration missing: NOTION_API_KEY and MONSTERS_DATABASE_ID required' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const notion = new Client({ auth: notionApiKey })

    // Parse request body, default to empty object if no body provided
    let filters = {}
    try {
      const body = await req.json()
      filters = body?.filters || body || {}
    } catch (error) {
      // No body or invalid JSON, use empty filters
      console.log('No filters provided, fetching all creatures')
    }

    console.log('Fetching monsters with filters:', filters)

    // Build Notion query filters
    const notionFilters: any[] = []

    if (filters?.environment) {
      notionFilters.push({
        property: 'Environment',
        multi_select: { contains: filters.environment }
      })
    }

    if (filters?.creatureType) {
      notionFilters.push({
        property: 'Type',
        select: { equals: filters.creatureType }
      })
    }

    if (filters?.alignment) {
      notionFilters.push({
        property: 'Alignment',
        select: { equals: filters.alignment }
      })
    }

    if (filters?.size) {
      notionFilters.push({
        property: 'Size',
        select: { equals: filters.size }
      })
    }

    const query: any = { database_id: monstersDbId }
    if (notionFilters.length > 0) {
      query.filter = notionFilters.length === 1 ? notionFilters[0] : { and: notionFilters }
    }

    const response = await notion.databases.query(query)

    console.log(`Found ${response.results.length} raw pages`)

    // Extract creatures using unified extractor and track failures
    let failedCount = 0
    const creatures = response.results
      .map((page, index) => {
        try {
          const creature = extractCreature(page)
          if (!isValidCreature(creature)) {
            console.warn(`[${index}] Invalid creature (missing name):`, page.id)
            failedCount++
            return null
          }
          return creature
        } catch (error) {
          console.error(`[${index}] Error extracting creature from page ${page.id}:`, error)
          failedCount++
          return null
        }
      })
      .filter(Boolean)

    console.log(`Extracted ${creatures.length} valid creatures, ${failedCount} failed`)

    return new Response(
      JSON.stringify({
        creatures,
        metadata: {
          total: response.results.length,
          successful: creatures.length,
          failed: failedCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error fetching creatures:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
