import { daysToFullMoon, moonName, moonPhase, resolveSky } from './render/sky';
import { formatWorldTime } from './travel/travel';
import type { MapSettings, SkySettings } from './types';

/** The moon's face at a phase (0 new, 0.5 full), lit side bright: a small glyph for the panel. */
function MoonGlyph({ phase, size = 44 }: { phase: number; size?: number }) {
  const r = size / 2 - 2;
  const rx = r * Math.abs(Math.cos(phase * Math.PI * 2));
  const waxing = phase < 0.5;
  const crescent = waxing ? phase < 0.25 : phase > 0.75;
  // The lit limb, top to bottom, then back up along the terminator.
  const limb = waxing ? `A ${r} ${r} 0 0 1 0 ${r}` : `A ${r} ${r} 0 0 0 0 ${r}`;
  const sweep = waxing ? (crescent ? 0 : 1) : crescent ? 1 : 0;
  const lit = `M 0 ${-r} ${limb} A ${rx} ${r} 0 0 ${sweep} 0 ${-r} Z`;
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} aria-hidden="true">
      <circle r={r} fill="#1B1E2B" stroke="var(--rule, #3a342a)" strokeWidth="1" />
      {phase > 0.01 && phase < 0.99 && <path d={lit} fill="#D9D0BC" />}
    </svg>
  );
}

/**
 * The map's sky: where the midday sun stands and how the moon runs. The world
 * clock (the table's) moves the sun and moon; these set their paths.
 */
export function SkySettingsPanel({ settings, minutes, onChange }: { settings: MapSettings; minutes: number | null; onChange: (next: MapSettings) => void }) {
  const sky = resolveSky(settings.sky);
  const set = (patch: Partial<SkySettings>) => onChange({ ...settings, sky: { ...sky, ...patch } });
  const now = minutes ?? 8 * 60;
  const phase = moonPhase(now, sky);
  const toFull = daysToFullMoon(now, sky);

  return (
    <div className="flex flex-col gap-6">
      <div className="t-raised flex items-center gap-4 px-4 py-3">
        <MoonGlyph phase={phase} />
        <div className="flex flex-col">
          <span className="t-label text-[10px]">{minutes === null ? 'Day 1, before any session' : formatWorldTime(minutes)}</span>
          <span className="font-semibold">{moonName(phase)}</span>
          <span className="t-small text-[13px]">{toFull === 0 ? 'Full tonight' : `Full in ${toFull} day${toFull === 1 ? '' : 's'}`}</span>
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 min-h-[44px]">
        <span className="flex flex-col">
          <span className="font-semibold">Paint the sky</span>
          <span className="t-small text-[13px]">Off keeps the dark backdrop; the light still follows the hour.</span>
        </span>
        <input type="checkbox" checked={sky.show} onChange={(e) => set({ show: e.target.checked })} className="h-[18px] w-[18px] accent-[#C4A35A]" />
      </label>

      <div className="flex flex-col gap-3">
        <span className="t-label">The sun</span>
        <div className="t-field">
          <span className="t-label">At midday it stands in the</span>
          <div role="radiogroup" aria-label="Side of the midday sun" className="t-seg" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {(['north', 'south'] as const).map((side) => (
              <button key={side} type="button" role="radio" aria-checked={sky.noon === side} onClick={() => set({ noon: side })}>{side}</button>
            ))}
          </div>
        </div>
        <div className="t-field">
          <label htmlFor="sky-noon-height" className="t-label">Height at midday</label>
          <div className="flex items-center gap-3">
            <input id="sky-noon-height" type="range" min={20} max={80} step={1} value={sky.noonHeight} onChange={(e) => set({ noonHeight: Number(e.target.value) })} className="t-range flex-1" />
            <span className="t-num text-[14px] w-[40px] text-right">{sky.noonHeight}°</span>
          </div>
          <span className="t-small text-[13px]">Low is a winter sun with long dusks; high is high summer.</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="t-label">The moon</span>
        <div className="grid grid-cols-2 gap-3">
          <div className="t-field">
            <label htmlFor="sky-moon-cycle" className="t-label">Cycle (days)</label>
            <input id="sky-moon-cycle" type="number" min={2} max={120} className="t-input" value={sky.moonCycle} onChange={(e) => set({ moonCycle: Math.max(2, Math.min(120, Number(e.target.value) || 28)) })} />
          </div>
          <div className="t-field">
            <label htmlFor="sky-full-day" className="t-label">Full on day</label>
            <input id="sky-full-day" type="number" min={1} className="t-input" value={sky.fullMoonDay} onChange={(e) => set({ fullMoonDay: Math.max(1, Math.round(Number(e.target.value) || 1)) })} />
          </div>
        </div>
      </div>
    </div>
  );
}
