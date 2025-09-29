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
    console.log('🔍 Testing creature type extraction...')

    // Call the generate-encounter function directly
    const generateResponse = await fetch('https://xhrobkdzjabllhftksvt.supabase.co/functions/v1/generate-encounter', {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        environment: 'Arctic',
        xpThreshold: 500,
        maxMonsters: 3
      })
    })

    if (!generateResponse.ok) {
      throw new Error(`Generate encounter failed: ${generateResponse.statusText}`)
    }

    const encounterData = await generateResponse.json()

    // Extract creature type information
    const creatureTypeAnalysis = encounterData.creatures?.map((creature: any) => ({
      name: creature.name,
      creature_type: creature.creature_type,
      size: creature.size,
      alignment: creature.alignment,
      challenge_rating: creature.challenge_rating
    })) || []

    return new Response(JSON.stringify({
      success: true,
      encounterGenerated: !!encounterData.creatures,
      totalCreatures: encounterData.creatures?.length || 0,
      creatureTypeAnalysis,
      rawEncounterData: encounterData
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('❌ Error in creature type test:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
