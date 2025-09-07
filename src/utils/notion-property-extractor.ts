/**
 * Advanced Notion Property Extraction System
 * Eliminates repetitive property extraction patterns across all edge functions
 */

export interface PropertyMapping {
  notionPropertyName: string;
  outputKey: string;
  type: 'title' | 'rich_text' | 'number' | 'select' | 'multi_select' | 'checkbox' | 'date' | 'relation' | 'formula' | 'rollup';
  fallbackProperties?: string[];
  defaultValue?: any;
  transform?: (value: any) => any;
  required?: boolean;
}

export interface ExtractionSchema {
  [outputKey: string]: PropertyMapping;
}

export class NotionPropertyExtractor {
  private logExtractions: boolean;

  constructor(logExtractions = false) {
    this.logExtractions = logExtractions;
  }

  private log(message: string) {
    if (this.logExtractions) {
      console.log(`🔍 Property Extraction: ${message}`);
    }
  }

  /**
   * Extract a single property value from Notion page properties
   */
  private extractProperty(
    properties: any, 
    mapping: PropertyMapping
  ): any {
    const { notionPropertyName, type, fallbackProperties = [], defaultValue, transform } = mapping;
    
    // Try primary property name first
    const propertyNames = [notionPropertyName, ...fallbackProperties];
    
    for (const propName of propertyNames) {
      const prop = properties?.[propName];
      if (!prop) continue;

      let value = this.extractByType(prop, type);
      
      if (value !== null && value !== undefined) {
        this.log(`Found value for ${mapping.outputKey} in property ${propName}: ${JSON.stringify(value)}`);
        
        // Apply transformation if provided
        if (transform) {
          value = transform(value);
        }
        
        return value;
      }
    }

    // Return default value if no property found
    this.log(`No value found for ${mapping.outputKey}, using default: ${defaultValue}`);
    return defaultValue;
  }

  /**
   * Extract value based on Notion property type
   */
  private extractByType(property: any, type: string): any {
    if (!property) return null;

    switch (type) {
      case 'title':
        return property.title?.[0]?.plain_text || null;

      case 'rich_text':
        return property.rich_text?.[0]?.plain_text || null;

      case 'number':
        return property.number;

      case 'select':
        return property.select?.name || null;

      case 'multi_select':
        return property.multi_select?.map((item: any) => item.name) || [];

      case 'checkbox':
        return property.checkbox || false;

      case 'date':
        return property.date?.start || null;

      case 'relation':
        return property.relation?.map((item: any) => item.id) || [];

      case 'formula':
        // Formula can return different types
        const formula = property.formula;
        if (formula?.type === 'string') return formula.string;
        if (formula?.type === 'number') return formula.number;
        if (formula?.type === 'boolean') return formula.boolean;
        if (formula?.type === 'date') return formula.date?.start;
        return null;

      case 'rollup':
        // Rollup can contain arrays or single values
        const rollup = property.rollup;
        if (rollup?.type === 'array') {
          return rollup.array?.map((item: any) => {
            // Extract based on item type
            if (item.type === 'title') return item.title?.[0]?.plain_text;
            if (item.type === 'rich_text') return item.rich_text?.[0]?.plain_text;
            if (item.type === 'number') return item.number;
            if (item.type === 'select') return item.select?.name;
            return item;
          }).filter(Boolean) || [];
        }
        if (rollup?.type === 'number') return rollup.number;
        return null;

      default:
        this.log(`Unknown property type: ${type}`);
        return null;
    }
  }

  /**
   * Extract all properties from a Notion page using provided schema
   */
  extractFromPage(page: any, schema: ExtractionSchema): any {
    const result: any = {
      id: page.id,
      created_time: page.created_time,
      last_edited_time: page.last_edited_time,
      url: page.url
    };

    const properties = page.properties;
    this.log(`Extracting properties from page ${page.id}`);

    // Extract each mapped property
    for (const [outputKey, mapping] of Object.entries(schema)) {
      const value = this.extractProperty(properties, mapping);
      
      // Check required fields
      if (mapping.required && (value === null || value === undefined)) {
        throw new Error(`Required property ${mapping.outputKey} not found in page ${page.id}`);
      }
      
      result[outputKey] = value;
    }

    return result;
  }

