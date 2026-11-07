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
    const { databaseId } = await req.json<{ databaseId?: string }>();

    if (!databaseId) {
      return new Response(
        JSON.stringify({ error: 'Database ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // The databases are D1 tables now (scripts/notion-import); the schema is Notion's, as imported.
    const notion = new ContentClient(env.DB);

    console.log('Fetching schema for database:', databaseId);

    const database = await notion.databases.retrieve({ database_id: databaseId });

    const columns = database.properties as Record<string, { type: string; id: string } & Record<string, unknown>>;
    const properties = Object.entries(columns).map(([name, prop]) => ({
      name,
      type: prop.type,
      id: prop.id,
      config: prop[prop.type] || {},
    }));

    const schema = {
      id: database.id,
      title: database.title?.[0]?.plain_text || 'Untitled',
      properties,
      url: '',
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
}
