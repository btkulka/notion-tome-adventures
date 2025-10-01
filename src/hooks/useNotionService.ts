import { useState } from 'react'
import { callEdgeFunction } from '@/lib/supabase-client'
import { NotionDatabase, DatabaseMatch, DatabaseSchema } from './useNotionDiscovery'
import { NotionEncounterParams, GeneratedEncounter } from '@/types/encounter'
import { notionLogger } from '@/utils/logger'

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

  const executeWithErrorHandling = async <T>(
    operation: () => Promise<T>,
    operationName: string,
    signal?: AbortSignal
  ): Promise<EdgeFunctionResult<T>> => {
    try {
      setLoading(true)
      setError(null)
      notionLogger.info(`🚀 Starting ${operationName}...`)
      
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
      
      notionLogger.info(`✅ ${operationName} completed successfully`, result)
      return { success: true, data: result, operationName }
    } catch (err: unknown) {
      // Handle abort errors specially
      if (err instanceof DOMException && err.name === 'AbortError') {
        notionLogger.warn(`🚫 ${operationName} was cancelled`)
        setError(err as Error);
        return { success: false, error: err as Error, operationName }
      }
      
      // Also handle other cancellation patterns
      if (err instanceof Error && err.message.includes('aborted')) {
        notionLogger.warn(`🚫 ${operationName} was cancelled`)
        const abortError = new DOMException('Operation was aborted', 'AbortError');
        setError(abortError as Error);
        return { success: false, error: abortError as Error, operationName }
      }
      
      notionLogger.error(`❌ ${operationName} failed:`, err)
      
      let error: Error;
      
      if (err instanceof Error) {
        error = err;
        notionLogger.error(`🔥 Error details:`, {
          name: err.name,
          message: err.message,
          stack: err.stack
        })
      } else {
        error = new Error(`Failed to ${operationName}`);
      }
      
      setError(error)
      
      // Only log simplified messages for expected issues
      if (error.message.includes('NOTION_API_KEY') || error.message.includes('DATABASE_ID')) {
        notionLogger.warn(`⚠️ ${operationName}: Notion integration not configured`)
      } else if (error.message.includes('Notion integration') || error.message.includes('temporarily unavailable')) {
        notionLogger.warn(`⚠️ ${operationName}: Using fallback data`)
      } else {
        notionLogger.error(`💥 Unexpected error in ${operationName}:`, err)
      }
      
      return { success: false, error, operationName }
    } finally {
      setLoading(false)
    }
  }

  // Discovery operations
  const discoverDatabases = async () => {
    return executeWithErrorHandling(
      () => callEdgeFunction('discover-notion-databases'),
      'discover databases'
    )
  }

  const getSchema = async (databaseId: string) => {
    return executeWithErrorHandling(
      () => callEdgeFunction('get-notion-schema', { databaseId }),
      'get database schema'
    )
  }

  // Data fetching operations
  const fetchCreatures = async (filters?: CreatureFilters) => {
    return executeWithErrorHandling(
      () => callEdgeFunction('fetch-creatures', filters),
      'fetch creatures'
    )
  }

  const fetchEnvironments = async () => {
    return executeWithErrorHandling(
      () => callEdgeFunction('fetch-environments'),
      'fetch environments'
    )
  }

  const fetchSessions = async (searchQuery?: string) => {
    return executeWithErrorHandling(
      () => callEdgeFunction('fetch-sessions', searchQuery ? { search: searchQuery } : {}),
      'fetch sessions'
    )
  }

  const generateEncounter = async (params: NotionEncounterParams, signal?: AbortSignal) => {
    return executeWithErrorHandling(
      () => callEdgeFunction('generate-encounter', params, signal),
      'generate encounter',
      signal
    )
  }

  const saveEncounter = async (encounter: GeneratedEncounter) => {
    return executeWithErrorHandling(
      () => callEdgeFunction('save-encounter', encounter),
      'save encounter to Notion'
    )
  }

  const debugEnvironments = async () => {
    return executeWithErrorHandling(
      () => callEdgeFunction('debug-environments'),
      'debug environments'
    )
  }

  const simpleDebug = async () => {
    return executeWithErrorHandling(
      () => callEdgeFunction('simple-debug'),
      'simple debug'
    )
  }

  return {
    // Discovery
    discoverDatabases,
    getSchema,
    
    // Data operations
    fetchCreatures,
    fetchEnvironments,
    fetchSessions,
    generateEncounter,
    saveEncounter,
    debugEnvironments,
    simpleDebug,
    
    // State
    loading,
    error,
    clearError: () => setError(null),
  }
}