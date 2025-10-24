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
import { SelectField, FormSection, FormGrid } from '@/components/ui/form-fields';
import { NumberInput } from '@/components/ui/number-input';
import { CRSelect } from '@/components/ui/cr-select';
import { 
  getEnvironmentIcon, 
  getAlignmentIcon, 
  getCreatureTypeIcon, 
  getSizeIcon 
} from '@/lib/icon-mappings';

import { useNotionService } from '@/hooks/useNotionService';
import { EncounterParams } from '@/types/encounter';
import { useToast } from '@/hooks/use-toast';
import heroBanner from '@/assets/dnd-hero-banner.jpg';
import { EdgeFunctionError } from '@/components/ui/edge-function-error';

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
  const { fetchEnvironments, debugEnvironments, simpleDebug, loading: environmentsLoading, error: environmentsError } = useNotionService();
  const { toast } = useToast();
  const [environments, setEnvironments] = React.useState<{ id: string; name: string }[]>([]);
  const [envError, setEnvError] = React.useState<Error | null>(null);

  const loadEnvironments = async () => {
    const result = await fetchEnvironments();
    
    if (!result.success) {
      setEnvError(result.error || new Error('Unknown error'));
      setEnvironments([]);
      return;
    }
    
    if (result.data && result.data.environments && result.data.environments.length > 0) {
      setEnvironments(result.data.environments);
      setEnvError(null);
    } else {
      setEnvironments([]);
    }
  };

  React.useEffect(() => {
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

  const handleSimpleDebug = async () => {
    const result = await simpleDebug();
    
    if (!result.success) {
      toast({
        title: "Debug Failed", 
        description: result.error?.message || "Unknown error",
        variant: "destructive"
      });
      return;
    }
    toast({
      title: "Property Keys Debug",
      description: `Debug result returned. Check console for details.`,
      variant: "default"
    });
  };

  return (
    <Sidebar
      className={open ? "w-80" : "w-14"}
      collapsible="icon"
    >
      <SidebarContent className="border-r border-border bg-background">
        {/* Hero Section */}
        {open && (
          <div 
            className="relative h-32 bg-cover bg-center border-b border-border"
            style={{ backgroundImage: `url(${heroBanner})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/70" />
            <div className="relative z-10 flex items-center justify-center h-full p-4">
              <div className="text-center">
                <h2 className="text-lg font-bold text-white drop-shadow-lg">
                  Encounter Generator
                </h2>
              </div>
            </div>
          </div>
        )}
        
        <SidebarGroup>
          {open && (
            <SidebarGroupContent className="px-6 py-6">
              <div className="space-y-8">
                {/* Error Display */}
                {envError && (
                  <EdgeFunctionError
                    error={envError}
                    operationName="fetch environments"
                    onRetry={loadEnvironments}
                  />
                )}
                
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
                  skeletonOptions={['Forest', 'Desert', 'Mountain', 'Coastal', 'Urban', 'Swamp']}
                  errorMessage={environmentsError ? 
                    "Using default environments. Configure Notion integration for custom data." : 
                    undefined
                  }
                />

                {/* Encounter Settings Section */}
                <FormSection title="Encounter Settings">
                  <FormGrid columns={2}>
                    <NumberInput
                      label="XP Threshold"
                      value={params.xpThreshold}
                      onChange={(value) => setParams(prev => ({ ...prev, xpThreshold: value }))}
                      placeholder="1000"
                      step={100}
                      max={50000}
                    />

                    <NumberInput
                      label="Max Monsters"
                      value={params.maxMonsters}
                      onChange={(value) => setParams(prev => ({ ...prev, maxMonsters: value }))}
                      min={1}
                      max={20}
                    />
                  </FormGrid>

                  <FormGrid columns={2}>
                    <CRSelect
                      label="Min CR"
                      value={params.minCR}
                      onValueChange={(value) => setParams(prev => ({ ...prev, minCR: value }))}
                    />

                    <CRSelect
                      label="Max CR"
                      value={params.maxCR}
                      onValueChange={(value) => setParams(prev => ({ ...prev, maxCR: value }))}
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
                        className="w-full btn-mystical text-primary-foreground font-semibold tracking-wide opacity-70"
                      >
                        <Dice6 className="mr-2 h-4 w-4 animate-spin" />
                        Rolling the Dice...
                      </Button>
                      <Button 
                        onClick={onCancel}
                        variant="outline"
                        className="w-full border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 hover:shadow-lg hover:shadow-destructive/20"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel Generation
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Button 
                        onClick={onGenerate}
                        className="w-full btn-mystical text-primary-foreground font-semibold tracking-wide"
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Encounter
                      </Button>
                      <Button 
                        onClick={handleSimpleDebug}
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                      >
                        Debug Property Keys
                      </Button>
                    </div>
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