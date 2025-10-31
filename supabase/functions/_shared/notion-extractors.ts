/**
 * Unified Notion Property Extraction System
 * Single source of truth for all Notion-to-DTO transformations
 * Deno-compatible, type-safe, with fallback-aware property extraction
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ChallengeRatingDTO {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
  name: string;  // e.g., "CR 5", "1/2", "30"
  cr_value: string;  // The CR value as a string
  xp: number;  // XP value for this CR
  creatureRelations?: string[];  // Relation IDs to Creature pages that have this CR
}

export interface CreatureTypeDTO {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
  name: string;  // e.g., "Dragon", "Humanoid", "Undead"
  description?: string;
  creatureRelations?: string[];  // Relation IDs to Creature pages of this type
}

export interface CreatureDTO {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
  name: string;

  // Relations to other entities
  crRelation?: string;  // Relation ID to CR page
  environmentRelations?: string[];  // Relation IDs to Environment pages
  typeRelation?: string;  // Relation ID to Creature Type page
  subtypeRelation?: string;  // Relation ID to Creature Subtype page (also Monster Types table)

  // Direct properties (tags/selects)
  alignment?: string;  // Select/tag
  size?: string;  // Select/tag
  treasure_type?: string;  // Select/tag for treasure/loot type

  // Stats
  ac: number;
  hp: number;

  // Derived/cached values (for convenience, populated after resolving relations)
  cr?: string;  // Cached from CR relation
  xp?: number;  // Cached from CR relation
  type?: string;  // Cached from Type relation
  subtype?: string;  // Cached from Subtype relation
  environment?: string[];  // Cached from Environment relations

  // Media
  imageUrl?: string;  // Primary image URL
  imageUrls?: string[];  // All image URLs
}

export interface EnvironmentDTO {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
  name: string;
  description: string;

  // Relations
  creatureRelations?: string[];  // Relation IDs to Creature pages found in this environment

  // Direct properties
  terrain_type: string[];
  climate: string;
  hazards: string[];
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
  campaignRelation?: string;  // Relation ID to Campaign page
  playerRelations?: string[];  // Relation IDs to Player pages
  encounterRelations?: string[];  // Relation IDs to Encounter pages
}

export interface CampaignDTO {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
  name: string;
  description: string;
  active: boolean;
  sessionRelations?: string[];  // Relation IDs to Session pages
  coverArt?: string;  // Primary cover art URL
}

export interface MagicItemDTO {
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
  name: string;
  rarityRelation?: string;  // Relation to Magic Item Rarity
  baseWeaponRelation?: string;  // Relation to Weapons
  baseArmorRelation?: string;  // Relation to Armor
  itemUrl?: string;  // URL to item details
  imageUrl?: string;  // URL to item image
  tags?: string[];  // Multi-select tags
  consumable: boolean;
  wondrous: boolean;
  attunement: boolean;
  source?: string;  // Select field
  classRestriction?: string[];  // Multi-select
  archived: boolean;
  value?: number;  // Formula result as number

  // Cached/resolved values
  rarity?: string;  // Resolved from rarity relation
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
export function extractText(properties: any, propertyNames: string[], debug = false): string {
  for (const name of propertyNames) {
    const prop = properties[name];
    if (!prop) {
      if (debug) console.log(`Property "${name}" not found`);
      continue;
    }

    // Handle title properties
    if (prop.type === 'title' && prop.title?.[0]?.plain_text) {
      if (debug) console.log(`Found title property "${name}":`, prop.title[0].plain_text);
      return prop.title[0].plain_text;
    }

    // Handle rich_text properties
    if (prop.type === 'rich_text' && prop.rich_text?.[0]?.plain_text) {
      if (debug) console.log(`Found rich_text property "${name}":`, prop.rich_text[0].plain_text);
      return prop.rich_text[0].plain_text;
    }

    if (debug) console.log(`Property "${name}" exists but wrong type:`, prop.type);
  }

  if (debug) console.log(`No text found in properties:`, propertyNames);
  return '';
}

/**
 * Extracts number from Notion properties with fallback property names
 */
