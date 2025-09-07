import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ExternalLink, FileText, X } from 'lucide-react';

interface MonsterCardContextMenuProps {
  children: React.ReactNode;
  monsterName: string;
  onOpenMonsterInstance?: () => void;
  onOpenMonsterData?: () => void;
}

export function MonsterCardContextMenu({ 
  children, 
  monsterName,
  onOpenMonsterInstance,
  onOpenMonsterData 
}: MonsterCardContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="w-full">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={onOpenMonsterInstance} className="cursor-pointer">
          <ExternalLink className="mr-2 h-4 w-4" />
          <span>Open Monster Instance in Notion</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={onOpenMonsterData} className="cursor-pointer">
          <FileText className="mr-2 h-4 w-4" />
          <span>Open Monster Data in Notion</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="cursor-pointer text-muted-foreground">
          <X className="mr-2 h-4 w-4" />
          <span>Cancel</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
