import { Client } from 'https://deno.land/x/notion_sdk@v2.2.3/src/mod.ts'
import { extractMagicItem, isValidMagicItem } from '../_shared/notion-extractors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const notionApiKey = Deno.env.get('NOTION_API_KEY')
    const magicItemsDbId = Deno.env.get('MAGIC_ITEMS_DATABASE_ID')

    if (!notionApiKey || !magicItemsDbId) {
      return new Response(
        JSON.stringify({ error: 'Notion configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const notion = new Client({ auth: notionApiKey })
    const { searchQuery, rarity, includeArchived = false } = await req.json().catch(() => ({}))

    console.log('Fetching magic items with search:', searchQuery, 'rarity:', rarity, 'includeArchived:', includeArchived)

    // If rarity filter is provided, first get the rarity ID from the Magic Item Rarities table
    let rarityId: string | undefined = undefined
    if (rarity) {
      const raritiesDbId = Deno.env.get('MAGIC_ITEM_RARITIES_DATABASE_ID')
      if (raritiesDbId) {
        try {
          const rarityQuery = await notion.databases.query({
            database_id: raritiesDbId,
            filter: {
              property: 'Rarity',
              title: { equals: rarity }
            }
          })

          if (rarityQuery.results.length > 0) {
            rarityId = rarityQuery.results[0].id
            console.log(`Found rarity ID for "${rarity}":`, rarityId)
          } else {
            console.warn(`No rarity found with name "${rarity}"`)
          }
        } catch (error) {
          console.error('Error fetching rarity ID:', error)
        }
      }
    }

    const query: any = { database_id: magicItemsDbId }

    // Build filters
    const filters: any[] = []

    if (searchQuery) {
      filters.push({
        property: 'Name',
        title: { contains: searchQuery }
      })
    }

    if (rarityId) {
      // Filter by rarity relation using the resolved ID
      filters.push({
        property: 'Rarity',
        relation: { contains: rarityId }
      })
    }

    // Exclude archived items unless specifically requested
    if (!includeArchived) {
      filters.push({
        property: 'Archived',
        checkbox: { equals: false }
      })
    }

    // Apply filters if any
    if (filters.length === 1) {
      query.filter = filters[0]
    } else if (filters.length > 1) {
      query.filter = {
        and: filters
      }
    }

    const response = await notion.databases.query(query)

    console.log(`Found ${response.results.length} raw pages`)

    // Extract magic items using unified extractor and track failures
    let failedCount = 0
    const magicItems = response.results
      .map((page, index) => {
        try {
          // Debug: Log property names for first item
          if (index === 0 && 'properties' in page) {
            console.log('[DEBUG] First item property names:', Object.keys(page.properties));
            // Check for Value property
            const possibleValueProps = ['Value', 'Gold Value', 'GP', 'Price', 'Cost'];
            for (const propName of possibleValueProps) {
              if (page.properties[propName]) {
                console.log(`[DEBUG] Found property "${propName}":`, JSON.stringify(page.properties[propName], null, 2));
              }
            }
          }

          const item = extractMagicItem(page)

          // Debug: Log extracted value for first few items
          if (index < 3) {
            console.log(`[DEBUG] Item ${index} (${item.name}):`, {
              value: item.value,
              valueType: typeof item.value
            });
          }

          if (!isValidMagicItem(item)) {
            console.warn(`[${index}] Invalid magic item (missing name):`, page.id)
            failedCount++
            return null
          }
          return item
        } catch (error) {
          console.error(`[${index}] Error extracting magic item from page ${page.id}:`, error)
          failedCount++
          return null
        }
      })
      .filter(Boolean)

    console.log(`Extracted ${magicItems.length} valid magic items, ${failedCount} failed`)

    // Resolve rarity relations to rarity names
    const raritiesDbId = Deno.env.get('MAGIC_ITEM_RARITIES_DATABASE_ID')
    if (raritiesDbId && magicItems.length > 0) {
      // Collect unique rarity IDs
      const rarityIds = [...new Set(magicItems
        .map((item: any) => item.rarityRelation)
        .filter(Boolean))]

      if (rarityIds.length > 0) {
        // Fetch all rarities in bulk
        const rarityMap = new Map<string, string>()
        for (const rarityRelationId of rarityIds) {
          try {
            const rarityPage = await notion.pages.retrieve({ page_id: rarityRelationId })
            const rarityName = (rarityPage as any).properties?.Rarity?.title?.[0]?.plain_text || 'Unknown'
            rarityMap.set(rarityRelationId, rarityName)
          } catch (error) {
            console.error(`Error fetching rarity ${rarityRelationId}:`, error)
          }
        }

        // Attach rarity names to items
        magicItems.forEach((item: any) => {
          if (item.rarityRelation) {
            item.rarity = rarityMap.get(item.rarityRelation) || 'Unknown'
          }
        })
      }
    }

    return new Response(
      JSON.stringify({
        magicItems,
        metadata: {
          total: response.results.length,
          successful: magicItems.length,
          failed: failedCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error fetching magic items:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
