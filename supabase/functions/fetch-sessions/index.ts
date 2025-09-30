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
    const sessionsDbId = Deno.env.get('SESSIONS_DATABASE_ID');

    if (!notionApiKey || !sessionsDbId) {
      return new Response(
        JSON.stringify({ error: 'Notion configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notion = new Client({ auth: notionApiKey });
    const { searchQuery } = await req.json().catch(() => ({}));

    console.log('Fetching sessions with search:', searchQuery);

    const query: any = { database_id: sessionsDbId };
    
    if (searchQuery) {
      query.filter = {
        property: 'Name',
        title: { contains: searchQuery }
      };
    }

    const response = await notion.databases.query(query);

    const sessions = response.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        name: props.Name?.title?.[0]?.plain_text || 'Unnamed Session',
        date: props.Date?.date?.start || '',
        description: props.Description?.rich_text?.[0]?.plain_text || '',
      };
    });

    console.log(`Fetched ${sessions.length} sessions`);

    return new Response(
      JSON.stringify({ sessions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
