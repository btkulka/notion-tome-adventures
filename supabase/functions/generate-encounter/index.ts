import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Client } from 'https://deno.land/x/notion_sdk@v2.2.3/src/mod.ts'
import { extractCreature, isValidCreature, CR_VALUES, type CreatureDTO } from '../_shared/notion-extractors.ts'

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
    console.log('🎲 Starting encounter generation...')
    
    const apiKey = Deno.env.get('NOTION_API_KEY')
    const creaturesDbId = Deno.env.get('CREATURES_DATABASE_ID')
    
    if (!apiKey || !creaturesDbId) {
      throw new Error('Missing required environment variables')
    }
    
    const params = await req.json()
    console.log('📋 Generation parameters:', params)
    
    const notion = new Client({ auth: apiKey })
    
    // Build filters (only for properties we know exist)
    const filters: any[] = []
    
    // Note: CR filtering is done post-query since property name varies
    
    // Alignment filter
    if (params.alignment && params.alignment !== 'Any') {
      filters.push({
        property: 'Alignment',
        select: {
          equals: params.alignment
        }
      })
    }
    
    // Type filter
    if (params.creatureType && params.creatureType !== 'Any') {
      filters.push({
        property: 'Type',
        select: {
          equals: params.creatureType
        }
      })
    }
    
    // Size filter
    if (params.size && params.size !== 'Any') {
      filters.push({
        property: 'Size',
        select: {
          equals: params.size
        }
      })
    }
    
    const queryParams: any = {
      database_id: creaturesDbId,
      page_size: 100
    }
    
    if (filters.length > 0) {
      queryParams.filter = filters.length === 1 ? filters[0] : {
        and: filters
      }
    }
    
    console.log('🔍 Querying creatures with filters:', JSON.stringify(queryParams, null, 2))
    
    const response = await notion.databases.query(queryParams)
    
    console.log(`📊 Found ${response.results.length} raw pages`)
    
    // Extract creatures using unified extractor
    const creatures = response.results
      .map(page => extractCreature(page))
      .filter(isValidCreature)
    
    console.log(`✅ Extracted ${creatures.length} valid creatures`)
    
    // Filter by environment (post-query since property name varies)
    let environmentFiltered = creatures
    if (params.environment && params.environment !== 'Any') {
      environmentFiltered = creatures.filter(c => 
        c.environment.some((env: string) => 
          env.toLowerCase().includes(params.environment.toLowerCase())
        )
      )
      console.log(`🌍 ${environmentFiltered.length} creatures after environment filtering (${params.environment})`)
    }
    
    // Filter by CR range
    const minCRValue = CR_VALUES[params.minCR || '0'] || 0
    const maxCRValue = CR_VALUES[params.maxCR || '30'] || 30
    
    const filteredCreatures = environmentFiltered.filter(c => {
      const crValue = CR_VALUES[c.cr] || 0
      return crValue >= minCRValue && crValue <= maxCRValue
    })
    
    console.log(`🎯 ${filteredCreatures.length} creatures after CR filtering`)
    
    if (filteredCreatures.length === 0) {
      return createSuccessResponse({
        encounter: {
          creatures: [],
          totalXP: 0,
          difficulty: 'No creatures found',
          notes: 'Try adjusting your filters to find matching creatures.'
        }
      })
    }
    
    // Generate encounter
    const xpThreshold = params.xpThreshold || 1000
    const maxMonsters = params.maxMonsters || 6
    
    const selectedCreatures: CreatureDTO[] = []
    let totalXP = 0
    
    // Simple random selection within XP budget
    const shuffled = [...filteredCreatures].sort(() => Math.random() - 0.5)
    
    for (const creature of shuffled) {
      if (selectedCreatures.length >= maxMonsters) break
      if (totalXP + creature.xp <= xpThreshold) {
        selectedCreatures.push(creature)
        totalXP += creature.xp
      }
    }
    
    // Determine difficulty
    let difficulty = 'Easy'
    if (totalXP > xpThreshold * 0.8) difficulty = 'Hard'
    else if (totalXP > xpThreshold * 0.5) difficulty = 'Medium'
    
    const encounter = {
      creatures: selectedCreatures,
      totalXP,
      difficulty,
      environment: params.environment || 'Any',
      notes: `Generated encounter with ${selectedCreatures.length} creature(s)`
    }
    
    console.log('✅ Encounter generated successfully')
    
    return createSuccessResponse({ encounter })
    
  } catch (error) {
    console.error('❌ Error in generate-encounter:', error)
    return createErrorResponse(error, 'generate-encounter')
  }
})
