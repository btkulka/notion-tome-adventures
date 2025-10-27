import { useState, useEffect, useCallback, useRef } from 'react';
import { useNotionService, NotionSession } from '@/hooks/useNotionService';

export const useSessionSelect = (campaignId?: string) => {
  const [items, setItems] = useState<NotionSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { fetchSessions } = useNotionService();
  const prevCampaignIdRef = useRef<string | undefined>(undefined);

  const loadItems = useCallback(async (search = '', campId?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetchSessions(search, campId);
      
      if (result.success && result.data?.sessions) {
        setItems(result.data.sessions);
      } else if (result.error) {
        setError(String(result.error));
        setItems([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchSessions]);

  // Initial load and campaign change
  useEffect(() => {
    // When campaign changes, clear search and reload
    if (prevCampaignIdRef.current !== campaignId) {
      prevCampaignIdRef.current = campaignId;
      setSearchQuery('');
      loadItems('', campaignId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // Search debounce
  useEffect(() => {
    if (!searchQuery) return;
    
    const timeout = setTimeout(() => {
      loadItems(searchQuery, campaignId);
    }, 300);
    
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, campaignId]);

  const retry = useCallback(() => {
    loadItems(searchQuery, campaignId);
  }, [loadItems, searchQuery, campaignId]);

  return {
    items,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    retry,
  };
};
