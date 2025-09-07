import { callEdgeFunction } from '@/lib/supabase-client';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useState } from 'react';

// Types
export interface NotionDatabase {
  id: string;
  title: string;
  url: string;
}

export interface DatabaseMatch {
  expectedName: string;
  matched?: NotionDatabase;
  suggestions: NotionDatabase[];
}

export interface DatabaseSchema {
  id: string;
  title: string;
  properties: Array<{
    id: string;
    name: string;
    type: string;
  }>;
}

export interface NotionCreature {
  id: string;
  name: string;
  size: string;
  type: string;
  armor_class: number;
  hit_points: number;
  challenge_rating: string;
  environment: string[];
  alignment?: string;
}

export interface NotionEnvironment {
  id: string;
  name: string;
  description: string;
  terrain_type: string[];
  climate: string;
}

export interface CreatureFilters {
  environment?: string;
  minCR?: string;
  maxCR?: string;
  creatureType?: string;
  alignment?: string;
  size?: string;
}

// Base service class with error handling
class BaseNotionService {
  protected errorHandler = useErrorHandler();

  protected async callFunction<T>(
    functionName: string,
    params?: any,
    operationName?: string
  ): Promise<T> {
    return this.errorHandler.executeWithErrorHandling(
      () => callEdgeFunction(functionName, params),
      operationName || functionName
    );
  }

  get loading() {
    return this.errorHandler.isLoading;
  }

  get error() {
    return this.errorHandler.error;
  }

  clearError() {
    this.errorHandler.clearError();
  }
}

// Discovery service
export class NotionDiscoveryService extends BaseNotionService {
  async discoverDatabases(): Promise<{ allDatabases: NotionDatabase[]; matches: DatabaseMatch[] }> {
    return this.callFunction('discover-notion-databases', undefined, 'discover databases');
  }

  async getSchema(databaseId: string): Promise<DatabaseSchema> {
    return this.callFunction('get-notion-schema', { databaseId }, 'get database schema');
  }
}

// Data service
export class NotionDataService extends BaseNotionService {
  async fetchCreatures(filters?: CreatureFilters): Promise<{ creatures: NotionCreature[] }> {
    return this.callFunction('fetch-creatures', filters, 'fetch creatures');
  }

  async fetchEnvironments(): Promise<{ environments: NotionEnvironment[] }> {
    return this.callFunction('fetch-environments', undefined, 'fetch environments');
  }
}

// Encounter service
export class NotionEncounterService extends BaseNotionService {
  async generateEncounter(params: any): Promise<any> {
    return this.callFunction('generate-encounter', params, 'generate encounter');
  }
}

// Unified service hook
export function useNotionServices() {
  const [discovery] = useState(() => new NotionDiscoveryService());
  const [data] = useState(() => new NotionDataService());
  const [encounter] = useState(() => new NotionEncounterService());

  return {
    discovery,
    data,
    encounter,
    
    // Aggregate state
    loading: discovery.loading || data.loading || encounter.loading,
    error: discovery.error || data.error || encounter.error,
    
    // Aggregate actions
    clearAllErrors: () => {
      discovery.clearError();
      data.clearError();
      encounter.clearError();
    }
  };
}
