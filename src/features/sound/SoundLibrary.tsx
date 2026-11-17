import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loading, Shimmer } from '@/components/ui/tome-loading';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { audioType, formatLength, soundsApi, toRef, type LibrarySound } from './api';
import { currentTrack, MAX_LAYERS, SOUND_CATEGORIES, type SoundCategory } from './jukebox';
import { useLibrary } from './library';
import { useTableAudio } from './useTableAudio';
import { Eq, Icon, SoundArt } from './ui';
import { youTubeWatchUrl } from './youtube';

const TAB_LABEL: Record<SoundCategory, string> = { music: 'Music', ambience: 'Ambience', effect: 'Effects' };

const EMPTY_NOTE: Record<SoundCategory, string> = {
  music: 'Tracks for the music deck, played one after another. A long YouTube mix works well here.',
  ambience: 'Loops that sit under the music as layers: rain, a crackling hearth, a busy tavern.',
  effect: 'Short sounds for the soundboard, fired once on cue: thunder, a door slam, a dragon’s roar.',
};

interface Upload {
  id: string;
  name: string;
  progress: number;
  error: string | null;
  abort: AbortController;
}

function shuffled<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatSize(bytes: number | null): string | null {
  if (!bytes) return null;
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * The campaign's sounds, over the map beside the mixer: add YouTube links or
 * upload files, try them on this device, and send them to the table.
 */
export function SoundLibrary({ campaignId, category, onCategory, onClose }: {
  campaignId: string;
  category: SoundCategory;
  onCategory: (c: SoundCategory) => void;
  onClose: () => void;
}) {
  const audio = useTableAudio();
  const library = useLibrary(campaignId);
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [query, setQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const queue = useRef(Promise.resolve());
  const panel = useRef<HTMLElement>(null);

  const sounds = useMemo(() => library.data?.sounds ?? [], [library.data]);
  const uploadsOn = library.data?.uploads ?? true;
  const counts = useMemo(() => Object.fromEntries(SOUND_CATEGORIES.map((c) => [c, sounds.filter((s) => s.category === c).length])) as Record<SoundCategory, number>, [sounds]);
  const inTab = sounds.filter((s) => s.category === category);
  const needle = query.trim().toLowerCase();
  const shown = needle ? inTab.filter((s) => s.name.toLowerCase().includes(needle)) : inTab;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !(e.target instanceof HTMLInputElement) && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Stop an audition when the library closes.
  const preview = audio?.preview;
  useEffect(() => () => preview?.(null), [preview]);

  useEffect(() => setQuery(''), [category]);

  const replace = (sound: LibrarySound) => library.set((lib) => ({ ...lib, sounds: lib.sounds.map((s) => (s.id === sound.id ? sound : s)) }));
  const prepend = (sound: LibrarySound) => library.set((lib) => ({ ...lib, sounds: [sound, ...lib.sounds.filter((s) => s.id !== sound.id)] }));

  const addYouTube = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || adding) return;
    setAdding(true);
    setMessage(null);
    try {
      const { sound, existing } = await soundsApi.addYouTube(campaignId, url.trim(), category);
      if (!existing) prepend(sound);
      setUrl('');
      setMessage({ text: existing ? `“${sound.name}” is already here.` : `Added “${sound.name}”.`, error: false });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Could not add that link', error: true });
    } finally {
      setAdding(false);
    }
  };

  const upload = (files: FileList | File[]) => {
    const list = Array.from(files);
    const audioFiles = list.filter((f) => audioType(f));
    if (audioFiles.length < list.length) setMessage({ text: `Skipped ${list.length - audioFiles.length} file${list.length - audioFiles.length > 1 ? 's' : ''} that ${list.length - audioFiles.length > 1 ? "aren't" : "isn't"} audio.`, error: true });
    const into = category;
    for (const file of audioFiles) {
      const item: Upload = { id: crypto.randomUUID(), name: file.name, progress: 0, error: null, abort: new AbortController() };
      setUploads((u) => [...u, item]);
      const patch = (change: Partial<Upload>) => setUploads((u) => u.map((x) => (x.id === item.id ? { ...x, ...change } : x)));
      // One at a time, so a pile of files doesn't fight over the connection.
      queue.current = queue.current.then(async () => {
        if (item.abort.signal.aborted) return;
        try {
          const sound = await soundsApi.upload(campaignId, file, into, (progress) => patch({ progress }), item.abort.signal);
          prepend(sound);
          setUploads((u) => u.filter((x) => x.id !== item.id));
        } catch (err) {
          if (item.abort.signal.aborted) setUploads((u) => u.filter((x) => x.id !== item.id));
          else patch({ error: err instanceof Error ? err.message : 'Upload failed' });
        }
      });
    }
  };

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

  return (
    <section
      ref={panel}
      aria-label="Sound library"
      className="ts ts-library t-panel absolute inset-y-0 right-0 z-20 flex w-[min(540px,100%)] flex-col border-y-0 border-r-0 shadow-[-30px_0_60px_-30px_rgba(0,0,0,0.95)]"
      onDragEnter={(e) => hasFiles(e) && (e.preventDefault(), setDragging(true))}
      onDragOver={(e) => hasFiles(e) && e.preventDefault()}
      onDragLeave={(e) => !panel.current?.contains(e.relatedTarget as Node) && setDragging(false)}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragging(false);
        if (uploadsOn) upload(e.dataTransfer.files);
      }}
    >
      <header className="flex items-center gap-3 px-5 pt-4 pb-3">
        <h2 className="t-h2">Library</h2>
        <span className="flex-1" />
        <button type="button" className="ts-icon" aria-label="Close the library" onClick={onClose}><Icon name="close" size={16} /></button>
      </header>

      <div role="tablist" aria-label="Kinds of sound" className="ts-tabs">
        {SOUND_CATEGORIES.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={c === category} onClick={() => onCategory(c)}>
            {TAB_LABEL[c]} <span className="font-text tracking-normal text-[12px] text-bone-3">{counts[c] || ''}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 px-5 py-4 border-b border-rule">
        <form className="flex gap-2" onSubmit={addYouTube}>
          <input
            className="t-input h-10 text-[15px]"
            placeholder="Paste a YouTube link"
            aria-label="YouTube link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button type="submit" className="t-btn h-10 px-4" disabled={!url.trim() || adding}>{adding ? 'Adding…' : 'Add'}</button>
        </form>
        <div className="flex items-center gap-3">
          <button type="button" className="t-btn t-btn--quiet h-9 px-2 text-gilt" disabled={!uploadsOn} onClick={() => fileInput.current?.click()}>
            <Icon name="upload" size={16} />Upload files
          </button>
          <span className="t-small text-[13px]">{uploadsOn ? 'or drop audio here' : "Uploads need R2 storage, which isn't set up yet"}</span>
          <input ref={fileInput} type="file" accept="audio/*,.mp3,.ogg,.opus,.wav,.flac,.m4a,.aac,.webm" multiple hidden onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = ''; }} />
        </div>
        {message && <p role={message.error ? 'alert' : 'status'} className={`m-0 text-[13px] ${message.error ? 'text-blood-text' : 'text-bone-2'}`}>{message.text}</p>}
        {uploads.map((u) => (
          <div key={u.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="truncate flex-1">{u.name}</span>
              {u.error ? <span className="text-blood-text">{u.error}</span> : <span className="t-num">{Math.round(u.progress * 100)}%</span>}
              <button type="button" className="ts-icon h-6 w-6" aria-label={u.error ? 'Dismiss' : `Cancel ${u.name}`} onClick={() => { u.abort.abort(); setUploads((list) => list.filter((x) => x.id !== u.id)); }}>
                <Icon name="close" size={11} />
              </button>
            </div>
            {!u.error && <span className="ts-progress"><i style={{ width: `${u.progress * 100}%` }} /></span>}
          </div>
        ))}
      </div>

      {(inTab.length > 6 || (category === 'music' && inTab.length > 1)) && (
        <div className="flex items-center gap-2 px-5 pt-3">
          {inTab.length > 6 && <input className="t-input h-9 text-[14px]" placeholder={`Find in ${TAB_LABEL[category].toLowerCase()}`} aria-label="Filter" value={query} onChange={(e) => setQuery(e.target.value)} />}
          {category === 'music' && shown.length > 1 && audio && (
            <>
              <button type="button" className="t-btn h-9 px-3 flex-none" onClick={() => audio.command({ op: 'play', queue: shown.map(toRef) })}><Icon name="play" size={12} />Play all</button>
              <button type="button" className="ts-icon flex-none" aria-label="Shuffle and play all" title="Shuffle and play all" onClick={() => audio.command({ op: 'play', queue: shuffled(shown).map(toRef) })}><Icon name="shuffle" size={16} /></button>
            </>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {library.error ? (
          <p role="alert" className="m-3 text-blood-text">{library.error.message}</p>
        ) : !library.data ? (
          <div className="flex flex-col gap-3 p-3">
            <Loading label="Opening the library…" />
            {[70, 55, 62].map((w) => <Shimmer key={w} className="h-10" style={{ width: `${w}%` }} />)}
          </div>
        ) : shown.length === 0 ? (
          <p className="m-3 t-body text-[15px]">{needle ? 'Nothing matches.' : EMPTY_NOTE[category]}</p>
        ) : (
          <ul className="m-0 p-0 list-none">
            {shown.map((sound, i) => (
              <LibraryRow key={sound.id} sound={sound} index={i} onChanged={replace} onRemoved={(id) => library.set((lib) => ({ ...lib, sounds: lib.sounds.filter((s) => s.id !== id) }))} />
            ))}
          </ul>
        )}
      </div>

      {dragging && (
        <div className="ts-drop">
          <span className="flex flex-col items-center gap-2 text-gilt-hi">
            <Icon name="upload" size={28} />
            <span className="t-h3">{uploadsOn ? `Drop to add to ${TAB_LABEL[category]}` : 'Uploads need R2 storage'}</span>
          </span>
        </div>
      )}
    </section>
  );
}

function LibraryRow({ sound, index, onChanged, onRemoved }: { sound: LibrarySound; index: number; onChanged: (s: LibrarySound) => void; onRemoved: (id: string) => void }) {
  const audio = useTableAudio();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!audio) return null;
  const s = audio.jukebox;
  const ref = toRef(sound);
  const playingNow = s ? currentTrack(s)?.id === sound.id : false;
  const layered = s?.layers.some((l) => l.sound.id === sound.id && l.playing) ?? false;
  const auditioning = audio.previewing === sound.id;
  const failure = error ?? audio.errors[sound.id];

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work');
    } finally {
      setBusy(false);
    }
  };

  const rename = () =>
    run(async () => {
      const name = renaming?.trim();
      setRenaming(null);
      if (name && name !== sound.name) onChanged(await soundsApi.update(sound.id, { name }));
    });

  const meta = [sound.source.kind === 'youtube' ? 'YouTube' : 'File', formatLength(sound.duration), formatSize(sound.size)].filter(Boolean).join(' · ');

  return (
    <li className="ts-row ts-rise flex items-center gap-3 px-3 py-2" aria-current={playingNow || layered} style={{ '--i': Math.min(index, 14) } as React.CSSProperties}>
      <span className="relative flex-none">
        <SoundArt sound={ref} />
        {(playingNow || layered) && <Eq on={s?.music.status === 'playing' || layered} className="absolute left-1 bottom-1" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        {renaming !== null ? (
          <input
            autoFocus
            className="t-input h-8 text-[14px] px-2"
            aria-label="New name"
            value={renaming}
            maxLength={200}
            onChange={(e) => setRenaming(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') rename();
              if (e.key === 'Escape') setRenaming(null);
            }}
            onBlur={rename}
          />
        ) : (
          <span className="truncate text-[15px]" title={sound.name}>{sound.name}</span>
        )}
        {confirming ? (
          <span className="flex items-center gap-3 text-[13px]">
            <span className="text-blood-text">Delete for good?</span>
            <button type="button" className="text-blood-text font-semibold" disabled={busy} onClick={() => run(async () => { await soundsApi.remove(sound.id); onRemoved(sound.id); })}>Delete</button>
            <button type="button" className="text-bone-3" onClick={() => setConfirming(false)}>Keep</button>
          </span>
        ) : failure ? (
          <span role="alert" className="text-blood-text text-[12px] truncate" title={failure}>{failure}</span>
        ) : (
          <span className="t-small text-[12px]">{meta}</span>
        )}
      </div>

      <button type="button" className="ts-icon" aria-label={auditioning ? `Stop listening to ${sound.name}` : `Listen to ${sound.name} here only`} title={auditioning ? 'Stop' : 'Listen here only'} aria-pressed={auditioning} onClick={() => audio.preview(auditioning ? null : ref)}>
        <Icon name={auditioning ? 'stop' : 'audition'} size={auditioning ? 12 : 15} />
      </button>

      {sound.category === 'music' && (
        <>
          <button type="button" className="t-btn h-8 px-3 text-[12px]" onClick={() => audio.command({ op: 'play', queue: [ref] })}>Play</button>
          <button type="button" className="ts-icon" aria-label={`Queue ${sound.name}`} title="Add to the queue" onClick={() => audio.command({ op: 'enqueue', sounds: [ref] })}><Icon name="queue" size={16} /></button>
        </>
      )}
      {sound.category === 'ambience' && (
        <button type="button" className="t-btn h-8 px-3 text-[12px]" disabled={(s?.layers.length ?? 0) >= MAX_LAYERS} title={(s?.layers.length ?? 0) >= MAX_LAYERS ? 'All eight layers are in use' : 'Add as a layer'} onClick={() => audio.command({ op: 'addLayer', sound: ref })}>
          <Icon name="layers" size={13} />Layer
        </button>
      )}
      {sound.category === 'effect' && (
        <button type="button" className="t-btn h-8 px-3 text-[12px]" onClick={() => audio.fire(ref)}><Icon name="bolt" size={12} />Fire</button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="ts-icon" aria-label={`More for ${sound.name}`} disabled={busy}><Icon name="more" size={16} /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[190px]">
          <DropdownMenuItem onSelect={() => setRenaming(sound.name)}>Rename</DropdownMenuItem>
          {SOUND_CATEGORIES.filter((c) => c !== sound.category).map((c) => (
            <DropdownMenuItem key={c} onSelect={() => run(async () => onChanged(await soundsApi.update(sound.id, { category: c })))}>
              Move to {TAB_LABEL[c]}
            </DropdownMenuItem>
          ))}
          {sound.source.kind === 'youtube' && (
            <DropdownMenuItem asChild>
              <a href={youTubeWatchUrl(sound.source.videoId, sound.source.start)} target="_blank" rel="noreferrer">Open on YouTube</a>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-blood-text focus:text-blood-text" onSelect={() => setConfirming(true)}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
