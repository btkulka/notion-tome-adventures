/**
 * Universal Configuration Management System
 * Centralizes all configuration and constants scattered across the codebase
 */

export interface DatabaseConfig {
  id: string;
  name: string;
  description: string;
  environmentVariable: string;
  required: boolean;
}

export interface APIConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  enableConsole: boolean;
  enableTimestamps: boolean;
  enableColors: boolean;
  verbosePropertyExtraction: boolean;
  verboseNetworking: boolean;
}

export interface EncounterConfig {
  defaultXPThreshold: number;
  maxMonsters: number;
  defaultCRRange: [number, number];
  difficultyMultipliers: Record<string, number>;
  encounterMultipliers: Record<number, number>;
}

export interface ValidationConfig {
  enableResponseValidation: boolean;
  enableSchemaValidation: boolean;
  strictMode: boolean;
  validateRequiredFields: boolean;
}

export interface AppConfiguration {
  api: APIConfig;
  databases: DatabaseConfig[];
  logging: LoggingConfig;
  encounter: EncounterConfig;
  validation: ValidationConfig;
  environment: 'development' | 'production' | 'test';
}

// D&D 5e Challenge Rating to XP mapping
const XP_BY_CR_MAP: Record<number, number> = {
  0: 10,
  0.125: 25,  // 1/8
  0.25: 50,   // 1/4
  0.5: 100,   // 1/2
  1: 200,
  2: 450,
  3: 700,
  4: 1100,
  5: 1800,
  6: 2300,
  7: 2900,
  8: 3900,
  9: 5000,
  10: 5900,
  11: 7200,
  12: 8400,
  13: 10000,
  14: 11500,
  15: 13000,
  16: 15000,
  17: 18000,
  18: 20000,
  19: 22000,
  20: 25000,
  21: 33000,
  22: 41000,
  23: 50000,
  24: 62000,
  25: 75000,
  26: 90000,
  27: 105000,
  28: 120000,
  29: 135000,
  30: 155000
};

// D&D 5e Encounter multipliers based on number of monsters
const ENCOUNTER_MULTIPLIERS_MAP: Record<number, number> = {
  1: 1,
  2: 1.5,
  3: 2,
  4: 2,
  5: 2.5,
  6: 2.5,
  7: 3,
  8: 3,
  9: 3.5,
  10: 3.5,
  11: 4,
  12: 4,
  13: 4.5,
  14: 4.5,
  15: 5
};

// Standard D&D 5e creature sizes
const CREATURE_SIZES_LIST = [
  'Tiny',
  'Small', 
  'Medium',
  'Large',
  'Huge',
  'Gargantuan'
] as const;

// Standard D&D 5e alignments
const ALIGNMENTS_LIST = [
  'Lawful Good',
  'Neutral Good', 
  'Chaotic Good',
  'Lawful Neutral',
  'True Neutral',
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil',
  'Unaligned'
] as const;

// Standard D&D 5e creature types
const CREATURE_TYPES_LIST = [
  'Aberration',
  'Beast',
  'Celestial',
  'Construct',
  'Dragon',
  'Elemental',
  'Fey',
  'Fiend',
  'Giant',
  'Humanoid',
  'Monstrosity',
  'Ooze',
  'Plant',
  'Undead'
] as const;

// Common D&D 5e environments
const ENVIRONMENTS_LIST = [
  'Arctic',
  'Coastal',
  'Desert',
  'Forest',
  'Grassland',
  'Hill',
  'Mountain',
  'Swamp',
  'Underdark',
  'Underwater',
  'Urban'
] as const;

// Difficulty thresholds by character level
const DIFFICULTY_THRESHOLDS_MAP = {
  easy: [25, 50, 75, 125, 250, 300, 350, 450, 550, 600, 800, 1000, 1100, 1250, 1400, 1600, 2000, 2100, 2400, 2800],
  medium: [50, 100, 150, 250, 500, 600, 750, 900, 1100, 1200, 1600, 2000, 2200, 2500, 2800, 3200, 3900, 4200, 4900, 5700],
  hard: [75, 150, 225, 375, 750, 900, 1100, 1400, 1600, 1900, 2400, 3000, 3400, 3800, 4300, 4800, 5900, 6300, 7300, 8500],
  deadly: [100, 200, 400, 500, 1100, 1400, 1700, 2100, 2400, 2800, 3600, 4500, 5100, 5700, 6400, 7200, 8800, 9500, 10900, 12700]
};

