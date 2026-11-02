// Locations database: map pins link to these pages.
//   list   (DM)     { action: 'list', campaignId }
//   get    (member) { action: 'get', campaignId, locationId }  players get only player fields
//   create (DM)     { action: 'create', campaignId, name, type, playerDescription?, mapId? }
//   update (DM)     { action: 'update', campaignId, locationId, name?, type?, playerDescription?, dmNotes?, mapId? }
import { Client } from 'https://deno.land/x/notion_sdk@v2.2.3/src/mod.ts'
import { requireMember } from '../_shared/auth.ts'
import { extractLocation, richText, sameNotionId, toPlayerLocation } from '../_shared/suite-extractors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { action, campaignId } = body
    if (!campaignId) return json({ error: 'campaignId is required' }, 400)

    const caller = await requireMember(req, campaignId)
    if (caller instanceof Response) return caller
    if (action !== 'get' && caller.role !== 'dm') return json({ error: 'Only the DM can do that' }, 403)

    const notionApiKey = Deno.env.get('NOTION_API_KEY')
    const locationsDbId = Deno.env.get('LOCATIONS_DATABASE_ID')
    if (!notionApiKey || !locationsDbId) {
      return json({ error: 'Locations database not configured: set LOCATIONS_DATABASE_ID (run suite setup first)' }, 500)
    }
    const notion = new Client({ auth: notionApiKey })

    if (action === 'list') {
      const results: any[] = []
      let cursor: string | undefined
      do {
        const response: any = await notion.databases.query({
          database_id: locationsDbId,
          filter: { property: 'Campaign', relation: { contains: campaignId } },
          sorts: [{ property: 'Name', direction: 'ascending' }],
          start_cursor: cursor,
          page_size: 100,
        })
        results.push(...response.results)
        cursor = response.has_more ? response.next_cursor : undefined
      } while (cursor)
      return json({ locations: results.map(extractLocation) })
    }

    if (action === 'get') {
      const page = await notion.pages.retrieve({ page_id: body.locationId })
      const location = extractLocation(page)
      if (!location.campaignIds.some((id) => sameNotionId(id, campaignId))) {
        return json({ error: 'That location is not part of this campaign' }, 404)
      }
      return json({ location: caller.role === 'dm' ? location : toPlayerLocation(location) })
    }

    if (action === 'create') {
      if (!body.name) return json({ error: 'name is required' }, 400)
      const properties: any = {
        Name: { title: [{ text: { content: body.name } }] },
        Campaign: { relation: [{ id: campaignId }] },
      }
      if (body.type) properties.Type = { select: { name: body.type } }
      if (body.playerDescription) properties['Player Description'] = richText(body.playerDescription)
      if (body.mapId) properties['Map ID'] = richText(body.mapId)
      const page = await notion.pages.create({ parent: { database_id: locationsDbId }, properties })
      return json({ location: extractLocation(page) })
    }

    if (action === 'update') {
      const existing = extractLocation(await notion.pages.retrieve({ page_id: body.locationId }))
      if (!existing.campaignIds.some((id) => sameNotionId(id, campaignId))) {
        return json({ error: 'That location is not part of this campaign' }, 404)
      }
      const properties: any = {}
      if (body.name !== undefined) properties.Name = { title: [{ text: { content: body.name } }] }
      if (body.type !== undefined) properties.Type = body.type ? { select: { name: body.type } } : { select: null }
      if (body.playerDescription !== undefined) properties['Player Description'] = richText(body.playerDescription)
      if (body.dmNotes !== undefined) properties['DM Notes'] = richText(body.dmNotes)
      if (body.mapId !== undefined) properties['Map ID'] = richText(body.mapId)
      const page = await notion.pages.update({ page_id: body.locationId, properties })
      return json({ location: extractLocation(page) })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (error) {
    console.error('Error in locations:', error)
    return json({ error: error instanceof Error ? error.message : 'Unknown error occurred' }, 500)
  }
})
