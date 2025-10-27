import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, X, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EdgeFunctionError } from '@/components/ui/edge-function-error';

export interface ComboboxItem {
  id: string;
  [key: string]: any;
}

interface ComboboxProps<T extends ComboboxItem> {
  value: T | null;
  onValueChange: (item: T | null) => void;
  placeholder?: string;
  className?: string;
  icon: LucideIcon;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  formatDisplay: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  fetchItems: (search?: string) => Promise<{ success: boolean; data?: { items: T[] }; error?: Error }>;
  filterItems?: (items: T[], query: string) => T[];
  sortItems?: (items: T[]) => T[];
  autoSelectSingle?: boolean;
  onInitialLoad?: () => void;
}

export function Combobox<T extends ComboboxItem>({
  value,
  onValueChange,
  placeholder = "Select item...",
  className,
  icon: Icon,
  searchPlaceholder = "Search...",
  emptyMessage = "No items found.",
  loadingMessage = "Loading...",
  formatDisplay,
  renderItem,
  fetchItems,
  filterItems,
  sortItems,
  autoSelectSingle = false,
  onInitialLoad,
}: ComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasInitialLoadRef = useRef(false);
  
  // Use refs to avoid dependency issues
  const fetchItemsRef = useRef(fetchItems);
  const onValueChangeRef = useRef(onValueChange);
  const valueRef = useRef(value);
  
  // Keep refs updated - this runs on every render but doesn't cause re-renders
  fetchItemsRef.current = fetchItems;
  onValueChangeRef.current = onValueChange;
  valueRef.current = value;

  const loadItems = useCallback(async (search?: string) => {
    setIsLoading(true);

    try {
      const result = await fetchItemsRef.current(search);

      if (!result.success) {
        setError(result.error || new Error('Unknown error'));
        setItems([]);
        setIsLoading(false);
        return;
      }

      if (result.data?.items) {
        setItems(result.data.items);
        setError(null);

        // Auto-select if only one item and no current selection
        if (autoSelectSingle && result.data.items.length === 1 && !valueRef.current && !hasInitialLoadRef.current) {
          onValueChangeRef.current(result.data.items[0]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load items'));
      setItems([]);
    } finally {
      setIsLoading(false);
      if (!hasInitialLoadRef.current) {
        hasInitialLoadRef.current = true;
        onInitialLoad?.();
      }
    }
  }, [autoSelectSingle, onInitialLoad]);

  // Load initial items on mount
  useEffect(() => {
    if (!hasInitialLoadRef.current) {
      loadItems();
    }
  }, [loadItems]);

  // Debounced search effect
  useEffect(() => {
    if (!hasInitialLoadRef.current) return;
    
    const timeoutId = setTimeout(() => {
      loadItems(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, loadItems]);

  const filteredItems = useMemo(() => {
    let filtered = items;

    // Apply custom filter if provided
    if (filterItems && searchQuery.trim()) {
      filtered = filterItems(items, searchQuery);
    }

    // Apply custom sort if provided
    if (sortItems) {
      filtered = sortItems(filtered);
    }

    return filtered;
  }, [items, searchQuery, filterItems, sortItems]);

  const handleSelect = (item: T) => {
    onValueChange(item);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(null);
  };

  return (
    <>
      {error && (
        <div className="mb-2">
          <EdgeFunctionError
            error={error}
            operationName="fetch items"
            onRetry={() => loadItems(searchQuery)}
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
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{formatDisplay(value)}</span>
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
                <Icon className="h-4 w-4" />
                <span>{placeholder}</span>
              </div>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {loadingMessage}
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {searchQuery.trim() ? `No items found matching your search.` : emptyMessage}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredItems.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        onSelect={() => handleSelect(item)}
                        className="flex items-center gap-2 p-3"
                      >
                        <Check
                          className={cn(
                            "h-4 w-4",
                            value?.id === item.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          {renderItem(item)}
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
}