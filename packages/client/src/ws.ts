import { useSyncExternalStore } from 'react';
import type { PlayerColour, PlayerId, PlayerView } from '@railyard/engine';

/** Mirrors packages/server/src/protocol.ts. Keep the two in step. */
export type ClientMessage =
  | { type: 'ping' }
  | { type: 'create'; name: string; colour: PlayerColour }
  | { type: 'join'; code: string; name: string; colour: PlayerColour }
  | { type: 'reconnect'; token: string }
  | { type: 'start' };

export interface LobbyPlayer {
  id: PlayerId;
  name: string;
  colour: PlayerColour;
  connected: boolean;
}

export type ServerMessage =
  | { type: 'pong' }
  | { type: 'joined'; code: string; playerId: PlayerId; token: string; hostId: PlayerId }
  | { type: 'lobby'; code: string; hostId: PlayerId; players: LobbyPlayer[] }
  | { type: 'snapshot'; view: PlayerView }
  | { type: 'rejected'; reason: string }
  | { type: 'error'; message: string };

export interface ClientState {
  connection: 'connecting' | 'open' | 'closed';
  code: string | undefined;
  playerId: PlayerId | undefined;
  hostId: PlayerId | undefined;
  lobby: LobbyPlayer[] | undefined;
  view: PlayerView | undefined;
  /** The last rejection reason, cleared on the next successful message. */
  rejection: string | undefined;
}

const TOKEN_KEY = 'railyard.token';

function readToken(): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeToken(token: string | undefined): void {
  try {
    if (token === undefined) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage may be unavailable; reconnection is then simply not offered.
  }
}

export function socketUrl(loc: { protocol: string; host: string } = location): string {
  const scheme = loc.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${loc.host}/ws`;
}

/** A tiny external store around one WebSocket. */
export class GameClient {
  private state: ClientState = {
    connection: 'connecting',
    code: undefined,
    playerId: undefined,
    hostId: undefined,
    lobby: undefined,
    view: undefined,
    rejection: undefined,
  };
  private listeners = new Set<() => void>();
  private socket: WebSocket | undefined;

  constructor(private readonly url: string = socketUrl()) {}

  connect(): void {
    const socket = new WebSocket(this.url);
    this.socket = socket;
    this.set({ connection: 'connecting' });
    socket.onopen = () => {
      this.set({ connection: 'open' });
      const token = readToken();
      if (token) this.send({ type: 'reconnect', token });
    };
    socket.onclose = () => this.set({ connection: 'closed' });
    socket.onmessage = (event) => this.receive(JSON.parse(String(event.data)) as ServerMessage);
  }

  send(msg: ClientMessage): void {
    this.socket?.send(JSON.stringify(msg));
  }

  /** Forget the saved game so the next load starts at Home. */
  leave(): void {
    writeToken(undefined);
    this.set({
      code: undefined,
      playerId: undefined,
      hostId: undefined,
      lobby: undefined,
      view: undefined,
    });
  }

  getState = (): ClientState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  receive(msg: ServerMessage): void {
    switch (msg.type) {
      case 'pong':
        return;
      case 'joined':
        writeToken(msg.token);
        this.set({
          code: msg.code,
          playerId: msg.playerId,
          hostId: msg.hostId,
          rejection: undefined,
        });
        return;
      case 'lobby':
        this.set({ code: msg.code, hostId: msg.hostId, lobby: msg.players, rejection: undefined });
        return;
      case 'snapshot':
        this.set({ view: msg.view, rejection: undefined });
        return;
      case 'rejected':
        if (msg.reason === 'Unknown reconnect token') writeToken(undefined);
        this.set({ rejection: msg.reason });
        return;
      case 'error':
        this.set({ rejection: msg.message });
        return;
    }
  }

  private set(patch: Partial<ClientState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }
}

export const client = new GameClient();

export function useClientState(): ClientState {
  return useSyncExternalStore(client.subscribe, client.getState, client.getState);
}
