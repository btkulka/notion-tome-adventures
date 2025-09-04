import { 
  CreatureDTO, 
  SpellDTO, 
  ItemDTO, 
  EnvironmentDTO, 
  EncounterDTO 
} from '@/types/notion-dtos';

// Mock data service - replace with actual Notion API calls when databases are configured
export class NotionService {
  // Fetch all creatures from Notion
  static async getCreatures(): Promise<CreatureDTO[]> {
    // Mock data - replace with actual Notion API integration
    return [
      {
        id: '1',
        name: 'Goblin',
        size: 'Small',
        type: 'humanoid',
        alignment: 'neutral evil',
        armor_class: 15,
        hit_points: 7,
        hit_dice: '2d6',
        speed: { walk: 30 },
        ability_scores: {
          strength: 8,
          dexterity: 14,
          constitution: 10,
          intelligence: 10,
          wisdom: 8,
          charisma: 8,
        },
        challenge_rating: 0.25,
        xp_value: 50,
        proficiency_bonus: 2,
        environment: ['forest', 'mountain'],
        source: 'Monster Manual',
        page_number: 166,
        created_time: new Date().toISOString(),
        last_edited_time: new Date().toISOString(),
        created_by: 'system',
        last_edited_by: 'system',
        parent: 'creatures-db',
        archived: false,
        url: 'https://notion.so/goblin',
      },
    ] as CreatureDTO[];
  }

  // Fetch creatures by environment
  static async getCreaturesByEnvironment(environment: string): Promise<CreatureDTO[]> {
    const allCreatures = await this.getCreatures();
    return allCreatures.filter(creature => 
      creature.environment.includes(environment.toLowerCase())
    );
  }

  // Fetch all environments
  static async getEnvironments(): Promise<EnvironmentDTO[]> {
    return [
      { 
        id: '1', 
        name: 'Forest', 
        description: 'Dense woodlands with tall trees and undergrowth',
        terrain_type: ['Forest'],
        climate: 'Temperate',
        common_creatures: ['Goblin', 'Wolf', 'Brown Bear'],
        shelter_availability: 'Common',
        water_availability: 'Common',
        food_availability: 'Common',
        created_time: new Date().toISOString(),
        last_edited_time: new Date().toISOString(),
        created_by: 'system',
        last_edited_by: 'system',
        parent: 'environments-db',
        archived: false,
        url: 'https://notion.so/forest',
      },
    ] as EnvironmentDTO[];
  }

  // Save an encounter to Notion
  static async saveEncounter(encounter: EncounterDTO): Promise<string | null> {
    // Mock implementation - log the encounter for now
    console.log('Saving encounter to Notion:', encounter);
    
    // Return a mock ID
    return `encounter_${Date.now()}`;
  }

  // Fetch all encounters
  static async getEncounters(): Promise<EncounterDTO[]> {
    // Mock data for now
    return [];
  }

  // Fetch all spells
  static async getSpells(): Promise<SpellDTO[]> {
    return [
      {
        id: '1',
        name: 'Fireball',
        level: 3,
        school: 'Evocation',
        casting_time: '1 action',
        range: '150 feet',
        components: {
          verbal: true,
          somatic: true,
          material: true,
          material_description: 'a tiny ball of bat guano and sulfur',
        },
        duration: 'Instantaneous',
        concentration: false,
        ritual: false,
        description: 'A bright streak flashes from your pointing finger...',
        classes: ['Sorcerer', 'Wizard'],
        source: 'Player\'s Handbook',
        damage_type: 'Fire',
        created_time: new Date().toISOString(),
        last_edited_time: new Date().toISOString(),
        created_by: 'system',
        last_edited_by: 'system',
        parent: 'spells-db',
        archived: false,
        url: 'https://notion.so/fireball',
      },
    ] as SpellDTO[];
  }

  // Fetch all items
  static async getItems(): Promise<ItemDTO[]> {
    return [
      {
        id: '1',
        name: 'Longsword',
        type: 'Weapon',
        subtype: 'Sword',
        rarity: 'Common',
        description: 'A versatile martial weapon.',
        weight: 3,
        cost: { quantity: 15, unit: 'gp' },
        source: 'Player\'s Handbook',
        damage: { dice: '1d8', type: 'slashing' },
        properties: ['Versatile'],
        weapon_category: 'Martial',
        weapon_type: 'Melee',
        created_time: new Date().toISOString(),
        last_edited_time: new Date().toISOString(),
        created_by: 'system',
        last_edited_by: 'system',
        parent: 'items-db',
        archived: false,
        url: 'https://notion.so/longsword',
      },
    ] as ItemDTO[];
  }
}

// Instructions for setting up Notion integration:
/*
To connect to your actual Notion databases:

1. Create databases in Notion with the properties defined in the DTOs:
   - Creatures Database 
   - Spells Database
   - Items Database
   - Environments Database
   - Encounters Database

2. Get your database IDs from the URLs
3. Replace the mock implementations above with actual Notion API calls
4. Use the NotionDTOMapper to convert raw Notion data to typed DTOs
*/