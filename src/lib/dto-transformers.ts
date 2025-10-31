/**
 * Frontend Transformation Layer
 * Transforms DTOs into display-friendly formats
 */

import { CreatureDTO, EnvironmentDTO, SessionDTO, MagicItemDTO } from '@/types/notion-dtos'

/**
 * Formats CR for display (handles fractions)
 */
export function formatCR(cr: string): string {
  if (cr === '0.125') return '1/8'
  if (cr === '0.25') return '1/4'
  if (cr === '0.5') return '1/2'
  return cr
}

/**
 * Formats numbers with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * Transforms CreatureDTO for display
 */
export function creatureToDisplay(dto: CreatureDTO) {
  return {
    ...dto,
    crDisplay: formatCR(dto.cr),
    xpDisplay: formatNumber(dto.xp),
    acDisplay: `AC ${dto.ac}`,
    hpDisplay: `${dto.hp} HP`,
    environmentDisplay: dto.environment.join(', ') || 'Any',
  }
}

/**
 * Transforms EnvironmentDTO for display
 */
export function environmentToDisplay(dto: EnvironmentDTO) {
  return {
    ...dto,
    terrainDisplay: dto.terrain_type.join(', ') || 'Unknown',
    hazardsDisplay: dto.hazards.join(', ') || 'None',
    creaturesDisplay: dto.common_creatures.join(', ') || 'None',
    dcSummary: `Survival: ${dto.survival_dc}, Foraging: ${dto.foraging_dc}, Navigation: ${dto.navigation_dc}`,
  }
}

/**
 * Transforms SessionDTO for display
 */
export function sessionToDisplay(dto: SessionDTO) {
  return {
    ...dto,
    dateDisplay: dto.date ? new Date(dto.date).toLocaleDateString() : 'No date set',
    descriptionPreview: dto.description.length > 100
      ? dto.description.substring(0, 100) + '...'
      : dto.description,
  }
}

/**
 * Transforms MagicItemDTO for display
 */
export function magicItemToDisplay(dto: MagicItemDTO) {
  return {
    ...dto,
    rarityDisplay: dto.rarity || 'Unknown',
    valueDisplay: dto.value ? `${formatNumber(dto.value)} gp` : 'Unknown',
    tagsDisplay: dto.tags?.join(', ') || 'None',
    classRestrictionDisplay: dto.classRestriction?.join(', ') || 'None',
    attunementDisplay: dto.attunement ? 'Requires Attunement' : 'No Attunement',
    typeDisplay: [
      dto.consumable && 'Consumable',
      dto.wondrous && 'Wondrous Item',
    ].filter(Boolean).join(', ') || 'Magic Item',
  }
}
