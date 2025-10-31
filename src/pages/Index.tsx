import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Scroll } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ErrorToastContent } from '@/components/ui/error-toast-content';
import { useNotionService } from '@/hooks/useNotionService';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { EdgeFunctionError } from '@/components/ui/edge-function-error';
import { AppSidebar } from '@/components/AppSidebar';
import { EncounterParams, NotionEncounterParams, GeneratedEncounter } from '@/types/encounter';
import { EncounterSkeleton } from '@/components/ui/encounter-skeleton';
import { useProgressiveGeneration } from '@/hooks/useProgressiveGeneration';
import { LootSidebar } from '@/components/LootSidebar';
import { TabDocument, TabData } from '@/types/tabs';
import { TabBar } from '@/components/ui/tab-bar';
import { EncounterView } from '@/components/EncounterView';
import { MagicItemsView } from '@/components/MagicItemsView';
import { EmptyTabView } from '@/components/EmptyTabView';
import { FloatingProgressBar } from '@/components/floating-progress-bar';

const Index = () => {
  const componentMountTimeRef = useRef(performance.now());
  const isMountedRef = useRef(true);
  const timeoutIdsRef = useRef<NodeJS.Timeout[]>([]);
  const tabCounterRef = useRef(1);

  useEffect(() => {
    console.log('📍 Index component mounted');
    isMountedRef.current = true;

    return () => {
      console.log('🧹 Index component cleanup - clearing timeouts');
      isMountedRef.current = false;

      // Clear all pending timeouts
      timeoutIdsRef.current.forEach(id => clearTimeout(id));
      timeoutIdsRef.current = [];
    };
  }, []);

  const { toast } = useToast();
  const notionService = useNotionService();

  const [params, setParams] = useState<EncounterParams>({
    environment: ['Any'],
    xpThreshold: 1000,
    maxMonsters: 6,
    alignment: ['Any'],
    creatureType: ['Any'],
    creatureSubtype: [],
    size: ['Any'],
    minCR: 0,
    maxCR: 20
  });

  // Tab system state
  const [tabs, setTabs] = useState<TabDocument[]>([
    {
      id: 'tab-0',
      type: 'empty',
      title: 'Welcome',
      data: { type: 'empty' },
      createdAt: Date.now()
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-0');

  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // New progressive generation system
  const {
    startGeneration,
    markStepComplete,
    completeGeneration,
    cancelGeneration,
    currentProgress,
    currentStatus,
    isActive: isGenerating
  } = useProgressiveGeneration();

  // Session selection state
  const [selectedSession, setSelectedSession] = useState<{id: string, name: string} | null>(null);

  // Campaign selection state with persistence
  const [selectedCampaign, setSelectedCampaign] = useState<{id: string, name: string, active: boolean} | null>(() => {
    try {
      const saved = localStorage.getItem('selectedCampaign');
      return saved ? JSON.parse(saved) : null;
    } catch (err) {
      console.error('Failed to parse selectedCampaign from localStorage:', err);
      return null;
    }
  });

  // Persist campaign selection to localStorage
  useEffect(() => {
    if (selectedCampaign) {
      localStorage.setItem('selectedCampaign', JSON.stringify(selectedCampaign));
    } else {
      localStorage.removeItem('selectedCampaign');
    }
  }, [selectedCampaign]);

  // Tab management functions
  const createNewTab = (type: TabDocument['type'], title: string, data: TabData): string => {
    const newTabId = `tab-${tabCounterRef.current++}`;
    const newTab: TabDocument = {
      id: newTabId,
      type,
      title,
      data,
      createdAt: Date.now()
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
    return newTabId;
  };

  const updateTab = (tabId: string, updates: Partial<TabDocument>) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, ...updates } : tab
    ));
  };

  const closeTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();

    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);

      // If we're closing the active tab, switch to another tab
      if (tabId === activeTabId) {
        const tabIndex = prev.findIndex(t => t.id === tabId);
        if (filtered.length > 0) {
          const newActiveIndex = Math.max(0, Math.min(tabIndex, filtered.length - 1));
          setActiveTabId(filtered[newActiveIndex].id);
        }
      }

      // Always keep at least one empty tab
      if (filtered.length === 0) {
        const emptyTab: TabDocument = {
          id: `tab-${tabCounterRef.current++}`,
          type: 'empty',
          title: 'Welcome',
          data: { type: 'empty' },
          createdAt: Date.now()
        };
        setActiveTabId(emptyTab.id);
        return [emptyTab];
      }

      return filtered;
    });
  };

  const handleNewTab = () => {
    createNewTab('empty', 'New Tab', { type: 'empty' });
  };

  const handleGenerate = async () => {
    console.log('handleGenerate called');

    if (!isMountedRef.current) {
      console.log('Component not mounted, returning');
      return;
    }

    if (!params.environment || params.environment.length === 0 || params.xpThreshold <= 0) {
      toast({
        title: "Missing Parameters",
        description: "Please select an environment and set a valid XP threshold.",
        variant: "destructive"
      });
      return;
    }

    // Create a new tab for this generation
    const environmentName = params.environment.length === 1
      ? params.environment[0]
      : params.environment.join(', ');
    const tabId = createNewTab('encounter', `${environmentName} Encounter`, {
      type: 'encounter',
      encounter: null as any,
      monsterCardTabs: {}
    });

    const startTime = performance.now();
    const controller = new AbortController();
    setAbortController(controller);

    startGeneration();

    try {
      if (!isMountedRef.current) return;

      // Mark initial steps
      const timeout1 = setTimeout(() => {
        if (isMountedRef.current) markStepComplete('notion-connect');
      }, 200);
      timeoutIdsRef.current.push(timeout1);

      const timeout2 = setTimeout(() => {
        if (isMountedRef.current) markStepComplete('validate-dbs');
      }, 400);
      timeoutIdsRef.current.push(timeout2);

      const notionParams: NotionEncounterParams = {
        environment: params.environment,
        minCR: params.minCR.toString(),
        maxCR: params.maxCR.toString(),
        xpThreshold: params.xpThreshold,
        maxMonsters: params.maxMonsters,
        alignment: params.alignment.includes('Any') ? undefined : params.alignment,
        creatureType: params.creatureType.includes('Any') ? undefined : params.creatureType,
        creatureSubtype: params.creatureSubtype.length > 0 ? params.creatureSubtype : undefined,
        size: params.size.includes('Any') ? undefined : params.size,
      };

      const timeout3 = setTimeout(() => {
        if (isMountedRef.current) markStepComplete('fetch-creatures');
      }, 600);
      timeoutIdsRef.current.push(timeout3);

      const result = await notionService.generateEncounter(notionParams, controller.signal);

      if (!isMountedRef.current) return;

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Unknown error during encounter generation');
      }

      markStepComplete('resolve-relations');
      markStepComplete('process-creatures');
      markStepComplete('generate-encounter');

      if (controller.signal.aborted) return;

      const encounterData = (result.data as any)?.encounter;

      if (!encounterData || !Array.isArray(encounterData.creatures)) {
        throw new Error('Failed to generate encounter - invalid or missing data structure.');
      }

      if (encounterData.creatures.length === 0) {
        // If no creatures found and environment is NOT "Any", try again with "Any"
        if (!params.environment.includes('Any') && params.environment.length > 0) {
          console.log('No creatures found with specific environment. Retrying with "Any" environment...');

          toast({
            title: "Retrying with Any Environment",
            description: `No creatures found in ${params.environment.join(', ')}. Trying any environment...`,
          });

          // Retry with "Any" environment
          const fallbackParams: NotionEncounterParams = {
            ...notionParams,
            environment: ['Any']
          };

          const fallbackResult = await notionService.generateEncounter(fallbackParams, controller.signal);

          if (!isMountedRef.current) return;

          if (fallbackResult.success && fallbackResult.data) {
            const fallbackEncounterData = (fallbackResult.data as any)?.encounter;

            if (fallbackEncounterData && Array.isArray(fallbackEncounterData.creatures) && fallbackEncounterData.creatures.length > 0) {
              // Success with fallback! Continue with this data
              console.log('Successfully generated encounter with "Any" environment');

              const transformedEncounter: GeneratedEncounter = {
                encounter_name: `Any Environment Encounter`,
                environment: fallbackEncounterData.environment || 'Any',
                difficulty: fallbackEncounterData.difficulty,
                total_xp: fallbackEncounterData.totalXP || 0,
                total_gold: fallbackEncounterData.totalGold || 0,
                creatures: fallbackEncounterData.creatures.map((creature: any) => ({
                  id: creature.id,
                  name: creature.name || 'Unknown Creature',
                  quantity: creature.quantity || 1,
                  challenge_rating: creature.cr || '0',
                  xp_value: creature.xp || 0,
                  total_xp: (creature.xp || 0) * (creature.quantity || 1),
                  image_url: creature.imageUrl,
                  creature_type: creature.type || 'Unknown',
                  creature_subtype: creature.subtype,
                  size: creature.size || 'Medium',
                  alignment: creature.alignment || 'Unaligned',
                  treasure_type: creature.treasure_type,
                  gold: creature.totalGold || creature.gold || 0,
                  goldRoll: creature.goldRoll
                })),
                generation_notes: fallbackEncounterData.notes || ''
              };

              const initialTabStates: Record<string, string | null> = {};
              transformedEncounter.creatures.forEach((creature, creatureIndex) => {
                for (let instanceIndex = 0; instanceIndex < creature.quantity; instanceIndex++) {
                  const cardKey = `${creatureIndex}-${instanceIndex}`;
                  initialTabStates[cardKey] = "loot";
                }
              });

              const endTime = performance.now();
              const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);

              updateTab(tabId, {
                data: { type: 'encounter', encounter: transformedEncounter, monsterCardTabs: initialTabStates },
                generationTime: parseFloat(elapsedSeconds)
              });

              completeGeneration();

              toast({
                title: "Encounter Generated!",
                description: `Generated with "Any" environment - ${transformedEncounter.total_xp} XP in ${elapsedSeconds}s`,
              });

              return; // Exit successfully
            }
          }
        }

        // If we get here, the fallback also failed or wasn't applicable
        const hints = [];
        if (params.minCR > 0 || params.maxCR < 30) {
          hints.push(`CR range: ${params.minCR}-${params.maxCR}`);
        }
        if (!params.environment.includes('Any') && params.environment.length > 0) {
          hints.push(`Environment: ${params.environment.join(', ')}`);
        }
        if (!params.creatureType.includes('Any') && params.creatureType.length > 0) {
          hints.push(`Type: ${params.creatureType.join(', ')}`);
        }

        const hintText = hints.length > 0 ? `Active filters: ${hints.join(', ')}\n\n` : '';
        const diagnosticNotes = encounterData.notes || '';

        throw new Error(`No creatures found matching your criteria.\n\n${hintText}${diagnosticNotes}\n\nCommon fixes:\n- Open your Monsters table in Notion\n- Check the "CR" column and ensure each monster has a linked Challenge Rating\n- The CR field should link to your "Challenge Ratings" table`);
      }

      const transformedEncounter: GeneratedEncounter = {
        encounter_name: `${environmentName} Encounter`,
        environment: encounterData.environment || environmentName,
        difficulty: encounterData.difficulty,
        total_xp: encounterData.totalXP || 0,
        total_gold: encounterData.totalGold || 0,
        creatures: encounterData.creatures.map((creature: any) => ({
          id: creature.id,
          name: creature.name || 'Unknown Creature',
          quantity: creature.quantity || 1,
          challenge_rating: creature.cr || '0',
          xp_value: creature.xp || 0,
          total_xp: (creature.xp || 0) * (creature.quantity || 1),
          image_url: creature.imageUrl,
          creature_type: creature.type || 'Unknown',
          creature_subtype: creature.subtype,
          size: creature.size || 'Medium',
          alignment: creature.alignment || 'Unaligned',
          treasure_type: creature.treasure_type,
          gold: creature.totalGold || creature.gold || 0,
          goldRoll: creature.goldRoll
        })),
        generation_notes: encounterData.notes || ''
      };

      // Initialize tab states for monster cards
      const initialTabStates: Record<string, string | null> = {};
      transformedEncounter.creatures.forEach((creature, creatureIndex) => {
        for (let instanceIndex = 0; instanceIndex < creature.quantity; instanceIndex++) {
          const cardKey = `${creatureIndex}-${instanceIndex}`;
          initialTabStates[cardKey] = "loot";
        }
      });

      const endTime = performance.now();
      const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);

      // Update the tab with the generated encounter
      updateTab(tabId, {
        data: { type: 'encounter', encounter: transformedEncounter, monsterCardTabs: initialTabStates },
        generationTime: parseFloat(elapsedSeconds)
      });

      completeGeneration();

      toast({
        title: "Encounter Generated!",
        description: `Generated an encounter with ${transformedEncounter.total_xp} XP in ${elapsedSeconds}s`,
      });

    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error');

      // Update tab with error
      updateTab(tabId, {
        error: errorObj
      });

      cancelGeneration();

      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
        return;
      }

      toast({
        title: "Generation Failed",
        description: <ErrorToastContent
          title="Generation Failed"
          message={errorObj.message}
          error={errorObj}
        />,
        variant: "destructive"
      });
    } finally {
      setAbortController(null);
    }
  };

  const handleGenerateMagicItems = async (rarities: string[], maxItems: number) => {
    console.log('handleGenerateMagicItems called with rarities:', rarities, 'maxItems:', maxItems);

    if (!isMountedRef.current) {
      console.log('Component not mounted, returning');
      return;
    }

    // Create a new tab for this generation
    const rarityText = rarities.length > 0 ? rarities.join(', ') : 'All';
    const tabId = createNewTab('magic-items', `Magic Items (${rarityText})`, {
      type: 'magic-items',
      items: []
    });

    const startTime = performance.now();

    try {
      startGeneration();

      let allItems: any[] = [];

      if (rarities.length === 0) {
        const result = await notionService.fetchMagicItems({});
        if (!result.success || !result.data?.magicItems) {
          throw new Error(result.error || 'Failed to fetch magic items');
        }
        allItems = result.data.magicItems;
      } else {
        for (const rarity of rarities) {
          const result = await notionService.fetchMagicItems({ rarity });
          if (result.success && result.data?.magicItems) {
            allItems = [...allItems, ...result.data.magicItems];
          }
        }
      }

      if (!isMountedRef.current) return;

      if (allItems.length === 0) {
        throw new Error('No magic items found with the selected rarities');
      }

      // Debug: Log sample items to check value field
      console.log('Total items fetched:', allItems.length);
      if (allItems.length > 0) {
        console.log('Sample item 1:', {
          name: allItems[0].name,
          value: allItems[0].value,
          valueType: typeof allItems[0].value,
          rarity: allItems[0].rarity
        });
        if (allItems.length > 1) {
          console.log('Sample item 2:', {
            name: allItems[1].name,
            value: allItems[1].value,
            valueType: typeof allItems[1].value,
            rarity: allItems[1].rarity
          });
        }
      }

      // Filter out items without value
      const itemsWithValue = allItems.filter(item => item.value && item.value > 0);

      console.log('Items with value > 0:', itemsWithValue.length);
      console.log('Items without value:', allItems.length - itemsWithValue.length);

      if (itemsWithValue.length === 0) {
        // Provide more diagnostic info
        const sampleWithoutValue = allItems.slice(0, 3).map(item => ({
          name: item.name,
          value: item.value,
          hasValue: !!item.value
        }));
        console.error('Sample items without value:', sampleWithoutValue);
        throw new Error(`No magic items found with gold values. Total items: ${allItems.length}, Items with value: ${itemsWithValue.length}. Check that your Magic Items table has the Value field properly configured as a number or formula.`);
      }

      // Weighted random selection based on rarity
      const getWeight = (item: any): number => {
        const rarity = item.rarity?.toLowerCase();
        const isWondrous = item.wondrous;

        // Base weights by rarity
        let weight = 1; // Common (base weight)

        switch (rarity) {
          case 'uncommon':
            weight = 0.1; // 10x less likely
            break;
          case 'rare':
            weight = 0.01; // 100x less likely
            break;
          case 'very rare':
            weight = 0.001; // 1000x less likely
            break;
          case 'legendary':
            weight = 0.0001; // 10,000x less likely
            break;
          case 'artifact':
            weight = 0.00001; // 100,000x less likely
            break;
        }

        // Wondrous items are 10,000x less likely
        if (isWondrous) {
          weight *= 0.0001;
        }

        return weight;
      };

      // Create weighted pool
      const weightedItems = itemsWithValue.map(item => ({
        item,
        weight: getWeight(item)
      }));

      // Calculate total weight
      const totalWeight = weightedItems.reduce((sum, wi) => sum + wi.weight, 0);

      // Select items using weighted random selection
      const selectedItems: any[] = [];
      const availableItems = [...weightedItems];

      for (let i = 0; i < Math.min(maxItems, availableItems.length); i++) {
        // Recalculate total weight for remaining items
        const currentTotalWeight = availableItems.reduce((sum, wi) => sum + wi.weight, 0);

        // Random value between 0 and total weight
        let random = Math.random() * currentTotalWeight;

        // Find the item that corresponds to this random value
        let selectedIndex = 0;
        for (let j = 0; j < availableItems.length; j++) {
          random -= availableItems[j].weight;
          if (random <= 0) {
            selectedIndex = j;
            break;
          }
        }

        // Add selected item and remove from available pool
        selectedItems.push(availableItems[selectedIndex].item);
        availableItems.splice(selectedIndex, 1);
      }

      // Sort selected items by value (gold) descending
      const limited = selectedItems.sort((a, b) => {
        const valueA = a.value || 0;
        const valueB = b.value || 0;
        return valueB - valueA;
      });

      // Debug: Log first item to check rarity data
      if (limited.length > 0) {
        console.log('Sample magic item:', limited[0]);
      }

      const endTime = performance.now();
      const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);

      // Update the tab with the generated items
      updateTab(tabId, {
        data: { type: 'magic-items', items: limited },
        generationTime: parseFloat(elapsedSeconds)
      });

      completeGeneration();

      toast({
        title: "Magic Items Generated!",
        description: `Found ${limited.length} magic items`,
      });
    } catch (error) {
      if (!isMountedRef.current) return;

      const errorObj = error instanceof Error ? error : new Error('Failed to generate magic items');

      updateTab(tabId, {
        error: errorObj
      });

      cancelGeneration();

      toast({
        title: "Generation Failed",
        description: errorObj.message,
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    if (abortController) {
      cancelGeneration();
      abortController.abort();
      setAbortController(null);

      toast({
        title: "Generation Cancelled",
        description: "Generation has been cancelled.",
        variant: "default"
      });
    }
  };

  const handleSaveEncounter = async () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.data.type !== 'encounter' || !activeTab.data.encounter || !isMountedRef.current) return;

    const encounter = activeTab.data.encounter;
    const result = await notionService.saveEncounter(encounter);

    if (!isMountedRef.current) return;

    if (!result.success) {
      toast({
        title: "Save Failed",
        description: result.error || "Failed to save encounter to Notion",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Encounter Saved!",
      description: "Successfully saved to Notion. Opening in new tab...",
    });

    if (result.data?.pageUrl) {
      window.open(result.data.pageUrl, '_blank');
    }
  };

  // Get active tab
  const activeTab = tabs.find(t => t.id === activeTabId);

  // Get encounter for loot sidebar (only if active tab is encounter type)
  const activeEncounter = activeTab?.data.type === 'encounter' ? activeTab.data.encounter : null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-b from-background to-muted">
        <AppSidebar
          params={params}
          setParams={setParams}
          onGenerate={handleGenerate}
          onGenerateMagicItems={handleGenerateMagicItems}
          onCancel={handleCancel}
          isGenerating={isGenerating}
          selectedCampaign={selectedCampaign}
          onCampaignChange={setSelectedCampaign}
        />

        <SidebarInset className="flex flex-col">
          {/* Tab Bar - Fixed at top */}
          <div className="flex-none border-b border-border bg-muted/30 pl-4 pr-2">
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onTabClick={setActiveTabId}
              onTabClose={closeTab}
              onNewTab={handleNewTab}
            />
          </div>

          {/* Main content area with horizontal layout - Scrollable */}
          <div className="flex flex-1 overflow-hidden">
            {/* Main content */}
            <main className="flex-1 overflow-y-auto p-6">
              <div className="max-w-7xl mx-auto w-full">
                {/* Active Tab Content */}
                {!activeTab ? (
                  <EmptyTabView />
                ) : (
                  <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-mystical">
                    <CardHeader className="p-4 sm:p-6 lg:p-8">
                      <CardTitle className="flex items-center gap-2 text-xl lg:text-2xl">
                        <Scroll className="h-5 w-5 lg:h-6 lg:w-6 text-accent" />
                        {activeTab.title}
                      </CardTitle>
                      {activeTab.type === 'empty' && (
                        <CardDescription>
                          Configure parameters in the sidebar and generate content from your Notion databases
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
                      {isGenerating ? (
                        <EncounterSkeleton />
                      ) : activeTab.error ? (
                        <EdgeFunctionError
                          error={activeTab.error}
                          operationName="generate content"
                          onRetry={() => {
                            updateTab(activeTab.id, { error: null });
                            if (activeTab.type === 'encounter') {
                              handleGenerate();
                            }
                          }}
                        />
                      ) : activeTab.data.type === 'encounter' && activeTab.data.encounter ? (
                        <EncounterView
                          encounter={activeTab.data.encounter}
                          environment={params.environment.join(', ')}
                          monsterCardTabs={activeTab.data.monsterCardTabs}
                          setMonsterCardTabs={(updater) => {
                            const newTabs = typeof updater === 'function'
                              ? updater(activeTab.data.type === 'encounter' ? activeTab.data.monsterCardTabs : {})
                              : updater;
                            updateTab(activeTab.id, {
                              data: { ...activeTab.data, monsterCardTabs: newTabs }
                            });
                          }}
                          selectedSession={selectedSession}
                          setSelectedSession={setSelectedSession}
                          selectedCampaign={selectedCampaign}
                          onSaveEncounter={handleSaveEncounter}
                        />
                      ) : activeTab.data.type === 'magic-items' && activeTab.data.items.length > 0 ? (
                        <MagicItemsView items={activeTab.data.items} />
                      ) : (
                        <EmptyTabView />
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </main>

            {/* Loot Sidebar */}
            <LootSidebar encounter={activeEncounter} />
          </div>
        </SidebarInset>

        {/* Floating Progress Bar */}
        <FloatingProgressBar
          isVisible={isGenerating}
          progress={currentProgress}
          statusText={currentStatus}
        />
      </div>
    </SidebarProvider>
  );
};

export default Index;
