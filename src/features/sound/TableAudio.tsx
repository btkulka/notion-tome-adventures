import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTable, type TableMessage } from '@/features/maps/useTable';
import { soundsApi } from './api';
import { TableAudioEngine } from './engine';
import type { JukeboxCommand, JukeboxState, SoundRef } from './jukebox';
import { TableAudioContext, type DeviceSound, type TableAudio } from './useTableAudio';
import './sound.css';

const DEVICE_KEY = 'tome.sound.device';

function readDevice(): DeviceSound {
  try {
    const saved = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? 'null') as Partial<DeviceSound> | null;
    if (saved && typeof saved.volume === 'number') return { volume: Math.min(1, Math.max(0, saved.volume)), muted: Boolean(saved.muted) };
  } catch {
    // Private mode or junk: the defaults below.
  }
  return { volume: 0.8, muted: false };
}

function findRef(s: JukeboxState | null, soundId: string): SoundRef | undefined {
  return s?.music.queue.find((r) => r.id === soundId) ?? s?.layers.find((l) => l.sound.id === soundId)?.sound;
}

/**
 * Plays the campaign's jukebox on this device, and hands its controls to the
 * page. The DM's suite mounts it around every tool (SuiteShell), so the music
 * carries on while the DM looks something up; a player's table mounts its own.
 */
export function TableAudioProvider({ campaignId, role, children }: { campaignId: string | null; role: 'dm' | 'player'; children: React.ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<TableAudioEngine | null>(null);
  const [locked, setLocked] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [device, setDeviceState] = useState(readDevice);
  const reportedDurations = useRef(new Set<string>());

  const onMessage = useCallback((msg: TableMessage) => {
    if (msg.type === 'sfx') engine.current?.fire(msg.sound, msg.volume);
  }, []);
  const table = useTable(campaignId, onMessage);
  const { send, serverNow, jukebox, connected } = table;
  const audible = role === 'dm' || (jukebox?.playersHear ?? true);

  const command = useCallback((cmd: JukeboxCommand) => send({ type: 'jukebox', command: cmd }), [send]);
  const fire = useCallback((sound: SoundRef, volume = 1) => send({ type: 'sfx', sound, volume }), [send]);

  const latest = useRef({ role, command, jukebox, audible, device });
  latest.current = { role, command, jukebox, audible, device };

  useEffect(() => {
    if (!host.current) return;
    const e = new TableAudioEngine(host.current, serverNow, {
      // The DM's browser keeps time for the table: it says when a track ends, and how long YouTube videos are.
      onEnded: (startedAt) => latest.current.role === 'dm' && latest.current.command({ op: 'ended', startedAt }),
      onDuration: (soundId, seconds) => {
        const { role: r, jukebox: s, command: run } = latest.current;
        if (r !== 'dm' || reportedDurations.current.has(soundId)) return;
        const known = findRef(s, soundId)?.duration;
        if (known && Math.abs(known - seconds) <= 1) return;
        reportedDurations.current.add(soundId);
        run({ op: 'duration', soundId, duration: seconds });
        soundsApi.update(soundId, { duration: seconds }).catch(() => undefined);
      },
      onError: (soundId, message) =>
        setErrors((prev) => {
          if (!message) {
            if (!(soundId in prev)) return prev;
            const { [soundId]: _gone, ...rest } = prev;
            return rest;
          }
          return prev[soundId] === message ? prev : { ...prev, [soundId]: message };
        }),
      onLockChange: setLocked,
      onPreviewChange: setPreviewing,
    });
    engine.current = e;
    e.setDevice(latest.current.device.volume, latest.current.device.muted);
    e.update(latest.current.jukebox, latest.current.audible);
    setLocked(e.isLocked);
    return () => {
      e.destroy();
      engine.current = null;
    };
  }, [serverNow]);

  useEffect(() => {
    engine.current?.update(jukebox, audible);
  }, [jukebox, audible]);

  useEffect(() => {
    engine.current?.setDevice(device.volume, device.muted);
  }, [device]);

  const setDevice = useCallback((next: DeviceSound) => {
    setDeviceState(next);
    try {
      localStorage.setItem(DEVICE_KEY, JSON.stringify(next));
    } catch {
      // Not kept past this visit.
    }
  }, []);

  const unlock = useCallback(() => engine.current?.unlock(), []);
  const preview = useCallback((sound: SoundRef | null) => engine.current?.preview(sound), []);
  const prime = useCallback((sounds: SoundRef[]) => engine.current?.prime(sounds), []);

  const value = useMemo<TableAudio>(
    () => ({ role, connected, jukebox, serverNow, command, fire, audible, locked, unlock, device, setDevice, errors, previewing, preview, prime }),
    [role, connected, jukebox, serverNow, command, fire, audible, locked, unlock, device, setDevice, errors, previewing, preview, prime]
  );

  return (
    <TableAudioContext.Provider value={value}>
      {children}
      {/* YouTube's players live here, out of sight; the table only wants their sound. */}
      <div ref={host} aria-hidden="true" className="ts-yt-host" />
    </TableAudioContext.Provider>
  );
}
