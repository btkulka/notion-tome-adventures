import { Client } from 'https://deno.land/x/notion_sdk@v2.2.3/src/mod.ts';
import { requireDm } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const caller = await requireDm(req);
  if (caller instanceof Response) return caller;

  try {
    const notionApiKey = Deno.env.get('NOTION_API_KEY');
    const encountersDbId = Deno.env.get('ENCOUNTERS_DATABASE_ID');

    if (!notionApiKey || !encountersDbId) {
      return new Response(
        JSON.stringify({ error: 'Notion configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notion = new Client({ auth: notionApiKey });
    const { encounter } = await req.json();

    // `encounter` is the app's GeneratedEncounter (src/types/encounter.ts).
    console.log('Saving encounter:', encounter.encounter_name);

    const properties: any = {
      Name: {
        title: [{ text: { content: encounter.encounter_name || 'Unnamed Encounter' } }]
      },
      Difficulty: {
        select: { name: encounter.difficulty || 'Medium' }
      },
      'Total XP': {
        number: encounter.total_xp || 0
      },
    };

    if (encounter.environment) {
      properties.Environment = {
        rich_text: [{ text: { content: encounter.environment } }]
      };
    }

    const creatureSummary = (encounter.creatures || [])
      .map((c: any) => `${c.quantity}× ${c.name} (CR ${c.challenge_rating})`)
      .join(', ');
    const description = [creatureSummary, encounter.generation_notes].filter(Boolean).join('\n');
    if (description) {
      properties.Description = {
        rich_text: [{ text: { content: description.slice(0, 2000) } }]
      };
    }

    const response = await notion.pages.create({
      parent: { database_id: encountersDbId },
      properties,
    });

    console.log('Encounter saved:', response.id);

    return new Response(
      JSON.stringify({ id: response.id, pageUrl: (response as any).url, success: true }),
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
});
