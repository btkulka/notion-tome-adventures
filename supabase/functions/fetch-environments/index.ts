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
    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    const environmentsDbId = Deno.env.get('ENVIRONMENTS_DATABASE_ID');
    
    if (!notionApiKey) {
      console.error('NOTION_API_KEY environment variable is not set');
      throw new Error('NOTION_API_KEY environment variable is not set. Please configure it in Supabase Edge Functions secrets.');
    }
    
    if (!environmentsDbId) {
      console.error('ENVIRONMENTS_DATABASE_ID environment variable is not set');
      throw new Error('ENVIRONMENTS_DATABASE_ID environment variable is not set. Please configure it in Supabase Edge Functions secrets.');
    }
    
    console.log('Initializing Notion client with API key length:', notionApiKey.length);
    console.log('Using environments database ID:', environmentsDbId);
    
    const notion = new Client({
      auth: notionApiKey,
    });
    
    console.log('Notion client initialized successfully');

    console.log('Querying environments database...');

    const response = await notion.databases.query({
      database_id: environmentsDbId,
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