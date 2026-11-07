import React, { useEffect, useMemo, useState } from 'react';
import { Loading } from '@/components/ui/tome-loading';
import { notionApi, type NotionEnvironment } from '@/hooks/useNotionService';
import { BIOMES, isWater, suggestEnvironments, type BiomeId } from './terrain/biomes';
import type { EncounterRules, MapSettings, TerrainGrid } from './types';

/**
 * Which Notion Environments each biome rolls encounters from, and how often
 * travel checks for them. An unmapped biome is shown as such; travel through it
 * reports that rather than inventing monsters.
 */
export function MapSettingsPanel({ terrain, settings, onChange }: { terrain: TerrainGrid; settings: MapSettings; onChange: (next: MapSettings) => void }) {
  const [environments, setEnvironments] = useState<NotionEnvironment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    notionApi.fetchEnvironments().then((res) => {
      if (res.success && res.data?.environments) setEnvironments(res.data.environments);
      else setError(res.error ?? 'Could not load the environments');
    });
  }, []);

  // Only biomes that appear on this map, most common first.
  const present = useMemo(() => {
    const counts = new Map<number, number>();
    for (const b of terrain.biomes) if (!isWater(b)) counts.set(b, (counts.get(b) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => BIOMES[b as BiomeId]);
  }, [terrain]);

  const mapped = settings.biomeEnvironments;
  const unmapped = present.filter((b) => !(mapped[b.id]?.length));

  const setBiome = (biome: number, envs: { id: string; name: string }[]) =>
    onChange({ ...settings, biomeEnvironments: { ...mapped, [biome]: envs } });

  const suggestAll = () => {
    if (!environments) return;
    const next = { ...mapped };
    for (const b of present) {
      if (next[b.id]?.length) continue;
      const found = suggestEnvironments(b, environments);
      if (found.length) next[b.id] = found.map((e) => ({ id: e.id, name: e.name }));
    }
    onChange({ ...settings, biomeEnvironments: next });
  };

  const rules = settings.encounters;
  const setRules = (patch: Partial<EncounterRules>) => onChange({ ...settings, encounters: { ...rules, ...patch } });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-baseline">
          <span className="t-label">Encounter tables</span>
          <button type="button" className="t-btn t-btn--quiet h-8 px-0" disabled={!environments} onClick={suggestAll}>Match by name</button>
        </div>
        {error && <span className="text-blood-text text-[14px]">{error}</span>}
        {!environments && !error && <Loading label="Reading the environments…" />}
        <span className="t-small text-[14px]">
          {present.length - unmapped.length} of {present.length} biomes linked to Notion environments.
        </span>
        {present.map((b) => (
          <div key={b.id} className="flex flex-col gap-1.5 py-2 border-t border-rule">
            <span className="flex items-center gap-2.5 font-semibold"><i className="t-diamond" style={{ background: b.top }} />{b.name}</span>
            <div className="flex flex-wrap gap-1.5">
              {(mapped[b.id] ?? []).map((env) => (
                <button key={env.id} type="button" className="t-chip t-chip--on" onClick={() => setBiome(b.id, (mapped[b.id] ?? []).filter((e) => e.id !== env.id))} title="Remove">
                  {env.name} ×
                </button>
              ))}
              {environments && (
                <select
                  className="t-input h-8 text-[14px] w-auto"
                  value=""
                  aria-label={`Add an environment for ${b.name}`}
                  onChange={(e) => {
                    const env = environments.find((x) => x.id === e.target.value);
                    if (env) setBiome(b.id, [...(mapped[b.id] ?? []), { id: env.id, name: env.name }]);
                  }}
                >
                  <option value="">Add…</option>
                  {environments.filter((env) => !(mapped[b.id] ?? []).some((m) => m.id === env.id)).map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}
                </select>
              )}
            </div>
            {!(mapped[b.id]?.length) && <span className="text-blood-text text-[13px]">No environment, so travel here rolls no encounters.</span>}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <span className="t-label">Travel rules</span>
        <div className="grid grid-cols-2 gap-3">
          <div className="t-field">
            <label htmlFor="rule-hours" className="t-label">Check every (hours)</label>
            <input id="rule-hours" type="number" min={1} max={24} className="t-input" value={rules.checkEveryHours} onChange={(e) => setRules({ checkEveryHours: Math.max(1, Number(e.target.value)) })} />
          </div>
          <div className="t-field">
            <label htmlFor="rule-chance" className="t-label">Chance (%)</label>
            <input id="rule-chance" type="number" min={0} max={100} className="t-input" value={rules.chancePercent} onChange={(e) => setRules({ chancePercent: Math.max(0, Math.min(100, Number(e.target.value))) })} />
          </div>
        </div>
        <div className="t-field">
          <span className="t-label">Difficulty</span>
          <div role="radiogroup" aria-label="Encounter difficulty" className="t-seg" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {(['easy', 'medium', 'hard', 'deadly'] as const).map((d) => (
              <button key={d} type="button" role="radio" aria-checked={rules.difficulty === d} onClick={() => setRules({ difficulty: d })}>{d}</button>
            ))}
          </div>
        </div>
        <label className="flex items-center justify-between gap-3 min-h-[44px] border-t border-rule">
          <span>Also check each night in camp</span>
          <input type="checkbox" checked={rules.checkAtNight} onChange={(e) => setRules({ checkAtNight: e.target.checked })} className="h-[18px] w-[18px] accent-[#C4A35A]" />
        </label>
      </div>
    </div>
  );
}
