// Test the fetch-sessions edge function
async function testFetchSessions() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1MTE5NDMsImV4cCI6MjA1MTA4Nzk0M30.iNFzw-0wBMqGkmD9Y3zGwGh-LnqGczwpJ7TKOlPPnGQ'
  
  console.log('🧪 Testing fetch-sessions edge function...')
  
  const tests = [
    { name: 'All sessions', body: {} },
    { name: 'Search sessions', body: { search: 'session' } }
  ]
  
  for (const test of tests) {
    try {
      console.log(`\n📅 Testing ${test.name}...`)
      
      const response = await fetch(`${baseUrl}/fetch-sessions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify(test.body)
      })
      
      console.log(`📊 Status:`, response.status)
      console.log(`📋 Headers:`, Object.fromEntries(response.headers.entries()))
      
      let responseText
      try {
        responseText = await response.text()
        console.log(`📦 Raw Response:`, responseText.substring(0, 1000) + (responseText.length > 1000 ? '...' : ''))
        
        // Try to parse as JSON for better formatting
        try {
          const jsonResponse = JSON.parse(responseText)
          console.log(`✨ Parsed Response:`, JSON.stringify(jsonResponse, null, 2).substring(0, 1500))
          
          if (jsonResponse.data && jsonResponse.data.sessions) {
            console.log(`📈 Sessions Count:`, jsonResponse.data.sessions.length)
            if (jsonResponse.data.sessions.length > 0) {
              console.log(`📋 First Session:`, JSON.stringify(jsonResponse.data.sessions[0], null, 2))
            }
          }
        } catch (e) {
          console.log('⚠️ Response is not JSON:', e.message)
        }
      } catch (e) {
        console.error(`❌ Failed to read response:`, e)
      }
      
    } catch (error) {
      console.error(`❌ Test ${test.name} failed:`, error)
    }
  }
}

// Also test if the function exists at all
async function testFunctionExists() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1MTE5NDMsImV4cCI6MjA1MTA4Nzk0M30.iNFzw-0wBMqGkmD9Y3zGwGh-LnqGczwpJ7TKOlPPnGQ'
  
  console.log('🔍 Testing if fetch-sessions function exists...')
  
  try {
    const response = await fetch(`${baseUrl}/fetch-sessions`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${anonKey}`
      }
    })
    
    console.log(`📊 GET Status:`, response.status)
    const text = await response.text()
    console.log(`📦 GET Response:`, text)
    
  } catch (error) {
    console.error(`❌ Function existence test failed:`, error)
  }
}

async function main() {
  await testFunctionExists()
  await testFetchSessions()
}

main()
