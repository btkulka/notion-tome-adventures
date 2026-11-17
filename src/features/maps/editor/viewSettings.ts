import { useCallback, useState } from 'react';
import type { Weather } from '../types';

/** How the DM likes the map drawn while editing. Kept per browser. */
export interface ViewSettings {
  /** Preview the map at this hour (0..24) instead of the table's clock; null follows the table. */
  skyHour: number | null;
  /** Preview this weather instead of the table's; null follows the table. */
  skyWeather: Weather | null;
  grid: boolean;
  /** 0..1 */
  gridOpacity: number;
  regionNames: boolean;
  pinLabels: boolean;
  scenery: boolean;
  tooltips: boolean;
  minimap: boolean;
}

const KEY = 'tome.mapView';

const DEFAULTS: ViewSettings = {
  skyHour: null,
  skyWeather: null,
  grid: true,
  gridOpacity: 0.35,
  regionNames: true,
  pinLabels: true,
  scenery: true,
  tooltips: true,
  minimap: true,
};

function load(): ViewSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ViewSettings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function useViewSettings(): [ViewSettings, (patch: Partial<ViewSettings>) => void] {
  const [settings, setSettings] = useState(load);
  const update = useCallback((patch: Partial<ViewSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Private mode or storage blocked: settings last for this visit.
      }
      return next;
    });
  }, []);
  return [settings, update];
}
