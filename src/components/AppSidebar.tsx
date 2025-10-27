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

import { notionApi, NotionCampaign } from '@/hooks/useNotionService';
import { EncounterParams } from '@/types/encounter';
import { useToast } from '@/hooks/use-toast';
import heroBanner from '@/assets/dnd-hero-banner.jpg';
import { EdgeFunctionError } from '@/components/ui/edge-function-error';
import { CampaignSelect } from '@/components/ui/campaign-select';

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
  selectedCampaign: NotionCampaign | null;
  onCampaignChange: (campaign: NotionCampaign | null) => void;
}

export function AppSidebar({ params, setParams, onGenerate, onCancel, isGenerating, selectedCampaign, onCampaignChange }: AppSidebarProps) {
  const { open } = useSidebar();
  const { toast } = useToast();
  const [environments, setEnvironments] = React.useState<{ id: string; name: string }[]>([]);
  const [envError, setEnvError] = React.useState<Error | null>(null);
  const [environmentsLoading, setEnvironmentsLoading] = React.useState(false);

  // Load environments once on mount
  React.useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const loadEnvironments = async () => {
      console.log('🌍 AppSidebar: Loading environments');
      setEnvironmentsLoading(true);
      try {
        const result = await notionApi.fetchEnvironments();
        
        if (!isMounted) {
          console.log('🚫 AppSidebar: Component unmounted, ignoring result');
          return;
        }
        
        if (!result.success) {
          setEnvError(new Error(result.error || 'Unknown error'));
          setEnvironments([]);
          return;
        }
        
        if (result.data && result.data.environments && result.data.environments.length > 0) {
          setEnvironments(result.data.environments);
          setEnvError(null);
        } else {
          setEnvironments([]);
        }
      } catch (err) {
        if (!isMounted) return;
        
        // Don't set error if aborted
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('🚫 AppSidebar: Environment fetch aborted');
          return;
        }
        
        setEnvError(err instanceof Error ? err : new Error('Failed to load environments'));
        setEnvironments([]);
      } finally {
        if (isMounted) {
          setEnvironmentsLoading(false);
        }
      }
    };

    loadEnvironments();

    return () => {
      console.log('🧹 AppSidebar: Cleanup - aborting environment fetch');
      isMounted = false;
      abortController.abort();
    };
  }, []); // Empty deps - run once on mount

  const retryLoadEnvironments = () => {
    setEnvError(null);
    setEnvironmentsLoading(true);
    notionApi.fetchEnvironments().then(result => {
      if (result.success && result.data?.environments) {
        setEnvironments(result.data.environments);
        setEnvError(null);
      } else {
        setEnvError(new Error(result.error || 'Failed to load environments'));
      }
      setEnvironmentsLoading(false);
    });
  };

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
      className={open ? "w-1/6" : "w-14"}
      collapsible="icon"
    >
      <SidebarContent className="border-r border-border bg-background flex flex-col h-screen overflow-hidden">
        {/* Campaign Header */}
        {open && (
          <div
            className="relative h-40 bg-cover bg-center border-b border-border"
            style={{
              backgroundImage: selectedCampaign?.coverArt
                ? `url(${selectedCampaign.coverArt})`
                : `url(${heroBanner})`
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/70" />
            <div className="relative z-10 flex flex-col items-center justify-center h-full p-4 gap-2">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-white drop-shadow-lg">
                  {selectedCampaign?.name || 'Select Campaign'}
                </h2>
                {selectedCampaign?.description && (
                  <p className="text-xs text-white/80 drop-shadow-lg mt-1 line-clamp-2">
                    {selectedCampaign.description}
                  </p>
                )}
              </div>
              <div className="w-full max-w-[280px]">
                <CampaignSelect
                  value={selectedCampaign}
                  onValueChange={onCampaignChange}
                  placeholder="Select campaign..."
                  activeOnly={false}
                />
              </div>
            </div>
          </div>
        )}

        {/* Fixed Title Section */}
        {open && (
          <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <h3 className="text-xl font-bold text-foreground flex items-center justify-center gap-2">
              <Dice6 className="h-5 w-5 text-accent" />
              Encounter Generator
            </h3>
          </div>
        )}

        {/* Scrollable Parameters Section */}
        <SidebarGroup className="flex-1 overflow-hidden flex flex-col">
          {open && (
            <SidebarGroupContent className="px-6 py-6 overflow-y-auto flex-1">
              <div className="space-y-8">
                {/* Error Display */}
                {envError && (
                  <EdgeFunctionError
                    error={envError}
                    operationName="fetch environments"
                    onRetry={retryLoadEnvironments}
                  />
                )}

                {/* Environment Section */}
                <SelectField
                  label="Environment"
                  value={params.environment}
                  onValueChange={(value) => setParams(prev => ({ ...prev, environment: value }))}
                  options={environmentOptions}
                  loading={environmentsLoading}
                  disabled={environmentsLoading || !!envError}
                  placeholder={
                    environmentsLoading ? "Loading environments..." : 
                    envError ? "Error loading environments" :
                    "Select environment"
                  }
                  skeletonOptions={['Forest', 'Desert', 'Mountain', 'Coastal', 'Urban', 'Swamp']}
                  errorMessage={envError ? 
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
              </div>
            </SidebarGroupContent>
          )}
        </SidebarGroup>

        {/* Fixed Generate Button Section */}
        {open && (
          <div className="px-6 py-4 border-t border-border shrink-0 bg-background">
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
              <Button
                onClick={onGenerate}
                className="w-full btn-mystical text-primary-foreground font-semibold tracking-wide"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Encounter
              </Button>
            )}
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}