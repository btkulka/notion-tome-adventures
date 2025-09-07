import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

/**
 * Enhanced card components with consistent styling variants
 */

interface FeatureCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  variant?: 'default' | 'mystical' | 'elevated';
  className?: string;
}

export function FeatureCard({ 
  title, 
  description, 
  icon: Icon, 
  children, 
  variant = 'default',
  className = ""
}: FeatureCardProps) {
  const getVariantClass = () => {
    switch (variant) {
      case 'mystical': return 'bg-gradient-to-br from-card to-card/80 border-border/50 shadow-mystical';
      case 'elevated': return 'shadow-lg hover:shadow-xl transition-shadow duration-200';
      default: return '';
    }
  };

  return (
    <Card className={cn(getVariantClass(), className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          {Icon && <Icon className="h-6 w-6 text-accent" />}
          {title}
        </CardTitle>
        {description && (
          <CardDescription>
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}

// Results display area with empty state
interface ResultsAreaProps {
  title: string;
  description?: string;
  isEmpty: boolean;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function ResultsArea({
  title,
  description,
  isEmpty,
  emptyIcon: EmptyIcon,
  emptyTitle = "No results yet",
  emptyDescription = "Results will appear here when available",
  emptyActions,
  children,
  className = ""
}: ResultsAreaProps) {
  return (
    <FeatureCard
      title={title}
      description={description}
      variant="mystical"
      className={className}
    >
      {isEmpty ? (
        <div className="text-center py-12">
          {EmptyIcon && <EmptyIcon className="mx-auto h-16 w-16 text-muted-foreground mb-4" />}
          <p className="text-muted-foreground mb-2">
            {emptyTitle}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {emptyDescription}
          </p>
          {emptyActions}
        </div>
      ) : (
        children
      )}
    </FeatureCard>
  );
}
