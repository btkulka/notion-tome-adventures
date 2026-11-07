// One Durable Object per campaign: the live table. It holds every connected
// browser's WebSocket and fans out messages by audience, so a DM-only update
// never reaches a player's socket. State itself lives in D1; this only relays.
import type { Env } from './env';

export type Audience = 'all' | 'dm' | 'players';

interface Seat {
  userId: string;
  role: 'dm' | 'player';
  name: string;
  avatarUrl: string | null;
}

export class TableRoom implements DurableObject {
  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/connect') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket upgrade', { status: 426 });
      const seat: Seat = {
        userId: req.headers.get('X-User-Id') ?? '',
        role: req.headers.get('X-Role') === 'dm' ? 'dm' : 'player',
        name: req.headers.get('X-Name') ?? 'Someone',
        avatarUrl: req.headers.get('X-Avatar') || null,
      };
      const { 0: client, 1: server } = new WebSocketPair();
      // Tags let a broadcast pick sockets by role without waking every attachment.
      this.state.acceptWebSocket(server, [seat.role]);
      server.serializeAttachment(seat);
      this.sendPresence();
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/broadcast' && req.method === 'POST') {
      const { audience, message } = (await req.json()) as { audience: Audience; message: unknown };
      this.send(audience, message);
      return new Response('ok');
    }

    return new Response('Not found', { status: 404 });
  }

  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): void {
    const seat = ws.deserializeAttachment() as Seat;
    let msg: { type?: string; [key: string]: unknown };
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }
    switch (msg.type) {
      case 'ping':
        // Anyone can mark a spot on the map for everyone.
        this.send('all', { type: 'ping', x: msg.x, y: msg.y, by: seat.name, userId: seat.userId });
        break;
      case 'pull':
        // Only the DM can move everyone's camera.
        if (seat.role === 'dm') this.send('players', { type: 'pull', camera: msg.camera });
        break;
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.sendPresence(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.sendPresence(ws);
  }

  private send(audience: Audience, message: unknown): void {
    const sockets = audience === 'all' ? this.state.getWebSockets() : this.state.getWebSockets(audience === 'dm' ? 'dm' : 'player');
    const text = JSON.stringify(message);
    for (const ws of sockets) {
      try {
        ws.send(text);
      } catch {
        // Socket already closing; presence will catch up.
      }
    }
  }

  private sendPresence(leaving?: WebSocket): void {
    const seen = new Map<string, Seat>();
    for (const ws of this.state.getWebSockets()) {
      if (ws === leaving) continue;
      const seat = ws.deserializeAttachment() as Seat;
      seen.set(seat.userId, seat);
    }
    this.send('all', { type: 'presence', people: [...seen.values()] });
  }
}

/** Relays a message to a campaign's connected browsers. */
export async function broadcast(env: Env, campaignId: string, audience: Audience, message: unknown): Promise<void> {
  const stub = env.TABLE.get(env.TABLE.idFromName(campaignId));
  await stub.fetch('https://table/broadcast', { method: 'POST', body: JSON.stringify({ audience, message }) });
}
