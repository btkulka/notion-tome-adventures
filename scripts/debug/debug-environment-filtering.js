// Debug script to check environment filtering issues
async function debugEnvironmentFiltering() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1MTE5NDMsImV4cCI6MjA1MTA4Nzk0M30.iNFzw-0wBMqGkmD9Y3zGwGh-LnqGczwpJ7TKOlPPnGQ'
  
  console.log('🐛 Debugging environment filtering issue...')
  
  // Test 1: Check what environments are available
  console.log('\n1️⃣ Testing fetch-environments...')
  try {
    const envResponse = await fetch(`${baseUrl}/fetch-environments`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({})
    })
    
    const envData = await envResponse.json()
    if (envData.data && envData.data.environments) {
      console.log(`✅ Found ${envData.data.environments.length} environments:`)
      envData.data.environments.forEach((env, index) => {
        console.log(`   ${index + 1}. "${env.name}" (${env.terrain_type?.join(', ') || 'no terrain'})`)
      })
    } else {
      console.log('❌ No environments found or unexpected format:', envData)
    }
  } catch (error) {
    console.error('❌ Failed to fetch environments:', error)
  }
  
  // Test 2: Try generate encounter with "Any" environment (should work)
  console.log('\n2️⃣ Testing encounter generation with "Any" environment...')
  try {
    const anyResponse = await fetch(`${baseUrl}/generate-encounter`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        environment: 'Any',
        xpThreshold: 500,
        maxMonsters: 3,
        minCR: '0',
        maxCR: '5',
        alignment: 'Any',
        creatureType: 'Any',
        size: 'Any'
      })
    })
    
    console.log(`📊 "Any" environment status: ${anyResponse.status}`)
    const anyData = await anyResponse.text()
    
    if (anyResponse.status === 200) {
      try {
        const parsed = JSON.parse(anyData)
        console.log('✅ "Any" environment worked! Encounter:', {
          totalXP: parsed.data?.total_xp,
          creatureCount: parsed.data?.creatures?.length,
          environment: parsed.data?.environment
        })
      } catch (e) {
        console.log('✅ "Any" environment worked! Raw response:', anyData.substring(0, 200))
      }
    } else {
      console.log('❌ "Any" environment failed:', anyData.substring(0, 500))
    }
  } catch (error) {
    console.error('❌ Failed to test "Any" environment:', error)
  }
  
  // Test 3: Try with specific environments that we know exist
  const testEnvironments = ['Forest', 'Mountains', 'Swamp', 'Desert', 'Urban', 'Coastal', 'Arctic']
  
  for (const env of testEnvironments) {
    console.log(`\n3️⃣ Testing environment "${env}"...`)
    try {
      const response = await fetch(`${baseUrl}/generate-encounter`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({
          environment: env,
          xpThreshold: 500,
          maxMonsters: 3,
          minCR: '0',
          maxCR: '5',
          alignment: 'Any',
          creatureType: 'Any',
          size: 'Any'
        })
      })
      
      console.log(`📊 "${env}" status: ${response.status}`)
      const responseText = await response.text()
      
      if (response.status === 200) {
        try {
          const parsed = JSON.parse(responseText)
          console.log(`✅ "${env}" worked! Creatures: ${parsed.data?.creatures?.length}`)
        } catch (e) {
          console.log(`✅ "${env}" worked!`)
        }
      } else {
        console.log(`❌ "${env}" failed:`, responseText.substring(0, 200))
      }
    } catch (error) {
      console.error(`❌ Failed to test "${env}":`, error)
    }
  }
  
  // Test 4: Try with very lenient parameters
  console.log('\n4️⃣ Testing with very lenient parameters...')
  try {
    const response = await fetch(`${baseUrl}/generate-encounter`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        environment: 'Any',
        xpThreshold: 10000,  // Very high XP
        maxMonsters: 10,     // Many monsters allowed
        minCR: '0',
        maxCR: '30',         // Wide CR range
        alignment: 'Any',
        creatureType: 'Any',
        size: 'Any'
      })
    })
    
    console.log(`📊 Lenient parameters status: ${response.status}`)
    const responseText = await response.text()
    
    if (response.status === 200) {
      try {
        const parsed = JSON.parse(responseText)
        console.log('✅ Lenient parameters worked! Encounter:', {
          totalXP: parsed.data?.total_xp,
          creatureCount: parsed.data?.creatures?.length,
          environment: parsed.data?.environment
        })
      } catch (e) {
        console.log('✅ Lenient parameters worked!')
      }
    } else {
      console.log('❌ Even lenient parameters failed:', responseText.substring(0, 500))
    }
  } catch (error) {
    console.error('❌ Failed lenient parameter test:', error)
  }
}

debugEnvironmentFiltering()
