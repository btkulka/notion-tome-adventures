import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loading, Shimmer } from '@/components/ui/tome-loading';
import { EntryPanel } from '@/features/database/EntryPanel';
import { notionApi, type NotionMagicItem } from '@/hooks/useNotionService';
import { GOLD_BY_CR, type DiceRoll } from '@/lib/coin-rolls';
import type { MagicItemTreasure } from '@/types/encounter';
import { CHALLENGE_RATINGS, rarityTier, rollCarried, rollHoard, sortRarities, type CreatureGroup, type Hoard, type Purse } from './treasure';

const MOST_GROUPS = 8;
const MOST_PER_GROUP = 50;
const MOST_HOARD_ITEMS = 30;
const MOST_HOARD_WORTH = 1_000_000;

let itemsRequest: Promise<NotionMagicItem[]> | null = null;

/** Priced magic items, read once per visit; a failed read is forgotten so it can be retried. */
function loadItems(): Promise<NotionMagicItem[]> {
  if (!itemsRequest) {
    itemsRequest = notionApi.fetchMagicItems({}).then((result) => {
      if (!result.success) throw new Error(result.error ?? 'Could not read the Magic Items table');
      return (result.data?.magicItems ?? []).filter((item) => (item.value ?? 0) > 0);
    });
    itemsRequest.catch(() => {
      itemsRequest = null;
    });
  }
  return itemsRequest;
}

