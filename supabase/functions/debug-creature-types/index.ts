import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { environment = '', xpThreshold = 500 } = await req.json()

    console.log(`🔍 Debugging creature types for environment: "${environment}", XP threshold: ${xpThreshold}`)

    // Initialize Notion client
    const notionToken = Deno.env.get('NOTION_TOKEN')
    if (!notionToken) {
      throw new Error('NOTION_TOKEN environment variable is required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const databaseResponse = await supabase
      .from('notion_databases')
      .select('*')
      .order('created_at', { ascending: false })

    if (databaseResponse.error) {
      throw new Error(`Failed to fetch databases: ${databaseResponse.error.message}`)
    }

    const databases = databaseResponse.data || []
    const monstersDb = databases.find(db => db.name?.toLowerCase().includes('monster'))
    const typesDb = databases.find(db => db.name?.toLowerCase().includes('type') || db.name?.toLowerCase().includes('creature'))

    if (!monstersDb) {
      throw new Error('No monsters database found')
    }

    console.log(`📚 Using monsters database: ${monstersDb.name} (${monstersDb.database_id})`)
    console.log(`📚 Using types database: ${typesDb?.name || 'None'} (${typesDb?.database_id || 'None'})`)

    // Fetch all creature types first
    const typeMap = new Map()
    if (typesDb) {
      const typesResponse = await fetch(`https://api.notion.com/v1/databases/${typesDb.database_id}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({ page_size: 100 })
      })

      if (typesResponse.ok) {
        const typesData = await typesResponse.json()
        console.log(`🔧 Fetched ${typesData.results.length} creature types`)
        
        for (const typePage of typesData.results) {
          const typeProperties = typePage.properties
          let typeName = 'Unknown Type'
          
          if (typeProperties.Name?.title?.[0]?.plain_text) {
            typeName = typeProperties.Name.title[0].plain_text
          } else if (typeProperties.Title?.title?.[0]?.plain_text) {
            typeName = typeProperties.Title.title[0].plain_text
          } else if (typeProperties.Type?.title?.[0]?.plain_text) {
            typeName = typeProperties.Type.title[0].plain_text
          }
          
          typeMap.set(typePage.id, typeName)
        }

        console.log(`🗺️ Created type map with ${typeMap.size} types:`, 
          Array.from(typeMap.entries()).slice(0, 10).map(([id, name]) => ({ id: id.slice(0, 8), name }))
        )
      }
    }

    // Fetch a few monsters to examine their creature types
    const monstersResponse = await fetch(`https://api.notion.com/v1/databases/${monstersDb.database_id}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({ page_size: 10 })
    })

    if (!monstersResponse.ok) {
      throw new Error(`Failed to fetch monsters: ${monstersResponse.statusText}`)
    }

    const monstersData = await monstersResponse.json()
    console.log(`🐉 Fetched ${monstersData.results.length} monsters for analysis`)

    const creatureTypeAnalysis = []

    for (const monster of monstersData.results) {
      const properties = monster.properties
      
      // Extract monster name
      let name = 'Unknown Monster'
      if (properties['Monster Name']?.title?.[0]?.plain_text) {
        name = properties['Monster Name'].title[0].plain_text
      } else if (properties.Name?.title?.[0]?.plain_text) {
        name = properties.Name.title[0].plain_text
      }

      // Analyze creature type extraction
      let extractedType = ''
      let extractionMethod = 'none'
      let rawTypeData = {}

      // Collect all type-related properties
      const typeProperties = {
        'Creature Type': properties['Creature Type'],
        'Monster Type': properties['Monster Type'],
        'Type': properties.Type,
        'Category': properties.Category,
        'CreatureType': properties.CreatureType
      }

      rawTypeData = typeProperties

      // Apply extraction logic (same as in generate-encounter)
      if (properties['Creature Type']?.relation?.[0]?.id) {
        const typeId = properties['Creature Type'].relation[0].id
        extractedType = typeMap.get(typeId) || 'Unknown'
        extractionMethod = 'Creature Type relation'
      } else if (properties['Monster Type']?.relation?.[0]?.id) {
        const typeId = properties['Monster Type'].relation[0].id
        extractedType = typeMap.get(typeId) || 'Unknown'
        extractionMethod = 'Monster Type relation'
      } else if (properties.Type?.relation?.[0]?.id) {
        const typeId = properties.Type.relation[0].id
        extractedType = typeMap.get(typeId) || 'Unknown'
        extractionMethod = 'Type relation'
      } else if (properties.Category?.relation?.[0]?.id) {
        const typeId = properties.Category.relation[0].id
        extractedType = typeMap.get(typeId) || 'Unknown'
        extractionMethod = 'Category relation'
      } else if (properties['Creature Type']?.select?.name) {
        extractedType = properties['Creature Type'].select.name
        extractionMethod = 'Creature Type select'
      } else if (properties['Monster Type']?.select?.name) {
        extractedType = properties['Monster Type'].select.name
        extractionMethod = 'Monster Type select'
      } else if (properties.Type?.select?.name) {
        extractedType = properties.Type.select.name
        extractionMethod = 'Type select'
      } else if (properties.Category?.select?.name) {
        extractedType = properties.Category.select.name
        extractionMethod = 'Category select'
      } else if (properties.CreatureType?.select?.name) {
        extractedType = properties.CreatureType.select.name
        extractionMethod = 'CreatureType select'
      }

      creatureTypeAnalysis.push({
        name,
        extractedType,
        extractionMethod,
        rawTypeData
      })
    }

    return new Response(JSON.stringify({
      success: true,
      typeMapSize: typeMap.size,
      sampleTypes: Array.from(typeMap.entries()).slice(0, 10).map(([id, name]) => ({ id: id.slice(0, 8), name })),
      creatureTypeAnalysis,
      summary: {
        totalMonsters: creatureTypeAnalysis.length,
        withTypes: creatureTypeAnalysis.filter(c => c.extractedType && c.extractedType !== 'Unknown').length,
        withoutTypes: creatureTypeAnalysis.filter(c => !c.extractedType || c.extractedType === 'Unknown').length,
        extractionMethods: [...new Set(creatureTypeAnalysis.map(c => c.extractionMethod))]
      }
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('❌ Error in creature type debug:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
