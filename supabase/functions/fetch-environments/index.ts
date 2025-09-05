import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Client } from 'https://esm.sh/@notionhq/client@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const notion = new Client({
      auth: Deno.env.get('NOTION_API_KEY'),
    })

    // You'll need to replace this with your actual environments database ID
    const ENVIRONMENTS_DATABASE_ID = Deno.env.get('ENVIRONMENTS_DATABASE_ID')
    
    if (!ENVIRONMENTS_DATABASE_ID) {
      throw new Error('ENVIRONMENTS_DATABASE_ID not configured')
    }

    const response = await notion.databases.query({
      database_id: ENVIRONMENTS_DATABASE_ID,
    })

    const environments = response.results.map((page: any) => ({
      id: page.id,
      name: page.properties.Name?.title?.[0]?.plain_text || 'Unknown',
      description: page.properties.Description?.rich_text?.[0]?.plain_text || '',
      terrain_type: page.properties.TerrainType?.multi_select?.map((terrain: any) => terrain.name) || [],
      climate: page.properties.Climate?.select?.name || '',
    }))

    console.log(`Found ${environments.length} environments`)

    return new Response(
      JSON.stringify({ environments }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in fetch-environments function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})