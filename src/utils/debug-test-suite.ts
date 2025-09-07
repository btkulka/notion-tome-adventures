/**
 * Unified Debug Test Suite System
 * Eliminates code duplication across 12+ debug scripts
 */

export interface TestConfig {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST';
  body?: any;
  expectedStatus?: number;
  description?: string;
  timeout?: number;
  retries?: number;
  delay?: number;
  headers?: Record<string, string>;
}

export interface TestResult {
  name: string;
  success: boolean;
  status: number;
  responseText: string;
  responseJson?: any;
  duration: number;
  error?: string;
  timestamp: string;
}

export interface TestSuiteConfig {
  baseUrl: string;
  authToken: string;
  defaultTimeout: number;
  retryAttempts: number;
  delayBetweenTests: number;
  logging: {
    verbose: boolean;
    showTimestamps: boolean;
    colorOutput: boolean;
  };
}

export class DebugTestSuite {
  private config: TestSuiteConfig;
  private results: TestResult[] = [];

  constructor(config: TestSuiteConfig) {
    this.config = config;
  }

  private log(message: string, level: 'info' | 'success' | 'error' | 'warn' = 'info') {
    if (!this.config.logging.verbose) return;

    const timestamp = this.config.logging.showTimestamps 
      ? `[${new Date().toISOString()}] ` 
      : '';
    
    if (this.config.logging.colorOutput) {
      const colors = {
        info: '\x1b[36m',     // Cyan
        success: '\x1b[32m',  // Green
        error: '\x1b[31m',    // Red
        warn: '\x1b[33m',     // Yellow
        reset: '\x1b[0m'
      };
      
      const icon = {
        info: '🔍',
        success: '✅',
        error: '❌',
        warn: '⚠️'
      };
      
      console.log(`${colors[level]}${icon[level]} ${timestamp}${message}${colors.reset}`);
    } else {
      console.log(`${timestamp}${message}`);
    }
  }

