import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { keepAcrossHmr } from '@/lib/hmr';
import type { JukeboxCommand, JukeboxState, SoundRef } from '@/features/sound/jukebox';
import type { LiveSession, MapObject } from './types';
import type { CameraPose } from './render/CameraRig';

export interface Seat {
  userId: string;
  role: 'dm' | 'player';
  name: string;
  avatarUrl: string | null;
}

/** Messages the live table relays (worker/table.ts, worker/api/maps.ts). */
export type TableMessage =
  | { type: 'presence'; people: Seat[] }
  | { type: 'ping'; x: number; y: number; by: string; userId: string }
  | { type: 'pull'; camera: CameraPose }
  | { type: 'live'; live: LiveSession }
  | { type: 'objects'; mapId: string; upsert: MapObject[]; remove: string[] }
  | { type: 'fog'; mapId: string; explored: string }
  | { type: 'map'; mapId: string; version: number }
  | { type: 'jukebox'; state: JukeboxState; now: number }
  | { type: 'sfx'; id: string; sound: SoundRef; volume: number };

/** What a browser may send. The table ignores the DM-only ones from players. */
export type TableSend =
  | { type: 'ping'; x: number; y: number }
  | { type: 'pull'; camera: CameraPose }
  | { type: 'jukebox'; command: JukeboxCommand }
  | { type: 'sfx'; sound: SoundRef; volume?: number };

interface Snapshot {
  connected: boolean;
  /** False until the first connection opens, so pages can say "connecting" rather than "reconnecting". */
  opened: boolean;
  people: Seat[];
  jukebox: JukeboxState | null;
}

const EMPTY: Snapshot = { connected: false, opened: false, people: [], jukebox: null };
/** After the last user lets go, the socket stays open this long in case another picks it up (a route change). */
const LINGER_MS = 1500;
const CLOCK_SYNC_AT = [0, 800, 2500];
const CLOCK_RESYNC_MS = 5 * 60 * 1000;

/**
 * One campaign's live-table socket, shared by every component that asks for it.
 * Reconnects with backoff; `send` drops messages while disconnected (pings and
 * pulls are ephemeral anyway, and the jukebox resends its whole state on connect).
 */
class Connection {
  snapshot: Snapshot = EMPTY;
  private ws: WebSocket | null = null;
  private refs = 0;
  private closed = true;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private lingerTimer: ReturnType<typeof setTimeout> | undefined;
  private clockTimers: ReturnType<typeof setTimeout>[] = [];
  private listeners = new Set<(msg: TableMessage) => void>();
  private watchers = new Set<() => void>();
  /** Server clock minus ours, in ms, from the quickest round trip so far. */
  private offset = 0;
  private bestRtt = Infinity;

  constructor(readonly campaignId: string) {}

  acquire() {
    this.refs++;
    clearTimeout(this.lingerTimer);
    if (this.closed) {
      this.closed = false;
      this.connect();
    }
  }

  release() {
    if (--this.refs > 0) return;
    this.lingerTimer = setTimeout(() => this.shutdown(), LINGER_MS);
  }

  listen(fn: (msg: TableMessage) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  subscribe = (fn: () => void) => {
    this.watchers.add(fn);
    return () => {
      this.watchers.delete(fn);
    };
  };

  getSnapshot = () => this.snapshot;

  serverNow = () => Date.now() + this.offset;

  send(msg: TableSend | { type: 'time'; t0: number }) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private patch(change: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    for (const fn of this.watchers) fn();
  }

  private connect() {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${scheme}://${window.location.host}/api/campaigns/${encodeURIComponent(this.campaignId)}/table`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.bestRtt = Infinity;
      this.patch({ connected: true, opened: true });
      this.syncClock();
    };
    ws.onmessage = (event) => {
      let msg: TableMessage | { type: 'time'; t0: number; server: number };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === 'time') return this.onTime(msg.t0, msg.server);
      if (msg.type === 'presence') this.patch({ people: msg.people });
      if (msg.type === 'jukebox') {
        // A first estimate of the server clock, until a proper round trip comes back.
        if (this.bestRtt === Infinity) this.offset = msg.now - Date.now();
        this.patch({ jukebox: msg.state });
      }
      for (const fn of this.listeners) fn(msg);
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.clockTimers.forEach(clearTimeout);
      this.patch({ connected: false });
      if (this.closed) return;
      this.retryTimer = setTimeout(() => this.connect(), Math.min(15000, 500 * 2 ** this.retry++));
    };
  }

  private syncClock() {
    this.clockTimers.forEach(clearTimeout);
    this.clockTimers = CLOCK_SYNC_AT.map((ms) => setTimeout(() => this.send({ type: 'time', t0: Date.now() }), ms));
    this.clockTimers.push(setTimeout(() => this.syncClock(), CLOCK_RESYNC_MS));
  }

  private onTime(t0: number, server: number) {
    const rtt = Date.now() - t0;
    if (!(rtt >= 0) || rtt > this.bestRtt + 30) return;
    this.bestRtt = Math.min(this.bestRtt, rtt);
    this.offset = server + rtt / 2 - Date.now();
  }

  private shutdown() {
    this.closed = true;
    clearTimeout(this.retryTimer);
    this.clockTimers.forEach(clearTimeout);
    this.ws?.close();
    this.ws = null;
    this.snapshot = EMPTY;
    connections.delete(this.campaignId);
  }
}

// Kept across hot updates, or every edit would strand an open socket.
const connections = keepAcrossHmr(import.meta.hot, 'tableConnections', () => new Map<string, Connection>());

function connectionFor(campaignId: string): Connection {
  let conn = connections.get(campaignId);
  if (!conn) {
    conn = new Connection(campaignId);
    connections.set(campaignId, conn);
  }
  return conn;
}

const noSubscribe = () => () => undefined;
const noSnapshot = () => EMPTY;

/**
 * The campaign's live-table socket. Components asking for the same campaign
 * share one connection; `onMessage` sees every message relayed to it.
 */
export function useTable(campaignId: string | null | undefined, onMessage?: (msg: TableMessage) => void) {
  const conn = campaignId ? connectionFor(campaignId) : null;
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    if (!conn) return;
    conn.acquire();
    const stop = conn.listen((msg) => handler.current?.(msg));
    return () => {
      stop();
      conn.release();
    };
  }, [conn]);

  const snap = useSyncExternalStore(conn?.subscribe ?? noSubscribe, conn?.getSnapshot ?? noSnapshot);
  const send = useCallback((msg: TableSend) => conn?.send(msg), [conn]);
  const serverNow = useCallback(() => (conn ? conn.serverNow() : Date.now()), [conn]);

  return {
    connected: snap.connected,
    connecting: !snap.connected && !snap.opened,
    people: snap.people,
    jukebox: snap.jukebox,
    send,
    serverNow,
  };
}
