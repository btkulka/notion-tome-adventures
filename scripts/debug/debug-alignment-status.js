// Debug script to see what alignments monsters actually have
async function debugAlignments() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjg3MzksImV4cCI6MjA3MjYwNDczOX0.c6qWZxBKdB9r9_wMidj4_BX8cQrbl54gknrRLGZpEyk'
  
  console.log('🔍 Debugging monster alignments...')
  
  try {
    // Get a sample of monsters to see their alignment status
    const response = await fetch(`${baseUrl}/fetch-creatures`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        environment: 'Any',
        minCR: 0,
        maxCR: 30
      })
    })
    
    if (response.status === 200) {
      const jsonResponse = await response.json()
      const creatures = jsonResponse.creatures || []
      
      console.log(`📋 Found ${creatures.length} creatures, checking alignments:`)
      
      let hasAlignment = 0
      let noAlignment = 0
      let hasTagsWithAlignment = 0
      
      const alignmentKeywords = ['lawful', 'neutral', 'chaotic', 'good', 'evil', 'unaligned']
      
      creatures.forEach((creature, index) => {
        if (index < 20) { // Show first 20 for debugging
          console.log(`\n${index + 1}. ${creature.name}`)
          console.log(`   Current alignment: "${creature.alignment || 'NONE'}"`)
          
          // Check if creature has alignment keywords in name or other fields
          const hasAlignmentInTags = alignmentKeywords.some(keyword => 
            (creature.name || '').toLowerCase().includes(keyword) ||
            (creature.type || '').toLowerCase().includes(keyword)
          )
          
          if (hasAlignmentInTags) {
            console.log(`   🏷️ Has alignment keywords in name/type`)
            hasTagsWithAlignment++
          }
        }
        
        if (creature.alignment && creature.alignment !== 'Unknown' && creature.alignment !== '') {
          hasAlignment++
        } else {
          noAlignment++
          if (index < 5) {
            console.log(`   ❓ NO ALIGNMENT SET`)
          }
        }
      })
      
      console.log(`\n📊 Alignment Summary:`)
      console.log(`   - Has alignment: ${hasAlignment}`)
      console.log(`   - No alignment: ${noAlignment}`) 
      console.log(`   - Has alignment keywords: ${hasTagsWithAlignment}`)
      
    } else {
      console.log('❌ Error fetching creatures:', await response.text())
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error)
  }
}

debugAlignments()
