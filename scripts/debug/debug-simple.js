// Debug script to investigate XP/CR association issue with Marid monsters
async function debugXPIssue() {
  const baseUrl = 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1MTE5NDMsImV4cCI6MjA1MTA4Nzk0M30.iNFzw-0wBMqGkmD9Y3zGwGh-LnqGczwpJ7TKOlPPnGQ'
  
  console.log('🔍 Debugging XP/CR issue with Marid monsters...\n')
  
  console.log('1. Testing fetch-creatures function...')
  try {
    const response = await fetch(`${baseUrl}/fetch-creatures`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        environment: 'Any',
        minCR: '0',
        maxCR: '20',
        alignment: 'Any',
        creatureType: 'Any',
        size: 'Any'
      })
    })
    
    console.log('📊 Fetch creatures status:', response.status)
    
    if (response.status === 200) {
      const creatures = await response.json()
      console.log(`✅ Fetched ${creatures.length} creatures`)
      
      // Look for Marid monsters
      const marids = creatures.filter(c => 
        c.name && c.name.toLowerCase().includes('marid')
      )
      
      console.log(`\n📊 Found ${marids.length} Marid monsters:`)
      marids.forEach(marid => {
        console.log(`   - ${marid.name}: CR ${marid.challenge_rating}, XP ${marid.xp_value}`)
      })
      
      // Check all CR 11 creatures
      const cr11Creatures = creatures.filter(c => 
        Math.abs(parseFloat(c.challenge_rating) - 11) < 0.01
      )
      
      console.log(`\n� All CR 11 creatures (${cr11Creatures.length}):`)
      cr11Creatures.forEach(creature => {
        console.log(`   - ${creature.name}: CR ${creature.challenge_rating}, XP ${creature.xp_value}`)
      })
      
      // Check creatures with 200 XP
      const lowXPCreatures = creatures.filter(c => 
        c.xp_value === 200
      )
      
      console.log(`\n📊 Creatures with 200 XP (${lowXPCreatures.length}):`)
      lowXPCreatures.forEach(creature => {
        console.log(`   - ${creature.name}: CR ${creature.challenge_rating}, XP ${creature.xp_value}`)
      })
      
    } else {
      const errorText = await response.text()
      console.log('❌ Fetch creatures failed:', errorText)
    }
    
  } catch (error) {
    console.error('❌ Fetch creatures test failed:', error)
  }
  
  console.log('\n2. Testing encounter generation with very broad criteria to see what creatures are available...')
  try {
    const response = await fetch(`${baseUrl}/generate-encounter`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        environment: 'Any',
        xpThreshold: 15000, // Very high threshold
        maxMonsters: 10,
        minCR: '0',  // Include all CRs
        maxCR: '20',
        alignment: 'Any',
        creatureType: 'Any',
        size: 'Any'
      })
    })
    
    console.log('📊 Generate encounter status:', response.status)
    
    if (response.status === 200) {
      const encounter = await response.json()
      console.log(`✅ Generated encounter with ${encounter.total_xp} total XP`)
      console.log('📋 Creatures (sorted by CR):')
      
      // Sort creatures by CR to see the distribution
      const sortedCreatures = encounter.creatures.sort((a, b) => b.challenge_rating - a.challenge_rating)
      
      sortedCreatures.forEach(creature => {
        console.log(`   - ${creature.quantity}x ${creature.name}: CR ${creature.challenge_rating}, ${creature.xp_value} XP each (${creature.total_xp} total)`)
        
        // Check for high CR creatures
        if (creature.challenge_rating >= 5) {
          console.log(`     ✅ High CR creature found: ${creature.name}`)
        }
        
        // Specifically check for Marids
        if (creature.name.toLowerCase().includes('marid')) {
          if (creature.challenge_rating === 11 && creature.xp_value === 7200) {
            console.log(`     🎉 FIXED: Marid has correct CR 11 and 7200 XP!`)
          } else {
            console.log(`     ❌ Marid incorrect: CR ${creature.challenge_rating}, XP ${creature.xp_value} (should be CR 11, 7200 XP)`)
          }
        }
      })
      
      // Summary of CR distribution
      const crCounts = encounter.creatures.reduce((acc, creature) => {
        const cr = creature.challenge_rating.toString()
        acc[cr] = (acc[cr] || 0) + creature.quantity
        return acc
      }, {})
      
      console.log('\n📊 CR Distribution:')
      Object.entries(crCounts).sort(([a], [b]) => parseFloat(b) - parseFloat(a)).forEach(([cr, count]) => {
        console.log(`   CR ${cr}: ${count} creatures`)
      })
      
    } else {
      const errorText = await response.text()
      console.log('❌ Generate encounter failed:', errorText)
    }
    
  } catch (error) {
    console.error('❌ Generate encounter test failed:', error)
  }
}

debugXPIssue()
