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

    const notion = new Client({ auth: notionApiKey });

    console.log('Discovering Notion databases...');

    const response = await notion.search({
      filter: { property: 'object', value: 'database' },
      page_size: 100,
    });

    const allDatabases = response.results.map((db: any) => ({
      id: db.id,
      title: db.title?.[0]?.plain_text || 'Untitled',
      url: db.url,
      lastEditedTime: db.last_edited_time,
    }));

    const expectedDatabases = [
      'Creatures',
      'Environments',
      'Sessions',
      'Encounters',
      'Monster Instances',
      'Monster Stats',
      'Challenge Ratings',
      'Magic Items',
      'Creature Types',
    ];

    const matches = expectedDatabases.map((expectedName) => {
      const matched = allDatabases.find((db: any) =>
        db.title.toLowerCase().includes(expectedName.toLowerCase())
      );
      const suggestions = allDatabases.filter((db: any) =>
        db.title.toLowerCase().includes(expectedName.toLowerCase().split(' ')[0])
      );

      return {
        expectedName,
        matched,
        suggestions: suggestions.slice(0, 3),
      };
    });

    console.log(`Discovered ${allDatabases.length} databases`);

    return new Response(
      JSON.stringify({ allDatabases, matches }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error discovering databases:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
