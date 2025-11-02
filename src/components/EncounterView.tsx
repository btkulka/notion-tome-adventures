import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Swords, ExternalLink, FileText, Menu, Coins } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { GeneratedEncounter } from '@/types/encounter';
import { MonsterCardContextMenu } from '@/components/ui/monster-card-context-menu';
import { AbilityScoresRadialChart } from '@/components/ui/ability-scores-radial-chart';
import { SessionSelect } from '@/components/ui/session-select';
import { MagicItemCard } from '@/components/MagicItemCard';
import { Input } from '@/components/ui/input';

interface EncounterViewProps {
  encounter: GeneratedEncounter;
  environment: string;
  onTitleChange?: (newTitle: string) => void;
  monsterCardTabs: Record<string, string | null>;
  setMonsterCardTabs: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
  selectedSession: {id: string, name: string} | null;
  setSelectedSession: (session: {id: string, name: string} | null) => void;
  selectedCampaign: {id: string, name: string, active: boolean} | null;
  onSaveEncounter: () => void;
}

// Parse dice roll formula and generate breakdown text
const formatDiceRollBreakdown = (formula: string, total: number): string => {
  if (!formula || formula === '0') return `${total} gp`;

  // Parse formula like "4d4" or "2d20"
  const match = formula.match(/^(\d+)d(\d+)$/);
  if (!match) return `${formula} = ${total} gp`;

  const numDice = parseInt(match[1]);
  const dieSize = parseInt(match[2]);

  // Generate plausible individual rolls that sum to total
  const rolls: number[] = [];
  let remaining = total;

  for (let i = 0; i < numDice - 1; i++) {
    // Random roll between 1 and min(dieSize, remaining - (numDice - i - 1))
    const maxRoll = Math.min(dieSize, remaining - (numDice - i - 1));
    const roll = Math.floor(Math.random() * maxRoll) + 1;
    rolls.push(roll);
    remaining -= roll;
  }

  // Last die gets whatever's left
  rolls.push(Math.max(1, Math.min(dieSize, remaining)));

  // Format as: **4d4**: (1) + (3) + (3) + (4) = **11 gp**
  const rollsText = rolls.map(r => `(${r})`).join(' + ');
  return `**${formula}**: ${rollsText} = **${total} gp**`;
};

// CR Color Mapping
const getCRColors = (cr: string | number) => {
  const crNum = typeof cr === 'string' ? parseFloat(cr) : cr;

  if (crNum < 1) {
    // Grey (CR 0 - CR 1/2)
    return {
      light: 'rgb(209, 213, 219)',
      regular: 'rgb(107, 114, 128)',
      dark: 'rgb(55, 65, 81)',
      name: 'gray'
    };
  } else if (crNum <= 5) {
    // White (CR 1 - CR 5)
    return {
      light: 'rgb(248, 250, 252)',
      regular: 'rgb(226, 232, 240)',
      dark: 'rgb(148, 163, 184)',
      name: 'slate'
    };
  } else if (crNum <= 10) {
    // Green (CR 6 - CR 10)
    return {
      light: 'rgb(134, 239, 172)',
      regular: 'rgb(34, 197, 94)',
      dark: 'rgb(21, 128, 61)',
      name: 'green'
    };
  } else if (crNum <= 15) {
    // Blue (CR 11 - CR 15)
    return {
      light: 'rgb(147, 197, 253)',
      regular: 'rgb(59, 130, 246)',
      dark: 'rgb(29, 78, 216)',
      name: 'blue'
    };
  } else if (crNum <= 20) {
    // Purple (CR 16 - CR 20)
    return {
      light: 'rgb(196, 181, 253)',
      regular: 'rgb(168, 85, 247)',
      dark: 'rgb(107, 33, 168)',
      name: 'purple'
    };
  } else {
    // Orange (CR >= 21)
    return {
      light: 'rgb(254, 215, 170)',
      regular: 'rgb(249, 115, 22)',
      dark: 'rgb(194, 65, 12)',
      name: 'orange'
    };
  }
};

