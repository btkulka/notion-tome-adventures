// Plays the jukebox in this browser. Every browser at the table runs one and is
// handed the same state (jukebox.ts), so all of them play the same thing at
// the same spot: positions come from the table's clock, not from when this
// page happened to load. Files go through Web Audio (smooth fades, and the only
// volume iOS honours); YouTube videos play in hidden IFrame players.
import { layerPosition, soundFileUrl, trackElapsed, type JukeboxState, type SoundRef } from './jukebox';
import { loadYouTubeApi, YT_STATE, youTubeError, type YTPlayer } from './youtubeApi';

/** Slider (0–1) to gain. Squared, so the bottom half of a slider isn't all near-silence. */
export const gainOf = (v: number) => v * v;

const MUSIC_FADE = 1.6;
const LAYER_FADE = 0.9;
const PAUSE_FADE = 0.25;
const VOLUME_RAMP = 0.08;
/** Music further than this off the table's clock is pulled back in step. Layers are placed once. */
const MUSIC_DRIFT = 1.5;
/** After pulling a voice back in step, leave it this long: each seek rebuffers, and correcting mid-rebuffer never settles. */
const SETTLE_MS = 8000;
const CHECK_MS = 3000;
/** YouTube passes through "unstarted" while it loads; asking again inside this window restarts the load. */
const YT_PLAY_PATIENCE_MS = 10000;
/** Failed loads of YouTube's player script retried before the DM is told. */
const YT_QUIET_TRIES = 3;
/** Effects this short are decoded and kept, so firing them again is instant. */
const KEEP_EFFECT_SECONDS = 45;

interface VoiceEvents {
  ready(): void;
  ended(): void;
  duration(seconds: number): void;
  error(message: string): void;
}

type SyncArgs = [position: number | null, playing: boolean, loop: boolean, tolerance: number];

abstract class Voice {
  /** Gain while playing. */
  protected target = 0;
  /** Whether it should be sounding (it may still be waiting for the page to be touched). */
  protected playing = false;
  /** Put at the right spot at least once. */
  protected positioned = false;
  /** When it was last pulled back in step. */
  protected correctedAt = 0;
  protected disposed = false;
  protected last: SyncArgs | null = null;
  protected syncs = 0;
  /** Seconds to fade in when it starts; a pause and resume uses PAUSE_FADE. */
  fadeIn = PAUSE_FADE;

  constructor(readonly sound: SoundRef, protected events: VoiceEvents) {}

  abstract setGain(gain: number, ramp: number): void;
  abstract sync(...args: SyncArgs): void;
  abstract duration(): number | null;
  abstract dispose(fade: number): void;

  /** The page was just clicked: anything the browser refused to start may try again now. */
  nudge(): void {}

  /** Loaded: the engine places it afresh (time has moved on); a voice the engine doesn't manage replays its last orders. */
  /** Whether a voice already placed may be moved again now. */
  protected settled() {
    return performance.now() - this.correctedAt > SETTLE_MS;
  }

  protected becameReady() {
    const before = this.syncs;
    this.events.ready();
    if (this.syncs === before && this.last) this.sync(...this.last);
  }
}

class FileVoice extends Voice {
  private el = new Audio();
  private gain: GainNode;
  private pauseTimer: ReturnType<typeof setTimeout> | undefined;
  private starting = false;

  constructor(private ctx: AudioContext, sound: SoundRef, events: VoiceEvents) {
    super(sound, events);
    const el = this.el;
    el.preload = 'auto';
    el.src = soundFileUrl(sound.id);
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(this.gain).connect(ctx.destination);
    el.addEventListener('loadedmetadata', () => {
      if (this.disposed) return;
      if (Number.isFinite(el.duration) && el.duration > 0) events.duration(el.duration);
      this.becameReady();
    });
    el.addEventListener('ended', () => !this.disposed && events.ended());
    el.addEventListener('error', () => !this.disposed && events.error('This file could not be loaded'));
  }

  private ramp(to: number, seconds: number) {
    const g = this.gain.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(to, t + Math.max(0.02, seconds));
  }

  setGain(gain: number, ramp: number) {
    const changed = Math.abs(gain - this.target) > 0.0005;
    this.target = gain;
    if (changed && this.playing && !this.el.paused) this.ramp(gain, ramp);
  }

