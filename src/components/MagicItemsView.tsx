import React from 'react';
import { Sparkles, Coins } from 'lucide-react';
import { MagicItemCard } from '@/components/MagicItemCard';
import { Card } from '@/components/ui/card';

interface MagicItemsViewProps {
  items: any[];
}

export function MagicItemsView({ items }: MagicItemsViewProps) {
  // Calculate total gold value
  const totalGold = items.reduce((sum, item) => sum + (item.value || 0), 0);
  const itemCount = items.length;

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-amber-600/10 border-yellow-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-yellow-500" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Magic Items Summary</h3>
              <p className="text-sm text-muted-foreground">{itemCount} items generated</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {totalGold.toLocaleString()} gp
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Magic Item Cards */}
      {items.map((item) => (
        <MagicItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
