import React from 'react';
import { X, Plus, Scroll, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TabDocument } from '@/types/tabs';
import { Button } from './button';

interface TabBarProps {
  tabs: TabDocument[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string, e: React.MouseEvent) => void;
  onNewTab: () => void;
}

export function TabBar({ tabs, activeTabId, onTabClick, onTabClose, onNewTab }: TabBarProps) {
  const getTabIcon = (type: TabDocument['type']) => {
    switch (type) {
      case 'encounter':
        return <Scroll className="h-3 w-3" />;
      case 'magic-items':
        return <Sparkles className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-1 pt-2 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            className={cn(
              'group relative flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-md transition-all',
              'hover:bg-background/80',
              isActive
                ? 'bg-background text-foreground border-t border-x border-border'
                : 'bg-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {getTabIcon(tab.type)}
            <span className="max-w-[150px] truncate">{tab.title}</span>
            <button
              onClick={(e) => onTabClose(tab.id, e)}
              className={cn(
                'ml-1 rounded-sm p-0.5 hover:bg-muted-foreground/20',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                isActive && 'opacity-100'
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </button>
        );
      })}
      <Button
        variant="ghost"
        size="sm"
        onClick={onNewTab}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