export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: AppConfiguration;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  private loadConfiguration(): AppConfiguration {
    // Determine environment
    const environment = this.determineEnvironment();

    return {
      environment,
      
      api: {
        baseUrl: this.getEnvVar('VITE_SUPABASE_URL', 'https://xhrobkdzjabllhftksvt.supabase.co/functions/v1'),
        timeout: environment === 'development' ? 10000 : 30000,
        retryAttempts: environment === 'development' ? 2 : 3,
        retryDelay: 1000
      },

      databases: [
        {
          id: '',
          name: 'creatures',
          description: 'D&D Creatures/Monsters database',
          environmentVariable: 'CREATURES_DATABASE_ID',
          required: true
        },
        {
          id: '',
          name: 'environments',
          description: 'D&D Environments/Locations database',
          environmentVariable: 'ENVIRONMENTS_DATABASE_ID',
          required: true
        },
        {
          id: '',
          name: 'creatureTypes',
          description: 'D&D Creature Types database',
          environmentVariable: 'CREATURE_TYPES_DATABASE_ID',
          required: false
        }
      ],

      logging: {
        level: environment === 'development' ? 'debug' : 'info',
        enableConsole: true,
        enableTimestamps: environment === 'development',
        enableColors: environment === 'development',
        verbosePropertyExtraction: environment === 'development',
        verboseNetworking: environment === 'development'
      },

      encounter: {
        defaultXPThreshold: 1000,
        maxMonsters: 8,
        defaultCRRange: [0, 20],
        difficultyMultipliers: {
          'Easy': 0.5,
          'Medium': 1.0,
          'Hard': 1.5,
          'Deadly': 2.0
        },
        encounterMultipliers: ENCOUNTER_MULTIPLIERS_MAP
      },

      validation: {
        enableResponseValidation: environment === 'development',
        enableSchemaValidation: environment === 'development',
        strictMode: environment === 'production',
        validateRequiredFields: true
      }
    };
  }

  private determineEnvironment(): 'development' | 'production' | 'test' {
    if (typeof window !== 'undefined') {
      // Browser environment
      return window.location.hostname === 'localhost' ? 'development' : 'production';
    } else {
      // Node/Deno environment
      return (globalThis as any).Deno?.env?.get('NODE_ENV') === 'production' ? 'production' : 'development';
    }
  }

  public getEnvVar(key: string, defaultValue: string): string {
    if (typeof window !== 'undefined') {
      // Browser environment - check for Vite env vars
      return (import.meta.env as any)?.[key] || defaultValue;
    } else {
      // Server environment
      return (globalThis as any).Deno?.env?.get(key) || process?.env?.[key] || defaultValue;
    }
  }

  // Getters for configuration sections
  getAPIConfig(): APIConfig {
    return this.config.api;
  }

  getDatabaseConfig(name?: string): DatabaseConfig[] | DatabaseConfig | undefined {
    if (name) {
      return this.config.databases.find(db => db.name === name);
    }
    return this.config.databases;
  }

  getLoggingConfig(): LoggingConfig {
    return this.config.logging;
  }

  getEncounterConfig(): EncounterConfig {
    return this.config.encounter;
  }

  getValidationConfig(): ValidationConfig {
    return this.config.validation;
  }

  getEnvironment(): 'development' | 'production' | 'test' {
    return this.config.environment;
  }

  // Utility methods
  isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  isProduction(): boolean {
    return this.config.environment === 'production';
  }

  shouldLogVerbose(): boolean {
    return this.config.logging.level === 'debug' || this.isDevelopment();
  }

  getXPForCR(challengeRating: number): number {
    return XP_BY_CR_MAP[challengeRating] || 0;
  }

  getEncounterMultiplier(monsterCount: number): number {
    if (monsterCount <= 0) return 1;
    if (monsterCount >= 15) return 5;
    return ENCOUNTER_MULTIPLIERS_MAP[monsterCount] || 1;
  }

  getDifficultyThreshold(level: number, difficulty: keyof typeof DIFFICULTY_THRESHOLDS_MAP): number {
    if (level < 1 || level > 20) return 0;
    const thresholds = DIFFICULTY_THRESHOLDS_MAP[difficulty];
    return thresholds[level - 1] || 0;
  }

  // Update configuration at runtime
  updateAPIConfig(updates: Partial<APIConfig>): void {
    this.config.api = { ...this.config.api, ...updates };
  }

  updateLoggingConfig(updates: Partial<LoggingConfig>): void {
    this.config.logging = { ...this.config.logging, ...updates };
  }

  updateEncounterConfig(updates: Partial<EncounterConfig>): void {
    this.config.encounter = { ...this.config.encounter, ...updates };
  }

  // Export current configuration
  exportConfiguration(): AppConfiguration {
    return JSON.parse(JSON.stringify(this.config));
  }

  // Import configuration
  importConfiguration(config: Partial<AppConfiguration>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
export const config = ConfigurationManager.getInstance();

// Convenient exports for common values
export const XP_BY_CR = XP_BY_CR_MAP;
export const ENCOUNTER_MULTIPLIERS = ENCOUNTER_MULTIPLIERS_MAP;
export const CREATURE_SIZES = CREATURE_SIZES_LIST;
export const ALIGNMENTS = ALIGNMENTS_LIST;
export const CREATURE_TYPES = CREATURE_TYPES_LIST;
export const ENVIRONMENTS = ENVIRONMENTS_LIST;
export const DIFFICULTY_THRESHOLDS = DIFFICULTY_THRESHOLDS_MAP;

// Utility functions using configuration
export const configUtils = {
  /**
   * Get base URL for edge functions
   */
  getBaseURL: (): string => config.getAPIConfig().baseUrl,

  /**
   * Get auth headers for requests
   */
  getAuthHeaders: (): Record<string, string> => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.getEnvVar('VITE_SUPABASE_ANON_KEY', '')}`
  }),

  /**
   * Create request configuration with defaults
   */
  createRequestConfig: (overrides: Partial<RequestInit> = {}): RequestInit => ({
    method: 'POST',
    headers: configUtils.getAuthHeaders(),
    ...overrides
  }),

  /**
   * Calculate encounter difficulty for given parameters
   */
  calculateEncounterDifficulty: (
    adjustedXP: number, 
    partyLevel: number, 
    partySize: number = 4
  ): string => {
    const baseThresholds = {
      easy: config.getDifficultyThreshold(partyLevel, 'easy'),
      medium: config.getDifficultyThreshold(partyLevel, 'medium'),
      hard: config.getDifficultyThreshold(partyLevel, 'hard'),
      deadly: config.getDifficultyThreshold(partyLevel, 'deadly')
    };

    // Adjust for party size
    const sizeMultiplier = partySize / 4;
    const thresholds = {
      easy: baseThresholds.easy * sizeMultiplier,
      medium: baseThresholds.medium * sizeMultiplier,
      hard: baseThresholds.hard * sizeMultiplier,
      deadly: baseThresholds.deadly * sizeMultiplier
    };

    if (adjustedXP >= thresholds.deadly) return 'Deadly';
    if (adjustedXP >= thresholds.hard) return 'Hard';
    if (adjustedXP >= thresholds.medium) return 'Medium';
    return 'Easy';
  },

  /**
   * Validate CR string and convert to number
   */
  parseChallengeRating: (cr: string | number): number => {
    if (typeof cr === 'number') return cr;
    if (cr === '1/8') return 0.125;
    if (cr === '1/4') return 0.25;
    if (cr === '1/2') return 0.5;
    return parseFloat(cr) || 0;
  },

  /**
   * Format CR number back to display string
   */
  formatChallengeRating: (cr: number): string => {
    if (cr === 0.125) return '1/8';
    if (cr === 0.25) return '1/4';
    if (cr === 0.5) return '1/2';
    return cr.toString();
  }
};