export function EncounterView({
  encounter,
  environment,
  monsterCardTabs,
  setMonsterCardTabs,
  selectedSession,
  setSelectedSession,
  selectedCampaign,
  onSaveEncounter,
  onTitleChange
}: EncounterViewProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(encounter.encounter_name || 'Generated Encounter');
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleClick = () => {
    setIsEditingTitle(true);
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (titleValue.trim() && titleValue !== encounter.encounter_name && onTitleChange) {
      onTitleChange(titleValue.trim());
    } else {
      setTitleValue(encounter.encounter_name || 'Generated Encounter');
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleBlur();
    } else if (e.key === 'Escape') {
      setTitleValue(encounter.encounter_name || 'Generated Encounter');
      setIsEditingTitle(false);
    }
  };

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
      <div className="mb-6 lg:mb-8 mt-8">
        <div className="flex items-center gap-3 mb-4">
          <Swords className="h-6 w-6 lg:h-7 lg:w-7 text-accent" />
          {isEditingTitle ? (
            <Input
              ref={titleInputRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              className="text-2xl lg:text-3xl font-bold h-auto px-2 py-1 border-2"
            />
          ) : (
            <h1
              onClick={handleTitleClick}
              className="text-2xl lg:text-3xl font-bold text-foreground cursor-pointer transition-all duration-200 hover:bg-primary/5 hover:shadow-[0_0_10px_rgba(var(--primary),0.3)] rounded px-2 -mx-2 py-1"
            >
              {encounter.encounter_name || 'Generated Encounter'}
            </h1>
          )}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...encounter.creatures]
          .sort((a, b) => {
            // Sort by CR descending
            const crA = typeof a.challenge_rating === 'string' ? parseFloat(a.challenge_rating) : a.challenge_rating;
            const crB = typeof b.challenge_rating === 'string' ? parseFloat(b.challenge_rating) : b.challenge_rating;
            if (crB !== crA) return crB - crA;

            // Then by total gold descending (sum of individual gold or creature gold)
            const goldA = a.individualGold ? a.individualGold.reduce((sum, g) => sum + g, 0) : (a.gold ?? 0);
            const goldB = b.individualGold ? b.individualGold.reduce((sum, g) => sum + g, 0) : (b.gold ?? 0);
            return goldB - goldA;
          })
          .flatMap((creature, creatureIndex) => {
          return Array.from({ length: creature.quantity }, (_, instanceIndex) => {
            const cardKey = `${creatureIndex}-${instanceIndex}`;
            const activeTab = monsterCardTabs[cardKey] || null;

            // Get individual gold and roll for this specific instance
            const instanceGold = creature.individualGold?.[instanceIndex] ?? creature.gold ?? 0;
            const instanceGoldRoll = creature.goldRolls?.[instanceIndex] ?? creature.goldRoll ?? '';

            // Get treasure for this specific instance
            const instanceTreasure = creature.treasurePerInstance?.[instanceIndex] ?? creature.treasure ?? [];

            // Get CR colors
            const crColors = getCRColors(creature.challenge_rating);

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
                <Card
                  className="relative overflow-hidden border-border/50 shadow-lg transition-all duration-150 group/card aspect-[2/3] bg-background/60 backdrop-blur-md"
                  style={{
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    transformStyle: 'preserve-3d',
                    transition: 'all 0.15s ease-out'
                  }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const centerX = rect.width / 2;
                    const centerY = rect.height / 2;
                    const rotateX = ((y - centerY) / centerY) * -4; // More pronounced (max 4 degrees)
                    const rotateY = ((x - centerX) / centerX) * 4;

                    e.currentTarget.style.transform = `scale(1.02) perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
                    e.currentTarget.style.boxShadow = `0 10px 30px -5px ${crColors.regular.replace('rgb', 'rgba').replace(')', ', 0.5)')}`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1) perspective(1000px) rotateX(0deg) rotateY(0deg)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                  }}
                >
                  {/* Background Image */}
                  {creature.image_url && (
                    <div className="absolute inset-0 z-0">
                      <img
                        src={creature.image_url}
                        alt={creature.name}
                        className="w-full h-full object-cover object-center opacity-100"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Content - positioned relative to stay above background */}
                  <div className="relative z-10 h-full flex flex-col">
                    {/* Animated gradient bar */}
                    <div
                      className="h-1"
                      style={{
                        background: `linear-gradient(90deg, ${crColors.light}, ${crColors.regular}, ${crColors.dark}, ${crColors.regular}, ${crColors.light})`,
                        backgroundSize: '200% 100%',
                        animation: 'gradient-pulse 3s ease-in-out infinite'
                      }}
                    />

                    <div className="p-1 flex justify-between items-start">
                      {/* CR and XP badges on left */}
                      <div className="flex gap-1">
                        <Badge
                          variant="secondary"
                          className="text-xs px-1.5 py-0.5 backdrop-blur-md border-white/20 transition-all cursor-default hover:scale-105"
                          style={{
                            backgroundColor: crColors.regular.replace('rgb', 'rgba').replace(')', ', 0.6)'),
                            color: crColors.name === 'gray' || crColors.name === 'slate' ? 'black' : 'white'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = crColors.regular.replace('rgb', 'rgba').replace(')', ', 0.8)');
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = crColors.regular.replace('rgb', 'rgba').replace(')', ', 0.6)');
                          }}
                        >
                          CR {creature.challenge_rating}
                        </Badge>
                        <Badge variant="secondary" className="bg-background/40 backdrop-blur-md border-white/20 text-accent font-bold text-xs px-1.5 py-0.5 hover:bg-background/60 hover:scale-105 transition-all cursor-default">
                          {creature.xp_value} XP
                        </Badge>
                      </div>

                      {/* Menu button on right */}
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

                    {/* Flex spacer to push content to bottom */}
                    <div className="flex-1" />

                    <CardContent className="p-2 mt-auto">
                    <div className="space-y-1">
                      <div className="bg-background/25 backdrop-blur-md rounded px-2 py-1">
                        <h4 className="font-bold text-sm text-foreground mb-1">{creature.name}</h4>
                        <div className="flex flex-wrap gap-0.5">
                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-background/25 backdrop-blur-md border-white/20 hover:bg-background/40 hover:scale-105 transition-all cursor-default">{creature.size || 'Unknown Size'}</Badge>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-background/25 backdrop-blur-md border-white/20 hover:bg-background/40 hover:scale-105 transition-all cursor-default">{creature.creature_type || 'Unknown Type'}</Badge>
                          {creature.creature_subtype && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/15 backdrop-blur-md border-white/20 hover:bg-primary/25 hover:scale-105 transition-all cursor-default">{creature.creature_subtype}</Badge>
                          )}
                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-background/25 backdrop-blur-md border-white/20 hover:bg-background/40 hover:scale-105 transition-all cursor-default">{creature.alignment || 'Unknown Alignment'}</Badge>
                        </div>
                      </div>

                      <Separator className="my-0.5" />

                      <div className="w-full">
                        {/* Hide tabs, always show loot */}
                        <div className="mt-1">
                          <div className="py-1.5 bg-background/25 backdrop-blur-md rounded border border-white/20">
                            {/* Check if there's any loot besides gold */}
                            {(instanceTreasure && instanceTreasure.length > 0) || creature.treasure_type ? (
                              <div className="flex gap-2 px-1.5">
                                {/* Gold column (15%) - only show if there's gold */}
                                {instanceGold !== undefined && instanceGold > 0 && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex flex-col items-center justify-center gap-0.5 min-w-[15%] max-w-[15%] bg-black/60 backdrop-blur-sm rounded px-1 py-1" style={{ mixBlendMode: 'normal' }}>
                                          <Coins className="h-4 w-4 text-yellow-400 drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                                          <span className="text-[9px] font-bold text-yellow-300 whitespace-nowrap drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]">
                                            {instanceGold} gp
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs" dangerouslySetInnerHTML={{
                                          __html: formatDiceRollBreakdown(instanceGoldRoll, instanceGold)
                                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                        }} />
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}

                                {/* Loot list column (85% or 100% if no gold) */}
                                <div className={instanceGold !== undefined && instanceGold > 0 ? "flex-1 space-y-1.5" : "w-full space-y-1.5"}>
                                  {instanceTreasure && instanceTreasure.length > 0 && (
                                    <div className="space-y-1.5">
                                      {instanceTreasure.map((item, idx) => (
                                        <MagicItemCard key={idx} item={item} />
                                      ))}
                                    </div>
                                  )}
                                  {creature.treasure_type && (
                                    <div className="flex items-center justify-between p-1.5 rounded bg-background/25 backdrop-blur-md border border-white/20">
                                      <span className="text-[10px] font-semibold text-foreground">Treasure Type</span>
                                      <Badge variant="outline" className="bg-primary/15 backdrop-blur-md text-primary border-primary/30 text-[10px] hover:bg-primary/25 hover:scale-105 transition-all cursor-default">
                                        {creature.treasure_type}
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* Only gold exists, or no loot at all - full width */
                              <div className="px-1.5">
                                {instanceGold !== undefined && instanceGold > 0 ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center justify-center gap-2 p-1.5 rounded bg-black/60 backdrop-blur-sm border border-yellow-500/50 cursor-default" style={{ mixBlendMode: 'normal' }}>
                                          <Coins className="h-4 w-4 text-yellow-400 drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                                          <span className="text-[10px] font-bold text-yellow-300 drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]">
                                            {instanceGold} gp
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs" dangerouslySetInnerHTML={{
                                          __html: formatDiceRollBreakdown(instanceGoldRoll, instanceGold)
                                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                        }} />
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <div className="text-[10px] text-muted-foreground text-center py-1.5">
                                    No loot available
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  </div>
                </Card>
              </MonsterCardContextMenu>
            );
          });
        })}
      </div>
    </div>
  );
}
