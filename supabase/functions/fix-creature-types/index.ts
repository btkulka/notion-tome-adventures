import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { 
  handleCORS, 
  createNotionClient, 
  validateDatabaseId, 
  createErrorResponse, 
  createSuccessResponse
} from '../_shared/notion-utils.ts'
import {
  FieldFixConfig,
  extractMonsterRecords,
  processFieldFix
} from '../_shared/field-fix-utils.ts'

interface CreatureTypeRecord {
  id: string;
  name: string;
}

interface MonsterRecord {
  id: string;
  name: string;
  tags: string;
  currentCreatureTypeId?: string;
  currentTags?: string[];
}

serve(async (req) => {
  const corsResponse = handleCORS(req)
  if (corsResponse) return corsResponse

  try {
    console.log('🔧 Starting creature type fix process...')
    
    // Step 1: Validate Notion API Key
    console.log('🔑 Validating Notion API key...')
    const notion = createNotionClient()
    console.log('✅ Notion client created successfully')
    
    // Step 2: Validate Database IDs
    console.log('🗃️ Validating database connections...')
    const creaturesDbId = validateDatabaseId(
      Deno.env.get('CREATURES_DATABASE_ID'), 
      'CREATURES_DATABASE_ID'
    )
    const creatureTypesDbId = validateDatabaseId(
      Deno.env.get('CREATURE_TYPES_DATABASE_ID'), 
      'CREATURE_TYPES_DATABASE_ID'
    )
    console.log('✅ Database IDs validated')
    
    // Step 3: Retrieve all creature type records
    console.log('📋 Fetching creature types...')
    const creatureTypesResponse = await notion.databases.query({
      database_id: creatureTypesDbId,
      page_size: 100
    })
    
    const creatureTypes: CreatureTypeRecord[] = creatureTypesResponse.results.map((page: any) => {
      const props = page.properties
      let name = 'Unknown Type'
      
      // Based on schema: Creature Types database has "Creature Type" as title
      if (props?.['Creature Type']?.title?.[0]?.plain_text) {
        name = props['Creature Type'].title[0].plain_text
      }
      
      return {
        id: page.id,
        name: name.trim()
      }
    })
    
    console.log(`✅ Found ${creatureTypes.length} creature types:`)
    creatureTypes.forEach(type => console.log(`  - ${type.name} (${type.id})`))
    
    // Step 4: Query monsters where creature type relation is empty
    console.log('🐉 Fetching monsters with blank creature types...')
    
    const monstersResponse = await notion.databases.query({
      database_id: creaturesDbId,
      filter: {
        property: 'Creature Type',
        relation: {
          is_empty: true
        }
      },
      page_size: 100
    })
    
    // Step 5: Configure the field fix using modular system
    const creatureTypeMap = new Map<string, string>()
    creatureTypes.forEach(type => {
      creatureTypeMap.set(type.name, type.id)
    })
    
    const config: FieldFixConfig = {
      sourceField: 'Tags',
      targetField: 'Creature Type',
      targetType: 'relation',
      multiSelectField: 'Monster Tags',
      validValues: creatureTypes.map(type => type.name)
    }
    
    // Step 6: Extract monster records using modular system
    const monsters = extractMonsterRecords(monstersResponse.results, config)
    
    console.log(`✅ Found ${monsters.length} monsters that need creature type fixes:`)
    monsters.slice(0, 5).forEach(monster => 
      console.log(`  - ${monster.name}: "${monster.tags}"`)
    )
    if (monsters.length > 5) {
      console.log(`  ... and ${monsters.length - 5} more`)
    }
    
    // Step 7: Process the monsters in batches of 10 using modular system
    const results = await processFieldFix(notion, monsters, config, creatureTypeMap, 10)
    
    console.log('\n🎉 Process completed!')
    console.log(`📊 Results:`)
    console.log(`   - Processed: ${results.processed}`)
    console.log(`   - Updated: ${results.updated}`)
    console.log(`   - Skipped: ${results.skipped}`)
    console.log(`   - Errors: ${results.errors}`)
    
    return createSuccessResponse({
      summary: {
        totalCreatureTypes: creatureTypes.length,
        monstersToFix: monsters.length,
        processed: results.processed,
        updated: results.updated,
        skipped: results.skipped,
        errors: results.errors
      },
      creatureTypes: creatureTypes.map(type => ({ id: type.id, name: type.name })),
      details: results.details
    })
    
  } catch (error) {
    return createErrorResponse(error, 'fix-creature-types')
  }
})
