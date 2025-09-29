import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { FieldSkeleton } from '@/components/ui/field-skeleton';
import { ErrorMessage } from '@/components/ui/error-message';
import { FlexContainer } from '@/components/ui/base-card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UI_CONSTANTS } from '@/lib/constants';

/**
 * Reusable form field components to reduce duplication
 * Provides consistent styling and behavior across forms
 */

// Base props for all form fields
interface BaseFieldProps {
  label: string;
  className?: string;
  disabled?: boolean;
}

// Enhanced select field with icon support
interface SelectFieldProps extends BaseFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  options: Array<{
    value: string;
    label: string;
    icon?: LucideIcon;
  }>;
  loading?: boolean;
  errorMessage?: string;
  skeletonOptions?: string[];
}

export function SelectField({
  label,
  value,
  onValueChange,
  placeholder = "Select option",
  options,
  className = "",
  disabled = false,
  loading = false,
  errorMessage,
  skeletonOptions
}: SelectFieldProps) {
  const selectedOption = options.find(opt => opt.value === value);

  if (loading) {
    return (
      <FieldSkeleton
        className={className}
        showLabel={true}
        showOptions={true}
        optionNames={skeletonOptions || ['Option 1', 'Option 2', 'Option 3', 'Option 4']}
      />
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label className={UI_CONSTANTS.FIELD_LABEL_STYLES}>
        {label}
      </Label>
      
      <Select 
        value={value} 
        onValueChange={onValueChange}
        disabled={disabled}
      >
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
      
      {errorMessage && (
        <ErrorMessage message={errorMessage} type="warning" />
      )}
    </div>
  );
}

// Number input field with consistent styling
interface NumberFieldProps extends BaseFieldProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  min?: number;
  max?: number;
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  className = "",
  disabled = false,
  min,
  max
}: NumberFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className={UI_CONSTANTS.FIELD_LABEL_STYLES}>
        {label}
      </Label>
      
      <div className="number-input-container">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          placeholder={placeholder}
          min={min}
          max={max}
          disabled={disabled}
          className="bg-transparent border-0 border-b-2 border-border rounded-none px-0 py-3 pr-8 text-foreground focus:border-primary focus:ring-0 focus:outline-none hover:bg-primary/5 focus:bg-primary/10 transition-all duration-200"
        />
      </div>
    </div>
  );
}

// Form section with consistent styling
interface FormSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, children, className = "" }: FormSectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <h3 className={UI_CONSTANTS.SECTION_TITLE_STYLES}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// Grid layout for form fields
interface FormGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

export function FormGrid({ children, columns = 2, className = "" }: FormGridProps) {
  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3'
  }[columns];

  return (
    <div className={cn("grid gap-4", gridClass, className)}>
      {children}
    </div>
  );
}
