// Shared configuration for all debug and test scripts
export const DEBUG_CONFIG = {
  // Supabase configuration
  baseUrl: 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1MTE5NDMsImV4cCI6MjA1MTA4Nzk0M30.iNFzw-0wBMqGkmD9Y3zGwGh-LnqGczwpJ7TKOlPPnGQ',
  
  // Common headers for all requests
  headers: {
    'Content-Type': 'application/json',
  },

  // Test data presets
  testData: {
    encounter: {
      environment: 'Any',
      xpThreshold: 100,
      maxMonsters: 3,
      minCR: 0,
      maxCR: 2,
      alignment: 'Any',
      creatureType: 'Any',
      size: 'Any'
    },
    creatures: {
      environment: 'Any'
    }
  },

  // Available edge functions
  functions: [
    'discover-notion-databases',
    'get-notion-schema', 
    'fetch-environments',
    'fetch-creatures',
    'generate-encounter',
    'simple-creatures-test',
    'debug-schemas',
    'fix-alignments',
    'fix-creature-types'
  ],

  // Logging configuration
  logging: {
    verbose: true,
    showTimestamps: true,
    colorOutput: true
  }
}

// Utility function to make authenticated requests
export async function callEdgeFunction(functionName, body = {}, options = {}) {
  const {
    method = 'POST',
    timeout = 30000,
    retries = 0
  } = options;

  const url = `${DEBUG_CONFIG.baseUrl}/${functionName}`;
  const headers = {
    ...DEBUG_CONFIG.headers,
    'Authorization': `Bearer ${DEBUG_CONFIG.anonKey}`
  };

  console.log(`🚀 Testing ${functionName}...`);
  
  if (DEBUG_CONFIG.logging.showTimestamps) {
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method,
      headers,
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ ${functionName} succeeded`);
      if (DEBUG_CONFIG.logging.verbose) {
        console.log('📋 Response:', JSON.stringify(data, null, 2));
      }
      return { success: true, data };
    } else {
      console.error(`❌ ${functionName} failed with status ${response.status}`);
      console.error('📋 Error:', JSON.stringify(data, null, 2));
      return { success: false, error: data, status: response.status };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`⏰ ${functionName} timed out after ${timeout}ms`);
      return { success: false, error: 'Request timed out', timeout: true };
    }
    
    console.error(`💥 ${functionName} threw an exception:`, error.message);
    return { success: false, error: error.message, exception: true };
  }
}

// Utility to test multiple functions in sequence
export async function testMultipleFunctions(functionConfigs) {
  const results = [];
  
  for (const config of functionConfigs) {
    const result = await callEdgeFunction(
      config.name, 
      config.body || DEBUG_CONFIG.testData[config.name] || {}, 
      config.options || {}
    );
    
    results.push({
      functionName: config.name,
      ...result
    });
    
    // Add delay between requests to avoid rate limiting
    if (config.delay) {
      await new Promise(resolve => setTimeout(resolve, config.delay));
    }
  }
  
  return results;
}

// Utility to run all available functions for comprehensive testing
export async function testAllFunctions() {
  const functionConfigs = DEBUG_CONFIG.functions.map(name => ({
    name,
    body: DEBUG_CONFIG.testData[name] || {},
    delay: 1000 // 1 second delay between requests
  }));
  
  return testMultipleFunctions(functionConfigs);
}
