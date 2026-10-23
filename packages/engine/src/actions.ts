import type { Card, PlayerId, RouteId, TicketId } from './state';

/**
 * One action per decision point. Drawing train cards is two actions within a
 * turn because the first draw changes what the second may be.
 */
export type Action =
  | { type: 'chooseInitialTickets'; keep: TicketId[] }
  | { type: 'drawFaceUp'; index: number }
  | { type: 'drawBlind' }
  | { type: 'claimRoute'; routeId: RouteId; cards: Card[] }
  | { type: 'drawTickets' }
  | { type: 'chooseTickets'; keep: TicketId[] };

export type ActionType = Action['type'];

/** Why an action was refused. `code` is stable for clients; `message` is for humans. */
export interface RuleViolation {
  code: string;
  message: string;
}

/** An action together with the player who took it, as stored in a game's log. */
export interface LoggedAction {
  playerId: PlayerId;
  action: Action;
}
