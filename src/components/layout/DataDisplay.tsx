import React from 'react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

/**
 * Data display and list components with consistent styling
 */

// Data list with consistent item styling
interface DataListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  itemClassName?: string;
  divider?: boolean;
}

export function DataList<T>({ 
  items, 
  renderItem, 
  className = "",
  itemClassName = "",
  divider = false
}: DataListProps<T>) {
  return (
    <div className={cn("space-y-4", className)}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <div className={cn("transition-colors duration-200", itemClassName)}>
            {renderItem(item, index)}
          </div>
          {divider && index < items.length - 1 && <Separator />}
        </React.Fragment>
      ))}
    </div>
  );
}

// Info display with badges
interface InfoDisplayProps {
  title: string;
  subtitle?: string;
  badges?: Array<{
    text: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    icon?: LucideIcon;
  }>;
  children?: React.ReactNode;
  className?: string;
}

export function InfoDisplay({ 
  title, 
  subtitle, 
  badges = [], 
  children, 
  className = ""
}: InfoDisplayProps) {
  return (
    <div className={cn("p-4 bg-muted/50 rounded-lg border border-border/50", className)}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="font-semibold text-lg">{title}</h4>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        
        {badges.length > 0 && (
          <div className="flex gap-2">
            {badges.map((badge, index) => (
              <Badge key={index} variant={badge.variant || 'outline'}>
                {badge.icon && <badge.icon className="h-3 w-3 mr-1" />}
                {badge.text}
              </Badge>
            ))}
          </div>
        )}
      </div>
      
      {children}
    </div>
  );
}

// Generation log display
interface GenerationLogProps {
  notes: string;
  title?: string;
  height?: number;
  className?: string;
}

export function GenerationLog({ 
  notes, 
  title = "Generation Log", 
  height = 192, // 48 * 4 = h-48
  className = ""
}: GenerationLogProps) {
  const logLines = notes.split('\n').filter(line => line.trim());
  
  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-xl font-semibold text-accent">{title}</h3>
      <ScrollArea 
        className="p-4 bg-muted/50 rounded-lg border border-border/50"
        style={{ height: `${height}px` }}
      >
        <div className="space-y-2 font-mono text-sm">
          {logLines.map((line, index) => (
            <div key={index} className="text-muted-foreground">
              {line}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
