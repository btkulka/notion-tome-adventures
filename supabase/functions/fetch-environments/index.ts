import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { 
  handleCORS, 
  createNotionClient, 
  validateDatabaseId, 
  createErrorResponse, 
  createSuccessResponse 
} from '../_shared/notion-utils.ts'

serve(async (req) => {
  const corsResponse = handleCORS(req)
  if (corsResponse) return corsResponse

  try {
    console.log('🌍 Starting environments fetch...')
    
    const notion = createNotionClient()
    const environmentsDbId = validateDatabaseId(
      Deno.env.get('ENVIRONMENTS_DATABASE_ID'), 
      'ENVIRONMENTS_DATABASE_ID'
    )
    
    console.log('🔍 Querying environments database...')
    const response = await notion.databases.query({
      database_id: environmentsDbId,
    })

    console.log(`📋 Processing ${response.results.length} environment records...`)

    const environments = response.results.map((page: any) => {
      console.log('🔍 Processing environment page:', page.id)
      console.log('📊 Page properties:', JSON.stringify(page.properties, null, 2))
      
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
        console.log('⚠️ No standard name property found. Checking alternative keys:', nameKeys)
        
        for (const key of nameKeys) {
          const prop = props[key]
          if (prop?.rich_text?.[0]?.plain_text) {
            name = prop.rich_text[0].plain_text
            console.log(`✅ Found name in ${key} (rich_text):`, name)
            break
          } else if (prop?.select?.name) {
            name = prop.select.name
            console.log(`✅ Found name in ${key} (select):`, name)
            break
          } else if (prop?.title?.[0]?.plain_text) {
            name = prop.title[0].plain_text
            console.log(`✅ Found name in ${key} (title):`, name)
            break
          }
        }
        
        if (name === 'Unknown Environment') {
          console.log('⚠️ Could not find environment name. Available properties:', Object.keys(props || {}))
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
        // Add notion metadata
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
