// One-time setup: creates the Locations and Characters databases next to the
// Campaigns database, or finds them if they already exist there. The returned
// ids go into the LOCATIONS_DATABASE_ID / CHARACTERS_DATABASE_ID secrets.
import { Client } from 'https://deno.land/x/notion_sdk@v2.2.3/src/mod.ts'
import { requireDm } from '../_shared/auth.ts'
import { LIGHT_SOURCES, LOCATION_TYPES } from '../_shared/suite-extractors.ts'

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

const options = (names: string[]) => ({ options: names.map((name) => ({ name })) })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const caller = await requireDm(req)
  if (caller instanceof Response) return caller

  try {
    const notionApiKey = Deno.env.get('NOTION_API_KEY')
    const campaignsDbId = Deno.env.get('CAMPAIGNS_DATABASE_ID')
    if (!notionApiKey || !campaignsDbId) return json({ error: 'NOTION_API_KEY and CAMPAIGNS_DATABASE_ID are required' }, 500)
    const notion = new Client({ auth: notionApiKey })

    const campaigns: any = await notion.databases.retrieve({ database_id: campaignsDbId })
    if (campaigns.parent?.type !== 'page_id') {
      return json({
        error: 'The Campaigns database is not inside a page, so the integration cannot create siblings for it. Move it into a page shared with the integration.',
      }, 400)
    }
    const parentPageId = campaigns.parent.page_id

    const configured = {
      locations: Deno.env.get('LOCATIONS_DATABASE_ID') ?? null,
      characters: Deno.env.get('CHARACTERS_DATABASE_ID') ?? null,
    }

    const findSibling = async (title: string): Promise<string | null> => {
      const response: any = await notion.search({ query: title, filter: { property: 'object', value: 'database' } })
      const match = response.results.find(
        (db: any) =>
          db.parent?.page_id?.replace(/-/g, '') === parentPageId.replace(/-/g, '') &&
          db.title?.map((t: any) => t.plain_text).join('') === title,
      )
      return match?.id ?? null
    }

    const created: string[] = []

    let locationsId = configured.locations ?? (await findSibling('Locations'))
    if (!locationsId) {
      const db: any = await notion.databases.create({
        parent: { type: 'page_id', page_id: parentPageId },
        title: [{ type: 'text', text: { content: 'Locations' } }],
        properties: {
          Name: { title: {} },
          Type: { select: options(LOCATION_TYPES) },
          Campaign: { relation: { database_id: campaignsDbId, single_property: {} } },
          'Player Description': { rich_text: {} },
          'DM Notes': { rich_text: {} },
          Image: { files: {} },
          'Map ID': { rich_text: {} },
        },
      } as any)
      locationsId = db.id
      await notion.databases.update({
        database_id: db.id,
        properties: { 'Parent Location': { relation: { database_id: db.id, single_property: {} } } },
      } as any)
      created.push('Locations')
    }

    let charactersId = configured.characters ?? (await findSibling('Characters'))
    if (!charactersId) {
      const db: any = await notion.databases.create({
        parent: { type: 'page_id', page_id: parentPageId },
        title: [{ type: 'text', text: { content: 'Characters' } }],
        properties: {
          Name: { title: {} },
          Player: { rich_text: {} },
          'Discord Username': { rich_text: {} },
          Campaign: { relation: { database_id: campaignsDbId, single_property: {} } },
          Level: { number: { format: 'number' } },
          Class: { select: {} },
          Portrait: { files: {} },
          Darkvision: { number: { format: 'number' } },
          'Light Source': { select: options(LIGHT_SOURCES) },
          Active: { checkbox: {} },
        },
      } as any)
      charactersId = db.id
      created.push('Characters')
    }

    return json({
      created,
      locationsDatabaseId: locationsId,
      charactersDatabaseId: charactersId,
      secretsConfigured: Boolean(configured.locations && configured.characters),
    })
  } catch (error) {
    console.error('Error in setup-suite-notion:', error)
    return json({ error: error instanceof Error ? error.message : 'Unknown error occurred' }, 500)
  }
})
