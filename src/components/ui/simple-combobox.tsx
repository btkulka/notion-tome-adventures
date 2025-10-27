import * as React from "react"
import { useState } from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { LucideIcon } from "lucide-react"
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
import { toast } from "sonner"

export interface ComboboxItem {
  id: string;
  [key: string]: any;
}

interface SimpleComboboxProps<T extends ComboboxItem> {
  items: T[];
  value: T | null;
  onValueChange: (item: T | null) => void;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRetry: () => void;
  
  // Display config
  icon: LucideIcon;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  loadingMessage: string;
  className?: string;
  
  // Render functions
  formatDisplay: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
}

export function SimpleCombobox<T extends ComboboxItem>({
  items,
  value,
  onValueChange,
  isLoading,
  error,
  searchQuery,
  onSearchChange,
  onRetry,
  icon: Icon,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  loadingMessage,
  className,
  formatDisplay,
  renderItem,
}: SimpleComboboxProps<T>) {
  const [open, setOpen] = useState(false)

  const handleSelect = (selectedId: string) => {
    const selectedItem = items.find(item => item.id === selectedId)
    if (selectedItem) {
      onValueChange(selectedItem)
      setOpen(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onValueChange(null)
  }

  // Show error toast when error changes
  React.useEffect(() => {
    if (error) {
      toast.error("Failed to load items", {
        description: error,
        action: {
          label: "Retry",
          onClick: onRetry,
        },
      })
    }
  }, [error, onRetry])

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
            <Icon className="h-4 w-4 shrink-0 opacity-50" />
            <span className="truncate">
              {value ? formatDisplay(value) : placeholder}
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
            placeholder={searchPlaceholder}
            value={searchQuery}
            onValueChange={onSearchChange}
          />
          <CommandList>
            {isLoading ? (
              <CommandEmpty>{loadingMessage}</CommandEmpty>
            ) : items.length === 0 ? (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            ) : (
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={handleSelect}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          value?.id === item.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        {renderItem(item)}
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
  )
}