export function extractNumber(properties: any, propertyNames: string[], defaultValue: number = 0): number {
  for (const name of propertyNames) {
    const prop = properties[name];

    // Debug logging for Value field
    if (name === 'Value' && prop) {
      console.log(`[extractNumber] Found ${name} property:`, {
        type: prop.type,
        hasNumber: !!prop.number,
        hasFormula: !!prop.formula,
        formulaType: prop.formula?.type,
        formulaNumber: prop.formula?.number,
        rawProp: JSON.stringify(prop).substring(0, 200)
      });
    }

    if (prop?.type === 'number' && typeof prop.number === 'number') {
      return prop.number;
    }
    // Handle formula fields that return numbers
    if (prop?.type === 'formula' && prop.formula?.type === 'number' && typeof prop.formula.number === 'number') {
      return prop.formula.number;
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

/**
 * Extracts URL from Notion properties with fallback property names
 */
export function extractUrl(properties: any, propertyNames: string[]): string {
  for (const name of propertyNames) {
    const prop = properties[name];
    if (prop?.type === 'url' && prop.url) {
      return prop.url;
    }
  }
  return '';
}

/**
 * Extracts relation IDs from Notion properties with fallback property names
 * Relations are object links to other pages in Notion
 * Returns an array of page IDs that can be used to fetch the related pages
 */
export function extractRelation(properties: any, propertyNames: string[]): string[] {
  for (const name of propertyNames) {
    const prop = properties[name];
    if (prop?.type === 'relation' && Array.isArray(prop.relation)) {
      return prop.relation.map((item: any) => item.id).filter(Boolean);
    }
  }
  return [];
}

/**
 * Extracts files/media from Notion properties with fallback property names
 * Returns an array of file URLs
 */
export function extractFiles(properties: any, propertyNames: string[]): string[] {
  for (const name of propertyNames) {
    const prop = properties[name];
    if (prop?.type === 'files' && Array.isArray(prop.files)) {
      return prop.files.map((file: any) => {
        // Handle both external and Notion-hosted files
        if (file.type === 'external') {
          return file.external?.url;
        } else if (file.type === 'file') {
          return file.file?.url;
        }
        return null;
      }).filter(Boolean);
    }
  }
  return [];
}

/**
 * Extracts checkbox value from Notion properties with fallback property names
 */
export function extractCheckbox(properties: any, propertyNames: string[]): boolean {
  for (const name of propertyNames) {
    const prop = properties[name];
    if (prop?.type === 'checkbox') {
      return prop.checkbox === true;
    }
  }
  return false;
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
 * Extracts a complete ChallengeRatingDTO from a Notion page
 * Uses EXACT property names from Challenge Ratings table
 */
export function extractChallengeRating(page: any): ChallengeRatingDTO {
  const props = page.properties;
  const base = extractBaseProperties(page);

  // "Challenge Ratings" table properties - use exact property name: "CR Level"
  const cr_value = extractText(props, ['CR Level']);
  const name = cr_value; // Use CR value as the name
  const xp = extractNumber(props, ['XP'], 0);

  // "Challenge Ratings".Monsters -> Monsters
  const creatureRelations = extractRelation(props, ['Monsters']);

  // If XP not stored, calculate from CR value
  const finalXp = xp || XP_BY_CR[cr_value] || 0;

  return {
    ...base,
    name,
    cr_value,
    xp: finalXp,
    creatureRelations: creatureRelations.length > 0 ? creatureRelations : undefined,
  };
}

/**
 * Extracts a complete CreatureTypeDTO (Monster Type) from a Notion page
 * Uses EXACT property names from Monster Types table
 */
export function extractCreatureType(page: any): CreatureTypeDTO {
  const props = page.properties;
  const base = extractBaseProperties(page);

  // "Monster Types" table properties - use exact property name: "Monster Type"
  const name = extractText(props, ['Monster Type']);
  const description = extractText(props, ['Description']);

  // "Monster Types".Monsters -> Monsters
  const creatureRelations = extractRelation(props, ['Monsters']);

  return {
    ...base,
    name,
    description: description || undefined,
    creatureRelations: creatureRelations.length > 0 ? creatureRelations : undefined,
  };
}

/**
 * Extracts a complete CreatureDTO (Monster) from a Notion page
 * Uses EXACT property names from the Notion database
 */
export function extractCreature(page: any): CreatureDTO {
  const props = page.properties;
  const base = extractBaseProperties(page);

  // Extract name - using exact Notion property name
  const name = extractText(props, ['Monster Name']);

  // Extract RELATIONS to other entities - using EXACT Notion property names
  // Monsters."Challenge Rating" -> "Challenge Ratings"
  const crRelationIds = extractRelation(props, ['Challenge Rating']);
  const crRelation = crRelationIds.length > 0 ? crRelationIds[0] : undefined;

  // Monsters.Environments -> Environments
  const environmentRelations = extractRelation(props, ['Environments']);

  // Monsters."Monster Type" -> "Monster Types"
  const typeRelationIds = extractRelation(props, ['Monster Type']);
  const typeRelation = typeRelationIds.length > 0 ? typeRelationIds[0] : undefined;

  // Monsters."Monster Subtype" -> "Monster Types"
  const subtypeRelationIds = extractRelation(props, ['Monster Subtype']);
  const subtypeRelation = subtypeRelationIds.length > 0 ? subtypeRelationIds[0] : undefined;

  // Extract DIRECT properties (tags/selects, not relations)
  const alignment = extractSelect(props, ['Alignment']);
  const size = extractSelect(props, ['Size']);
  const treasure_type = extractSelect(props, ['Treasure Type', 'TreasureType']);

  // Extract stats
  const ac = extractNumber(props, ['AC'], 10);
  const hp = extractNumber(props, ['HP'], 10);

  // Extract image URL (it's a URL field, not a Files field)
  const imageUrl = extractUrl(props, ['Image URL', 'Image', 'ImageURL']);

  return {
    ...base,
    name,
    crRelation,
    environmentRelations: environmentRelations.length > 0 ? environmentRelations : undefined,
    typeRelation,
    subtypeRelation,
    alignment,
    size,
    treasure_type,
    ac,
    hp,
    imageUrl: imageUrl || undefined,
    imageUrls: imageUrl ? [imageUrl] : undefined,
  };
}

/**
 * Extracts a complete EnvironmentDTO from a Notion page
 * Uses EXACT property names from Environments table
 */
export function extractEnvironment(page: any): EnvironmentDTO {
  const props = page.properties;
  const base = extractBaseProperties(page);

  // Environments table properties - use exact property name: "Environment"
  const name = extractText(props, ['Environment']);
  const description = extractText(props, ['Description']);
  const terrain_type = extractMultiSelect(props, ['Terrain Features']); // Updated property name
  const climate = extractSelect(props, ['Climate']);
  const hazards = extractMultiSelect(props, ['Hazards']);

  // Environments.Monsters -> Monsters
  const creatureRelations = extractRelation(props, ['Monsters']);

  const survival_dc = extractNumber(props, ['Survival DC'], 15);
  const foraging_dc = extractNumber(props, ['Foraging DC'], 15);
  const navigation_dc = extractNumber(props, ['Navigation DC'], 15);
  const shelter_availability = extractSelect(props, ['Shelter Availability']);
  const water_availability = extractSelect(props, ['Water Availability']);
  const food_availability = extractSelect(props, ['Food Availability']);

  return {
    ...base,
    name,
    description,
    terrain_type,
    climate: climate || 'Unknown',
    hazards,
    creatureRelations: creatureRelations.length > 0 ? creatureRelations : undefined,
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
  const name = extractText(props, ['Session', 'Name', 'Title']);
  const date = extractDate(props, ['Date', 'SessionDate']);
  const description = extractText(props, ['Notes', 'Description']);

  // Extract relations
  const campaignRelationIds = extractRelation(props, ['Campaign']);
  const campaignRelation = campaignRelationIds.length > 0 ? campaignRelationIds[0] : undefined;

  const playerRelations = extractRelation(props, ['Players', 'Best Roleplay', 'Best Combat']);
  const encounterRelations = extractRelation(props, ['Encounters']);

  return {
    ...base,
    name,
    date,
    description,
    campaignRelation,
    playerRelations: playerRelations.length > 0 ? playerRelations : undefined,
    encounterRelations: encounterRelations.length > 0 ? encounterRelations : undefined,
  };
}

/**
 * Extracts a complete CampaignDTO from a Notion page
 * Uses EXACT property names from Campaigns table
 */
export function extractCampaign(page: any): CampaignDTO {
  const props = page.properties;
  const base = extractBaseProperties(page);

  // Campaigns table properties - use exact property name: "Campaign"
  const name = extractText(props, ['Campaign']);
  const description = extractText(props, ['Description']);
  const active = extractCheckbox(props, ['Active']);

  // Campaigns.Sessions -> Sessions
  const sessionRelations = extractRelation(props, ['Sessions']);

  // Extract cover art
  const coverArtUrls = extractFiles(props, ['Cover Art']);
  const coverArt = coverArtUrls.length > 0 ? coverArtUrls[0] : undefined;

  return {
    ...base,
    name,
    description,
    active,
    sessionRelations: sessionRelations.length > 0 ? sessionRelations : undefined,
    coverArt,
  };
}

/**
 * Extracts a complete MagicItemDTO from a Notion page
 * Uses EXACT property names from Magic Items table
 */
export function extractMagicItem(page: any): MagicItemDTO {
  const props = page.properties;
  const base = extractBaseProperties(page);

  // Magic Items table properties - use exact property name: "Name"
  const name = extractText(props, ['Name', 'Item Name', 'Magic Item']);

  // Extract relations
  const rarityRelationIds = extractRelation(props, ['Rarity', 'Magic Item Rarity']);
  const rarityRelation = rarityRelationIds.length > 0 ? rarityRelationIds[0] : undefined;

  const baseWeaponRelationIds = extractRelation(props, ['Base Weapon', 'Weapon']);
  const baseWeaponRelation = baseWeaponRelationIds.length > 0 ? baseWeaponRelationIds[0] : undefined;

  const baseArmorRelationIds = extractRelation(props, ['Base Armor', 'Armor']);
  const baseArmorRelation = baseArmorRelationIds.length > 0 ? baseArmorRelationIds[0] : undefined;

  // Extract URLs
  const itemUrl = extractUrl(props, ['URL', 'Item URL', 'Link']);
  const imageUrl = extractUrl(props, ['Image URL', 'Image', 'ImageURL']);

  // Extract tags
  const tags = extractMultiSelect(props, ['Tags', 'Type']);

  // Extract checkboxes
  const consumable = extractCheckbox(props, ['Consumable']);
  const wondrous = extractCheckbox(props, ['Wondrous']);
  const attunement = extractCheckbox(props, ['Attunement', 'Requires Attunement']);
  const archived = extractCheckbox(props, ['Archived']);

  // Extract select fields
  const source = extractSelect(props, ['Source', 'Book']);
  const classRestriction = extractMultiSelect(props, ['Class Restriction', 'Class']);

  // Extract value (formula or number)
  const value = extractNumber(props, ['Value', 'Gold Value', 'GP']);

  return {
    ...base,
    name,
    rarityRelation,
    baseWeaponRelation,
    baseArmorRelation,
    itemUrl: itemUrl || undefined,
    imageUrl: imageUrl || undefined,
    tags: tags.length > 0 ? tags : undefined,
    consumable,
    wondrous,
    attunement,
    source: source || undefined,
    classRestriction: classRestriction.length > 0 ? classRestriction : undefined,
    archived,
    value: value || undefined,
  };
}

// =============================================================================
// RELATION RESOLUTION HELPERS
// =============================================================================

/**
 * Resolves relation IDs by fetching the related pages from Notion
 * @param notion - Notion client instance
 * @param relationIds - Array of page IDs to fetch
 * @returns Promise resolving to array of page objects
 */
export async function resolveRelations(notion: any, relationIds: string[]): Promise<any[]> {
  if (!relationIds || relationIds.length === 0) {
    return [];
  }

  try {
    // Fetch all related pages in parallel
    const pagePromises = relationIds.map(id =>
      notion.pages.retrieve({ page_id: id }).catch((err: Error) => {
        console.warn(`Failed to fetch related page ${id}:`, err.message);
        return null;
      })
    );

    const pages = await Promise.all(pagePromises);
    return pages.filter(Boolean);  // Filter out failed fetches
  } catch (error) {
    console.error('Error resolving relations:', error);
    return [];
  }
}

/**
 * Resolves CR relation and returns ChallengeRatingDTO
 * @param notion - Notion client instance
 * @param relationId - CR page ID
 * @returns Promise resolving to ChallengeRatingDTO or null
 */
export async function resolveCRRelation(notion: any, relationId: string, verbose = true): Promise<ChallengeRatingDTO | null> {
  try {
    if (verbose) console.log(`[CR] Resolving CR relation for ID: ${relationId}`);
    const pages = await resolveRelations(notion, [relationId]);

    if (pages.length === 0) {
      console.warn(`[CR] No pages found for CR ID: ${relationId}`);
      return null;
    }

    const page = pages[0];
    if (verbose) console.log(`[CR] Page properties:`, Object.keys(page.properties));

    const cr = extractChallengeRating(page);
    const isValid = isValidChallengeRating(cr);

    if (verbose) {
      console.log(`[CR] Extracted CR:`, {
        name: cr.name,
        cr_value: cr.cr_value,
        xp: cr.xp,
        isValid
      });
    }

    if (!isValid) {
      console.warn(`[CR] Invalid CR extracted:`, cr);
    }

    return isValid ? cr : null;
  } catch (error) {
    console.error(`[CR] Error resolving CR relation ${relationId}:`, error);
    return null;
  }
}

/**
 * Resolves creature type relation and returns CreatureTypeDTO
 * @param notion - Notion client instance
 * @param relationId - Creature Type page ID
 * @returns Promise resolving to CreatureTypeDTO or null
 */
export async function resolveTypeRelation(notion: any, relationId: string, verbose = true): Promise<CreatureTypeDTO | null> {
  try {
    if (verbose) console.log(`[TYPE] Resolving Monster Type relation for ID: ${relationId}`);
    const pages = await resolveRelations(notion, [relationId]);

    if (pages.length === 0) {
      console.warn(`[TYPE] No pages found for Monster Type ID: ${relationId}`);
      return null;
    }

    const page = pages[0];
    if (verbose) console.log(`[TYPE] Page properties:`, Object.keys(page.properties));

    const type = extractCreatureType(page);
    const isValid = isValidCreatureType(type);

    if (verbose) {
      console.log(`[TYPE] Extracted Monster Type:`, {
        name: type.name,
        description: type.description?.substring(0, 50),
        isValid
      });
    }

    if (!isValid) {
      console.warn(`[TYPE] Invalid Monster Type extracted:`, type);
    }

    return isValid ? type : null;
  } catch (error) {
    console.error(`[TYPE] Error resolving Monster Type relation ${relationId}:`, error);
    return null;
  }
}

/**
 * Resolves creature relations and returns CreatureDTO array
 * @param notion - Notion client instance
 * @param relationIds - Array of creature page IDs
 * @returns Promise resolving to array of CreatureDTO objects
 */
export async function resolveCreatureRelations(notion: any, relationIds: string[]): Promise<CreatureDTO[]> {
  const pages = await resolveRelations(notion, relationIds);
  return pages
    .map(page => extractCreature(page))
    .filter(isValidCreature);
}

/**
 * Resolves environment relations and returns EnvironmentDTO array
 * @param notion - Notion client instance
 * @param relationIds - Array of environment page IDs
 * @returns Promise resolving to array of EnvironmentDTO objects
 */
export async function resolveEnvironmentRelations(notion: any, relationIds: string[], verbose = true): Promise<EnvironmentDTO[]> {
  try {
    if (verbose) console.log(`[ENV] Resolving ${relationIds.length} Environment relation(s):`, relationIds);
    const pages = await resolveRelations(notion, relationIds);

    if (pages.length === 0) {
      console.warn(`[ENV] No pages found for Environment IDs:`, relationIds);
      return [];
    }

    if (verbose) {
      console.log(`[ENV] Retrieved ${pages.length} environment pages`);
      if (pages.length > 0) {
        console.log(`[ENV] First environment page properties:`, Object.keys(pages[0].properties));
      }
    }

    const environments = pages.map((page, index) => {
      const env = extractEnvironment(page);
      const isValid = isValidEnvironment(env);

      if (verbose) {
        console.log(`[ENV] Environment ${index}:`, {
          name: env.name,
          climate: env.climate,
          isValid
        });
      }

      if (!isValid) {
        console.warn(`[ENV] Invalid environment at index ${index}:`, env);
      }

      return env;
    }).filter(isValidEnvironment);

    if (verbose) console.log(`[ENV] Successfully extracted ${environments.length} valid environments`);

    return environments;
  } catch (error) {
    console.error(`[ENV] Error resolving Environment relations:`, error);
    return [];
  }
}

/**
 * Enriches a CreatureDTO by resolving all its relations and populating cached values
 * @param notion - Notion client instance
 * @param creature - Base creature DTO with relation IDs
 * @returns Promise resolving to enriched CreatureDTO with cached values populated
 */
export async function enrichCreature(notion: any, creature: CreatureDTO, verbose = true): Promise<CreatureDTO> {
  if (verbose) console.log(`[ENRICH] Starting enrichment for: ${creature.name}`);
  const enriched = { ...creature };

  // Resolve CR relation and cache values
  if (creature.crRelation) {
    if (verbose) console.log(`[ENRICH] ${creature.name}: Resolving CR relation...`);
    const cr = await resolveCRRelation(notion, creature.crRelation, verbose);
    if (cr) {
      enriched.cr = cr.cr_value;
      enriched.xp = cr.xp;
      if (verbose) console.log(`[ENRICH] ${creature.name}: CR set to ${cr.cr_value}, XP: ${cr.xp}`);
    } else {
      console.warn(`[ENRICH] ${creature.name}: Failed to resolve CR relation`);
    }
  } else {
    if (verbose) console.warn(`[ENRICH] ${creature.name}: No CR relation found`);
  }

  // Resolve Type relation and cache value
  if (creature.typeRelation) {
    if (verbose) console.log(`[ENRICH] ${creature.name}: Resolving Monster Type relation...`);
    const type = await resolveTypeRelation(notion, creature.typeRelation, verbose);
    if (type) {
      enriched.type = type.name;
      if (verbose) console.log(`[ENRICH] ${creature.name}: Type set to ${type.name}`);
    } else {
      console.warn(`[ENRICH] ${creature.name}: Failed to resolve Type relation`);
    }
  } else {
    if (verbose) console.warn(`[ENRICH] ${creature.name}: No Type relation found`);
  }

  // Resolve Environment relations and cache values
  if (creature.environmentRelations && creature.environmentRelations.length > 0) {
    if (verbose) console.log(`[ENRICH] ${creature.name}: Resolving ${creature.environmentRelations.length} Environment relation(s)...`);
    const environments = await resolveEnvironmentRelations(notion, creature.environmentRelations, verbose);
    enriched.environment = environments.map(env => env.name);
    if (verbose) console.log(`[ENRICH] ${creature.name}: Environments set to [${enriched.environment.join(', ')}]`);
  } else {
    if (verbose) console.warn(`[ENRICH] ${creature.name}: No Environment relations found`);
  }

  if (verbose) {
    console.log(`[ENRICH] Completed enrichment for: ${creature.name}`, {
      cr: enriched.cr,
      xp: enriched.xp,
      type: enriched.type,
      environments: enriched.environment
    });
  }

  return enriched;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validates that a challenge rating has required fields
 */
export function isValidChallengeRating(cr: ChallengeRatingDTO): boolean {
  return !!(cr.name && cr.cr_value);
}

/**
 * Validates that a creature type has required fields
 */
export function isValidCreatureType(type: CreatureTypeDTO): boolean {
  return !!type.name;
}

/**
 * Validates that a creature has required fields
 * Note: CR and type are relations, so they may not be populated until enrichment
 */
export function isValidCreature(creature: CreatureDTO): boolean {
  return !!creature.name;
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

export function isValidCampaign(campaign: CampaignDTO): boolean {
  return !!campaign.name;
}

/**
 * Validates that a magic item has required fields
 */
export function isValidMagicItem(magicItem: MagicItemDTO): boolean {
  return !!magicItem.name;
}