/** A whole number in [min, max], or null while the field holds anything else. */
function wholeNumber(text: string, min: number, max: number): number | null {
  const n = Number(text);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

const gp = (n: number) => `${n.toLocaleString()} gp`;
const valueOf = (items: MagicItemTreasure[]) => items.reduce((n, item) => n + (item.value ?? 0), 0);

type Params = { kind: 'carried'; groups: CreatureGroup[]; rarities: string[] } | { kind: 'hoard'; worth: number; maxItems: number; rarities: string[] };
type Result = { params: Params } & ({ kind: 'carried'; purses: Purse[] } | { kind: 'hoard'; hoard: Hoard });

interface CoinLine {
  key: string;
  from: string | null;
  left: number;
  detail: string;
  dice: string | null;
}
interface ItemLine {
  key: string;
  from: string | null;
  item: MagicItemTreasure;
}

/** Names each creature by its challenge rating, numbered when several share one. */
function creatureNames(purses: Purse[]): string[] {
  const totals = new Map<string, number>();
  for (const p of purses) totals.set(p.cr, (totals.get(p.cr) ?? 0) + 1);
  const seen = new Map<string, number>();
  return purses.map((p) => {
    const n = (seen.get(p.cr) ?? 0) + 1;
    seen.set(p.cr, n);
    return totals.get(p.cr)! > 1 ? `CR ${p.cr} · ${n}` : `CR ${p.cr}`;
  });
}

function coinDetail(roll: DiceRoll, left: number): Pick<CoinLine, 'detail' | 'dice'> {
  const spent = roll.total - left;
  if (roll.formula === '0') return { detail: 'carries no coins', dice: null };
  return {
    detail: `${roll.formula} = ${roll.total.toLocaleString()}${spent ? `, ${spent.toLocaleString()} spent on items` : ''}`,
    dice: roll.dice ? roll.dice.join(' + ') : null,
  };
}

function ledger(result: Result): { coins: CoinLine[]; items: ItemLine[]; subtitle: string } {
  if (result.kind === 'hoard') {
    const { worth, items, left } = result.hoard;
    return {
      subtitle: `A hoard worth ${gp(worth)}`,
      coins: [{ key: 'coins', from: null, left, detail: items.length ? `${gp(worth)} less ${gp(worth - left)} in items` : 'nothing else fit', dice: null }],
      items: items.map((item, i) => ({ key: `${item.id}-${i}`, from: null, item })).sort((a, b) => (b.item.value ?? 0) - (a.item.value ?? 0)),
    };
  }
  const names = creatureNames(result.purses);
  const perCr = new Map<string, number>();
  for (const p of result.purses) perCr.set(p.cr, (perCr.get(p.cr) ?? 0) + 1);
  return {
    subtitle: `Carried by ${result.purses.length === 1 ? 'one creature' : `${result.purses.length} creatures`} · ${[...perCr].map(([cr, n]) => (n > 1 ? `CR ${cr} × ${n}` : `CR ${cr}`)).join(', ')}`,
    coins: result.purses.map((p, i) => ({ key: `coins-${i}`, from: names[i], left: p.left, ...coinDetail(p.coins, p.left) })),
    items: result.purses
      .flatMap((p, i) => p.items.map((item, j) => ({ key: `${i}-${j}-${item.id}`, from: names[i], item })))
      .sort((a, b) => (b.item.value ?? 0) - (a.item.value ?? 0)),
  };
}

function asText(result: Result): string {
  const { coins, items, subtitle } = ledger(result);
  const coinTotal = coins.reduce((n, c) => n + c.left, 0);
  const itemTotal = valueOf(items.map((l) => l.item));
  return [
    `Treasure: ${subtitle}`,
    `Coins: ${gp(coinTotal)}`,
    ...items.map(({ item, from }) => `${item.name} (${item.rarity ?? 'no rarity'}, ${gp(item.value ?? 0)})${from ? `, ${from}` : ''}`),
    `Worth in all: ${gp(coinTotal + itemTotal)}`,
  ].join('\n');
}

/** /tools/treasure — coins and magic items for what a fight drops or a hoard holds. */
export default function TreasurePage() {
  const [items, setItems] = useState<NotionMagicItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<'carried' | 'hoard'>('carried');
  const [groups, setGroups] = useState<{ cr: string; count: string }[]>([{ cr: '1', count: '1' }]);
  const [worth, setWorth] = useState('500');
  const [maxItems, setMaxItems] = useState('4');
  const [off, setOff] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<Result | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    loadItems().then(setItems, (err) => setLoadError(err instanceof Error ? err.message : 'Could not read the Magic Items table'));
  }, []);
  useEffect(load, [load]);

  const rarityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items ?? []) counts.set(item.rarity ?? 'No rarity', (counts.get(item.rarity ?? 'No rarity') ?? 0) + 1);
    return counts;
  }, [items]);
  const rarities = useMemo(() => sortRarities(rarityCounts.keys()), [rarityCounts]);
  const allowed = rarities.filter((r) => !off.has(r));

  const parsedGroups = groups.map((g) => ({ cr: g.cr, count: wholeNumber(g.count, 1, MOST_PER_GROUP) }));
  const params: Params | null =
    mode === 'carried'
      ? parsedGroups.every((g) => g.count !== null)
        ? { kind: 'carried', groups: parsedGroups as CreatureGroup[], rarities: allowed }
        : null
      : wholeNumber(worth, 1, MOST_HOARD_WORTH) !== null && wholeNumber(maxItems, 1, MOST_HOARD_ITEMS) !== null
        ? { kind: 'hoard', worth: Number(worth), maxItems: Number(maxItems), rarities: allowed }
        : null;

  const roll = (p: Params) => {
    if (!items) return;
    const pool = items.filter((item) => p.rarities.includes(item.rarity ?? 'No rarity'));
    setCopied(null);
    setResult(p.kind === 'carried' ? { params: p, kind: 'carried', purses: rollCarried(p.groups, pool) } : { params: p, kind: 'hoard', hoard: rollHoard(p.worth, p.maxItems, pool) });
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(asText(result));
      setCopied('yes');
    } catch {
      setCopied('failed');
    }
  };

  const setGroup = (i: number, patch: Partial<{ cr: string; count: string }>) => setGroups((gs) => gs.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const toggle = (rarity: string) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(rarity)) next.delete(rarity);
      else next.add(rarity);
      return next;
    });

  const blocked = !items ? 'Reading the Magic Items table…' : !allowed.length ? 'Turn on at least one rarity.' : !params ? (mode === 'carried' ? `Each count is a whole number from 1 to ${MOST_PER_GROUP}.` : 'Enter a whole number of gold and of items.') : null;

  return (
    <div className="t-root min-h-svh flex flex-col md:flex-row">
      <aside aria-label="Treasure parameters" className="t-panel w-full md:w-[360px] md:shrink-0 border-x-0 border-t-0 md:border-b-0 md:border-r flex flex-col gap-6 px-6 py-[26px]">
        <div className="flex flex-col gap-1.5">
          <span className="t-label text-gilt">Tools</span>
          <h1 className="t-h2">Treasure generator</h1>
        </div>

        <div role="radiogroup" aria-label="Where the treasure is" className="t-seg" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <button type="button" role="radio" aria-checked={mode === 'carried'} onClick={() => setMode('carried')}>Carried</button>
          <button type="button" role="radio" aria-checked={mode === 'hoard'} onClick={() => setMode('hoard')}>Hoard</button>
        </div>

        {mode === 'carried' ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[minmax(0,1fr)_84px_44px] gap-2" aria-hidden="true">
              <span className="t-label">Who carries it</span>
              <span className="t-label">How many</span>
            </div>
            {groups.map((g, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_84px_44px] gap-2">
                <select aria-label={`Challenge rating, row ${i + 1}`} className="t-input" value={g.cr} onChange={(e) => setGroup(i, { cr: e.target.value })}>
                  {CHALLENGE_RATINGS.map((cr) => (
                    <option key={cr} value={cr}>CR {cr} · {GOLD_BY_CR[cr] === '0' ? 'no coins' : GOLD_BY_CR[cr]}</option>
                  ))}
                </select>
                <input
                  aria-label={`How many, row ${i + 1}`}
                  className="t-input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MOST_PER_GROUP}
                  value={g.count}
                  aria-invalid={parsedGroups[i].count === null}
                  onChange={(e) => setGroup(i, { count: e.target.value })}
                />
                <button
                  type="button"
                  className="t-btn t-btn--quiet t-btn--icon"
                  aria-label={`Remove row ${i + 1}`}
                  title="Remove"
                  disabled={groups.length === 1}
                  onClick={() => setGroups((gs) => gs.filter((_, j) => j !== i))}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" aria-hidden="true">
                    <path d="M6 6l12 12 M18 6L6 18" />
                  </svg>
                </button>
              </div>
            ))}
            {groups.length < MOST_GROUPS && (
              <button type="button" className="t-btn t-btn--quiet self-start px-0 h-9" onClick={() => setGroups((gs) => [...gs, { cr: gs[gs.length - 1].cr, count: '1' }])}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
                  <path d="M12 5v14 M5 12h14" />
                </svg>
                Add creatures
              </button>
            )}
            <p className="t-small m-0">Coins by challenge rating, as encounter loot is rolled. Each creature has a 1 in 4 chance of an item its coins can buy, and again after every item.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="t-field">
                <label htmlFor="hoard-worth" className="t-label">Worth, gp</label>
                <input id="hoard-worth" className="t-input" type="number" inputMode="numeric" min={1} max={MOST_HOARD_WORTH} value={worth} aria-invalid={wholeNumber(worth, 1, MOST_HOARD_WORTH) === null} onChange={(e) => setWorth(e.target.value)} />
              </div>
              <div className="t-field">
                <label htmlFor="hoard-items" className="t-label">Most items</label>
                <input id="hoard-items" className="t-input" type="number" inputMode="numeric" min={1} max={MOST_HOARD_ITEMS} value={maxItems} aria-invalid={wholeNumber(maxItems, 1, MOST_HOARD_ITEMS) === null} onChange={(e) => setMaxItems(e.target.value)} />
              </div>
            </div>
            <p className="t-small m-0">Items are drawn by rarity weight while they still fit in what's left; the rest is coin.</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-baseline">
            <span id="rarity-label" className="t-label">Rarity</span>
            {off.size > 0 && <button type="button" className="t-small hover:text-bone" onClick={() => setOff(new Set())}>Turn all on</button>}
          </div>
          {loadError ? (
            <div className="flex flex-col gap-2.5" role="alert">
              <p className="m-0 text-blood-text">{loadError}</p>
              <button type="button" className="t-btn self-start" onClick={load}>Try again</button>
            </div>
          ) : items === null ? (
            <div className="flex flex-col gap-2.5">
              <Loading label="Reading the Magic Items table…" />
              <div aria-hidden="true" className="flex flex-wrap gap-1.5">
                {[92, 76, 104, 68].map((w) => <Shimmer key={w} className="h-7" style={{ width: w }} />)}
              </div>
            </div>
          ) : items.length === 0 ? (
            <p className="m-0 text-blood-text" role="alert">The Magic Items table has no items with a value, so there is nothing to draw.</p>
          ) : (
            <div role="group" aria-labelledby="rarity-label" className="flex flex-wrap gap-1.5">
              {rarities.map((r) => {
                const on = !off.has(r);
                return (
                  <button key={r} type="button" aria-pressed={on} onClick={() => toggle(r)} className={`t-chip tier-${rarityTier(r)} cursor-pointer font-text ${on ? 't-chip--on' : ''}`}>
                    <i className={`t-diamond ${on ? '' : 't-diamond--hollow'}`} />
                    {r}
                    <span className="t-small text-[12px]">{rarityCounts.get(r)?.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-2.5">
          <button type="button" className="t-btn t-btn--primary t-btn--lg" disabled={Boolean(blocked) || Boolean(loadError)} onClick={() => params && roll(params)}>
            Roll treasure
          </button>
          <span className="t-small text-center">
            {blocked ?? `Drawn from ${items!.filter((item) => allowed.includes(item.rarity ?? 'No rarity')).length.toLocaleString()} priced magic items`}
          </span>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-6 md:px-11 pt-9 pb-12 flex flex-col gap-[30px]">
        {result ? <Ledger result={result} copied={copied} onCopy={copy} onReroll={() => roll(result.params)} onOpen={setEntryId} /> : (
          <div className="flex flex-col gap-3 max-w-[540px] pt-6">
            <span className="t-label">Nothing rolled yet</span>
            <p className="t-body m-0">Say who carries the treasure, or what a hoard is worth, then roll. Coins follow the encounter generator's table by challenge rating; items come from your Magic Items table.</p>
          </div>
        )}
      </main>

      {entryId && <EntryPanel id={entryId} onClose={() => setEntryId(null)} />}
    </div>
  );
}

function Ledger({ result, copied, onCopy, onReroll, onOpen }: { result: Result; copied: 'yes' | 'failed' | null; onCopy: () => void; onReroll: () => void; onOpen: (id: string) => void }) {
  const { coins, items, subtitle } = ledger(result);
  const coinTotal = coins.reduce((n, c) => n + c.left, 0);
  const itemTotal = valueOf(items.map((l) => l.item));
  const carried = result.kind === 'carried';

  return (
    <>
      <div className="flex flex-wrap gap-5 items-end justify-between">
        <div className="flex flex-col gap-2.5">
          <span className="t-small">{subtitle}</span>
          <h2 className="t-display text-[40px]">{carried ? 'What they carry' : 'The hoard'}</h2>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className="t-btn" onClick={onCopy}>{copied === 'yes' ? 'Copied' : copied === 'failed' ? 'Could not copy' : 'Copy as text'}</button>
          <button type="button" className="t-btn" onClick={onReroll}>Re-roll</button>
        </div>
      </div>

      <dl className="m-0 grid grid-cols-2 sm:grid-cols-4 border-y border-rule">
        <div className="t-stat py-4 pr-6"><dt>Coins</dt><dd className="t-num">{gp(coinTotal)}</dd></div>
        <div className="t-stat py-4 px-6 border-l border-rule"><dt>Magic items</dt><dd>{items.length}</dd></div>
        <div className="t-stat py-4 sm:px-6 pr-6 sm:border-l border-rule"><dt>Item value</dt><dd>{gp(itemTotal)}</dd></div>
        <div className="t-stat py-4 px-6 border-l border-rule"><dt>Worth in all</dt><dd className="t-num">{gp(coinTotal + itemTotal)}</dd></div>
      </dl>

      <section aria-label="Loot ledger" className="t-frame px-[26px] py-[22px] flex flex-col gap-3 overflow-x-auto">
        <h3 className="t-h2">Loot ledger</h3>
        <table className="w-full border-collapse text-[15px]">
          <thead className="sr-only">
            <tr><th>Treasure</th><th>Kind</th><th>Worth</th>{carried && <th>Carried by</th>}</tr>
          </thead>
          <tbody>
            {items.map(({ key, item, from }) => (
              <tr key={key} className={`tier-${rarityTier(item.rarity)} border-t border-rule`}>
                <td className="py-2.5 pr-4">
                  <span className="flex items-center gap-3">
                    <i className="t-diamond" />
                    <button type="button" className="text-left text-bone hover:text-gilt-hi" onClick={() => onOpen(item.id)}>{item.name}</button>
                    {(item.attunement || item.consumable) && (
                      <span className="t-small text-[13px]">{[item.attunement && 'attunement', item.consumable && 'consumable'].filter(Boolean).join(' · ')}</span>
                    )}
                  </span>
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap">{item.rarity ?? 'No rarity'}</td>
                <td className="py-2.5 pr-4 whitespace-nowrap text-right t-num">{gp(item.value ?? 0)}</td>
                {carried && <td className="py-2.5 t-small whitespace-nowrap">{from}</td>}
              </tr>
            ))}
            {coins.map((c) => (
              <tr key={c.key} className="border-t border-rule">
                <td className="py-2.5 pr-4">
                  <span className="flex items-center gap-3"><i className="t-diamond t-diamond--hollow" />Coins</span>
                </td>
                <td className="py-2.5 pr-4 t-small" title={c.dice ?? undefined}>{c.detail}</td>
                <td className="py-2.5 pr-4 whitespace-nowrap text-right t-num">{gp(c.left)}</td>
                {carried && <td className="py-2.5 t-small whitespace-nowrap">{c.from}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="t-small m-0">No magic items this time{carried ? ': every creature missed its 1 in 4, or nothing fit its coins.' : ': nothing in the allowed rarities fit.'}</p>}
        {coins.some((c) => c.dice) && <p className="t-small m-0">Hover a coin roll for every die.</p>}
      </section>
    </>
  );
}
