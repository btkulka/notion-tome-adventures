import { callEdgeFunction } from '@/lib/supabase-client'
import { NotionDatabase, DatabaseMatch, DatabaseSchema } from './useNotionDiscovery'
import { NotionEncounterParams, GeneratedEncounter } from '@/types/encounter'

export interface NotionCreature {
  id: string
  name: string
  size: string
  type: string
  armor_class: number
  hit_points: number
  challenge_rating: string
  environment: string[]
  alignment?: string
}

export interface NotionEnvironment {
  id: string
  name: string
  description: string
  terrain_type: string[]
  climate: string
}

export interface NotionSession {
  id: string
  name: string
  date?: string
  description?: string
  campaignRelation?: string
  playerRelations?: string[]
  encounterRelations?: string[]
}

export interface NotionCampaign {
  id: string
  name: string
  description?: string
  active: boolean
  sessionRelations?: string[]
  coverArt?: string
}

export interface CreatureFilters {
  environment?: string
  minCR?: string
  maxCR?: string
  creatureType?: string
  alignment?: string
  size?: string
}

export interface EdgeFunctionResult<T> {
  success: boolean
  data?: T
  error?: string
}

// Simplified service - NO SHARED STATE, just functions
export const useNotionService = () => {
  const discoverDatabases = async (): Promise<EdgeFunctionResult<{ databases: NotionDatabase[], matches: DatabaseMatch[] }>> => {
    try {
      const result = await callEdgeFunction('discover-notion-databases');
      return { success: true, data: result };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to discover databases'
      };
    }
  };

  const getSchema = async (databaseId: string): Promise<EdgeFunctionResult<DatabaseSchema>> => {
    try {
      const result = await callEdgeFunction('get-notion-schema', { databaseId });
      return { success: true, data: result };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to get schema'
      };
    }
  };

  const fetchCreatures = async (filters?: CreatureFilters): Promise<EdgeFunctionResult<{ creatures: NotionCreature[] }>> => {
    try {
      const result = await callEdgeFunction('fetch-creatures', filters);
      return { success: true, data: result };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to fetch creatures'
      };
    }
  };

  const fetchEnvironments = async (): Promise<EdgeFunctionResult<{ environments: NotionEnvironment[] }>> => {
    try {
      const result = await callEdgeFunction('fetch-environments');
      return { success: true, data: result };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to fetch environments'
      };
    }
  };

  const fetchSessions = async (searchQuery?: string, campaignId?: string): Promise<EdgeFunctionResult<{ sessions: NotionSession[] }>> => {
    try {
      const result = await callEdgeFunction('fetch-sessions', { searchQuery, campaignId });
      return { success: true, data: result };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to fetch sessions'
      };
    }
  };

  const fetchCampaigns = async (searchQuery?: string, activeOnly?: boolean): Promise<EdgeFunctionResult<{ campaigns: NotionCampaign[] }>> => {
    try {
      const result = await callEdgeFunction('fetch-campaigns', { searchQuery, activeOnly });
      return { success: true, data: result };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to fetch campaigns'
      };
    }
  };

  const generateEncounter = async (params: NotionEncounterParams, signal?: AbortSignal): Promise<EdgeFunctionResult<any>> => {
    try {
      if (signal?.aborted) {
        throw new DOMException('Operation was aborted', 'AbortError');
      }
      
      const result = await callEdgeFunction('generate-encounter', params, signal);
      
      if (signal?.aborted) {
        throw new DOMException('Operation was aborted', 'AbortError');
      }
      
      return { success: true, data: result };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { success: false, error: 'Operation was aborted' };
      }
      if (err instanceof Error && err.message.includes('aborted')) {
        return { success: false, error: 'Operation was aborted' };
      }
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to generate encounter'
      };
    }
  };

  const saveEncounter = async (encounter: GeneratedEncounter): Promise<EdgeFunctionResult<{ pageUrl: string }>> => {
    try {
      const result = await callEdgeFunction('save-encounter', { encounter });
      return { success: true, data: result };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to save encounter'
      };
    }
  };

  const debugEnvironments = async (): Promise<EdgeFunctionResult<any>> => {
    try {
      const result = await callEdgeFunction('debug-environments');
      return { success: true, data: result };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to debug environments'
      };
    }
  };

  const simpleDebug = async (): Promise<EdgeFunctionResult<any>> => {
    try {
      const result = await callEdgeFunction('simple-debug');
      return { success: true, data: result };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to debug'
      };
    }
  };

  return {
    discoverDatabases,
    getSchema,
    fetchCreatures,
    fetchEnvironments,
    fetchSessions,
    fetchCampaigns,
    generateEncounter,
    saveEncounter,
    debugEnvironments,
    simpleDebug,
  };
};
