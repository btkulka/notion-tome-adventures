import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dice6, Swords } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEncounterGeneration } from '@/hooks/useNotionData';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import heroBanner from '@/assets/dnd-hero-banner.jpg';

interface EncounterParams {
  environment: string;
  xpThreshold: number;
  maxMonsters: number;
  alignment: string;
  creatureType: string;
  size: string;
  minCR: number;
  maxCR: number;
}

interface GeneratedEncounter {
  id: string;
  environment: string;
  totalXP: number;
  baseXP: number;
  difficulty: string;
  monsters: Array<{
    name: string;
    quantity: number;
    cr: number;
    xp: number;
    total_xp: number;
    type: string;
    alignment: string;
    size: string;
  }>;
  generationLog: string[];
  parameters: any;
}

const Index = () => {
  const { toast } = useToast();
  const { generateEncounter, loading: generatingEncounter, error: generationError } = useEncounterGeneration();
  
  const [params, setParams] = useState<EncounterParams>({
    environment: '',
    xpThreshold: 1000,
    maxMonsters: 6,
    alignment: '',
    creatureType: '',
    size: '',
    minCR: 0,
    maxCR: 20
  });
  
  const [encounter, setEncounter] = useState<GeneratedEncounter | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!params.environment || params.xpThreshold <= 0) {
      toast({
        title: "Missing Parameters",
        description: "Please select an environment and set a valid XP threshold.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const result = await generateEncounter(params);
      
      if (result) {
        setEncounter(result);
        toast({
          title: "Encounter Generated!",
          description: `Generated a ${result.difficulty} encounter with ${result.totalXP} XP.`,
        });
      } else {
        throw new Error("Failed to generate encounter");
      }
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate encounter. Check your Notion configuration.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
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
                    {encounter ? "Your encounter has been forged!" : "Configure parameters in the sidebar and generate an encounter"}
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
                        {encounter.totalXP} XP
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
                        {encounter.monsters.map((monster, index) => (
                          <div key={index} className="p-4 bg-muted/50 rounded-lg border border-border/50">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-lg">{monster.name}</h4>
                              <Badge variant="outline">CR {monster.cr}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                            <div>Quantity: {monster.quantity}</div>
                            <div>XP Each: {monster.xp} (Total: {monster.total_xp})</div>
                            <div>Type: {monster.type} • Size: {monster.size}</div>
                              <div>Alignment: {monster.alignment}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-accent">Generation Log</h3>
                        <ScrollArea className="h-48 p-4 bg-muted/50 rounded-lg border border-border/50">
                          <div className="space-y-2 font-mono text-sm">
                            {encounter.generationLog.map((log, index) => (
                              <div key={index} className="text-muted-foreground">
                                {log}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Dice6 className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        No encounter generated yet. Configure your parameters in the sidebar and roll the dice!
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