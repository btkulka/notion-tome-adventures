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
    // What the generators read used to be Notion databases named by env vars; now they're D1 tables.
    const { results } = await env.DB.prepare(
      `SELECT t.key, (SELECT COUNT(*) FROM content_rows r WHERE r.table_key = t.key) AS rows
         FROM content_tables t WHERE t.key IN ('monsters', 'environments', 'sessions', 'encounters', 'monster_types', 'campaigns')`
    ).all<{ key: string; rows: number }>();
    const envVars = Object.fromEntries(
      ['monsters', 'environments', 'sessions', 'encounters', 'monster_types', 'campaigns'].map((key) => {
        const table = results.find((t) => t.key === key);
        return [key, table ? `✓ Imported (${table.rows} rows)` : '✗ Missing'];
      })
    );

    console.log('Debug - Tables:', envVars);

    return new Response(
      JSON.stringify({
        message: 'Debug endpoint working',
        timestamp: new Date().toISOString(),
        environment: envVars,
      }),
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
