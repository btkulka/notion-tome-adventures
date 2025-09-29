/**
 * Debug script to test creature type extraction and filtering
 */

console.log('🧪 Testing Creature Type Extraction & Filtering\n');

// Simulate the enhanced creature type extraction logic
function extractCreatureType(properties) {
  let creatureType = '';
  
  // Check all possible property names and types
  const possibleProps = [
    'Creature Type',
    'Monster Type', 
    'Type',
    'Category',
    'CreatureType'
  ];
  
  console.log('Available properties:', Object.keys(properties));
  
  for (const propName of possibleProps) {
    console.log(`Checking property: "${propName}"`);
    
    // Check relation type first
    if (properties[propName]?.relation?.[0]?.id) {
      console.log(`  Found relation for ${propName}:`, properties[propName].relation[0].id);
      creatureType = `RelationResolved_${propName}`;
      break;
    }
    
    // Check select type
    if (properties[propName]?.select?.name) {
      console.log(`  Found select for ${propName}:`, properties[propName].select.name);
      creatureType = properties[propName].select.name;
      break;
    }
    
    console.log(`  No data found for ${propName}`);
  }
  
  return creatureType;
}

// Test with sample Notion property structures
const testCases = [
  {
    name: "Monster with Creature Type Select",
    properties: {
      'Name': { title: [{ plain_text: 'Goblin' }] },
      'Creature Type': { 
        select: { 
          name: 'Humanoid',
          id: 'humanoid-123' 
        } 
      },
      'Size': { select: { name: 'Small' } },
      'Alignment': { select: { name: 'Neutral Evil' } }
    }
  },
  {
    name: "Monster with Type Select (alternative naming)",
    properties: {
      'Name': { title: [{ plain_text: 'Dragon' }] },
      'Type': { 
        select: { 
          name: 'Dragon',
          id: 'dragon-456' 
        } 
      },
      'Size': { select: { name: 'Large' } }
    }
  },
  {
    name: "Monster with Creature Type Relation",
    properties: {
      'Name': { title: [{ plain_text: 'Orc' }] },
      'Creature Type': { 
        relation: [{ 
          id: 'relation-humanoid-789' 
        }] 
      },
      'Size': { select: { name: 'Medium' } }
    }
  },
  {
    name: "Monster with Monster Type property",
    properties: {
      'Name': { title: [{ plain_text: 'Beast' }] },
      'Monster Type': { 
        select: { 
          name: 'Beast',
          id: 'beast-101' 
        } 
      }
    }
  },
  {
    name: "Monster with no creature type data",
    properties: {
      'Name': { title: [{ plain_text: 'Unknown Creature' }] },
      'Size': { select: { name: 'Medium' } },
      'Other Property': { text: { content: 'some data' } }
    }
  }
];

console.log('🔍 Testing Creature Type Extraction:\n');

testCases.forEach((testCase, index) => {
  console.log(`--- Test ${index + 1}: ${testCase.name} ---`);
  const extractedType = extractCreatureType(testCase.properties);
  console.log(`Extracted creature type: "${extractedType}"`);
  console.log(`Expected result: ${extractedType || 'No type found'}\n`);
});

console.log('🎯 Summary:');
console.log('  - The function should handle both select and relation properties');
console.log('  - It should check multiple possible property names');
console.log('  - Relations need to be resolved by looking up the relation ID');
console.log('  - Select properties can be used directly');

console.log('\n💡 Next Steps:');
console.log('  1. Deploy the updated edge function');
console.log('  2. Generate an encounter and check the logs');
console.log('  3. Look for the creature type debug output');
console.log('  4. Verify the property names match your Notion database structure');
