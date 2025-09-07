// Get schema for both databases to understand property names
async function getSchemas() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjg3MzksImV4cCI6MjA3MjYwNDczOX0.c6qWZxBKdB9r9_wMidj4_BX8cQrbl54gknrRLGZpEyk'
  
  // Check Monsters database
  console.log('🐉 Getting Monsters database schema...')
  try {
    const response = await fetch(`${baseUrl}/get-notion-schema`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ databaseId: '9af45a5a-517d-4e4e-85e6-c35dab99cc5f' })
    })
    
    if (response.status === 200) {
      const schema = await response.json()
      console.log(`📋 Monsters Database - "${schema.title}"`)
      console.log('Properties:')
      schema.properties.forEach(prop => {
        console.log(`  - ${prop.name}: ${prop.type}`)
      })
    } else {
      console.log('❌ Failed to get Monsters schema:', await response.text())
    }
  } catch (error) {
    console.error('❌ Error getting Monsters schema:', error)
  }

  console.log('\n' + '='.repeat(50) + '\n')

  // Check Creature Types database  
  console.log('🏷️ Getting Creature Types database schema...')
  try {
    const response = await fetch(`${baseUrl}/get-notion-schema`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ databaseId: 'f6d304ab-28c2-482e-95e6-ad097a3e5e4e' })
    })
    
    if (response.status === 200) {
      const schema = await response.json()
      console.log(`📋 Creature Types Database - "${schema.title}"`)
      console.log('Properties:')
      schema.properties.forEach(prop => {
        console.log(`  - ${prop.name}: ${prop.type}`)
      })
    } else {
      console.log('❌ Failed to get Creature Types schema:', await response.text())
    }
  } catch (error) {
    console.error('❌ Error getting Creature Types schema:', error)
  }

  console.log('\n' + '='.repeat(50) + '\n')
  console.log('💡 Use this information to identify the correct property names')
  console.log('   for the creature type fix script.')
}

getSchemas()
