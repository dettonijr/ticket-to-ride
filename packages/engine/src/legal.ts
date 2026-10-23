import { INITIAL_MIN_KEEP } from './apply';
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
  | { type: 'drawTickets' };

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
        { type: 'drawTickets' },
      ];
    case 'drewOne':
    case 'choosingTickets':
    case 'finished':
      return [];
  }
}
