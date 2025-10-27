import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Sword, Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotionService, NotionCampaign } from '@/hooks/useNotionService';
import { useToast } from '@/hooks/use-toast';
import { EdgeFunctionError } from '@/components/ui/edge-function-error';

interface CampaignSelectProps {
  value: NotionCampaign | null;
  onValueChange: (campaign: NotionCampaign | null) => void;
  placeholder?: string;
  className?: string;
  activeOnly?: boolean;
}

export const CampaignSelect: React.FC<CampaignSelectProps> = ({
  value,
  onValueChange,
  placeholder = "Select campaign...",
  className,
  activeOnly = false
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [campaigns, setCampaigns] = useState<NotionCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [campaignError, setCampaignError] = useState<Error | null>(null);
  const { fetchCampaigns } = useNotionService();
  const { toast } = useToast();
  const hasInitialLoadRef = useRef(false);

  const loadCampaigns = useCallback(async (search?: string) => {
    setIsLoading(true);

    try {
      // Always fetch active campaigns only
      const result = await fetchCampaigns(search, true);

      if (!result.success) {
        setCampaignError(result.error || new Error('Unknown error'));
        setCampaigns([]);
        setIsLoading(false);
        return;
      }

      if (result.data?.campaigns) {
        setCampaigns(result.data.campaigns);
        setCampaignError(null);

        // Auto-select if only one active campaign and no current selection
        if (result.data.campaigns.length === 1 && !value && !hasInitialLoadRef.current) {
          onValueChange(result.data.campaigns[0]);
        }
      }
    } catch (err) {
      setCampaignError(err instanceof Error ? err : new Error('Failed to load campaigns'));
      setCampaigns([]);
    } finally {
      setIsLoading(false);
      hasInitialLoadRef.current = true;
    }
  }, [fetchCampaigns, value, onValueChange]);

  // Load initial campaigns on mount
  useEffect(() => {
    if (!hasInitialLoadRef.current) {
      loadCampaigns();
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (!hasInitialLoadRef.current) return;
    
    const timeoutId = setTimeout(() => {
      loadCampaigns(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]); // Remove loadCampaigns to prevent infinite loop

  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns;

    // Filter by search query if provided
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = campaigns.filter(campaign =>
        campaign.name.toLowerCase().includes(query) ||
        (campaign.description && campaign.description.toLowerCase().includes(query))
      );
    }

    // Active campaigns appear first
    return filtered.sort((a, b) => {
      if (a.active && !b.active) return -1;
      if (!a.active && b.active) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [campaigns, searchQuery]);

  const formatCampaignDisplay = (campaign: NotionCampaign) => {
    return campaign.name;
  };

  const handleSelect = (campaign: NotionCampaign) => {
    onValueChange(campaign);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(null);
  };

  return (
    <>
      {campaignError && (
        <div className="mb-2">
          <EdgeFunctionError
            error={campaignError}
            operationName="fetch campaigns"
            onRetry={() => loadCampaigns(searchQuery)}
          />
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            role="combobox"
            aria-expanded={open}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-background/80",
              className
            )}
          >
            {value ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Sword className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{formatCampaignDisplay(value)}</span>
                <span
                  role="button"
                  className="h-4 w-4 p-0 hover:bg-destructive/20 hover:text-destructive shrink-0 rounded transition-colors inline-flex items-center justify-center"
                  onClick={handleClear}
                >
                  <X className="h-3 w-3" />
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sword className="h-4 w-4" />
                <span>{placeholder}</span>
              </div>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search campaigns..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading campaigns...
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {searchQuery.trim() ? 'No campaigns found matching your search.' : 'No campaigns found.'}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredCampaigns.map((campaign) => (
                      <CommandItem
                        key={campaign.id}
                        value={campaign.id}
                        onSelect={() => handleSelect(campaign)}
                        className="flex items-center gap-2 p-3"
                      >
                        <Check
                          className={cn(
                            "h-4 w-4",
                            value?.id === campaign.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{campaign.name}</div>
                          {campaign.description && (
                            <div className="text-xs text-muted-foreground truncate mt-1">
                              {campaign.description}
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
};
