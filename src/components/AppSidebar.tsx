import React from 'react';
import { Button } from '@/components/ui/button';
import { Dice6, Sparkles, Scroll, X } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar,
} from '@/components/ui/sidebar';
import { SelectField, NumberField, FormSection, FormGrid } from '@/components/ui/form-fields';
import { 
  getEnvironmentIcon, 
  getAlignmentIcon, 
  getCreatureTypeIcon, 
  getSizeIcon 
} from '@/lib/icon-mappings';

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
  onCancel: () => void;
  isGenerating: boolean;
}

export function AppSidebar({ params, setParams, onGenerate, onCancel, isGenerating }: AppSidebarProps) {
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
  }, []);

  // Create select options with icons for each filter type
  const environmentOptions = ['Any', ...environments.map(env => env.name)]
    .filter((env, index, arr) => arr.indexOf(env) === index) // Remove duplicates
    .sort((a, b) => {
      if (a === 'Any') return -1;
      if (b === 'Any') return 1;
      return a.localeCompare(b);
    })
    .map(env => ({
      value: env,
      label: env,
      icon: getEnvironmentIcon(env)
    }));

  const alignmentOptions = alignments.map(align => ({
    value: align,
    label: align,
    icon: getAlignmentIcon(align)
  }));

  const creatureTypeOptions = creatureTypes.map(type => ({
    value: type,
    label: type,
    icon: getCreatureTypeIcon(type)
  }));

  const sizeOptions = sizes.map(size => ({
    value: size,
    label: size,
    icon: getSizeIcon(size)
  }));

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
                <SelectField
                  label="Environment"
                  value={params.environment}
                  onValueChange={(value) => setParams(prev => ({ ...prev, environment: value }))}
                  options={environmentOptions}
                  loading={environmentsLoading}
                  disabled={environmentsLoading || !!environmentsError}
                  placeholder={
                    environmentsLoading ? "Loading environments..." : 
                    environmentsError ? "Error loading environments" :
                    "Select environment"
                  }
                  errorMessage={environmentsError ? 
                    "Using default environments. Configure Notion integration for custom data." : 
                    undefined
                  }
                />

                {/* Encounter Settings Section */}
                <FormSection title="Encounter Settings">
                  <FormGrid columns={2}>
                    <NumberField
                      label="XP Threshold"
                      value={params.xpThreshold}
                      onChange={(value) => setParams(prev => ({ ...prev, xpThreshold: value }))}
                      placeholder="1000"
                    />

                    <NumberField
                      label="Max Monsters"
                      value={params.maxMonsters}
                      onChange={(value) => setParams(prev => ({ ...prev, maxMonsters: value }))}
                    />
                  </FormGrid>

                  <FormGrid columns={2}>
                    <NumberField
                      label="Min CR"
                      value={params.minCR}
                      onChange={(value) => setParams(prev => ({ ...prev, minCR: value }))}
                      min={0}
                    />

                    <NumberField
                      label="Max CR"
                      value={params.maxCR}
                      onChange={(value) => setParams(prev => ({ ...prev, maxCR: value }))}
                      min={0}
                      max={30}
                    />
                  </FormGrid>
                </FormSection>

                {/* Advanced Filters Section */}
                <FormSection title="Advanced Filters">
                  <div className="space-y-4">
                    <SelectField
                      label="Alignment"
                      value={params.alignment}
                      onValueChange={(value) => setParams(prev => ({ ...prev, alignment: value }))}
                      options={alignmentOptions}
                      placeholder="Any"
                    />

                    <SelectField
                      label="Creature Type"
                      value={params.creatureType}
                      onValueChange={(value) => setParams(prev => ({ ...prev, creatureType: value }))}
                      options={creatureTypeOptions}
                      placeholder="Any"
                    />

                    <SelectField
                      label="Size"
                      value={params.size}
                      onValueChange={(value) => setParams(prev => ({ ...prev, size: value }))}
                      options={sizeOptions}
                      placeholder="Any"
                    />
                  </div>
                </FormSection>

                <div className="pt-8">
                  {isGenerating ? (
                    <div className="space-y-3">
                      <Button 
                        disabled
                        className="w-full bg-primary hover:bg-primary/90 transition-colors duration-200"
                      >
                        <Dice6 className="mr-2 h-4 w-4 animate-spin" />
                        Rolling the Dice...
                      </Button>
                      <Button 
                        onClick={onCancel}
                        variant="outline"
                        className="w-full hover:bg-destructive hover:text-destructive-foreground transition-colors duration-200"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel Generation
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      onClick={onGenerate}
                      className="w-full bg-primary hover:bg-primary/90 transition-colors duration-200"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Encounter
                    </Button>
                  )}
                </div>
              </div>
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}