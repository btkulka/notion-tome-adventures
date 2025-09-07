import { Client } from 'https://esm.sh/@notionhq/client@2'

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
    throw new Error('NOTION_API_KEY environment variable is not set. Please configure it in Supabase Edge Functions secrets.')
  }
  
  if (apiKey.length < 40) {
    throw new Error('Invalid NOTION_API_KEY format. Please check your API key.')
  }
  
  return new Client({ auth: apiKey })
}

export function validateDatabaseId(databaseId: string | undefined, name: string): string {
  if (!databaseId) {
    throw new Error(`${name} environment variable is not set. Please configure it in Supabase Edge Functions secrets.`)
  }
  
  // Remove hyphens and validate length
  const cleanId = databaseId.replace(/-/g, '')
  if (cleanId.length !== 32) {
    throw new Error(`Invalid ${name} format. Database ID should be 32 characters.`)
  }
  
  return databaseId
}

export function createErrorResponse(error: any, context: string): Response {
  console.error(`Error in ${context}:`, error)
  
  let errorMessage = error.message || 'An unexpected error occurred'
  
  // Handle specific Notion API errors
  if (error.code === 'unauthorized') {
    errorMessage = 'Invalid Notion API key. Please check your credentials.'
  } else if (error.code === 'object_not_found') {
    errorMessage = 'Notion database not found. Please check the database ID and permissions.'
  } else if (error.code === 'rate_limited') {
    errorMessage = 'Rate limit exceeded. Please try again later.'
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

export function createSuccessResponse(data: any): Response {
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