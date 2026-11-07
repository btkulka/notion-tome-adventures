import React, { useState, useEffect } from 'react';
import { Sword, Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { callEdgeFunction } from '@/lib/api';
import { useCached } from '@/lib/cached';
import { toast } from 'sonner';

interface NotionCampaign {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  coverArt?: string;
}

const NONE: NotionCampaign[] = [];

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
  const campaigns = useCached(['campaigns', activeOnly], async (): Promise<NotionCampaign[]> =>
    (await callEdgeFunction('fetch-campaigns', { searchQuery: '', activeOnly }))?.campaigns ?? []
  );
  const items = campaigns.data ?? NONE;
  // Loading until the first answer, so the list never flashes "No campaigns found" before it arrives.
  const isLoading = campaigns.data === undefined && !campaigns.error;

  useEffect(() => {
    if (!campaigns.error) return;
    console.error('[CampaignSelect] Error:', campaigns.error);
    toast.error('Failed to load campaigns');
  }, [campaigns.error]);

  // Filter items based on search
  const filteredItems = items.filter(campaign => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return campaign.name.toLowerCase().includes(query);
  }).sort((a, b) => {
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;
    return a.name.localeCompare(b.name);
  });

  const handleSelect = (campaignId: string) => {
    const selected = items.find(c => c.id === campaignId);
    onValueChange(selected || null);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Sword className={cn("h-4 w-4 shrink-0 opacity-50", isLoading && !value && "motion-safe:animate-pulse")} />
            <span className="truncate">
              {value ? value.name : isLoading ? 'Loading campaigns…' : placeholder}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {value && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search campaigns..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading ? (
              <CommandEmpty>Loading campaigns...</CommandEmpty>
            ) : filteredItems.length === 0 ? (
              <CommandEmpty>No campaigns found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredItems.map((campaign) => (
                  <CommandItem
                    key={campaign.id}
                    value={campaign.id}
                    onSelect={handleSelect}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value?.id === campaign.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{campaign.name}</div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
