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
    const body = await req.json()
    const { environment, minCR, maxCR, creatureType, alignment, size } = body || {}
    console.log('Received filters:', { environment, minCR, maxCR, creatureType, alignment, size })

    const creaturesDbId = validateDatabaseId(
      Deno.env.get('CREATURES_DATABASE_ID'), 
      'CREATURES_DATABASE_ID'
    )
    
    console.log('Fetching creatures from database:', creaturesDbId)
    
    const notion = createNotionClient()
    console.log('Querying creatures database...')

    // Build filter based on parameters
    const filters: any[] = []

    if (environment && environment !== 'Any') {
      filters.push({
        property: 'Environment',
        multi_select: {
          contains: environment,
        },
      })
    }

    if (creatureType && creatureType !== 'Any') {
      filters.push({
        property: 'Type',
        select: {
          equals: creatureType,
        },
      })
    }

    if (alignment && alignment !== 'Any') {
      filters.push({
        property: 'Alignment',
        select: {
          equals: alignment,
        },
      })
    }

    if (size && size !== 'Any') {
      filters.push({
        property: 'Size',
        select: {
          equals: size,
        },
      })
    }

    if (minCR !== undefined) {
      filters.push({
        property: 'ChallengeRating',
        number: {
          greater_than_or_equal_to: minCR,
        },
      })
    }

    if (maxCR !== undefined) {
      filters.push({
        property: 'ChallengeRating',
        number: {
          less_than_or_equal_to: maxCR,
        },
      })
    }

    const query: any = {
      database_id: creaturesDbId,
    }

    if (filters.length > 0) {
      query.filter = filters.length === 1 ? filters[0] : {
        and: filters,
      }
    }

    const response = await notion.databases.query(query)

    const creatures = response.results.map((page: any) => ({
      id: page.id,
      name: page.properties.Name?.title?.[0]?.plain_text || 'Unknown',
      type: page.properties.Type?.select?.name || 'Unknown',
      challenge_rating: page.properties.ChallengeRating?.number || 0,
      xp_value: page.properties.XPValue?.number || 0,
      armor_class: page.properties.ArmorClass?.number || 10,
      hit_points: page.properties.HitPoints?.number || 1,
      environment: page.properties.Environment?.multi_select?.map((env: any) => env.name) || [],
      alignment: page.properties.Alignment?.select?.name || 'Neutral',
      size: page.properties.Size?.select?.name || 'Medium',
    }))

    console.log(`Successfully fetched ${creatures.length} creatures matching filters`)
    return createSuccessResponse({ creatures })
    
  } catch (error) {
    return createErrorResponse(error, 'fetch-creatures')
  }
})