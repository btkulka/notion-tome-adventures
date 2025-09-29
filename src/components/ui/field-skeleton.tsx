import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface FieldSkeletonProps {
  className?: string;
  showLabel?: boolean;
  showOptions?: boolean;
  optionCount?: number;
  optionNames?: string[];
}

export function FieldSkeleton({ 
  className,
  showLabel = true,
  showOptions = true,
  optionCount = 4,
  optionNames = ['Option 1', 'Option 2', 'Option 3', 'Option 4']
}: FieldSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Label skeleton */}
      {showLabel && (
        <Skeleton className="h-4 w-24 bg-muted/50" />
      )}
      
      {/* Main field skeleton */}
      <div className="relative">
        <Skeleton className="h-12 w-full bg-gradient-to-r from-muted/50 via-muted/30 to-muted/50 animate-pulse" />
        <div className="absolute inset-0 flex items-center px-3">
          <Skeleton className="h-4 w-4 rounded-full bg-muted/60 mr-2" />
          <Skeleton className="h-4 w-32 bg-muted/60" />
        </div>
      </div>
      
      {/* Loading indicator with options preview */}
      {showOptions && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse" />
            <span>Loading options...</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {optionNames.slice(0, optionCount).map((option, idx) => (
              <Skeleton 
                key={option}
                className="h-5 bg-muted/40 animate-pulse"
                style={{ 
                  width: `${option.length * 8 + 16}px`,
                  animationDelay: `${idx * 100}ms`
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface SelectFieldSkeletonProps {
  label?: string;
  previewOptions?: string[];
  className?: string;
}

export function SelectFieldSkeleton({ 
  label,
  previewOptions = ['Forest', 'Desert', 'Mountain', 'Coastal'],
  className 
}: SelectFieldSkeletonProps) {
  return (
    <FieldSkeleton
      className={className}
      showLabel={!!label}
      showOptions={true}
      optionCount={previewOptions.length}
      optionNames={previewOptions}
    />
  );
}

// Specific skeleton for environment loading
export function EnvironmentSkeleton({ className }: { className?: string }) {
  return (
    <SelectFieldSkeleton
      className={className}
      previewOptions={['Forest', 'Desert', 'Mountain', 'Coastal', 'Urban', 'Swamp']}
    />
  );
}

// Specific skeleton for creature type loading
export function CreatureTypeSkeleton({ className }: { className?: string }) {
  return (
    <SelectFieldSkeleton
      className={className}
      previewOptions={['Beast', 'Dragon', 'Humanoid', 'Undead', 'Fiend']}
    />
  );
}
