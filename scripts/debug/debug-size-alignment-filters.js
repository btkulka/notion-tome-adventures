/**
 * Debug script to test size and alignment filtering logic
 * Run this to see what values are being compared in the filtering process
 */

// Simulate the filtering logic from the encounter generator
function testFiltering() {
  console.log('🧪 Testing Size and Alignment Filtering Logic\n');

  // Sample creature data that might come from Notion
  const sampleCreatures = [
    {
      name: 'Goblin',
      creature_type: 'humanoid',
      size: 'Small',
      alignment: 'Neutral Evil',
      challenge_rating: 0.25
    },
    {
      name: 'Dragon',
      creature_type: 'Dragon',
      size: 'Large',
      alignment: 'Chaotic Evil',
      challenge_rating: 12
    },
    {
      name: 'Orc',
      creature_type: 'Humanoid', // Note the capitalization difference
      size: 'Medium',
      alignment: 'Chaotic Evil',
      challenge_rating: 0.5
    },
    {
      name: 'Giant',
      creature_type: 'giant',
      size: 'HUGE', // Note the case difference
      alignment: 'chaotic neutral', // Note the case difference
      challenge_rating: 8
    }
  ];

  // Test parameters from frontend
  const testParams = [
    { creatureType: 'Humanoid', size: 'Small', alignment: 'Neutral Evil' },
    { creatureType: 'Dragon', size: 'Large', alignment: 'Chaotic Evil' },
    { creatureType: 'Giant', size: 'Huge', alignment: 'Chaotic Neutral' }
  ];

  console.log('📋 Sample Creatures:');
  sampleCreatures.forEach((creature, index) => {
    console.log(`  ${index + 1}. ${creature.name} - Type: "${creature.creature_type}", Size: "${creature.size}", Alignment: "${creature.alignment}"`);
  });

  console.log('\n🔍 Testing Filter Parameters:');
  
  testParams.forEach((params, paramIndex) => {
    console.log(`\n--- Test ${paramIndex + 1}: Type="${params.creatureType}", Size="${params.size}", Alignment="${params.alignment}" ---`);
    
    const filteredCreatures = sampleCreatures.filter(creature => {
      // Test creature type filtering (case-insensitive)
      if (params.creatureType && params.creatureType !== 'Any') {
        const creatureType = (creature.creature_type || '').toString().trim();
        const paramType = params.creatureType.toString().trim();
        if (!creatureType || creatureType.toLowerCase() !== paramType.toLowerCase()) {
          console.log(`  ❌ ${creature.name} filtered out by creature type: "${creatureType}" !== "${paramType}"`);
          return false;
        }
      }
      
      // Test size filtering (case-insensitive)
      if (params.size && params.size !== 'Any') {
        const creatureSize = (creature.size || '').toString().trim();
        const paramSize = params.size.toString().trim();
        if (!creatureSize || creatureSize.toLowerCase() !== paramSize.toLowerCase()) {
          console.log(`  ❌ ${creature.name} filtered out by size: "${creatureSize}" !== "${paramSize}"`);
          return false;
        }
      }
      
      // Test alignment filtering (case-insensitive)
      if (params.alignment && params.alignment !== 'Any') {
        const creatureAlignment = (creature.alignment || '').toString().trim();
        const paramAlignment = params.alignment.toString().trim();
        if (!creatureAlignment || creatureAlignment.toLowerCase() !== paramAlignment.toLowerCase()) {
          console.log(`  ❌ ${creature.name} filtered out by alignment: "${creatureAlignment}" !== "${paramAlignment}"`);
          return false;
        }
      }
      
      console.log(`  ✅ ${creature.name} passed all filters`);
      return true;
    });

    console.log(`  📊 Result: ${filteredCreatures.length} creatures passed filters`);
    if (filteredCreatures.length > 0) {
      console.log(`  📋 Passed: ${filteredCreatures.map(c => c.name).join(', ')}`);
    }
  });

  console.log('\n🎯 Summary:');
  console.log('  - Case-insensitive comparison should handle Humanoid vs humanoid');
  console.log('  - String trimming should handle extra whitespace');
  console.log('  - This logic should work with proper Notion data extraction');
  
  console.log('\n💡 Next Steps:');
  console.log('  1. Deploy updated edge function with case-insensitive filtering');
  console.log('  2. Test encounter generation with specific size/alignment filters');
  console.log('  3. Check edge function logs for actual Notion data values');
}

// Run the test
testFiltering();
