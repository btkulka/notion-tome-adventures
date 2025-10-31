import React from 'react';
import { Button } from '@/components/ui/button';
import { Dice6, Sparkles, Scroll, X, ChevronDown, Wand2 } from 'lucide-react';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { MultiSelect } from '@/components/ui/multi-select';

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

const rarities = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];

interface AppSidebarProps {
  params: EncounterParams;
  setParams: React.Dispatch<React.SetStateAction<EncounterParams>>;
  onGenerate: () => void;
  onGenerateMagicItems?: (rarities: string[], maxItems: number) => void;
  onCancel: () => void;
  isGenerating: boolean;
  selectedCampaign: NotionCampaign | null;
  onCampaignChange: (campaign: NotionCampaign | null) => void;
}

type GeneratorType = 'encounter' | 'magic-item';

export function AppSidebar({ params, setParams, onGenerate, onGenerateMagicItems, onCancel, isGenerating, selectedCampaign, onCampaignChange }: AppSidebarProps) {
  const { open } = useSidebar();
  const { toast } = useToast();
  const [environments, setEnvironments] = React.useState<{ id: string; name: string }[]>([]);
  const [envError, setEnvError] = React.useState<Error | null>(null);
  const [environmentsLoading, setEnvironmentsLoading] = React.useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = React.useState(false);
  const [generatorType, setGeneratorType] = React.useState<GeneratorType>('encounter');

  // Creature Subtype State
  const [allCreatureSubtypes, setAllCreatureSubtypes] = React.useState<string[]>([]);
  const [availableSubtypes, setAvailableSubtypes] = React.useState<string[]>([]);

  // Magic Item Generator State
  const [selectedRarities, setSelectedRarities] = React.useState<string[]>([]);
  const [maxItems, setMaxItems] = React.useState(5);

  // Load creature subtypes once on mount
  React.useEffect(() => {
    let isMounted = true;

    const loadCreatureSubtypes = async () => {
      try {
        const result = await notionApi.fetchCreatures();

        if (!isMounted) return;

        if (result.success && result.data?.creatures) {
          // Extract unique subtypes from all creatures
          const subtypes = new Set<string>();
          result.data.creatures.forEach((creature: any) => {
            if (creature.creature_subtype) {
              subtypes.add(creature.creature_subtype);
            }
          });
          const sortedSubtypes = Array.from(subtypes).sort();
          setAllCreatureSubtypes(sortedSubtypes);
          console.log(`Loaded ${sortedSubtypes.length} creature subtypes`);
        }
      } catch (err) {
        console.error('Error loading creature subtypes:', err);
      }
    };

    loadCreatureSubtypes();

    return () => {
      isMounted = false;
    };
  }, []);

  // Update available subtypes when creature type selection changes
  React.useEffect(() => {
    // When a creature type is selected (and it's not 'Any'), show all subtypes
    // In the future, we could filter subtypes by selected types if we had that mapping
    if (params.creatureType.length > 0 && !params.creatureType.includes('Any')) {
      setAvailableSubtypes(allCreatureSubtypes);
    } else {
      setAvailableSubtypes([]);
      // Clear subtype selection when 'Any' is selected or no types are selected
      if (params.creatureSubtype.length > 0) {
        setParams(prev => ({ ...prev, creatureSubtype: [] }));
      }
    }
  }, [params.creatureType, allCreatureSubtypes]);

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

          // Show warning toast if some environments failed to load
          if (result.metadata?.failed && result.metadata.failed > 0) {
            toast({
              title: "Warning",
              description: `${result.metadata.failed} environment${result.metadata.failed === 1 ? '' : 's'} couldn't be loaded`,
              variant: "destructive",
            });
          }
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
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-black/80" />
            <div className="relative z-10 flex flex-col items-center justify-center h-full p-4 gap-2">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-white drop-shadow-lg">
                  {selectedCampaign?.name || 'Select Campaign'}
                </h2>
              </div>
              <div className="w-full">
                <CampaignSelect
                  value={selectedCampaign}
                  onValueChange={onCampaignChange}
                  placeholder="Select campaign..."
                  activeOnly={false}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Fixed Title Section */}
        {open && (
          <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <Select value={generatorType} onValueChange={(value) => setGeneratorType(value as GeneratorType)}>
              <SelectTrigger className="w-full bg-transparent border-0 border-b-2 border-border rounded-none px-0 py-3 text-lg font-bold text-yellow-600 dark:text-yellow-500">
                <SelectValue>
                  <div className="flex items-center justify-center gap-2">
                    {generatorType === 'encounter' ? (
                      <>
                        <Dice6 className="h-5 w-5 text-accent" />
                        <span>Encounter Generator</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-5 w-5 text-accent" />
                        <span>Magic Item Generator</span>
                      </>
                    )}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="encounter">
                  <div className="flex items-center gap-2">
                    <Dice6 className="h-4 w-4" />
                    <span>Encounter Generator</span>
                  </div>
                </SelectItem>
                <SelectItem value="magic-item">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4" />
                    <span>Magic Item Generator</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Scrollable Parameters Section */}
        <SidebarGroup className="flex-1 overflow-hidden flex flex-col">
          {open && (
            <SidebarGroupContent className="px-6 py-6 overflow-y-auto flex-1">
              <div className="space-y-8">
                {generatorType === 'encounter' ? (
                  <>
                    {/* Error Display */}
                    {envError && (
                      <EdgeFunctionError
                        error={envError}
                        operationName="fetch environments"
                        onRetry={retryLoadEnvironments}
                      />
                    )}

                    {/* Environment Section */}
                    {envError && (
                      <div className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2 mb-4">
                        Using default environments. Configure Notion integration for custom data.
                      </div>
                    )}
                    <MultiSelect
                      label="Environment"
                      placeholder={
                        environmentsLoading ? "Loading environments..." :
                        envError ? "Error loading environments" :
                        "Select environments..."
                      }
                      options={environmentOptions}
                      value={params.environment}
                      onChange={(value) => {
                        // Always ensure 'Any' is selected if nothing else is selected
                        const newValue = value.length === 0 ? ['Any'] : value;
                        setParams(prev => ({ ...prev, environment: newValue }));
                      }}
                      disabled={environmentsLoading || !!envError}
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
                      goldText
                    />

                    <NumberInput
                      label="Max Monsters"
                      value={params.maxMonsters}
                      onChange={(value) => setParams(prev => ({ ...prev, maxMonsters: value }))}
                      min={1}
                      max={20}
                      goldText
                    />
                  </FormGrid>

                  <FormGrid columns={2}>
                    <CRSelect
                      label="Min CR"
                      value={params.minCR}
                      onValueChange={(value) => setParams(prev => ({ ...prev, minCR: value }))}
                      goldText
                    />

                    <CRSelect
                      label="Max CR"
                      value={params.maxCR}
                      onValueChange={(value) => setParams(prev => ({ ...prev, maxCR: value }))}
                      goldText
                    />
                  </FormGrid>
                </FormSection>

                {/* Advanced Filters Section */}
                <Collapsible
                  open={advancedFiltersOpen}
                  onOpenChange={setAdvancedFiltersOpen}
                  className="space-y-4"
                >
                  <CollapsibleTrigger className="w-full group">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wide border-b border-border pb-2 flex-1">
                        Advanced Filters
                      </h3>
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${advancedFiltersOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4">
                    <MultiSelect
                      label="Alignment"
                      placeholder="Select alignments..."
                      options={alignmentOptions.filter(opt => opt.value !== 'Any')}
                      value={params.alignment}
                      onChange={(value) => {
                        const newValue = value.length === 0 ? ['Any'] : value;
                        setParams(prev => ({ ...prev, alignment: newValue }));
                      }}
                    />

                    <MultiSelect
                      label="Creature Type"
                      placeholder="Select creature types..."
                      options={creatureTypeOptions.filter(opt => opt.value !== 'Any')}
                      value={params.creatureType}
                      onChange={(value) => {
                        const newValue = value.length === 0 ? ['Any'] : value;
                        setParams(prev => ({ ...prev, creatureType: newValue, creatureSubtype: [] }));
                      }}
                    />

                    {params.creatureType.length > 0 && !params.creatureType.includes('Any') && availableSubtypes.length > 0 && (
                      <MultiSelect
                        label="Creature Subtype"
                        placeholder="Select creature subtypes..."
                        options={availableSubtypes.map(subtype => ({
                          value: subtype,
                          label: subtype
                        }))}
                        value={params.creatureSubtype}
                        onChange={(value) => {
                          setParams(prev => ({ ...prev, creatureSubtype: value }));
                        }}
                      />
                    )}

                    <MultiSelect
                      label="Size"
                      placeholder="Select sizes..."
                      options={sizeOptions.filter(opt => opt.value !== 'Any')}
                      value={params.size}
                      onChange={(value) => {
                        const newValue = value.length === 0 ? ['Any'] : value;
                        setParams(prev => ({ ...prev, size: newValue }));
                      }}
                    />
                  </CollapsibleContent>
                </Collapsible>
                  </>
                ) : (
                  <>
                    {/* Magic Item Generator Parameters */}
                    <FormSection title="Magic Item Settings">
                      <MultiSelect
                        label="Rarity"
                        placeholder="Select rarities..."
                        options={rarities.map(rarity => ({
                          value: rarity,
                          label: rarity
                        }))}
                        value={selectedRarities}
                        onChange={setSelectedRarities}
                      />

                      <NumberInput
                        label="Max Items"
                        value={maxItems}
                        onChange={setMaxItems}
                        min={1}
                        max={20}
                        goldText
                      />
                    </FormSection>
                  </>
                )}
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
                  {generatorType === 'encounter' ? (
                    <>
                      <Dice6 className="mr-2 h-4 w-4 animate-spin" />
                      Rolling the Dice...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4 animate-spin" />
                      Conjuring Items...
                    </>
                  )}
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
                onClick={() => {
                  console.log('Generate button clicked, type:', generatorType);
                  if (generatorType === 'encounter') {
                    console.log('Calling onGenerate');
                    onGenerate();
                  } else if (generatorType === 'magic-item') {
                    console.log('Calling onGenerateMagicItems with rarities:', selectedRarities, 'maxItems:', maxItems);
                    if (onGenerateMagicItems) {
                      onGenerateMagicItems(selectedRarities, maxItems);
                    } else {
                      console.error('onGenerateMagicItems is not defined');
                    }
                  }
                }}
                disabled={isGenerating}
                className="w-full btn-mystical text-primary-foreground font-semibold tracking-wide"
              >
                {generatorType === 'encounter' ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Encounter
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate Magic Items
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}