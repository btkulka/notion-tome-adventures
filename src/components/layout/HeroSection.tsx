import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Hero section component with customizable styling
 */

interface HeroSectionProps {
  backgroundImage?: string;
  title: string;
  subtitle?: string;
  height?: 'sm' | 'md' | 'lg' | 'xl';
  overlay?: 'light' | 'dark';
  className?: string;
}

export function HeroSection({ 
  backgroundImage, 
  title, 
  subtitle, 
  height = 'md',
  overlay = 'dark',
  className = ""
}: HeroSectionProps) {
  const getHeightClass = () => {
    switch (height) {
      case 'sm': return 'h-32';
      case 'lg': return 'h-80';
      case 'xl': return 'h-96';
      default: return 'h-64';
    }
  };

  const getOverlayClass = () => {
    switch (overlay) {
      case 'light': return 'bg-gradient-to-b from-white/60 to-white/80';
      default: return 'bg-gradient-to-b from-black/60 to-black/80';
    }
  };

  const getTextColor = () => {
    return overlay === 'light' ? 'text-black' : 'text-white';
  };

  return (
    <div 
      className={cn(
        "relative bg-cover bg-center",
        getHeightClass(),
        className
      )}
      style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined}
    >
      <div className={cn("absolute inset-0", getOverlayClass())} />
      <div className="relative z-10 flex items-center justify-center h-full">
        <div className="text-center">
          <h1 className={cn(
            "text-5xl font-bold mb-4 drop-shadow-lg",
            getTextColor()
          )}>
            {title}
          </h1>
          {subtitle && (
            <p className={cn(
              "text-xl drop-shadow-md",
              getTextColor(),
              overlay === 'light' ? 'text-black/80' : 'text-gold-200'
            )}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
