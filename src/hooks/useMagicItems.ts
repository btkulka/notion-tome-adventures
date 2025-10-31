import { useState, useEffect } from 'react';
import { notionApi, NotionMagicItem, MagicItemFilters } from './useNotionService';
import { toast } from 'sonner';

interface UseMagicItemsResult {
  magicItems: NotionMagicItem[];
  loading: boolean;
  error: Error | null;
  refetch: (filters?: MagicItemFilters) => Promise<void>;
}

export function useMagicItems(initialFilters?: MagicItemFilters): UseMagicItemsResult {
  const [magicItems, setMagicItems] = useState<NotionMagicItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMagicItems = async (filters?: MagicItemFilters) => {
    setLoading(true);
    setError(null);

    try {
      const result = await notionApi.fetchMagicItems(filters);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch magic items');
      }

      if (result.data?.magicItems) {
        setMagicItems(result.data.magicItems);

        // Show warning toast if some items failed to load
        if (result.metadata?.failed && result.metadata.failed > 0) {
          toast.error(
            `${result.metadata.failed} magic item${result.metadata.failed === 1 ? '' : 's'} couldn't be loaded`,
            {
              description: 'Some items may be missing required fields or have invalid data.',
              duration: 5000,
            }
          );
        }
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to fetch magic items');
      setError(errorObj);
      toast.error('Failed to load magic items', {
        description: errorObj.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMagicItems(initialFilters);
  }, []);

  return {
    magicItems,
    loading,
    error,
    refetch: fetchMagicItems,
  };
}
