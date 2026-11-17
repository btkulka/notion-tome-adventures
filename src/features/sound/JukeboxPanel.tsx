import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loading } from '@/components/ui/tome-loading';
import { formatLength, formatTime, soundsApi, toRef, type LibrarySound, type SoundScene } from './api';
import { isSounding, MAX_LAYERS, mixOf, trackPosition, type JukeboxState, type LoopMode, type SceneMix, type SoundCategory } from './jukebox';
import { useLibrary, useScenes } from './library';
import { useTableAudio, useTicker, type TableAudio } from './useTableAudio';
import { Eq, Icon, Slider, SoundArt, Switch } from './ui';

const LOOP_NEXT: Record<LoopMode, LoopMode> = { queue: 'track', track: 'off', off: 'queue' };
const LOOP_LABEL: Record<LoopMode, string> = { queue: 'Repeating the queue', track: 'Repeating this track', off: 'Stops after the last track' };
/** Each layer wears its own enamel, so a row is easy to find again mid-game. */
const LAYER_TIERS = ['azure', 'verdant', 'amethyst', 'ember', 'bone', 'blood', 'ash', 'azure'];

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);

/** The DM's mixer, in the table's side panel: music, layers, the soundboard, scenes. */
export function JukeboxPanel({ campaignId, onOpenLibrary }: { campaignId: string; onOpenLibrary: (category: SoundCategory) => void }) {
  const audio = useTableAudio();
  const library = useLibrary(campaignId);
  const effects = useMemo(() => (library.data?.sounds ?? []).filter((s) => s.category === 'effect'), [library.data]);

  if (!audio) return null;
  const s = audio.jukebox;
  if (!s) return <Loading label={audio.connected ? 'Tuning the jukebox…' : 'Reaching the table…'} />;

  return (
    <div className="ts flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="t-h2">Sound</h2>
        <button type="button" className="t-btn h-9 px-3.5" onClick={() => onOpenLibrary('music')}>
          <Icon name="library" size={16} />Library
        </button>
      </div>
      {audio.locked && isSounding(s) && (
        <p role="status" className="m-0 -mt-3 t-small text-[13px] text-gilt">Click anywhere on the page to hear it on this device too.</p>
      )}
      <NowPlaying audio={audio} s={s} onOpenLibrary={onOpenLibrary} />
      <Layers audio={audio} s={s} onOpenLibrary={onOpenLibrary} />
      <Soundboard audio={audio} effects={effects} loading={!library.data} onOpenLibrary={onOpenLibrary} />
      <Scenes campaignId={campaignId} audio={audio} s={s} />
      <Levels audio={audio} s={s} />
    </div>
  );
}

function SectionHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 min-h-[34px]">
      <span className="t-label">{title}</span>
      <span className="flex-1" />
      {children}
    </div>
  );
}

/** Drag to look; letting go moves the music there for everyone. */
function ScrubBar({ position, duration, disabled, onSeek }: { position: number; duration: number | null; disabled: boolean; onSeek: (s: number) => void }) {
  const [scrub, setScrub] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const commit = () => {
    if (scrub === null) return;
    onSeek(scrub);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setScrub(null), 500);
  };
  const shown = scrub ?? (duration ? Math.min(position, duration) : position);
  const fill = duration ? (shown / duration) * 100 : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="t-num text-[12px] w-[42px]">{disabled ? '0:00' : formatTime(shown)}</span>
      <input
        type="range"
        aria-label="Position in the track"
        className="ts-range ts-range--scrub flex-1"
        min={0}
        max={duration ?? 1}
        step={0.5}
        value={duration ? shown : 0}
        disabled={disabled || !duration}
        style={{ '--fill': `${fill}%` } as React.CSSProperties}
        onChange={(e) => setScrub(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <span className="t-num text-[12px] w-[42px] text-right">{duration ? formatTime(duration) : disabled ? '–:––' : 'live'}</span>
    </div>
  );
}

