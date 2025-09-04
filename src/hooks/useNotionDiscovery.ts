import { useState } from 'react';
import { callEdgeFunction } from '@/lib/supabase-client';

export interface NotionDatabase {
  id: string;
  title: string;
  url: string;
  lastEditedTime: string;
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
    name: string;
    type: string;
    id: string;
    config: any;
  }>;
  url: string;
}

export const useNotionDiscovery = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discoverDatabases = async (): Promise<{ allDatabases: NotionDatabase[]; matches: DatabaseMatch[] }> => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await callEdgeFunction('discover-notion-databases');
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to discover databases');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getSchema = async (databaseId: string): Promise<DatabaseSchema> => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await callEdgeFunction('get-notion-schema', { databaseId });
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to get database schema');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    discoverDatabases,
    getSchema,
    loading,
    error,
  };
};