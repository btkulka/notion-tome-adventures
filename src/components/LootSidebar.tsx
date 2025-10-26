import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Scroll, Coins, ChevronRight, ChevronLeft } from 'lucide-react';
import { GeneratedEncounter } from '@/types/encounter';

interface LootSidebarProps {
  encounter: GeneratedEncounter | null;
}

export function LootSidebar({ encounter }: LootSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!encounter || !encounter.creatures || encounter.creatures.length === 0) {
    return null;
  }

  // Calculate total gold
  const totalGold = encounter.total_gold || 0;

  if (isCollapsed) {
    return (
      <div className="relative border-l border-border bg-background/50 h-screen">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(false)}
          className="absolute top-4 -left-4 z-10 h-8 w-8 rounded-full bg-background border border-border shadow-lg hover:bg-accent"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-1/6 border-l border-border bg-background/50 overflow-y-auto h-screen">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsCollapsed(true)}
        className="absolute top-4 -left-4 z-10 h-8 w-8 rounded-full bg-background border border-border shadow-lg hover:bg-accent"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Card className="h-full rounded-none border-0 bg-transparent">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scroll className="h-5 w-5 text-accent" />
            All Loot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Total Gold Row */}
          <div className="p-3 rounded-lg bg-gradient-to-br from-yellow-500/10 to-amber-600/10 border border-yellow-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-yellow-500" />
                <span className="font-semibold text-foreground">Total Gold</span>
              </div>
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 font-bold text-base px-3">
                {totalGold.toLocaleString()} gp
              </Badge>
            </div>
          </div>

          {/* Individual Monster Loot */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground px-1">By Monster</h3>
            {encounter.creatures.map((creature, index) => {
              const gold = creature.gold || 0;
              const quantity = creature.quantity || 1;

              return (
                <div
                  key={`${creature.id}-${index}`}
                  className="px-1 py-2 rounded-md bg-card/50 border border-border/50 hover:border-accent/50 transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-foreground line-clamp-2">
                          {creature.name}
                        </span>
                        {quantity > 1 && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ×{quantity}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <Badge
                          variant="outline"
                          className="text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30"
                        >
                          {gold} gp
                        </Badge>
                        {creature.goldRoll && creature.goldRoll !== '0' && (
                          <span className="text-[9px] text-muted-foreground">
                            {creature.goldRoll}
                            {quantity > 1 && ` ×${quantity}`}
                          </span>
                        )}
                      </div>
                    </div>
                    {creature.treasure_type && (
                      <div className="text-[10px] text-muted-foreground">
                        Type: {creature.treasure_type}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
