import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Core layout components for consistent app structure
 */

// Main application layout with sidebar and content area
interface AppLayoutProps {
  sidebar: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AppLayout({ sidebar, header, children, className = "" }: AppLayoutProps) {
  return (
    <div className={cn("min-h-screen flex w-full bg-gradient-to-b from-background to-muted", className)}>
      {sidebar}
      
      <div className="flex-1 flex flex-col">
        {header && (
          <header className="h-14 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            {header}
          </header>
        )}
        
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

// Container with consistent padding and max-width
interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: 'sm' | 'md' | 'lg';
}

export function PageContainer({ 
  children, 
  className = "",
  size = 'lg',
  padding = 'md'
}: PageContainerProps) {
  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'max-w-2xl';
      case 'md': return 'max-w-4xl';
      case 'lg': return 'max-w-6xl';
      case 'xl': return 'max-w-7xl';
      case 'full': return 'max-w-full';
      default: return 'max-w-6xl';
    }
  };

  const getPaddingClass = () => {
    switch (padding) {
      case 'sm': return 'px-4 py-4';
      case 'lg': return 'px-8 py-12';
      default: return 'px-6 py-8';
    }
  };

  return (
    <div className={cn(
      "container mx-auto",
      getSizeClass(),
      getPaddingClass(),
      className
    )}>
      {children}
    </div>
  );
}
