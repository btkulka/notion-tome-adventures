// Test to examine relation property structure
async function examineRelations() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjg3MzksImV4cCI6MjA3MjYwNDczOX0.c6qWZxBKdB9r9_wMidj4_BX8cQrbl54gknrRLGZpEyk'
  
  console.log('🔍 Examining relation properties...')
  
  try {
    const response = await fetch(`${baseUrl}/simple-creatures-test`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({})
    })
    
    if (response.status === 200) {
      const data = await response.json()
      console.log('🔗 Creature Type relation:', data.fullProperties['Creature Type'])
      console.log('⭐ Challenge Rating relation:', data.fullProperties['Challenge Rating'])
      
      // Check if we have relation IDs we can examine
      const creatureTypeId = data.fullProperties['Creature Type']?.relation?.[0]?.id
      const challengeRatingId = data.fullProperties['Challenge Rating']?.relation?.[0]?.id
      
      if (creatureTypeId) {
        console.log('🎯 Found Creature Type relation ID:', creatureTypeId)
      }
      if (challengeRatingId) {
        console.log('🎯 Found Challenge Rating relation ID:', challengeRatingId)
      }
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

examineRelations()
