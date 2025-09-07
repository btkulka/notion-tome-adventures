import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Client } from 'https://esm.sh/@notionhq/client@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// XP thresholds by CR (standard D&D 5e)
const XP_BY_CR: Record<number, number> = {
  0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
  1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
  6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
  11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
  16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
  21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000,
  26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000
}

// Encounter multipliers based on number of monsters
const ENCOUNTER_MULTIPLIERS = [
  1,    // 1 monster
  1.5,  // 2 monsters
  2,    // 3-6 monsters
  2.5,  // 7-10 monsters
  3,    // 11-14 monsters
  4,    // 15+ monsters
]

function getEncounterMultiplier(numMonsters: number): number {
  if (numMonsters === 1) return ENCOUNTER_MULTIPLIERS[0]
  if (numMonsters === 2) return ENCOUNTER_MULTIPLIERS[1]
  if (numMonsters <= 6) return ENCOUNTER_MULTIPLIERS[2]
  if (numMonsters <= 10) return ENCOUNTER_MULTIPLIERS[3]
  if (numMonsters <= 14) return ENCOUNTER_MULTIPLIERS[4]
  return ENCOUNTER_MULTIPLIERS[5]
}

function generateEncounter(creatures: any[], params: any): any {
  const { xpThreshold, maxMonsters, environment } = params
  const generationLog: string[] = []
  
  generationLog.push(`🎲 Rolling for encounter in ${environment}...`)
  generationLog.push(`🎯 XP Budget: ${xpThreshold} | Max Monsters: ${maxMonsters}`)
  
  if (creatures.length === 0) {
    generationLog.push(`❌ No creatures found matching the filters`)
    throw new Error('No creatures found matching the specified criteria')
  }
  
  generationLog.push(`🔍 Found ${creatures.length} possible creatures`)
  
  // Simple encounter generation algorithm
  const selectedMonsters: any[] = []
  let currentXP = 0
  let attempts = 0
  const maxAttempts = 100
  
  while (currentXP < xpThreshold * 0.7 && selectedMonsters.length < maxMonsters && attempts < maxAttempts) {
    attempts++
    
    // Filter creatures that wouldn't exceed our budget too much
    const affordableCreatures = creatures.filter(creature => {
      const xp = XP_BY_CR[creature.challenge_rating] || 0
      return xp <= (xpThreshold - currentXP) * 1.2 // Allow slight overage
    })
    
    if (affordableCreatures.length === 0) {
      generationLog.push(`💸 No more affordable creatures (current XP: ${currentXP})`)
      break
    }
    
    // Pick a random creature
    const randomCreature = affordableCreatures[Math.floor(Math.random() * affordableCreatures.length)]
    const creatureXP = XP_BY_CR[randomCreature.challenge_rating] || 0
    
    // Check if we already have this creature type
    const existingMonster = selectedMonsters.find(m => m.name === randomCreature.name)
    
    if (existingMonster) {
      existingMonster.quantity += 1
      existingMonster.total_xp += creatureXP
      generationLog.push(`➕ Added another ${randomCreature.name} (quantity: ${existingMonster.quantity})`)
    } else {
      selectedMonsters.push({
        name: randomCreature.name,
        quantity: 1,
        cr: randomCreature.challenge_rating,
        xp: creatureXP,
        total_xp: creatureXP,
        type: randomCreature.type,
        alignment: randomCreature.alignment,
        size: randomCreature.size,
      })
      generationLog.push(`✨ Selected ${randomCreature.name} (CR ${randomCreature.challenge_rating}, ${creatureXP} XP)`)
    }
    
    // Recalculate total XP with encounter multiplier
    const totalMonsters = selectedMonsters.reduce((sum, m) => sum + m.quantity, 0)
    const baseXP = selectedMonsters.reduce((sum, m) => sum + m.total_xp, 0)
    const multiplier = getEncounterMultiplier(totalMonsters)
    currentXP = Math.floor(baseXP * multiplier)
    
    generationLog.push(`📊 Current: ${totalMonsters} monsters, ${baseXP} base XP, ${multiplier}x multiplier = ${currentXP} adjusted XP`)
  }
  
  const totalMonsters = selectedMonsters.reduce((sum, m) => sum + m.quantity, 0)
  const baseXP = selectedMonsters.reduce((sum, m) => sum + m.total_xp, 0)
  const adjustedXP = Math.floor(baseXP * getEncounterMultiplier(totalMonsters))
  
  generationLog.push(`🏁 Final encounter: ${totalMonsters} monsters, ${adjustedXP} XP`)
  
  // Determine difficulty
  let difficulty = 'Easy'
  if (adjustedXP >= xpThreshold * 1.5) difficulty = 'Deadly'
  else if (adjustedXP >= xpThreshold * 1.25) difficulty = 'Hard'
  else if (adjustedXP >= xpThreshold) difficulty = 'Medium'
  
  generationLog.push(`⚔️ Encounter difficulty: ${difficulty}`)
  
  return {
    id: `enc_${Date.now()}`,
    environment,
    totalXP: adjustedXP,
    baseXP,
    difficulty,
    monsters: selectedMonsters,
    generationLog,
    parameters: params,
  }
}

