// Direct check for monsters with empty alignments
async function checkEmptyAlignments() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjg3MzksImV4cCI6MjA3MjYwNDczOX0.c6qWZxBKdB9r9_wMidj4_BX8cQrbl54gknrRLGZpEyk'
  
  console.log('🔍 Checking database directly for empty alignments...')
  
  try {
    // Use the simple-creatures-test function to get raw data
    const response = await fetch(`${baseUrl}/simple-creatures-test`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({})
    })
    
    if (response.status === 200) {
      const jsonResponse = JSON.parse(await response.text())
      
      console.log('📋 Raw database response preview:')
      console.log(JSON.stringify(jsonResponse, null, 2).substring(0, 1000))
      
      // If this has creatures data, analyze it
      if (jsonResponse.creatures) {
        const creatures = jsonResponse.creatures
        let emptyAlignments = 0
        let totalCreatures = creatures.length
        
        console.log(`\n📊 Analyzing ${totalCreatures} creatures for alignment status:`)
        
        creatures.forEach((creature, index) => {
          const hasAlignment = creature.alignment && 
                              creature.alignment !== '' && 
                              creature.alignment !== 'Unknown' &&
                              creature.alignment !== null
          
          if (!hasAlignment) {
            emptyAlignments++
            if (emptyAlignments <= 10) {
              console.log(`${emptyAlignments}. ${creature.name || creature.id} - NO ALIGNMENT`)
            }
          }
        })
        
        console.log(`\n📈 Results:`)
        console.log(`   - Total creatures: ${totalCreatures}`)
        console.log(`   - Empty alignments: ${emptyAlignments}`)
        console.log(`   - Have alignments: ${totalCreatures - emptyAlignments}`)
      }
      
    } else {
      console.log('❌ Error response:', await response.text())
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error)
  }
}

checkEmptyAlignments()
