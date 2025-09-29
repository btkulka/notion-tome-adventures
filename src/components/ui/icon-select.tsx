import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UI_CONSTANTS } from '@/lib/constants';
import { FlexContainer } from './base-card';

interface IconSelectOption {
  value: string;
  label: string;
  icon?: LucideIcon;
}

interface IconSelectProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: IconSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function IconSelect({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Select option",
  className,
  disabled = false
}: IconSelectProps) {
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={cn("space-y-2", className)}>
      <Label className={UI_CONSTANTS.FIELD_LABEL_STYLES}>
        {label}
      </Label>
      
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={UI_CONSTANTS.FIELD_STYLES}>
          <SelectValue placeholder={placeholder}>
            {selectedOption && (
              <FlexContainer gap={2}>
                {selectedOption.icon && <selectedOption.icon className="h-4 w-4" />}
                {selectedOption.label}
              </FlexContainer>
            )}
          </SelectValue>
        </SelectTrigger>
        
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              <FlexContainer gap={2}>
                {option.icon && <option.icon className="h-4 w-4" />}
                {option.label}
              </FlexContainer>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}