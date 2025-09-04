import { Client } from '@notionhq/client';

export interface NotionCreature {
  id: string;
  name: string;
  type: string;
  challenge_rating: number;
  armor_class: number;
  hit_points: number;
  environment: string[];
  alignment: string;
  size: string;
}

export interface NotionEnvironment {
  id: string;
  name: string;
  description: string;
}

export interface NotionEncounter {
  id?: string;
  name: string;
  environment: string;
  total_xp: number;
  creatures: Array<{
    creature_name: string;
    quantity: number;
  }>;
  generation_log: string[];
  created_at: string;
}

// Mock data for now - you'll replace these with actual Notion API calls
export class NotionService {
  // Fetch all creatures from Notion
  static async getCreatures(): Promise<NotionCreature[]> {
    // For now, return mock data until you set up your Notion databases
    return [
      {
        id: '1',
        name: 'Goblin',
        type: 'humanoid',
        challenge_rating: 0.25,
        armor_class: 15,
        hit_points: 7,
        environment: ['forest', 'mountain'],
        alignment: 'neutral evil',
        size: 'small',
      },
      {
        id: '2',
        name: 'Orc',
        type: 'humanoid',
        challenge_rating: 0.5,
        armor_class: 13,
        hit_points: 15,
        environment: ['mountain', 'underdark'],
        alignment: 'chaotic evil',
        size: 'medium',
      },
      {
        id: '3',
        name: 'Brown Bear',
        type: 'beast',
        challenge_rating: 1,
        armor_class: 11,
        hit_points: 34,
        environment: ['forest'],
        alignment: 'unaligned',
        size: 'large',
      },
    ];
  }

  // Fetch creatures by environment
  static async getCreaturesByEnvironment(environment: string): Promise<NotionCreature[]> {
    const allCreatures = await this.getCreatures();
    return allCreatures.filter(creature => 
      creature.environment.includes(environment.toLowerCase())
    );
  }

  // Fetch all environments
  static async getEnvironments(): Promise<NotionEnvironment[]> {
    return [
      { id: '1', name: 'Forest', description: 'Dense woodlands with tall trees and undergrowth' },
      { id: '2', name: 'Mountain', description: 'Rocky peaks and highland terrain' },
      { id: '3', name: 'Desert', description: 'Arid wasteland with sand dunes and sparse vegetation' },
      { id: '4', name: 'Swamp', description: 'Marshy wetlands with murky water and thick vegetation' },
      { id: '5', name: 'Underdark', description: 'Deep underground caverns and tunnels' },
    ];
  }

  // Save an encounter to Notion
  static async saveEncounter(encounter: NotionEncounter): Promise<string | null> {
    // Mock implementation - log the encounter for now
    console.log('Saving encounter to Notion:', encounter);
    
    // Return a mock ID
    return `encounter_${Date.now()}`;
  }

  // Fetch all encounters
  static async getEncounters(): Promise<NotionEncounter[]> {
    // Mock data for now
    return [];
  }
}

// Instructions for setting up Notion integration:
/*
To connect to your actual Notion databases:

1. Create three databases in Notion:
   - Creatures Database with properties:
     * Name (title)
     * Type (select)
     * ChallengeRating (number)
     * ArmorClass (number)
     * HitPoints (number)
     * Environment (multi-select)
     * Alignment (select)
     * Size (select)
   
   - Environments Database with properties:
     * Name (title)
     * Description (rich text)
   
   - Encounters Database with properties:
     * Name (title)
     * Environment (select)
     * TotalXP (number)
     * Creatures (rich text)
     * GenerationLog (rich text)
     * CreatedAt (date)

2. Get your database IDs from the URLs
3. Replace the mock implementations above with actual Notion API calls
4. Initialize the Notion client with your API key from environment variables
*/