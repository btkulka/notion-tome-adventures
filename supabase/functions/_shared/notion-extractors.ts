/**
 * Unified Notion Property Extraction System
 * Single source of truth for all Notion-to-DTO transformations
 * Deno-compatible, type-safe, with fallback-aware property extraction
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CreatureDTO {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
  name: string;
  cr: string;
  size: string;
  type: string;
  alignment: string;
  ac: number;
  hp: number;
  environment: string[];
  xp: number;
}

export interface EnvironmentDTO {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
  name: string;
  description: string;
  terrain_type: string[];
  climate: string;
  hazards: string[];
  common_creatures: string[];
  survival_dc: number;
  foraging_dc: number;
  navigation_dc: number;
  shelter_availability: string;
  water_availability: string;
  food_availability: string;
}

export interface SessionDTO {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
  name: string;
  date: string;
  description: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const CR_VALUES: Record<string, number> = {
  '0': 0, '1/8': 0.125, '1/4': 0.25, '1/2': 0.5,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  '11': 11, '12': 12, '13': 13, '14': 14, '15': 15, '16': 16, '17': 17, '18': 18,
  '19': 19, '20': 20, '21': 21, '22': 22, '23': 23, '24': 24, '25': 25, '26': 26,
  '27': 27, '28': 28, '29': 29, '30': 30
};

export const XP_BY_CR: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900,
  '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000,
  '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000,
  '28': 120000, '29': 135000, '30': 155000
};

// =============================================================================
// BASE EXTRACTION FUNCTIONS
// =============================================================================

/**
 * Extracts text from Notion properties with fallback property names
 * Handles title and rich_text property types
 */
export function extractText(properties: any, propertyNames: string[]): string {
  for (const name of propertyNames) {
    const prop = properties[name];
    if (!prop) continue;
    
    // Handle title properties
    if (prop.type === 'title' && prop.title?.[0]?.plain_text) {
      return prop.title[0].plain_text;
    }
    
    // Handle rich_text properties
    if (prop.type === 'rich_text' && prop.rich_text?.[0]?.plain_text) {
      return prop.rich_text[0].plain_text;
    }
  }
  return '';
}

/**
 * Extracts number from Notion properties with fallback property names
 */
export function extractNumber(properties: any, propertyNames: string[], defaultValue: number = 0): number {
  for (const name of propertyNames) {
    const prop = properties[name];
    if (prop?.type === 'number' && typeof prop.number === 'number') {
      return prop.number;
    }
  }
  return defaultValue;
}

/**
 * Extracts select value from Notion properties with fallback property names
 */
export function extractSelect(properties: any, propertyNames: string[]): string {
  for (const name of propertyNames) {
    const prop = properties[name];
    if (prop?.type === 'select' && prop.select?.name) {
      return prop.select.name;
    }
  }
  return '';
}

/**
 * Extracts multi-select values from Notion properties with fallback property names
 */
export function extractMultiSelect(properties: any, propertyNames: string[]): string[] {
  for (const name of propertyNames) {
    const prop = properties[name];
    if (prop?.type === 'multi_select' && Array.isArray(prop.multi_select)) {
      return prop.multi_select.map((item: any) => item.name);
    }
  }
  return [];
}

/**
 * Extracts date from Notion properties with fallback property names
 */
export function extractDate(properties: any, propertyNames: string[]): string {
  for (const name of propertyNames) {
    const prop = properties[name];
    if (prop?.type === 'date' && prop.date?.start) {
      return prop.date.start;
    }
  }
  return '';
}

// =============================================================================
// BASE PROPERTIES EXTRACTION
// =============================================================================

/**
 * Extracts common base properties from any Notion page
 */
export function extractBaseProperties(page: any): {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
} {
  return {
    id: page.id || '',
    created_time: page.created_time || '',
    last_edited_time: page.last_edited_time || '',
    url: page.url || '',
  };
}

// =============================================================================
// ENTITY-SPECIFIC EXTRACTORS
// =============================================================================

