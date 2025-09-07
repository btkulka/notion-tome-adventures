import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { 
  handleCORS, 
  createNotionClient, 
  createErrorResponse, 
  createSuccessResponse 
} from '../_shared/notion-utils.ts'

serve(async (req) => {
  const corsResponse = handleCORS(req)
  if (corsResponse) return corsResponse

  try {
    const { databaseId } = await req.json()
    
    if (!databaseId) {
      throw new Error('Database ID is required')
    }

    console.log('Fetching schema for database:', databaseId)
    const notion = createNotionClient()

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

    const schemaData = {
      id: database.id,
      title: database.title?.[0]?.plain_text || 'Untitled',
      properties,
      url: database.url,
    }
    
    console.log(`Successfully retrieved schema for "${schemaData.title}" with ${properties.length} properties`)
    return createSuccessResponse(schemaData)
    
  } catch (error) {
    return createErrorResponse(error, 'get-notion-schema')
  }
})