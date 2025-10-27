import React, { useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { useNotionService, NotionSession } from '@/hooks/useNotionService';

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
  const { fetchSessions } = useNotionService();
  const prevCampaignIdRef = useRef<string | undefined>(undefined);
  const comboboxKeyRef = useRef(0);

  // When campaign changes, force re-render of combobox to reload sessions
  useEffect(() => {
    if (prevCampaignIdRef.current !== campaignId) {
      prevCampaignIdRef.current = campaignId;
      comboboxKeyRef.current += 1;
    }
  }, [campaignId]);

  const fetchItems = async (search?: string) => {
    const result = await fetchSessions(search, campaignId);
    return {
      success: result.success,
      data: result.data?.sessions ? { items: result.data.sessions } : undefined,
      error: result.error,
    };
  };

  const filterItems = (sessions: NotionSession[], query: string) => {
    const lowerQuery = query.toLowerCase();
    return sessions.filter(session =>
      session.name.toLowerCase().includes(lowerQuery) ||
      (session.description && session.description.toLowerCase().includes(lowerQuery))
    );
  };

  const sortItems = (sessions: NotionSession[]) => {
    // Sort by date in descending order (most recent first)
    return sessions.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  };

  const formatDisplay = (session: NotionSession) => {
    const parts = [session.name];
    if (session.date) {
      const date = new Date(session.date);
      parts.push(`(${date.toLocaleDateString()})`);
    }
    return parts.join(' ');
  };

  const renderItem = (session: NotionSession) => (
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
  );

  return (
    <Combobox<NotionSession>
      key={comboboxKeyRef.current}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      className={className}
      icon={Calendar}
      searchPlaceholder="Search sessions..."
      emptyMessage="No sessions found."
      loadingMessage="Loading sessions..."
      formatDisplay={formatDisplay}
      renderItem={renderItem}
      fetchItems={fetchItems}
      filterItems={filterItems}
      sortItems={sortItems}
      autoSelectSingle={false}
    />
  );
};