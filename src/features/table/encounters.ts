// Random encounters on the road: the tile's biome picks Notion environments,
// the party's levels set the XP budget, and the existing generator rolls the
// creatures from the Notion bestiary. Nothing here invents monsters.
import { difficultyUtils } from '@/lib/encounter-algorithms';
import { notionApi } from '@/hooks/useNotionService';
import { charactersApi } from '@/features/characters/api';
import { BIOMES, type BiomeId } from '@/features/maps/terrain/biomes';
import type { EncounterRules, MapSettings } from '@/features/maps/types';

export interface RolledCreature {
  name: string;
  quantity: number;
  cr: string;
  xp: number;
}

export interface RolledEncounter {
  biome: string;
  environments: string[];
  difficulty: string;
  totalXp: number;
  creatures: RolledCreature[];
}

export class EncounterSetupError extends Error {}

/** Levels of the campaign's characters in the party, read fresh so a sync or level-up counts at once. */
export async function loadPartyLevels(campaignId: string): Promise<number[]> {
  const characters = await charactersApi.list(campaignId);
  return characters.filter((c) => c.active).map((c) => c.level).filter((l) => l > 0);
}

export async function rollEncounter(
  campaignId: string,
  settings: MapSettings,
  biome: number,
  rules: EncounterRules = settings.encounters
): Promise<RolledEncounter> {
  const biomeName = BIOMES[biome as BiomeId]?.name ?? 'Unknown';
  const environments = (settings.biomeEnvironments[biome] ?? []).map((e) => e.name);
  if (environments.length === 0) {
    throw new EncounterSetupError(`${biomeName} has no Notion environment yet. Map it in the editor's Encounters tab.`);
  }
  const levels = await loadPartyLevels(campaignId);
  if (levels.length === 0) {
    throw new EncounterSetupError('No characters in the party yet, so there is no XP budget to roll against. Add them under Campaign.');
  }
  const budget = difficultyUtils.thresholdsForLevels(levels)[rules.difficulty];
  const result = await notionApi.generateEncounter({ environment: environments, xpThreshold: budget, maxMonsters: rules.maxMonsters });
  if (!result.success) throw new Error(result.error ?? 'The encounter generator failed');
  const data = result.data ?? {};
  const creatures: RolledCreature[] = (data.creatures ?? []).map((c: { name?: string; quantity?: number; cr?: string | number; xp?: number }) => ({
    name: c.name ?? 'Unknown creature',
    quantity: c.quantity ?? 1,
    cr: String(c.cr ?? '?'),
    xp: c.xp ?? 0,
  }));
  if (creatures.length === 0) throw new EncounterSetupError(`No creatures in ${environments.join(', ')} fit a ${rules.difficulty} budget of ${budget} XP.`);
  return { biome: biomeName, environments, difficulty: data.difficulty ?? rules.difficulty, totalXp: data.totalXP ?? 0, creatures };
}

/** Challenge rating to tier name (see the Tome tier scale). */
export function crTier(cr: string): string {
  const n = cr.includes('/') ? Number(cr.split('/')[0]) / Number(cr.split('/')[1]) : Number(cr);
  if (!Number.isFinite(n) || n < 1) return 'ash';
  if (n <= 5) return 'bone';
  if (n <= 10) return 'verdant';
  if (n <= 15) return 'azure';
  if (n <= 20) return 'amethyst';
  return 'ember';
}

export const DIFFICULTY_TIER: Record<string, string> = { easy: 'bone', medium: 'verdant', hard: 'azure', deadly: 'amethyst' };
