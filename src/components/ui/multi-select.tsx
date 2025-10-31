import React from 'react';
import { Check, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { LucideIcon } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  icon?: LucideIcon;
}

interface MultiSelectProps {
  label?: string;
  placeholder?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
  disabled?: boolean;
  maxDisplay?: number; // Max number of selected items to display before showing count
}

export function MultiSelect({
  label,
  placeholder = 'Select options...',
  options,
  value,
  onChange,
  className,
  disabled = false,
  maxDisplay = 3,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleSelect = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const handleRemove = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
  };

  const filteredOptions = options.filter((option) => {
    if (!searchQuery) return true;
    return option.label.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const selectedOptions = options.filter((opt) => value.includes(opt.value));
  const displayOptions = selectedOptions.slice(0, maxDisplay);
  const remainingCount = selectedOptions.length - maxDisplay;

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-start bg-transparent border-0 border-b-2 border-border rounded-none px-0 hover:bg-primary/5 transition-all duration-200 h-auto min-h-[3rem]',
              value.length > 0 ? 'text-foreground py-2' : 'text-muted-foreground py-3'
            )}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {value.length === 0 ? (
                <span className="truncate">{placeholder}</span>
              ) : (
                <div className="flex items-center gap-1 flex-wrap">
                  {displayOptions.map((option) => (
                    <Badge
                      key={option.value}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1 my-0.5"
                    >
                      {option.icon && <option.icon className="h-3 w-3" />}
                      <span>{option.label}</span>
                      <span
                        onClick={(e) => handleRemove(option.value, e)}
                        className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </Badge>
                  ))}
                  {remainingCount > 0 && (
                    <Badge variant="secondary" className="my-0.5">+{remainingCount} more</Badge>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2 self-start mt-3">
              {value.length > 0 && (
                <X
                  className="h-4 w-4 opacity-50 hover:opacity-100"
                  onClick={handleClear}
                />
              )}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {filteredOptions.length === 0 ? (
                <CommandEmpty>No options found.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredOptions.map((option) => {
                    const isSelected = value.includes(option.value);
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => handleSelect(option.value)}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <div
                            className={cn(
                              'flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : 'opacity-50'
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          {option.icon && <option.icon className="h-4 w-4" />}
                          <span>{option.label}</span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
