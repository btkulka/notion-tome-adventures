import { useState, useEffect, useCallback } from 'react';
import { useNotionService, NotionCampaign } from '@/hooks/useNotionService';

export const useCampaignSelect = (activeOnly = false) => {
  const [items, setItems] = useState<NotionCampaign[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { fetchCampaigns } = useNotionService();

  const loadItems = useCallback(async (search = '') => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetchCampaigns(search, activeOnly);
      
      if (result.success && result.data?.campaigns) {
        setItems(result.data.campaigns);
      } else if (result.error) {
        setError(String(result.error));
        setItems([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchCampaigns, activeOnly]);

  // Initial load
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Search debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      loadItems(searchQuery);
    }, 300);
    
    return () => clearTimeout(timeout);
  }, [searchQuery, loadItems]);

  const retry = useCallback(() => {
    loadItems(searchQuery);
  }, [loadItems, searchQuery]);

  return {
    items,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    retry,
  };
};
