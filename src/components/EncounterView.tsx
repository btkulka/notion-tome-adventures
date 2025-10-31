import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Swords, ExternalLink, FileText, Menu } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { GeneratedEncounter } from '@/types/encounter';
import { MonsterCardContextMenu } from '@/components/ui/monster-card-context-menu';
import { AbilityScoresRadialChart } from '@/components/ui/ability-scores-radial-chart';
import { SessionSelect } from '@/components/ui/session-select';

interface EncounterViewProps {
  encounter: GeneratedEncounter;
  environment: string;
  monsterCardTabs: Record<string, string | null>;
  setMonsterCardTabs: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  selectedSession: {id: string, name: string} | null;
  setSelectedSession: (session: {id: string, name: string} | null) => void;
  selectedCampaign: {id: string, name: string, active: boolean} | null;
  onSaveEncounter: () => void;
}

export function EncounterView({
  encounter,
  environment,
  monsterCardTabs,
  setMonsterCardTabs,
  selectedSession,
  setSelectedSession,
  selectedCampaign,
  onSaveEncounter
}: EncounterViewProps) {

  // Generate stable ability scores based on creature properties
  const generateAbilityScores = (creatureName: string, cr: number, creatureType?: string) => {
    const seed = creatureName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rng = (index: number) => ((seed + index * 7) % 10) + 1;

    const crBonus = Math.floor(cr / 3);
    const baseScores = {
      str: 10 + rng(0) + crBonus,
      dex: 10 + rng(1) + crBonus,
      con: 10 + rng(2) + crBonus,
      int: 10 + rng(3) + (creatureType?.includes('Dragon') ? 2 : 0),
      wis: 10 + rng(4) + crBonus,
      char: 10 + rng(5) + (creatureType?.includes('Fiend') ? 2 : 0)
    };

    Object.keys(baseScores).forEach(key => {
      baseScores[key as keyof typeof baseScores] = Math.min(20, baseScores[key as keyof typeof baseScores]);
    });

    return baseScores;
  };

  return (
    <div className="space-y-6">
      {/* Encounter Stats Header */}
      <div className="mb-6 lg:mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Swords className="h-6 w-6 lg:h-7 lg:w-7 text-accent" />
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            {encounter.encounter_name || 'Generated Encounter'}
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <div className="min-w-[200px]">
              <SessionSelect
                value={selectedSession}
                onValueChange={setSelectedSession}
                placeholder={selectedCampaign ? "Select session..." : "Select a campaign first..."}
                campaignId={selectedCampaign?.id}
              />
            </div>
            <Button
              onClick={onSaveEncounter}
              className="btn-mystical flex items-center gap-2"
              size="sm"
            >
              <ExternalLink className="h-4 w-4" />
              Export to Notion
            </Button>
          </div>
        </div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent mb-6"></div>

        <TooltipProvider>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center cursor-help">
                  <div className="text-sm text-muted-foreground mb-1">Environment</div>
                  <div className="font-semibold text-accent">{environment}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>The environment(s) where this encounter takes place</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center cursor-help">
                  <div className="text-sm text-muted-foreground mb-1">Total XP</div>
                  <div className="font-semibold text-accent">{encounter.total_xp.toLocaleString()}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Total experience points awarded for defeating all creatures</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center cursor-help">
                  <div className="text-sm text-muted-foreground mb-1">Creatures</div>
                  <div className="font-semibold text-accent">
                    {encounter.creatures.reduce((total, creature) => total + creature.quantity, 0)}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Total number of individual creatures in this encounter</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-center cursor-help">
                  <div className="text-sm text-muted-foreground mb-1">Unique Types</div>
                  <div className="font-semibold text-accent">
                    {encounter.creatures.length}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Number of different creature types in this encounter</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* Monster Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {encounter.creatures.flatMap((creature, creatureIndex) => {
          return Array.from({ length: creature.quantity }, (_, instanceIndex) => {
            const cardKey = `${creatureIndex}-${instanceIndex}`;
            const activeTab = monsterCardTabs[cardKey] || null;

            const handleTabClick = (value: string) => {
              const currentTab = monsterCardTabs[cardKey];
              if (currentTab === value) {
                setMonsterCardTabs(prev => ({ ...prev, [cardKey]: null }));
              } else {
                setMonsterCardTabs(prev => ({ ...prev, [cardKey]: value }));
              }
            };

            return (
              <MonsterCardContextMenu
                key={cardKey}
                monsterName={creature.name}
                onOpenMonsterInstance={() => {}}
                onOpenMonsterData={() => {}}
              >
                <Card className="bg-gradient-to-br from-card to-muted/20 border-border/50 shadow-lg hover:shadow-mystical transition-all duration-300">
                  <div className="h-1 bg-gradient-to-r from-accent/50 to-primary/50" />

                  <div className="p-1 flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 bg-black/30 hover:bg-black/50">
                          <Menu className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            const statblockUrl = `https://www.dndbeyond.com/monsters/${creature.name.toLowerCase().replace(/\s+/g, '-')}`;
                            window.open(statblockUrl, '_blank');
                          }}
                          className="cursor-pointer"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          <span>Display Statblock</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {creature.image_url && (
                    <div className="relative h-48 w-full overflow-hidden">
                      <img
                        src={creature.image_url}
                        alt={creature.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute top-2 right-2 flex gap-2">
                        <Badge variant="secondary" className="bg-black/70 text-white">
                          CR {creature.challenge_rating}
                        </Badge>
                        <Badge variant="secondary" className="bg-black/70 text-accent font-bold">
                          {creature.xp_value} XP
                        </Badge>
                      </div>
                    </div>
                  )}

                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-bold text-lg text-foreground mb-3">{creature.name}</h4>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-xs">{creature.size || 'Unknown Size'}</Badge>
                          <Badge variant="outline" className="text-xs">{creature.creature_type || 'Unknown Type'}</Badge>
                          {creature.creature_subtype && (
                            <Badge variant="outline" className="text-xs bg-primary/10">{creature.creature_subtype}</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">{creature.alignment || 'Unknown Alignment'}</Badge>
                        </div>
                      </div>

                      <Separator />

                      <div className="w-full">
                        <div className="grid w-full grid-cols-2 border border-border rounded-lg overflow-hidden">
                          <button
                            onClick={() => handleTabClick("loot")}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                              activeTab === "loot"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Loot
                          </button>
                          <button
                            onClick={() => handleTabClick("abilities")}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-l border-border ${
                              activeTab === "abilities"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Abilities
                          </button>
                        </div>

                        {activeTab && (
                          <div className="mt-4 transition-all duration-200 ease-in-out">
                            {activeTab === "loot" && (
                              <div className="py-4 bg-muted/30 rounded-lg border border-border/50">
                                <div className="space-y-3 px-4">
                                  {creature.gold !== undefined && creature.gold > 0 && (
                                    <div className="flex items-center justify-between p-3 rounded-md bg-gradient-to-br from-yellow-500/20 to-amber-600/20 border border-yellow-500/30">
                                      <span className="text-sm font-semibold text-foreground">Gold</span>
                                      <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 font-bold">
                                        {creature.gold} gp
                                      </Badge>
                                    </div>
                                  )}
                                  {creature.goldRoll && creature.goldRoll !== '0' && (
                                    <div className="text-xs text-muted-foreground text-center">
                                      Rolled: {creature.goldRoll}
                                    </div>
                                  )}
                                  {creature.treasure_type && (
                                    <div className="flex items-center justify-between p-3 rounded-md bg-card/50 border border-border/50">
                                      <span className="text-sm font-semibold text-foreground">Treasure Type</span>
                                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                        {creature.treasure_type}
                                      </Badge>
                                    </div>
                                  )}
                                  {(!creature.gold || creature.gold === 0) && !creature.treasure_type && (
                                    <div className="text-sm text-muted-foreground text-center py-4">
                                      No loot available
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {activeTab === "abilities" && (
                              <div className="flex justify-center bg-muted/30 rounded-lg border border-border/50 py-4">
                                <AbilityScoresRadialChart
                                  scores={generateAbilityScores(
                                    creature.name,
                                    typeof creature.challenge_rating === 'string'
                                      ? parseFloat(creature.challenge_rating)
                                      : creature.challenge_rating,
                                    creature.creature_type
                                  )}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </MonsterCardContextMenu>
            );
          });
        })}
      </div>
    </div>
  );
}
