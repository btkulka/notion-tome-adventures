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

    // Extract campaigns using unified extractor and track failures
    let failedCount = 0
    const campaigns = response.results
      .map((page, index) => {
        try {
          const campaign = extractCampaign(page)
          if (!isValidCampaign(campaign)) {
            console.warn(`[${index}] Invalid campaign (missing name):`, page.id)
            failedCount++
            return null
          }
          return campaign
        } catch (error) {
          console.error(`[${index}] Error extracting campaign from page ${page.id}:`, error)
          failedCount++
          return null
        }
      })
      .filter(Boolean)

    console.log(`Extracted ${campaigns.length} valid campaigns, ${failedCount} failed`)

    return new Response(
      JSON.stringify({
        campaigns,
        metadata: {
          total: response.results.length,
          successful: campaigns.length,
          failed: failedCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