  sync(...args: SyncArgs) {
    const [position, playing, loop, tolerance] = args;
    this.last = args;
    this.syncs++;
    if (this.disposed) return;
    const el = this.el;
    el.loop = loop;
    if (position !== null && el.readyState >= HTMLMediaElement.HAVE_METADATA) {
      if (!this.positioned) {
        el.currentTime = position;
        this.positioned = true;
      } else if (!el.paused && !el.seeking && this.settled() && Math.abs(el.currentTime - position) > tolerance) {
        el.currentTime = position;
        this.correctedAt = performance.now();
      }
    }
    // Joining midway: wait for the metadata and the seek rather than play a blip of 0:00 first.
    const waitingToSeek = position !== null && !this.positioned;
    if (playing) {
      clearTimeout(this.pauseTimer);
      this.playing = true;
      if (el.paused && !this.starting && !waitingToSeek) {
        this.starting = true;
        el.play()
          .then(() => {
            this.ramp(this.target, this.fadeIn);
            this.fadeIn = PAUSE_FADE;
          })
          // Blocked until the page is touched; the next sync tries again.
          .catch(() => undefined)
          .finally(() => {
            this.starting = false;
          });
      }
    } else if (this.playing) {
      this.playing = false;
      this.ramp(0, PAUSE_FADE);
      this.pauseTimer = setTimeout(() => el.pause(), PAUSE_FADE * 1000);
    }
  }

  duration() {
    return Number.isFinite(this.el.duration) && this.el.duration > 0 ? this.el.duration : null;
  }

  dispose(fade: number) {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.pauseTimer);
    this.ramp(0, fade);
    setTimeout(() => {
      this.el.pause();
      this.el.removeAttribute('src');
      this.el.load();
      this.gain.disconnect();
    }, fade * 1000 + 50);
  }
}

class YouTubeVoice extends Voice {
  private player: YTPlayer | null = null;
  private wrap = document.createElement('div');
  private ready = false;
  private loop = false;
  private volume = 0;
  private fadeTimer: ReturnType<typeof setInterval> | undefined;
  private pauseTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly start: number;
  private started = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  /** When playback was last asked for. */
  private askedAt = -Infinity;

