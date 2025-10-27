import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dice6, Swords, ExternalLink, ChevronRight, ChevronDown, FileText, Sparkles, Scroll, Menu } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ErrorToastContent } from '@/components/ui/error-toast-content';
import { useNotionService, NotionSession } from '@/hooks/useNotionService';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { EdgeFunctionError } from '@/components/ui/edge-function-error';
import { AppSidebar } from '@/components/AppSidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EncounterParams, NotionEncounterParams, GeneratedEncounter } from '@/types/encounter';
import { EncounterSkeleton } from '@/components/ui/encounter-skeleton';
import { MonsterCardContextMenu } from '@/components/ui/monster-card-context-menu';
import { FloatingProgressBar } from '@/components/floating-progress-bar';
import { AbilityScoresRadialChart } from '@/components/ui/ability-scores-radial-chart';
import { SessionSelect } from '@/components/ui/session-select';
import { useProgressiveGeneration } from '@/hooks/useProgressiveGeneration';
import { LootSidebar } from '@/components/LootSidebar';

const Index = () => {
  const componentMountTimeRef = useRef(performance.now());
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  const { toast } = useToast();
  const notionService = useNotionService();
  
  const [params, setParams] = useState<EncounterParams>({
    environment: 'Any',
    xpThreshold: 1000,
    maxMonsters: 6,
    alignment: 'Any',
    creatureType: 'Any',
    size: 'Any',
    minCR: 0,
    maxCR: 20
  });
  
  const [encounter, setEncounter] = useState<GeneratedEncounter | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isLogExpanded, setIsLogExpanded] = useState(false);
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);
  const [fatalError, setFatalError] = useState<Error | null>(null);
  const [generationTime, setGenerationTime] = useState<number | null>(null);
  // Tab state management for monster cards
  const [monsterCardTabs, setMonsterCardTabs] = useState<Record<string, string | null>>({});
  
  // New progressive generation system
  const {
    progressState,
    startGeneration,
    markStepComplete,
    completeGeneration,
    cancelGeneration,
    resetProgress,
    currentProgress,
    currentStatus,
    logs: progressLogs,
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
  
  // Track component lifecycle
  const isFirstRender = useRef(true);
  const renderCount = useRef(0);
  
  useEffect(() => {
    renderCount.current += 1;

    if (isFirstRender.current) {
      isFirstRender.current = false;
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

  const handleGenerate = async () => {
    if (!isMountedRef.current) return;
    
    if (!params.environment || params.environment === '' || params.xpThreshold <= 0) {
      toast({
        title: "Missing Parameters",
        description: "Please select an environment and set a valid XP threshold.",
        variant: "destructive"
      });
      return;
    }

    // Track generation time
    const startTime = performance.now();

    // Create new AbortController for this generation
    const controller = new AbortController();
    setAbortController(controller);

    // Start progressive generation
    startGeneration();

    // Reset logs, tab states, and generation time for new encounter
    setGenerationLogs([]);
    setMonsterCardTabs({});
    setGenerationTime(null);

    // Clear previous encounter at the start of generation
    setEncounter(null);

    try {
      if (!isMountedRef.current) return;
      
      // Mark initial steps as we prepare the request
      setTimeout(() => isMountedRef.current && markStepComplete('notion-connect'), 200);
      setTimeout(() => isMountedRef.current && markStepComplete('validate-dbs'), 400);
      
      const notionParams: NotionEncounterParams = {
        environment: params.environment === 'Any' ? 'Any' : params.environment,
        minCR: params.minCR.toString(),
        maxCR: params.maxCR.toString(),
        xpThreshold: params.xpThreshold,
        maxMonsters: params.maxMonsters,
        alignment: params.alignment === 'Any' ? undefined : params.alignment,
        creatureType: params.creatureType === 'Any' ? undefined : params.creatureType,
        size: params.size === 'Any' ? undefined : params.size,
      };
      
      // Mark that we're about to fetch creatures
      setTimeout(() => isMountedRef.current && markStepComplete('fetch-creatures'), 600);
      const result = await notionService.generateEncounter(notionParams, controller.signal);

      if (!isMountedRef.current) return;
      
      // Check if generation failed
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Unknown error during encounter generation');
      }

      // Mark processing steps as complete
      markStepComplete('resolve-relations');
      markStepComplete('process-creatures');
      markStepComplete('generate-encounter');

      // Check if the operation was cancelled
      if (controller.signal.aborted) {
        return;
      }

      // Transform the edge function response to match our GeneratedEncounter interface
      const encounterData = (result.data as any)?.encounter;

      console.log('[DEBUG] Encounter data received:', {
        hasEncounter: !!encounterData,
        hasCreatures: !!encounterData?.creatures,
        creatureCount: encounterData?.creatures?.length,
        totalXP: encounterData?.totalXP,
        firstCreature: encounterData?.creatures?.[0]
      });

      if (!encounterData || !Array.isArray(encounterData.creatures)) {
        console.error('[DEBUG] Invalid encounter data:', result.data);
        throw new Error(`Failed to generate encounter - invalid or missing data structure. ${result.data ? 'Data received but encounter structure is invalid.' : 'No data returned from generation.'}`);
      }

      if (encounterData.creatures.length === 0) {
        console.warn('[DEBUG] No creatures in encounter');
        throw new Error('No creatures found matching the specified criteria. Try adjusting your filters.');
      }

      // Transform the data structure to match GeneratedEncounter interface
      const transformedEncounter: GeneratedEncounter = {
        encounter_name: `${params.environment} Encounter`,
        environment: encounterData.environment || params.environment,
        difficulty: encounterData.difficulty,
        total_xp: encounterData.totalXP || 0,
        total_gold: encounterData.totalGold || 0,
        creatures: encounterData.creatures.map((creature: any, index: number) => {
          console.log(`[DEBUG] Transforming creature ${index}:`, creature);
          return {
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
          };
        }),
        generation_notes: encounterData.notes || ''
      };

      console.log('[DEBUG] Transformed encounter:', transformedEncounter);

      if (transformedEncounter.creatures && Array.isArray(transformedEncounter.creatures)) {
        // Calculate generation time
        const endTime = performance.now();
        const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(2);
        setGenerationTime(parseFloat(elapsedSeconds));

        setEncounter(transformedEncounter);
        setFatalError(null);
        completeGeneration();
        setGenerationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Successfully generated encounter with ${transformedEncounter.total_xp} XP in ${elapsedSeconds}s`]);

        // Initialize tab states for all monster cards (default to "loot" tab)
        const initialTabStates: Record<string, string | null> = {};
        transformedEncounter.creatures.forEach((creature, creatureIndex) => {
          for (let instanceIndex = 0; instanceIndex < creature.quantity; instanceIndex++) {
            const cardKey = `${creatureIndex}-${instanceIndex}`;
            initialTabStates[cardKey] = "loot";
          }
        });
        setMonsterCardTabs(initialTabStates);

        toast({
          title: "Encounter Generated!",
          description: `Generated an encounter with ${transformedEncounter.total_xp} XP in ${elapsedSeconds}s`,
        });
      }
    } catch (error: unknown) {
      // Clear encounter on error and set fatal error
      setEncounter(null);

      // Create detailed error with stack trace
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      const timestamp = new Date().toISOString();
      const detailedError = new Error(
        `${errorObj.message}\n\nContext:\n- Timestamp: ${timestamp}\n- Environment: ${params.environment}\n- XP Threshold: ${params.xpThreshold}\n- Max Monsters: ${params.maxMonsters}\n${errorObj.stack ? `\nStack Trace:\n${errorObj.stack}` : ''}`
      );
      detailedError.stack = errorObj.stack;

      setFatalError(detailedError);
      cancelGeneration();
      setGenerationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Generation failed: ${errorObj.message}`]);

      // Don't show error if operation was cancelled - the cancel handler already showed feedback
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
        return; // Don't show additional toast - already handled in handleCancel
      }
      const errorMessage = errorObj.message;
      
      // Check if this is an environment-related error and show detailed info
      if (errorMessage.includes('No creatures found for environment') && errorMessage.includes('Available environments:')) {
        const envListMatch = errorMessage.match(/Available environments: (.+)$/);
        const availableEnvs = envListMatch ? envListMatch[1] : 'Unknown';

        toast({
          title: "No Creatures Found",
          description: <ErrorToastContent
            title="No Creatures Found"
            message={`No creatures available for "${params.environment}". Available: ${availableEnvs}`}
            error={detailedError}
          />,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Generation Failed",
          description: <ErrorToastContent
            title="Generation Failed"
            message={errorMessage}
            error={detailedError}
          />,
          variant: "destructive"
        });
      }
    } finally {
      // Clean up abort controller
      setAbortController(null);
    }
  };

  const handleCancel = () => {
    if (abortController) {
      
      // Cancel progressive generation
      cancelGeneration();
      
      // Add cancellation log
      setGenerationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🚫 Generation cancelled by user`]);
      
      // Abort the request
      abortController.abort();
      
      // Clear the controller
      setAbortController(null);
      
      // Show immediate feedback
      toast({
        title: "Generation Cancelled",
        description: "Encounter generation has been cancelled.",
        variant: "default"
      });
    }
  };

  const handleSaveEncounter = async () => {
    if (!encounter || !isMountedRef.current) return;
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
    
    // Open the new Notion page in a new tab
    if (result.data?.pageUrl) {
      window.open(result.data.pageUrl, '_blank');
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-b from-background to-muted">
        <AppSidebar
          params={params}
          setParams={setParams}
          onGenerate={handleGenerate}
          onCancel={handleCancel}
          isGenerating={isGenerating}
          selectedCampaign={selectedCampaign}
          onCampaignChange={setSelectedCampaign}
        />
        
        <SidebarInset>
          {/* Sidebar trigger for proper margin */}
          <div className="absolute top-4 left-2 z-10">
            <SidebarTrigger className="h-8 w-8" />
          </div>

          {/* Main content - no header */}
          <div className="flex flex-1 overflow-hidden h-screen">
            <main className="flex-1 overflow-auto p-6">
              <div className="max-w-7xl mx-auto w-full">
                {/* Fatal Error Display */}
                {fatalError && (
                  <EdgeFunctionError
                    error={fatalError}
                    operationName="generate encounter"
                    onRetry={() => {
                      setFatalError(null);
                      handleGenerate();
                    }}
                    className="mb-6"
                  />
                )}
                
                {/* Encounter Stats Section */}
                {encounter && (
                  <div className="mb-6 lg:mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <Swords className="h-6 w-6 lg:h-7 lg:w-7 text-accent" />
                      <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                        {encounter.encounter_name || 'Generated Encounter'}
                      </h1>
                      <div className="ml-auto flex items-center gap-3">
                        <div className="min-w-[200px]">
                          <SessionSelect
                            value={selectedSession}
                            onValueChange={setSelectedSession}
                            placeholder={selectedCampaign ? "Select session..." : "Select a campaign first..."}
                            campaignId={selectedCampaign?.id}
                          />
                        </div>
                        <Button
                          onClick={handleSaveEncounter}
                          className="btn-mystical flex items-center gap-2"
                          size="sm"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Export to Notion
                        </Button>
                      </div>
                    </div>
                    
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent mb-6"></div>
                    
                    <TooltipProvider>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-center cursor-help">
                              <div className="text-sm text-muted-foreground mb-1">Environment</div>
                              <div className="font-semibold text-accent">{params.environment}</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>The environment where this encounter takes place</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-center cursor-help">
                              <div className="text-sm text-muted-foreground mb-1">Total XP</div>
                              <div className="font-semibold text-accent">{encounter.total_xp.toLocaleString()}</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Total experience points awarded for defeating all creatures</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-center cursor-help">
                              <div className="text-sm text-muted-foreground mb-1">Creatures</div>
                              <div className="font-semibold text-accent">
                                {encounter.creatures.reduce((total, creature) => total + creature.quantity, 0)}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Total number of individual creatures in this encounter</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-center cursor-help">
                              <div className="text-sm text-muted-foreground mb-1">Unique Types</div>
                              <div className="font-semibold text-accent">
                                {encounter.creatures.length}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Number of different creature types in this encounter</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </div>
                )}

                {/* Results */}
                <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-mystical">
                <CardHeader className="p-4 sm:p-6 lg:p-8">
                  <CardTitle className="flex items-center gap-2 text-xl lg:text-2xl">
                    <Scroll className="h-5 w-5 lg:h-6 lg:w-6 text-accent" />
                    {encounter ? "Monsters" : "Ready to Generate"}
                  </CardTitle>
                  {!encounter && (
                    <CardDescription>
                      Configure parameters in the sidebar and generate an encounter from your Notion databases
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
                  {isGenerating ? (
                    <EncounterSkeleton />
                  ) : encounter ? (
                    <div className="space-y-8">
                      <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                          {encounter.creatures.flatMap((creature, creatureIndex) => {
                            return Array.from({ length: creature.quantity }, (_, instanceIndex) => (
                              <MonsterCardContextMenu
                                key={`${creatureIndex}-${instanceIndex}`}
                                monsterName={creature.name}
                                onOpenMonsterInstance={() => {}}
                                onOpenMonsterData={() => {}}
                              >
                                <Card className="bg-gradient-to-br from-card to-muted/20 border-border/50 shadow-lg hover:shadow-mystical transition-all duration-300">
                                  {/* Context Bar */}
                                  <div className="h-1 bg-gradient-to-r from-accent/50 to-primary/50" />
                                  
                                  {/* Dropdown Menu */}
                                  <div className="p-1 flex justify-end">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 bg-black/30 hover:bg-black/50">
                                          <Menu className="h-3 w-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem 
                                          onClick={() => {
                                            // For now, we'll create a placeholder URL - in a real implementation
                                            // this would come from the creature data
                                            const statblockUrl = `https://www.dndbeyond.com/monsters/${creature.name.toLowerCase().replace(/\s+/g, '-')}`;
                                            window.open(statblockUrl, '_blank');
                                          }}
                                          className="cursor-pointer"
                                        >
                                          <FileText className="mr-2 h-4 w-4" />
                                          <span>Display Statblock</span>
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  
                                  {creature.image_url && (
                                    <div className="relative h-48 w-full overflow-hidden">
                                      <img 
                                        src={creature.image_url} 
                                        alt={creature.name}
                                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                      <div className="absolute top-2 right-2 flex gap-2">
                                        <Badge variant="secondary" className="bg-black/70 text-white">
                                          CR {creature.challenge_rating}
                                        </Badge>
                                        <Badge variant="secondary" className="bg-black/70 text-accent font-bold">
                                          {creature.xp_value} XP
                                        </Badge>
                                      </div>
                                    </div>
                                  )}
                                  <CardContent className="p-6">
                                    <div className="space-y-4">
                                      <div>
                                        <h4 className="font-bold text-lg text-foreground mb-3">{creature.name}</h4>
                                        <div className="flex flex-wrap gap-2">
                                          <Badge variant="outline" className="text-xs">
                                            {creature.size || 'Unknown Size'}
                                          </Badge>
                                          <Badge variant="outline" className="text-xs">
                                            {creature.creature_type || 'Unknown Type'}
                                          </Badge>
                                          {creature.creature_subtype && (
                                            <Badge variant="outline" className="text-xs bg-primary/10">
                                              {creature.creature_subtype}
                                            </Badge>
                                          )}
                                          <Badge variant="outline" className="text-xs">
                                            {creature.alignment || 'Unknown Alignment'}
                                          </Badge>
                                        </div>
                                      </div>
                                      
                                      <Separator />
                                      
                                      {(() => {
                                        // Generate stable ability scores based on creature properties
                                        const generateAbilityScores = (creatureName: string, cr: number, creatureType?: string) => {
                                          // Use creature name as seed for consistent scores
                                          const seed = creatureName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                                          const rng = (index: number) => ((seed + index * 7) % 10) + 1;
                                          
                                          // Base scores adjusted by CR
                                          const crBonus = Math.floor(cr / 3);
                                          const baseScores = {
                                            str: 10 + rng(0) + crBonus,
                                            dex: 10 + rng(1) + crBonus,
                                            con: 10 + rng(2) + crBonus,
                                            int: 10 + rng(3) + (creatureType?.includes('Dragon') ? 2 : 0),
                                            wis: 10 + rng(4) + crBonus,
                                            char: 10 + rng(5) + (creatureType?.includes('Fiend') ? 2 : 0)
                                          };

                                          // Cap at 20
                                          Object.keys(baseScores).forEach(key => {
                                            baseScores[key as keyof typeof baseScores] = Math.min(20, baseScores[key as keyof typeof baseScores]);
                                        });
                                        
                                        return baseScores;
                                      };

                                      // Use component-level tab state for this monster card
                                      const cardKey = `${creatureIndex}-${instanceIndex}`;
                                      const activeTab = monsterCardTabs[cardKey] || null;
                                      
                                      const handleTabClick = (value: string) => {
                                        const currentTab = monsterCardTabs[cardKey];
                                        if (currentTab === value) {
                                          // Collapse if same tab clicked
                                          setMonsterCardTabs(prev => ({
                                            ...prev,
                                            [cardKey]: null
                                          }));
                                        } else {
                                          // Expand new tab
                                          setMonsterCardTabs(prev => ({
                                            ...prev,
                                            [cardKey]: value
                                          }));
                                        }
                                      };                                        return (
                                          <div className="w-full">
                                            {/* Tab Headers */}
                                            <div className="grid w-full grid-cols-2 border border-border rounded-lg overflow-hidden">
                                              <button
                                                onClick={() => handleTabClick("loot")}
                                                className={`px-4 py-2 text-sm font-medium transition-colors ${
                                                  activeTab === "loot" 
                                                    ? "bg-primary text-primary-foreground" 
                                                    : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                                                }`}
                                              >
                                                Loot
                                              </button>
                                              <button
                                                onClick={() => handleTabClick("abilities")}
                                                className={`px-4 py-2 text-sm font-medium transition-colors border-l border-border ${
                                                  activeTab === "abilities" 
                                                    ? "bg-primary text-primary-foreground" 
                                                    : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                                                }`}
                                              >
                                                Abilities
                                              </button>
                                            </div>
                                            
                                            {/* Tab Content */}
                                            {activeTab && (
                                              <div className="mt-4 transition-all duration-200 ease-in-out">
                                                {activeTab === "loot" && (
                                                  <div className="py-4 bg-muted/30 rounded-lg border border-border/50">
                                                    <div className="space-y-3 px-4">
                                                      {/* Gold Badge */}
                                                      {creature.gold !== undefined && creature.gold > 0 && (
                                                        <div className="flex items-center justify-between p-3 rounded-md bg-gradient-to-br from-yellow-500/20 to-amber-600/20 border border-yellow-500/30">
                                                          <span className="text-sm font-semibold text-foreground">Gold</span>
                                                          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 font-bold">
                                                            {creature.gold} gp
                                                          </Badge>
                                                        </div>
                                                      )}
                                                      {creature.goldRoll && creature.goldRoll !== '0' && (
                                                        <div className="text-xs text-muted-foreground text-center">
                                                          Rolled: {creature.goldRoll}
                                                        </div>
                                                      )}
                                                      {creature.treasure_type && (
                                                        <div className="flex items-center justify-between p-3 rounded-md bg-card/50 border border-border/50">
                                                          <span className="text-sm font-semibold text-foreground">Treasure Type</span>
                                                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                                            {creature.treasure_type}
                                                          </Badge>
                                                        </div>
                                                      )}
                                                      {(!creature.gold || creature.gold === 0) && !creature.treasure_type && (
                                                        <div className="text-sm text-muted-foreground text-center py-4">
                                                          No loot available
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                )}
                                                {activeTab === "abilities" && (
                                                  <div className="flex justify-center bg-muted/30 rounded-lg border border-border/50 py-4">
                                                    <AbilityScoresRadialChart 
                                                      scores={generateAbilityScores(
                                                        creature.name, 
                                                        typeof creature.challenge_rating === 'string' 
                                                          ? parseFloat(creature.challenge_rating) 
                                                          : creature.challenge_rating,
                                                        creature.creature_type
                                                      )}
                                                    />
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </CardContent>
                                </Card>
                              </MonsterCardContextMenu>
                            ))
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <Dice6 className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
                      <p className="text-muted-foreground mb-4">
                        No encounter generated yet.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Configure your Notion integration and databases, then set your parameters and roll the dice!
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>

          {/* Loot Sidebar */}
          <LootSidebar encounter={encounter} />
        </div>

          {/* Expandable log panel */}
          {encounter && (
            <Collapsible 
              open={isLogExpanded} 
              onOpenChange={setIsLogExpanded}
              className="border-l border-slate-700/50 bg-slate-900/90 backdrop-blur-md"
            >
              <CollapsibleTrigger className="w-12 h-full flex items-center justify-center hover:bg-slate-700/20 transition-colors">
                <div className="flex flex-col items-center gap-2">
                  {isLogExpanded ? (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                  <div className="writing-mode-vertical text-sm text-slate-400 font-medium">
                    Generation Log
                  </div>
                  <FileText className="h-4 w-4 text-slate-400" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="w-80 h-full">
                <div className="p-4 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-accent" />
                    <h3 className="font-semibold text-slate-100">Generation Log</h3>
                  </div>
                  <ScrollArea className="flex-1 border border-slate-700/30 rounded-lg bg-slate-800/50">
                    <div className="p-4 space-y-2 font-mono text-sm">
                      {[...progressLogs, ...generationLogs].length > 0 ? (
                        [...progressLogs, ...generationLogs].map((log, index) => (
                          <div key={index} className="text-slate-200 leading-relaxed bg-slate-700/30 p-2 rounded border border-slate-600/20">
                            {log}
                          </div>
                        ))
                      ) : (
                        encounter?.generation_notes ? 
                          encounter.generation_notes.split('\n').map((note, index) => (
                            <div key={index} className="text-slate-200 leading-relaxed">
                              {note}
                            </div>
                          )) : (
                            <div className="text-slate-400 text-center py-8">
                              <p className="text-sm">Generation logs will appear here during encounter creation...</p>
                            </div>
                          )
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
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