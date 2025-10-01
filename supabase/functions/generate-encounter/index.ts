import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Client } from 'https://deno.land/x/notion_sdk@v2.2.3/src/mod.ts'

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

// Helper to extract text from various property types
function extractText(properties: any, propertyNames: string[]): string {
  for (const name of propertyNames) {
    const prop = properties[name]
    if (!prop) continue
    
    if (prop.type === 'title' && prop.title?.[0]?.plain_text) {
      return prop.title[0].plain_text
    }
    if (prop.type === 'rich_text' && prop.rich_text?.[0]?.plain_text) {
      return prop.rich_text[0].plain_text
    }
  }
  return ''
}

// Helper to extract number from various property types
function extractNumber(properties: any, propertyNames: string[], defaultValue: number = 0): number {
  for (const name of propertyNames) {
    const prop = properties[name]
    if (prop?.type === 'number' && typeof prop.number === 'number') {
      return prop.number
    }
  }
  return defaultValue
}

// Helper to extract multi-select values
function extractMultiSelect(properties: any, propertyNames: string[]): string[] {
  for (const name of propertyNames) {
    const prop = properties[name]
    if (prop?.type === 'multi_select' && Array.isArray(prop.multi_select)) {
      return prop.multi_select.map((item: any) => item.name)
    }
  }
  return []
}

// CR to numeric value mapping
const CR_VALUES: { [key: string]: number } = {
  '0': 0, '1/8': 0.125, '1/4': 0.25, '1/2': 0.5,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  '11': 11, '12': 12, '13': 13, '14': 14, '15': 15, '16': 16, '17': 17, '18': 18,
  '19': 19, '20': 20, '21': 21, '22': 22, '23': 23, '24': 24, '25': 25, '26': 26,
  '27': 27, '28': 28, '29': 29, '30': 30
}

const XP_BY_CR: { [key: string]: number } = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900,
  '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000,
  '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000,
  '28': 120000, '29': 135000, '30': 155000
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
    
    // Build filters
    const filters: any[] = []
    
    // Note: Environment filtering is done post-query to handle flexible property names
    // The property might be named 'Environment', 'Environments', or 'Terrain'
    
    // CR filter
    if (params.minCR || params.maxCR) {
      const minCR = params.minCR || '0'
      const maxCR = params.maxCR || '30'
      
      filters.push({
        property: 'CR',
        rich_text: {
          is_not_empty: true
        }
      })
    }
    
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
    
    console.log(`📊 Found ${response.results.length} creatures`)
    
    // Parse creatures
    const creatures = response.results.map((page: any) => {
      const props = page.properties
      
      const name = extractText(props, ['Name', 'Creature', 'Monster'])
      const crText = extractText(props, ['CR', 'Challenge Rating', 'ChallengeRating'])
      const size = props.Size?.select?.name || 'Medium'
      const type = props.Type?.select?.name || 'Unknown'
      const alignment = props.Alignment?.select?.name || 'Unaligned'
      const ac = extractNumber(props, ['AC', 'ArmorClass', 'Armor Class'], 10)
      const hp = extractNumber(props, ['HP', 'HitPoints', 'Hit Points'], 10)
      const environment = extractMultiSelect(props, ['Environment', 'Environments', 'Terrain'])
      
      return {
        id: page.id,
        name,
        cr: crText,
        size,
        type,
        alignment,
        ac,
        hp,
        environment,
        xp: XP_BY_CR[crText] || 0
      }
    }).filter(c => c.name && c.cr)
    
    console.log(`✅ Parsed ${creatures.length} valid creatures`)
    
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
    
    const selectedCreatures: any[] = []
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
    
    console.log('✅ Encounter generated successfully:', encounter)
    
    return createSuccessResponse({ encounter })
    
  } catch (error) {
    console.error('❌ Error in generate-encounter:', error)
    return createErrorResponse(error, 'generate-encounter')
  }
})
