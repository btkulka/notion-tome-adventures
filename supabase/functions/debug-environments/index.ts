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
    console.log('🔍 Debug environments function called')
    
    const notion = createNotionClient()
    
    // Get environments from the Environments database
    const environmentsDbId = validateDatabaseId(
      Deno.env.get('ENVIRONMENTS_DATABASE_ID'), 
      'Environments'
    )
    
    console.log('📋 Fetching environments database...')
    const environmentsResponse = await notion.databases.query({
      database_id: environmentsDbId,
      page_size: 100
    })
    
    console.log(`📊 Raw environments response: ${environmentsResponse.results.length} results`)
    
    // Debug: Log the first environment's properties
    if (environmentsResponse.results.length > 0) {
      const firstEnv = environmentsResponse.results[0] as any
      console.log('🔍 First environment properties:', JSON.stringify(firstEnv.properties, null, 2))
    }
    
    const environmentsInDb = environmentsResponse.results.map((page: any) => {
      console.log(`🔍 Processing environment page ${page.id}`)
      const name = page.properties?.Environment?.title?.[0]?.plain_text || 
                   page.properties?.Name?.title?.[0]?.plain_text || 'Unknown'
      console.log(`📋 Extracted name: "${name}"`)
      return name
    }).filter(name => name !== 'Unknown')
    
    console.log(`📊 Environments found in DB: ${environmentsInDb.length}`, environmentsInDb)
    
    // Get environments from creatures
    const monstersDbId = validateDatabaseId(
      Deno.env.get('CREATURES_DATABASE_ID'), 
      'Monsters Catalog'
    )
    
    console.log('🐉 Fetching creatures database...')
    // Fetch sample creatures to see their environments
    const creaturesResponse = await notion.databases.query({
      database_id: monstersDbId,
      page_size: 20  // Reduced for easier debugging
    })
    
    console.log(`📊 Raw creatures response: ${creaturesResponse.results.length} results`)
    
    // Debug: Log the first creature's properties
    if (creaturesResponse.results.length > 0) {
      const firstCreature = creaturesResponse.results[0] as any
      console.log('🔍 First creature properties:', JSON.stringify(firstCreature.properties, null, 2))
      console.log('🔍 First creature property keys:', Object.keys(firstCreature.properties || {}))
    }
    
    // Collect environment relation IDs
    const environmentRelationIds = new Set<string>()
    
    console.log('🔗 Collecting environment relations from creatures...')
    creaturesResponse.results.forEach((monsterPage: any, index: number) => {
      const properties = monsterPage.properties
      
      if (index < 3) {
        console.log(`🔍 Creature ${index} property keys:`, Object.keys(properties))
        console.log(`🔍 Creature ${index} Environment property:`, properties.Environment)
        console.log(`🔍 Creature ${index} Environments property:`, properties.Environments)
        console.log(`🔍 Creature ${index} Biome property:`, properties.Biome)
      }
      
      if (properties.Environment?.relation) {
        console.log(`📋 Found Environment relation for creature ${index}:`, properties.Environment.relation.length, 'items')
        properties.Environment.relation.forEach((rel: any) => environmentRelationIds.add(rel.id))
      }
      if (properties.Environments?.relation) {
        console.log(`📋 Found Environments relation for creature ${index}:`, properties.Environments.relation.length, 'items')
        properties.Environments.relation.forEach((rel: any) => environmentRelationIds.add(rel.id))
      }
      if (properties.Biome?.relation) {
        console.log(`📋 Found Biome relation for creature ${index}:`, properties.Biome.relation.length, 'items')
        properties.Biome.relation.forEach((rel: any) => environmentRelationIds.add(rel.id))
      }
    })
    
    console.log(`🔗 Total unique environment relation IDs: ${environmentRelationIds.size}`)
    
    // Resolve environment names
    const environmentMap = new Map<string, string>()
    const environmentPromises = Array.from(environmentRelationIds).map(async (envId) => {
      try {
        const envPage = await notion.pages.retrieve({ page_id: envId })
        const envName = (envPage as any).properties?.Name?.title?.[0]?.plain_text || 'Unknown'
        environmentMap.set(envId, envName)
      } catch (error) {
        console.warn(`Failed to resolve environment relation ${envId}:`, error)
        environmentMap.set(envId, 'Unknown')
      }
    })
    
    await Promise.all(environmentPromises)
    
    // Get unique environments used by creatures
    const environmentsUsedByCreatures = new Set<string>()
    
    creaturesResponse.results.forEach((monsterPage: any) => {
      const properties = monsterPage.properties
      
      // Handle relation-based environments
      if (properties.Environment?.relation) {
        properties.Environment.relation.forEach((rel: any) => {
          const envName = environmentMap.get(rel.id)
          if (envName && envName !== 'Unknown') {
            environmentsUsedByCreatures.add(envName)
          }
        })
      }
      if (properties.Environments?.relation) {
        properties.Environments.relation.forEach((rel: any) => {
          const envName = environmentMap.get(rel.id)
          if (envName && envName !== 'Unknown') {
            environmentsUsedByCreatures.add(envName)
          }
        })
      }
      if (properties.Biome?.relation) {
        properties.Biome.relation.forEach((rel: any) => {
          const envName = environmentMap.get(rel.id)
          if (envName && envName !== 'Unknown') {
            environmentsUsedByCreatures.add(envName)
          }
        })
      }
      
      // Handle multi-select and select environments
      if (properties.Environment?.multi_select) {
        properties.Environment.multi_select.forEach((env: any) => {
          if (env.name) environmentsUsedByCreatures.add(env.name)
        })
      }
      if (properties.Environment?.select?.name) {
        environmentsUsedByCreatures.add(properties.Environment.select.name)
      }
    })
    
    const result = {
      environmentsInDatabase: environmentsInDb.sort(),
      environmentsUsedByCreatures: Array.from(environmentsUsedByCreatures).sort(),
      environmentsInDbButNotUsed: environmentsInDb.filter(env => !environmentsUsedByCreatures.has(env)).sort(),
      environmentsUsedButNotInDb: Array.from(environmentsUsedByCreatures).filter(env => !environmentsInDb.includes(env)).sort(),
      totalCreatures: creaturesResponse.results.length,
      totalEnvironments: environmentsInDb.length
    }
    
    console.log('🎯 Environment debug complete:', result)
    
    return createSuccessResponse(result)
    
  } catch (error) {
    console.error('❌ Debug environments failed:', error)
    return createErrorResponse(`Debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})
