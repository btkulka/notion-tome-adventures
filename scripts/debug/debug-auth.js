// Test without authorization header
async function testWithoutAuth() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  
  console.log('🧪 Testing simple-creatures-test function without auth header...')
  
  try {
    const response = await fetch(`${baseUrl}/simple-creatures-test`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })
    
    console.log('📊 Status:', response.status)
    
    const responseText = await response.text()
    console.log('📦 Response:', responseText)
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Test with service role key (if available)
async function testWithServiceKey() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  
  console.log('🧪 Testing simple-creatures-test function with service key...')
  
  try {
    const response = await fetch(`${baseUrl}/simple-creatures-test`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjg3MzksImV4cCI6MjA3MjYwNDczOX0.c6qWZxBKdB9r9_wMidj4_BX8cQrbl54gknrRLGZpEyk'
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

console.log('Testing both scenarios...')
testWithoutAuth().then(() => testWithServiceKey())
