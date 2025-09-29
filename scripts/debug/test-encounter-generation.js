#!/usr/bin/env node

// Test script to debug encounter generation specifically
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🧪 Testing encounter generation with authentication...');
console.log('🔑 Supabase URL:', supabaseUrl ? 'Set' : 'Missing');
console.log('🔑 Supabase Key:', supabaseKey ? 'Set' : 'Missing');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEncounterGeneration() {
  console.log('\n🔍 Testing XP/CR issue with Marid monsters...');
  
  // First, fetch creatures to see what data we get
  console.log('\n1️⃣ Fetching creatures data...');
  try {
    const { data: creatures, error: fetchError } = await supabase.functions.invoke('fetch-creatures', {
      body: {
        environment: 'Any',
        minCR: '0',
        maxCR: '20',
        alignment: 'Any',
        creatureType: 'Any',
        size: 'Any'
      }
    });

    if (fetchError) {
      console.error('❌ Error fetching creatures:', fetchError);
      return;
    }

    console.log(`✅ Fetched ${creatures.length} creatures`);
    
    // Look for Marid specifically
    const marids = creatures.filter(c => 
      c.name && c.name.toLowerCase().includes('marid')
    );
    
    console.log(`\n� Found ${marids.length} Marid monsters:`);
    marids.forEach(marid => {
      console.log(`   - ${marid.name}: CR ${marid.challenge_rating}, XP ${marid.xp_value}`);
    });
    
    // Check all CR 11 creatures
    const cr11Creatures = creatures.filter(c => 
      Math.abs(parseFloat(c.challenge_rating) - 11) < 0.01
    );
    
    console.log(`\n📊 All CR 11 creatures (${cr11Creatures.length}):`);
    cr11Creatures.forEach(creature => {
      console.log(`   - ${creature.name}: CR ${creature.challenge_rating}, XP ${creature.xp_value}`);
    });
    
    // Check creatures with 200 XP (the incorrect value reported)
    const lowXPCreatures = creatures.filter(c => 
      c.xp_value === 200
    );
    
    console.log(`\n📊 Creatures with 200 XP (${lowXPCreatures.length}):`);
    lowXPCreatures.forEach(creature => {
      console.log(`   - ${creature.name}: CR ${creature.challenge_rating}, XP ${creature.xp_value}`);
    });

  } catch (error) {
    console.error('💥 Caught exception fetching creatures:', error);
  }
  
  // Now test encounter generation with parameters similar to the user's case
  console.log('\n2️⃣ Testing encounter generation with 1000 XP threshold...');
  
  try {
    const { data, error } = await supabase.functions.invoke('generate-encounter', {
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

    console.log('📊 Encounter generation response:');
    if (error) {
      console.log('❌ Response error:', error);
    }
    
    if (data?.error) {
      console.log('❌ Data error:', data.error);
    }
    
    if (data && !data.error) {
      console.log(`✅ Generated encounter with ${data.total_xp} total XP`);
      console.log('📋 Creatures:');
      data.creatures.forEach(creature => {
        console.log(`   - ${creature.quantity}x ${creature.name}: CR ${creature.challenge_rating}, ${creature.xp_value} XP each (${creature.total_xp} total)`);
      });
    }

  } catch (error) {
    console.error('💥 Caught exception during encounter generation:', error);
  }
}

testEncounterGeneration().catch(console.error);
