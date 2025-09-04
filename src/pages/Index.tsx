import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dice6, Swords } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppSidebar } from '@/components/AppSidebar';
import { useSidebar } from '@/components/ui/sidebar';
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
  monsters: Array<{
    name: string;
    quantity: number;
    cr: number;
    xp: number;
    type: string;
    alignment: string;
    size: string;
  }>;
  generationLog: string[];
}

const Index = () => {
  const { toast } = useToast();
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
    
    // Simulate encounter generation with your business logic
    setTimeout(() => {
      const mockEncounter: GeneratedEncounter = {
        id: `enc_${Date.now()}`,
        environment: params.environment,
        totalXP: Math.floor(params.xpThreshold * 0.8 + Math.random() * params.xpThreshold * 0.4),
        monsters: [
          {
            name: "Dire Wolf",
            quantity: 2,
            cr: 1,
            xp: 200,
            type: "Beast",
            alignment: "Neutral",
            size: "Large"
          },
          {
            name: "Orc Warrior",
            quantity: 3,
            cr: 0.5,
            xp: 100,
            type: "Humanoid",
            alignment: "Chaotic Evil",
            size: "Medium"
          }
        ],
        generationLog: [
          `🎲 Rolling for encounter in ${params.environment}...`,
          `⚔️ Applied filters: ${params.alignment || 'Any'} alignment, ${params.creatureType || 'Any'} type`,
          `🎯 XP Budget: ${params.xpThreshold}`,
          `🎲 Rolled 1d4 = 3, selecting 3 monsters`,
          `✨ Selected Dire Wolf (CR 1, 200 XP each) x2 = 400 XP`,
          `🎲 Rolled 1d4 = 2, selecting 2 more monsters`,
          `✨ Selected Orc Warrior (CR 0.5, 100 XP each) x3 = 300 XP`,
          `🏁 Total encounter XP: 700/${params.xpThreshold}`,
          `📜 Encounter generation complete!`
        ]
      };
      
      setEncounter(mockEncounter);
      setIsGenerating(false);
      
      toast({
        title: "Encounter Generated!",
        description: "Your legendary encounter awaits the party.",
      });
    }, 2000);
  };

  return (
    <div className="flex w-full">
      <AppSidebar 
        params={params}
        setParams={setParams}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
      />
      
      <div className="flex-1">
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
                    <Badge variant="outline" className="text-lg px-4 py-2">
                      {encounter.totalXP} XP
                    </Badge>
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
                          <div>XP Each: {monster.xp} (Total: {monster.quantity * monster.xp})</div>
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
      </div>
    </div>
  );
};

export default Index;