import { Client } from 'https://deno.land/x/notion_sdk@v2.2.3/src/mod.ts'
import { extractCampaign, isValidCampaign } from '../_shared/notion-extractors.ts'

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
    const campaignsDbId = Deno.env.get('CAMPAIGNS_DATABASE_ID')

    if (!notionApiKey || !campaignsDbId) {
      return new Response(
        JSON.stringify({ error: 'Notion configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const notion = new Client({ auth: notionApiKey })
    const { searchQuery, activeOnly = false } = await req.json().catch(() => ({}))

    console.log('Fetching campaigns with search:', searchQuery, 'activeOnly:', activeOnly)

    const query: any = { database_id: campaignsDbId }

    // Build filters
    const filters: any[] = []

    if (searchQuery) {
      filters.push({
        property: 'Campaign',
        title: { contains: searchQuery }
      })
    }

    if (activeOnly) {
      filters.push({
        property: 'Active',
        checkbox: { equals: true }
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

    // Extract campaigns using unified extractor
    const campaigns = response.results
      .map(page => extractCampaign(page))
      .filter(isValidCampaign)

    console.log(`Extracted ${campaigns.length} valid campaigns`)

    return new Response(
      JSON.stringify({ campaigns }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
