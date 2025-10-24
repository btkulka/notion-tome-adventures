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
    const creaturesDbId = Deno.env.get('CREATURES_DATABASE_ID')

    if (!notionApiKey || !creaturesDbId) {
      return new Response(
        JSON.stringify({ error: 'Notion configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const notion = new Client({ auth: notionApiKey })
    const { filters } = await req.json()

    console.log('Fetching creatures with filters:', filters)

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

    const query: any = { database_id: creaturesDbId }
    if (notionFilters.length > 0) {
      query.filter = notionFilters.length === 1 ? notionFilters[0] : { and: notionFilters }
    }

    const response = await notion.databases.query(query)

    console.log(`Found ${response.results.length} raw pages`)

    // Extract creatures using unified extractor
    const creatures = response.results
      .map(page => extractCreature(page))
      .filter(isValidCreature)

    console.log(`Extracted ${creatures.length} valid creatures`)

    return new Response(
      JSON.stringify({ creatures }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error fetching creatures:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
