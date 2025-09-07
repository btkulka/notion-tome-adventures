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
    console.log('🔍 Starting simple creatures test...')
    
    const notion = createNotionClient()
    const creaturesDbId = validateDatabaseId(
      Deno.env.get('CREATURES_DATABASE_ID'), 
      'CREATURES_DATABASE_ID'
    )
    
    console.log('📋 Creatures Database ID:', creaturesDbId)
    
    // Get just ONE creature to examine the structure
    console.log('🐉 Fetching one creature for examination...')
    const response = await notion.databases.query({
      database_id: creaturesDbId,
      page_size: 1
    })
    
    console.log(`📊 Query returned ${response.results.length} results`)
    
    if (response.results.length > 0) {
      const firstCreature = response.results[0]
      console.log('🔍 First creature ID:', firstCreature.id)
      console.log('🔍 First creature properties keys:', Object.keys(firstCreature.properties))
      console.log('🔍 Full creature properties structure:')
      console.log(JSON.stringify(firstCreature.properties, null, 2))
      
      return createSuccessResponse({ 
        message: 'Successfully examined creature structure',
        creatureId: firstCreature.id,
        propertyKeys: Object.keys(firstCreature.properties),
        fullProperties: firstCreature.properties
      })
    } else {
      return createSuccessResponse({ 
        message: 'No creatures found in database',
        totalResults: response.results.length
      })
    }
    
  } catch (error) {
    console.error('❌ Simple creatures test failed:', error)
    return createErrorResponse(error, 'simple-creatures-test')
  }
})
