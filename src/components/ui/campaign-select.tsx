import React from 'react';
import { Sword } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { useNotionService, NotionCampaign } from '@/hooks/useNotionService';

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
  const { fetchCampaigns } = useNotionService();

  const fetchItems = async (search?: string) => {
    const result = await fetchCampaigns(search, true); // Always fetch active campaigns only
    return {
      success: result.success,
      data: result.data?.campaigns ? { items: result.data.campaigns } : undefined,
      error: result.error,
    };
  };

  const filterItems = (campaigns: NotionCampaign[], query: string) => {
    const lowerQuery = query.toLowerCase();
    return campaigns.filter(campaign =>
      campaign.name.toLowerCase().includes(lowerQuery) ||
      (campaign.description && campaign.description.toLowerCase().includes(lowerQuery))
    );
  };

  const sortItems = (campaigns: NotionCampaign[]) => {
    // Active campaigns appear first
    return campaigns.sort((a, b) => {
      if (a.active && !b.active) return -1;
      if (!a.active && b.active) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const formatDisplay = (campaign: NotionCampaign) => campaign.name;

  const renderItem = (campaign: NotionCampaign) => (
    <>
      <div className="font-medium truncate">{campaign.name}</div>
      {campaign.description && (
        <div className="text-xs text-muted-foreground truncate mt-1">
          {campaign.description}
        </div>
      )}
    </>
  );

  return (
    <Combobox<NotionCampaign>
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      className={className}
      icon={Sword}
      searchPlaceholder="Search campaigns..."
      emptyMessage="No campaigns found."
      loadingMessage="Loading campaigns..."
      formatDisplay={formatDisplay}
      renderItem={renderItem}
      fetchItems={fetchItems}
      filterItems={filterItems}
      sortItems={sortItems}
      autoSelectSingle={true}
    />
  );
};