  constructor(host: HTMLElement, sound: SoundRef, events: VoiceEvents) {
    super(sound, events);
    this.start = sound.source.kind === 'youtube' ? sound.source.start : 0;
    const mount = document.createElement('div');
    this.wrap.appendChild(mount);
    host.appendChild(this.wrap);
    const videoId = sound.source.kind === 'youtube' ? sound.source.videoId : '';
    // A flaky connection shouldn't lose the track: keep trying, and only say so after a few misses.
    const boot = (attempt: number) => loadYouTubeApi().then(
      (YT) => {
        if (this.disposed) return;
        if (attempt > YT_QUIET_TRIES) events.error('');
        this.player = new YT.Player(mount, {
          width: 200,
          height: 200,
          videoId,
          playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1, iv_load_policy: 3, start: Math.floor(this.start), origin: window.location.origin },
          events: {
            onReady: () => {
              if (this.disposed || !this.player) return;
              this.ready = true;
              this.player.unMute();
              this.apply(0);
              this.reportDuration();
              this.becameReady();
            },
            onStateChange: (e) => this.onState(e.data),
            onError: (e) => !this.disposed && events.error(youTubeError(e.data)),
          },
        });
      },
      (err: Error) => {
        if (this.disposed) return;
        if (attempt === YT_QUIET_TRIES) events.error(err.message);
        this.retryTimer = setTimeout(() => boot(attempt + 1), Math.min(15000, 2000 * attempt));
      }
    );
    boot(1);
  }

  private reportDuration() {
    const d = this.player?.getDuration() ?? 0;
    if (d > 0) this.events.duration(Math.max(1, d - this.start));
  }

  private live() {
    return Boolean(this.player?.getVideoData?.().isLive);
  }

  private onState(state: number) {
    if (this.disposed || !this.player) return;
    if (state === YT_STATE.PLAYING) {
      this.reportDuration();
      if (this.playing) {
        this.fadeTo(this.target, this.fadeIn);
        this.fadeIn = PAUSE_FADE;
        if (!this.started) {
          // Loading took a while; catch up with the table now rather than at the next check.
          this.started = true;
          this.correctedAt = 0;
          this.events.ready();
        }
      } else {
        // YouTube started on its own (a seek on a cued video plays it); hold it.
        this.player.pauseVideo();
      }
    } else if (state === YT_STATE.ENDED) {
      if (this.loop && this.playing) {
        this.player.seekTo(this.start, true);
        this.player.playVideo();
      } else this.events.ended();
    }
  }

  private apply(v: number) {
    this.volume = v;
    // YouTube only attaches the player's methods once it's ready.
    if (this.ready) this.player?.setVolume(Math.round(v * 100));
  }

  private fadeTo(to: number, seconds: number) {
    clearInterval(this.fadeTimer);
    if (seconds <= 0.1) return this.apply(to);
    const from = this.volume;
    const steps = Math.max(1, Math.round(seconds * 20));
    let i = 0;
    this.fadeTimer = setInterval(() => {
      i++;
      this.apply(from + (to - from) * (i / steps));
      if (i >= steps) clearInterval(this.fadeTimer);
    }, 50);
  }

  setGain(gain: number, ramp: number) {
    const changed = Math.abs(gain - this.target) > 0.0005;
    this.target = gain;
    if (changed && this.ready && this.playing && this.player?.getPlayerState() === YT_STATE.PLAYING) this.fadeTo(gain, ramp);
  }

  sync(...args: SyncArgs) {
    const [position, playing, loop, tolerance] = args;
    this.last = args;
    this.syncs++;
    this.loop = loop;
    if (this.disposed || !this.ready || !this.player) return;
    const p = this.player;
    const state = p.getPlayerState();
    // Seeking a video that hasn't started would start it, so a paused one is placed when it plays.
    const placeable = playing || state === YT_STATE.PAUSED || state === YT_STATE.PLAYING;
    if (position !== null && placeable && !this.live()) {
      if (!this.positioned) {
        p.seekTo(this.start + position, true);
        this.positioned = true;
        this.correctedAt = performance.now();
      } else if (state === YT_STATE.PLAYING && this.settled() && Math.abs(p.getCurrentTime() - this.start - position) > tolerance) {
        p.seekTo(this.start + position, true);
        this.correctedAt = performance.now();
      }
    }
    if (playing) {
      clearTimeout(this.pauseTimer);
      this.playing = true;
      // Ask once; ask again only if YouTube settled somewhere other than playing, or never got going.
      const stalled = state === YT_STATE.PAUSED || state === YT_STATE.CUED || state === YT_STATE.ENDED || performance.now() - this.askedAt > YT_PLAY_PATIENCE_MS;
      if (state !== YT_STATE.PLAYING && state !== YT_STATE.BUFFERING && stalled) {
        this.askedAt = performance.now();
        p.playVideo();
      }
    } else if (this.playing) {
      this.playing = false;
      this.fadeTo(0, PAUSE_FADE);
      this.pauseTimer = setTimeout(() => !this.playing && p.pauseVideo(), PAUSE_FADE * 1000);
    }
  }

  nudge() {
    this.askedAt = -Infinity;
  }

  duration() {
    const d = this.ready ? this.player?.getDuration() ?? 0 : 0;
    return d > 0 ? Math.max(1, d - this.start) : null;
  }

  dispose(fade: number) {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.pauseTimer);
    clearTimeout(this.retryTimer);
    const remove = () => {
      clearInterval(this.fadeTimer);
      try {
        this.player?.destroy();
      } catch {
        // Already gone with its iframe.
      }
      this.wrap.remove();
    };
    // Still loading: nothing to fade, so go at once.
    if (!this.ready) return remove();
    this.fadeTo(0, fade);
    setTimeout(remove, fade * 1000 + 80);
  }
}

export interface EngineCallbacks {
  /** The music track that started at `startedAt` reached its end here. */
  onEnded?(startedAt: number): void;
  onDuration?(soundId: string, seconds: number): void;
  /** A sound failed here; an empty message means it recovered. */
  onError?(soundId: string, message: string): void;
  onLockChange?(locked: boolean): void;
  onPreviewChange?(soundId: string | null): void;
}

interface Want {
  sound: SoundRef;
  gain: number;
  fade: number;
  playing: boolean;
  loop: boolean;
}

