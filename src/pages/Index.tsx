import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dice6, Swords, ExternalLink, ChevronRight, ChevronDown, FileText, Sparkles, Scroll } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNotionService } from '@/hooks/useNotionService';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { EncounterParams, NotionEncounterParams, GeneratedEncounter } from '@/types/encounter';
import { LoadingBar } from '@/components/ui/loading-bar';
import { EncounterSkeleton } from '@/components/ui/encounter-skeleton';
import { MonsterCardContextMenu } from '@/components/ui/monster-card-context-menu';

const Index = () => {
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isLogExpanded, setIsLogExpanded] = useState(false);

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
    setIsGenerating(true);
    
    // Clear previous encounter at the start of generation
    setEncounter(null);
    
    try {
      console.log('🎲 Starting encounter generation with params:', params);
      
      const notionParams: NotionEncounterParams = {
        environment: params.environment === 'Any' ? '' : params.environment,
        minCR: params.minCR.toString(),
        maxCR: params.maxCR.toString(),
        xpThreshold: params.xpThreshold,
        maxMonsters: params.maxMonsters,
        alignment: params.alignment === 'Any' ? undefined : params.alignment,
        creatureType: params.creatureType === 'Any' ? undefined : params.creatureType,
        size: params.size === 'Any' ? undefined : params.size,
      };
      
      console.log('🔮 Calling generateEncounter with:', notionParams);
      const result = await generateEncounter(notionParams, controller.signal);
      
      // Check if the operation was cancelled
      if (controller.signal.aborted) {
        console.log('🚫 Encounter generation was cancelled');
        return;
      }
      
      console.log('✅ Encounter generation result:', result);
      
      if (result) {
        setEncounter(result);
        setIsGenerating(false); // Immediately stop loading state
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
      setIsGenerating(false); // Always reset loading state on error
      
      // Don't show error if operation was cancelled - the cancel handler already showed feedback
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
        console.log('🚫 Encounter generation was cancelled by user');
        return; // Don't show additional toast - already handled in handleCancel
      }
      
      console.error('❌ Encounter generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate encounter. Check your Notion configuration.";
      
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      // Clean up abort controller
      setAbortController(null);
    }
  };

  const handleCancel = () => {
    if (abortController) {
      console.log('🚫 Cancelling encounter generation...');
      
      // Immediately update UI state
      setIsGenerating(false);
      
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
      console.log('💾 Saving encounter to Notion...');
      const result = await saveEncounter(encounter);
      
      toast({
        title: "Encounter Saved!",
        description: "Successfully saved to Notion. Opening in new tab...",
      });
      
      // Open the new Notion page in a new tab
      window.open(result.pageUrl, '_blank');
    } catch (error) {
      console.error('Failed to save encounter:', error);
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
                {/* Loading bar */}
                {isGenerating && (
                  <div className="mb-6 lg:mb-8">
                    <LoadingBar 
                      isLoading={isGenerating}
                      className="max-w-2xl mx-auto"
                    />
                  </div>
                )}

                {/* Encounter Stats Section */}
                {encounter && (
                  <div className="mb-6 lg:mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <Swords className="h-6 w-6 lg:h-7 lg:w-7 text-accent" />
                      <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                        {encounter.encounter_name || 'Generated Encounter'}
                      </h1>
                    </div>
                    
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent mb-6"></div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground mb-1">Environment</div>
                        <div className="font-semibold text-accent">{encounter.environment}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground mb-1">Total XP</div>
                        <div className="font-semibold text-accent">{encounter.total_xp.toLocaleString()}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground mb-1">Creatures</div>
                        <div className="font-semibold text-accent">
                          {encounter.creatures.reduce((total, creature) => total + creature.quantity, 0)}
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground mb-1">Unique Types</div>
                        <div className="font-semibold text-accent">
                          {encounter.creatures.length}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Results */}
                <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-mystical">
                <CardHeader className="p-4 sm:p-6 lg:p-8">
                  <CardTitle className="flex items-center gap-2 text-xl lg:text-2xl">
                    <Scroll className="h-5 w-5 lg:h-6 lg:w-6 text-accent" />
                    {encounter ? "Encounter Details" : "Ready to Generate"}
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
                        <h3 className="text-xl font-semibold text-accent">Monsters</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                          {encounter.creatures.flatMap((creature, creatureIndex) => 
                            Array.from({ length: creature.quantity }, (_, instanceIndex) => (
                              <MonsterCardContextMenu
                                key={`${creatureIndex}-${instanceIndex}`}
                                monsterName={creature.name}
                                onOpenMonsterInstance={() => {
                                  // TODO: Implement opening monster instance in Notion
                                  console.log('Open monster instance:', creature.name);
                                }}
                                onOpenMonsterData={() => {
                                  // TODO: Implement opening monster data in Notion  
                                  console.log('Open monster data:', creature.name);
                                }}
                              >
                                <Card className="bg-gradient-to-br from-card to-muted/20 border-border/50 shadow-lg hover:shadow-mystical transition-all duration-300">
                                  {/* Context Bar */}
                                  <div className="h-1 bg-gradient-to-r from-accent/50 to-primary/50" />
                                  
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
                                            {creature.size || 'Unknown'}
                                          </Badge>
                                          <Badge variant="outline" className="text-xs">
                                            {creature.creature_type || 'Unknown'}
                                          </Badge>
                                          <Badge variant="outline" className="text-xs">
                                            {creature.alignment || 'Unknown'}
                                          </Badge>
                                        </div>
                                      </div>
                                      
                                      <Separator />
                                      
                                      <Tabs defaultValue="abilities" className="w-full">
                                        <TabsList className="grid w-full grid-cols-2">
                                          <TabsTrigger value="abilities">Abilities</TabsTrigger>
                                          <TabsTrigger value="loot">Loot</TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="abilities" className="mt-4">
                                          <div className="text-sm text-muted-foreground text-center py-4">
                                            No abilities data available
                                          </div>
                                        </TabsContent>
                                        <TabsContent value="loot" className="mt-4">
                                          <div className="text-sm text-muted-foreground text-center py-4">
                                            No loot data available
                                          </div>
                                        </TabsContent>
                                      </Tabs>
                                    </div>
                                  </CardContent>
                                </Card>
                              </MonsterCardContextMenu>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="flex justify-center pt-8">
                        <Button 
                          onClick={handleSaveEncounter}
                          className="btn-mystical flex items-center gap-2"
                          size="lg"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open in Notion
                        </Button>
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
              className="border-l border-border bg-background/50"
            >
              <CollapsibleTrigger className="w-12 h-full flex items-center justify-center hover:bg-accent/10 transition-colors">
                <div className="flex flex-col items-center gap-2">
                  {isLogExpanded ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="writing-mode-vertical text-sm text-muted-foreground font-medium">
                    Generation Log
                  </div>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="w-80">
                <div className="p-4 h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-accent" />
                    <h3 className="font-semibold text-accent">Generation Log</h3>
                  </div>
                  <ScrollArea className="h-[calc(100vh-12rem)] border border-border/30 rounded-lg bg-muted/20">
                    <div className="p-4 space-y-2 font-mono text-sm">
                      {encounter.generation_notes.split('\n').map((note, index) => (
                        <div key={index} className="text-muted-foreground leading-relaxed">
                          {note}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;