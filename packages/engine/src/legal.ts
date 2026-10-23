import { DRAW_MIN_KEEP, INITIAL_MIN_KEEP } from './apply';
import type { PlayerView } from './view';

/**
 * What the viewer may do right now, computed from their own view so the
 * client can enable controls without the server. The server still has the
 * final say through `apply`.
 *
 * Entries for `drawFaceUp`, `drawBlind`, `claimRoute` and `drawTickets` are
 * candidates by phase only until their rules land; later tickets add the
 * per-action constraints (which face-up indexes, which routes, and so on).
 */
export type LegalAction =
  | { type: 'chooseInitialTickets'; minKeep: number }
  | { type: 'drawFaceUp' }
  | { type: 'drawBlind' }
  | { type: 'claimRoute' }
  | { type: 'drawTickets' }
  | { type: 'chooseTickets'; minKeep: number };

export function legalActions(view: PlayerView): LegalAction[] {
  switch (view.phase) {
    case 'setup':
      return view.me.pendingTickets.length > 0
        ? [{ type: 'chooseInitialTickets', minKeep: INITIAL_MIN_KEEP }]
        : [];
    case 'turnStart':
      if (view.currentPlayer !== view.me.id) return [];
      return [
        { type: 'drawFaceUp' },
        { type: 'drawBlind' },
        { type: 'claimRoute' },
        ...(view.ticketDeckSize > 0 ? [{ type: 'drawTickets' } as const] : []),
      ];
    case 'choosingTickets':
      return view.currentPlayer === view.me.id && view.me.pendingTickets.length > 0
        ? [{ type: 'chooseTickets', minKeep: DRAW_MIN_KEEP }]
        : [];
    case 'drewOne':
    case 'finished':
      return [];
  }
}
