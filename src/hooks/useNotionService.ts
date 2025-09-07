import { useState } from 'react'
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
    operationName: string
  ): Promise<T> => {
    try {
      setLoading(true)
      setError(null)
      console.log(`🚀 Starting ${operationName}...`)
      const result = await operation()
      console.log(`✅ ${operationName} completed successfully:`, result)
      return result
    } catch (err: unknown) {
      console.error(`❌ ${operationName} failed:`, err)
      
      let errorMessage = `Failed to ${operationName}`
      
      if (err instanceof Error) {
        errorMessage = err.message
        console.error(`🔥 Error details:`, {
          name: err.name,
          message: err.message,
          stack: err.stack
        })
      }
      
      setError(errorMessage)
      
      // Only log simplified messages for expected issues
      if (errorMessage.includes('NOTION_API_KEY') || errorMessage.includes('DATABASE_ID')) {
        console.log(`⚠️ ${operationName}: Notion integration not configured`)
      } else if (errorMessage.includes('Notion integration') || errorMessage.includes('temporarily unavailable')) {
        console.log(`⚠️ ${operationName}: Using fallback data`)
      } else {
        console.error(`💥 Unexpected error in ${operationName}:`, err)
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

  const generateEncounter = async (params: NotionEncounterParams): Promise<GeneratedEncounter> => {
    return executeWithErrorHandling(
      () => callEdgeFunction('generate-encounter', params),
      'generate encounter'
    )
  }

  const testCreaturesStructure = async (): Promise<any> => {
    return executeWithErrorHandling(
      () => callEdgeFunction('simple-creatures-test'),
      'test creatures structure'
    )
  }

  return {
    // Discovery
    discoverDatabases,
    getSchema,
    
    // Data operations
    fetchCreatures,
    fetchEnvironments,
    generateEncounter,
    
    // Debug operations
    testCreaturesStructure,
    
    // State
    loading,
    error,
    clearError: () => setError(null),
  }
}