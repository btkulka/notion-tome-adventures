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
    const environmentsDbId = validateDatabaseId(
      Deno.env.get('ENVIRONMENTS_DATABASE_ID'), 
      'ENVIRONMENTS_DATABASE_ID'
    )
    
    console.log('Fetching environments from database:', environmentsDbId)
    
    const notion = createNotionClient()
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

    console.log(`Successfully fetched ${environments.length} environments`)
    return createSuccessResponse({ environments })
    
  } catch (error) {
    return createErrorResponse(error, 'fetch-environments')
  }
})