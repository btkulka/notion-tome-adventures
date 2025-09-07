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
    console.log('🔍 Debug: Checking database schemas...')
    
    const notion = createNotionClient()
    
    // Check environments database schema
    const environmentsDbId = validateDatabaseId(
      Deno.env.get('ENVIRONMENTS_DATABASE_ID'), 
      'ENVIRONMENTS_DATABASE_ID'
    )
    
    console.log('🌍 Getting environments database schema...')
    const envDatabase = await notion.databases.retrieve({
      database_id: environmentsDbId,
    })
    
    console.log('🌍 Environment database properties:')
    console.log(JSON.stringify(envDatabase.properties, null, 2))
    
    // Check creatures database schema
    const creaturesDbId = validateDatabaseId(
      Deno.env.get('CREATURES_DATABASE_ID'), 
      'CREATURES_DATABASE_ID'
    )
    
    console.log('🐉 Getting creatures database schema...')
    const creatureDatabase = await notion.databases.retrieve({
      database_id: creaturesDbId,
    })
    
    console.log('🐉 Creature database properties:')
    console.log(JSON.stringify(creatureDatabase.properties, null, 2))
    
    // Get a sample of each
    console.log('🌍 Getting sample environment...')
    const envSample = await notion.databases.query({
      database_id: environmentsDbId,
      page_size: 1
    })
    
    if (envSample.results.length > 0) {
      console.log('🌍 Sample environment properties:')
      console.log(JSON.stringify(envSample.results[0].properties, null, 2))
    }
    
    console.log('🐉 Getting sample creature...')
    const creatureSample = await notion.databases.query({
      database_id: creaturesDbId,
      page_size: 1
    })
    
    if (creatureSample.results.length > 0) {
      console.log('🐉 Sample creature properties:')
      console.log(JSON.stringify(creatureSample.results[0].properties, null, 2))
    }
    
    return createSuccessResponse({ 
      environmentSchema: envDatabase.properties,
      creatureSchema: creatureDatabase.properties,
      environmentSample: envSample.results[0]?.properties,
      creatureSample: creatureSample.results[0]?.properties
    })
    
  } catch (error) {
    return createErrorResponse(error, 'debug-schemas')
  }
})
