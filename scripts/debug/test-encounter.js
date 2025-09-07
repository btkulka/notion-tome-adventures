// Test the generate-encounter function
async function testGenerateEncounter() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjg3MzksImV4cCI6MjA3MjYwNDczOX0.c6qWZxBKdB9r9_wMidj4_BX8cQrbl54gknrRLGZpEyk'
  
  console.log('🧪 Testing generate-encounter function...')
  
  try {
    const response = await fetch(`${baseUrl}/generate-encounter`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        environment: 'Any',
        xpThreshold: 100,  // Lower threshold for faster test
        maxMonsters: 2,    // Fewer monsters for faster test
        minCR: 0,
        maxCR: 2,          // Lower CR for faster test
        alignment: 'Any',
        creatureType: 'Any',
        size: 'Any'
      })
    })
    
    console.log('📊 Status:', response.status)
    
    const responseText = await response.text()
    console.log('📦 Response:', responseText)
    
    if (response.status === 200) {
      try {
        const jsonResponse = JSON.parse(responseText)
        console.log('✅ Generated encounter:')
        console.log(JSON.stringify(jsonResponse, null, 2))
      } catch (e) {
        console.log('⚠️ Response is not JSON:', e.message)
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testGenerateEncounter()
