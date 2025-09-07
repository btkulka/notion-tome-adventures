import { 
  CreatureDTO, 
  EnvironmentDTO, 
  EncounterDTO
} from '@/types/notion-dtos';

import {
  extractText,
  extractNumber,
  extractSelect,
  extractMultiSelect,
  parseStringArray,
  calculateXPFromCR
} from '@/lib/property-parsing';

// Utility functions for working with DTOs

export class NotionDTOMapper {
  /**
   * Maps raw Notion page data to CreatureDTO
   */
  static mapToCreatureDTO(notionPage: any): CreatureDTO {
    const props = notionPage.properties;
    
    return {
      // Base properties
      id: notionPage.id,
      created_time: notionPage.created_time,
      last_edited_time: notionPage.last_edited_time,
      url: notionPage.url,
      
      // Creature specific properties
      name: extractText(props.Name) || '',
      size: extractSelect(props.Size) as any || 'Medium',
      type: extractSelect(props.Type) || '',
      subtype: extractText(props.Subtype),
      alignment: extractSelect(props.Alignment) || '',
      armor_class: extractNumber(props.ArmorClass) || 10,
      hit_points: extractNumber(props.HitPoints) || 1,
      speed: {
        walk: extractNumber(props.Speed) || 30
      },
      challenge_rating: extractNumber(props.ChallengeRating) || 0,
      xp_value: extractNumber(props.XPValue) || calculateXPFromCR(extractNumber(props.ChallengeRating) || 0),
      environment: extractMultiSelect(props.Environment),
      languages: parseStringArray(extractText(props.Languages)),
      source: extractSelect(props.Source) || '',
    };
  }

  /**
   * Maps raw Notion page data to EnvironmentDTO
   */
  static mapToEnvironmentDTO(notionPage: any): EnvironmentDTO {
    const props = notionPage.properties;
    
    return {
      // Base properties
      id: notionPage.id,
      created_time: notionPage.created_time,
      last_edited_time: notionPage.last_edited_time,
      url: notionPage.url,
      
      // Environment specific properties
      name: extractText(props.Name) || '',
      description: extractText(props.Description) || '',
      terrain_type: extractMultiSelect(props.TerrainType),
      climate: extractSelect(props.Climate) || '',
      hazards: extractMultiSelect(props.Hazards),
      common_creatures: extractMultiSelect(props.CommonCreatures),
      survival_dc: extractNumber(props.SurvivalDC),
      foraging_dc: extractNumber(props.ForagingDC),
      navigation_dc: extractNumber(props.NavigationDC),
    };
  }
}