  private async makeRequest(test: TestConfig): Promise<TestResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      this.log(`Testing ${test.name}...`, 'info');

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.authToken}`,
        ...test.headers
      };

      const response = await fetch(`${this.config.baseUrl}/${test.endpoint}`, {
        method: test.method,
        headers,
        body: test.body ? JSON.stringify(test.body) : undefined,
        signal: AbortSignal.timeout(test.timeout || this.config.defaultTimeout)
      });

      const responseText = await response.text();
      const duration = Date.now() - startTime;

      let responseJson;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        // Response is not JSON, that's ok
      }

      const success = test.expectedStatus 
        ? response.status === test.expectedStatus 
        : response.status >= 200 && response.status < 300;

      const result: TestResult = {
        name: test.name,
        success,
        status: response.status,
        responseText,
        responseJson,
        duration,
        timestamp
      };

      if (success) {
        this.log(`${test.name} completed successfully (${duration}ms)`, 'success');
        if (responseJson) {
          this.log(`Response: ${JSON.stringify(responseJson, null, 2)}`, 'info');
        }
      } else {
        this.log(`${test.name} failed with status ${response.status}`, 'error');
        this.log(`Response: ${responseText}`, 'error');
        result.error = `HTTP ${response.status}: ${responseText}`;
      }

      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.log(`${test.name} threw an error: ${error.message}`, 'error');

      return {
        name: test.name,
        success: false,
        status: 0,
        responseText: '',
        duration,
        error: error.message,
        timestamp
      };
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runTest(test: TestConfig): Promise<TestResult> {
    let result = await this.makeRequest(test);
    
    // Retry logic
    if (!result.success && test.retries && test.retries > 0) {
      for (let attempt = 1; attempt <= test.retries; attempt++) {
        this.log(`Retry attempt ${attempt}/${test.retries} for ${test.name}`, 'warn');
        await this.delay(1000 * attempt); // Exponential backoff
        result = await this.makeRequest(test);
        if (result.success) break;
      }
    }

    this.results.push(result);
    return result;
  }

  async runTests(tests: TestConfig[]): Promise<TestResult[]> {
    this.log(`Starting test suite with ${tests.length} tests`, 'info');
    this.results = [];

    for (const test of tests) {
      await this.runTest(test);
      
      // Delay between tests
      if (test.delay || this.config.delayBetweenTests > 0) {
        const delayMs = test.delay || this.config.delayBetweenTests;
        await this.delay(delayMs);
      }
    }

    this.printSummary();
    return this.results;
  }

  private printSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = total - passed;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    this.log('\n' + '='.repeat(50), 'info');
    this.log('TEST SUITE SUMMARY', 'info');
    this.log('='.repeat(50), 'info');
    this.log(`Total Tests: ${total}`, 'info');
    this.log(`Passed: ${passed}`, passed === total ? 'success' : 'info');
    this.log(`Failed: ${failed}`, failed > 0 ? 'error' : 'info');
    this.log(`Total Duration: ${totalDuration}ms`, 'info');
    this.log(`Average Duration: ${Math.round(totalDuration / total)}ms`, 'info');

    if (failed > 0) {
      this.log('\nFAILED TESTS:', 'error');
      this.results.filter(r => !r.success).forEach(result => {
        this.log(`- ${result.name}: ${result.error || `Status ${result.status}`}`, 'error');
      });
    }

    this.log('='.repeat(50), 'info');
  }

  getResults(): TestResult[] {
    return [...this.results];
  }

  getSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    
    return {
      total,
      passed,
      failed: total - passed,
      successRate: total > 0 ? (passed / total) * 100 : 0,
      totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0),
      results: this.results
    };
  }
}

// Predefined test configurations
export const STANDARD_TEST_CONFIGS: Record<string, TestConfig> = {
  discoverDatabases: {
    name: 'Discover Notion Databases',
    endpoint: 'discover-notion-databases',
    method: 'POST',
    body: {},
    description: 'Test database discovery functionality'
  },

  fetchCreatures: {
    name: 'Fetch Creatures',
    endpoint: 'fetch-creatures',
    method: 'POST',
    body: {
      environment: 'Any',
      creatureType: 'Any',
      alignment: 'Any',
      size: 'Any',
      minCR: 0,
      maxCR: 20
    },
    description: 'Test creature data fetching'
  },

  fetchEnvironments: {
    name: 'Fetch Environments',
    endpoint: 'fetch-environments',
    method: 'POST',
    body: {},
    description: 'Test environment data fetching'
  },

  generateEncounter: {
    name: 'Generate Encounter',
    endpoint: 'generate-encounter',
    method: 'POST',
    body: {
      environment: 'Any',
      xpThreshold: 100,
      maxMonsters: 3,
      minCR: 0,
      maxCR: 2,
      alignment: 'Any',
      creatureType: 'Any',
      size: 'Any'
    },
    description: 'Test encounter generation'
  },

  simpleCreaturesTest: {
    name: 'Simple Creatures Test',
    endpoint: 'simple-creatures-test',
    method: 'POST',
    body: {},
    description: 'Test basic creature structure'
  },

  fixCreatureTypes: {
    name: 'Fix Creature Types',
    endpoint: 'fix-creature-types',
    method: 'POST',
    body: {},
    description: 'Test creature type field fixing'
  },

  fixAlignments: {
    name: 'Fix Alignments',
    endpoint: 'fix-alignments',
    method: 'POST',
    body: {},
    description: 'Test alignment field fixing'
  },

  debugSchemas: {
    name: 'Debug Schemas',
    endpoint: 'debug-schemas',
    method: 'POST',
    body: {},
    description: 'Test schema debugging functionality'
  }
};

// Factory function to create test suite
export function createDebugTestSuite(baseUrl: string, authToken: string): DebugTestSuite {
  return new DebugTestSuite({
    baseUrl,
    authToken,
    defaultTimeout: 30000,
    retryAttempts: 2,
    delayBetweenTests: 1000,
    logging: {
      verbose: true,
      showTimestamps: true,
      colorOutput: true
    }
  });
}

// Utility to run all standard tests
export async function runAllStandardTests(baseUrl: string, authToken: string): Promise<TestResult[]> {
  const suite = createDebugTestSuite(baseUrl, authToken);
  const tests = Object.values(STANDARD_TEST_CONFIGS);
  return suite.runTests(tests);
}
