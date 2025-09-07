import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dice6, Swords } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNotionService } from '@/hooks/useNotionService';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { EncounterParams, NotionEncounterParams, GeneratedEncounter } from '@/types/encounter';
import heroBanner from '@/assets/dnd-hero-banner.jpg';

const Index = () => {
  const { toast } = useToast();
  const { generateEncounter, testCreaturesStructure, loading: generatingEncounter, error: generationError } = useNotionService();
  
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

  const handleGenerate = async () => {
    if (!params.environment || params.environment === '' || params.xpThreshold <= 0) {
      toast({
        title: "Missing Parameters",
        description: "Please select an environment and set a valid XP threshold.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      console.log('🎲 Starting encounter generation with params:', params);
      
      const notionParams: NotionEncounterParams = {
        environment: params.environment === 'Any' ? '' : params.environment,
        difficulty: 'medium', // Default difficulty
        minCR: params.minCR.toString(),
        maxCR: params.maxCR.toString(),
        xpThreshold: params.xpThreshold,
        maxMonsters: params.maxMonsters,
        alignment: params.alignment === 'Any' ? undefined : params.alignment,
        creatureType: params.creatureType === 'Any' ? undefined : params.creatureType,
        size: params.size === 'Any' ? undefined : params.size,
      };
      
      console.log('🔮 Calling generateEncounter with:', notionParams);
      const result = await generateEncounter(notionParams);
      console.log('✅ Encounter generation result:', result);
      
      if (result) {
        setEncounter(result);
        toast({
          title: "Encounter Generated!",
          description: `Generated a ${result.difficulty} encounter with ${result.total_xp} XP.`,
        });
      } else {
        throw new Error("Failed to generate encounter - no result returned");
      }
    } catch (error: unknown) {
      console.error('❌ Encounter generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate encounter. Check your Notion configuration.";
      
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTestCreatures = async () => {
    try {
      console.log('🔍 Testing creatures database structure...');
      const result = await testCreaturesStructure();
      console.log('✅ Creatures test result:', result);
      
      toast({
        title: "Creatures Test Complete",
        description: "Check the console for detailed database structure information",
      });
    } catch (error) {
      console.error('❌ Creatures test failed:', error);
      toast({
        title: "Creatures Test Failed", 
        description: error instanceof Error ? error.message : "Failed to test creatures structure",
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
          isGenerating={isGenerating}
          onTestCreatures={handleTestCreatures}
        />
        
        <div className="flex-1 flex flex-col">
          {/* Header with sidebar trigger */}
          <header className="h-14 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="ml-4" />
            <h1 className="ml-4 text-lg font-semibold">D&D Encounter Generator</h1>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            {/* Hero Section */}
            <div 
              className="relative h-64 bg-cover bg-center"
              style={{ backgroundImage: `url(${heroBanner})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/80" />
              <div className="relative z-10 flex items-center justify-center h-full">
                <div className="text-center">
                  <h1 className="text-5xl font-bold text-white mb-4 drop-shadow-lg">
                    Forge Legendary Battles
                  </h1>
                  <p className="text-xl text-gold-200 drop-shadow-md">
                    Generate encounters with mystical precision
                  </p>
                </div>
              </div>
            </div>

            <div className="container mx-auto px-6 py-8">
              {/* Results */}
              <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-mystical">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Swords className="h-6 w-6 text-accent" />
                    Generated Encounter
                  </CardTitle>
                  <CardDescription>
                    {encounter ? "Your encounter has been forged!" : "Configure parameters in the sidebar and generate an encounter from your Notion databases"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {encounter ? (
                    <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-lg px-4 py-2">
                      {encounter.environment}
                    </Badge>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-lg px-4 py-2">
                        {encounter.total_xp} XP
                      </Badge>
                      <Badge variant={
                        encounter.difficulty === 'Easy' ? 'secondary' :
                        encounter.difficulty === 'Medium' ? 'default' :
                        encounter.difficulty === 'Hard' ? 'destructive' :
                        'destructive'
                      } className="text-lg px-4 py-2">
                        {encounter.difficulty}
                      </Badge>
                    </div>
                  </div>

                      <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-accent">Monsters</h3>
                        {encounter.creatures.map((creature, index) => (
                          <div key={index} className="p-4 bg-muted/50 rounded-lg border border-border/50">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-lg">{creature.name}</h4>
                              <Badge variant="outline">CR {creature.challenge_rating}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                            <div>Quantity: {creature.quantity}</div>
                            <div>XP Value: {creature.xp_value}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-accent">Generation Log</h3>
                        <ScrollArea className="h-48 p-4 bg-muted/50 rounded-lg border border-border/50">
                          <div className="space-y-2 font-mono text-sm">
                            {encounter.generation_notes.split('\n').map((note, index) => (
                              <div key={index} className="text-muted-foreground">
                                {note}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Dice6 className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-2">
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
      </div>
    </SidebarProvider>
  );
};

export default Index;