import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function handleCORS(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}

function createErrorResponse(error: unknown, context: string): Response {
  console.error(`Error in ${context}:`, error)
  
  let errorMessage = 'An unexpected error occurred'
  if (error instanceof Error) {
    errorMessage = error.message
  }
  
  return new Response(
    JSON.stringify({ 
      error: errorMessage,
      context,
      timestamp: new Date().toISOString()
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    }
  )
}

function createSuccessResponse(data: unknown): Response {
  return new Response(
    JSON.stringify(data),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  )
}

serve(async (req) => {
  const corsResponse = handleCORS(req)
  if (corsResponse) return corsResponse

  try {
    console.log('🌍 Starting environments fetch... (NEW VERSION with direct API calls)')
    
    const apiKey = Deno.env.get('NOTION_API_KEY')
    if (!apiKey) {
      throw new Error('❌ NOTION_API_KEY environment variable is not set')
    }
    
    const environmentsDbId = Deno.env.get('ENVIRONMENTS_DATABASE_ID')
    if (!environmentsDbId) {
      throw new Error('❌ ENVIRONMENTS_DATABASE_ID environment variable is not set')
    }
    
    console.log('✅ API keys found, querying Notion database...')
    
    // Make direct API call to Notion instead of using the client
    const response = await fetch(`https://api.notion.com/v1/databases/${environmentsDbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      throw new Error(`Notion API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`📋 Processing ${data.results.length} environment records...`)

    const environments = data.results.map((page: any) => {
      console.log('🔍 Processing environment page:', page.id)
      
      const props = page.properties
      
      // Extract name from various possible properties
      let name = 'Unknown Environment'
      if (props?.Environment?.title?.[0]?.plain_text) {
        name = props.Environment.title[0].plain_text
      } else if (props?.Name?.title?.[0]?.plain_text) {
        name = props.Name.title[0].plain_text
      } else if (props?.Environments?.title?.[0]?.plain_text) {
        name = props.Environments.title[0].plain_text
      } else if (props?.EnvironmentName?.title?.[0]?.plain_text) {
        name = props.EnvironmentName.title[0].plain_text
      } else if (props?.Title?.title?.[0]?.plain_text) {
        name = props.Title.title[0].plain_text
      } else {
        // Try other property types if title doesn't work
        const nameKeys = Object.keys(props || {}).filter(key => 
          key.toLowerCase().includes('name') || 
          key.toLowerCase().includes('environment') ||
          key.toLowerCase().includes('title')
        )
        
        for (const key of nameKeys) {
          const prop = props[key]
          if (prop?.rich_text?.[0]?.plain_text) {
            name = prop.rich_text[0].plain_text
            break
          } else if (prop?.select?.name) {
            name = prop.select.name
            break
          } else if (prop?.title?.[0]?.plain_text) {
            name = prop.title[0].plain_text
            break
          }
        }
      }
      
      // Extract description
      const description = props?.Description?.rich_text?.[0]?.plain_text || 
                         props?.Desc?.rich_text?.[0]?.plain_text || 
                         ''
      
      // Extract terrain types (multi-select)
      const terrain_type = props?.TerrainType?.multi_select?.map((item: any) => item.name) ||
                          props?.Terrain?.multi_select?.map((item: any) => item.name) ||
                          props?.TerrainTypes?.multi_select?.map((item: any) => item.name) ||
                          []
      
      // Extract climate (select)
      const climate = props?.Climate?.select?.name || 
                     props?.Weather?.select?.name || 
                     props?.ClimateType?.select?.name || 
                     'Unknown'
      
      // Extract hazards (multi-select)
      const hazards = props?.Hazards?.multi_select?.map((item: any) => item.name) ||
                     props?.Dangers?.multi_select?.map((item: any) => item.name) ||
                     []
      
      // Extract common creatures (multi-select or relation)
      const common_creatures = props?.CommonCreatures?.multi_select?.map((item: any) => item.name) ||
                              props?.Creatures?.multi_select?.map((item: any) => item.name) ||
                              props?.TypicalCreatures?.multi_select?.map((item: any) => item.name) ||
                              []
      
      // Extract survival DCs (numbers)
      const survival_dc = props?.SurvivalDC?.number || 
                         props?.DC?.number || 
                         15
      
      const foraging_dc = props?.ForagingDC?.number || 
                         props?.ForageDC?.number || 
                         15
      
      const navigation_dc = props?.NavigationDC?.number || 
                           props?.NavDC?.number || 
                           15
      
      // Extract availability (select properties)
      const shelter_availability = props?.ShelterAvailability?.select?.name ||
                                  props?.Shelter?.select?.name ||
                                  'Common'
      
      const water_availability = props?.WaterAvailability?.select?.name ||
                                props?.Water?.select?.name ||
                                'Common'
      
      const food_availability = props?.FoodAvailability?.select?.name ||
                               props?.Food?.select?.name ||
                               'Common'
      
      const environmentData = {
        id: page.id,
        name,
        description,
        terrain_type,
        climate,
        hazards,
        common_creatures,
        survival_dc,
        foraging_dc,
        navigation_dc,
        shelter_availability,
        water_availability,
        food_availability,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
        url: page.url
      }
      
      console.log('✅ Processed environment:', environmentData.name)
      return environmentData
    })

    console.log(`✅ Successfully processed ${environments.length} environments`)
    return createSuccessResponse({ environments })
    
  } catch (error) {
    console.error('❌ Error in fetch-environments:', error)
    return createErrorResponse(error, 'fetch-environments')
  }
})