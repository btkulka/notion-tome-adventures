/**
 * Centralized property resolution system for Notion pages
 * Handles multiple property name variants, types, and relation resolution
 */

// Property name mappings for different databases
export const PROPERTY_MAPPINGS = {
  creature: {
    name: ['Monster Name', 'Name', 'Monster', 'Monsters', 'CreatureName', 'Title'],
    type: ['Type', 'MonsterType', 'CreatureType', 'Category', 'Creature Type'],
    challengeRating: ['ChallengeRating', 'CR', 'Challenge', 'Challenge Rating'],
    xpValue: ['XPValue', 'XP', 'ExperiencePoints', 'XP Value', 'Experience'],
    armorClass: ['ArmorClass', 'AC', 'Armor Class'],
    hitPoints: ['HitPoints', 'HP', 'Hit Points', 'Health'],
    environment: ['Environment', 'Environments', 'Habitat'],
    alignment: ['Alignment', 'Morality'],
    size: ['Size', 'CreatureSize'],
    subtype: ['Subtype', 'SubType', 'Category'],
    speed: ['Speed', 'WalkSpeed', 'Walking Speed'],
    languages: ['Languages', 'Language'],
    source: ['Source', 'Book', 'Sourcebook']
  },
  environment: {
    name: ['Name', 'Environment Name', 'Location'],
    description: ['Description', 'Details', 'Info'],
    terrainType: ['TerrainType', 'Terrain Type', 'Terrain'],
    climate: ['Climate', 'Weather'],
    hazards: ['Hazards', 'Dangers'],
    commonCreatures: ['CommonCreatures', 'Creatures', 'TypicalCreatures'],
    survivalDC: ['SurvivalDC', 'DC'],
    foragingDC: ['ForagingDC', 'ForageDC'],
    navigationDC: ['NavigationDC', 'NavDC']
  }
};

// Property type extractors
export class PropertyExtractor {
  notion: any;
  resolveRelations: boolean;

  constructor(notion: any, resolveRelations = false) {
    this.notion = notion;
    this.resolveRelations = resolveRelations;
  }

  // Extract text from title or rich_text properties
  async extractText(properties, propertyNames) {
    for (const name of propertyNames) {
      const prop = properties[name];
      if (!prop) continue;

      if (prop.title?.[0]?.plain_text) {
        return prop.title[0].plain_text;
      }
      if (prop.rich_text?.[0]?.plain_text) {
        return prop.rich_text[0].plain_text;
      }
    }
    return null;
  }

  // Extract number from number properties
  extractNumber(properties, propertyNames, defaultValue = 0) {
    for (const name of propertyNames) {
      const prop = properties[name];
      if (prop?.number !== undefined) {
        return prop.number;
      }
    }
    return defaultValue;
  }

  // Extract select value
  async extractSelect(properties: any, propertyNames: string[], defaultValue: string | null = null): Promise<string | null> {
    for (const name of propertyNames) {
      const prop = properties[name];
      if (prop?.select?.name) {
        return prop.select.name;
      }
      
      // Try as relation if select fails and relations are enabled
      if (this.resolveRelations && prop?.relation?.[0]) {
        try {
          const resolved = await this.resolveRelation(prop.relation[0].id);
          if (resolved) return resolved;
        } catch (error) {
          console.warn(`Failed to resolve relation for ${name}:`, error.message);
        }
      }
    }
    return defaultValue;
  }

  // Extract multi-select values
  extractMultiSelect(properties, propertyNames, defaultValue = []) {
    for (const name of propertyNames) {
      const prop = properties[name];
      if (prop?.multi_select?.length > 0) {
        return prop.multi_select.map(item => item.name);
      }
    }
    return defaultValue;
  }

  // Extract special challenge rating (handles fractions and relations)
  async extractChallengeRating(properties: any, propertyNames: string[]): Promise<number> {
    // Try as number first
    const numberValue = this.extractNumber(properties, propertyNames, -1);
    if (numberValue !== -1) return numberValue;

    // Try as select (for fraction values)
    for (const name of propertyNames) {
      const prop = properties[name];
      if (prop?.select?.name) {
        const text = prop.select.name;
        return this.parseChallengeRating(text);
      }

      // Try as relation
      if (this.resolveRelations && prop?.relation?.[0]) {
        try {
          const resolved = await this.resolveRelation(prop.relation[0].id);
          if (resolved) {
            return this.parseChallengeRating(resolved);
          }
        } catch (error) {
          console.warn(`Failed to resolve CR relation for ${name}:`, error.message);
        }
      }
    }

    return 0;
  }

  // Parse challenge rating from text (handles fractions)
  parseChallengeRating(text) {
    if (!text) return 0;
    
    const str = text.toString().trim();
    if (str === '1/8') return 0.125;
    if (str === '1/4') return 0.25;
    if (str === '1/2') return 0.5;
    
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
  }

