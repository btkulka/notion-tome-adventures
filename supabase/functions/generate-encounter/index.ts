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
      
      // Collect CR relation IDs with detailed logging
      if (properties['Challenge Rating']?.relation?.[0]?.id) {
        const crId = properties['Challenge Rating'].relation[0].id
        crRelationIds.add(crId)
        if (crRelationIds.size <= 5) {
          console.log(`🔍 Found CR relation ID: ${crId} for monster: ${properties.Name?.title?.[0]?.plain_text || properties['Monster Name']?.title?.[0]?.plain_text || 'Unknown'}`)
        }
      } else {
        // Log monsters that don't have Challenge Rating relations
        if (crRelationIds.size <= 5) {
          console.log(`⚠️ No CR relation for monster: ${properties.Name?.title?.[0]?.plain_text || properties['Monster Name']?.title?.[0]?.plain_text || 'Unknown'}`, {
            'Challenge Rating property': properties['Challenge Rating'],
            'CR property': properties.CR,
            'Available properties': Object.keys(properties)
          })
        }
      }
      
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
      
      // Collect Type relation IDs
      if (properties['Creature Type']?.relation?.[0]?.id) {
        typeRelationIds.add(properties['Creature Type'].relation[0].id)
      }
      if (properties['Monster Type']?.relation?.[0]?.id) {
        typeRelationIds.add(properties['Monster Type'].relation[0].id)
      }
      if (properties.Type?.relation?.[0]?.id) {
        typeRelationIds.add(properties.Type.relation[0].id)
      }
      if (properties.Category?.relation?.[0]?.id) {
        typeRelationIds.add(properties.Category.relation[0].id)
      }
    }
    
    console.log(`📊 Found ${crRelationIds.size} unique CR relations, ${environmentRelationIds.size} environment relations, ${typeRelationIds.size} type relations`)
    
    // Debug: Log what we found
    console.log(`🔍 Sample CR relation IDs: ${Array.from(crRelationIds).slice(0, 5).join(', ')}`)
    console.log(`🔍 Total monsters with CR relations: ${Array.from(crRelationIds).length}`)
    console.log(`🔍 Total monsters processed: ${allMonsters.length}`)
    
    if (crRelationIds.size === 0) {
      console.log('⚠️ NO CHALLENGE RATING RELATIONS FOUND! This means all monsters will default to CR 1')
      console.log('🔍 Sample monster properties for debugging:')
      allMonsters.slice(0, 3).forEach((monster, index) => {
        console.log(`Monster ${index}:`, {
          name: monster.properties?.Name?.title?.[0]?.plain_text || monster.properties?.['Monster Name']?.title?.[0]?.plain_text,
          properties: Object.keys(monster.properties),
          challengeRating: monster.properties?.['Challenge Rating'],
          CR: monster.properties?.CR,
          Challenge_Level: monster.properties?.['Challenge Level']
        })
      })
    }
    
    // Step 3: Batch resolve all relations in parallel
    console.log('⚡ Batch resolving relations in parallel...')
    const crMap = new Map<string, number>()
    const environmentMap = new Map<string, string>()
    const typeMap = new Map<string, string>()
    
    // Create parallel promises for all relation resolutions
    const crPromises = Array.from(crRelationIds).map(async (crId) => {
      try {
        const crPage = await notion.pages.retrieve({ page_id: crId })
        
        // Debug: Log the CR page structure for the first few
        if (Array.from(crRelationIds).indexOf(crId) < 3) {
          console.log(`🔍 CR Page Debug for ${crId}:`, {
            page_id: crId,
            properties: Object.keys((crPage as any).properties || {}),
            Challenge_Level_property: (crPage as any).properties?.['Challenge Level'],
            Challenge_Level_title: (crPage as any).properties?.['Challenge Level']?.title,
            Challenge_Level_title_text: (crPage as any).properties?.['Challenge Level']?.title?.[0]?.plain_text,
            Name_property: (crPage as any).properties?.Name,
            CR_property: (crPage as any).properties?.CR,
            Value_property: (crPage as any).properties?.Value,
            Challenge_Rating_property: (crPage as any).properties?.['Challenge Rating']
          })
        }
        
        // Try multiple property names for CR value extraction
        let crValue: number | string | undefined
        
        // Try Challenge Level title field (this is the correct property name)
        if ((crPage as any).properties?.['Challenge Level']?.title?.[0]?.plain_text) {
          crValue = (crPage as any).properties['Challenge Level'].title[0].plain_text
        }
        // Try Name title field (common for relation pages)
        else if ((crPage as any).properties?.Name?.title?.[0]?.plain_text) {
          crValue = (crPage as any).properties.Name.title[0].plain_text
        }
        // Try CR title field
        else if ((crPage as any).properties?.CR?.title?.[0]?.plain_text) {
          crValue = (crPage as any).properties.CR.title[0].plain_text
        }
        // Try Challenge Rating title field
        else if ((crPage as any).properties?.['Challenge Rating']?.title?.[0]?.plain_text) {
          crValue = (crPage as any).properties['Challenge Rating'].title[0].plain_text
        }
        // Try Value number field
        else if ((crPage as any).properties?.Value?.number !== undefined) {
          crValue = (crPage as any).properties.Value.number
        }
        // Try CR number field
        else if ((crPage as any).properties?.CR?.number !== undefined) {
          crValue = (crPage as any).properties.CR.number
        }
        // Try Challenge Rating number field
        else if ((crPage as any).properties?.['Challenge Rating']?.number !== undefined) {
          crValue = (crPage as any).properties['Challenge Rating'].number
        }
        // Try Challenge Level number field
        else if ((crPage as any).properties?.['Challenge Level']?.number !== undefined) {
          crValue = (crPage as any).properties['Challenge Level'].number
        }
        
        console.log(`🔍 CR ${crId} extraction result: "${crValue}" (type: ${typeof crValue})`)
        
        // Additional debug for Challenge Level specifically
        if (Array.from(crRelationIds).indexOf(crId) < 3) {
          console.log(`🔍 Detailed Challenge Level extraction for ${crId}:`, {
            'Challenge Level exists': !!(crPage as any).properties?.['Challenge Level'],
            'Challenge Level type': (crPage as any).properties?.['Challenge Level']?.type,
            'Challenge Level title exists': !!(crPage as any).properties?.['Challenge Level']?.title,
            'Challenge Level title array': (crPage as any).properties?.['Challenge Level']?.title,
            'Challenge Level title length': (crPage as any).properties?.['Challenge Level']?.title?.length,
            'Challenge Level title[0]': (crPage as any).properties?.['Challenge Level']?.title?.[0],
            'Challenge Level plain_text': (crPage as any).properties?.['Challenge Level']?.title?.[0]?.plain_text,
            'Raw crValue before parsing': crValue
          })
        }
        
        if (typeof crValue === 'number') {
          crMap.set(crId, crValue)
        } else if (typeof crValue === 'string') {
          const parsedCR = parseFloat(crValue) || 0
          console.log(`🔍 CR ${crId} parsed "${crValue}" -> ${parsedCR}`)
          crMap.set(crId, parsedCR)
        } else {
          console.warn(`🔍 CR ${crId} no valid value found, defaulting to 1`)
          crMap.set(crId, 1)
        }
      } catch (error) {
        console.warn(`Failed to resolve CR relation ${crId}:`, error)
        crMap.set(crId, 1)
      }
    })
    
    const environmentPromises = Array.from(environmentRelationIds).map(async (envId) => {
      try {
        const envPage = await notion.pages.retrieve({ page_id: envId })
        const envName = (envPage as any).properties?.Environment?.title?.[0]?.plain_text || 
                       (envPage as any).properties?.Name?.title?.[0]?.plain_text || 'Unknown Environment'
        environmentMap.set(envId, envName)
      } catch (error) {
        console.warn(`Failed to resolve environment relation ${envId}:`, error)
        environmentMap.set(envId, 'Unknown')
      }
    })
    
    const typePromises = Array.from(typeRelationIds).map(async (typeId) => {
      try {
        const typePage = await notion.pages.retrieve({ page_id: typeId })
        console.log(`🔍 Type relation debug for ${typeId}:`, {
          page_id: typeId,
          properties: Object.keys((typePage as any).properties || {}),
          Name_property: (typePage as any).properties?.Name,
          Title_property: (typePage as any).properties?.Title,
          Type_property: (typePage as any).properties?.Type,
          full_properties: JSON.stringify((typePage as any).properties, null, 2)
        })
        
        const typeName = (typePage as any).properties?.['Creature Type']?.title?.[0]?.plain_text ||
                        (typePage as any).properties?.Name?.title?.[0]?.plain_text || 
                        (typePage as any).properties?.Title?.title?.[0]?.plain_text ||
                        (typePage as any).properties?.Type?.title?.[0]?.plain_text ||
                        'Unknown Type'
        console.log(`🔍 Resolved type ${typeId} to: "${typeName}"`)
        typeMap.set(typeId, typeName)
      } catch (error) {
        console.warn(`Failed to resolve type relation ${typeId}:`, error)
        typeMap.set(typeId, 'Unknown')
      }
    })
    
    // Wait for all relation resolutions to complete in parallel
    try {
      console.log('⚡ Starting parallel relation resolution...')
      await Promise.all([...crPromises, ...environmentPromises, ...typePromises])
      console.log('✅ All relation resolutions completed successfully')
    } catch (error) {
      console.error('❌ Error during relation resolution:', error)
      // Don't throw here, continue with what we have
    }
    
    console.log(`✅ Resolved ${crMap.size} CR values, ${environmentMap.size} environments, ${typeMap.size} types`)
    console.log('🔍 Type map contents:', Object.fromEntries(typeMap))

    // Step 4: Process monsters catalog data using resolved relations
    const monstersMap = new Map()
    
    console.log('🔄 Processing monsters catalog data...')
    for (const monsterPage of allMonsters) {
      try {
        const properties = monsterPage.properties
      
      // Debug logging for first few monsters
      if (allMonsters.indexOf(monsterPage) < 3) {
        console.log(`🔍 Debug monster ${allMonsters.indexOf(monsterPage)}:`, JSON.stringify({
          id: monsterPage.id,
          properties: Object.keys(properties),
          monsterNameProperty: properties['Monster Name'],
          nameProperty: properties.Name,
          challengeRatingProperty: properties['Challenge Rating'],
          challengeRatingRelation: properties['Challenge Rating']?.relation,
          challengeRatingNumber: properties['Challenge Rating']?.number,
          CRProperty: properties.CR,
          environmentProperty: properties.Environment,
          creatureTypeProperty: properties['Creature Type'],
          typeProperty: properties.Type,
          iconProperty: monsterPage.icon,
          coverProperty: monsterPage.cover
        }, null, 2))
        
        // Extra debug for challenge rating specifically
        console.log(`🔍 Challenge Rating debug for monster ${allMonsters.indexOf(monsterPage)}:`, {
          'Available properties': Object.keys(properties),
          'Challenge Rating relation': properties['Challenge Rating']?.relation,
          'Challenge Rating number': properties['Challenge Rating']?.number,
          'CR relation': properties.CR?.relation,
          'CR number': properties.CR?.number,
          'Challenge Level relation': properties['Challenge Level']?.relation,
          'Challenge Level number': properties['Challenge Level']?.number,
          'crRelationIds collected': Array.from(crRelationIds),
          'This monster CR relation ID': properties['Challenge Rating']?.relation?.[0]?.id
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

      // Debug logging for size and alignment extraction
      if (allMonsters.indexOf(monsterPage) < 3) {
        console.log(`🔍 Size and alignment extraction for monster ${allMonsters.indexOf(monsterPage)}:`, {
          'Size property': properties.Size,
          'Size select': properties.Size?.select,
          'Size name': properties.Size?.select?.name,
          'extracted size': size,
          'Alignment property': properties.Alignment,
          'Alignment select': properties.Alignment?.select,
          'Alignment name': properties.Alignment?.select?.name,
          'extracted alignment': alignment
        })
      }

      // Handle Challenge Rating using pre-resolved map
      let challengeRating = 0
      let crSource = 'none'
      
      if (properties['Challenge Rating']?.relation?.[0]?.id) {
        const crId = properties['Challenge Rating'].relation[0].id
        challengeRating = crMap.get(crId) || 1
        crSource = `Challenge Rating relation -> ${crId} -> ${challengeRating}`
      } else if (properties['Challenge Rating']?.number !== undefined) {
        challengeRating = properties['Challenge Rating'].number
        crSource = `Challenge Rating number -> ${challengeRating}`
      } else if (properties.CR?.number !== undefined) {
        challengeRating = properties.CR.number
        crSource = `CR number -> ${challengeRating}`
      } else {
        challengeRating = 1 // Default fallback
        crSource = 'default fallback -> 1'
      }

      // Debug logging for CR extraction for first few monsters
      if (allMonsters.indexOf(monsterPage) < 3) {
        console.log(`🔍 CR extraction for ${name}:`, {
          'Available properties': Object.keys(properties),
          'Challenge Rating property': properties['Challenge Rating'],
          'CR property': properties.CR,
          'crSource': crSource,
          'final challengeRating': challengeRating,
          'crMap size': crMap.size,
          'crMap sample': Object.fromEntries(Array.from(crMap.entries()).slice(0, 3))
        })
      }

      // Calculate XP value from CR
      const xpValue = XP_BY_CR[challengeRating.toString()] || 0
      
      // Debug XP calculation for first few monsters
      if (allMonsters.indexOf(monsterPage) < 3) {
        console.log(`🔍 XP calculation for ${name}: CR ${challengeRating} -> ${xpValue} XP`)
      }

      // Handle Environment using pre-resolved map
      let environments: string[] = []
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

      // Debug log the extracted environments for first few monsters
      if (allMonsters.indexOf(monsterPage) < 3) {
        console.log(`🔍 Environment extraction for ${name}:`, {
          'Environment relation': properties.Environment?.relation,
          'Environments relation': properties.Environments?.relation,
          'Biome relation': properties.Biome?.relation,
          'Environment multi_select': properties.Environment?.multi_select,
          'Environments multi_select': properties.Environments?.multi_select,
          'Biome multi_select': properties.Biome?.multi_select,
          'Environment select': properties.Environment?.select,
          'extracted environments': environments
        });
      }

      // Handle Creature Type using pre-resolved map
      let creatureType = ''
      let creatureTypeSource = 'none'
      
      if (properties['Creature Type']?.relation?.[0]?.id) {
        const typeId = properties['Creature Type'].relation[0].id
        creatureType = typeMap.get(typeId) || 'Unknown'
        creatureTypeSource = `Creature Type relation -> ${typeId}`
      } else if (properties['Monster Type']?.relation?.[0]?.id) {
        const typeId = properties['Monster Type'].relation[0].id
        creatureType = typeMap.get(typeId) || 'Unknown'
        creatureTypeSource = `Monster Type relation -> ${typeId}`
      } else if (properties.Type?.relation?.[0]?.id) {
        const typeId = properties.Type.relation[0].id
        creatureType = typeMap.get(typeId) || 'Unknown'
        creatureTypeSource = `Type relation -> ${typeId}`
      } else if (properties.Category?.relation?.[0]?.id) {
        const typeId = properties.Category.relation[0].id
        creatureType = typeMap.get(typeId) || 'Unknown'
        creatureTypeSource = `Category relation -> ${typeId}`
      } else if (properties['Creature Type']?.select?.name) {
        creatureType = properties['Creature Type'].select.name
        creatureTypeSource = 'Creature Type select'
      } else if (properties['Monster Type']?.select?.name) {
        creatureType = properties['Monster Type'].select.name
        creatureTypeSource = 'Monster Type select'
      } else if (properties.Type?.select?.name) {
        creatureType = properties.Type.select.name
        creatureTypeSource = 'Type select'
      } else if (properties.Category?.select?.name) {
        creatureType = properties.Category.select.name
        creatureTypeSource = 'Category select'
      } else if (properties.CreatureType?.select?.name) {
        creatureType = properties.CreatureType.select.name
        creatureTypeSource = 'CreatureType select'
      }

      // Debug log the extracted creature type for first few monsters
      if (allMonsters.indexOf(monsterPage) < 3) {
        console.log(`🔍 Extracted creature type for ${name}: "${creatureType}" from ${creatureTypeSource}`);
        if (creatureTypeSource.includes('relation')) {
          const typeId = creatureTypeSource.split('-> ')[1]
          console.log(`🔍 Type map lookup for ${typeId}:`, typeMap.get(typeId))
        }
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
      
      } catch (error) {
        console.error(`❌ Error processing monster ${monsterPage.id}:`, error)
        // Skip this monster and continue with others
        continue
      }
    }

    console.log(`🗺️ Processed ${monstersMap.size} monsters into catalog map`)

    // Convert map to array for encounter generation (maintaining backward compatibility)
    const creatures = Array.from(monstersMap.values())

    console.log(`🔄 Processed ${creatures.length} creatures for encounter generation`)
    
    // Debug: Log first few processed creatures
    const sampleCreatures = creatures.slice(0, 5)
    console.log('📋 Sample processed creatures with CR details:', JSON.stringify(sampleCreatures.map(c => ({
      name: c.name,
      cr: c.challenge_rating,
      xp: c.xp_value,
      type: c.creature_type,
      size: c.size,
      alignment: c.alignment,
      environments: c.environment,
      image_url: c.image_url
    })), null, 2))

    // Debug: Check CR distribution
    const crDistribution = creatures.reduce((acc, creature) => {
      const cr = creature.challenge_rating.toString()
      acc[cr] = (acc[cr] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    console.log('📊 Challenge Rating distribution:', crDistribution)

    // Debug: Log filter parameters being passed to generator
    console.log('🔍 Filter parameters for encounter generation:', {
      environment: environment || '',
      xpThreshold,
      maxMonsters,
      minCR: minCRNum,
      maxCR: maxCRNum,
      alignment,
      creatureType,
      size
    })

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
