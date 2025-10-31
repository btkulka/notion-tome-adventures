import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UI_CONSTANTS } from '@/lib/constants';

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  goldText?: boolean;
}

export function NumberInput({
  label,
  value,
  onChange,
  min = 0,
  max = 999999,
  step = 1,
  placeholder,
  className,
  goldText = false
}: NumberInputProps) {
  const handleIncrement = () => {
    const newValue = Math.min(value + step, max);
    onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(value - step, min);
    onChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value) || 0;
    const clampedValue = Math.max(min, Math.min(max, newValue));
    onChange(clampedValue);
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative flex">
        <Input
          type="number"
          value={value}
          onChange={handleInputChange}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className={cn(
            UI_CONSTANTS.FIELD_STYLES,
            "pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            goldText && "text-yellow-600 dark:text-yellow-500"
          )}
        />
        <div className="absolute right-1 top-1 bottom-1 flex flex-col">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-4 px-1 hover:bg-accent"
            onClick={handleIncrement}
            disabled={value >= max}
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-4 px-1 hover:bg-accent"
            onClick={handleDecrement}
            disabled={value <= min}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
    </div>
  );
}