export class TableAudioEngine {
  private ctx: AudioContext | null = null;
  private voices = new Map<string, Voice>();
  private state: JukeboxState | null = null;
  private audible = true;
  private device = 1;
  private timer: ReturnType<typeof setInterval>;
  private previewVoice: Voice | null = null;
  private effectBuffers = new Map<string, AudioBuffer>();
  private decoding = new Set<string>();
  private measured = new Map<string, number>();
  private endedFor: number | null = null;
  private locked: boolean;
  private destroyed = false;

  constructor(private host: HTMLElement, private serverNow: () => number, private cb: EngineCallbacks = {}) {
    this.timer = setInterval(() => this.reconcile(), CHECK_MS);
    this.locked = this.computeLocked();
    for (const type of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(type, this.onGesture, { capture: true });
  }

  /** The audio context, made on first need (made before a gesture, it starts suspended). */
  private audio(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.ctx.onstatechange = () => this.checkLock();
    }
    return this.ctx;
  }

  private computeLocked(): boolean {
    if (this.ctx) return this.ctx.state !== 'running';
    return !(navigator.userActivation?.hasBeenActive ?? false);
  }

  private checkLock() {
    const locked = this.computeLocked();
    if (locked === this.locked) return;
    this.locked = locked;
    this.cb.onLockChange?.(locked);
    if (!locked) this.reconcile();
  }

  get isLocked() {
    return this.locked;
  }

  private onGesture = () => this.unlock();

  /** Call from a click or key press: browsers only let sound start after one. */
  unlock() {
    if (this.destroyed) return;
    const ctx = this.audio();
    if (ctx.state === 'running' && !this.locked) return;
    if (ctx.state === 'suspended') ctx.resume().then(() => this.checkLock(), () => undefined);
    for (const voice of this.voices.values()) voice.nudge();
    this.checkLock();
    this.reconcile();
  }

  update(state: JukeboxState | null, audible: boolean) {
    this.state = state;
    this.audible = audible;
    this.reconcile();
  }

  /** This device's own volume, on top of the table's. */
  setDevice(volume: number, muted: boolean) {
    this.device = muted ? 0 : gainOf(volume);
    this.reconcile();
    if (this.previewVoice) this.previewVoice.setGain(this.device, VOLUME_RAMP);
  }

  private makeVoice(sound: SoundRef, events: VoiceEvents): Voice {
    return sound.source.kind === 'youtube' ? new YouTubeVoice(this.host, sound, events) : new FileVoice(this.audio(), sound, events);
  }

  private eventsFor(key: string, sound: SoundRef): VoiceEvents {
    return {
      ready: () => this.reconcile(),
      ended: () => key === 'music' && this.musicEnded(),
      duration: (seconds) => {
        if (this.measured.get(sound.id) === seconds) return;
        this.measured.set(sound.id, seconds);
        this.cb.onDuration?.(sound.id, seconds);
      },
      error: (message) => this.cb.onError?.(sound.id, message),
    };
  }

  private musicEnded() {
    const m = this.state?.music;
    if (!m || m.status !== 'playing' || m.loop === 'track' || this.endedFor === m.startedAt) return;
    this.endedFor = m.startedAt;
    this.cb.onEnded?.(m.startedAt);
  }

  private reconcile() {
    if (this.destroyed) return;
    const s = this.state;
    const now = this.serverNow();
    const want = new Map<string, Want>();
    if (s && this.audible) {
      const m = s.music;
      const track = m.queue[m.index];
      if (track && m.status !== 'stopped') {
        want.set('music', { sound: track, gain: gainOf(s.master) * gainOf(m.volume), fade: MUSIC_FADE, playing: m.status === 'playing', loop: m.loop === 'track' });
      }
      for (const l of s.layers) want.set(`layer:${l.id}`, { sound: l.sound, gain: gainOf(s.master) * gainOf(l.volume), fade: LAYER_FADE, playing: l.playing, loop: true });
    }

    for (const [key, voice] of this.voices) {
      const w = want.get(key);
      if (!w || w.sound.id !== voice.sound.id) {
        voice.dispose(key === 'music' ? MUSIC_FADE : LAYER_FADE);
        this.voices.delete(key);
      }
    }

    for (const [key, w] of want) {
      let voice = this.voices.get(key);
      if (!voice) {
        voice = this.makeVoice(w.sound, this.eventsFor(key, w.sound));
        voice.fadeIn = w.fade;
        this.voices.set(key, voice);
      }
      const duration = w.sound.duration ?? this.measured.get(w.sound.id) ?? voice.duration();
      let position: number | null;
      let playing = w.playing;
      if (key === 'music' && s) {
        const elapsed = trackElapsed(s.music, now);
        if (w.loop) position = duration ? elapsed % duration : elapsed;
        else {
          position = elapsed;
          // Past the end: hold silent until the deck moves on (the DM's browser tells the table).
          if (duration && elapsed >= duration && s.music.status === 'playing') {
            playing = false;
            this.musicEnded();
          }
        }
        voice.sync(position, playing, w.loop, MUSIC_DRIFT);
      } else {
        const layer = s?.layers.find((l) => `layer:${l.id}` === key);
        position = layer ? layerPosition(layer, now, duration) : null;
        voice.sync(position, playing, true, Infinity);
      }
      voice.setGain(w.gain * this.device, VOLUME_RAMP);
    }
  }

