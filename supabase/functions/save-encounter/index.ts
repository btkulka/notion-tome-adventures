import { Client } from 'https://deno.land/x/notion_sdk@v2.2.3/src/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    console.log('Saving encounter:', encounter.name);

    const properties: any = {
      Name: {
        title: [{ text: { content: encounter.name || 'Unnamed Encounter' } }]
      },
      Difficulty: {
        select: { name: encounter.difficulty || 'Medium' }
      },
      'Total XP': {
        number: encounter.totalXP || 0
      },
    };

    if (encounter.environment) {
      properties.Environment = {
        rich_text: [{ text: { content: encounter.environment } }]
      };
    }

    if (encounter.description) {
      properties.Description = {
        rich_text: [{ text: { content: encounter.description } }]
      };
    }

    const response = await notion.pages.create({
      parent: { database_id: encountersDbId },
      properties,
    });

    console.log('Encounter saved:', response.id);

    return new Response(
      JSON.stringify({ id: response.id, success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error saving encounter:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
