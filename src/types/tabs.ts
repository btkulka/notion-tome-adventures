import { GeneratedEncounter } from './encounter';

export type TabType = 'encounter' | 'magic-items' | 'empty';

export interface TabDocument {
  id: string;
  type: TabType;
  title: string;
  data: TabData;
  createdAt: number;
  error?: Error | null;
  generationTime?: number | null;
  logs?: string[];
}

export type TabData =
  | { type: 'encounter'; encounter: GeneratedEncounter; monsterCardTabs: Record<string, string | null> }
  | { type: 'magic-items'; items: any[] }
  | { type: 'empty' };

export interface TabsState {
  tabs: TabDocument[];
  activeTabId: string | null;
}
