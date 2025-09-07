import { Client } from 'npm:@notionhq/client@2.2.15'

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const XP_BY_CR: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
}

export const ENCOUNTER_MULTIPLIERS = [1, 1.5, 2, 2.5, 3, 4, 5]

export function handleCORS(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  return null
}

export function createNotionClient(): Client {
  const apiKey = Deno.env.get('NOTION_API_KEY')
  if (!apiKey) {
    throw new Error('❌ NOTION_API_KEY environment variable is not set in Supabase Edge Functions. Please configure it using: supabase secrets set NOTION_API_KEY=your_key')
  }
  
  if (apiKey.length < 40) {
    throw new Error('❌ Invalid NOTION_API_KEY format. Please check your API key - it should start with "secret_" and be much longer.')
  }
  
  console.log('✅ Notion API key found and appears valid')
  return new Client({ auth: apiKey })
}

export function validateDatabaseId(databaseId: string | undefined, name: string): string {
  if (!databaseId) {
    throw new Error(`❌ ${name} environment variable is not set in Supabase Edge Functions. Please configure it using: supabase secrets set ${name}=your_database_id`)
  }
  
  // Remove hyphens and validate length
  const cleanId = databaseId.replace(/-/g, '')
  if (cleanId.length !== 32) {
    throw new Error(`❌ Invalid ${name} format. Database ID should be 32 characters (got ${cleanId.length}). Current value: ${databaseId.substring(0, 8)}...`)
  }
  
  console.log(`✅ ${name} found and appears valid: ${databaseId.substring(0, 8)}...`)
  return databaseId
}

export function createErrorResponse(error: unknown, context: string): Response {
  console.error(`Error in ${context}:`, error)
  
  let errorMessage = 'An unexpected error occurred'
  
  // Handle specific Notion API errors
  if (error && typeof error === 'object' && 'code' in error) {
    const notionError = error as { code: string; message?: string }
    errorMessage = notionError.message || errorMessage
    
    if (notionError.code === 'unauthorized') {
      errorMessage = 'Invalid Notion API key. Please check your credentials.'
    } else if (notionError.code === 'object_not_found') {
      errorMessage = 'Notion database not found. Please check the database ID and permissions.'
    } else if (notionError.code === 'rate_limited') {
      errorMessage = 'Rate limit exceeded. Please try again later.'
    }
  } else if (error instanceof Error) {
    errorMessage = error.message
  }
  
  return new Response(
    JSON.stringify({ 
      error: errorMessage,
      context,
      timestamp: new Date().toISOString()
    }),
    {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 500,
    }
  )
}

export function createSuccessResponse(data: unknown): Response {
  return new Response(
    JSON.stringify(data),
    {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    }
  )
}

export function getEncounterMultiplier(numMonsters: number): number {
  if (numMonsters <= 0) return 1
  if (numMonsters >= ENCOUNTER_MULTIPLIERS.length) {
    return ENCOUNTER_MULTIPLIERS[ENCOUNTER_MULTIPLIERS.length - 1]
  }
  return ENCOUNTER_MULTIPLIERS[numMonsters - 1]
}

// Helper function to resolve Notion relation properties
export async function resolveRelationProperty(notion: any, relationId: string): Promise<string | null> {
  try {
    console.log(`🔗 Resolving relation: ${relationId}`)
    const page = await notion.pages.retrieve({ page_id: relationId })
    
    // Try to get the title/name from the related page
    if (page.properties) {
      // Look for common title properties
      for (const [key, prop] of Object.entries(page.properties)) {
        if (prop.type === 'title' && prop.title && prop.title.length > 0) {
          const value = prop.title[0].plain_text
          console.log(`✅ Resolved relation ${relationId} -> ${value}`)
          return value
        }
      }
      
      // Look for name properties
      for (const [key, prop] of Object.entries(page.properties)) {
        if (key.toLowerCase().includes('name') && prop.type === 'rich_text' && prop.rich_text && prop.rich_text.length > 0) {
          const value = prop.rich_text[0].plain_text
          console.log(`✅ Resolved relation ${relationId} -> ${value}`)
          return value
        }
      }
    }
    
    console.log(`⚠️ Could not extract value from relation ${relationId}`)
    return null
  } catch (error) {
    console.error(`❌ Failed to resolve relation ${relationId}:`, error)
    return null
  }
}