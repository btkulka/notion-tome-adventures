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

export const useNotionService = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const executeWithErrorHandling = async <T>(
    operation: () => Promise<T>,
    operationName: string,
    signal?: AbortSignal
  ): Promise<T> => {
    try {
      setLoading(true)
      setError(null)
      notionLogger.info(`🚀 Starting ${operationName}...`)
      
      // Check if already aborted
      if (signal?.aborted) {
        throw new DOMException('Operation was aborted', 'AbortError');
      }
      
      const result = await operation()
      
      // Check if aborted after operation
      if (signal?.aborted) {
        throw new DOMException('Operation was aborted', 'AbortError');
      }
      
      notionLogger.info(`✅ ${operationName} completed successfully`, result)
      return result
    } catch (err: unknown) {
      // Handle abort errors specially
      if (err instanceof DOMException && err.name === 'AbortError') {
        notionLogger.warn(`🚫 ${operationName} was cancelled`)
        throw err
      }
      
      // Also handle other cancellation patterns
      if (err instanceof Error && err.message.includes('aborted')) {
        notionLogger.warn(`🚫 ${operationName} was cancelled`)
        throw new DOMException('Operation was aborted', 'AbortError')
      }
      
      notionLogger.error(`❌ ${operationName} failed:`, err)
      
      let errorMessage = `Failed to ${operationName}`
      
      if (err instanceof Error) {
        errorMessage = err.message
        notionLogger.error(`🔥 Error details:`, {
          name: err.name,
          message: err.message,
          stack: err.stack
        })
      }
      
      setError(errorMessage)
      
      // Only log simplified messages for expected issues
      if (errorMessage.includes('NOTION_API_KEY') || errorMessage.includes('DATABASE_ID')) {
        notionLogger.warn(`⚠️ ${operationName}: Notion integration not configured`)
      } else if (errorMessage.includes('Notion integration') || errorMessage.includes('temporarily unavailable')) {
        notionLogger.warn(`⚠️ ${operationName}: Using fallback data`)
      } else {
        notionLogger.error(`💥 Unexpected error in ${operationName}:`, err)
      }
      
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Discovery operations
  const discoverDatabases = async (): Promise<{ allDatabases: NotionDatabase[]; matches: DatabaseMatch[] }> => {
    return executeWithErrorHandling(
      () => callEdgeFunction('discover-notion-databases'),
      'discover databases'
    )
  }

  const getSchema = async (databaseId: string): Promise<DatabaseSchema> => {
    return executeWithErrorHandling(
      () => callEdgeFunction('get-notion-schema', { databaseId }),
      'get database schema'
    )
  }

  // Data fetching operations
  const fetchCreatures = async (filters?: CreatureFilters): Promise<{ creatures: NotionCreature[] }> => {
    return executeWithErrorHandling(
      () => callEdgeFunction('fetch-creatures', filters),
      'fetch creatures'
    )
  }

  const fetchEnvironments = async (): Promise<{ environments: NotionEnvironment[] }> => {
    return executeWithErrorHandling(
      () => callEdgeFunction('fetch-environments'),
      'fetch environments'
    )
  }

  const fetchSessions = async (searchQuery?: string): Promise<{ sessions: NotionSession[] }> => {
    return executeWithErrorHandling(
      () => callEdgeFunction('fetch-sessions', searchQuery ? { search: searchQuery } : {}),
      'fetch sessions'
    )
  }

  const generateEncounter = async (params: NotionEncounterParams, signal?: AbortSignal): Promise<GeneratedEncounter> => {
    return executeWithErrorHandling(
      () => callEdgeFunction('generate-encounter', params, signal),
      'generate encounter',
      signal
    )
  }

  const saveEncounter = async (encounter: GeneratedEncounter): Promise<{ pageId: string; pageUrl: string; message: string }> => {
    return executeWithErrorHandling(
      () => callEdgeFunction('save-encounter', encounter),
      'save encounter to Notion'
    )
  }

  const debugEnvironments = async (): Promise<unknown> => {
    return executeWithErrorHandling(
      () => callEdgeFunction('debug-environments'),
      'debug environments'
    )
  }

  const simpleDebug = async (): Promise<unknown> => {
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