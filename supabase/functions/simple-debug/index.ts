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
    console.log('🔍 Simple debug function called')
    
    const notion = createNotionClient()
    
    // Check environments database
    const environmentsDbId = validateDatabaseId(
      Deno.env.get('ENVIRONMENTS_DATABASE_ID'), 
      'Environments'
    )
    
    const environmentsResponse = await notion.databases.query({
      database_id: environmentsDbId,
      page_size: 3
    })
    
    console.log(`Found ${environmentsResponse.results.length} environments`)
    
    const envPropertyKeys = environmentsResponse.results.length > 0 
      ? Object.keys((environmentsResponse.results[0] as any).properties || {}) 
      : []
    
    // Check creatures database  
    const monstersDbId = validateDatabaseId(
      Deno.env.get('CREATURES_DATABASE_ID'), 
      'Monsters Catalog'
    )
    
    const creaturesResponse = await notion.databases.query({
      database_id: monstersDbId,
      page_size: 3
    })
    
    console.log(`Found ${creaturesResponse.results.length} creatures`)
    
    const creaturePropertyKeys = creaturesResponse.results.length > 0
      ? Object.keys((creaturesResponse.results[0] as any).properties || {})
      : []
    
    const result = {
      environmentsCount: environmentsResponse.results.length,
      creaturesCount: creaturesResponse.results.length,
      environmentPropertyKeys: envPropertyKeys,
      creaturePropertyKeys: creaturePropertyKeys,
      environmentsDbId,
      monstersDbId
    }
    
    console.log('Simple debug result:', result)
    
    return createSuccessResponse(result)
    
  } catch (error) {
    console.error('❌ Simple debug failed:', error)
    return createErrorResponse(error, 'simple-debug')
  }
})
