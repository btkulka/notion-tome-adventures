import { describe, expect, it } from 'vitest';
import { ddbCharacterId, readDdbSheet } from '../characters';

describe('ddbCharacterId', () => {
  it('reads the id from every shape of D&D Beyond link', () => {
    expect(ddbCharacterId('https://www.dndbeyond.com/characters/123456789')).toBe('123456789');
    expect(ddbCharacterId('https://www.dndbeyond.com/characters/123456789/AbCdEf')).toBe('123456789');
    expect(ddbCharacterId('dndbeyond.com/characters/123456789/builder/class/manage')).toBe('123456789');
    expect(ddbCharacterId('https://www.dndbeyond.com/profile/SomeOne/characters/98765432')).toBe('98765432');
    expect(ddbCharacterId('https://ddb.ac/characters/123456789/AbCdEf')).toBe('123456789');
    expect(ddbCharacterId('https://www.dndbeyond.com/characters/123456789?tab=spells')).toBe('123456789');
    expect(ddbCharacterId('  123456789 ')).toBe('123456789');
  });

  it('refuses links that are not a character', () => {
    expect(ddbCharacterId('')).toBeNull();
    expect(ddbCharacterId('https://www.dndbeyond.com/monsters/16762-goblin')).toBeNull();
    expect(ddbCharacterId('https://www.dndbeyond.com/characters/')).toBeNull();
    expect(ddbCharacterId('https://evil.example/dndbeyond.com/characters/123456789')).toBeNull();
    expect(ddbCharacterId('https://www.dndbeyond.com/characters/12345abc')).toBeNull();
  });
});

describe('readDdbSheet', () => {
  const sheet = {
    name: ' Brannoc Ashvale ',
    decorations: { avatarUrl: 'https://www.dndbeyond.com/avatars/1/2/3.jpeg' },
    race: { fullName: 'Hill Dwarf', baseName: 'Dwarf' },
    classes: [
      { level: 2, isStartingClass: false, definition: { name: 'Rogue' } },
      { level: 3, isStartingClass: true, definition: { name: 'Fighter' } },
    ],
    modifiers: {
      race: [
        { type: 'bonus', subType: 'constitution-score', value: 2 },
        { type: 'set-base', subType: 'darkvision', value: 60 },
      ],
      class: [],
      item: [{ type: 'sense', subType: 'darkvision', value: 120 }],
      feat: null,
    },
  };

  it('copies name, race, classes, level, portrait and the longest darkvision', () => {
    expect(readDdbSheet(sheet)).toEqual({
      name: 'Brannoc Ashvale',
      race: 'Hill Dwarf',
      characterClass: 'Fighter 3 / Rogue 2',
      level: 5,
      portraitUrl: 'https://www.dndbeyond.com/avatars/1/2/3.jpeg',
      darkvision: 120,
    });
  });

  it('names a single class without its level', () => {
    expect(readDdbSheet({ ...sheet, classes: [{ level: 7, definition: { name: 'Wizard' } }] }).characterClass).toBe('Wizard');
  });

  it('copes with a bare sheet', () => {
    expect(readDdbSheet({ name: 'New Character' })).toEqual({
      name: 'New Character',
      race: '',
      characterClass: '',
      level: 1,
      portraitUrl: null,
      darkvision: 0,
    });
  });

  it('falls back to the older avatarUrl and drops non-https portraits', () => {
    expect(readDdbSheet({ name: 'A', avatarUrl: 'https://x.test/a.png' }).portraitUrl).toBe('https://x.test/a.png');
    expect(readDdbSheet({ name: 'A', decorations: { avatarUrl: 'javascript:alert(1)' } }).portraitUrl).toBeNull();
  });

  it('caps the level at 20', () => {
    expect(readDdbSheet({ name: 'A', classes: [{ level: 15, definition: { name: 'Bard' } }, { level: 9, definition: { name: 'Warlock' } }] }).level).toBe(20);
  });
});
