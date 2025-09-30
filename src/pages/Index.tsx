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
import { useNotionService, NotionSession } from '@/hooks/useNotionService';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EncounterParams, NotionEncounterParams, GeneratedEncounter } from '@/types/encounter';
import { EncounterSkeleton } from '@/components/ui/encounter-skeleton';
import { MonsterCardContextMenu } from '@/components/ui/monster-card-context-menu';
import { FloatingProgressBar } from '@/components/floating-progress-bar';
import { AbilityScoresRadialChart } from '@/components/ui/ability-scores-radial-chart';
import { SessionSelect } from '@/components/ui/session-select';
import { encounterLogger, createLogger } from '@/utils/logger';
import { useProgressiveGeneration } from '@/hooks/useProgressiveGeneration';

const Index = () => {
  const componentMountTime = performance.now();
  const logger = createLogger('Index');
  
  logger.info('🎮 Index component mounting...');
  
  const { toast } = useToast();
  const { generateEncounter, saveEncounter, loading: generatingEncounter, error: generationError } = useNotionService();
  
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
  
  // Track component lifecycle
  const isFirstRender = useRef(true);
  const renderCount = useRef(0);
  
  useEffect(() => {
    renderCount.current += 1;
    
    if (isFirstRender.current) {
      const mountDuration = (performance.now() - componentMountTime).toFixed(2);
      logger.info(`✅ Index component mounted (${mountDuration}ms)`);
      logger.debug('Initial state:', {
        params,
        hasEncounter: !!encounter,
        isGenerating,
      });
      isFirstRender.current = false;
    }
    
    logger.debug(`Render #${renderCount.current}`, {
      generatingEncounter,
      hasEncounter: !!encounter,
      isGenerating,
      selectedSession: selectedSession?.name,
    });
  });
  
  // Track state changes
  useEffect(() => {
    if (encounter) {
      logger.info('📊 Encounter state updated:', {
        name: encounter.encounter_name,
        totalXP: encounter.total_xp,
        creatureCount: encounter.creatures.length,
      });
    }
  }, [encounter]);
  
  useEffect(() => {
    logger.debug('Generation state changed:', {
      generatingEncounter,
      isGenerating,
      hasAbortController: !!abortController,
    });
  }, [generatingEncounter, isGenerating, abortController]);

  const handleGenerate = async () => {
    if (!params.environment || params.environment === '' || params.xpThreshold <= 0) {
      toast({
        title: "Missing Parameters",
        description: "Please select an environment and set a valid XP threshold.",
        variant: "destructive"
      });
      return;
    }

    // Create new AbortController for this generation
    const controller = new AbortController();
    setAbortController(controller);
    
    // Start progressive generation
    startGeneration();
    
    // Reset logs and tab states for new encounter
    setGenerationLogs([]);
    setMonsterCardTabs({});
    
    // Clear previous encounter at the start of generation
    setEncounter(null);
    
    try {
      encounterLogger.encounter('Starting encounter generation', params);
      
      // Mark initial steps as we prepare the request
      setTimeout(() => markStepComplete('notion-connect'), 200);
      setTimeout(() => markStepComplete('validate-dbs'), 400);
      
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
      setTimeout(() => markStepComplete('fetch-creatures'), 600);
      
      encounterLogger.debug('Calling generateEncounter', notionParams);
      const result = await generateEncounter(notionParams, controller.signal);
      
      // Mark processing steps as complete
      markStepComplete('resolve-relations');
      markStepComplete('process-creatures');
      markStepComplete('generate-encounter');
      
      // Check if the operation was cancelled
      if (controller.signal.aborted) {
        encounterLogger.info('Encounter generation was cancelled');
        return;
      }
      
      encounterLogger.info('Encounter generation result', result);
      
      if (result) {
        setEncounter(result);
        completeGeneration();
        setGenerationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Successfully generated encounter with ${result.total_xp} XP`]);
        
        // Initialize tab states for all monster cards (default to "loot" tab)
        const initialTabStates: Record<string, string | null> = {};
        result.creatures.forEach((creature, creatureIndex) => {
          for (let instanceIndex = 0; instanceIndex < creature.quantity; instanceIndex++) {
            const cardKey = `${creatureIndex}-${instanceIndex}`;
            initialTabStates[cardKey] = "loot";
          }
        });
        setMonsterCardTabs(initialTabStates);
        
        toast({
          title: "Encounter Generated!",
          description: `Generated an encounter with ${result.total_xp} XP.`,
        });
      } else {
        throw new Error("Failed to generate encounter - no result returned");
      }
    } catch (error: unknown) {
      // Clear encounter on error
      setEncounter(null);
      cancelGeneration();
      setGenerationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
      
      // Don't show error if operation was cancelled - the cancel handler already showed feedback
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
        encounterLogger.info('Encounter generation was cancelled by user');
        return; // Don't show additional toast - already handled in handleCancel
      }
      
      encounterLogger.error('Encounter generation failed', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate encounter. Check your Notion configuration.";
      
      // Check if this is an environment-related error and show detailed info
      if (errorMessage.includes('No creatures found for environment') && errorMessage.includes('Available environments:')) {
        const envListMatch = errorMessage.match(/Available environments: (.+)$/);
        const availableEnvs = envListMatch ? envListMatch[1] : 'Unknown';
        
        toast({
          title: "No Creatures Found",
          description: `No creatures available for "${params.environment}". Available: ${availableEnvs}`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Generation Failed",
          description: errorMessage,
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
      encounterLogger.info('Cancelling encounter generation');
      
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
    if (!encounter) return;
    
    try {
      encounterLogger.info('Saving encounter to Notion');
      const result = await saveEncounter(encounter);
      
      toast({
        title: "Encounter Saved!",
        description: "Successfully saved to Notion. Opening in new tab...",
      });
      
      // Open the new Notion page in a new tab
      window.open(result.pageUrl, '_blank');
    } catch (error) {
      encounterLogger.error('Failed to save encounter', error);
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save encounter to Notion",
        variant: "destructive",
      });
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
        />
        
        <div className="flex-1 flex">
          {/* Main content area */}
          <div className="flex-1 flex flex-col">
            {/* Header with sidebar trigger */}
            <header className="h-14 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <SidebarTrigger className="ml-4" />
              <h1 className="ml-4 text-lg font-semibold">D&D Encounter Generator</h1>
            </header>

            {/* Main content */}
            <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
              <div className="max-w-7xl mx-auto w-full">
                {/* Encounter Stats Section */}
                {encounter && (
                  <div className="mb-6 lg:mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <Swords className="h-6 w-6 lg:h-7 lg:w-7 text-accent" />
                      <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                        {encounter.encounter_name || 'Generated Encounter'}
                      </h1>
                      <Button 
                        onClick={handleSaveEncounter}
                        className="btn-mystical flex items-center gap-2 ml-auto"
                        size="sm"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Export to Notion
                      </Button>
                    </div>
                    
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent mb-6"></div>
                    
                    <TooltipProvider>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
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

                        {/* Vertical divider */}
                        <div className="hidden lg:flex items-center justify-center">
                          <div className="w-px h-12 bg-border"></div>
                        </div>
                        
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-center cursor-help lg:col-span-1">
                              <div className="text-sm text-muted-foreground mb-1">Session</div>
                              <div className="flex justify-center">
                                <SessionSelect
                                  value={selectedSession}
                                  onValueChange={setSelectedSession}
                                  placeholder="Select session..."
                                  className="max-w-[200px]"
                                />
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>The D&D session this encounter belongs to</p>
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
                            // Debug log creature data for first creature
                            // Debug creature type for all creatures
                            console.log(`🔍 Creature ${creatureIndex} (${creature.name}) debug:`, {
                              creature_type: creature.creature_type,
                              creature_type_type: typeof creature.creature_type,
                              creature_type_exists: creature.hasOwnProperty('creature_type'),
                              size: creature.size,
                              alignment: creature.alignment,
                              all_keys: Object.keys(creature)
                            });
                            
                            if (creatureIndex === 0) {
                              console.log('🔍 First creature FULL data debug:', {
                                full_creature: creature
                              });
                            }
                            
                            return Array.from({ length: creature.quantity }, (_, instanceIndex) => (
                              <MonsterCardContextMenu
                                key={`${creatureIndex}-${instanceIndex}`}
                                monsterName={creature.name}
                                onOpenMonsterInstance={() => {
                                  encounterLogger.debug('Open monster instance', creature.name);
                                }}
                                onOpenMonsterData={() => {
                                  encounterLogger.debug('Open monster data', creature.name);
                                }}
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
                                                  <div className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg border border-border/50">
                                                    No loot data available
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
        </div>
        
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