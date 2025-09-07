import { 
  CreatureDTO, 
  SpellDTO, 
  ItemDTO, 
  EnvironmentDTO, 
  EncounterDTO,
  NPCDTO,
  LocationDTO,
  SessionLogDTO 
} from '@/types/notion-dtos';

import {
  extractText,
  extractNumber,
  extractSelect,
  extractMultiSelect,
  extractCheckbox,
  extractDate,
  extractRelation,
  parseSpeed,
  parseKeyValuePairs,
  parseStringArray,
  parseComponents,
  calculateXPFromCR,
  parseCost,
  parseDamage,
  parseArmorClass
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
      created_by: notionPage.created_by?.id || '',
      last_edited_by: notionPage.last_edited_by?.id || '',
      cover: notionPage.cover?.external?.url || notionPage.cover?.file?.url,
      icon: notionPage.icon?.emoji || notionPage.icon?.external?.url || notionPage.icon?.file?.url,
      parent: notionPage.parent?.database_id || '',
      archived: notionPage.archived,
      url: notionPage.url,
      
      // Creature specific properties
      name: extractText(props.Name) || '',
      size: extractSelect(props.Size) as any || 'Medium',
      type: extractSelect(props.Type) || '',
      subtype: extractText(props.Subtype),
      alignment: extractSelect(props.Alignment) || '',
      armor_class: extractNumber(props.ArmorClass) || 10,
      armor_description: extractText(props.ArmorDescription),
      hit_points: extractNumber(props.HitPoints) || 1,
      hit_dice: extractText(props.HitDice) || '1d4',
      speed: parseSpeed(extractText(props.Speed)),
      ability_scores: {
        strength: extractNumber(props.Strength) || 10,
        dexterity: extractNumber(props.Dexterity) || 10,
        constitution: extractNumber(props.Constitution) || 10,
        intelligence: extractNumber(props.Intelligence) || 10,
        wisdom: extractNumber(props.Wisdom) || 10,
        charisma: extractNumber(props.Charisma) || 10,
      },
      saving_throws: parseKeyValuePairs(extractText(props.SavingThrows)),
      skills: parseKeyValuePairs(extractText(props.Skills)),
      damage_resistances: extractMultiSelect(props.DamageResistances),
      damage_immunities: extractMultiSelect(props.DamageImmunities),
      damage_vulnerabilities: extractMultiSelect(props.DamageVulnerabilities),
      condition_immunities: extractMultiSelect(props.ConditionImmunities),
      senses: parseStringArray(extractText(props.Senses)),
      languages: parseStringArray(extractText(props.Languages)),
      challenge_rating: extractNumber(props.ChallengeRating) || 0,
      xp_value: extractNumber(props.XPValue) || calculateXPFromCR(extractNumber(props.ChallengeRating) || 0),
      proficiency_bonus: extractNumber(props.ProficiencyBonus) || 2,
      environment: extractMultiSelect(props.Environment),
      source: extractSelect(props.Source) || '',
      page_number: extractNumber(props.PageNumber),
      legendary_actions: extractNumber(props.LegendaryActions),
      actions: extractText(props.Actions),
      legendary_actions_description: extractText(props.LegendaryActionsDescription),
      special_abilities: extractText(props.SpecialAbilities),
      spellcasting: extractText(props.Spellcasting),
    };
  }

  /**
   * Maps raw Notion page data to SpellDTO
   */
  static mapToSpellDTO(notionPage: any): SpellDTO {
    const props = notionPage.properties;
    
    return {
      // Base properties
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
      
      // Spell specific properties
      name: extractText(props.Name) || '',
      level: extractNumber(props.Level) || 0,
      school: extractSelect(props.School) as any || 'Evocation',
      casting_time: extractText(props.CastingTime) || '',
      range: extractText(props.Range) || '',
      components: parseComponents(extractText(props.Components)),
      duration: extractText(props.Duration) || '',
      concentration: extractCheckbox(props.Concentration),
      ritual: extractCheckbox(props.Ritual),
      description: extractText(props.Description) || '',
      at_higher_levels: extractText(props.AtHigherLevels),
      classes: extractMultiSelect(props.Classes),
      source: extractSelect(props.Source) || '',
      page_number: extractNumber(props.PageNumber),
      damage_type: extractSelect(props.DamageType),
      save_type: extractSelect(props.SaveType),
      attack_type: extractSelect(props.AttackType) as any,
    };
  }

  /**
   * Maps raw Notion page data to ItemDTO
   */
  static mapToItemDTO(notionPage: any): ItemDTO {
    const props = notionPage.properties;
    
    return {
      // Base properties
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
      
      // Item specific properties
      name: extractText(props.Name) || '',
      type: extractSelect(props.Type) as any || 'Adventuring Gear',
      subtype: extractSelect(props.Subtype),
      rarity: extractSelect(props.Rarity) as any || 'Common',
      description: extractText(props.Description) || '',
      weight: extractNumber(props.Weight),
      cost: parseCost(extractText(props.Cost)),
      source: extractSelect(props.Source) || '',
      page_number: extractNumber(props.PageNumber),
      damage: parseDamage(extractText(props.Damage)),
      properties: extractMultiSelect(props.Properties),
      weapon_category: extractSelect(props.WeaponCategory) as any,
      weapon_type: extractSelect(props.WeaponType) as any,
      armor_class: parseArmorClass(extractText(props.ArmorClass)),
      strength_requirement: extractNumber(props.StrengthRequirement),
      stealth_disadvantage: extractCheckbox(props.StealthDisadvantage),
      armor_category: extractSelect(props.ArmorCategory) as any,
      attunement_required: extractCheckbox(props.AttunementRequired),
      charges: extractNumber(props.Charges),
      recharge: extractText(props.Recharge),
      magic_bonus: extractNumber(props.MagicBonus),
      spell_save_dc: extractNumber(props.SpellSaveDC),
      spell_attack_bonus: extractNumber(props.SpellAttackBonus),
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
      created_by: notionPage.created_by?.id || '',
      last_edited_by: notionPage.last_edited_by?.id || '',
      cover: notionPage.cover?.external?.url || notionPage.cover?.file?.url,
      icon: notionPage.icon?.emoji || notionPage.icon?.external?.url || notionPage.icon?.file?.url,
      parent: notionPage.parent?.database_id || '',
      archived: notionPage.archived,
      url: notionPage.url,
      
      // Environment specific properties
      name: extractText(props.Name) || '',
      description: extractText(props.Description) || '',
      terrain_type: extractMultiSelect(props.TerrainType),
      climate: extractSelect(props.Climate) || '',
      hazards: extractMultiSelect(props.Hazards),
      common_creatures: extractMultiSelect(props.CommonCreatures),
      typical_encounters: extractText(props.TypicalEncounters),
      travel_pace_modifier: extractNumber(props.TravelPaceModifier),
      survival_dc: extractNumber(props.SurvivalDC),
      foraging_dc: extractNumber(props.ForagingDC),
      navigation_dc: extractNumber(props.NavigationDC),
      shelter_availability: extractSelect(props.ShelterAvailability) as any || 'Common',
      water_availability: extractSelect(props.WaterAvailability) as any || 'Common',
      food_availability: extractSelect(props.FoodAvailability) as any || 'Common',
    };
  }
}