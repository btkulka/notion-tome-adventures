import { createContext, useContext, useEffect, useState } from 'react';
import { keepAcrossHmr } from '@/lib/hmr';
import { isSounding, type JukeboxCommand, type JukeboxState, type SoundRef } from './jukebox';

export interface DeviceSound {
  volume: number;
  muted: boolean;
}

export interface TableAudio {
  role: 'dm' | 'player';
  connected: boolean;
  jukebox: JukeboxState | null;
  /** Now, on the table's clock (what jukebox times are in). */
  serverNow: () => number;
  /** Runs the jukebox. The table ignores it from players. */
  command: (cmd: JukeboxCommand) => void;
  /** Fires a one-shot effect for everyone. */
  fire: (sound: SoundRef, volume?: number) => void;
  /** Whether this device will actually play: the DM's always does; players' only while the DM lets them. */
  audible: boolean;
  /** True until the page has been clicked: browsers hold sound back until then. */
  locked: boolean;
  unlock: () => void;
  device: DeviceSound;
  setDevice: (device: DeviceSound) => void;
  /** Sounds that failed here, by sound id. */
  errors: Record<string, string>;
  previewing: string | null;
  /** Plays a sound on this device only. */
  preview: (sound: SoundRef | null) => void;
  /** Decodes effects ahead of their first firing. */
  prime: (sounds: SoundRef[]) => void;
}

// Lives apart from <TableAudioProvider> so editing the provider hot-swaps it in place.
export const TableAudioContext = keepAcrossHmr(import.meta.hot, 'TableAudioContext', () => createContext<TableAudio | null>(null));

/** The jukebox around this page, or null outside a TableAudioProvider. */
export function useTableAudio(): TableAudio | null {
  return useContext(TableAudioContext);
}

/** True while this device should be making sound but the browser is holding it back. */
export function useNeedsUnlock(): boolean {
  const audio = useTableAudio();
  return Boolean(audio && audio.locked && audio.audible && isSounding(audio.jukebox));
}

/** Re-renders every `ms` while `active`, for clocks and progress bars. */
export function useTicker(active: boolean, ms = 250): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [active, ms]);
}
