import { ContentClient } from '../../content/client';
import type { Env } from '../../env';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Rich text in Notion's 2000-character pieces. */
const text = (content: string) => ({ rich_text: (content.match(/[\s\S]{1,2000}/g) ?? []).map((chunk) => ({ text: { content: chunk } })) });

export default async function handler(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }


  try {
    // Saved encounters live in D1 now (migrations/0006_game_data.sql), in the
    // table imported from Notion's Encounters database, with its columns.
    const notion = new ContentClient(env.DB);
    const { encounter } = await req.json<any>();

    // `encounter` is the app's GeneratedEncounter (src/types/encounter.ts).
    console.log('Saving encounter:', encounter.encounter_name);

    const properties: any = {
      'Encounter Name': {
        title: [{ text: { content: encounter.encounter_name || 'Unnamed Encounter' } }]
      },
      'Total XP': {
        number: encounter.total_xp || 0
      },
      Status: {
        select: { name: 'Generated' }
      },
      'Date Generated': {
        date: { start: new Date().toISOString() }
      },
    };

    if (encounter.environment) {
      properties.Environment = {
        select: { name: encounter.environment }
      };
    }

    if (encounter.difficulty) {
      properties.Description = text(`${encounter.difficulty} encounter`);
    }

    const creatureSummary = (encounter.creatures || [])
      .map((c: any) => `${c.quantity}× ${c.name} (CR ${c.challenge_rating})`)
      .join('\n');
    if (creatureSummary) properties['Monster Details'] = text(creatureSummary);
    if (encounter.generation_notes) properties['Generation Algorithm Notes'] = text(encounter.generation_notes);

    const response = await notion.pages.create({
      parent: { database_id: 'encounters' },
      properties,
    });

    console.log('Encounter saved:', response.id);

    // No Notion page to open any more, so no pageUrl.
    return new Response(
      JSON.stringify({ id: response.id, success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error saving encounter:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
