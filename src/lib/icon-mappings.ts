import {
  Trees, Mountain, Waves, Sun, Building, Castle, Globe, Landmark, Home,
  Shield, Sword, Heart, Skull, Crown, Users, User, Zap, Star, Target, Scale, 
  Maximize, Minimize, Sparkles
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

/**
 * Centralized icon mapping utilities for D&D entities
 * Eliminates duplicate icon selection logic across components
 */

export type DnDEntityType = 'environment' | 'alignment' | 'creatureType' | 'size';

// Environment icon mappings
const ENVIRONMENT_ICONS: Record<string, LucideIcon> = {
  forest: Trees,
  wood: Trees,
  woodland: Trees,
  mountain: Mountain,
  hill: Mountain,
  hills: Mountain,
  desert: Sun,
  sand: Sun,
  swamp: Waves,
  marsh: Waves,
  bog: Waves,
  city: Building,
  town: Building,
  urban: Building,
  dungeon: Castle,
  castle: Castle,
  fortress: Castle,
  ruin: Landmark,
  ruins: Landmark,
  ancient: Landmark,
  cave: Mountain,
  cavern: Mountain,
  underground: Mountain,
  any: Globe,
};

// Alignment icon mappings
const ALIGNMENT_ICONS: Record<string, LucideIcon> = {
  'lawful good': Crown,
  'lg': Crown,
  'lawful neutral': Shield,
  'ln': Shield,
  'lawful evil': Sword,
  'le': Sword,
  'neutral good': Heart,
  'ng': Heart,
  'true neutral': Scale,
  'tn': Scale,
  'neutral': Scale,
  'neutral evil': Skull,
  'ne': Skull,
  'chaotic good': Star,
  'cg': Star,
  'chaotic neutral': Zap,
  'cn': Zap,
  'chaotic evil': Target,
  'ce': Target,
  'any': Globe,
};

// Creature type icon mappings
const CREATURE_TYPE_ICONS: Record<string, LucideIcon> = {
  humanoid: Users,
  beast: Heart,
  dragon: Zap,
  undead: Skull,
  fiend: Target,
  celestial: Star,
  fey: Sparkles,
  elemental: Mountain,
  aberration: Zap,
  construct: Shield,
  giant: Crown,
  monstrosity: Sword,
  ooze: Waves,
  plant: Trees,
  any: Globe,
};

// Size icon mappings
const SIZE_ICONS: Record<string, LucideIcon> = {
  tiny: Minimize,
  small: User,
  medium: Users,
  large: Crown,
  huge: Mountain,
  gargantuan: Maximize,
  any: Globe,
};

/**
 * Get icon for an environment name
 */
export function getEnvironmentIcon(environment: string): LucideIcon {
  const key = environment.toLowerCase();
  return ENVIRONMENT_ICONS[key] || Home;
}

/**
 * Get icon for an alignment name
 */
export function getAlignmentIcon(alignment: string): LucideIcon {
  const key = alignment.toLowerCase();
  return ALIGNMENT_ICONS[key] || User;
}

/**
 * Get icon for a creature type
 */
export function getCreatureTypeIcon(creatureType: string): LucideIcon {
  const key = creatureType.toLowerCase();
  return CREATURE_TYPE_ICONS[key] || User;
}

/**
 * Get icon for a size category
 */
export function getSizeIcon(size: string): LucideIcon {
  const key = size.toLowerCase();
  return SIZE_ICONS[key] || Users;
}

/**
 * Generic icon mapper for any D&D entity type
 */
export function getDnDIcon(entityType: DnDEntityType, value: string): LucideIcon {
  switch (entityType) {
    case 'environment':
      return getEnvironmentIcon(value);
    case 'alignment':
      return getAlignmentIcon(value);
    case 'creatureType':
      return getCreatureTypeIcon(value);
    case 'size':
      return getSizeIcon(value);
    default:
      return User;
  }
}

/**
 * Get all available icons for a specific entity type
 */
export function getAvailableIcons(entityType: DnDEntityType): Record<string, LucideIcon> {
  switch (entityType) {
    case 'environment':
      return ENVIRONMENT_ICONS;
    case 'alignment':
      return ALIGNMENT_ICONS;
    case 'creatureType':
      return CREATURE_TYPE_ICONS;
    case 'size':
      return SIZE_ICONS;
    default:
      return {};
  }
}
