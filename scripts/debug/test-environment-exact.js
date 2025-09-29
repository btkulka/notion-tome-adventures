#!/usr/bin/env node

// Test script to debug environment parameter handling
console.log('🧪 Testing environment parameter handling...');

// Simulate the frontend logic
function testEnvironmentParameter(environment) {
  const notionParams = {
    environment: environment === 'Any' ? 'Any' : environment,
  };
  
  console.log(`Input: "${environment}" -> Output: "${notionParams.environment}"`);
  console.log(`Type: ${typeof environment}, Length: ${environment?.length}`);
  console.log(`Strict equality check (=== 'Any'): ${environment === 'Any'}`);
  console.log(`Case insensitive check (.toLowerCase() === 'any'): ${environment?.toLowerCase() === 'any'}`);
  console.log('---');
  
  return notionParams;
}

// Test different scenarios
console.log('Testing various environment values:');
testEnvironmentParameter('Any');
testEnvironmentParameter('ANY');
testEnvironmentParameter('any');
testEnvironmentParameter('Forest');
testEnvironmentParameter('');
testEnvironmentParameter(undefined);
testEnvironmentParameter(null);
testEnvironmentParameter('  Any  '); // with whitespace

console.log('\n🔍 Testing filtering logic simulation...');

// Simulate the backend filtering logic
function testFilteringLogic(paramEnvironment, creatureEnvironments) {
  console.log(`\nFilter parameter: "${paramEnvironment}"`);
  console.log(`Creature environments: ${JSON.stringify(creatureEnvironments)}`);
  
  if (paramEnvironment && paramEnvironment.trim() !== '' && paramEnvironment.trim() !== 'Any') {
    const targetEnvironment = paramEnvironment.trim();
    
    const matches = creatureEnvironments.some(env => {
      const creatureEnv = (env || '').toString().trim();
      const paramEnv = targetEnvironment.toString().trim();
      const isMatch = creatureEnv.toLowerCase() === paramEnv.toLowerCase();
      console.log(`  "${creatureEnv}" === "${paramEnv}" ? ${isMatch}`);
      return isMatch;
    });
    
    console.log(`  Final match result: ${matches}`);
    return matches;
  } else {
    console.log(`  Environment filter disabled (value: "${paramEnvironment}")`);
    return true; // No filtering
  }
}

// Test the filtering logic
testFilteringLogic('Any', ['Forest', 'Desert']);
testFilteringLogic('Forest', ['Forest', 'Desert']);
testFilteringLogic('forest', ['Forest', 'Desert']); // case mismatch
testFilteringLogic('Mountains', ['Forest', 'Desert']);
testFilteringLogic('', ['Forest', 'Desert']);
testFilteringLogic(undefined, ['Forest', 'Desert']);