serve(async (req) => {
  const corsResponse = handleCORS(req)
  if (corsResponse) return corsResponse

  try {
    const creaturesDbId = validateDatabaseId(
      Deno.env.get('CREATURES_DATABASE_ID'), 
      'CREATURES_DATABASE_ID'
    )
    const environmentsDbId = validateDatabaseId(
      Deno.env.get('ENVIRONMENTS_DATABASE_ID'), 
      'ENVIRONMENTS_DATABASE_ID'
    )
    
    console.log('Generating encounter with creatures from:', creaturesDbId)
    console.log('Using environments database:', environmentsDbId)
    
    const notion = createNotionClient()

    const params = await req.json()
    const {
      environment,
      xpThreshold,
      maxMonsters,
      minCR,
      maxCR,
      alignment,
      creatureType,
      size,
    } = params

    console.log('Generating encounter with params:', params)

    // First, fetch matching creatures
    console.log('Fetching creatures...');
    const creaturesResponse = await fetch(
      `https://xhrobkdzjabllhftksvt.supabase.co/functions/v1/fetch-creatures`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({
          environment,
          minCR,
          maxCR,
          creatureType,
          alignment,
          size,
        }),
      }
    )

    if (!creaturesResponse.ok) {
      throw new Error('Failed to fetch creatures')
    }

    const { creatures } = await creaturesResponse.json()

    // Generate the encounter
    const encounter = generateEncounter(creatures, params)

    // Optionally save to Notion encounters database
    const ENCOUNTERS_DATABASE_ID = Deno.env.get('ENCOUNTERS_DATABASE_ID')
    
    if (ENCOUNTERS_DATABASE_ID) {
      try {
        await notion.pages.create({
          parent: { database_id: ENCOUNTERS_DATABASE_ID },
          properties: {
            Name: {
              title: [
                {
                  text: {
                    content: `${encounter.environment} Encounter - ${encounter.difficulty}`,
                  },
                },
              ],
            },
            Environment: {
              select: {
                name: encounter.environment,
              },
            },
            Difficulty: {
              select: {
                name: encounter.difficulty,
              },
            },
            TotalXP: {
              number: encounter.totalXP,
            },
            BaseXP: {
              number: encounter.baseXP,
            },
            Monsters: {
              rich_text: [
                {
                  text: {
                    content: JSON.stringify(encounter.monsters, null, 2),
                  },
                },
              ],
            },
            GenerationLog: {
              rich_text: [
                {
                  text: {
                    content: encounter.generationLog.join('\n'),
                  },
                },
              ],
            },
            Parameters: {
              rich_text: [
                {
                  text: {
                    content: JSON.stringify(params, null, 2),
                  },
                },
              ],
            },
          },
        })
        console.log('Encounter saved to Notion')
      } catch (saveError) {
        console.error('Failed to save encounter to Notion:', saveError)
        // Don't fail the whole request if saving fails
      }
    }

    return new Response(
      JSON.stringify({ encounter }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in generate-encounter function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})