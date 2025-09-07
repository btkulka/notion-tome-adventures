import { useState } from 'react'
import { callEdgeFunction } from '@/lib/supabase-client'
import { NotionDatabase, DatabaseMatch, DatabaseSchema } from './useNotionDiscovery'

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

export interface GeneratedEncounter {
  encounter_name: string
  environment: string
  party_level: number
  party_size: number
  difficulty: string
  total_xp: number
  adjusted_xp: number
  creatures: Array<{
    name: string
    quantity: number
    challenge_rating: string
    xp_value: number
  }>
  generation_notes: string
}

export interface CreatureFilters {
  environment?: string
  minCR?: string
  maxCR?: string
  creatureType?: string
  alignment?: string
  size?: string
}

export interface EncounterParams {
  environment: string
  partyLevel: number
  partySize: number
  difficulty: string
  includeEnvironmentCreatures?: boolean
  minCR?: string
  maxCR?: string
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
      return await operation()
    } catch (err: any) {
      const errorMessage = err.message || `Failed to ${operationName}`
      setError(errorMessage)
      console.error(`Error in ${operationName}:`, err)
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

  const generateEncounter = async (params: EncounterParams): Promise<GeneratedEncounter> => {
    return executeWithErrorHandling(
      () => callEdgeFunction('generate-encounter', params),
      'generate encounter'
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
    
    // State
    loading,
    error,
    clearError: () => setError(null),
  }
}