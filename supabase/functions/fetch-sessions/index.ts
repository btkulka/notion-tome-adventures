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
    console.log('📅 Starting sessions fetch...')
    
    const { search } = await req.json().catch(() => ({}))
    
    const notion = createNotionClient()
    const sessionsDbId = validateDatabaseId(
      Deno.env.get('SESSIONS_DATABASE_ID'), 
      'SESSIONS_DATABASE_ID'
    )
    
    console.log('🔍 Querying sessions database...')
    
    // Build query with search filter if provided
    const queryOptions: any = {
      database_id: sessionsDbId,
      sorts: [
        {
          property: 'Date',
          direction: 'descending'
        }
      ]
    }
    
    // Add search filter if provided
    if (search && search.trim()) {
      // First, get the database schema to understand what properties exist
      const dbResponse = await notion.databases.retrieve({ database_id: sessionsDbId })
      const properties = dbResponse.properties
      
      // Build dynamic search filters based on existing properties
      const searchFilters = []
      
      // Look for title properties that could contain the session name
      for (const [propName, propDef] of Object.entries(properties)) {
        if (propDef.type === 'title') {
          searchFilters.push({
            property: propName,
            title: {
              contains: search.trim()
            }
          })
        }
        // Also search rich_text properties for descriptions
        if (propDef.type === 'rich_text' && (
          propName.toLowerCase().includes('desc') || 
          propName.toLowerCase().includes('note') ||
          propName.toLowerCase().includes('summary')
        )) {
          searchFilters.push({
            property: propName,
            rich_text: {
              contains: search.trim()
            }
          })
        }
      }
      
      if (searchFilters.length > 0) {
        queryOptions.filter = {
          or: searchFilters
        }
      }
    }
    
    const response = await notion.databases.query(queryOptions)

    console.log(`📋 Processing ${response.results.length} session records...`)

    const sessions = response.results.map((page: any) => {
      console.log('🔍 Processing session page:', page.id)
      console.log('📊 Page properties:', JSON.stringify(page.properties, null, 2))
      
      const props = page.properties
      
      // Extract name from various possible properties
      let name = 'Unknown Session'
      if (props?.Name?.title?.[0]?.plain_text) {
        name = props.Name.title[0].plain_text
      } else if (props?.Session?.title?.[0]?.plain_text) {
        name = props.Session.title[0].plain_text
      } else if (props?.SessionName?.title?.[0]?.plain_text) {
        name = props.SessionName.title[0].plain_text
      } else if (props?.Title?.title?.[0]?.plain_text) {
        name = props.Title.title[0].plain_text
      } else {
        // Try other property types if title doesn't work
        const nameKeys = Object.keys(props || {}).filter(key => 
          key.toLowerCase().includes('name') || 
          key.toLowerCase().includes('session') ||
          key.toLowerCase().includes('title')
        )
        console.log('⚠️ No standard name property found. Checking alternative keys:', nameKeys)
        
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
        
        if (name === 'Unknown Session') {
          console.log('⚠️ Could not find session name. Available properties:', Object.keys(props || {}))
        }
      }
      
      // Extract date
      const date = props?.Date?.date?.start || 
                  props?.SessionDate?.date?.start || 
                  props?.PlayDate?.date?.start ||
                  null
      
      // Extract description
      const description = props?.Description?.rich_text?.[0]?.plain_text || 
                         props?.Notes?.rich_text?.[0]?.plain_text || 
                         props?.Summary?.rich_text?.[0]?.plain_text ||
                         ''
      
      const sessionData = {
        id: page.id,
        name,
        date,
        description,
        // Add notion metadata
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
        url: page.url
      }
      
      console.log('✅ Processed session:', sessionData.name)
      return sessionData
    })

    console.log(`✅ Successfully processed ${sessions.length} sessions`)
    return createSuccessResponse({ sessions })
    
  } catch (error) {
    console.error('❌ Error in fetch-sessions:', error)
    return createErrorResponse(error, 'fetch-sessions')
  }
})
