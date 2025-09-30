import { useState, useEffect } from 'react';
import { DND_CONSTANTS } from '@/lib/constants';
import { useNotionService } from '@/hooks/useNotionService';
import { notionLogger } from '@/utils/logger';

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

  useEffect(() => {
    const loadEnvironments = async () => {
      setLoading(true);
      setError(null);
      
      try {
        notionLogger.info('🌍 Attempting to load environments from Notion...');
        const result = await notionService.fetchEnvironments();
        
        if (result?.environments?.length > 0) {
          notionLogger.info(`✅ Successfully loaded ${result.environments.length} environments from Notion`);
          notionLogger.debug('📋 Environment data:', result.environments);
          
          setEnvironments(result.environments);
          setIsUsingDefaults(false);
        } else {
          notionLogger.warn('⚠️ No environments returned from Notion, using defaults');
          setDefaultEnvironments();
        }
      } catch (err) {
        notionLogger.warn('🏔️ Notion integration not available, using default environments');
        setDefaultEnvironments();
        setError(err instanceof Error ? err.message : 'Failed to load environments');
      } finally {
        setLoading(false);
      }
    };

    const setDefaultEnvironments = () => {
      setEnvironments([...DND_CONSTANTS.DEFAULT_ENVIRONMENTS]);
      setIsUsingDefaults(true);
      notionLogger.info(`🎲 Using ${DND_CONSTANTS.DEFAULT_ENVIRONMENTS.length} default D&D environments`);
    };

    loadEnvironments();
  }, [notionService]);

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
