import React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, XCircle, Info } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  type?: 'error' | 'warning' | 'info';
  className?: string;
  showIcon?: boolean;
}

const typeStyles = {
  error: {
    container: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/50 dark:border-red-900/50',
    icon: XCircle
  },
  warning: {
    container: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-900/50',
    icon: AlertTriangle
  },
  info: {
    container: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/50 dark:border-blue-900/50',
    icon: Info
  }
};

export function ErrorMessage({ 
  message, 
  type = 'error', 
  className, 
  showIcon = true 
}: ErrorMessageProps) {
  const { container, icon: Icon } = typeStyles[type];

  return (
    <div className={cn(
      'text-xs border rounded-md px-3 py-2 flex items-center gap-2',
      container,
      className
    )}>
      {showIcon && <Icon className="h-3 w-3 flex-shrink-0" />}
      <span>{message}</span>
    </div>
  );
}