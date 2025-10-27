import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Calendar, Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotionService, NotionSession } from '@/hooks/useNotionService';
import { useToast } from '@/hooks/use-toast';
import { EdgeFunctionError } from '@/components/ui/edge-function-error';

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
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sessions, setSessions] = useState<NotionSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionError, setSessionError] = useState<Error | null>(null);
  const { fetchSessions } = useNotionService();
  const { toast } = useToast();
  const hasInitialLoadRef = useRef(false);
  const prevCampaignIdRef = useRef<string | undefined>(undefined);

  const loadSessions = useCallback(async (search?: string) => {
    setIsLoading(true);

    try {
      const result = await fetchSessions(search, campaignId);

      if (!result.success) {
        setSessionError(result.error || new Error('Unknown error'));
        setSessions([]);
        setIsLoading(false);
        return;
      }

      if (result.data?.sessions) {
        setSessions(result.data.sessions);
        setSessionError(null);
      }
    } catch (err) {
      setSessionError(err instanceof Error ? err : new Error('Failed to load sessions'));
      setSessions([]);
    } finally {
      setIsLoading(false);
      hasInitialLoadRef.current = true;
    }
  }, [fetchSessions, campaignId]);

  // Load initial sessions on mount and when campaign changes
  useEffect(() => {
    if (!hasInitialLoadRef.current || prevCampaignIdRef.current !== campaignId) {
      prevCampaignIdRef.current = campaignId;
      loadSessions();
    }
  }, [campaignId]);

  // Debounced search effect
  useEffect(() => {
    if (!hasInitialLoadRef.current) return;
    
    const timeoutId = setTimeout(() => {
      loadSessions(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]); // Remove loadSessions to prevent infinite loop

  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    // Filter by search query if provided
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = sessions.filter(session =>
        session.name.toLowerCase().includes(query) ||
        (session.description && session.description.toLowerCase().includes(query))
      );
    }

    // Sort by date in descending order (most recent first)
    return filtered.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [sessions, searchQuery]);

  const formatSessionDisplay = (session: NotionSession) => {
    const parts = [session.name];
    if (session.date) {
      const date = new Date(session.date);
      parts.push(`(${date.toLocaleDateString()})`);
    }
    return parts.join(' ');
  };

  const handleSelect = (session: NotionSession) => {
    onValueChange(session);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(null);
  };

  return (
    <>
      {sessionError && (
        <div className="mb-2">
          <EdgeFunctionError
            error={sessionError}
            operationName="fetch sessions"
            onRetry={() => loadSessions(searchQuery)}
          />
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between bg-background/50 border-border/50 hover:bg-background/80",
            className
          )}
        >
          {value ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{formatSessionDisplay(value)}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-destructive/20 hover:text-destructive shrink-0"
                onClick={handleClear}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{placeholder}</span>
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search sessions..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading sessions...
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {searchQuery.trim() ? 'No sessions found matching your search.' : 'No sessions found.'}
                </CommandEmpty>
                <CommandGroup>
                  {filteredSessions.map((session) => (
                    <CommandItem
                      key={session.id}
                      value={session.id}
                      onSelect={() => handleSelect(session)}
                      className="flex items-center gap-2 p-3"
                    >
                      <Check
                        className={cn(
                          "h-4 w-4",
                          value?.id === session.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
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