  /** A one-shot effect, at `volume` (0–1, the effects slider already applied). */
  fire(sound: SoundRef, volume: number) {
    if (this.destroyed) return;
    const level = gainOf(this.state?.master ?? 1) * gainOf(volume) * this.device;
    if (sound.source.kind === 'youtube') {
      const voice = new YouTubeVoice(this.host, sound, {
        ready: () => undefined,
        ended: () => voice.dispose(0.1),
        duration: () => undefined,
        error: (message) => this.cb.onError?.(sound.id, message),
      });
      voice.fadeIn = 0.05;
      voice.setGain(level, 0);
      voice.sync(null, true, false, Infinity);
      return;
    }
    const ctx = this.audio();
    const buffer = this.effectBuffers.get(sound.id);
    if (buffer) {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buffer;
      gain.gain.value = level;
      src.connect(gain).connect(ctx.destination);
      src.onended = () => gain.disconnect();
      src.start();
      return;
    }
    // Not decoded yet: stream it now, and keep a decoded copy for next time.
    const el = new Audio(soundFileUrl(sound.id));
    const gain = ctx.createGain();
    gain.gain.value = level;
    ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
    el.addEventListener('ended', () => gain.disconnect());
    el.play().catch(() => gain.disconnect());
    this.prime([sound]);
  }

  /** Decodes short effects ahead of time so their first firing is instant. */
  prime(sounds: SoundRef[]) {
    for (const sound of sounds) {
      if (sound.source.kind !== 'file' || this.effectBuffers.has(sound.id) || this.decoding.has(sound.id)) continue;
      if (sound.duration !== null && sound.duration > KEEP_EFFECT_SECONDS) continue;
      this.decoding.add(sound.id);
      fetch(soundFileUrl(sound.id), { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((bytes) => this.audio().decodeAudioData(bytes))
        .then((decoded) => {
          if (decoded.duration <= KEEP_EFFECT_SECONDS) this.effectBuffers.set(sound.id, decoded);
        })
        .catch(() => undefined)
        .finally(() => this.decoding.delete(sound.id));
    }
  }

  /** Plays a sound on this device only, to hear it before the table does. */
  preview(sound: SoundRef | null) {
    this.previewVoice?.dispose(0.2);
    this.previewVoice = null;
    if (sound && !this.destroyed) {
      const voice = this.makeVoice(sound, {
        ready: () => undefined,
        ended: () => this.previewVoice === voice && this.preview(null),
        duration: () => undefined,
        error: (message) => {
          this.cb.onError?.(sound.id, message);
          if (this.previewVoice === voice) this.preview(null);
        },
      });
      voice.fadeIn = 0.15;
      voice.setGain(this.device, 0);
      voice.sync(null, true, false, Infinity);
      this.previewVoice = voice;
    }
    this.cb.onPreviewChange?.(sound?.id ?? null);
  }

  destroy() {
    this.destroyed = true;
    clearInterval(this.timer);
    for (const type of ['pointerdown', 'keydown', 'touchend'] as const) window.removeEventListener(type, this.onGesture, { capture: true });
    for (const voice of this.voices.values()) voice.dispose(0.15);
    this.voices.clear();
    this.previewVoice?.dispose(0.1);
    setTimeout(() => this.ctx?.close().catch(() => undefined), 400);
  }
}
