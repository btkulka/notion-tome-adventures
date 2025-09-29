#!/usr/bin/env node

// Test script to fetch actual creatures and see their environment data
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://xhrobkdzjabllhftksvt.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🧪 Testing actual creature data from edge function...');

async function testActualData() {
  try {
    console.log('📡 Calling generate-encounter with "Any" environment...');
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-encounter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        environment: 'Any',
        xpThreshold: 1000,
        maxMonsters: 5,
        minCR: '0',
        maxCR: '20'
      })
    });
    
    console.log('📊 Response status:', response.status);
    
    const responseText = await response.text();
    console.log('📦 Raw response:', responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));
    
    try {
      const data = JSON.parse(responseText);
      console.log('✅ Parsed response:', JSON.stringify(data, null, 2));
      
      if (data.error) {
        console.log('❌ Error in response:', data.error);
      }
      
      if (data.creatures) {
        console.log(`🎲 Generated encounter with ${data.creatures.length} creature types`);
        data.creatures.forEach((creature, index) => {
          console.log(`  ${index + 1}. ${creature.name} x${creature.quantity} (${creature.xp_value} XP each)`);
        });
      }
      
    } catch (parseError) {
      console.error('❌ Failed to parse response JSON:', parseError);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

async function testSpecificEnvironment() {
  try {
    console.log('\n📡 Calling generate-encounter with "Forest" environment...');
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-encounter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        environment: 'Forest',
        xpThreshold: 1000,
        maxMonsters: 5,
        minCR: '0',
        maxCR: '20'
      })
    });
    
    console.log('📊 Response status:', response.status);
    
    const responseText = await response.text();
    console.log('📦 Raw response:', responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));
    
    try {
      const data = JSON.parse(responseText);
      console.log('✅ Parsed response:', JSON.stringify(data, null, 2));
      
    } catch (parseError) {
      console.error('❌ Failed to parse response JSON:', parseError);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

async function main() {
  if (!SUPABASE_ANON_KEY) {
    console.error('❌ VITE_SUPABASE_ANON_KEY environment variable not set');
    return;
  }
  
  await testActualData();
  await testSpecificEnvironment();
}

main().catch(console.error);
