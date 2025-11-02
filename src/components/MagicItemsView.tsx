import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Coins } from 'lucide-react';
import { MagicItemCard } from '@/components/MagicItemCard';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface MagicItemsViewProps {
  items: any[];
  title?: string;
  onTitleChange?: (newTitle: string) => void;
}

export function MagicItemsView({ items, title = "Magic Items Summary", onTitleChange }: MagicItemsViewProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Calculate total gold value
  const totalGold = items.reduce((sum, item) => sum + (item.value || 0), 0);
  const itemCount = items.length;

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleClick = () => {
    setIsEditingTitle(true);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (titleValue.trim() && titleValue !== title && onTitleChange) {
      onTitleChange(titleValue.trim());
    } else {
      setTitleValue(title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleBlur();
    } else if (e.key === 'Escape') {
      setTitleValue(title);
      setIsEditingTitle(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-amber-600/10 border-yellow-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-yellow-500" />
            <div>
              {isEditingTitle ? (
                <Input
                  ref={titleInputRef}
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={handleTitleKeyDown}
                  className="text-lg font-semibold h-auto px-2 py-1 border-2"
                />
              ) : (
                <h3
                  onClick={handleTitleClick}
                  className="text-lg font-semibold text-foreground cursor-pointer transition-all duration-200 hover:bg-primary/5 hover:shadow-[0_0_10px_rgba(var(--primary),0.3)] rounded px-2 -mx-2 py-1"
                >
                  {title}
                </h3>
              )}
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
