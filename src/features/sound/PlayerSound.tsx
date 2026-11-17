import React from 'react';
import { Link } from 'react-router-dom';
import { currentTrack, isSounding, type JukeboxState } from './jukebox';
import { useNeedsUnlock, useTableAudio } from './useTableAudio';
import { Eq, Icon, Slider } from './ui';

/** What to call the sound playing now: the track, or the layers when there's no music. */
function nowPlayingLabel(s: JukeboxState): string {
  const track = currentTrack(s);
  if (track && s.music.status === 'playing') return track.name;
  const layers = s.layers.filter((l) => l.playing);
  if (layers.length === 1) return layers[0].sound.name;
  if (layers.length) return `${layers.length} layers of ambience`;
  return track?.name ?? 'Quiet';
}

/** A player's line under the clock: what the table is playing, and their own volume for it. */
export function PlayerSoundRow() {
  const audio = useTableAudio();
  const s = audio?.jukebox ?? null;
  if (!audio || !s || !audio.audible || !isSounding(s)) return null;
  const { device, setDevice } = audio;
  return (
    <div className="ts flex items-center gap-2 pt-2 mt-0.5 border-t border-rule">
      <button type="button" className="ts-icon h-8 w-8" aria-label={device.muted ? 'Unmute the table' : 'Mute the table'} aria-pressed={device.muted} onClick={() => setDevice({ ...device, muted: !device.muted })}>
        <Icon name={device.muted ? 'muted' : 'speaker'} size={15} />
      </button>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] text-bone-2" title={nowPlayingLabel(s)}>{nowPlayingLabel(s)}</span>
        <Slider value={device.muted ? 0 : device.volume} onChange={(v) => setDevice({ volume: v, muted: false })} label="Your volume" every={0} />
      </span>
      <Eq on={!device.muted && !audio.locked} />
    </div>
  );
}

/** Browsers keep a page quiet until it's touched; this asks the player to let the table in. */
export function PlayerSoundPrompt({ className = '' }: { className?: string }) {
  const audio = useTableAudio();
  const needed = useNeedsUnlock();
  if (!audio || !needed) return null;
  return (
    <div role="status" className={`ts ts-unlock t-overlay flex items-center gap-3.5 py-2 pl-4 pr-2 border-gilt-deep ${className}`}>
      <Eq on />
      <span className="text-[15px]">The DM is playing sound for the table</span>
      <button type="button" className="t-btn t-btn--primary h-[38px] px-5" onClick={audio.unlock}>Listen</button>
    </div>
  );
}

/** The DM's top bar, on any tool: what's playing, a link back to the mixer, and this device's mute. */
export function SuiteSoundChip() {
  const audio = useTableAudio();
  const needed = useNeedsUnlock();
  const s = audio?.jukebox ?? null;
  if (!audio || !s || !isSounding(s)) return null;
  const { device, setDevice } = audio;
  return (
    <div className="ts ml-auto flex min-w-0 items-center gap-1.5">
      <Link to="/table?panel=sound" className="flex min-w-0 items-center gap-2.5 px-2 py-1.5 text-bone-2 hover:text-gilt-hi transition-colors" title="Open the jukebox">
        <Eq on={!device.muted && !needed} />
        <span className="hidden md:inline truncate max-w-[240px] text-[14px]">{needed ? 'Click to hear the table' : nowPlayingLabel(s)}</span>
      </Link>
      <button type="button" className="ts-icon" aria-label={device.muted ? 'Unmute this device' : 'Mute this device'} aria-pressed={device.muted} onClick={() => setDevice({ ...device, muted: !device.muted })}>
        <Icon name={device.muted ? 'muted' : 'speaker'} size={16} />
      </button>
    </div>
  );
}
