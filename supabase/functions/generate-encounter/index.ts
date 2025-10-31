import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Client } from 'https://deno.land/x/notion_sdk@v2.2.3/src/mod.ts'
import {
  extractCreature,
  extractChallengeRating,
  extractCreatureType,
  extractEnvironment,
  isValidCreature,
  isValidChallengeRating,
  isValidCreatureType,
  isValidEnvironment,
  resolveRelations,
  CR_VALUES,
  type CreatureDTO
} from '../_shared/notion-extractors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Gold roll mapping by CR
const GOLD_BY_CR: Record<string, string> = {
  '0': '0',
  '1/8': '0',
  '1/4': '1d4',
  '1/2': '2d4',
  '1': '3d4',
  '2': '4d4',
  '3': '2d20',
  '4': '4d20',
  '5': '8d20',
  '6': '16d20',
  '7': '30d20',
  '8': '40d20',
  '9': '60d20',
  '10': '70d20',
  '11': '90d20',
  '12': '190d20',
  '13': '380d20',
  '14': '760d20',
  '15': '1420d20',
  '16': '1900d20',
  '17': '2400d20',
  '18': '2850d20',
  '19': '3333d20',
  '20': '3800d20',
  '21': '4300d20',
  '22': '4750d20',
  '23': '5700d20',
  '24': '6667d20',
  '25': '7600d20',
  '26': '8600d20',
  '27': '9500d20',
  '28': '12000d20',
  '29': '14250d20',
  '30': '190000d20'
}

