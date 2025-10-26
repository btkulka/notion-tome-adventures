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

    if (!notionApiKey) {
      return new Response(
        JSON.stringify({ error: 'Notion API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { databaseId } = await req.json();

    if (!databaseId) {
      return new Response(
        JSON.stringify({ error: 'Database ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notion = new Client({ auth: notionApiKey });

    console.log('Fetching schema for database:', databaseId);

    const database = await notion.databases.retrieve({ database_id: databaseId });

    const properties = 'object' in database && 'properties' in database 
      ? Object.entries(database.properties).map(([name, prop]: [string, any]) => ({
          name,
          type: prop.type,
          id: prop.id,
          config: prop[prop.type] || {},
        }))
      : [];

    const schema = {
      id: database.id,
      title: 'object' in database && 'title' in database ? database.title?.[0]?.plain_text || 'Untitled' : 'Untitled',
      properties,
      url: 'object' in database && 'url' in database ? database.url : '',
    };

    console.log(`Schema retrieved for ${schema.title} with ${properties.length} properties`);

    return new Response(
      JSON.stringify(schema),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching schema:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
