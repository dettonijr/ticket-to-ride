import type { PlayerColour, PlayerId, PlayerView } from '@railyard/engine';

/** Messages a browser sends to the server. */
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

/** Messages the server sends to a browser. */
export type ServerMessage =
  | { type: 'pong' }
  | { type: 'joined'; code: string; playerId: PlayerId; token: string; hostId: PlayerId }
  | { type: 'lobby'; code: string; hostId: PlayerId; players: LobbyPlayer[] }
  | { type: 'snapshot'; view: PlayerView }
  | { type: 'rejected'; reason: string }
  | { type: 'error'; message: string };

export function parseClientMessage(raw: string): ClientMessage | undefined {
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof msg !== 'object' || msg === null) return undefined;
  const m = msg as Record<string, unknown>;
  switch (m['type']) {
    case 'ping':
    case 'start':
      return { type: m['type'] };
    case 'create':
      if (typeof m['name'] === 'string' && typeof m['colour'] === 'string')
        return { type: 'create', name: m['name'], colour: m['colour'] as PlayerColour };
      return undefined;
    case 'join':
      if (
        typeof m['code'] === 'string' &&
        typeof m['name'] === 'string' &&
        typeof m['colour'] === 'string'
      )
        return {
          type: 'join',
          code: m['code'],
          name: m['name'],
          colour: m['colour'] as PlayerColour,
        };
      return undefined;
    case 'reconnect':
      if (typeof m['token'] === 'string') return { type: 'reconnect', token: m['token'] };
      return undefined;
    default:
      return undefined;
  }
}
