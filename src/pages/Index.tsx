import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dice6, Sparkles, Scroll, Swords, Crown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import heroBanner from '@/assets/dnd-hero-banner.jpg';

// Mock data matching your Notion schema
const environments = [
  'Any', 'Forest', 'Mountain', 'Desert', 'Swamp', 'Cave', 'Ocean', 'City', 'Dungeon', 'Plains'
];

const alignments = [
  'Any', 'Lawful Good', 'Neutral Good', 'Chaotic Good', 
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'
];

const creatureTypes = [
  'Any', 'Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon', 
  'Elemental', 'Fey', 'Fiend', 'Giant', 'Humanoid', 'Monstrosity', 
  'Ooze', 'Plant', 'Undead'
];

const sizes = ['Any', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <div 
        className="relative h-64 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBanner})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/80" />
        <div className="relative z-10 flex items-center justify-center h-full">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-white mb-4 drop-shadow-lg">
              <Crown className="inline mr-3" />
              D&D Encounter Generator
            </h1>
            <p className="text-xl text-gold-200 drop-shadow-md">
              Forge legendary battles with mystical precision
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Generation Form */}
          <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-mystical">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Scroll className="h-6 w-6 text-primary" />
                Encounter Parameters
              </CardTitle>
              <CardDescription>
                Configure the parameters for your encounter generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="environment">Environment *</Label>
                  <Select value={params.environment} onValueChange={(value) => 
                    setParams(prev => ({ ...prev, environment: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select environment" />
                    </SelectTrigger>
                    <SelectContent>
                      {environments.map(env => (
                        <SelectItem key={env} value={env}>{env}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="xpThreshold">XP Threshold *</Label>
                  <Input
                    type="number"
                    value={params.xpThreshold}
                    onChange={(e) => setParams(prev => ({ 
                      ...prev, 
                      xpThreshold: parseInt(e.target.value) || 0 
                    }))}
                    placeholder="1000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Max Monsters</Label>
                  <Input
                    type="number"
                    value={params.maxMonsters}
                    onChange={(e) => setParams(prev => ({ 
                      ...prev, 
                      maxMonsters: parseInt(e.target.value) || 6 
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Min CR</Label>
                  <Input
                    type="number"
                    value={params.minCR}
                    onChange={(e) => setParams(prev => ({ 
                      ...prev, 
                      minCR: parseInt(e.target.value) || 0 
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max CR</Label>
                  <Input
                    type="number"
                    value={params.maxCR}
                    onChange={(e) => setParams(prev => ({ 
                      ...prev, 
                      maxCR: parseInt(e.target.value) || 20 
                    }))}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Alignment Filter</Label>
                  <Select value={params.alignment} onValueChange={(value) => 
                    setParams(prev => ({ ...prev, alignment: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      {alignments.map(align => (
                        <SelectItem key={align} value={align}>{align}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Creature Type</Label>
                  <Select value={params.creatureType} onValueChange={(value) => 
                    setParams(prev => ({ ...prev, creatureType: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      {creatureTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Size Filter</Label>
                  <Select value={params.size} onValueChange={(value) => 
                    setParams(prev => ({ ...prev, size: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      {sizes.map(size => (
                        <SelectItem key={size} value={size}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300"
              >
                {isGenerating ? (
                  <>
                    <Dice6 className="mr-2 h-4 w-4 animate-spin" />
                    Rolling the Dice...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Encounter
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-mystical">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Swords className="h-6 w-6 text-accent" />
                Generated Encounter
              </CardTitle>
              <CardDescription>
                {encounter ? "Your encounter has been forged!" : "Configure parameters and generate an encounter"}
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
                    No encounter generated yet. Configure your parameters and roll the dice!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Backend Notice */}
        <Card className="mt-8 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Crown className="h-6 w-6 text-primary" />
              <div>
                <h3 className="font-semibold text-lg mb-2">Ready for Notion Integration</h3>
                <p className="text-muted-foreground">
                  This interface is ready to connect to your Notion backend. To enable database functionality with your Monsters, Environments, and other tables, we recommend connecting to Supabase for seamless data management.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;