  /**
   * Extract properties from multiple pages
   */
  extractFromPages(pages: any[], schema: ExtractionSchema): any[] {
    return pages.map(page => this.extractFromPage(page, schema));
  }

  /**
   * Validate schema configuration
   */
  validateSchema(schema: ExtractionSchema): string[] {
    const errors: string[] = [];

    for (const [outputKey, mapping] of Object.entries(schema)) {
      if (!mapping.notionPropertyName) {
        errors.push(`Property ${outputKey} missing notionPropertyName`);
      }
      
      if (!mapping.type) {
        errors.push(`Property ${outputKey} missing type`);
      }

      const validTypes = [
        'title', 'rich_text', 'number', 'select', 'multi_select', 
        'checkbox', 'date', 'relation', 'formula', 'rollup'
      ];
      
      if (mapping.type && !validTypes.includes(mapping.type)) {
        errors.push(`Property ${outputKey} has invalid type: ${mapping.type}`);
      }
    }

    return errors;
  }
}

// Predefined schemas for common D&D entities
export const CREATURE_SCHEMA: ExtractionSchema = {
  name: {
    notionPropertyName: 'Name',
    outputKey: 'name',
    type: 'title',
    fallbackProperties: ['Title', 'CreatureName', 'Monster Name'],
    defaultValue: 'Unknown Creature',
    required: true
  },
  
  challenge_rating: {
    notionPropertyName: 'ChallengeRating',
    outputKey: 'challenge_rating',
    type: 'select',
    fallbackProperties: ['CR', 'Challenge Rating', 'Level'],
    defaultValue: '0',
    transform: (value: string) => {
      // Convert CR strings to numbers for calculations
      if (value === '1/8') return 0.125;
      if (value === '1/4') return 0.25;
      if (value === '1/2') return 0.5;
      return parseFloat(value) || 0;
    }
  },

  armor_class: {
    notionPropertyName: 'ArmorClass',
    outputKey: 'armor_class',
    type: 'number',
    fallbackProperties: ['AC', 'Armor Class'],
    defaultValue: 10
  },

  hit_points: {
    notionPropertyName: 'HitPoints',
    outputKey: 'hit_points',
    type: 'number',
    fallbackProperties: ['HP', 'Hit Points', 'Health'],
    defaultValue: 1
  },

  environment: {
    notionPropertyName: 'Environment',
    outputKey: 'environment',
    type: 'multi_select',
    fallbackProperties: ['Environments', 'Habitat', 'Location'],
    defaultValue: []
  },

  alignment: {
    notionPropertyName: 'Alignment',
    outputKey: 'alignment',
    type: 'select',
    fallbackProperties: ['Morality', 'Ethics'],
    defaultValue: 'Neutral'
  },

  creature_type: {
    notionPropertyName: 'CreatureType',
    outputKey: 'creature_type',
    type: 'relation',
    fallbackProperties: ['Type', 'Species', 'Kind'],
    defaultValue: []
  },

  size: {
    notionPropertyName: 'Size',
    outputKey: 'size',
    type: 'select',
    fallbackProperties: ['CreatureSize'],
    defaultValue: 'Medium'
  }
};

