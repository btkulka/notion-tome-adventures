import { useState, useCallback } from 'react'
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
  error?: Error
  operationName: string
}

export const useNotionService = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string,
    signal?: AbortSignal
  ): Promise<EdgeFunctionResult<T>> => {
    try {
      setLoading(true)
      setError(null)
      
      // Check if already aborted
      if (signal?.aborted) {
        const abortError = new DOMException('Operation was aborted', 'AbortError');
        setError(abortError as Error);
        return { success: false, error: abortError as Error, operationName };
      }
      
      const result = await operation()
      
      // Check if aborted after operation
      if (signal?.aborted) {
        const abortError = new DOMException('Operation was aborted', 'AbortError');
        setError(abortError as Error);
        return { success: false, error: abortError as Error, operationName };
      }
      
      return { success: true, data: result, operationName }
    } catch (err: unknown) {
      // Handle abort errors specially
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError(err as Error);
        return { success: false, error: err as Error, operationName }
      }
      
      // Also handle other cancellation patterns
      if (err instanceof Error && err.message.includes('aborted')) {
        const abortError = new DOMException('Operation was aborted', 'AbortError');
        setError(abortError as Error);
        return { success: false, error: abortError as Error, operationName }
      }
      
      let error: Error;
      
      if (err instanceof Error) {
        error = err;
      } else {
        error = new Error(`Failed to ${operationName}`);
      }
      
      setError(error)
      
      return { success: false, error, operationName }
    } finally {
      setLoading(false)
    }
  }, [])

  // Discovery operations
  const discoverDatabases = useCallback(async () => {
    return executeWithErrorHandling(
      () => callEdgeFunction('discover-notion-databases'),
      'discover databases'
    )
  }, [executeWithErrorHandling])

  const getSchema = useCallback(async (databaseId: string) => {
    return executeWithErrorHandling(
      () => callEdgeFunction('get-notion-schema', { databaseId }),
      'get database schema'
    )
  }, [executeWithErrorHandling])

  // Data fetching operations
  const fetchCreatures = useCallback(async (filters?: CreatureFilters) => {
    return executeWithErrorHandling(
      () => callEdgeFunction('fetch-creatures', filters),
      'fetch creatures'
    )
  }, [executeWithErrorHandling])

  const fetchEnvironments = useCallback(async () => {
    return executeWithErrorHandling(
      () => callEdgeFunction('fetch-environments'),
      'fetch environments'
    )
  }, [executeWithErrorHandling])

  const fetchSessions = useCallback(async (searchQuery?: string, campaignId?: string) => {
    return executeWithErrorHandling(
      () => callEdgeFunction('fetch-sessions', { searchQuery, campaignId }),
      'fetch sessions'
    )
  }, [executeWithErrorHandling])

  const fetchCampaigns = useCallback(async (searchQuery?: string, activeOnly = false) => {
    return executeWithErrorHandling(
      () => callEdgeFunction('fetch-campaigns', { searchQuery, activeOnly }),
      'fetch campaigns'
    )
  }, [executeWithErrorHandling])

  const generateEncounter = useCallback(async (params: NotionEncounterParams, signal?: AbortSignal) => {
    return executeWithErrorHandling(
      () => callEdgeFunction('generate-encounter', params, signal),
      'generate encounter',
      signal
    )
  }, [executeWithErrorHandling])

  const saveEncounter = useCallback(async (encounter: GeneratedEncounter) => {
    return executeWithErrorHandling(
      () => callEdgeFunction('save-encounter', encounter),
      'save encounter to Notion'
    )
  }, [executeWithErrorHandling])

  const debugEnvironments = useCallback(async () => {
    return executeWithErrorHandling(
      () => callEdgeFunction('debug-environments'),
      'debug environments'
    )
  }, [executeWithErrorHandling])

  const simpleDebug = useCallback(async () => {
    return executeWithErrorHandling(
      () => callEdgeFunction('simple-debug'),
      'simple debug'
    )
  }, [executeWithErrorHandling])

  const clearError = useCallback(() => setError(null), [])

  return {
    // Discovery
    discoverDatabases,
    getSchema,

    // Data operations
    fetchCreatures,
    fetchEnvironments,
    fetchSessions,
    fetchCampaigns,
    generateEncounter,
    saveEncounter,
    debugEnvironments,
    simpleDebug,

    // State
    loading,
    error,
    clearError,
  }
}