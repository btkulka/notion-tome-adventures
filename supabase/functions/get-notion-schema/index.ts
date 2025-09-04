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
    const { databaseId } = await req.json()
    
    if (!databaseId) {
      throw new Error('Database ID is required')
    }

    const notion = new Client({
      auth: Deno.env.get('NOTION_API_KEY'),
    })

    // Get database schema
    const database = await notion.databases.retrieve({
      database_id: databaseId,
    })

    // Extract properties with their types and configurations
    const properties = Object.entries(database.properties).map(([name, prop]: [string, any]) => ({
      name,
      type: prop.type,
      id: prop.id,
      config: prop[prop.type] || null,
    }))

    return new Response(
      JSON.stringify({
        id: database.id,
        title: database.title?.[0]?.plain_text || 'Untitled',
        properties,
        url: database.url,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in get-notion-schema:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})