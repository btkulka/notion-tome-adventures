/**
 * Property Parsing Utilities
 * Utility functions for D&D calculations and parsing
 * (Property extraction moved to supabase/functions/_shared/notion-extractors.ts)
 */

// Complex property parsers
export function parseStringArray(text: string | undefined): string[] | undefined {
  if (!text) return undefined;
  
  return text.split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export function parseKeyValuePairs(text: string | undefined): Record<string, number> | undefined {
  if (!text) return undefined;
  
  const pairs: Record<string, number> = {};
  const items = text.split(',');
  
  for (const item of items) {
    const [key, value] = item.split(':').map(s => s.trim());
    if (key && value) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        pairs[key] = numValue;
      }
    }
  }
  
  return Object.keys(pairs).length > 0 ? pairs : undefined;
}

export function parseSpeed(speedText: string | undefined): Record<string, number> {
  if (!speedText) return {};
  
  const speeds: Record<string, number> = {};
  const speedPattern = /(\w+)\s+(\d+)/g;
  let match;
  
  while ((match = speedPattern.exec(speedText)) !== null) {
    const [, type, value] = match;
    speeds[type.toLowerCase()] = parseInt(value);
  }
  
  // If no specific speeds found, try to extract a single walk speed
  if (Object.keys(speeds).length === 0) {
    const simpleMatch = speedText.match(/(\d+)/);
    if (simpleMatch) {
      speeds.walk = parseInt(simpleMatch[1]);
    }
  }
  
  return speeds;
}

export function parseComponents(componentsText: string | undefined): {
  verbal: boolean;
  somatic: boolean;
  material: boolean;
  material_description?: string;
} {
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

// Ability score calculations
export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

// CR to XP conversion
export const XP_BY_CR: Record<number, number> = {
  0: 10,
  0.125: 25,
  0.25: 50,
  0.5: 100,
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
  30: 155000,
};

export function calculateXPFromCR(cr: number | string): number {
  const numCR = typeof cr === 'string' ? parseFloat(cr) : cr;
  return XP_BY_CR[numCR] || 0;
}

// Encounter multipliers
export const ENCOUNTER_MULTIPLIERS: Record<number, number> = {
  1: 1,
  2: 1.5,
  3: 2,
  4: 2,
  5: 2.5,
  6: 2.5,
  7: 3,
  8: 3,
  9: 3,
  10: 3,
  11: 4,
  12: 4,
  13: 4,
  14: 4,
  15: 4,
};

export function getEncounterMultiplier(creatureCount: number): number {
  if (creatureCount <= 1) return 1;
  if (creatureCount <= 2) return 1.5;
  if (creatureCount <= 6) return 2;
  if (creatureCount <= 10) return 2.5;
  if (creatureCount <= 14) return 3;
  return 4;
}

// Validation utilities
export function validateCR(cr: number | string): boolean {
  const numCR = typeof cr === 'string' ? parseFloat(cr) : cr;
  return !isNaN(numCR) && numCR >= 0 && numCR <= 30;
}

export function validateAbilityScore(score: number): boolean {
  return !isNaN(score) && score >= 1 && score <= 30;
}

export function validateXP(xp: number): boolean {
  return !isNaN(xp) && xp >= 0;
}

/**
 * Parses cost text into structured format
 */
export function parseCost(costText: string | undefined): { quantity: number; unit: string } | undefined {
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

/**
 * Parses damage text into structured format
 */
export function parseDamage(damageText: string | undefined): { dice: string; type: string } | undefined {
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

/**
 * Parses armor class text into structured format
 */
export function parseArmorClass(acText: string | undefined): { base: number; dex_bonus: boolean; max_bonus?: number } | undefined {
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
