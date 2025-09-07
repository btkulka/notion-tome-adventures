// Simple debug test for deployed functions
async function testDeployedFunction() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1MTE5NDMsImV4cCI6MjA1MTA4Nzk0M30.iNFzw-0wBMqGkmD9Y3zGwGh-LnqGczwpJ7TKOlPPnGQ'
  
  console.log('🧪 Testing simple-creatures-test function...')
  
  try {
    const response = await fetch(`${baseUrl}/simple-creatures-test`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({})
    })
    
    console.log('📊 Status:', response.status)
    
    const responseText = await response.text()
    console.log('📦 Response:', responseText)
    
    if (response.status === 200) {
      try {
        const jsonResponse = JSON.parse(responseText)
        console.log('✅ Parsed JSON:', JSON.stringify(jsonResponse, null, 2))
      } catch (e) {
        console.log('⚠️ Response is not JSON')
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testDeployedFunction()
