import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { 
  handleCORS, 
  createNotionClient, 
  validateDatabaseId, 
  createErrorResponse, 
  createSuccessResponse
} from '../_shared/notion-utils.ts'

interface SaveEncounterRequest {
  encounter_name: string;
  environment: string;
  total_xp: number;
  creatures: Array<{
    name: string;
    quantity: number;
    challenge_rating: string;
    xp_value: number;
  }>;
  generation_notes: string;
}

serve(async (req) => {
  const corsResponse = handleCORS(req)
  if (corsResponse) return corsResponse

  try {
    console.log('💾 Save Encounter function called')
    
    const body = await req.json()
    console.log('📋 Encounter to save:', body)

    const {
      encounter_name,
      environment,
      total_xp,
      creatures,
      generation_notes
    }: SaveEncounterRequest = body || {}

    // Validate required parameters
    if (!encounter_name || !creatures || creatures.length === 0) {
      throw new Error('Valid encounter name and creatures are required')
    }

    console.log('🔑 Validating Notion API key for encounter saving...')
    const notion = createNotionClient()
    console.log('✅ Notion client created successfully')
    
    // Validate Encounters Database ID
    console.log('⚔️ Validating encounters database connection...')
    const encountersDbId = validateDatabaseId(
      Deno.env.get('ENCOUNTERS_DATABASE_ID'), 
      'Encounters'
    )
    console.log('✅ Encounters database validated')

    // Prepare creatures text for the encounter
    const creaturesText = creatures.map(creature => 
      `${creature.quantity}x ${creature.name} (CR ${creature.challenge_rating}, ${creature.xp_value} XP each)`
    ).join('\n')

    // Create the encounter page in Notion
    console.log('📝 Creating encounter page in Notion...')
    const newPage = await notion.pages.create({
      parent: {
        database_id: encountersDbId,
      },
      properties: {
        'Name': {
          title: [
            {
              text: {
                content: encounter_name,
              },
            },
          ],
        },
        'Environment': {
          select: {
            name: environment,
          },
        },
        'Total XP': {
          number: total_xp,
        },
        'Creatures': {
          rich_text: [
            {
              text: {
                content: creaturesText,
              },
            },
          ],
        },
        'Generation Notes': {
          rich_text: [
            {
              text: {
                content: generation_notes,
              },
            },
          ],
        },
      },
    })

    console.log('✅ Encounter saved successfully:', newPage.id)

    // Return the page URL for opening
    const pageUrl = `https://notion.so/${newPage.id.replace(/-/g, '')}`

    return createSuccessResponse({
      pageId: newPage.id,
      pageUrl: pageUrl,
      message: 'Encounter saved successfully to Notion'
    })

  } catch (error) {
    console.error('❌ Error saving encounter:', error)
    return createErrorResponse(error, 'save-encounter')
  }
})
