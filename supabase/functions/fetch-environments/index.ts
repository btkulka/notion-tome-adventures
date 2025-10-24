import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Client } from 'https://deno.land/x/notion_sdk@v2.2.3/src/mod.ts'
import { extractEnvironment, isValidEnvironment } from '../_shared/notion-extractors.ts'

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
    console.log('🌍 Fetching environments...')
    
    const apiKey = Deno.env.get('NOTION_API_KEY')
    const environmentsDbId = Deno.env.get('ENVIRONMENTS_DATABASE_ID')
    
    if (!apiKey || !environmentsDbId) {
      throw new Error('Missing required environment variables')
    }
    
    const notion = new Client({ auth: apiKey })
    
    console.log('✅ Querying Notion database...')
    
    const response = await notion.databases.query({
      database_id: environmentsDbId
    })

    console.log(`📋 Found ${response.results.length} raw pages`)

    // Extract environments using unified extractor
    const environments = response.results
      .map(page => extractEnvironment(page))
      .filter(isValidEnvironment)

    console.log(`✅ Extracted ${environments.length} valid environments`)
    
    return createSuccessResponse({ environments })
    
  } catch (error) {
    console.error('❌ Error in fetch-environments:', error)
    return createErrorResponse(error, 'fetch-environments')
  }
})
