// Test the fixed CR extraction logic
const XP_BY_CR = {
  '0': 10,
  '0.125': 25,
  '0.25': 50,
  '0.5': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
};

// Test cases for various CR property formats
const testCases = [
  {
    name: "Marid (number property)",
    properties: {
      'Challenge Rating': { number: 11 }
    }
  },
  {
    name: "Orc (select property)",
    properties: {
      'Challenge Rating': { select: { name: '1/2' } }
    }
  },
  {
    name: "Goblin (CR property)",
    properties: {
      CR: { number: 0.25 }
    }
  },
  {
    name: "Missing CR properties",
    properties: {
      Name: { title: [{ plain_text: "Unknown Monster" }] }
    }
  }
];

function testCRExtraction(name, properties) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log('Properties:', JSON.stringify(properties, null, 2));
  
  let challengeRating = 0;
  let crSource = 'none';
  
  // Apply the fixed extraction logic
  if (properties['Challenge Rating']?.number !== undefined) {
    challengeRating = properties['Challenge Rating'].number;
    crSource = `Challenge Rating number -> ${challengeRating}`;
  } else if (properties.CR?.number !== undefined) {
    challengeRating = properties.CR.number;
    crSource = `CR number -> ${challengeRating}`;
  } else if (properties.ChallengeRating?.number !== undefined) {
    challengeRating = properties.ChallengeRating.number;
    crSource = `ChallengeRating number -> ${challengeRating}`;
  } 
  // Try select property (text format that may need parsing)
  else if (properties['Challenge Rating']?.select?.name) {
    const crText = properties['Challenge Rating'].select.name;
    if (crText === '1/8') challengeRating = 0.125;
    else if (crText === '1/4') challengeRating = 0.25;
    else if (crText === '1/2') challengeRating = 0.5;
    else challengeRating = parseFloat(crText) || 0;
    crSource = `Challenge Rating select -> ${crText} -> ${challengeRating}`;
  } else if (properties.CR?.select?.name) {
    const crText = properties.CR.select.name;
    if (crText === '1/8') challengeRating = 0.125;
    else if (crText === '1/4') challengeRating = 0.25;
    else if (crText === '1/2') challengeRating = 0.5;
    else challengeRating = parseFloat(crText) || 0;
    crSource = `CR select -> ${crText} -> ${challengeRating}`;
  } else if (properties.Challenge?.select?.name) {
    const crText = properties.Challenge.select.name;
    if (crText === '1/8') challengeRating = 0.125;
    else if (crText === '1/4') challengeRating = 0.25;
    else if (crText === '1/2') challengeRating = 0.5;
    else challengeRating = parseFloat(crText) || 0;
    crSource = `Challenge select -> ${crText} -> ${challengeRating}`;
  } else {
    challengeRating = 0; // Use 0 instead of 1 as fallback
    crSource = 'no CR property found -> 0';
  }
  
  const xpValue = challengeRating > 0 ? (XP_BY_CR[challengeRating.toString()] || 0) : 0;
  
  console.log(`📊 Result: CR ${challengeRating}, XP ${xpValue}`);
  console.log(`🔍 Source: ${crSource}`);
  
  if (challengeRating <= 0 || xpValue <= 0) {
    console.log(`⚠️ Would skip this monster in encounter generation`);
  } else {
    console.log(`✅ Valid for encounter generation`);
  }
  
  return { challengeRating, xpValue, crSource };
}

console.log('🔧 Testing improved CR extraction logic...\n');

testCases.forEach(testCase => {
  testCRExtraction(testCase.name, testCase.properties);
});

console.log('\n🎯 Summary:');
console.log('- Marid with CR 11 should now correctly get 7200 XP instead of 200 XP');
console.log('- Monsters with missing CR data will be skipped instead of defaulting to CR 1');
console.log('- Various property name formats are now supported');