// Function to roll dice expression (e.g., "3d20", "4d4")
function rollDice(expression: string): number {
  if (expression === '0') return 0

  const match = expression.match(/^(\d+)d(\d+)$/)
  if (!match) return 0

  const count = parseInt(match[1])
  const sides = parseInt(match[2])

  let total = 0
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1
  }

  return total
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
    const VERBOSE_LOGGING = Deno.env.get('VERBOSE_LOGGING') !== 'false' // Default to true
    console.log('🎲 Starting encounter generation...')

    const apiKey = Deno.env.get('NOTION_API_KEY')
    const monstersDbId = Deno.env.get('MONSTERS_DATABASE_ID')

    if (VERBOSE_LOGGING) {
      console.log('Environment check:', {
        hasApiKey: !!apiKey,
        apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'missing',
        monstersDbId: monstersDbId || 'missing',
        verboseLogging: VERBOSE_LOGGING
      })
    }

    if (!apiKey || !monstersDbId) {
      throw new Error('Missing required environment variables: NOTION_API_KEY and MONSTERS_DATABASE_ID')
    }
    
    const params = await req.json()
    console.log('📋 Generation parameters:', params)
    
    const notion = new Client({ auth: apiKey })
    
    // Build filters (only for direct properties, not relations)
    const filters: any[] = []

    // Note: CR, Type, and Environment filtering is done post-query after resolving relations

    // Alignment filter (direct property - select/tag)
    if (params.alignment && params.alignment.length > 0 && !params.alignment.includes('Any')) {
      const alignmentFilters = params.alignment.map(align => {
        // Normalize "True Neutral" to "Neutral" for Notion compatibility
        const notionAlignment = align === 'True Neutral' ? 'Neutral' : align
        return {
          property: 'Alignment',
          select: { equals: notionAlignment }
        }
      })

      if (alignmentFilters.length === 1) {
        filters.push(alignmentFilters[0])
      } else if (alignmentFilters.length > 1) {
        filters.push({ or: alignmentFilters })
      }
    }

    // Size filter (direct property - select/tag)
    if (params.size && params.size.length > 0 && !params.size.includes('Any')) {
      const sizeFilters = params.size.map(s => ({
        property: 'Size',
        select: { equals: s }
      }))

      if (sizeFilters.length === 1) {
        filters.push(sizeFilters[0])
      } else if (sizeFilters.length > 1) {
        filters.push({ or: sizeFilters })
      }
    }
    
    const queryParams: any = {
      database_id: monstersDbId,
      page_size: 100
    }
    
    if (filters.length > 0) {
      queryParams.filter = filters.length === 1 ? filters[0] : {
        and: filters
      }
    }
    
    console.log('🔍 Querying monsters with filters:', JSON.stringify(queryParams, null, 2))
    
    const response = await notion.databases.query(queryParams)
    
    console.log(`📊 Found ${response.results.length} raw pages`)

    // Extract creatures using unified extractor (gets base data + relation IDs)
    console.log('🔍 Starting extraction of creatures...')

    let invalidWarningCount = 0
    const MAX_WARNINGS = 5

    const extractionResults = response.results.map((page, index) => {
      try {
        // Log available properties for first page
        if (VERBOSE_LOGGING && index === 0 && 'properties' in page) {
          console.log('🔍 First page property names:', Object.keys(page.properties))
          console.log('🔍 First page properties sample:', JSON.stringify(page.properties, null, 2).substring(0, 1000))
        }

        const creature = extractCreature(page)
        const isValid = isValidCreature(creature)

        if (VERBOSE_LOGGING && index < 3) { // Log first 3 for debugging
          console.log(`Creature ${index}:`, {
            name: creature.name,
            hasName: !!creature.name,
            crRelation: creature.crRelation,
            typeRelation: creature.typeRelation,
            environmentRelations: creature.environmentRelations,
            isValid
          })
        }

        if (!isValid && invalidWarningCount < MAX_WARNINGS) {
          console.warn(`❌ Invalid creature at index ${index}:`, {
            name: creature.name || 'NO NAME',
            id: creature.id,
            reason: !creature.name ? 'Missing name' : 'Unknown validation failure'
          })
          invalidWarningCount++
          if (invalidWarningCount === MAX_WARNINGS) {
            console.warn(`... suppressing further invalid creature warnings`)
          }
        }

        return { creature, isValid, index }
      } catch (error) {
        if (invalidWarningCount < MAX_WARNINGS) {
          console.error(`💥 Error extracting creature at index ${index}:`, error)
          invalidWarningCount++
        }
        return { creature: null, isValid: false, index, error }
      }
    })

    const baseCreatures = extractionResults
      .filter(r => r.isValid && r.creature)
      .map(r => r.creature!)

    const failedExtractions = extractionResults.filter(r => !r.isValid)

    console.log(`✅ Extracted ${baseCreatures.length} valid creatures`)
    console.log(`❌ Failed to extract ${failedExtractions.length} creatures`)

    // Debug: Log first raw creature's properties to see what fields are available
    if (response.results.length > 0 && VERBOSE_LOGGING) {
      const firstPage = response.results[0]
      if ('properties' in firstPage) {
        console.log('[DEBUG] First monster page properties:', Object.keys(firstPage.properties))
      }
      console.log('[DEBUG] First extracted creature:', JSON.stringify(baseCreatures[0], null, 2))
    }

    if (failedExtractions.length > 0) {
      console.log('Sample failed extractions:', failedExtractions.slice(0, 3))
    }

    // Batch fetch all unique relations ONCE instead of per-creature
    console.log(`🔗 Batch fetching all unique relations...`)

    // Collect all unique relation IDs
    const uniqueCRIds = new Set<string>()
    const uniqueTypeIds = new Set<string>()
    const uniqueSubtypeIds = new Set<string>()
    const uniqueEnvIds = new Set<string>()

    baseCreatures.forEach(creature => {
      if (creature.crRelation) uniqueCRIds.add(creature.crRelation)
      if (creature.typeRelation) uniqueTypeIds.add(creature.typeRelation)
      if (creature.subtypeRelation) uniqueSubtypeIds.add(creature.subtypeRelation)
      if (creature.environmentRelations) {
        creature.environmentRelations.forEach(id => uniqueEnvIds.add(id))
      }
    })

    console.log(`📊 Unique relations to fetch:`, {
      CRs: uniqueCRIds.size,
      Types: uniqueTypeIds.size,
      Subtypes: uniqueSubtypeIds.size,
      Environments: uniqueEnvIds.size
    })

    // Batch fetch all relations in parallel (types and subtypes use same table)
    const [crPages, typePages, subtypePages, envPages] = await Promise.all([
      resolveRelations(notion, Array.from(uniqueCRIds)),
      resolveRelations(notion, Array.from(uniqueTypeIds)),
      resolveRelations(notion, Array.from(uniqueSubtypeIds)),
      resolveRelations(notion, Array.from(uniqueEnvIds))
    ])

    // Create lookup maps for fast access
    const crMap = new Map<string, any>()
    crPages.forEach(page => {
      const cr = extractChallengeRating(page)
      if (isValidChallengeRating(cr)) {
        crMap.set(page.id, cr)
      }
    })

    const typeMap = new Map<string, any>()
    typePages.forEach(page => {
      const type = extractCreatureType(page)
      if (isValidCreatureType(type)) {
        typeMap.set(page.id, type)
      }
    })

    const subtypeMap = new Map<string, any>()
    subtypePages.forEach(page => {
      const subtype = extractCreatureType(page)
      if (isValidCreatureType(subtype)) {
        subtypeMap.set(page.id, subtype)
      }
    })

    const envMap = new Map<string, any>()
    envPages.forEach(page => {
      const env = extractEnvironment(page)
      if (isValidEnvironment(env)) {
        envMap.set(page.id, env)
      }
    })

    console.log(`✅ Cached ${crMap.size} CRs, ${typeMap.size} types, ${subtypeMap.size} subtypes, ${envMap.size} environments`)

    // Now enrich all creatures using the cached data
    console.log(`🔗 Enriching ${baseCreatures.length} creatures using cached data...`)

    const enrichedCreatures = baseCreatures.map(creature => {
      const enriched = { ...creature }

      // Lookup CR from cache
      if (creature.crRelation && crMap.has(creature.crRelation)) {
        const cr = crMap.get(creature.crRelation)!
        enriched.cr = cr.cr_value
        enriched.xp = cr.xp
      }

      // Lookup Type from cache
      if (creature.typeRelation && typeMap.has(creature.typeRelation)) {
        const type = typeMap.get(creature.typeRelation)!
        enriched.type = type.name
      }

      // Lookup Subtype from cache
      if (creature.subtypeRelation && subtypeMap.has(creature.subtypeRelation)) {
        const subtype = subtypeMap.get(creature.subtypeRelation)!
        enriched.subtype = subtype.name
      }

      // Lookup Environments from cache
      if (creature.environmentRelations && creature.environmentRelations.length > 0) {
        enriched.environment = creature.environmentRelations
          .map(id => envMap.get(id)?.name)
          .filter(Boolean)
      }

      return enriched
    })

    console.log(`✨ Enriched ${enrichedCreatures.length} creatures with relation data`)

    // Summary statistics
    const creaturesWithCR = enrichedCreatures.filter(c => c.cr).length
    const creaturesWithType = enrichedCreatures.filter(c => c.type).length
    const creaturesWithEnv = enrichedCreatures.filter(c => c.environment && c.environment.length > 0).length

    console.log(`📊 Enrichment summary:`, {
      total: enrichedCreatures.length,
      withCR: creaturesWithCR,
      withoutCR: enrichedCreatures.length - creaturesWithCR,
      withType: creaturesWithType,
      withoutType: enrichedCreatures.length - creaturesWithType,
      withEnvironment: creaturesWithEnv,
      withoutEnvironment: enrichedCreatures.length - creaturesWithEnv
    })

    // Debug: Log a sample enriched creature with detailed field check
    if (enrichedCreatures.length > 0) {
      const sample = enrichedCreatures[0]
      console.log('Sample enriched creature:', JSON.stringify(sample, null, 2))
      console.log('Sample creature field check:', {
        hasName: !!sample.name,
        name: sample.name,
        hasCR: !!sample.cr,
        cr: sample.cr,
        hasXP: !!sample.xp,
        xp: sample.xp,
        hasImageUrl: !!sample.imageUrl,
        imageUrl: sample.imageUrl,
        hasType: !!sample.type,
        type: sample.type,
        hasSize: !!sample.size,
        size: sample.size,
        hasAlignment: !!sample.alignment,
        alignment: sample.alignment
      })
    }

    // Filter by creature type (now using resolved type names)
    // If no type specified or creature has no type relation, include it
    let typeFiltered = enrichedCreatures
    if (params.creatureType && params.creatureType.length > 0 && !params.creatureType.includes('Any')) {
      typeFiltered = enrichedCreatures.filter(c =>
        c.type && params.creatureType.some((paramType: string) =>
          c.type.toLowerCase().includes(paramType.toLowerCase())
        )
      )
      console.log(`🐉 ${typeFiltered.length} creatures after type filtering (${params.creatureType.join(', ')})`)
      console.log(`   Creatures without type data: ${enrichedCreatures.filter(c => !c.type).length}`)
    }

    // Filter by creature subtype if specified
    let subtypeFiltered = typeFiltered
    if (params.creatureSubtype && params.creatureSubtype.length > 0) {
      subtypeFiltered = typeFiltered.filter(c =>
        c.subtype && params.creatureSubtype.some((paramSubtype: string) =>
          c.subtype.toLowerCase().includes(paramSubtype.toLowerCase())
        )
      )
      console.log(`🦎 ${subtypeFiltered.length} creatures after subtype filtering (${params.creatureSubtype.join(', ')})`)
    }

    // Filter by environment (now using resolved environment names)
    // If no environment specified or creature has no environment relations, include it
    let environmentFiltered = subtypeFiltered
    if (params.environment && params.environment.length > 0 && !params.environment.includes('Any')) {
      environmentFiltered = subtypeFiltered.filter(c =>
        c.environment?.some((env: string) =>
          params.environment.some((paramEnv: string) =>
            env.toLowerCase().includes(paramEnv.toLowerCase())
          )
        )
      )
      console.log(`🌍 ${environmentFiltered.length} creatures after environment filtering (${params.environment.join(', ')})`)
      console.log(`   Creatures without environment data: ${subtypeFiltered.filter(c => !c.environment || c.environment.length === 0).length}`)
    }

    // Filter by CR range (now using resolved CR values)
    const minCRValue = CR_VALUES[params.minCR || '0'] || 0
    const maxCRValue = CR_VALUES[params.maxCR || '30'] || 30

    const filteredCreatures = environmentFiltered.filter(c => {
      if (!c.cr) {
        console.warn(`Creature ${c.name} has no CR data, excluding from results`)
        return false;
      }
      const crValue = CR_VALUES[c.cr] || 0
      return crValue >= minCRValue && crValue <= maxCRValue
    })

    const creaturesWithoutCR = environmentFiltered.filter(c => !c.cr)
    console.log(`🎯 ${filteredCreatures.length} creatures after CR filtering`)
    console.log(`   Creatures without CR data: ${creaturesWithoutCR.length}`)

    if (filteredCreatures.length === 0) {
      // Build diagnostic message
      const diagnosticInfo = {
        totalFetched: response.results.length,
        validExtractions: baseCreatures.length,
        afterTypeFilter: typeFiltered.length,
        afterSubtypeFilter: subtypeFiltered.length,
        afterEnvironmentFilter: environmentFiltered.length,
        creaturesWithoutCR: creaturesWithoutCR.length,
        sampleCreaturesWithoutCR: creaturesWithoutCR.slice(0, 5).map(c => ({
          name: c.name,
          hasCRRelation: !!c.crRelation,
          crRelationId: c.crRelation
        }))
      }

      console.error('❌ No creatures available after filtering:', diagnosticInfo)

      return createSuccessResponse({
        encounter: {
          creatures: [],
          totalXP: 0,
          difficulty: 'No creatures found',
          notes: `Diagnostic: Found ${response.results.length} monsters in database, but ${creaturesWithoutCR.length} are missing CR data. Check that your Challenge Rating relations are properly linked in Notion.`
        }
      })
    }
    
    // Generate encounter using improved algorithm
    const xpThreshold = params.xpThreshold || 1000
    const maxMonsters = params.maxMonsters || 6

    const selectedCreatures: CreatureDTO[] = []
    let totalXP = 0
    let totalMonsterCount = 0

    console.log(`🎲 Starting encounter generation (XP threshold: ${xpThreshold}, max monsters: ${maxMonsters})`)

    // Step 1: Select first monster randomly from all filtered creatures
    const shuffled = [...filteredCreatures].sort(() => Math.random() - 0.5)
    const firstMonster = shuffled[0]

    if (!firstMonster) {
      console.log('❌ No monsters available for selection')
      // Return empty encounter
    } else {
      // Step 2: Roll 1d4 to determine quantity of first monster
      const firstMonsterQuantity = Math.floor(Math.random() * 4) + 1 // 1d4
      const firstMonsterXP = firstMonster.xp || 0

      console.log(`🎲 First monster: ${firstMonster.name} (CR ${firstMonster.cr}, XP: ${firstMonsterXP})`)
      console.log(`🎲 Rolled ${firstMonsterQuantity} for quantity`)

      // Add as many as we can without exceeding XP or monster cap
      let addedCount = 0
      for (let i = 0; i < firstMonsterQuantity; i++) {
        if (totalMonsterCount >= maxMonsters) break
        if (totalXP + firstMonsterXP > xpThreshold) break

        selectedCreatures.push({ ...firstMonster })
        totalXP += firstMonsterXP
        totalMonsterCount++
        addedCount++
      }

      console.log(`✅ Added ${addedCount} of ${firstMonster.name}`)

      // Step 3: Filter pool by first monster's alignment, type, and subtype
      const filterByFirstMonster = (creature: CreatureDTO) => {
        if (creature.alignment && firstMonster.alignment && creature.alignment !== firstMonster.alignment) {
          return false
        }
        if (creature.type && firstMonster.type && creature.type !== firstMonster.type) {
          return false
        }
        if (creature.subtype && firstMonster.subtype && creature.subtype !== firstMonster.subtype) {
          return false
        }
        return true
      }

      let filteredPool = shuffled.filter(filterByFirstMonster)
      console.log(`🎯 Filtered pool to ${filteredPool.length} monsters matching alignment/type/subtype`)

      // Step 4 & 5: Continue adding monsters while under XP and monster cap
      while (totalMonsterCount < maxMonsters && totalXP < xpThreshold) {
        // Filter by remaining XP
        const remainingXP = xpThreshold - totalXP
        const affordableMonsters = filteredPool.filter(c => (c.xp || 0) <= remainingXP)

        if (affordableMonsters.length === 0) {
          console.log('💰 No affordable monsters within remaining XP budget, exiting loop')
          break
        }

        // Shuffle and select next monster
        const nextShuffled = affordableMonsters.sort(() => Math.random() - 0.5)
        const nextMonster = nextShuffled[0]

        // Roll 1d4 for quantity
        const nextQuantity = Math.floor(Math.random() * 4) + 1
        const nextMonsterXP = nextMonster.xp || 0

        console.log(`🎲 Next monster: ${nextMonster.name} (CR ${nextMonster.cr}, XP: ${nextMonsterXP})`)
        console.log(`🎲 Rolled ${nextQuantity} for quantity`)

        // Add as many as we can
        let nextAddedCount = 0
        for (let i = 0; i < nextQuantity; i++) {
          if (totalMonsterCount >= maxMonsters) break
          if (totalXP + nextMonsterXP > xpThreshold) break

          selectedCreatures.push({ ...nextMonster })
          totalXP += nextMonsterXP
          totalMonsterCount++
          nextAddedCount++
        }

        console.log(`✅ Added ${nextAddedCount} of ${nextMonster.name}`)

        // If we couldn't add any, break
        if (nextAddedCount === 0) {
          console.log('⚠️ Could not add any of the next monster, exiting loop')
          break
        }
      }

      console.log(`📊 Final encounter: ${totalMonsterCount} total monsters, ${totalXP} total XP`)
    }
    
    // Determine difficulty
    let difficulty = 'Easy'
    if (totalXP > xpThreshold * 0.8) difficulty = 'Hard'
    else if (totalXP > xpThreshold * 0.5) difficulty = 'Medium'
    
    // Group creatures by ID and calculate gold for each instance
    const creatureGroups = new Map<string, any>()
    let totalGold = 0

    selectedCreatures.forEach(creature => {
      const cr = creature.cr || '0'
      const goldRoll = GOLD_BY_CR[cr] || '0'
      const gold = rollDice(goldRoll)
      totalGold += gold

      if (creatureGroups.has(creature.id)) {
        // Add to existing group
        const existing = creatureGroups.get(creature.id)!
        existing.quantity += 1
        existing.totalGold += gold
        existing.goldRolls.push(goldRoll)
        existing.individualGold.push(gold)
      } else {
        // Create new group
        creatureGroups.set(creature.id, {
          ...creature,
          imageUrl: creature.imageUrl || creature.imageUrls?.[0],
          quantity: 1,
          gold,
          goldRoll,
          totalGold: gold,
          goldRolls: [goldRoll],
          individualGold: [gold]
        })
      }
    })

    const creaturesWithGold = Array.from(creatureGroups.values())

    const encounter = {
      creatures: creaturesWithGold,
      totalXP,
      totalGold,
      difficulty,
      environment: params.environment && params.environment.length > 0 ? params.environment.join(', ') : 'Any',
      notes: `Generated encounter with ${totalMonsterCount} monster(s) of ${creaturesWithGold.length} type(s)`
    }
    
    console.log('✅ Encounter generated successfully')
    
    return createSuccessResponse({ encounter })
    
  } catch (error) {
    console.error('❌ Error in generate-encounter:', error)
    return createErrorResponse(error, 'generate-encounter')
  }
})
