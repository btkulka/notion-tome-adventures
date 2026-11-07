import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { DEFAULT_GEN_PARAMS, generateOverworld, LOWLAND_BIOMES, PICKABLE_BIOMES } from './gen/overworld';
import { placeName } from './gen/names';
import { mulberry32, randomSeed } from './gen/prng';
import { mapsApi } from './api';
import { Minimap } from './Minimap';
import { BIOMES, type BiomeId } from './terrain/biomes';
import type { LandShape, OverworldGenParams } from './types';

const SHAPES: { value: LandShape; label: string }[] = [
  { value: 'continent', label: 'Continent' },
  { value: 'island', label: 'Island' },
  { value: 'archipelago', label: 'Archipelago' },
  { value: 'coast-east', label: 'Coast to the east' },
  { value: 'coast-west', label: 'Coast to the west' },
  { value: 'coast-north', label: 'Coast to the north' },
  { value: 'coast-south', label: 'Coast to the south' },
  { value: 'landlocked', label: 'Landlocked' },
];

const SIZES = [32, 48, 64, 96, 128];

/** Land biomes as toggles. At least one lowland biome stays on, since something has to cover the low ground. */
function BiomeField({ value, onChange }: { value: number[] | undefined; onChange: (biomes: number[] | undefined) => void }) {
  const on = new Set<number>(value ?? PICKABLE_BIOMES);
  const lowlandOn = LOWLAND_BIOMES.filter((b) => on.has(b)).length;
  const toggle = (id: BiomeId) => {
    const next = new Set(on);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(PICKABLE_BIOMES.every((b) => next.has(b)) ? undefined : PICKABLE_BIOMES.filter((b) => next.has(b)));
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="t-label">Biomes</span>
      <div className="flex flex-wrap gap-1.5">
        {PICKABLE_BIOMES.map((id) => {
          const pressed = on.has(id);
          const locked = pressed && lowlandOn === 1 && LOWLAND_BIOMES.includes(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={pressed}
              disabled={locked}
              title={locked ? 'Something has to cover the low ground' : undefined}
              onClick={() => toggle(id)}
              className={`t-chip h-8 ${pressed ? 't-chip--on' : 'text-bone-3 hover:text-bone'}`}
            >
              <span aria-hidden="true" className="w-2.5 h-2.5" style={{ background: BIOMES[id].top, opacity: pressed ? 1 : 0.3 }} />
              {BIOMES[id].name}
            </button>
          );
        })}
      </div>
      <span className="t-small text-[12px]">Every biome left on gets land. Moisture and Climate lean the mix.</span>
    </div>
  );
}

function SliderField({ label, value, onChange, low, high }: { label: string; value: number; onChange: (v: number) => void; low: string; high: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="t-label">{label}</span>
      <Slider value={[value * 100]} min={0} max={100} step={1} onValueChange={([v]) => onChange(v / 100)} aria-label={label} />
      <div className="flex justify-between t-small text-[12px]"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}

export function GenerateDialog({
  open,
  onOpenChange,
  campaignId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  onCreated: (mapId: string) => void;
}) {
  const [name, setName] = useState('');
  const [params, setParams] = useState<OverworldGenParams>(() => ({ ...DEFAULT_GEN_PARAMS, seed: randomSeed() }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const region = useMemo(() => generateOverworld(params), [params]);
  // A name from the seed until the DM writes one.
  const suggested = useMemo(() => `The ${placeName(mulberry32(params.seed ^ 0x5eed), new Set())} Reach`, [params.seed]);
  const set = <K extends keyof OverworldGenParams>(key: K, value: OverworldGenParams[K]) => setParams((p) => ({ ...p, [key]: value }));

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const id = await mapsApi.createOverworld(campaignId, name.trim() || suggested, params, region);
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the map');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl t-frame border-0">
        <DialogHeader>
          <DialogTitle className="t-h1">Generate a region</DialogTitle>
          <DialogDescription className="t-body">A seeded overworld: the same seed always makes the same land. Settlements start hidden from players.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-3">
            <Minimap terrain={region.terrain} className="w-full aspect-square border border-rule" />
            <span className="t-small">
              {region.settlements.length} settlements · {region.rivers.length} rivers · {region.roads.length} roads
            </span>
          </div>
          <div className="flex flex-col gap-5">
            <div className="t-field">
              <label htmlFor="region-name" className="t-label">Name</label>
              <input id="region-name" className="t-input" value={name} placeholder={suggested} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
              <div className="t-field">
                <label htmlFor="region-seed" className="t-label">Seed</label>
                <input id="region-seed" className="t-input" inputMode="numeric" value={params.seed} onChange={(e) => set('seed', Number(e.target.value.replace(/\D/g, '')) || 0)} />
              </div>
              <button type="button" className="t-btn" onClick={() => set('seed', randomSeed())}>Reroll</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="t-field">
                <label htmlFor="region-shape" className="t-label">Land</label>
                <select id="region-shape" className="t-input" value={params.landShape} onChange={(e) => set('landShape', e.target.value as LandShape)}>
                  {SHAPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="t-field">
                <label htmlFor="region-size" className="t-label">Size, miles</label>
                <select id="region-size" className="t-input" value={params.width} onChange={(e) => setParams((p) => ({ ...p, width: Number(e.target.value), height: Number(e.target.value) }))}>
                  {SIZES.map((s) => <option key={s} value={s}>{s} × {s}</option>)}
                </select>
              </div>
            </div>
            <SliderField label="High ground" value={params.mountains} onChange={(v) => set('mountains', v)} low="Lowland" high="Mountainous" />
            <SliderField label="Moisture" value={params.moisture} onChange={(v) => set('moisture', v)} low="Arid" high="Wet" />
            <SliderField label="Climate" value={params.temperature} onChange={(v) => set('temperature', v)} low="Frozen" high="Tropical" />
            <BiomeField value={params.biomes} onChange={(v) => set('biomes', v)} />
            <div className="grid grid-cols-2 gap-3">
              <div className="t-field">
                <label htmlFor="region-towns" className="t-label">Settlements</label>
                <input id="region-towns" type="number" min={0} max={30} className="t-input" value={params.settlements} onChange={(e) => set('settlements', Math.max(0, Math.min(30, Number(e.target.value))))} />
              </div>
              <div className="t-field">
                <label htmlFor="region-rivers" className="t-label">Rivers</label>
                <input id="region-rivers" type="number" min={0} max={20} className="t-input" value={params.rivers} onChange={(e) => set('rivers', Math.max(0, Math.min(20, Number(e.target.value))))} />
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 min-h-[44px] border-t border-rule">
              <span>Roads between settlements</span>
              <input type="checkbox" checked={params.roads} onChange={(e) => set('roads', e.target.checked)} className="h-[18px] w-[18px] accent-[#C4A35A]" />
            </label>
            {error && <span className="text-blood-text">{error}</span>}
            <button type="button" className="t-btn t-btn--primary t-btn--lg" disabled={saving} onClick={create}>
              {saving ? 'Creating…' : 'Create region'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
