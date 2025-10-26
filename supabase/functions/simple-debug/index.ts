const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const envVars = {
      NOTION_API_KEY: Deno.env.get('NOTION_API_KEY') ? '✓ Set' : '✗ Missing',
      MONSTERS_DATABASE_ID: Deno.env.get('MONSTERS_DATABASE_ID') ? '✓ Set' : '✗ Missing',
      ENVIRONMENTS_DATABASE_ID: Deno.env.get('ENVIRONMENTS_DATABASE_ID') ? '✓ Set' : '✗ Missing',
      SESSIONS_DATABASE_ID: Deno.env.get('SESSIONS_DATABASE_ID') ? '✓ Set' : '✗ Missing',
      ENCOUNTERS_DATABASE_ID: Deno.env.get('ENCOUNTERS_DATABASE_ID') ? '✓ Set' : '✗ Missing',
      MONSTER_TYPE_DATABASE_ID: Deno.env.get('MONSTER_TYPE_DATABASE_ID') ? '✓ Set' : '✗ Missing',
    };

    console.log('Debug - Environment variables:', envVars);

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
});
