import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, Star, Crown, Flame, ExternalLink, FileText, Drumstick } from 'lucide-react';

interface MagicItemCardProps {
  item: {
    id: string;
    name: string;
    rarity?: string;
    imageUrl?: string;
    attunement: boolean;
    consumable: boolean;
    wondrous: boolean;
    tags?: string[];
    value?: number;
    source?: string;
    itemUrl?: string;
  };
}

const getRarityColor = (rarity?: string) => {
  switch (rarity?.toLowerCase()) {
    case 'common':
      return 'bg-gray-500 dark:bg-gray-600';
    case 'uncommon':
      return 'bg-green-600 dark:bg-green-700';
    case 'rare':
      return 'bg-blue-600 dark:bg-blue-700';
    case 'very rare':
      return 'bg-purple-600 dark:bg-purple-700';
    case 'legendary':
      return 'bg-orange-600 dark:bg-orange-700';
    case 'artifact':
      return 'bg-red-600 dark:bg-red-700';
    default:
      return 'bg-gray-500 dark:bg-gray-600';
  }
};

const getRarityStyles = (rarity?: string) => {
  switch (rarity?.toLowerCase()) {
    case 'common':
      return {
        borderColor: 'rgb(209 213 219)', // gray-300
        glowColor: '209, 213, 219'
      };
    case 'uncommon':
      return {
        borderColor: 'rgb(34 197 94)', // green-500
        glowColor: '34, 197, 94'
      };
    case 'rare':
      return {
        borderColor: 'rgb(59 130 246)', // blue-500
        glowColor: '59, 130, 246'
      };
    case 'very rare':
      return {
        borderColor: 'rgb(168 85 247)', // purple-500
        glowColor: '168, 85, 247'
      };
    case 'legendary':
      return {
        borderColor: 'rgb(249 115 22)', // orange-500
        glowColor: '249, 115, 22'
      };
    case 'artifact':
      return {
        borderColor: 'rgb(239 68 68)', // red-500
        glowColor: '239, 68, 68'
      };
    default:
      return {
        borderColor: 'rgb(209 213 219)', // gray-300
        glowColor: '209, 213, 219'
      };
  }
};

const getRarityIcon = (rarity?: string) => {
  switch (rarity?.toLowerCase()) {
    case 'legendary':
    case 'artifact':
      return <Crown className="h-2.5 w-2.5" />;
    case 'very rare':
    case 'rare':
      return <Star className="h-2.5 w-2.5" />;
    default:
      return <Sparkles className="h-2.5 w-2.5" />;
  }
};

export function MagicItemCard({ item }: MagicItemCardProps) {
  const rarityStyles = getRarityStyles(item.rarity);

  return (
    <Card
      className="overflow-visible transition-all duration-500 border-l-2 border-t-0 border-r-0 border-b-0 relative group hover:scale-[1.02] bg-background/40 backdrop-blur-md hover:bg-background/60"
      style={{
        borderLeftColor: rarityStyles.borderColor,
        boxShadow: 'none',
        transformStyle: 'preserve-3d',
        transition: 'all 0.5s ease-in-out',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 10px 30px -5px rgba(${rarityStyles.glowColor}, 0.4)`;
        e.currentTarget.style.transform = 'scale(1.02) rotateX(2deg) rotateY(-1deg)';
        e.currentTarget.style.backgroundColor = 'rgba(var(--background), 0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'scale(1) rotateX(0deg) rotateY(0deg)';
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {/* Shimmer overlay - always animating on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none overflow-hidden"
      >
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(110deg, transparent 20%, rgba(${rarityStyles.glowColor}, 0.15) 40%, rgba(${rarityStyles.glowColor}, 0.25) 50%, rgba(${rarityStyles.glowColor}, 0.15) 60%, transparent 80%)`,
            animation: 'shimmer 2.5s ease-in-out infinite',
          }}
        />
      </div>

      {/* Pulse glow border effect */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-60 transition-opacity duration-500 pointer-events-none"
        style={{
          boxShadow: `inset 0 0 20px rgba(${rarityStyles.glowColor}, 0.3)`,
          animation: 'pulse-glow 2s ease-in-out infinite',
        }}
      />

      <div className="flex relative z-10">
        {/* Image */}
        {item.imageUrl && (
          <div className="relative w-12 h-12 bg-muted overflow-hidden shrink-0">
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-1.5 flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between gap-1 mb-0.5">
            <div className="flex-1">
              <div className="flex items-center gap-0.5">
                <h3 className="text-[11px] font-semibold leading-tight">{item.name}</h3>
                <TooltipProvider>
                  <div className="flex items-center gap-0.5">
                    {item.attunement && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <Flame className="h-2.5 w-2.5 text-orange-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Requires Attunement</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {item.consumable && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <Drumstick className="h-2.5 w-2.5 text-amber-600 dark:text-amber-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Consumable</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {item.wondrous && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <Crown className="h-2.5 w-2.5 text-purple-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Wondrous Item</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TooltipProvider>
              </div>
            </div>

            {/* Action buttons */}
            <TooltipProvider>
              <div className="flex gap-0.5 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => {
                        const dndBeyondUrl = `https://www.dndbeyond.com/magic-items/${item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
                        window.open(dndBeyondUrl, '_blank');
                      }}
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open in D&D Beyond</p>
                  </TooltipContent>
                </Tooltip>

                {item.itemUrl && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => window.open(item.itemUrl, '_blank')}
                      >
                        <FileText className="h-2.5 w-2.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Open in Notion</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
          </div>

          {/* Properties and Tags */}
          <div className="flex flex-wrap gap-0.5 mb-0.5">
            {/* Rarity badge first */}
            {item.rarity && (
              <div
                className="inline-flex items-center gap-0.5 rounded-full px-1 py-0 text-[9px] font-semibold"
                style={{
                  backgroundColor: getRarityStyles(item.rarity).borderColor,
                  color: 'white'
                }}
              >
                {getRarityIcon(item.rarity)}
                {item.rarity}
              </div>
            )}
            {item.tags && item.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-[8px] px-1 py-0 h-3.5">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-auto pt-0.5 border-t border-white/20">
            {item.value !== undefined && (
              <span className="font-semibold text-yellow-600 dark:text-yellow-500">
                {item.value.toLocaleString()} gp
              </span>
            )}
            {item.source && (
              <span className="text-[9px] italic">
                {item.source}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
