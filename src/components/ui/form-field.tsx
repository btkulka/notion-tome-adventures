import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LucideIcon } from 'lucide-react';

// Base form field styles used throughout the app
const fieldStyles = "bg-transparent border-0 border-b-2 border-border rounded-none px-0 py-3 focus:border-primary focus:ring-0 focus:outline-none hover:bg-primary/5 focus:bg-primary/10 transition-all duration-200";

interface BaseFieldProps {
  label: string;
  className?: string;
}

interface NumberFieldProps extends BaseFieldProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  min?: number;
  max?: number;
}

interface SelectFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
    icon?: LucideIcon;
  }>;
  placeholder?: string;
  disabled?: boolean;
}

export function NumberField({ label, value, onChange, placeholder, min, max, className = "" }: NumberFieldProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-sm font-semibold text-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        placeholder={placeholder}
        min={min}
        max={max}
        className={fieldStyles}
      />
    </div>
  );
}

export function IconSelectField({ 
  label, 
  value, 
  onChange, 
  options, 
  placeholder, 
  disabled = false,
  className = ""
}: SelectFieldProps) {
  const selectedOption = options.find(opt => opt.value === value);
  
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-sm font-semibold text-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={fieldStyles}>
          <SelectValue placeholder={placeholder}>
            {selectedOption && (
              <div className="flex items-center gap-2 text-foreground">
                {selectedOption.icon && <selectedOption.icon className="h-4 w-4" />}
                {selectedOption.label}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2 text-foreground">
                {option.icon && <option.icon className="h-4 w-4" />}
                {option.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function GridFormSection({ 
  title, 
  children, 
  cols = 2 
}: { 
  title: string; 
  children: React.ReactNode; 
  cols?: number;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-2">
        {title}
      </h3>
      <div className={`grid grid-cols-${cols} gap-4`}>
        {children}
      </div>
    </div>
  );
}
