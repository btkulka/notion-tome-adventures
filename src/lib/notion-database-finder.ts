// Utility to help find your Notion databases
// Since we can't directly search for databases via the API in this environment,
// you'll need to provide your database IDs manually.

export interface DatabaseInfo {
  id: string;
  name: string;
  description: string;
}

// Please replace these with your actual Notion database IDs
export const NOTION_DATABASE_IDS = {
  // Add your database IDs here like:
  // CREATURES: 'your-creatures-database-id-here',
  // SPELLS: 'your-spells-database-id-here', 
  // ITEMS: 'your-items-database-id-here',
  // ENVIRONMENTS: 'your-environments-database-id-here',
  // ENCOUNTERS: 'your-encounters-database-id-here',
};

// Instructions for finding your database IDs:
/*
1. Open each database in Notion
2. Look at the URL - it will look like:
   https://www.notion.so/your-workspace/Database-Name-32charDatabaseId?v=viewId
3. Copy the 32-character string (the database ID)
4. Add it to the NOTION_DATABASE_IDS object above

Example:
If your URL is: https://www.notion.so/myworkspace/Creatures-a1b2c3d4e5f6789012345678901234567?v=someview
Then your database ID is: a1b2c3d4e5f6789012345678901234567
*/

export const expectedDatabases: DatabaseInfo[] = [
  {
    id: 'CREATURES',
    name: 'Creatures/Monsters',
    description: 'Database containing D&D creatures with stats, CR, environment, etc.'
  },
  {
    id: 'SPELLS',
    name: 'Spells',
    description: 'Database containing D&D spells with level, school, components, etc.'
  },
  {
    id: 'ITEMS',
    name: 'Items/Equipment',
    description: 'Database containing D&D items, weapons, armor, magic items, etc.'
  },
  {
    id: 'ENVIRONMENTS',
    name: 'Environments',
    description: 'Database containing different environments/terrains for encounters'
  },
  {
    id: 'ENCOUNTERS',
    name: 'Generated Encounters',
    description: 'Database to store generated encounters for future reference'
  }
];