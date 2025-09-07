import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { 
  handleCORS, 
  createNotionClient, 
  validateDatabaseId, 
  createErrorResponse, 
  createSuccessResponse,
  XP_BY_CR
} from '../_shared/notion-utils.ts'
import { EncounterGenerator } from '../_shared/encounter-generator.ts'

interface EncounterRequest {
  environment?: string;
  xpThreshold: number;
  maxMonsters: number;
  minCR: string;
  maxCR: string;
  alignment?: string;
  creatureType?: string;
  size?: string;
}

serve(async (req) => {
  const corsResponse = handleCORS(req)
  if (corsResponse) return corsResponse

  try {
    console.log('🎲 Generate Encounter function called')
    
    const body = await req.json()
    console.log('📋 Request parameters:', body)

    const {
      environment,
      xpThreshold,
      maxMonsters,
      minCR,
      maxCR,
      alignment,
      creatureType,
      size
    }: EncounterRequest = body || {}

    // Validate required parameters
    if (!xpThreshold || xpThreshold <= 0) {
      throw new Error('Valid XP threshold is required')
    }

    if (!maxMonsters || maxMonsters <= 0) {
      throw new Error('Valid max monsters count is required')
    }

    const minCRNum = parseFloat(minCR || '0')
    const maxCRNum = parseFloat(maxCR || '20')

    if (minCRNum < 0 || maxCRNum < minCRNum) {
      throw new Error('Invalid CR range')
    }

    console.log('🔧 Validating Notion API key for encounter generation...')
    const notion = createNotionClient()
    console.log('✅ Notion client created successfully')
    
    // Validate database IDs
    console.log('🐉 Validating monsters catalog database connection...')
    const monstersDbId = validateDatabaseId(
      Deno.env.get('CREATURES_DATABASE_ID'), 
      'Monsters Catalog'
    )
    console.log('✅ Monsters catalog database validated')

    console.log('📋 Validating monster instances database connection...')
    const monsterInstancesDbId = validateDatabaseId(
      Deno.env.get('MONSTER_INSTANCES_DATABASE_ID'), 
      'Monster Instances'
    )
    console.log('✅ Monster instances database validated')

    console.log('🔍 Fetching monsters catalog from Notion...')
    
    // Step 1: Fetch ALL monsters from the catalog database with pagination
    let allMonsters: any[] = []
    let hasMore = true
    let startCursor: string | undefined = undefined
    
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: monstersDbId,
        page_size: 100,
        start_cursor: startCursor
      })
      
      allMonsters = allMonsters.concat(response.results)
      hasMore = response.has_more
      startCursor = response.next_cursor || undefined
      
      console.log(`📦 Fetched ${response.results.length} monsters from catalog, total so far: ${allMonsters.length}`)
    }

    console.log(`📊 Found ${allMonsters.length} total monsters in catalog`)

    if (allMonsters.length === 0) {
      throw new Error('No monsters found in catalog database. Please check your Notion database configuration.')
    }

    // Step 2: Collect all relation IDs for batch processing
    console.log('🔗 Collecting relation IDs for batch resolution...')
    const crRelationIds = new Set<string>()
    const environmentRelationIds = new Set<string>()
    const typeRelationIds = new Set<string>()
    
    for (const monsterPage of allMonsters) {
      const properties = monsterPage.properties
      
      // Collect CR relation IDs
      if (properties['Challenge Rating']?.relation?.[0]?.id) {
        crRelationIds.add(properties['Challenge Rating'].relation[0].id)
      }
      
      // Collect Environment relation IDs
      if (properties.Environment?.relation) {
        properties.Environment.relation.forEach((rel: any) => environmentRelationIds.add(rel.id))
      }
      
      // Collect Type relation IDs
      if (properties['Creature Type']?.relation?.[0]?.id) {
        typeRelationIds.add(properties['Creature Type'].relation[0].id)
      }
    }
    
    console.log(`📊 Found ${crRelationIds.size} unique CR relations, ${environmentRelationIds.size} environment relations, ${typeRelationIds.size} type relations`)
    
    // Step 3: Batch resolve all relations in parallel
    console.log('⚡ Batch resolving relations in parallel...')
    const crMap = new Map<string, number>()
    const environmentMap = new Map<string, string>()
    const typeMap = new Map<string, string>()
    
    // Create parallel promises for all relation resolutions
    const crPromises = Array.from(crRelationIds).map(async (crId) => {
      try {
        const crPage = await notion.pages.retrieve({ page_id: crId })
        const crValue = (crPage as any).properties?.Name?.title?.[0]?.plain_text || 
                       (crPage as any).properties?.CR?.title?.[0]?.plain_text ||
                       (crPage as any).properties?.Value?.number
        if (typeof crValue === 'number') {
          crMap.set(crId, crValue)
        } else if (typeof crValue === 'string') {
          crMap.set(crId, parseFloat(crValue) || 0)
        }
      } catch (error) {
        console.warn(`Failed to resolve CR relation ${crId}:`, error)
        crMap.set(crId, 1)
      }
    })
    
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
    
    const typePromises = Array.from(typeRelationIds).map(async (typeId) => {
      try {
        const typePage = await notion.pages.retrieve({ page_id: typeId })
        const typeName = (typePage as any).properties?.Name?.title?.[0]?.plain_text || 'Unknown Type'
        typeMap.set(typeId, typeName)
      } catch (error) {
        console.warn(`Failed to resolve type relation ${typeId}:`, error)
        typeMap.set(typeId, 'Unknown')
      }
    })
    
    // Wait for all relation resolutions to complete in parallel
    await Promise.all([...crPromises, ...environmentPromises, ...typePromises])
    
    console.log(`✅ Resolved ${crMap.size} CR values, ${environmentMap.size} environments, ${typeMap.size} types`)

    // Step 4: Process monsters catalog data using resolved relations
    const monstersMap = new Map()
    
    for (const monsterPage of allMonsters) {
      const properties = monsterPage.properties
      
      // Debug logging for first few monsters
      if (allMonsters.indexOf(monsterPage) < 3) {
        console.log(`🔍 Debug monster ${allMonsters.indexOf(monsterPage)}:`, JSON.stringify({
          id: monsterPage.id,
          properties: Object.keys(properties),
          monsterNameProperty: properties['Monster Name'],
          nameProperty: properties.Name,
          challengeRatingProperty: properties['Challenge Rating'],
          environmentProperty: properties.Environment,
          creatureTypeProperty: properties['Creature Type'],
          typeProperty: properties.Type,
          iconProperty: monsterPage.icon,
          coverProperty: monsterPage.cover
        }, null, 2))
        
        // Extra debug for creature type specifically
        console.log(`🔍 Creature type debug for monster ${allMonsters.indexOf(monsterPage)}:`, {
          'Creature Type relation': properties['Creature Type']?.relation,
          'Type relation': properties.Type?.relation,
          'CreatureType relation': properties.CreatureType?.relation,
          'Creature Type select': properties['Creature Type']?.select,
          'Type select': properties.Type?.select,
          'CreatureType select': properties.CreatureType?.select
        })
      }
      
      // Extract monster data from catalog
      let name = 'Unknown Monster'
      if (properties['Monster Name']?.title?.[0]?.plain_text) {
        name = properties['Monster Name'].title[0].plain_text
      } else if (properties.Name?.title?.[0]?.plain_text) {
        name = properties.Name.title[0].plain_text
      } else if (properties.Title?.title?.[0]?.plain_text) {
        name = properties.Title.title[0].plain_text
      }

      // Extract image URL from page icon or cover
      let imageUrl = ''
      if (monsterPage.icon?.type === 'external' && monsterPage.icon.external?.url) {
        imageUrl = monsterPage.icon.external.url
      } else if (monsterPage.icon?.type === 'file' && monsterPage.icon.file?.url) {
        imageUrl = monsterPage.icon.file.url
      } else if (monsterPage.cover?.type === 'external' && monsterPage.cover.external?.url) {
        imageUrl = monsterPage.cover.external.url
      } else if (monsterPage.cover?.type === 'file' && monsterPage.cover.file?.url) {
        imageUrl = monsterPage.cover.file.url
      }
      
      const size = properties.Size?.select?.name || ''
      const alignment = properties.Alignment?.select?.name || ''

      // Handle Challenge Rating using pre-resolved map
      let challengeRating = 0
      if (properties['Challenge Rating']?.relation?.[0]?.id) {
        const crId = properties['Challenge Rating'].relation[0].id
        challengeRating = crMap.get(crId) || 1
      } else if (properties['Challenge Rating']?.number !== undefined) {
        challengeRating = properties['Challenge Rating'].number
      } else if (properties.CR?.number !== undefined) {
        challengeRating = properties.CR.number
      }

      // Calculate XP value from CR
      const xpValue = XP_BY_CR[challengeRating.toString()] || 0

      // Handle Environment using pre-resolved map
      let environments: string[] = []
      if (properties.Environment?.relation && properties.Environment.relation.length > 0) {
        environments = properties.Environment.relation.map((rel: any) => 
          environmentMap.get(rel.id) || 'Unknown'
        )
      } else if (properties.Environment?.multi_select) {
        environments = properties.Environment.multi_select.map((env: any) => env.name)
      } else if (properties.Environments?.multi_select) {
        environments = properties.Environments.multi_select.map((env: any) => env.name)
      }

      // Handle Creature Type using pre-resolved map
      let creatureType = ''
      if (properties['Creature Type']?.relation?.[0]?.id) {
        const typeId = properties['Creature Type'].relation[0].id
        creatureType = typeMap.get(typeId) || 'Unknown'
      } else if (properties['Creature Type']?.select?.name) {
        creatureType = properties['Creature Type'].select.name
      } else if (properties.Type?.select?.name) {
        creatureType = properties.Type.select.name
      } else if (properties.CreatureType?.select?.name) {
        creatureType = properties.CreatureType.select.name
      }

      // Store monster in map for lookup
      monstersMap.set(monsterPage.id, {
        id: monsterPage.id,
        name,
        size,
        challenge_rating: challengeRating,
        xp_value: xpValue,
        alignment,
        environment: environments,
        creature_type: creatureType,
        image_url: imageUrl
      })
    }

    console.log(`🗺️ Processed ${monstersMap.size} monsters into catalog map`)

    // Convert map to array for encounter generation (maintaining backward compatibility)
    const creatures = Array.from(monstersMap.values())

    console.log(`🔄 Processed ${creatures.length} creatures for encounter generation`)
    
    // Debug: Log first few processed creatures
    const sampleCreatures = creatures.slice(0, 5)
    console.log('📋 Sample processed creatures:', JSON.stringify(sampleCreatures.map(c => ({
      name: c.name,
      cr: c.challenge_rating,
      xp: c.xp_value,
      type: c.creature_type,
      size: c.size,
      alignment: c.alignment,
      environments: c.environment,
      image_url: c.image_url
    })), null, 2))

    // Create encounter generator
    const generator = new EncounterGenerator(creatures)

    // Generate encounter
    console.log('⚡ Generating encounter...')
    const encounter = generator.generate({
      environment: environment || '',
      xpThreshold,
      maxMonsters,
      minCR: minCRNum,
      maxCR: maxCRNum,
      alignment,
      creatureType,
      size
    })

    if (!encounter) {
      throw new Error('Failed to generate encounter with the given parameters. Try adjusting your filters or XP threshold.')
    }

    console.log('✅ Encounter generated successfully:', {
      environment: encounter.environment,
      totalXP: encounter.total_xp,
      creatureCount: encounter.creatures.length
    })

    // TODO: Create Monster Instance records in the Monster Instances database
    console.log('📝 TODO: Create Monster Instance records for encounter creatures')
    console.log('This would involve creating entries in the Monster Instances database that reference the monsters from the catalog')

    return createSuccessResponse(encounter)

  } catch (error) {
    console.error('❌ Error generating encounter:', error)
    return createErrorResponse(error, 'generate-encounter')
  }
})
