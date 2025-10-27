import { useState, useEffect, useCallback, useRef } from 'react';
import { useNotionService, NotionCampaign } from '@/hooks/useNotionService';

export const useCampaignSelect = (activeOnly = false) => {
  const [items, setItems] = useState<NotionCampaign[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { fetchCampaigns } = useNotionService();
  const isMountedRef = useRef(true);

  const loadItems = useCallback(async (search = '') => {
    if (!isMountedRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetchCampaigns(search, activeOnly);
      
      if (!isMountedRef.current) return;
      
      if (result.success && result.data?.campaigns) {
        setItems(result.data.campaigns);
      } else if (result.error) {
        setError(String(result.error));
        setItems([]);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
      setItems([]);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchCampaigns, activeOnly]);

  // Initial load - only once on mount
  useEffect(() => {
    isMountedRef.current = true;
    loadItems();
    
    return () => {
      isMountedRef.current = false;
    };
  }, []); // Empty deps - run once

  // Search debounce - only when search changes
  useEffect(() => {
    if (!searchQuery) return; // Don't search empty query
    
    const timeout = setTimeout(() => {
      loadItems(searchQuery);
    }, 300);
    
    return () => clearTimeout(timeout);
  }, [searchQuery]); // Only searchQuery dep

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
