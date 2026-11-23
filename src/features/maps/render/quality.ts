/**
 * How sharply the map canvas renders, per browser. High supersamples at twice
 * the screen's pixel density (capped at 3x), so edges, facets and textures
 * stay crisp; Standard renders at the screen's own density (up to 2x, 1.5x on a
 * touch screen), builds the ground a little coarser, and lets a quiet map draw
 * at 30 frames a second. Phones, tablets and small machines start on Standard.
 * The canvas drops from High to Standard by itself if the frame rate can't keep
 * up (see MapView), so a slow laptop isn't stuck with it.
 */
import { useCallback, useEffect, useState } from 'react';

export type RenderQuality = 'standard' | 'high';

const KEY = 'tome.renderQuality';
const EVENT = 'tome-render-quality';

/** A touch screen (phone or tablet). */
const touch = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false);

/** A phone, a tablet, or a machine with 4 GB of memory or two cores or fewer: where Standard is the place to start. */
export function looksSmall(): boolean {
  if (typeof navigator === 'undefined') return false;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return touch() || (memory !== undefined && memory <= 4) || (navigator.hardwareConcurrency || 8) <= 2;
}

function read(): RenderQuality {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'standard' || saved === 'high') return saved;
  } catch {
    // Storage blocked: decide from the device.
  }
  return looksSmall() ? 'standard' : 'high';
}

/** Device pixels per CSS pixel for a quality on this screen. */
export function dprFor(quality: RenderQuality): number {
  const screen = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  if (quality === 'high') return Math.min(3, screen * 2);
  return Math.min(touch() ? 1.5 : 2, screen);
}

/** A per-browser graphics setting kept in localStorage, synced across components and tabs. */
function useStoredSetting<T extends string>(key: string, event: string, readValue: () => T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(readValue);
  useEffect(() => {
    const sync = () => setValue(readValue());
    window.addEventListener(event, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(event, sync);
      window.removeEventListener('storage', sync);
    };
  }, [event, readValue]);
  const update = useCallback(
    (v: T) => {
      try {
        localStorage.setItem(key, v);
      } catch {
        // Storage blocked: it lasts for this visit.
      }
      setValue(v);
      window.dispatchEvent(new Event(event));
    },
    [key, event]
  );
  return [value, update];
}

export function useRenderQuality(): [RenderQuality, (q: RenderQuality) => void] {
  return useStoredSetting(KEY, EVENT, read);
}

/**
 * Which tier of prop models to load (scripts/models/build.py TIERS). Each step
 * roughly doubles the triangles of the one below. Low: rounder shapes, finer
 * rocks and foliage, windows, slits and timber framing. Medium adds the
 * high-fantasy flair (stonework, pointed windows, finials, pennants, banners,
 * glowing runes). High and Ultra are still to come. Minis draws Medium with
 * the hi-def miniatures (scripts/models/minis, npm run minis) in place of the
 * props that have one, up close. Switching loads the other file in place.
 */
export type ModelDetail = 'low' | 'medium' | 'minis';
export const MODEL_DETAILS: ModelDetail[] = ['low', 'medium', 'minis'];

const MODEL_KEY = 'tome.modelDetail';
const MODEL_EVENT = 'tome-model-detail';

export function readModelDetail(): ModelDetail {
  try {
    const saved = localStorage.getItem(MODEL_KEY);
    // The first ladder's 'standard' and 'high' were retired; 'high' is today's Low.
    if (saved === 'low' || saved === 'standard' || saved === 'high') return 'low';
    if (saved === 'minis' || saved === 'medium') return saved;
    return defaultDetail();
  } catch {
    return defaultDetail();
  }
}

/**
 * Unset, a desktop (a fine pointer) starts on Minis and a phone or tablet on
 * Medium: the miniatures are a few megabytes each.
 */
function defaultDetail(): ModelDetail {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches ? 'minis' : 'medium';
}

export function useModelDetail(): [ModelDetail, (d: ModelDetail) => void] {
  return useStoredSetting(MODEL_KEY, MODEL_EVENT, readModelDetail);
}