/**
 * Extracts a complete CreatureDTO from a Notion page
 * Handles all possible property name variations
 */
export function extractCreature(page: any): CreatureDTO {
  const props = page.properties;
  const base = extractBaseProperties(page);
  
  // Extract all creature properties with fallback names
  const name = extractText(props, ['Name', 'Creature', 'Monster']);
  const cr = extractText(props, ['CR', 'Challenge Rating', 'ChallengeRating']);
  const size = extractSelect(props, ['Size', 'CreatureSize']);
  const type = extractSelect(props, ['Type', 'Species', 'Creature Type']);
  const alignment = extractSelect(props, ['Alignment']);
  const ac = extractNumber(props, ['AC', 'ArmorClass', 'Armor Class'], 10);
  const hp = extractNumber(props, ['HP', 'HitPoints', 'Hit Points'], 10);
  const environment = extractMultiSelect(props, ['Environment', 'Environments', 'Terrain']);
  
  // Calculate XP from CR
  const xp = XP_BY_CR[cr] || 0;
  
  return {
    ...base,
    name,
    cr,
    size: size || 'Medium',
    type: type || 'Unknown',
    alignment: alignment || 'Unaligned',
    ac,
    hp,
    environment,
    xp,
  };
}

/**
 * Extracts a complete EnvironmentDTO from a Notion page
 * Handles all possible property name variations
 */
export function extractEnvironment(page: any): EnvironmentDTO {
  const props = page.properties;
  const base = extractBaseProperties(page);
  
  // Extract all environment properties with fallback names
  const name = extractText(props, ['Name', 'Environment', 'Title', 'Environments', 'EnvironmentName']);
  const description = extractText(props, ['Description', 'Desc']);
  const terrain_type = extractMultiSelect(props, ['TerrainType', 'Terrain', 'TerrainTypes']);
  const climate = extractSelect(props, ['Climate', 'Weather', 'ClimateType']);
  const hazards = extractMultiSelect(props, ['Hazards', 'Dangers']);
  const common_creatures = extractMultiSelect(props, ['CommonCreatures', 'Creatures', 'TypicalCreatures']);
  const survival_dc = extractNumber(props, ['SurvivalDC', 'DC'], 15);
  const foraging_dc = extractNumber(props, ['ForagingDC', 'ForageDC'], 15);
  const navigation_dc = extractNumber(props, ['NavigationDC', 'NavDC'], 15);
  const shelter_availability = extractSelect(props, ['ShelterAvailability', 'Shelter']);
  const water_availability = extractSelect(props, ['WaterAvailability', 'Water']);
  const food_availability = extractSelect(props, ['FoodAvailability', 'Food']);
  
  return {
    ...base,
    name,
    description,
    terrain_type,
    climate: climate || 'Unknown',
    hazards,
    common_creatures,
    survival_dc,
    foraging_dc,
    navigation_dc,
    shelter_availability: shelter_availability || 'Common',
    water_availability: water_availability || 'Common',
    food_availability: food_availability || 'Common',
  };
}

/**
 * Extracts a complete SessionDTO from a Notion page
 * Handles all possible property name variations
 */
export function extractSession(page: any): SessionDTO {
  const props = page.properties;
  const base = extractBaseProperties(page);
  
  // Extract all session properties with fallback names
  const name = extractText(props, ['Name', 'Session', 'Title']);
  const date = extractDate(props, ['Date', 'SessionDate']);
  const description = extractText(props, ['Description', 'Notes']);
  
  return {
    ...base,
    name,
    date,
    description,
  };
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validates that a creature has required fields
 */
export function isValidCreature(creature: CreatureDTO): boolean {
  return !!(creature.name && creature.cr);
}

/**
 * Validates that an environment has required fields
 */
export function isValidEnvironment(environment: EnvironmentDTO): boolean {
  return !!environment.name;
}

/**
 * Validates that a session has required fields
 */
export function isValidSession(session: SessionDTO): boolean {
  return !!session.name;
}
