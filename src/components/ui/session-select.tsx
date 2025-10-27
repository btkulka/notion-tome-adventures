import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { SimpleCombobox } from '@/components/ui/simple-combobox';
import { NotionSession } from '@/hooks/useNotionService';
import { useSessionSelect } from '@/hooks/useSessionSelect';

interface SessionSelectProps {
  value: NotionSession | null;
  onValueChange: (session: NotionSession | null) => void;
  placeholder?: string;
  className?: string;
  campaignId?: string;  // Filter sessions by campaign
}

export const SessionSelect: React.FC<SessionSelectProps> = ({
  value,
  onValueChange,
  placeholder = "Select session...",
  className,
  campaignId
}) => {
  const {
    items,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    retry
  } = useSessionSelect(campaignId);

  // Filter and sort items locally
  const filteredItems = useMemo(() => {
    let filtered = items;
    
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(session =>
        session.name.toLowerCase().includes(lowerQuery) ||
        (session.description && session.description.toLowerCase().includes(lowerQuery))
      );
    }
    
    // Sort by date in descending order (most recent first)
    return filtered.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [items, searchQuery]);

  const formatDisplay = (session: NotionSession) => {
    const parts = [session.name];
    if (session.date) {
      const date = new Date(session.date);
      parts.push(`(${date.toLocaleDateString()})`);
    }
    return parts.join(' ');
  };

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
      icon={Calendar}
      placeholder={placeholder}
      searchPlaceholder="Search sessions..."
      emptyMessage="No sessions found."
      loadingMessage="Loading sessions..."
      formatDisplay={formatDisplay}
      renderItem={(session) => (
        <>
          <div className="font-medium truncate">{session.name}</div>
          {session.date && (
            <div className="text-xs text-muted-foreground">
              {new Date(session.date).toLocaleDateString()}
            </div>
          )}
          {session.description && (
            <div className="text-xs text-muted-foreground truncate mt-1">
              {session.description}
            </div>
          )}
        </>
      )}
      className={className}
    />
  );
};