  // Resolve relation property to get the actual value
  async resolveRelation(relationId) {
    if (!this.notion) {
      throw new Error('Notion client required for relation resolution');
    }

    try {
      console.log(`🔗 Resolving relation: ${relationId}`);
      const page = await this.notion.pages.retrieve({ page_id: relationId });
      
      if (!page.properties) return null;

      // Try to find title property
      for (const [key, prop] of Object.entries(page.properties)) {
        const typedProp = prop as any;
        if (typedProp.type === 'title' && typedProp.title?.length > 0) {
          const value = typedProp.title[0].plain_text;
          console.log(`✅ Resolved relation ${relationId} -> ${value}`);
          return value;
        }
      }
      
      // Try to find name property
      for (const [key, prop] of Object.entries(page.properties)) {
        const typedProp = prop as any;
        if (key.toLowerCase().includes('name') && typedProp.type === 'rich_text' && typedProp.rich_text?.length > 0) {
          const value = typedProp.rich_text[0].plain_text;
          console.log(`✅ Resolved relation ${relationId} -> ${value}`);
          return value;
        }
      }
      
      console.log(`⚠️ Could not extract value from relation ${relationId}`);
      return null;
    } catch (error) {
      console.error(`❌ Failed to resolve relation ${relationId}:`, error);
      return null;
    }
  }
}

// High-level extraction functions for specific entity types
export class CreatureExtractor extends PropertyExtractor {
  async extract(page) {
    const props = page.properties;
    const mapping = PROPERTY_MAPPINGS.creature;

    const name = await this.extractText(props, mapping.name) || 'Unknown Creature';
    const type = await this.extractSelect(props, mapping.type, 'Unknown');
    const challenge_rating = await this.extractChallengeRating(props, mapping.challengeRating);
    
    // Calculate XP if not explicitly set
    let xp_value = this.extractNumber(props, mapping.xpValue, 0);
    if (xp_value === 0 && challenge_rating > 0) {
      xp_value = this.calculateXP(challenge_rating);
    }

    return {
      id: page.id,
      name,
      size: await this.extractSelect(props, mapping.size, 'Medium'),
      type,
      subtype: await this.extractSelect(props, mapping.subtype, ''),
      alignment: await this.extractSelect(props, mapping.alignment, 'Neutral'),
      armor_class: this.extractNumber(props, mapping.armorClass, 10),
      hit_points: this.extractNumber(props, mapping.hitPoints, 1),
      speed: {
        walk: this.extractNumber(props, mapping.speed, 30)
      },
      challenge_rating,
      xp_value,
      environment: this.extractMultiSelect(props, mapping.environment),
      languages: this.extractMultiSelect(props, mapping.languages),
      source: await this.extractSelect(props, mapping.source, 'Unknown'),
      // Metadata
      created_time: page.created_time,
      last_edited_time: page.last_edited_time,
      url: page.url
    };
  }

  calculateXP(challengeRating) {
    const XP_BY_CR = {
      '0': 10, '0.125': 25, '0.25': 50, '0.5': 100,
      '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
      '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
      '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
      '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
      '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000
    };
    
    return XP_BY_CR[challengeRating.toString()] || 0;
  }
}

export class EnvironmentExtractor extends PropertyExtractor {
  async extract(page) {
    const props = page.properties;
    const mapping = PROPERTY_MAPPINGS.environment;

    return {
      id: page.id,
      name: await this.extractText(props, mapping.name) || 'Unknown Environment',
      description: await this.extractText(props, mapping.description) || '',
      terrain_type: this.extractMultiSelect(props, mapping.terrainType),
      climate: await this.extractSelect(props, mapping.climate, ''),
      hazards: this.extractMultiSelect(props, mapping.hazards),
      common_creatures: this.extractMultiSelect(props, mapping.commonCreatures),
      survival_dc: this.extractNumber(props, mapping.survivalDC, 15),
      foraging_dc: this.extractNumber(props, mapping.foragingDC, 15),
      navigation_dc: this.extractNumber(props, mapping.navigationDC, 15),
      // Metadata
      created_time: page.created_time,
      last_edited_time: page.last_edited_time,
      url: page.url
    };
  }
}

// Factory function to create extractors
export function createExtractor(type: string, notion: any, options: { resolveRelations?: boolean } = {}) {
  const { resolveRelations = false } = options;
  
  switch (type) {
    case 'creature':
      return new CreatureExtractor(notion, resolveRelations);
    case 'environment':
      return new EnvironmentExtractor(notion, resolveRelations);
    default:
      return new PropertyExtractor(notion, resolveRelations);
  }
}
