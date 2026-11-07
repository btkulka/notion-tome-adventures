// Locations: map pins link to these rows, which live in D1 (migrations/0006_game_data.sql).
//   list   (DM)     { action: 'list', campaignId }
//   get    (member) { action: 'get', campaignId, locationId }  players get only player fields
//   create (DM)     { action: 'create', campaignId, name, type, playerDescription?, mapId? }
//   update (DM)     { action: 'update', campaignId, locationId, name?, type?, playerDescription?, dmNotes?, mapId? }
import { ContentClient } from '../../content/client'
import type { Env } from '../../env'
import type { NotionContext } from '../context'
import { extractLocation, richText, sameNotionId, toPlayerLocation } from '../suite-extractors'

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

export default async function handler(req: Request, env: Env, ctx: NotionContext): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json<any>().catch(() => ({}))
    const { action, campaignId } = body
    if (!campaignId) return json({ error: 'campaignId is required' }, 400)

    const role = await ctx.campaignRole(campaignId)
    if (!role) return json({ error: 'You are not part of this campaign' }, 403)
    if (action !== 'get' && role !== 'dm') return json({ error: 'Only the DM can do that' }, 403)

    const notion = new ContentClient(env.DB)
    const locationsDbId = 'locations'

    if (action === 'list') {
      const { results } = await notion.databases.queryAll({
        database_id: locationsDbId,
        filter: { property: 'Campaign', relation: { contains: campaignId } },
        sorts: [{ property: 'Name', direction: 'ascending' }],
      })
      return json({ locations: results.map(extractLocation) })
    }

    if (action === 'get') {
      const page = await notion.pages.retrieve({ page_id: body.locationId })
      const location = extractLocation(page)
      if (!location.campaignIds.some((id) => sameNotionId(id, campaignId))) {
        return json({ error: 'That location is not part of this campaign' }, 404)
      }
      return json({ location: role === 'dm' ? location : toPlayerLocation(location) })
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
}
