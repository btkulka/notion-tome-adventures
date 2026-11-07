import type { Env } from '../../env';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function handler(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }


  try {
    // The databases are D1 tables now (scripts/notion-import); ids are still Notion's.
    console.log('Listing imported databases...');

    const { results } = await env.DB.prepare('SELECT notion_database_id, name, imported_at FROM content_tables ORDER BY rowid').all<{
      notion_database_id: string;
      name: string;
      imported_at: number;
    }>();

    const allDatabases = results.map((t) => ({
      id: t.notion_database_id,
      title: t.name || 'Untitled',
      url: '',
      lastEditedTime: new Date(t.imported_at * 1000).toISOString(),
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
      const matched = allDatabases.find((db) =>
        db.title.toLowerCase().includes(expectedName.toLowerCase())
      );
      const suggestions = allDatabases.filter((db) =>
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
