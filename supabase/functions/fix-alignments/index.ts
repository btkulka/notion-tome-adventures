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

// Define D&D 5e alignment options
const ALIGNMENT_VALUES = [
  'Lawful Good',
  'Neutral Good', 
  'Chaotic Good',
  'Lawful Neutral',
  'True Neutral',
  'Neutral',  // Sometimes just "Neutral" instead of "True Neutral"
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil',
  'Unaligned'
];

serve(async (req) => {
  const corsResponse = handleCORS(req)
  if (corsResponse) return corsResponse

  try {
    console.log('🔧 Starting alignment fix process...')
    
    // Step 1: Validate Notion API Key
    console.log('🔑 Validating Notion API key...')
    const notion = createNotionClient()
    console.log('✅ Notion client created successfully')
    
    // Step 2: Validate Database ID
    console.log('🗃️ Validating database connection...')
    const creaturesDbId = validateDatabaseId(
      Deno.env.get('CREATURES_DATABASE_ID'), 
      'CREATURES_DATABASE_ID'
    )
    console.log('✅ Database ID validated')
    
    // Step 3: Query monsters where alignment is empty
    console.log('🐉 Fetching monsters with blank alignments...')
    
    const monstersResponse = await notion.databases.query({
      database_id: creaturesDbId,
      filter: {
        property: 'Alignment',
        select: {
          is_empty: true
        }
      },
      page_size: 100  // Now that we know it works, process more
    })
    
    console.log(`📋 Found ${monstersResponse.results.length} monsters to check`)
    
    // Step 4: Configure the field fix
    const config: FieldFixConfig = {
      sourceField: 'Tags',
      targetField: 'Alignment', 
      targetType: 'select',
      multiSelectField: 'Monster Tags',
      validValues: ALIGNMENT_VALUES
    }
    
    // Step 5: Extract monster records that need processing
    const monsters = extractMonsterRecords(monstersResponse.results, config)
    
    // Filter to only those that actually have no alignment set
    const monstersToFix = monsters.filter(monster => {
      // Check if monster actually has no alignment set
      const page = monstersResponse.results.find(p => p.id === monster.id);
      const alignment = (page as any)?.properties?.Alignment?.select?.name;
      return !alignment;
    });
    
    console.log(`✅ Found ${monstersToFix.length} monsters that need alignment fixes:`)
    monstersToFix.slice(0, 5).forEach(monster => 
      console.log(`  - ${monster.name}: "${monster.tags}"`)
    )
    if (monstersToFix.length > 5) {
      console.log(`  ... and ${monstersToFix.length - 5} more`)
    }
    
    // Step 6: Process the monsters in batches of 10
    const results = await processFieldFix(notion, monstersToFix, config, undefined, 10)
    
    console.log('\n🎉 Alignment fix process completed!')
    console.log(`📊 Results:`)
    console.log(`   - Processed: ${results.processed}`)
    console.log(`   - Updated: ${results.updated}`)
    console.log(`   - Skipped: ${results.skipped}`)
    console.log(`   - Errors: ${results.errors}`)
    
    return createSuccessResponse({
      summary: {
        totalCandidates: monstersResponse.results.length,
        monstersToFix: monstersToFix.length,
        processed: results.processed,
        updated: results.updated,
        skipped: results.skipped,
        errors: results.errors
      },
      alignmentValues: ALIGNMENT_VALUES,
      details: results.details
    })
    
  } catch (error) {
    return createErrorResponse(error, 'fix-alignments')
  }
})
