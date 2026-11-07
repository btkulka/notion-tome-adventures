import React, { useState, useEffect } from 'react';
import { Calendar, Check, ChevronsUpDown, X } from 'lucide-react';
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

interface NotionSession {
  id: string;
  name: string;
  description?: string;
  date?: string;
  campaign_id?: string;
}

const NONE: NotionSession[] = [];

interface SessionSelectProps {
  value: NotionSession | null;
  onValueChange: (session: NotionSession | null) => void;
  placeholder?: string;
  className?: string;
  campaignId?: string;
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
  const sessions = useCached(['sessions', campaignId ?? null], async (): Promise<NotionSession[]> =>
    (await callEdgeFunction('fetch-sessions', { searchQuery: '', campaignId }))?.sessions ?? []
  );
  const items = sessions.data ?? NONE;
  // Loading until the first answer, so the list never flashes "No sessions found" before it arrives.
  const isLoading = sessions.data === undefined && !sessions.error;

  useEffect(() => {
    if (!sessions.error) return;
    console.error('[SessionSelect] Error:', sessions.error);
    toast.error('Failed to load sessions');
  }, [sessions.error]);

  // Filter items based on search
  const filteredItems = items.filter(session => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return session.name.toLowerCase().includes(query) ||
           (session.description && session.description.toLowerCase().includes(query));
  }).sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const handleSelect = (sessionId: string) => {
    const selected = items.find(s => s.id === sessionId);
    onValueChange(selected || null);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(null);
  };

  const formatDisplay = (session: NotionSession) => {
    const parts = [session.name];
    if (session.date) {
      parts.push(`(${new Date(session.date).toLocaleDateString()})`);
    }
    return parts.join(' ');
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
            <Calendar className={cn("h-4 w-4 shrink-0 opacity-50", isLoading && !value && "motion-safe:animate-pulse")} />
            <span className="truncate">
              {value ? formatDisplay(value) : isLoading ? 'Loading sessions…' : placeholder}
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
            placeholder="Search sessions..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading ? (
              <CommandEmpty>Loading sessions...</CommandEmpty>
            ) : filteredItems.length === 0 ? (
              <CommandEmpty>No sessions found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredItems.map((session) => (
                  <CommandItem
                    key={session.id}
                    value={session.id}
                    onSelect={handleSelect}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
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
