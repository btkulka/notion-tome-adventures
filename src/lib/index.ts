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

// Property parsing utilities
export {
  extractText,
  extractNumber,
  extractSelect,
  extractMultiSelect,
  extractCheckbox,
  extractDate,
  extractRelation,
  extractUrl,
  extractEmail,
  extractPhoneNumber,
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
  validateXP
} from './property-parsing';

// Re-export commonly used components
export { NotionDTOMapper } from './notion-dto-mapper';
