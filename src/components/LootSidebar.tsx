import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Scroll, Coins, Sparkles } from 'lucide-react';
import { GeneratedEncounter } from '@/types/encounter';
import { MagicItemCard } from '@/components/MagicItemCard';

interface LootSidebarProps {
  encounter: GeneratedEncounter | null;
}

export function LootSidebar({ encounter }: LootSidebarProps) {
  if (!encounter || !encounter.creatures || encounter.creatures.length === 0) {
    return null;
  }

  // Calculate total gold
  const totalGold = encounter.total_gold || 0;

  // Collect all magic items from all instances
  const allMagicItems: MagicItemTreasure[] = [];
  encounter.creatures.forEach(creature => {
    if (creature.treasurePerInstance) {
      // Flatten all instance treasures
      creature.treasurePerInstance.forEach(instanceTreasure => {
        allMagicItems.push(...instanceTreasure);
      });
    } else if (creature.treasure) {
      // Fallback for legacy treasure
      allMagicItems.push(...creature.treasure);
    }
  });

  // Calculate total treasure value
  const totalTreasureValue = allMagicItems.reduce((sum, item) => sum + (item.value || 0), 0);
  const totalMagicItems = allMagicItems.length;

  return (
    <div className="w-1/6 border-l border-border bg-background/40 backdrop-blur-md overflow-y-auto h-screen">
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

          {/* Total Treasure Value Row */}
          {totalMagicItems > 0 && (
            <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-600/10 border border-purple-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  <span className="font-semibold text-foreground">Magic Items</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">{totalMagicItems} items</div>
                  <Badge variant="secondary" className="bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30 font-bold">
                    {totalTreasureValue.toLocaleString()} gp
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* All Magic Items */}
          {allMagicItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground px-1">Magic Items</h3>
              <div className="space-y-1">
                {allMagicItems.map((item, idx) => (
                  <MagicItemCard key={idx} item={item} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
