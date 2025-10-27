import { useState, useEffect, useCallback, useRef } from 'react';
import { useNotionService, NotionSession } from '@/hooks/useNotionService';

export const useSessionSelect = (campaignId?: string) => {
  const [items, setItems] = useState<NotionSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { fetchSessions } = useNotionService();
  const isMountedRef = useRef(true);
  const prevCampaignIdRef = useRef<string | undefined>(undefined);

  const loadItems = useCallback(async (search = '', campId?: string) => {
    if (!isMountedRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetchSessions(search, campId);
      
      if (!isMountedRef.current) return;
      
      if (result.success && result.data?.sessions) {
        setItems(result.data.sessions);
      } else if (result.error) {
        setError(String(result.error));
        setItems([]);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
      setItems([]);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchSessions]);

  // Campaign change handler - only when campaign changes
  useEffect(() => {
    isMountedRef.current = true;
    
    // When campaign changes, clear search and reload
    if (prevCampaignIdRef.current !== campaignId) {
      prevCampaignIdRef.current = campaignId;
      setSearchQuery('');
      loadItems('', campaignId);
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [campaignId]); // Only campaignId dep

  // Search debounce - only when search changes
  useEffect(() => {
    if (!searchQuery) return; // Don't search empty query
    
    const timeout = setTimeout(() => {
      loadItems(searchQuery, campaignId);
    }, 300);
    
    return () => clearTimeout(timeout);
  }, [searchQuery]); // Only searchQuery dep

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