export const ENVIRONMENT_SCHEMA: ExtractionSchema = {
  name: {
    notionPropertyName: 'Name',
    outputKey: 'name',
    type: 'title',
    fallbackProperties: ['Environment', 'EnvironmentName', 'Title'],
    defaultValue: 'Unknown Environment',
    required: true
  },

  description: {
    notionPropertyName: 'Description',
    outputKey: 'description',
    type: 'rich_text',
    fallbackProperties: ['Desc', 'Details'],
    defaultValue: ''
  },

  terrain_type: {
    notionPropertyName: 'TerrainType',
    outputKey: 'terrain_type',
    type: 'multi_select',
    fallbackProperties: ['Terrain', 'TerrainTypes'],
    defaultValue: []
  },

  climate: {
    notionPropertyName: 'Climate',
    outputKey: 'climate',
    type: 'select',
    fallbackProperties: ['Weather', 'ClimateType'],
    defaultValue: 'Temperate'
  },

  hazards: {
    notionPropertyName: 'Hazards',
    outputKey: 'hazards',
    type: 'multi_select',
    fallbackProperties: ['Dangers', 'Risks'],
    defaultValue: []
  },

  survival_dc: {
    notionPropertyName: 'SurvivalDC',
    outputKey: 'survival_dc',
    type: 'number',
    fallbackProperties: ['DC', 'SurvivalCheck'],
    defaultValue: 15
  }
};

export const CREATURE_TYPE_SCHEMA: ExtractionSchema = {
  name: {
    notionPropertyName: 'Name',
    outputKey: 'name',
    type: 'title',
    fallbackProperties: ['Type', 'TypeName'],
    defaultValue: 'Unknown Type',
    required: true
  },

  description: {
    notionPropertyName: 'Description',
    outputKey: 'description',
    type: 'rich_text',
    fallbackProperties: ['Desc'],
    defaultValue: ''
  },

  typical_traits: {
    notionPropertyName: 'TypicalTraits',
    outputKey: 'typical_traits',
    type: 'multi_select',
    fallbackProperties: ['Traits', 'Characteristics'],
    defaultValue: []
  }
};

// Factory functions for creating extractors
export function createCreatureExtractor(logExtractions = false): NotionPropertyExtractor {
  return new NotionPropertyExtractor(logExtractions);
}

export function createEnvironmentExtractor(logExtractions = false): NotionPropertyExtractor {
  return new NotionPropertyExtractor(logExtractions);
}

// Utility functions for common extraction patterns
export const extractionUtils = {
  /**
   * Extract creatures from Notion database response
   */
  extractCreatures: (response: any, logExtractions = false): any[] => {
    const extractor = new NotionPropertyExtractor(logExtractions);
    return extractor.extractFromPages(response.results, CREATURE_SCHEMA);
  },

  /**
   * Extract environments from Notion database response
   */
  extractEnvironments: (response: any, logExtractions = false): any[] => {
    const extractor = new NotionPropertyExtractor(logExtractions);
    return extractor.extractFromPages(response.results, ENVIRONMENT_SCHEMA);
  },

  /**
   * Extract creature types from Notion database response
   */
  extractCreatureTypes: (response: any, logExtractions = false): any[] => {
    const extractor = new NotionPropertyExtractor(logExtractions);
    return extractor.extractFromPages(response.results, CREATURE_TYPE_SCHEMA);
  },

  /**
   * Create custom extractor with schema validation
   */
  createCustomExtractor: (schema: ExtractionSchema, logExtractions = false): NotionPropertyExtractor => {
    const extractor = new NotionPropertyExtractor(logExtractions);
    const errors = extractor.validateSchema(schema);
    
    if (errors.length > 0) {
      throw new Error(`Schema validation failed: ${errors.join(', ')}`);
    }
    
    return extractor;
  },

  /**
   * Extract with automatic XP calculation for creatures
   */
  extractCreaturesWithXP: (response: any, logExtractions = false): any[] => {
    const creatures = extractionUtils.extractCreatures(response, logExtractions);
    
    // XP by CR lookup table
    const XP_BY_CR: Record<number, number> = {
      0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
      1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
      6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
      11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
      16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
      21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000,
      26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000
    };
    
    return creatures.map(creature => ({
      ...creature,
      xp_value: XP_BY_CR[creature.challenge_rating] || 0
    }));
  }
};
