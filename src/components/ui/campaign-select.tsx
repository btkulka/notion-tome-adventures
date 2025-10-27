import React, { useMemo } from 'react';
import { Sword } from 'lucide-react';
import { SimpleCombobox } from '@/components/ui/simple-combobox';
import { NotionCampaign } from '@/hooks/useNotionService';
import { useCampaignSelect } from '@/hooks/useCampaignSelect';

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
  const {
    items,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    retry
  } = useCampaignSelect(activeOnly);

  // Filter and sort items locally
  const filteredItems = useMemo(() => {
    let filtered = items;
    
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(campaign =>
        campaign.name.toLowerCase().includes(lowerQuery) ||
        (campaign.description && campaign.description.toLowerCase().includes(lowerQuery))
      );
    }
    
    return filtered.sort((a, b) => {
      if (a.active && !b.active) return -1;
      if (!a.active && b.active) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [items, searchQuery]);

  return (
    <SimpleCombobox
      items={filteredItems}
      value={value}
      onValueChange={onValueChange}
      isLoading={isLoading}
      error={error}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onRetry={retry}
      icon={Sword}
      placeholder={placeholder}
      searchPlaceholder="Search campaigns..."
      emptyMessage="No campaigns found."
      loadingMessage="Loading campaigns..."
      formatDisplay={(campaign) => campaign.name}
      renderItem={(campaign) => (
        <>
          <div className="font-medium truncate">{campaign.name}</div>
          {campaign.description && (
            <div className="text-xs text-muted-foreground truncate mt-1">
              {campaign.description}
            </div>
          )}
        </>
      )}
      className={className}
    />
  );
};