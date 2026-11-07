// Player characters: the field rules and the D&D Beyond link, shared by the
// Worker (worker/api/characters.ts) and the character screens so a link is
// read the same way on both sides. No imports: the Worker bundles this file too.

export const LIGHT_SOURCES = ['None', 'Torch', 'Lantern', 'Light cantrip', 'Other'] as const;
export type LightSource = (typeof LIGHT_SOURCES)[number];

export const MAX_NAME = 80;
export const MAX_LEVEL = 20;

/** What a sync copies from a D&D Beyond sheet; everything else on a character is the app's own. */
export interface DdbSheet {
  name: string;
  race: string;
  characterClass: string;
  level: number;
  portraitUrl: string | null;
  darkvision: number;
}

/**
 * The character id in a D&D Beyond link: a sheet or builder URL, a share link
 * (`/characters/123/AbCd`, `ddb.ac/characters/123/AbCd`), a profile URL, or the
 * bare number. Null when the text isn't one.
 */
export function ddbCharacterId(input: string): string | null {
  const text = input.trim();
  if (/^\d{3,12}$/.test(text)) return text;
  const match = text.match(/^(?:https?:\/\/)?(?:www\.)?(?:dndbeyond\.com|ddb\.ac)\/(?:profile\/[^/]+\/)?characters\/(\d{3,12})(?:[/?#]|$)/i);
  return match ? match[1] : null;
}

export const ddbSheetUrl = (id: string) => `https://www.dndbeyond.com/characters/${id}`;

/** Where the Worker reads a public sheet. Unofficial, but it is what the sheet itself loads. */
export const ddbServiceUrl = (id: string) => `https://character-service.dndbeyond.com/character/v5/character/${id}`;

interface DdbClass {
  level?: number;
  isStartingClass?: boolean;
  definition?: { name?: string } | null;
}

interface DdbModifier {
  type?: string;
  subType?: string;
  value?: number | null;
}

/** "Fighter" for one class; "Fighter 3 / Rogue 2" for several, starting class first. */
function classLine(classes: DdbClass[]): string {
  const named = classes.filter((c) => c.definition?.name);
  if (named.length <= 1) return named[0]?.definition?.name ?? '';
  return [...named]
    .sort((a, b) => Number(Boolean(b.isStartingClass)) - Number(Boolean(a.isStartingClass)) || (b.level ?? 0) - (a.level ?? 0))
    .map((c) => `${c.definition!.name} ${c.level ?? 0}`)
    .join(' / ');
}

/**
 * The fields a sync copies, from the `data` of a character-service response.
 * Darkvision is the longest any race, class, feat or item grants; the sheet
 * keeps them as `set-base` (or `sense`) modifiers on the darkvision sense.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readDdbSheet(data: any): DdbSheet {
  const classes: DdbClass[] = Array.isArray(data?.classes) ? data.classes : [];
  const totalLevel = classes.reduce((sum, c) => sum + (Number(c.level) || 0), 0);
  const modifiers: DdbModifier[] = Object.values((data?.modifiers ?? {}) as Record<string, DdbModifier[] | null>)
    .flatMap((group) => (Array.isArray(group) ? group : []));
  const darkvision = modifiers
    .filter((m) => (m.type === 'set-base' || m.type === 'sense') && m.subType === 'darkvision')
    .reduce((best, m) => Math.max(best, Number(m.value) || 0), 0);
  const portrait = data?.decorations?.avatarUrl ?? data?.avatarUrl ?? null;

  return {
    name: String(data?.name ?? '').trim().slice(0, MAX_NAME),
    race: String(data?.race?.fullName ?? data?.race?.baseName ?? '').trim(),
    characterClass: classLine(classes),
    level: Math.min(MAX_LEVEL, Math.max(1, totalLevel)),
    portraitUrl: typeof portrait === 'string' && portrait.startsWith('https://') ? portrait : null,
    darkvision,
  };
}
