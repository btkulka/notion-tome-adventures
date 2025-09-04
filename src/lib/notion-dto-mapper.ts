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
      name: this.extractText(props.Name) || '',
      size: this.extractSelect(props.Size) as any || 'Medium',
      type: this.extractSelect(props.Type) || '',
      subtype: this.extractText(props.Subtype),
      alignment: this.extractSelect(props.Alignment) || '',
      armor_class: this.extractNumber(props.ArmorClass) || 10,
      armor_description: this.extractText(props.ArmorDescription),
      hit_points: this.extractNumber(props.HitPoints) || 1,
      hit_dice: this.extractText(props.HitDice) || '1d4',
      speed: this.parseSpeed(this.extractText(props.Speed)),
      ability_scores: {
        strength: this.extractNumber(props.Strength) || 10,
        dexterity: this.extractNumber(props.Dexterity) || 10,
        constitution: this.extractNumber(props.Constitution) || 10,
        intelligence: this.extractNumber(props.Intelligence) || 10,
        wisdom: this.extractNumber(props.Wisdom) || 10,
        charisma: this.extractNumber(props.Charisma) || 10,
      },
      saving_throws: this.parseKeyValuePairs(this.extractText(props.SavingThrows)),
      skills: this.parseKeyValuePairs(this.extractText(props.Skills)),
      damage_resistances: this.extractMultiSelect(props.DamageResistances),
      damage_immunities: this.extractMultiSelect(props.DamageImmunities),
      damage_vulnerabilities: this.extractMultiSelect(props.DamageVulnerabilities),
      condition_immunities: this.extractMultiSelect(props.ConditionImmunities),
      senses: this.parseStringArray(this.extractText(props.Senses)),
      languages: this.parseStringArray(this.extractText(props.Languages)),
      challenge_rating: this.extractNumber(props.ChallengeRating) || 0,
      xp_value: this.extractNumber(props.XPValue) || 0,
      proficiency_bonus: this.extractNumber(props.ProficiencyBonus) || 2,
      environment: this.extractMultiSelect(props.Environment),
      source: this.extractSelect(props.Source) || '',
      page_number: this.extractNumber(props.PageNumber),
      legendary_actions: this.extractNumber(props.LegendaryActions),
      actions: this.extractText(props.Actions),
      legendary_actions_description: this.extractText(props.LegendaryActionsDescription),
      special_abilities: this.extractText(props.SpecialAbilities),
      spellcasting: this.extractText(props.Spellcasting),
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
      name: this.extractText(props.Name) || '',
      level: this.extractNumber(props.Level) || 0,
      school: this.extractSelect(props.School) as any || 'Evocation',
      casting_time: this.extractText(props.CastingTime) || '',
      range: this.extractText(props.Range) || '',
      components: this.parseComponents(this.extractText(props.Components)),
      duration: this.extractText(props.Duration) || '',
      concentration: this.extractCheckbox(props.Concentration),
      ritual: this.extractCheckbox(props.Ritual),
      description: this.extractText(props.Description) || '',
      at_higher_levels: this.extractText(props.AtHigherLevels),
      classes: this.extractMultiSelect(props.Classes),
      source: this.extractSelect(props.Source) || '',
      page_number: this.extractNumber(props.PageNumber),
      damage_type: this.extractSelect(props.DamageType),
      save_type: this.extractSelect(props.SaveType),
      attack_type: this.extractSelect(props.AttackType) as any,
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
      name: this.extractText(props.Name) || '',
      type: this.extractSelect(props.Type) as any || 'Adventuring Gear',
      subtype: this.extractSelect(props.Subtype),
      rarity: this.extractSelect(props.Rarity) as any || 'Common',
      description: this.extractText(props.Description) || '',
      weight: this.extractNumber(props.Weight),
      cost: this.parseCost(this.extractText(props.Cost)),
      source: this.extractSelect(props.Source) || '',
      page_number: this.extractNumber(props.PageNumber),
      damage: this.parseDamage(this.extractText(props.Damage)),
      properties: this.extractMultiSelect(props.Properties),
      weapon_category: this.extractSelect(props.WeaponCategory) as any,
      weapon_type: this.extractSelect(props.WeaponType) as any,
      armor_class: this.parseArmorClass(this.extractText(props.ArmorClass)),
      strength_requirement: this.extractNumber(props.StrengthRequirement),
      stealth_disadvantage: this.extractCheckbox(props.StealthDisadvantage),
      armor_category: this.extractSelect(props.ArmorCategory) as any,
      attunement_required: this.extractCheckbox(props.AttunementRequired),
      charges: this.extractNumber(props.Charges),
      recharge: this.extractText(props.Recharge),
      magic_bonus: this.extractNumber(props.MagicBonus),
      spell_save_dc: this.extractNumber(props.SpellSaveDC),
      spell_attack_bonus: this.extractNumber(props.SpellAttackBonus),
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
      name: this.extractText(props.Name) || '',
      description: this.extractText(props.Description) || '',
      terrain_type: this.extractMultiSelect(props.TerrainType),
      climate: this.extractSelect(props.Climate) || '',
      hazards: this.extractMultiSelect(props.Hazards),
      common_creatures: this.extractMultiSelect(props.CommonCreatures),
      typical_encounters: this.extractText(props.TypicalEncounters),
      travel_pace_modifier: this.extractNumber(props.TravelPaceModifier),
      survival_dc: this.extractNumber(props.SurvivalDC),
      foraging_dc: this.extractNumber(props.ForagingDC),
      navigation_dc: this.extractNumber(props.NavigationDC),
      shelter_availability: this.extractSelect(props.ShelterAvailability) as any || 'Common',
      water_availability: this.extractSelect(props.WaterAvailability) as any || 'Common',
      food_availability: this.extractSelect(props.FoodAvailability) as any || 'Common',
    };
  }

  // Helper methods for extracting data from Notion properties
  private static extractText(property: any): string | undefined {
    if (!property) return undefined;
    
    if (property.title?.length > 0) {
      return property.title[0].plain_text;
    }
    if (property.rich_text?.length > 0) {
      return property.rich_text[0].plain_text;
    }
    return undefined;
  }

  private static extractNumber(property: any): number | undefined {
    return property?.number;
  }

  private static extractSelect(property: any): string | undefined {
    return property?.select?.name;
  }

  private static extractMultiSelect(property: any): string[] {
    return property?.multi_select?.map((item: any) => item.name) || [];
  }

  private static extractCheckbox(property: any): boolean {
    return property?.checkbox || false;
  }

  private static parseSpeed(speedText: string | undefined): Record<string, number> {
    if (!speedText) return {};
    
    const speed: Record<string, number> = {};
    const regex = /(\w+)\s+(\d+)\s*ft/g;
    let match;
    
    while ((match = regex.exec(speedText)) !== null) {
      const [, type, value] = match;
      speed[type.toLowerCase()] = parseInt(value);
    }
    
    return speed;
  }

  private static parseKeyValuePairs(text: string | undefined): Record<string, number> | undefined {
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

  private static parseStringArray(text: string | undefined): string[] | undefined {
    if (!text) return undefined;
    
    return text.split(',').map(item => item.trim()).filter(Boolean);
  }

  private static parseComponents(componentsText: string | undefined): any {
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

  private static parseCost(costText: string | undefined): any {
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

  private static parseDamage(damageText: string | undefined): any {
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

  private static parseArmorClass(acText: string | undefined): any {
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