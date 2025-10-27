import React, { useState, useEffect, useRef } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NotionCampaign {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

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
  const [items, setItems] = useState<NotionCampaign[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const loadedRef = useRef(false);

  // Load campaigns once on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const loadCampaigns = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('fetch-campaigns', {
          body: { searchQuery: '', activeOnly }
        });

        if (error) throw error;
        if (data?.campaigns) {
          setItems(data.campaigns);
        }
      } catch (err) {
        console.error('[CampaignSelect] Error:', err);
        toast.error('Failed to load campaigns');
      } finally {
        setIsLoading(false);
      }
    };

    loadCampaigns();
  }, []); // Run once

  // Filter items based on search
  const filteredItems = items.filter(campaign => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return campaign.name.toLowerCase().includes(query) ||
           (campaign.description && campaign.description.toLowerCase().includes(query));
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
            <Sword className="h-4 w-4 shrink-0 opacity-50" />
            <span className="truncate">
              {value ? value.name : placeholder}
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
                        {campaign.description && (
                          <div className="text-xs text-muted-foreground truncate mt-1">
                            {campaign.description}
                          </div>
                        )}
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
