import { useCallback, useEffect, useRef, useState } from 'react';
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
  | { type: 'map'; mapId: string; version: number };

/**
 * The campaign's live-table socket. Reconnects with backoff; `send` drops
 * messages while disconnected (pings and pulls are ephemeral anyway).
 */
export function useTable(campaignId: string | null | undefined, onMessage: (msg: TableMessage) => void) {
  const [connected, setConnected] = useState(false);
  // False until the first connection opens, so pages can say "connecting" rather than "reconnecting".
  const [opened, setOpened] = useState(false);
  const [people, setPeople] = useState<Seat[]>([]);
  const socket = useRef<WebSocket | null>(null);
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    if (!campaignId) return;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setOpened(false);

    const connect = () => {
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${scheme}://${window.location.host}/api/campaigns/${encodeURIComponent(campaignId)}/table`);
      socket.current = ws;
      ws.onopen = () => {
        retry = 0;
        setConnected(true);
        setOpened(true);
      };
      ws.onmessage = (event) => {
        let msg: TableMessage;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (msg.type === 'presence') setPeople(msg.people);
        handler.current(msg);
      };
      ws.onclose = () => {
        setConnected(false);
        socket.current = null;
        if (closed) return;
        timer = setTimeout(connect, Math.min(15000, 500 * 2 ** retry++));
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      socket.current?.close();
    };
  }, [campaignId]);

  const send = useCallback((msg: { type: 'ping'; x: number; y: number } | { type: 'pull'; camera: CameraPose }) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(msg));
  }, []);

  return { connected, connecting: !connected && !opened, people, send };
}
