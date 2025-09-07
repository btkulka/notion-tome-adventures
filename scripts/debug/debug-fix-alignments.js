// Test the fix-alignments function
async function testFixAlignments() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjg3MzksImV4cCI6MjA3MjYwNDczOX0.c6qWZxBKdB9r9_wMidj4_BX8cQrbl54gknrRLGZpEyk'
  
  console.log('⚖️ Testing fix-alignments function...')
  
  try {
    const response = await fetch(`${baseUrl}/fix-alignments`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({})
    })
    
    console.log('📊 Status:', response.status)
    
    const responseText = await response.text()
    console.log('📦 Response length:', responseText.length)
    
    if (response.status === 200) {
      try {
        const jsonResponse = JSON.parse(responseText)
        console.log('✅ Process completed successfully!')
        console.log('📋 Summary:', jsonResponse.summary)
        
        if (jsonResponse.details && jsonResponse.details.length > 0) {
          console.log('\n📝 Sample results:')
          jsonResponse.details.slice(0, 5).forEach((detail, index) => {
            console.log(`${index + 1}. ${detail.monster} - ${detail.status}`)
            if (detail.foundValue) {
              console.log(`   Alignment: ${detail.foundValue}`)
              console.log(`   Original tags: "${detail.originalTags}"`)
              console.log(`   Updated tags: "${detail.updatedTagsText}"`)
            }
            if (detail.reason) {
              console.log(`   Reason: ${detail.reason}`)
            }
            if (detail.error) {
              console.log(`   Error: ${detail.error}`)
            }
          })
        }
        
        if (jsonResponse.alignmentValues) {
          console.log('\n⚖️ Available alignment values:')
          jsonResponse.alignmentValues.forEach(alignment => {
            console.log(`  - ${alignment}`)
          })
        }
        
      } catch (e) {
        console.log('⚠️ Response is not JSON:', responseText.substring(0, 500))
      }
    } else {
      console.log('❌ Error response:', responseText)
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testFixAlignments()
