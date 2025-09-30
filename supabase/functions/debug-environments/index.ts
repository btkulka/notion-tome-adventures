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
    const environmentsDbId = Deno.env.get('ENVIRONMENTS_DATABASE_ID');

    if (!notionApiKey || !environmentsDbId) {
      return new Response(
        JSON.stringify({ error: 'Notion configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notion = new Client({ auth: notionApiKey });

    console.log('Debug: Fetching environments database schema...');

    const database = await notion.databases.retrieve({ database_id: environmentsDbId });
    const query = await notion.databases.query({ database_id: environmentsDbId });

    const debugInfo = {
      database: {
        id: database.id,
        title: database.title?.[0]?.plain_text || 'Untitled',
        properties: Object.entries(database.properties).map(([name, prop]: [string, any]) => ({
          name,
          type: prop.type,
        })),
      },
      results: query.results.slice(0, 3).map((page: any) => ({
        id: page.id,
        properties: Object.entries(page.properties).map(([name, prop]: [string, any]) => ({
          name,
          type: prop.type,
          value: JSON.stringify(prop, null, 2),
        })),
      })),
    };

    console.log('Debug info collected');

    return new Response(
      JSON.stringify(debugInfo),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in debug:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
