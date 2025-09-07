// Test the updated fetch-creatures function
async function testFetchCreatures() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjg3MzksImV4cCI6MjA3MjYwNDczOX0.c6qWZxBKdB9r9_wMidj4_BX8cQrbl54gknrRLGZpEyk'
  
  console.log('🧪 Testing updated fetch-creatures function...')
  
  try {
    const response = await fetch(`${baseUrl}/fetch-creatures`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        environment: 'Any',
        creatureType: 'Any',
        alignment: 'Any',
        size: 'Any',
        minCR: 0,
        maxCR: 20
      })
    })
    
    console.log('📊 Status:', response.status)
    
    const responseText = await response.text()
    console.log('📦 Response Length:', responseText.length)
    console.log('📦 Response Preview:', responseText.substring(0, 1000) + (responseText.length > 1000 ? '...' : ''))
    
    if (response.status === 200) {
      try {
        const jsonResponse = JSON.parse(responseText)
        console.log('✅ Success! Found', jsonResponse.creatures ? jsonResponse.creatures.length : 0, 'creatures')
        
        if (jsonResponse.creatures && jsonResponse.creatures.length > 0) {
          console.log('🐉 First creature sample:')
          console.log(JSON.stringify(jsonResponse.creatures[0], null, 2))
        }
      } catch (e) {
        console.log('⚠️ Response is not JSON:', e.message)
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testFetchCreatures()
