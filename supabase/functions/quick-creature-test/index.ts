import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔍 Quick creature type test...')

    // Use environment variables to make the request  
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    if (!supabaseUrl || !anonKey) {
      throw new Error('Missing Supabase configuration')
    }

    // Call the generate-encounter function
    const generateResponse = await fetch(`${supabaseUrl}/functions/v1/generate-encounter`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        environment: 'Forest',
        xpThreshold: 1000,
        maxMonsters: 2
      })
    })

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text()
      throw new Error(`Generate encounter failed: ${generateResponse.status} - ${errorText}`)
    }

    const encounterData = await generateResponse.json()

    // Check creature types
    const creatureAnalysis = (encounterData.creatures || []).map((creature: any) => ({
      name: creature.name,
      creature_type: creature.creature_type,
      creature_type_exists: creature.hasOwnProperty('creature_type'),
      creature_type_value: creature.creature_type,
      all_properties: Object.keys(creature)
    }))

    return new Response(JSON.stringify({
      success: true,
      encounter_id: encounterData.encounter_id,
      creature_count: encounterData.creatures?.length || 0,
      creatureAnalysis,
      sample_creature: encounterData.creatures?.[0] || null
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('❌ Quick test error:', error)
    return new Response(JSON.stringify({ 
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
