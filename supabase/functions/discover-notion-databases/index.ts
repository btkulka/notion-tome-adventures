import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { 
  handleCORS, 
  createNotionClient, 
  createErrorResponse, 
  createSuccessResponse 
} from '../_shared/notion-utils.ts'

serve(async (req) => {
  const corsResponse = handleCORS(req)
  if (corsResponse) return corsResponse

  try {
    console.log('Discovering Notion databases...')
    const notion = createNotionClient()

    // Discover all databases
    const response = await notion.search({
      filter: {
        property: 'object',
        value: 'database'
      }
    })
    
    const databases = response.results
      .filter((result: any) => result.object === 'database')
      .map((db: any) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text || 'Untitled Database',
        url: db.url,
        lastEditedTime: db.last_edited_time,
      }))

    // Expected D&D databases
    const EXPECTED_DATABASES = [
      { name: 'Creatures', aliases: ['creatures', 'monsters', 'creature', 'monster'] },
      { name: 'Spells', aliases: ['spells', 'spell', 'magic'] },
      { name: 'Items', aliases: ['items', 'equipment', 'gear', 'weapons', 'armor'] },
      { name: 'Environments', aliases: ['environments', 'environment', 'terrain', 'locations'] },
      { name: 'Encounters', aliases: ['encounters', 'encounter', 'generated encounters', 'saved encounters'] },
    ]

    // Match databases to expected ones
    const matches = EXPECTED_DATABASES.map(expected => {
      const suggestions = databases.filter((db: any) => 
        expected.aliases.some(alias => 
          db.title.toLowerCase().includes(alias.toLowerCase())
        )
      )

      const exactMatch = suggestions.find((db: any) => 
        expected.aliases.includes(db.title.toLowerCase())
      )
      
      const bestMatch = exactMatch || suggestions[0]

      return {
        expectedName: expected.name,
        matched: bestMatch,
        suggestions: suggestions.slice(0, 3),
      }
    })

    console.log(`Successfully discovered ${databases.length} databases with ${matches.length} matches`)
    return createSuccessResponse({ 
      allDatabases: databases,
      matches: matches 
    })
    
  } catch (error) {
    return createErrorResponse(error, 'discover-notion-databases')
  }
})