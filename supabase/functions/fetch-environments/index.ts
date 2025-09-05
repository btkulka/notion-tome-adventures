import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Client } from 'https://esm.sh/@notionhq/client@2.3.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    
    if (!notionApiKey) {
      throw new Error('NOTION_API_KEY environment variable is not set');
    }
    
    console.log('Initializing Notion client...');
    const notion = new Client({
      auth: notionApiKey,
    })

    // Discover the environments database automatically
    console.log('Searching for databases...');
    const discoveryResponse = await notion.search({
      filter: {
        property: 'object',
        value: 'database'
      }
    })
    
    console.log(`Found ${discoveryResponse.results.length} total results`);
    
    const databases = discoveryResponse.results
      .filter((result: any) => result.object === 'database')
      .map((db: any) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || 'Untitled Database',
      }))

    console.log('Available databases:', databases.map(db => db.title));

    const environmentsAliases = ['environments', 'environment', 'terrain', 'locations']
    const environmentsDb = databases.find((db: any) => 
      environmentsAliases.some(alias => 
        db.title.toLowerCase().includes(alias.toLowerCase())
      )
    )

    if (!environmentsDb) {
      const availableTitles = databases.map(db => `"${db.title}"`).join(', ');
      throw new Error(`Environments database not found. Available databases: ${availableTitles}. Please ensure you have a Notion database with "environments" or "terrain" in the title.`);
    }
    
    console.log(`Using environments database: "${environmentsDb.title}" (${environmentsDb.id})`)

    const ENVIRONMENTS_DATABASE_ID = environmentsDb.id

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