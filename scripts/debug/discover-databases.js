// Discover Notion databases to identify the correct IDs
async function discoverDatabases() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjg3MzksImV4cCI6MjA3MjYwNDczOX0.c6qWZxBKdB9r9_wMidj4_BX8cQrbl54gknrRLGZpEyk'
  
  console.log('🔍 Discovering Notion databases...')
  
  try {
    const response = await fetch(`${baseUrl}/discover-notion-databases`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({})
    })
    
    console.log('📊 Status:', response.status)
    
    const responseText = await response.text()
    
    if (response.status === 200) {
      try {
        const jsonResponse = JSON.parse(responseText)
        console.log('✅ Discovery completed successfully!')
        
        console.log('\n📋 All databases found:')
        jsonResponse.allDatabases.forEach((db, index) => {
          console.log(`${index + 1}. "${db.title}" - ID: ${db.id}`)
        })
        
        console.log('\n🎯 Matched databases:')
        jsonResponse.matches.forEach(match => {
          console.log(`\n${match.expectedName}:`)
          if (match.matched) {
            console.log(`  ✅ Best match: "${match.matched.title}" - ID: ${match.matched.id}`)
          } else {
            console.log(`  ❌ No matches found`)
          }
          
          if (match.suggestions.length > 0) {
            console.log(`  Suggestions:`)
            match.suggestions.forEach(suggestion => {
              console.log(`    - "${suggestion.title}" - ID: ${suggestion.id}`)
            })
          }
        })
        
        // Look for creature types specifically
        console.log('\n🏷️ Looking for creature type databases:')
        const creatureTypeKeywords = ['type', 'creature type', 'monster type', 'category']
        const potentialCreatureTypeDbs = jsonResponse.allDatabases.filter(db => 
          creatureTypeKeywords.some(keyword => 
            db.title.toLowerCase().includes(keyword.toLowerCase())
          )
        )
        
        if (potentialCreatureTypeDbs.length > 0) {
          potentialCreatureTypeDbs.forEach(db => {
            console.log(`  📝 "${db.title}" - ID: ${db.id}`)
          })
        } else {
          console.log('  ⚠️ No obvious creature type databases found')
        }
        
      } catch (e) {
        console.log('⚠️ Response is not JSON:', responseText.substring(0, 500))
      }
    } else {
      console.log('❌ Error response:', responseText)
    }
    
  } catch (error) {
    console.error('❌ Discovery failed:', error)
  }
}

// Also get schema for a specific database
async function getSchema(databaseId, title = '') {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjg3MzksImV4cCI6MjA3MjYwNDczOX0.c6qWZxBKdB9r9_wMidj4_BX8cQrbl54gknrRLGZpEyk'
  
  console.log(`\n🔍 Getting schema for ${title ? `"${title}"` : 'database'}: ${databaseId}`)
  
  try {
    const response = await fetch(`${baseUrl}/get-notion-schema`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ databaseId })
    })
    
    if (response.status === 200) {
      const jsonResponse = JSON.parse(await response.text())
      console.log(`📋 Schema for "${jsonResponse.title}":`)
      jsonResponse.properties.forEach(prop => {
        console.log(`  - ${prop.name}: ${prop.type}`)
      })
      return jsonResponse
    } else {
      const errorText = await response.text()
      console.log(`❌ Error getting schema: ${errorText}`)
      return null
    }
  } catch (error) {
    console.error(`❌ Schema request failed:`, error)
    return null
  }
}

// Run discovery
discoverDatabases().then(() => {
  console.log('\n='.repeat(50))
  console.log('💡 Next steps:')
  console.log('1. Identify your creature types database from the list above')
  console.log('2. Set the environment variable: supabase secrets set CREATURE_TYPES_DATABASE_ID=your_database_id')
  console.log('3. Deploy the fix-creature-types function: supabase functions deploy fix-creature-types')
  console.log('4. Run the fix script with: node debug-fix-creature-types.js')
})
