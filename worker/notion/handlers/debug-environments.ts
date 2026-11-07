import { ContentClient } from '../../content/client';
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
    // Moved from Notion into D1 (scripts/notion-import); see worker/content/client.ts.
    const notion = new ContentClient(env.DB);
    const environmentsDbId = 'environments';

    console.log('Debug: Fetching environments database schema...');

    const database = await notion.databases.retrieve({ database_id: environmentsDbId });
    const query = await notion.databases.query({ database_id: environmentsDbId });

    const debugInfo = {
      database: {
        id: database.id,
        title: 'object' in database && 'title' in database ? database.title?.[0]?.plain_text || 'Untitled' : 'Untitled',
        properties: 'object' in database && 'properties' in database ? Object.entries(database.properties).map(([name, prop]: [string, any]) => ({
          name,
          type: prop.type,
        })) : [],
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
