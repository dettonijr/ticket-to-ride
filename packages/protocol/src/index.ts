import type { Action, Card, PlayerColour, PlayerId, PlayerView } from '@railyard/engine';

/** Messages a browser sends to the server. */
export type ClientMessage =
  | { type: 'ping' }
  | { type: 'create'; name: string; colour: PlayerColour }
  | { type: 'join'; code: string; name: string; colour: PlayerColour }
  | { type: 'reconnect'; token: string }
  | { type: 'start' }
  | { type: 'action'; action: Action }
  /** Host only, once the game is finished: same seats, fresh deal. */
  | { type: 'rematch' };

export interface LobbyPlayer {
  id: PlayerId;
  name: string;
  colour: PlayerColour;
  connected: boolean;
}

/** Who is currently connected, sent with every snapshot so the table can show it. */
export interface Presence {
  id: PlayerId;
  connected: boolean;
}

/** Messages the server sends to a browser. */
export type ServerMessage =
  | { type: 'pong' }
  | { type: 'joined'; code: string; playerId: PlayerId; token: string; hostId: PlayerId }
  | { type: 'lobby'; code: string; hostId: PlayerId; players: LobbyPlayer[] }
  | { type: 'snapshot'; view: PlayerView; presence: Presence[] }
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
    case 'rematch':
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
    case 'action': {
      const action = parseAction(m['action']);
      return action ? { type: 'action', action } : undefined;
    }
    default:
      return undefined;
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/** Check the shape of an action; the engine checks whether it is allowed. */
export function parseAction(value: unknown): Action | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const a = value as Record<string, unknown>;
  switch (a['type']) {
    case 'chooseInitialTickets':
    case 'chooseTickets':
      return isStringArray(a['keep']) ? { type: a['type'], keep: a['keep'] } : undefined;
    case 'drawFaceUp':
      return typeof a['index'] === 'number' ? { type: 'drawFaceUp', index: a['index'] } : undefined;
    case 'drawBlind':
    case 'drawTickets':
      return { type: a['type'] };
    case 'claimRoute':
      return typeof a['routeId'] === 'string' && isStringArray(a['cards'])
        ? { type: 'claimRoute', routeId: a['routeId'], cards: a['cards'] as Card[] }
        : undefined;
    default:
      return undefined;
  }
}
