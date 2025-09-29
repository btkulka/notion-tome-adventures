import React from 'react';
import { cn } from '@/lib/utils';

interface BaseCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'bordered' | 'elevated';
}

const cardVariants = {
  default: 'bg-card text-card-foreground',
  bordered: 'border rounded-lg p-4',
  elevated: 'bg-card text-card-foreground shadow-lg rounded-lg p-4'
};

export function BaseCard({ children, className, variant = 'bordered' }: BaseCardProps) {
  return (
    <div className={cn(cardVariants[variant], className)}>
      {children}
    </div>
  );
}

interface FlexContainerProps {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  gap?: 1 | 2 | 3 | 4 | 6 | 8;
  direction?: 'row' | 'col';
}

export function FlexContainer({ 
  children, 
  className, 
  align = 'center', 
  justify = 'start',
  gap = 2,
  direction = 'row'
}: FlexContainerProps) {
  const alignClass = {
    start: 'items-start',
    center: 'items-center', 
    end: 'items-end'
  }[align];

  const justifyClass = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around'
  }[justify];

  const gapClass = `gap-${gap}`;
  const directionClass = direction === 'col' ? 'flex-col' : 'flex';

  return (
    <div className={cn('flex', directionClass, alignClass, justifyClass, gapClass, className)}>
      {children}
    </div>
  );
}

interface SpacedContainerProps {
  children: React.ReactNode;
  className?: string;
  spacing?: 1 | 2 | 3 | 4 | 6 | 8;
  direction?: 'x' | 'y';
}

export function SpacedContainer({ 
  children, 
  className, 
  spacing = 4,
  direction = 'y' 
}: SpacedContainerProps) {
  const spaceClass = direction === 'x' ? `space-x-${spacing}` : `space-y-${spacing}`;
  
  return (
    <div className={cn(spaceClass, className)}>
      {children}
    </div>
  );
}