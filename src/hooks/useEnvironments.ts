import { useState, useEffect, useCallback, useRef } from 'react';
import { DND_CONSTANTS } from '@/lib/constants';
import { useNotionService } from '@/hooks/useNotionService';

export interface Environment {
  id: string;
  name: string;
}

export interface UseEnvironmentsReturn {
  environments: Environment[];
  environmentOptions: string[];
  loading: boolean;
  error: string | null;
  isUsingDefaults: boolean;
}

export function useEnvironments(): UseEnvironmentsReturn {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingDefaults, setIsUsingDefaults] = useState(false);
  const notionService = useNotionService();
  const hasLoadedRef = useRef(false);

  const setDefaultEnvironments = useCallback(() => {
    setEnvironments([...DND_CONSTANTS.DEFAULT_ENVIRONMENTS]);
    setIsUsingDefaults(true);
  }, []);

  const loadEnvironments = useCallback(async () => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await notionService.fetchEnvironments();
      
      if (result.success && result.data?.environments?.length > 0) {
        setEnvironments(result.data.environments);
        setIsUsingDefaults(false);
      } else {
        if (result.error) {
          setError(result.error);
        }
        setDefaultEnvironments();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load environments');
      setDefaultEnvironments();
    } finally {
      setLoading(false);
    }
  }, [setDefaultEnvironments]);

  useEffect(() => {
    loadEnvironments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - loadEnvironments called once on mount

  // Create environment options with 'Any' and sorted list
  const environmentOptions = ['Any', ...environments.map(env => env.name)]
    .filter((env, index, arr) => arr.indexOf(env) === index) // Remove duplicates
    .sort((a, b) => {
      if (a === 'Any') return -1; // Keep 'Any' at the top
      if (b === 'Any') return 1;
      return a.localeCompare(b); // Sort alphabetically
    });

  return {
    environments,
    environmentOptions,
    loading,
    error,
    isUsingDefaults
  };
}
