#!/usr/bin/env node

// Complete setup and test script for the creature type fix
const { execSync } = require('child_process');

console.log('🚀 Setting up Creature Type Fix Script...\n');

async function runCommand(command, description) {
  console.log(`📋 ${description}...`);
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    console.log(`✅ ${description} completed`);
    if (output.trim()) {
      console.log(output.trim());
    }
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    return false;
  }
}

async function main() {
  console.log('Step 1: Discovering databases...');
  console.log('Please run: node discover-databases.js');
  console.log('This will help you identify your CREATURE_TYPES_DATABASE_ID\n');
  
  console.log('Step 2: After discovery, set your environment variable:');
  console.log('supabase secrets set CREATURE_TYPES_DATABASE_ID=your_database_id\n');
  
  console.log('Step 3: Deploy the function:');
  console.log('supabase functions deploy fix-creature-types\n');
  
  console.log('Step 4: Test the function:');
  console.log('node debug-fix-creature-types.js\n');
  
  console.log('📚 For detailed instructions, see README-creature-fix.md\n');
  
  // Check if user wants to run discovery now
  console.log('Would you like to run database discovery now? (y/n)');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', (key) => {
    if (key.toString() === 'y' || key.toString() === 'Y') {
      console.log('\n🔍 Running database discovery...\n');
      execSync('node discover-databases.js', { stdio: 'inherit' });
    } else {
      console.log('\n👍 You can run discovery later with: node discover-databases.js');
    }
    process.exit(0);
  });
}

main().catch(console.error);
