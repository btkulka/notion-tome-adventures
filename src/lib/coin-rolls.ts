// Coins a creature carries, rolled by challenge rating. The encounter generator
// (worker/notion/handlers/generate-encounter.ts) and the treasure tool both read
// this table, so a CR rolls the same purse wherever it comes from. No imports:
// the Worker bundles this file too.

export const GOLD_BY_CR: Record<string, string> = {
  '0': '0',
  '1/8': '0',
  '1/4': '1d4',
  '1/2': '2d4',
  '1': '3d4',
  '2': '4d4',
  '3': '2d20',
  '4': '4d20',
  '5': '8d20',
  '6': '16d20',
  '7': '30d20',
  '8': '40d20',
  '9': '60d20',
  '10': '70d20',
  '11': '90d20',
  '12': '190d20',
  '13': '380d20',
  '14': '760d20',
  '15': '1420d20',
  '16': '1900d20',
  '17': '2400d20',
  '18': '2850d20',
  '19': '3333d20',
  '20': '3800d20',
  '21': '4300d20',
  '22': '4750d20',
  '23': '5700d20',
  '24': '6667d20',
  '25': '7600d20',
  '26': '8600d20',
  '27': '9500d20',
  '28': '12000d20',
  '29': '14250d20',
  '30': '190000d20',
};

/** Rolls of up to this many dice keep every die; bigger ones keep only the total. */
const KEEP_DICE = 60;

export interface DiceRoll {
  formula: string;
  total: number;
  /** Each die in the order rolled, or null when there were too many to keep. */
  dice: number[] | null;
}

/** Rolls an "NdS" formula; anything else (the table's "0") rolls nothing. */
export function rollDice(formula: string, random: () => number = Math.random): DiceRoll {
  const match = formula.match(/^(\d+)d(\d+)$/);
  if (!match) return { formula, total: 0, dice: [] };
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const dice: number[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const die = Math.floor(random() * sides) + 1;
    total += die;
    if (count <= KEEP_DICE) dice.push(die);
  }
  return { formula, total, dice: count <= KEEP_DICE ? dice : null };
}
