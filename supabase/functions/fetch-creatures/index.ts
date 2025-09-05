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

    const { environment, minCR, maxCR, creatureType, alignment, size } = await req.json()

    // Discover the creatures database automatically
    const discoveryResponse = await notion.search({
      filter: {
        property: 'object',
        value: 'database'
      }
    })
    
    const databases = discoveryResponse.results
      .filter((result: any) => result.object === 'database')
      .map((db: any) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || 'Untitled Database',
      }))

    const creaturesAliases = ['creatures', 'monsters', 'creature', 'monster']
    const creaturesDb = databases.find((db: any) => 
      creaturesAliases.some(alias => 
        db.title.toLowerCase().includes(alias.toLowerCase())
      )
    )

    if (!creaturesDb) {
      throw new Error('Creatures database not found. Please ensure you have a Notion database with "creatures" or "monsters" in the title.')
    }

    const CREATURES_DATABASE_ID = creaturesDb.id

    // Build filter based on parameters
    const filters: any[] = []

    if (environment && environment !== 'Any') {
      filters.push({
        property: 'Environment',
        multi_select: {
          contains: environment,
        },
      })
    }

    if (creatureType && creatureType !== 'Any') {
      filters.push({
        property: 'Type',
        select: {
          equals: creatureType,
        },
      })
    }

    if (alignment && alignment !== 'Any') {
      filters.push({
        property: 'Alignment',
        select: {
          equals: alignment,
        },
      })
    }

    if (size && size !== 'Any') {
      filters.push({
        property: 'Size',
        select: {
          equals: size,
        },
      })
    }

    if (minCR !== undefined) {
      filters.push({
        property: 'ChallengeRating',
        number: {
          greater_than_or_equal_to: minCR,
        },
      })
    }

    if (maxCR !== undefined) {
      filters.push({
        property: 'ChallengeRating',
        number: {
          less_than_or_equal_to: maxCR,
        },
      })
    }

    const query: any = {
      database_id: CREATURES_DATABASE_ID,
    }

    if (filters.length > 0) {
      query.filter = filters.length === 1 ? filters[0] : {
        and: filters,
      }
    }

    const response = await notion.databases.query(query)

    const creatures = response.results.map((page: any) => ({
      id: page.id,
      name: page.properties.Name?.title?.[0]?.plain_text || 'Unknown',
      type: page.properties.Type?.select?.name || 'Unknown',
      challenge_rating: page.properties.ChallengeRating?.number || 0,
      xp_value: page.properties.XPValue?.number || 0,
      armor_class: page.properties.ArmorClass?.number || 10,
      hit_points: page.properties.HitPoints?.number || 1,
      environment: page.properties.Environment?.multi_select?.map((env: any) => env.name) || [],
      alignment: page.properties.Alignment?.select?.name || 'Neutral',
      size: page.properties.Size?.select?.name || 'Medium',
    }))

    console.log(`Found ${creatures.length} creatures matching filters`)

    return new Response(
      JSON.stringify({ creatures }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in fetch-creatures function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})