import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Calendar, Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotionService, NotionSession } from '@/hooks/useNotionService';
import { useToast } from '@/hooks/use-toast';
import { encounterLogger } from '@/utils/logger';

interface SessionSelectProps {
  value: NotionSession | null;
  onValueChange: (session: NotionSession | null) => void;
  placeholder?: string;
  className?: string;
}

export const SessionSelect: React.FC<SessionSelectProps> = ({
  value,
  onValueChange,
  placeholder = "Select session...",
  className
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sessions, setSessions] = useState<NotionSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { fetchSessions } = useNotionService();
  const { toast } = useToast();

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadSessions(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Load initial sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async (search?: string) => {
    try {
      setIsLoading(true);
      encounterLogger.debug('Fetching sessions', { search });
      
      const result = await fetchSessions(search);
      setSessions(result.sessions);
      
      encounterLogger.info('Sessions loaded successfully', { count: result.sessions.length });
    } catch (error) {
      encounterLogger.error('Failed to load sessions', error);
      toast({
        title: "Failed to load sessions",
        description: "Could not fetch sessions from Notion. Please check your integration.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    
    const query = searchQuery.toLowerCase();
    return sessions.filter(session => 
      session.name.toLowerCase().includes(query) ||
      (session.description && session.description.toLowerCase().includes(query))
    );
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
    encounterLogger.debug('Session selected', session);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(null);
    encounterLogger.debug('Session selection cleared');
  };

  return (
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
  );
};
