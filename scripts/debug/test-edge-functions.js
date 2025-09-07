// Test each edge function individually to isolate the issue
async function testIndividualFunctions() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1MTE5NDMsImV4cCI6MjA1MTA4Nzk0M30.iNFzw-0wBMqGkmD9Y3zGwGh-LnqGczwpJ7TKOlPPnGQ'
  
  console.log('🧪 Testing individual edge functions...')
  
  const functions = [
    { name: 'fetch-environments', method: 'POST', body: {} },
    { name: 'fetch-creatures', method: 'POST', body: { environment: 'Any' } },
    { name: 'generate-encounter', method: 'POST', body: { 
      environment: 'Any',
      xpThreshold: 100,
      maxMonsters: 3,
      minCR: 0,
      maxCR: 2,
      alignment: 'Any',
      creatureType: 'Any',
      size: 'Any'
    }}
  ]
  
  for (const func of functions) {
    try {
      console.log(`\n� Testing ${func.name}...`)
      
      const response = await fetch(`${baseUrl}/${func.name}`, {
        method: func.method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify(func.body)
      })
      
      console.log(`📊 ${func.name} Status:`, response.status)
      
      let responseText
      try {
        responseText = await response.text()
        console.log(`📦 ${func.name} Response:`, responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''))
        
        // Try to parse as JSON for better formatting
        try {
          const jsonResponse = JSON.parse(responseText)
          console.log(`� ${func.name} Parsed:`, JSON.stringify(jsonResponse, null, 2).substring(0, 800))
        } catch (e) {
          // Not JSON, just show the text
        }
      } catch (e) {
        console.error(`❌ Failed to read ${func.name} response:`, e)
      }
      
    } catch (error) {
      console.error(`❌ ${func.name} test failed:`, error)
    }
  }
}

testIndividualFunctions()
