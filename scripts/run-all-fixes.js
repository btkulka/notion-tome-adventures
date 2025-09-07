// Unified script to run both creature type and alignment fixes
async function runAllFixes() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjg3MzksImV4cCI6MjA3MjYwNDczOX0.c6qWZxBKdB9r9_wMidj4_BX8cQrbl54gknrRLGZpEyk'
  
  console.log('🚀 Running all field fixes for Notion D&D database...\n')
  
  // Function to run a specific fix
  async function runFix(functionName, description) {
    console.log(`${description}...`)
    console.log('='.repeat(50))
    
    try {
      const response = await fetch(`${baseUrl}/${functionName}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({})
      })
      
      if (response.status === 200) {
        const jsonResponse = JSON.parse(await response.text())
        console.log('✅ Success!')
        console.log('📋 Summary:', jsonResponse.summary)
        
        if (jsonResponse.details && jsonResponse.details.length > 0) {
          console.log('\n📝 Sample results:')
          jsonResponse.details.slice(0, 3).forEach((detail, index) => {
            console.log(`${index + 1}. ${detail.monster} - ${detail.status}`)
            if (detail.foundValue || detail.foundType) {
              const value = detail.foundValue || detail.foundType
              console.log(`   Set: ${value}`)
              console.log(`   Original: "${detail.originalTags}"`)
              console.log(`   Cleaned: "${detail.updatedTagsText}"`)
            }
          })
          if (jsonResponse.details.length > 3) {
            console.log(`   ... and ${jsonResponse.details.length - 3} more`)
          }
        }
        
        return jsonResponse.summary
      } else {
        const errorText = await response.text()
        console.log('❌ Error:', errorText)
        return null
      }
    } catch (error) {
      console.error('❌ Failed:', error)
      return null
    }
  }
  
  // Run creature type fix
  const creatureTypeResults = await runFix('fix-creature-types', '🐉 Fixing creature types')
  console.log('\n')
  
  // Run alignment fix  
  const alignmentResults = await runFix('fix-alignments', '⚖️ Fixing alignments')
  console.log('\n')
  
  // Summary
  console.log('🎉 ALL FIXES COMPLETED!')
  console.log('='.repeat(50))
  
  if (creatureTypeResults) {
    console.log('🐉 Creature Types:')
    console.log(`   - Processed: ${creatureTypeResults.processed || 0}`)
    console.log(`   - Updated: ${creatureTypeResults.updated || 0}`)
    console.log(`   - Errors: ${creatureTypeResults.errors || 0}`)
  }
  
  if (alignmentResults) {
    console.log('⚖️ Alignments:')
    console.log(`   - Processed: ${alignmentResults.processed || 0}`)
    console.log(`   - Updated: ${alignmentResults.updated || 0}`)
    console.log(`   - Errors: ${alignmentResults.errors || 0}`)
  }
  
  const totalUpdated = (creatureTypeResults?.updated || 0) + (alignmentResults?.updated || 0)
  console.log(`\n🏆 Total monsters updated: ${totalUpdated}`)
  console.log('\n💫 Your Notion D&D database is now fully optimized!')
}

runAllFixes()