function NowPlaying({ audio, s, onOpenLibrary }: { audio: TableAudio; s: JukeboxState; onOpenLibrary: (c: SoundCategory) => void }) {
  const { command } = audio;
  const m = s.music;
  const track = m.queue[m.index] ?? null;
  const playing = m.status === 'playing';
  const [queueOpen, setQueueOpen] = useState(false);
  useTicker(playing, 250);

  if (!track) {
    return (
      <section aria-label="Now playing" className="ts-deck t-raised flex items-center gap-3.5 p-3.5">
        <span className="ts-art ts-art--empty"><Icon name="note" size={26} /></span>
        <div className="flex flex-col items-start gap-2">
          <span className="t-label">No music</span>
          <button type="button" className="t-btn h-9 px-3.5" onClick={() => onOpenLibrary('music')}><Icon name="plus" size={14} />Choose music</button>
        </div>
      </section>
    );
  }

  const position = trackPosition(m, audio.serverNow());
  const error = audio.errors[track.id];
  const status = playing ? 'Now playing' : m.status === 'paused' ? 'Paused' : 'Stopped';

  return (
    <section aria-label="Now playing" className="ts-deck t-raised flex flex-col">
      <div className="flex gap-3.5 p-3.5 pb-2.5">
        <span className="relative flex-none">
          <SoundArt key={track.id} sound={track} className="ts-art" size={26} />
          <Eq on={playing} className="absolute left-1.5 bottom-1.5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="t-label" style={{ color: playing ? 'var(--gilt)' : undefined }}>{status}</span>
          <span className="t-h3 ts-title text-bone" title={track.name}>{track.name}</span>
          <span className="t-small text-[13px]">{track.source.kind === 'youtube' ? 'YouTube' : 'File'} · {m.index + 1} of {m.queue.length}</span>
        </div>
      </div>
      {error && <p role="alert" className="m-0 px-3.5 pb-2 text-blood-text text-[13px]">{error}</p>}
      <div className="px-3.5">
        <ScrubBar position={position} duration={track.duration} disabled={m.status === 'stopped'} onSeek={(p) => command({ op: 'seek', position: p })} />
      </div>
      <div className="flex items-center gap-1 px-2.5 py-1.5">
        <button type="button" className="ts-icon" aria-label="Previous track" onClick={() => command({ op: 'skip', by: -1 })}><Icon name="prev" size={16} /></button>
        <button type="button" className="ts-play" aria-label={playing ? 'Pause the music' : 'Play the music'} onClick={() => command({ op: playing ? 'pause' : 'resume' })}>
          <Icon name={playing ? 'pause' : 'play'} size={18} />
        </button>
        <button type="button" className="ts-icon" aria-label="Next track" onClick={() => command({ op: 'skip', by: 1 })}><Icon name="next" size={16} /></button>
        <span className="flex-1" />
        <button type="button" className="ts-icon relative" aria-label={LOOP_LABEL[m.loop]} title={LOOP_LABEL[m.loop]} aria-pressed={m.loop !== 'off'} onClick={() => command({ op: 'loop', mode: LOOP_NEXT[m.loop] })}>
          <Icon name="loop" size={17} />
          {m.loop === 'track' && <span className="absolute right-[5px] top-[3px] font-text text-[10px] font-semibold leading-none">1</span>}
        </button>
        <button type="button" className="ts-icon" aria-label="Stop the music" disabled={m.status === 'stopped'} onClick={() => command({ op: 'stop' })}><Icon name="stop" size={14} /></button>
      </div>
      <div className="flex items-center gap-2.5 px-3.5 pb-3">
        <Icon name="speaker" size={16} className="text-bone-3 flex-none" />
        <Slider value={m.volume} onChange={(v) => command({ op: 'musicVolume', volume: v })} label="Music volume" className="flex-1" />
      </div>
      <button
        type="button"
        aria-expanded={queueOpen}
        className="flex items-center gap-2 h-9 px-3.5 border-t border-rule text-left t-label hover:text-bone transition-colors"
        onClick={() => setQueueOpen((o) => !o)}
      >
        Queue · {m.queue.length}
        <span className="flex-1" />
        <Icon name="chevron" size={14} className={`transition-transform ${queueOpen ? 'rotate-180' : ''}`} />
      </button>
      {queueOpen && (
        <ol className="m-0 p-0 list-none max-h-[260px] overflow-y-auto border-t border-rule">
          {m.queue.map((t, i) => (
            <li key={`${t.id}-${i}`} className="ts-row ts-rise grid grid-cols-[24px_minmax(0,1fr)_auto_auto] items-center gap-2 pl-3.5 pr-1.5 py-1" aria-current={i === m.index} style={{ '--i': Math.min(i, 12) } as React.CSSProperties}>
              <span className="t-num text-[12px] text-bone-3">{i === m.index && playing ? <Eq on /> : i + 1}</span>
              <button type="button" className="ts-name-btn truncate text-[14px]" title={`Play ${t.name}`} onClick={() => command({ op: 'play', index: i })}>{t.name}</button>
              <span className="t-small text-[12px]">{formatLength(t.duration) ?? '–:––'}</span>
              <button type="button" className="ts-icon ts-icon--danger h-7 w-7" aria-label={`Take ${t.name} out of the queue`} onClick={() => command({ op: 'dequeue', index: i })}><Icon name="close" size={12} /></button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Layers({ audio, s, onOpenLibrary }: { audio: TableAudio; s: JukeboxState; onOpenLibrary: (c: SoundCategory) => void }) {
  const { command } = audio;
  return (
    <section aria-label="Layers" className="flex flex-col gap-1.5">
      <SectionHead title={`Layers · ${s.layers.length} of ${MAX_LAYERS}`}>
        <button type="button" className="ts-icon" aria-label="Add a layer" title="Add a layer" disabled={s.layers.length >= MAX_LAYERS} onClick={() => onOpenLibrary('ambience')}><Icon name="plus" size={16} /></button>
      </SectionHead>
      {s.layers.length === 0 ? (
        <p className="m-0 t-small text-[13px]">Ambience under the music: rain, a hearth, a crowd. Each loops on its own.</p>
      ) : (
        <div className="flex flex-col border-y border-rule">
          {s.layers.map((l, i) => (
            <div key={l.id} className={`ts-row ts-rise tier-${LAYER_TIERS[i]} grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 py-1.5 pl-2 pr-1 ${i ? 'border-t border-rule' : ''} ${l.playing ? '' : 'ts-row--off'}`} style={{ '--i': i } as React.CSSProperties}>
              <button type="button" className="ts-icon" aria-label={l.playing ? `Pause ${l.sound.name}` : `Play ${l.sound.name}`} aria-pressed={l.playing} onClick={() => command({ op: 'layerPlaying', id: l.id, playing: !l.playing })}>
                <Icon name={l.playing ? 'pause' : 'play'} size={13} />
              </button>
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 min-w-0 text-[14px]"><i className="t-diamond" style={{ width: 6, height: 6 }} /><span className="truncate" title={l.sound.name}>{l.sound.name}</span></span>
                <Slider value={l.volume} onChange={(v) => command({ op: 'layerVolume', id: l.id, volume: v })} label={`${l.sound.name} volume`} />
                {audio.errors[l.sound.id] && <span role="alert" className="text-blood-text text-[12px]">{audio.errors[l.sound.id]}</span>}
              </div>
              <button type="button" className="ts-icon ts-icon--danger" aria-label={`Remove ${l.sound.name}`} onClick={() => command({ op: 'removeLayer', id: l.id })}><Icon name="close" size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Pad({ sound, index, onFire }: { sound: LibrarySound; index: number; onFire: () => void }) {
  const el = useRef<HTMLButtonElement>(null);
  const fire = () => {
    onFire();
    // Restart the flash even when fired again mid-flash.
    const b = el.current;
    if (!b) return;
    b.classList.remove('ts-pad--fired');
    void b.offsetWidth;
    b.classList.add('ts-pad--fired');
  };
  // Keyboard firing goes through the same flash.
  useEffect(() => {
    const b = el.current;
    if (!b) return;
    const onKeyFire = () => fire();
    b.addEventListener('ts-fire', onKeyFire);
    return () => b.removeEventListener('ts-fire', onKeyFire);
  });
  return (
    <button ref={el} type="button" data-pad={index} className="ts-pad ts-rise" style={{ '--i': index } as React.CSSProperties} onClick={fire} title={`Play ${sound.name} for everyone`}>
      <i className="t-diamond" style={{ width: 7, height: 7 }} />
      <span className="min-w-0 break-words">{sound.name}</span>
      {index < 9 && <kbd>{index + 1}</kbd>}
    </button>
  );
}

function Soundboard({ audio, effects, loading, onOpenLibrary }: { audio: TableAudio; effects: LibrarySound[]; loading: boolean; onOpenLibrary: (c: SoundCategory) => void }) {
  const board = useRef<HTMLDivElement>(null);
  const { prime, jukebox } = audio;

  useEffect(() => {
    prime(effects.map(toRef));
  }, [effects, prime]);

  // 1–9 fire the first nine pads while the panel is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > 9) return;
      board.current?.querySelector(`[data-pad="${n - 1}"]`)?.dispatchEvent(new Event('ts-fire'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <section aria-label="Soundboard" className="flex flex-col gap-2">
      <SectionHead title="Soundboard">
        <Slider value={jukebox?.effects ?? 0.8} onChange={(v) => audio.command({ op: 'effectsVolume', volume: v })} label="Effects volume" className="w-[84px]" />
        <button type="button" className="ts-icon" aria-label="Add effects" title="Add effects" onClick={() => onOpenLibrary('effect')}><Icon name="plus" size={16} /></button>
      </SectionHead>
      {loading ? (
        <Loading label="Fetching the effects…" />
      ) : effects.length === 0 ? (
        <p className="m-0 t-small text-[13px]">Short sounds to fire on cue: thunder, a door slam, a roar. Add them in the library under Effects.</p>
      ) : (
        <div ref={board} className="grid grid-cols-2 gap-2">
          {effects.map((e, i) => (
            <Pad key={e.id} sound={e} index={i} onFire={() => audio.fire(toRef(e))} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Whether the scene's mix is what's playing now. */
function sceneMatches(mix: SceneMix, s: JukeboxState): boolean {
  const m = s.music;
  const music = m.status === 'playing' ? m.queue[m.index]?.id ?? null : null;
  if ((mix.music?.queue[0]?.id ?? null) !== music) return false;
  const want = mix.layers.map((l) => l.sound.id).sort().join('|');
  const have = s.layers.filter((l) => l.playing).map((l) => l.sound.id).sort().join('|');
  return want === have && (music !== null || have !== '');
}

function Scenes({ campaignId, audio, s }: { campaignId: string; audio: TableAudio; s: JukeboxState }) {
  const scenes = useScenes(campaignId);
  const [name, setName] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = scenes.data ?? [];

  const save = async () => {
    if (name === null || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const scene = await soundsApi.saveScene(campaignId, name.trim(), mixOf(s));
      scenes.set((prev) => [...(prev ?? []), scene]);
      setName(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the scene');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (scene: SoundScene) => {
    setConfirm(null);
    scenes.set((prev) => (prev ?? []).filter((x) => x.id !== scene.id));
    try {
      await soundsApi.removeScene(scene.id);
    } catch (err) {
      scenes.set((prev) => [...(prev ?? []), scene]);
      setError(err instanceof Error ? err.message : 'Could not delete the scene');
    }
  };

  return (
    <section aria-label="Scenes" className="flex flex-col gap-2">
      <SectionHead title="Scenes">
        <button type="button" className="ts-icon" aria-label="Save what's playing as a scene" title="Save what's playing as a scene" disabled={!isSounding(s)} onClick={() => setName((n) => (n === null ? '' : null))}>
          <Icon name="save" size={16} />
        </button>
      </SectionHead>
      {name !== null && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input autoFocus className="t-input h-9 text-[14px]" placeholder="Name it: Tavern, Ambush…" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setName(null)} />
          <button type="submit" className="t-btn h-9 px-3.5" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save'}</button>
        </form>
      )}
      {error && <p role="alert" className="m-0 text-blood-text text-[13px]">{error}</p>}
      {list.length === 0 && name === null ? (
        <p className="m-0 t-small text-[13px]">Set up music and layers, then save them as a scene to bring the whole mood back with one click.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((scene, i) =>
            confirm === scene.id ? (
              <span key={scene.id} className="t-chip ts-rise" style={{ borderColor: 'rgba(166,58,53,0.6)' }}>
                Delete {scene.name}?
                <button type="button" className="text-blood-text font-semibold" onClick={() => remove(scene)}>Yes</button>
                <button type="button" className="text-bone-3" onClick={() => setConfirm(null)}>No</button>
              </span>
            ) : (
              <span key={scene.id} className="group relative ts-rise" style={{ '--i': i } as React.CSSProperties}>
                <button
                  type="button"
                  className={`t-chip pr-7 transition-colors hover:text-bone hover:border-gilt-deep ${sceneMatches(scene.mix, s) ? 't-chip--on' : ''}`}
                  onClick={() => audio.command({ op: 'scene', mix: scene.mix })}
                  title={`Bring in ${scene.name}`}
                >
                  <i className="t-diamond" style={{ width: 6, height: 6 }} />{scene.name}
                </button>
                <button type="button" aria-label={`Delete ${scene.name}`} className="absolute right-1 top-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center text-bone-3 opacity-0 transition-opacity hover:text-blood-text focus:opacity-100 group-hover:opacity-100" onClick={() => setConfirm(scene.id)}>
                  <Icon name="close" size={11} />
                </button>
              </span>
            )
          )}
        </div>
      )}
    </section>
  );
}

function Levels({ audio, s }: { audio: TableAudio; s: JukeboxState }) {
  const { command, device, setDevice } = audio;
  return (
    <section aria-label="Levels" className="flex flex-col gap-3 pt-4 border-t border-rule">
      <div className="grid grid-cols-[96px_34px_minmax(0,1fr)] items-center gap-x-2">
        <span className="t-label">Everyone</span>
        <span className="grid place-items-center text-bone-3"><Icon name="speaker" size={16} /></span>
        <Slider value={s.master} onChange={(v) => command({ op: 'master', volume: v })} label="Volume for everyone" />
      </div>
      <div className="grid grid-cols-[96px_34px_minmax(0,1fr)] items-center gap-x-2">
        <span className="t-label">This device</span>
        <button type="button" className="ts-icon" aria-label={device.muted ? 'Unmute this device' : 'Mute this device'} aria-pressed={device.muted} onClick={() => setDevice({ ...device, muted: !device.muted })}>
          <Icon name={device.muted ? 'muted' : 'speaker'} size={16} />
        </button>
        <Slider value={device.volume} onChange={(v) => setDevice({ volume: v, muted: false })} label="Volume on this device" every={0} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-[15px]">Players hear it</span>
          <span className="t-small text-[13px]">{s.playersHear ? "Plays on every player's device too" : 'Only from your speakers (everyone in one room)'}</span>
        </span>
        <Switch checked={s.playersHear} onChange={(on) => command({ op: 'playersHear', on })} label="Players hear the sound" />
      </div>
      <button type="button" className="t-btn t-btn--danger" disabled={!isSounding(s)} onClick={() => command({ op: 'stopAll' })}>
        <Icon name="stop" size={13} />Stop all sound
      </button>
    </section>
  );
}
