import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { 
  handleCORS, 
  createNotionClient, 
  validateDatabaseId, 
  createErrorResponse, 
  createSuccessResponse,
  resolveRelationProperty,
  XP_BY_CR
} from '../_shared/notion-utils.ts'

serve(async (req) => {
  const corsResponse = handleCORS(req)
  if (corsResponse) return corsResponse

  try {
    console.log('🐉 Starting creature fetch...')
    
    const body = await req.json()
    const { environment, minCR, maxCR, creatureType, alignment, size } = body || {}
    console.log('📋 Received filters:', { environment, minCR, maxCR, creatureType, alignment, size })

    // Step 1: Validate Notion API Key
    console.log('🔑 Validating Notion API key for creatures fetch...')
    const notion = createNotionClient()
    console.log('✅ Notion client created successfully')
    
    // Step 2: Validate Creatures Database ID
    console.log('🐉 Validating creatures database connection...')
    const creaturesDbId = validateDatabaseId(
      Deno.env.get('CREATURES_DATABASE_ID'), 
      'CREATURES_DATABASE_ID'
    )
    console.log('✅ Creatures database ID validated:', creaturesDbId.substring(0, 8) + '...')
    
    console.log('🔍 Querying creatures database...')

    // Build filter based on parameters
    const filters: any[] = []

    if (environment && environment !== 'Any') {
      // Try both possible environment property names with OR
      filters.push({
        or: [
          {
            property: 'Environment',
            multi_select: {
              contains: environment,
            },
          },
          {
            property: 'Environments',
            multi_select: {
              contains: environment,
            },
          }
        ]
      })
    }

    // Temporarily disable creature type filtering since it's a relation property
    // We need to understand the relation structure first
    // if (creatureType && creatureType !== 'Any') {
    //   // Try multiple possible type property names with OR
    //   filters.push({
    //     or: [
    //       {
    //         property: 'Type',
    //         select: {
    //           equals: creatureType,
    //         },
    //       },
    //       {
    //         property: 'MonsterType',
    //         select: {
    //           equals: creatureType,
    //         },
    //       },
    //       {
    //         property: 'CreatureType',
    //         select: {
    //           equals: creatureType,
    //         },
    //       }
    //     ]
    //   })
    // }

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

    // Temporarily disable CR filtering since Challenge Rating is a relation property
    // We need to understand the relation structure first
    // if (minCR !== undefined) {
    //   // Try multiple possible CR property names with OR
    //   filters.push({
    //     or: [
    //       {
    //         property: 'Challenge Rating',
    //         number: {
    //           greater_than_or_equal_to: minCR,
    //         },
    //       },
    //       {
    //         property: 'CR',
    //         number: {
    //           greater_than_or_equal_to: minCR,
    //         },
    //       },
    //       {
    //         property: 'Challenge',
    //         number: {
    //           greater_than_or_equal_to: minCR,
    //         },
    //       }
    //     ]
    //   })
    // }

    // Temporarily disable CR filtering since Challenge Rating is a relation property
    // We need to understand the relation structure first
    // if (maxCR !== undefined) {
    //   // Try multiple possible CR property names with OR
    //   filters.push({
    //     or: [
    //       {
    //         property: 'Challenge Rating',
    //         number: {
    //           less_than_or_equal_to: maxCR,
    //         },
    //       },
    //       {
    //         property: 'CR',
    //         number: {
    //           less_than_or_equal_to: maxCR,
    //         },
    //       },
    //       {
    //         property: 'Challenge',
    //         number: {
    //           less_than_or_equal_to: maxCR,
    //         },
    //       }
    //     ]
    //   })
    // }

    const query: any = {
      database_id: creaturesDbId,
      page_size: 5, // Limit to just 5 creatures for debugging
    }

    if (filters.length > 0) {
      query.filter = filters.length === 1 ? filters[0] : {
        and: filters,
      }
    }

    console.log('🔍 Database query:', JSON.stringify(query, null, 2))

    const response = await notion.databases.query(query)

    console.log(`📋 Query returned ${response.results.length} results`)
    
    // Debug: Log the first creature's structure if available
    if (response.results.length > 0) {
      const firstCreature = response.results[0]
      console.log('🔍 First creature ID:', firstCreature.id)
      console.log('🔍 Available property keys:', Object.keys(firstCreature.properties))
      console.log('🔍 Full first creature properties:')
      console.log(JSON.stringify(firstCreature.properties, null, 2))
    }

    const creatures = await Promise.all(response.results.map(async (page: any) => {
      console.log('🐉 Processing creature page:', page.id)
      console.log('📊 Page properties:', JSON.stringify(page.properties, null, 2))
      
      const props = page.properties
      
      // Extract name from various possible properties
      let name = 'Unknown Creature'
      if (props?.['Monster Name']?.title?.[0]?.plain_text) {
        name = props['Monster Name'].title[0].plain_text
      } else if (props?.Name?.title?.[0]?.plain_text) {
        name = props.Name.title[0].plain_text
      } else if (props?.Monster?.title?.[0]?.plain_text) {
        name = props.Monster.title[0].plain_text
      } else if (props?.Monsters?.title?.[0]?.plain_text) {
        name = props.Monsters.title[0].plain_text
      } else if (props?.CreatureName?.title?.[0]?.plain_text) {
        name = props.CreatureName.title[0].plain_text
      } else if (props?.Title?.title?.[0]?.plain_text) {
        name = props.Title.title[0].plain_text
      } else {
        // Try other property types if title doesn't work
        const nameKeys = Object.keys(props || {}).filter(key => 
          key.toLowerCase().includes('name') || 
          key.toLowerCase().includes('monster') ||
          key.toLowerCase().includes('creature') ||
          key.toLowerCase().includes('title')
        )
        console.log('⚠️ No standard creature name found. Checking alternative keys:', nameKeys)
        
        for (const key of nameKeys) {
          const prop = props[key]
          if (prop?.rich_text?.[0]?.plain_text) {
            name = prop.rich_text[0].plain_text
            console.log(`✅ Found name in ${key} (rich_text):`, name)
            break
          } else if (prop?.select?.name) {
            name = prop.select.name
            console.log(`✅ Found name in ${key} (select):`, name)
            break
          } else if (prop?.title?.[0]?.plain_text) {
            name = prop.title[0].plain_text
            console.log(`✅ Found name in ${key} (title):`, name)
            break
          }
        }
        
        if (name === 'Unknown Creature') {
          console.log('⚠️ Could not find creature name. Available properties:', Object.keys(props || {}))
        }
      }
      
      // Extract type with relation resolution
      let type = props?.Type?.select?.name || 
                props?.MonsterType?.select?.name || 
                props?.CreatureType?.select?.name || 
                props?.Category?.select?.name ||
                props?.['Creature Type']?.select?.name
      
      // If not found as select, try as relation
      if (!type || type === 'Unknown') {
        const typeRelation = props?.Type?.relation?.[0] ||
                            props?.MonsterType?.relation?.[0] ||
                            props?.CreatureType?.relation?.[0] ||
                            props?.['Creature Type']?.relation?.[0] ||
                            props?.Category?.relation?.[0]
        
        if (typeRelation) {
          console.log('🔗 Resolving type relation:', typeRelation.id)
          const resolvedType = await resolveRelationProperty(notion, typeRelation.id)
          type = resolvedType || 'Unknown (Relation Failed)'
        } else {
          type = 'Unknown'
        }
      }
      
      // Extract challenge rating (try different property names and formats)
      let challenge_rating = 0
      
      // Try number properties first
      const crProperty = props?.ChallengeRating?.number || 
                        props?.CR?.number || 
                        props?.Challenge?.number ||
                        props?.['Challenge Rating']?.number
      
      if (crProperty !== undefined) {
        challenge_rating = crProperty
      } else {
        // Try as text/select (some databases store CR as text like "1/4", "1/2")
        const crText = props?.ChallengeRating?.select?.name || 
                      props?.CR?.select?.name || 
                      props?.Challenge?.select?.name ||
                      props?.['Challenge Rating']?.select?.name
        
        if (crText) {
          // Convert text CR to number
          if (crText === '1/8') challenge_rating = 0.125
          else if (crText === '1/4') challenge_rating = 0.25
          else if (crText === '1/2') challenge_rating = 0.5
          else challenge_rating = parseFloat(crText) || 0
        } else {
          // Try as relation property (links to another database)
          const crRelation = props?.ChallengeRating?.relation?.[0] ||
                            props?.CR?.relation?.[0] ||
                            props?.Challenge?.relation?.[0] ||
                            props?.['Challenge Rating']?.relation?.[0]
          
          if (crRelation) {
            console.log('🔗 Resolving Challenge Rating relation:', crRelation.id)
            const resolvedCR = await resolveRelationProperty(notion, crRelation.id)
            if (resolvedCR) {
              // Try to parse the resolved value as a number or fraction
              if (resolvedCR === '1/8') challenge_rating = 0.125
              else if (resolvedCR === '1/4') challenge_rating = 0.25
              else if (resolvedCR === '1/2') challenge_rating = 0.5
              else challenge_rating = parseFloat(resolvedCR) || 0
              console.log(`✅ Resolved CR: ${resolvedCR} -> ${challenge_rating}`)
            } else {
              challenge_rating = 0
            }
          }
        }
      }
      
      // Extract XP value - use explicit XP or calculate from CR
      let xp_value = props?.XPValue?.number || 
                    props?.XP?.number || 
                    props?.ExperiencePoints?.number ||
                    props?.['XP Value']?.number ||
                    props?.Experience?.number ||
                    0
      
      // If no explicit XP value, calculate from Challenge Rating
      if (xp_value === 0 && challenge_rating > 0) {
        xp_value = XP_BY_CR[challenge_rating.toString()] || 0
        console.log(`📈 Calculated XP from CR ${challenge_rating}: ${xp_value}`)
      }
      
      // Extract AC
      const armor_class = props?.ArmorClass?.number || 
                         props?.AC?.number || 
                         props?.['Armor Class']?.number ||
                         props?.['AC']?.number ||
                         10
      
      // Extract HP
      const hit_points = props?.HitPoints?.number || 
                        props?.HP?.number || 
                        props?.['Hit Points']?.number ||
                        props?.Health?.number ||
                        1
      
      // Extract environment (multi-select)
      const environment = props?.Environment?.multi_select?.map((env: any) => env.name) || 
                         props?.Environments?.multi_select?.map((env: any) => env.name) ||
                         props?.Habitat?.multi_select?.map((env: any) => env.name) ||
                         []
      
      // Extract alignment
      const alignment = props?.Alignment?.select?.name || 
                       props?.Morality?.select?.name ||
                       'Neutral'
      
      // Extract size
      const size = props?.Size?.select?.name || 
                  props?.CreatureSize?.select?.name ||
                  'Medium'
      
      // Extract additional properties for complete DTO
      const subtype = props?.Subtype?.select?.name || 
                     props?.SubType?.select?.name ||
                     props?.Category?.select?.name ||
                     ''
      
      const speed_walk = props?.Speed?.number || 
                        props?.WalkSpeed?.number ||
                        props?.['Walking Speed']?.number ||
                        30
      
      const languages = props?.Languages?.multi_select?.map((lang: any) => lang.name) ||
                       props?.Language?.multi_select?.map((lang: any) => lang.name) ||
                       []
      
      const source = props?.Source?.select?.name ||
                    props?.Book?.select?.name ||
                    props?.Sourcebook?.select?.name ||
                    'Unknown'
      
      const creatureData = {
        id: page.id,
        name,
        size,
        type,
        subtype,
        alignment,
        armor_class,
        hit_points,
        speed: {
          walk: speed_walk
        },
        challenge_rating,
        xp_value,
        environment,
        languages,
        source,
        // Add notion metadata
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
        url: page.url
      }
      
      console.log('✅ Processed creature:', creatureData.name, 'CR:', creatureData.challenge_rating)
      return creatureData
    }))

    console.log(`Successfully fetched ${creatures.length} creatures matching filters`)
    
    // Debug: Log a sample of processed creatures
    if (creatures.length > 0) {
      console.log('🔍 Sample processed creatures:')
      creatures.slice(0, 2).forEach((creature, index) => {
        console.log(`  ${index + 1}. ${creature.name} (CR ${creature.challenge_rating}, ${creature.xp_value} XP)`)
      })
    }
    
    return createSuccessResponse({ creatures })
    
  } catch (error) {
    return createErrorResponse(error, 'fetch-creatures')
  }
})