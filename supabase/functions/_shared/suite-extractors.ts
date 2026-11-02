// Locations and Characters: the Notion databases the DM suite adds.
import {
  extractBaseProperties,
  extractCheckbox,
  extractFiles,
  extractNumber,
  extractRelation,
  extractSelect,
  extractText,
} from './notion-extractors.ts'

export const LOCATION_TYPES = [
  'Region', 'Village', 'Town', 'City', 'Castle', 'Ruin', 'Dungeon', 'Cave', 'Tower', 'Shrine', 'Camp', 'Landmark',
]

export const LIGHT_SOURCES = ['None', 'Torch', 'Lantern', 'Light cantrip', 'Other']

export interface LocationDTO {
  id: string
  url: string
  name: string
  type: string
  campaignIds: string[]
  parentLocationIds: string[]
  playerDescription: string
  /** Never sent to players. */
  dmNotes: string
  image: string | null
  mapId: string
}

/** What a player may see of a location. */
export type PlayerLocationDTO = Pick<LocationDTO, 'id' | 'name' | 'type' | 'playerDescription' | 'image'>

export interface CharacterDTO {
  id: string
  url: string
  name: string
  player: string
  discordUsername: string
  campaignIds: string[]
  level: number
  characterClass: string
  portrait: string | null
  darkvision: number
  lightSource: string
  active: boolean
}

/** All rich-text segments joined; `extractText` only returns the first one. */
export function extractFullText(properties: any, propertyNames: string[]): string {
  for (const name of propertyNames) {
    const prop = properties[name]
    const parts = prop?.type === 'rich_text' ? prop.rich_text : prop?.type === 'title' ? prop.title : null
    if (Array.isArray(parts) && parts.length > 0) return parts.map((p: any) => p.plain_text ?? '').join('')
  }
  return ''
}

export function extractLocation(page: any): LocationDTO {
  const props = page.properties
  const base = extractBaseProperties(page)
  return {
    id: base.id,
    url: base.url,
    name: extractText(props, ['Name']),
    type: extractSelect(props, ['Type']),
    campaignIds: extractRelation(props, ['Campaign']),
    parentLocationIds: extractRelation(props, ['Parent Location']),
    playerDescription: extractFullText(props, ['Player Description']),
    dmNotes: extractFullText(props, ['DM Notes']),
    image: extractFiles(props, ['Image'])[0] ?? null,
    mapId: extractText(props, ['Map ID']),
  }
}

export function toPlayerLocation(location: LocationDTO): PlayerLocationDTO {
  return {
    id: location.id,
    name: location.name,
    type: location.type,
    playerDescription: location.playerDescription,
    image: location.image,
  }
}

export function extractCharacter(page: any): CharacterDTO {
  const props = page.properties
  const base = extractBaseProperties(page)
  return {
    id: base.id,
    url: base.url,
    name: extractText(props, ['Name']),
    player: extractText(props, ['Player']),
    discordUsername: extractText(props, ['Discord Username']),
    campaignIds: extractRelation(props, ['Campaign']),
    level: extractNumber(props, ['Level'], 1),
    characterClass: extractSelect(props, ['Class']),
    portrait: extractFiles(props, ['Portrait'])[0] ?? null,
    darkvision: extractNumber(props, ['Darkvision'], 0),
    lightSource: extractSelect(props, ['Light Source']),
    active: extractCheckbox(props, ['Active']),
  }
}

/** Notion ids come back dashed or undashed depending on the source. */
export function sameNotionId(a: string, b: string): boolean {
  return a.replace(/-/g, '').toLowerCase() === b.replace(/-/g, '').toLowerCase()
}

export function richText(content: string) {
  // Notion caps a single rich-text segment at 2000 characters.
  const chunks = content.match(/[\s\S]{1,2000}/g) ?? []
  return { rich_text: chunks.map((chunk) => ({ text: { content: chunk } })) }
}
