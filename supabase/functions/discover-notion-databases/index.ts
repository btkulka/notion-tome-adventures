import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Client } from 'https://esm.sh/@notionhq/client@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Notion client
    const notion = new Client({
      auth: Deno.env.get('NOTION_API_KEY'),
    })

    // Discover all databases
    const response = await notion.search({
      filter: {
        property: 'object',
        value: 'database'
      }
    })
    
    const databases = response.results
      .filter((result: any) => result.object === 'database')
      .map((db: any) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || 'Untitled Database',
        url: db.url,
        lastEditedTime: db.last_edited_time,
      }))

    // Expected D&D databases
    const EXPECTED_DATABASES = [
      { name: 'Creatures', aliases: ['creatures', 'monsters', 'creature', 'monster'] },
      { name: 'Spells', aliases: ['spells', 'spell', 'magic'] },
      { name: 'Items', aliases: ['items', 'equipment', 'gear', 'weapons', 'armor'] },
      { name: 'Environments', aliases: ['environments', 'environment', 'terrain', 'locations'] },
      { name: 'Encounters', aliases: ['encounters', 'encounter', 'generated encounters', 'saved encounters'] },
    ]

    // Match databases to expected ones
    const matches = EXPECTED_DATABASES.map(expected => {
      const suggestions = databases.filter((db: any) => 
        expected.aliases.some(alias => 
          db.title.toLowerCase().includes(alias.toLowerCase())
        )
      )

      const exactMatch = suggestions.find((db: any) => 
        expected.aliases.includes(db.title.toLowerCase())
      )
      
      const bestMatch = exactMatch || suggestions[0]

      return {
        expectedName: expected.name,
        matched: bestMatch,
        suggestions: suggestions.slice(0, 3),
      }
    })

    return new Response(
      JSON.stringify({ 
        allDatabases: databases,
        matches: matches 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in discover-notion-databases:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})