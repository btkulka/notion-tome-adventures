/**
 * Centralized exports for commonly used utilities
 * Provides convenient access to refactored components and utilities
 */

// Icon utilities
export {
  getEnvironmentIcon,
  getAlignmentIcon,
  getCreatureTypeIcon,
  getSizeIcon,
  getDnDIcon,
  getAvailableIcons,
  type DnDEntityType
} from './icon-mappings';

// Property parsing utilities (D&D-specific)
export {
  parseStringArray,
  parseKeyValuePairs,
  parseSpeed,
  parseComponents,
  calculateModifier,
  formatModifier,
  XP_BY_CR,
  calculateXPFromCR,
  ENCOUNTER_MULTIPLIERS,
  getEncounterMultiplier,
  validateCR,
  validateAbilityScore,
  validateXP,
  parseCost,
  parseDamage,
  parseArmorClass
} from './property-parsing';

// DTO transformers for display
export {
  formatCR,
  formatNumber,
  creatureToDisplay,
  environmentToDisplay,
  sessionToDisplay
} from './dto-transformers';
