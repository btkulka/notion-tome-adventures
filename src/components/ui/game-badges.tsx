import React from 'react';
import { Badge } from '@/components/ui/badge';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Difficulty badge with consistent styling and colors
interface DifficultyBadgeProps {
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Deadly';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function DifficultyBadge({ difficulty, className = "", size = 'md' }: DifficultyBadgeProps) {
  const getVariant = () => {
    switch (difficulty) {
      case 'Easy': return 'secondary';
      case 'Medium': return 'default';
      case 'Hard': return 'destructive';
      case 'Deadly': return 'destructive';
      default: return 'outline';
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'text-xs px-2 py-1';
      case 'lg': return 'text-lg px-4 py-2';
      default: return 'text-sm px-3 py-1.5';
    }
  };

  return (
    <Badge 
      variant={getVariant()} 
      className={cn(getSizeClass(), className)}
    >
      {difficulty}
    </Badge>
  );
}

// XP value badge with consistent formatting
interface XPBadgeProps {
  xp: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function XPBadge({ xp, className = "", size = 'md', showLabel = true }: XPBadgeProps) {
  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'text-xs px-2 py-1';
      case 'lg': return 'text-lg px-4 py-2';
      default: return 'text-sm px-3 py-1.5';
    }
  };

  const formatXP = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toString();
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(getSizeClass(), className)}
    >
      {formatXP(xp)}{showLabel ? ' XP' : ''}
    </Badge>
  );
}

// Challenge Rating badge
interface CRBadgeProps {
  cr: number | string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CRBadge({ cr, className = "", size = 'md' }: CRBadgeProps) {
  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'text-xs px-2 py-1';
      case 'lg': return 'text-lg px-4 py-2';
      default: return 'text-sm px-3 py-1.5';
    }
  };

  const formatCR = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num === 0.125) return '1/8';
    if (num === 0.25) return '1/4';
    if (num === 0.5) return '1/2';
    return num.toString();
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(getSizeClass(), className)}
    >
      CR {formatCR(cr)}
    </Badge>
  );
}

// Status badge with icon
interface StatusBadgeProps {
  status: 'loading' | 'success' | 'error' | 'warning' | 'info';
  text: string;
  icon?: LucideIcon;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ 
  status, 
  text, 
  icon: Icon, 
  className = "", 
  size = 'md' 
}: StatusBadgeProps) {
  const getVariant = () => {
    switch (status) {
      case 'success': return 'default';
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      case 'loading': return 'outline';
      case 'info': return 'outline';
      default: return 'outline';
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'text-xs px-2 py-1';
      case 'lg': return 'text-lg px-4 py-2';
      default: return 'text-sm px-3 py-1.5';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm': return 'h-3 w-3';
      case 'lg': return 'h-5 w-5';
      default: return 'h-4 w-4';
    }
  };

  return (
    <Badge 
      variant={getVariant()} 
      className={cn('flex items-center gap-1', getSizeClass(), className)}
    >
      {Icon && <Icon className={getIconSize()} />}
      {text}
    </Badge>
  );
}

// Environment badge with automatic icon
interface EnvironmentBadgeProps {
  environment: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function EnvironmentBadge({ 
  environment, 
  className = "", 
  size = 'md',
  showIcon = true 
}: EnvironmentBadgeProps) {
  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'text-xs px-2 py-1';
      case 'lg': return 'text-lg px-4 py-2';
      default: return 'text-sm px-3 py-1.5';
    }
  };

  // You could import the icon mapping from constants here
  // For now, simplified version without icons
  return (
    <Badge 
      variant="secondary" 
      className={cn('flex items-center gap-1', getSizeClass(), className)}
    >
      {environment}
    </Badge>
  );
}

// Quantity badge for creatures
interface QuantityBadgeProps {
  quantity: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function QuantityBadge({ quantity, className = "", size = 'md' }: QuantityBadgeProps) {
  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'text-xs px-2 py-1';
      case 'lg': return 'text-lg px-4 py-2';
      default: return 'text-sm px-3 py-1.5';
    }
  };

  if (quantity <= 1) return null;

  return (
    <Badge 
      variant="outline" 
      className={cn('rounded-full', getSizeClass(), className)}
    >
      {quantity}x
    </Badge>
  );
}

// Composite creature info badge
interface CreatureInfoBadgeProps {
  name: string;
  cr: number | string;
  xp: number;
  quantity?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  layout?: 'horizontal' | 'vertical';
}

export function CreatureInfoBadge({ 
  name, 
  cr, 
  xp, 
  quantity = 1,
  className = "", 
  size = 'md',
  layout = 'horizontal'
}: CreatureInfoBadgeProps) {
  const isHorizontal = layout === 'horizontal';
  
  return (
    <div className={cn(
      'flex items-center gap-2',
      isHorizontal ? 'flex-row' : 'flex-col',
      className
    )}>
      <span className={cn(
        'font-semibold',
        size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base'
      )}>
        {name}
      </span>
      
      <div className="flex items-center gap-2">
        {quantity > 1 && <QuantityBadge quantity={quantity} size={size} />}
        <CRBadge cr={cr} size={size} />
        <XPBadge xp={xp * quantity} size={size} />
      </div>
    </div>
  );
}
