import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Dice6, Sparkles, Scroll, Trees, Mountain, Waves, Sun, Building, Castle, Globe, Landmark, Home,
  Shield, Sword, Heart, Skull, Crown, Users, User, Zap, Star, Target, Scale, Maximize, Minimize
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar,
} from '@/components/ui/sidebar';

import { useNotionService } from '@/hooks/useNotionService';
import { EncounterParams } from '@/types/encounter';

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

interface AppSidebarProps {
  params: EncounterParams;
  setParams: React.Dispatch<React.SetStateAction<EncounterParams>>;
  onGenerate: () => void;
  isGenerating: boolean;
  onTestCreatures?: () => void;
}

export function AppSidebar({ params, setParams, onGenerate, isGenerating, onTestCreatures }: AppSidebarProps) {
  const { open } = useSidebar();
  const { fetchEnvironments, loading: environmentsLoading, error: environmentsError } = useNotionService();
  const [environments, setEnvironments] = React.useState<{ id: string; name: string }[]>([]);

  React.useEffect(() => {
    const loadEnvironments = async () => {
      try {
        console.log('🌍 Attempting to load environments from Notion...');
        const result = await fetchEnvironments();
        if (result && result.environments && result.environments.length > 0) {
          console.log('✅ Successfully loaded', result.environments.length, 'environments from Notion');
          console.log('📋 Environment data:', result.environments);
          setEnvironments(result.environments);
        } else {
          console.log('⚠️ No environments returned from Notion, using defaults');
          setDefaultEnvironments();
        }
      } catch (err) {
        console.log('🏔️ Notion integration not available, using default environments');
        setDefaultEnvironments();
      }
    };

    const setDefaultEnvironments = () => {
      const defaultEnvs = [
        { id: '1', name: 'Forest' },
        { id: '2', name: 'Dungeon' },
        { id: '3', name: 'Mountains' },
        { id: '4', name: 'Desert' },
        { id: '5', name: 'Swamp' },
        { id: '6', name: 'City' },
        { id: '7', name: 'Ruins' },
        { id: '8', name: 'Cave' }
      ];
      setEnvironments(defaultEnvs);
      console.log('🎲 Using', defaultEnvs.length, 'default D&D environments');
    };

    loadEnvironments();
  }, []); // Removed fetchEnvironments from dependency array to prevent infinite loop

  // Function to get icon for environment
  const getEnvironmentIcon = (envName: string) => {
    const name = envName.toLowerCase();
    if (name.includes('forest') || name.includes('wood')) return Trees;
    if (name.includes('mountain') || name.includes('hill')) return Mountain;
    if (name.includes('desert') || name.includes('sand')) return Sun;
    if (name.includes('swamp') || name.includes('marsh') || name.includes('bog')) return Waves;
    if (name.includes('city') || name.includes('town') || name.includes('urban')) return Building;
    if (name.includes('dungeon') || name.includes('castle') || name.includes('fortress')) return Castle;
    if (name.includes('ruin') || name.includes('ancient')) return Landmark;
    if (name.includes('cave') || name.includes('cavern') || name.includes('underground')) return Mountain;
    if (name === 'any') return Globe;
    return Home; // Default icon
  };

  // Function to get icon for alignment
  const getAlignmentIcon = (alignment: string) => {
    const align = alignment.toLowerCase();
    if (align.includes('lawful good') || align === 'lg') return Crown;
    if (align.includes('lawful neutral') || align === 'ln') return Shield;
    if (align.includes('lawful evil') || align === 'le') return Sword;
    if (align.includes('neutral good') || align === 'ng') return Heart;
    if (align.includes('true neutral') || align === 'tn' || align === 'neutral') return Scale;
    if (align.includes('neutral evil') || align === 'ne') return Skull;
    if (align.includes('chaotic good') || align === 'cg') return Star;
    if (align.includes('chaotic neutral') || align === 'cn') return Zap;
    if (align.includes('chaotic evil') || align === 'ce') return Target;
    if (align === 'any') return Globe;
    return User; // Default icon
  };

  // Function to get icon for creature type
  const getCreatureTypeIcon = (creatureType: string) => {
    const type = creatureType.toLowerCase();
    if (type.includes('humanoid')) return Users;
    if (type.includes('beast')) return Heart;
    if (type.includes('dragon')) return Zap;
    if (type.includes('undead')) return Skull;
    if (type.includes('fiend')) return Target;
    if (type.includes('celestial')) return Star;
    if (type.includes('fey')) return Sparkles;
    if (type.includes('elemental')) return Mountain;
    if (type.includes('aberration')) return Zap;
    if (type.includes('construct')) return Shield;
    if (type.includes('giant')) return Crown;
    if (type.includes('monstrosity')) return Sword;
    if (type.includes('ooze')) return Waves;
    if (type.includes('plant')) return Trees;
    if (type === 'any') return Globe;
    return User; // Default icon
  };

  // Function to get icon for size
  const getSizeIcon = (size: string) => {
    const sz = size.toLowerCase();
    if (sz.includes('tiny')) return Minimize;
    if (sz.includes('small')) return User;
    if (sz.includes('medium')) return Users;
    if (sz.includes('large')) return Crown;
    if (sz.includes('huge')) return Mountain;
    if (sz.includes('gargantuan')) return Maximize;
    if (sz === 'any') return Globe;
    return Users; // Default icon
  };

  // Create environments list with 'Any' option and data (either from Notion or defaults)
  const environmentOptions = ['Any', ...environments.map(env => env.name)]
    .filter((env, index, arr) => arr.indexOf(env) === index) // Remove duplicates
    .sort((a, b) => {
      if (a === 'Any') return -1; // Keep 'Any' at the top
      if (b === 'Any') return 1;
      return a.localeCompare(b); // Sort alphabetically
    });

  return (
    <Sidebar
      className={open ? "w-80" : "w-14"}
      collapsible="icon"
    >
      <SidebarContent className="border-r border-border bg-background">
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 text-lg font-semibold px-6 py-4 border-b border-border">
            <Scroll className="h-5 w-5 text-primary" />
            {open && "Encounter Parameters"}
          </SidebarGroupLabel>
          
          {open && (
            <SidebarGroupContent className="px-6 py-6">
              <div className="space-y-8">
                {/* Environment Section */}
                <div className="space-y-3">
                  <Label htmlFor="environment" className="text-sm font-semibold text-foreground uppercase tracking-wide">Environment</Label>
                  <Select 
                    value={params.environment} 
                    onValueChange={(value) => setParams(prev => ({ ...prev, environment: value }))}
                    disabled={environmentsLoading || !!environmentsError}
                  >
                    <SelectTrigger className="bg-transparent border-0 border-b-2 border-border rounded-none px-0 py-3 focus:border-primary focus:ring-0 focus:outline-none hover:bg-primary/5 focus:bg-primary/10 transition-all duration-200">
                      <SelectValue placeholder={
                        environmentsLoading ? "Loading environments..." : 
                        environmentsError ? "Error loading environments" :
                        "Select environment"
                      }>
                        {params.environment && (
                          <div className="flex items-center gap-2 text-foreground">
                            {(() => {
                              const IconComponent = getEnvironmentIcon(params.environment);
                              return <IconComponent className="h-4 w-4" />;
                            })()}
                            {params.environment}
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {environmentOptions.map(env => {
                        const IconComponent = getEnvironmentIcon(env);
                        return (
                          <SelectItem key={env} value={env}>
                            <div className="flex items-center gap-2 text-foreground">
                              <IconComponent className="h-4 w-4" />
                              {env}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {environmentsError && (
                    <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
                      Using default environments. Configure Notion integration for custom data.
                    </p>
                  )}
                </div>

                {/* Encounter Settings Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-2">
                    Encounter Settings
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="xpThreshold" className="text-sm font-semibold text-foreground">XP Threshold</Label>
                      <Input
                        type="number"
                        value={params.xpThreshold}
                        onChange={(e) => setParams(prev => ({ 
                          ...prev, 
                          xpThreshold: parseInt(e.target.value) || 0 
                        }))}
                        placeholder="1000"
                        className="bg-transparent border-0 border-b-2 border-border rounded-none px-0 py-3 text-foreground focus:border-primary focus:ring-0 focus:outline-none hover:bg-primary/5 focus:bg-primary/10 transition-all duration-200"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-foreground">Max Monsters</Label>
                      <Input
                        type="number"
                        value={params.maxMonsters}
                        onChange={(e) => setParams(prev => ({ 
                          ...prev, 
                          maxMonsters: parseInt(e.target.value) || 6 
                        }))}
                        className="bg-transparent border-0 border-b-2 border-border rounded-none px-0 py-3 text-foreground focus:border-primary focus:ring-0 focus:outline-none hover:bg-primary/5 focus:bg-primary/10 transition-all duration-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-foreground">Min CR</Label>
                      <Input
                        type="number"
                        value={params.minCR}
                        onChange={(e) => setParams(prev => ({ 
                          ...prev, 
                          minCR: parseInt(e.target.value) || 0 
                        }))}
                        className="bg-transparent border-0 border-b-2 border-border rounded-none px-0 py-3 text-foreground focus:border-primary focus:ring-0 focus:outline-none hover:bg-primary/5 focus:bg-primary/10 transition-all duration-200"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-foreground">Max CR</Label>
                      <Input
                        type="number"
                        value={params.maxCR}
                        onChange={(e) => setParams(prev => ({ 
                          ...prev, 
                          maxCR: parseInt(e.target.value) || 20 
                        }))}
                        className="bg-transparent border-0 border-b-2 border-border rounded-none px-0 py-3 text-foreground focus:border-primary focus:ring-0 focus:outline-none hover:bg-primary/5 focus:bg-primary/10 transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Advanced Filters Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-2">
                    Advanced Filters
                  </h3>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-foreground">Alignment</Label>
                      <Select value={params.alignment} onValueChange={(value) => 
                        setParams(prev => ({ ...prev, alignment: value }))
                      }>
                        <SelectTrigger className="bg-transparent border-0 border-b-2 border-border rounded-none px-0 py-3 focus:border-primary focus:ring-0 focus:outline-none hover:bg-primary/5 focus:bg-primary/10 transition-all duration-200">
                          <SelectValue placeholder="Any">
                            {params.alignment && (
                              <div className="flex items-center gap-2 text-foreground">
                                {(() => {
                                  const IconComponent = getAlignmentIcon(params.alignment);
                                  return <IconComponent className="h-4 w-4" />;
                                })()}
                                {params.alignment}
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                      {alignments.map(align => {
                        const IconComponent = getAlignmentIcon(align);
                        return (
                          <SelectItem key={align} value={align}>
                            <div className="flex items-center gap-2 text-foreground">
                              <IconComponent className="h-4 w-4" />
                              {align}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-foreground">Creature Type</Label>
                  <Select value={params.creatureType} onValueChange={(value) => 
                    setParams(prev => ({ ...prev, creatureType: value }))
                  }>
                    <SelectTrigger className="bg-transparent border-0 border-b-2 border-border rounded-none px-0 py-3 focus:border-primary focus:ring-0 focus:outline-none hover:bg-primary/5 focus:bg-primary/10 transition-all duration-200">
                      <SelectValue placeholder="Any">
                        {params.creatureType && (
                          <div className="flex items-center gap-2 text-foreground">
                            {(() => {
                              const IconComponent = getCreatureTypeIcon(params.creatureType);
                              return <IconComponent className="h-4 w-4" />;
                            })()}
                            {params.creatureType}
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {creatureTypes.map(type => {
                        const IconComponent = getCreatureTypeIcon(type);
                        return (
                          <SelectItem key={type} value={type}>
                            <div className="flex items-center gap-2 text-foreground">
                              <IconComponent className="h-4 w-4" />
                              {type}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-foreground">Size</Label>
                  <Select value={params.size} onValueChange={(value) => 
                    setParams(prev => ({ ...prev, size: value }))
                  }>
                    <SelectTrigger className="bg-transparent border-0 border-b-2 border-border rounded-none px-0 py-3 focus:border-primary focus:ring-0 focus:outline-none hover:bg-primary/5 focus:bg-primary/10 transition-all duration-200">
                      <SelectValue placeholder="Any">
                        {params.size && (
                          <div className="flex items-center gap-2 text-foreground">
                            {(() => {
                              const IconComponent = getSizeIcon(params.size);
                              return <IconComponent className="h-4 w-4" />;
                            })()}
                            {params.size}
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {sizes.map(size => {
                        const IconComponent = getSizeIcon(size);
                        return (
                          <SelectItem key={size} value={size}>
                            <div className="flex items-center gap-2 text-foreground">
                              <IconComponent className="h-4 w-4" />
                              {size}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            </div>

              <div className="pt-8">
                <Button 
                  onClick={onGenerate}
                  disabled={isGenerating}
                  className="w-full bg-primary hover:bg-primary/90 transition-colors duration-200"
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
              
              {/* Debug button for testing creatures structure */}
              {onTestCreatures && (
                <Button 
                  onClick={onTestCreatures}
                  variant="outline"
                  className="w-full mt-2"
                >
                  <Target className="mr-2 h-4 w-4" />
                  Debug Creatures DB
                </Button>
              )}
              </div>
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}