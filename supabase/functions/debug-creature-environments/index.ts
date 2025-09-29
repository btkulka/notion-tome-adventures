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
    console.log('🔍 Debug creature environments function called')
    
    // Validate Notion API key
    console.log('🔧 Validating Notion API key...')
    const notion = createNotionClient()
    console.log('✅ Notion client created successfully')
    
    // Validate database IDs
    const monstersDbId = validateDatabaseId(
      Deno.env.get('CREATURES_DATABASE_ID'), 
      'Monsters Catalog'
    )
    
    const environmentsDbId = validateDatabaseId(
      Deno.env.get('ENVIRONMENTS_DATABASE_ID'), 
      'Environments'
    )
    
    console.log('📊 Fetching environments database...')
    
    // Fetch all environments
    const environmentsResponse = await notion.databases.query({
      database_id: environmentsDbId,
      page_size: 100
    })
    
    const environments = environmentsResponse.results.map((page: any) => ({
      id: page.id,
      name: page.properties?.Name?.title?.[0]?.plain_text || 'Unknown'
    }))
    
    console.log(`📋 Found ${environments.length} environments:`, environments.map(e => e.name))
    
    console.log('🐉 Fetching first 20 creatures from database...')
    
    // Fetch sample creatures
    const creaturesResponse = await notion.databases.query({
      database_id: monstersDbId,
      page_size: 20
    })
    
    console.log(`📦 Fetched ${creaturesResponse.results.length} sample creatures`)
    
    // Collect environment relation IDs from creatures
    const environmentRelationIds = new Set<string>()
    
    creaturesResponse.results.forEach((monsterPage: any) => {
      const properties = monsterPage.properties
      
      // Collect Environment relation IDs
      if (properties.Environment?.relation) {
        properties.Environment.relation.forEach((rel: any) => environmentRelationIds.add(rel.id))
      }
      if (properties.Environments?.relation) {
        properties.Environments.relation.forEach((rel: any) => environmentRelationIds.add(rel.id))
      }
      if (properties.Biome?.relation) {
        properties.Biome.relation.forEach((rel: any) => environmentRelationIds.add(rel.id))
      }
    })
    
    console.log(`🔗 Found ${environmentRelationIds.size} unique environment relation IDs used by creatures`)
    
    // Resolve environment relations
    const environmentMap = new Map<string, string>()
    const environmentPromises = Array.from(environmentRelationIds).map(async (envId) => {
      try {
        const envPage = await notion.pages.retrieve({ page_id: envId })
        const envName = (envPage as any).properties?.Name?.title?.[0]?.plain_text || 'Unknown Environment'
        environmentMap.set(envId, envName)
      } catch (error) {
        console.warn(`Failed to resolve environment relation ${envId}:`, error)
        environmentMap.set(envId, 'Unknown')
      }
    })
    
    await Promise.all(environmentPromises)
    
    // Process creatures and their environments
    const creatureEnvironments: Array<{
      name: string,
      environments: string[]
    }> = []
    
    for (const monsterPage of creaturesResponse.results) {
      const properties = (monsterPage as any).properties
      
      const name = properties.Name?.title?.[0]?.plain_text || 
                   properties.Title?.title?.[0]?.plain_text || 
                   'Unknown Creature'
      
      let environments: string[] = []
      
      // Handle Environment using resolved map
      if (properties.Environment?.relation && properties.Environment.relation.length > 0) {
        environments = properties.Environment.relation.map((rel: any) => 
          environmentMap.get(rel.id) || 'Unknown'
        )
      } else if (properties.Environments?.relation && properties.Environments.relation.length > 0) {
        environments = properties.Environments.relation.map((rel: any) => 
          environmentMap.get(rel.id) || 'Unknown'
        )
      } else if (properties.Biome?.relation && properties.Biome.relation.length > 0) {
        environments = properties.Biome.relation.map((rel: any) => 
          environmentMap.get(rel.id) || 'Unknown'
        )
      } else if (properties.Environment?.multi_select) {
        environments = properties.Environment.multi_select.map((env: any) => env.name)
      } else if (properties.Environments?.multi_select) {
        environments = properties.Environments.multi_select.map((env: any) => env.name)
      } else if (properties.Biome?.multi_select) {
        environments = properties.Biome.multi_select.map((env: any) => env.name)
      } else if (properties.Environment?.select?.name) {
        environments = [properties.Environment.select.name]
      } else if (properties.Environments?.select?.name) {
        environments = [properties.Environments.select.name]
      } else if (properties.Biome?.select?.name) {
        environments = [properties.Biome.select.name]
      }
      
      creatureEnvironments.push({
        name,
        environments: environments.filter(env => env !== 'Unknown')
      })
    }
    
    // Create summary of environments used by creatures
    const usedEnvironments = new Set<string>()
    creatureEnvironments.forEach(creature => {
      creature.environments.forEach(env => usedEnvironments.add(env))
    })
    
    const debugInfo = {
      totalEnvironmentsInDatabase: environments.length,
      environmentNames: environments.map(e => e.name).sort(),
      sampleCreatures: creatureEnvironments,
      environmentsUsedByCreatures: Array.from(usedEnvironments).sort(),
      environmentsInDbButNotUsed: environments.map(e => e.name).filter(name => !usedEnvironments.has(name)).sort(),
      environmentsUsedButNotInDb: Array.from(usedEnvironments).filter(name => !environments.map(e => e.name).includes(name)).sort()
    }
    
    console.log('🎯 Debug analysis complete:', JSON.stringify(debugInfo, null, 2))
    
    return createSuccessResponse(debugInfo)
    
  } catch (error) {
    console.error('❌ Debug function failed:', error)
    return createErrorResponse(`Debug failed: ${error.message}`, 500)
  }
})
