/**
 * Type-safe property extractors for Notion API responses
 * Centralizes all property extraction logic with proper error handling
 */

export type NotionPropertyType = 
  | 'title' | 'rich_text' | 'number' | 'select' | 'multi_select' 
  | 'checkbox' | 'date' | 'relation' | 'formula' | 'rollup' | 'files';

export interface PropertyExtractor<T> {
  extract: (property: any) => T | undefined;
  validate?: (value: T) => boolean;
  default?: T;
}

// Base extractors for each Notion property type
export const extractors = {
  text: {
    extract: (property: any): string | undefined => {
      if (!property) return undefined;
      
      if (property.title?.length > 0) {
        return property.title[0].plain_text;
      }
      if (property.rich_text?.length > 0) {
        return property.rich_text[0].plain_text;
      }
      return undefined;
    }
  },

  number: {
    extract: (property: any): number | undefined => property?.number,
    validate: (value: number) => !isNaN(value) && isFinite(value)
  },

  select: {
    extract: (property: any): string | undefined => property?.select?.name
  },

  multiSelect: {
    extract: (property: any): string[] => 
      property?.multi_select?.map((item: any) => item.name) || [],
    default: []
  },

  checkbox: {
    extract: (property: any): boolean => property?.checkbox || false,
    default: false
  },

  date: {
    extract: (property: any): string | undefined => property?.date?.start
  },

  relation: {
    extract: (property: any): string[] => 
      property?.relation?.map((rel: any) => rel.id) || [],
    default: []
  }
};

// Composite extractors for complex data types
export const compositeExtractors = {
  speed: {
    extract: (speedText: string | undefined): Record<string, number> => {
      if (!speedText) return {};
      
      const speed: Record<string, number> = {};
      const regex = /(\w+)\s+(\d+)\s*ft/g;
      let match;
      
      while ((match = regex.exec(speedText)) !== null) {
        const [, type, value] = match;
        speed[type.toLowerCase()] = parseInt(value);
      }
      
      return speed;
    },
    default: {}
  },

  abilityScores: {
    extract: (properties: any) => ({
      strength: extractors.number.extract(properties.Strength) || 10,
      dexterity: extractors.number.extract(properties.Dexterity) || 10,
      constitution: extractors.number.extract(properties.Constitution) || 10,
      intelligence: extractors.number.extract(properties.Intelligence) || 10,
      wisdom: extractors.number.extract(properties.Wisdom) || 10,
      charisma: extractors.number.extract(properties.Charisma) || 10,
    })
  },

  keyValuePairs: {
    extract: (text: string | undefined): Record<string, number> | undefined => {
      if (!text) return undefined;
      
      const pairs: Record<string, number> = {};
      const regex = /(\w+)\s*([+-]?\d+)/g;
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const [, key, value] = match;
        pairs[key.toLowerCase()] = parseInt(value);
      }
      
      return Object.keys(pairs).length > 0 ? pairs : undefined;
    }
  },

  stringArray: {
    extract: (text: string | undefined): string[] | undefined => {
      if (!text) return undefined;
      return text.split(',').map(item => item.trim()).filter(Boolean);
    }
  },

  spellComponents: {
    extract: (componentsText: string | undefined) => {
      const components = {
        verbal: false,
        somatic: false,
        material: false,
        material_description: undefined as string | undefined,
      };
      
      if (!componentsText) return components;
      
      components.verbal = /\bV\b/i.test(componentsText);
      components.somatic = /\bS\b/i.test(componentsText);
      components.material = /\bM\b/i.test(componentsText);
      
      const materialMatch = componentsText.match(/M\s*\(([^)]+)\)/i);
      if (materialMatch) {
        components.material_description = materialMatch[1].trim();
      }
      
      return components;
    }
  },

  cost: {
    extract: (costText: string | undefined) => {
      if (!costText) return undefined;
      
      const match = costText.match(/(\d+)\s*(cp|sp|ep|gp|pp)/i);
      if (match) {
        return {
          quantity: parseInt(match[1]),
          unit: match[2].toLowerCase(),
        };
      }
      
      return undefined;
    }
  },

  damage: {
    extract: (damageText: string | undefined) => {
      if (!damageText) return undefined;
      
      const match = damageText.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+(\w+)/i);
      if (match) {
        return {
          dice: match[1].trim(),
          type: match[2].trim(),
        };
      }
      
      return undefined;
    }
  },

  armorClass: {
    extract: (acText: string | undefined) => {
      if (!acText) return undefined;
      
      const baseMatch = acText.match(/(\d+)/);
      if (!baseMatch) return undefined;
      
      const base = parseInt(baseMatch[1]);
      const dexBonus = /\+\s*Dex/i.test(acText);
      const maxBonusMatch = acText.match(/max\s+(\d+)/i);
      
      return {
        base,
        dex_bonus: dexBonus,
        max_bonus: maxBonusMatch ? parseInt(maxBonusMatch[1]) : undefined,
      };
    }
  }
};

// Safe property extraction with validation and defaults
export function safeExtract<T>(
  properties: any,
  propertyName: string,
  extractor: PropertyExtractor<T>
): T | undefined {
  try {
    const property = properties[propertyName];
    const extracted = extractor.extract(property);
    
    if (extracted === undefined) {
      return extractor.default;
    }
    
    if (extractor.validate && !extractor.validate(extracted)) {
      console.warn(`Invalid value for property ${propertyName}:`, extracted);
      return extractor.default;
    }
    
    return extracted;
  } catch (error) {
    console.error(`Error extracting property ${propertyName}:`, error);
    return extractor.default;
  }
}

// Base Notion page properties extractor
export function extractBaseProperties(notionPage: any) {
  return {
    id: notionPage.id,
    created_time: notionPage.created_time,
    last_edited_time: notionPage.last_edited_time,
    created_by: notionPage.created_by?.id || '',
    last_edited_by: notionPage.last_edited_by?.id || '',
    cover: notionPage.cover?.external?.url || notionPage.cover?.file?.url,
    icon: notionPage.icon?.emoji || notionPage.icon?.external?.url || notionPage.icon?.file?.url,
    parent: notionPage.parent?.database_id || '',
    archived: notionPage.archived,
    url: notionPage.url,
  };
}
