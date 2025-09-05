import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dice6, Sparkles, Scroll } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar,
} from '@/components/ui/sidebar';

import { useNotionEnvironments } from '@/hooks/useNotionData';

// Static data for filters
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

interface AppSidebarProps {
  params: EncounterParams;
  setParams: React.Dispatch<React.SetStateAction<EncounterParams>>;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function AppSidebar({ params, setParams, onGenerate, isGenerating }: AppSidebarProps) {
  const { open } = useSidebar();
  const { environments, loading: environmentsLoading, error: environmentsError } = useNotionEnvironments();

  // Create environments list with 'Any' option and real data from Notion
  const environmentOptions = ['Any', ...environments.map(env => env.name)];

  return (
    <Sidebar
      className={open ? "w-80" : "w-14"}
      collapsible="icon"
    >
      <SidebarContent className="border-r bg-gradient-to-br from-card to-card/80">
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 text-lg font-semibold px-4 py-3">
            <Scroll className="h-5 w-5 text-primary" />
            {open && "Encounter Parameters"}
          </SidebarGroupLabel>
          
          {open && (
            <SidebarGroupContent className="px-4 space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="environment">Environment *</Label>
                  <Select 
                    value={params.environment} 
                    onValueChange={(value) => setParams(prev => ({ ...prev, environment: value }))}
                    disabled={environmentsLoading || !!environmentsError}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        environmentsLoading ? "Loading environments..." : 
                        environmentsError ? "Error loading environments" :
                        "Select environment"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {environmentOptions.map(env => (
                        <SelectItem key={env} value={env}>{env}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {environmentsError && (
                    <p className="text-sm text-destructive">
                      Failed to load environments. Please check your Notion setup.
                    </p>
                  )}
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

              <div className="grid grid-cols-3 gap-3">
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

              <div className="space-y-4">
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
                onClick={onGenerate}
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
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}