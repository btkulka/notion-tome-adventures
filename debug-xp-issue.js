/**
 * Debug script to investigate XP/CR association issue with Marid monsters
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xhrobkdzjabllhftksvt.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1MTE5NDMsImV4cCI6MjA1MTA4Nzk0M30.iNFzw-0wBMqGkmD9Y3zGwGh-LnqGczwpJ7TKOlPPnGQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugXPIssue() {
  console.log('🔍 Debugging XP/CR issue with Marid monsters...\n');
  
  try {
    // Step 1: First fetch creatures to see what we get back
    console.log('1. Fetching creatures from fetch-creatures endpoint...');
    const fetchResponse = await supabase.functions.invoke('fetch-creatures', {
      body: { 
        environment: 'Any',
        minCR: '0',
        maxCR: '20'
      }
    });
    
    if (fetchResponse.error) {
      console.error('❌ Error fetching creatures:', fetchResponse.error);
      return;
    }
    
    const creatures = fetchResponse.data;
    console.log(`✅ Fetched ${creatures.length} creatures`);
    
    // Step 2: Look for Marid monsters specifically
    const marids = creatures.filter(c => 
      c.name && c.name.toLowerCase().includes('marid')
    );
    
    console.log(`\n2. Found ${marids.length} Marid monsters:`);
    marids.forEach(marid => {
      console.log(`   - ${marid.name}: CR ${marid.challenge_rating}, XP ${marid.xp_value}`);
    });
    
    // Step 3: Check all creatures with CR 11
    const cr11Creatures = creatures.filter(c => 
      Math.abs(c.challenge_rating - 11) < 0.01
    );
    
    console.log(`\n3. All CR 11 creatures (${cr11Creatures.length}):`);
    cr11Creatures.forEach(creature => {
      console.log(`   - ${creature.name}: CR ${creature.challenge_rating}, XP ${creature.xp_value}`);
    });
    
    // Step 4: Check for any creatures with 200 XP (the incorrect value mentioned)
    const lowXPCreatures = creatures.filter(c => 
      c.xp_value === 200
    );
    
    console.log(`\n4. Creatures with 200 XP (${lowXPCreatures.length}):`);
    lowXPCreatures.forEach(creature => {
      console.log(`   - ${creature.name}: CR ${creature.challenge_rating}, XP ${creature.xp_value}`);
    });
    
    // Step 5: Now test encounter generation with a low XP threshold
    console.log('\n5. Testing encounter generation with 1000 XP threshold...');
    const encounterResponse = await supabase.functions.invoke('generate-encounter', {
      body: {
        environment: 'Any',
        xpThreshold: 1000,
        maxMonsters: 10,
        minCR: '10',
        maxCR: '12',
        alignment: 'Any',
        creatureType: 'Any',
        size: 'Any'
      }
    });
    
    if (encounterResponse.error) {
      console.error('❌ Error generating encounter:', encounterResponse.error);
      return;
    }
    
    const encounter = encounterResponse.data;
    console.log('✅ Generated encounter:', {
      totalXP: encounter.total_xp,
      creatureCount: encounter.creatures.length
    });
    
    console.log('\n6. Encounter creatures:');
    encounter.creatures.forEach(creature => {
      console.log(`   - ${creature.quantity}x ${creature.name}: CR ${creature.challenge_rating}, ${creature.xp_value} XP each (${creature.total_xp} total)`);
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugXPIssue();