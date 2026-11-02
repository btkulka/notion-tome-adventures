/**
 * Seeded place-name generator for procedurally sited settlements. The DM
 * renames pins freely, and linking a pin to a Notion Location uses that name.
 */

const STARTS = [
  'Ash', 'Bar', 'Bel', 'Bram', 'Cal', 'Dun', 'El', 'Fen', 'Gar', 'Hal', 'Har', 'Kel', 'Lor', 'Mar',
  'Mor', 'Nor', 'Oak', 'Pen', 'Quel', 'Raven', 'Red', 'Ros', 'Stone', 'Thorn', 'Tor', 'Val', 'Wil', 'Wyn',
];
const MIDDLES = ['', '', '', 'a', 'e', 'i', 'o', 'an', 'en', 'er', 'il', 'or'];
const ENDS = [
  'bury', 'brook', 'by', 'dale', 'den', 'ford', 'gate', 'hall', 'ham', 'helm', 'hold', 'holm', 'mere',
  'moor', 'mouth', 'reach', 'ridge', 'stead', 'ton', 'vale', 'wick', 'wood', 'watch', 'well',
];

export function placeName(rand: () => number, taken: Set<string>): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const name = pick(STARTS, rand) + pick(MIDDLES, rand) + pick(ENDS, rand);
    if (!taken.has(name)) {
      taken.add(name);
      return name;
    }
  }
  const numbered = `${pick(STARTS, rand)}${pick(ENDS, rand)} ${taken.size + 1}`;
  taken.add(numbered);
  return numbered;
}

function pick<T>(list: T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)];
}
