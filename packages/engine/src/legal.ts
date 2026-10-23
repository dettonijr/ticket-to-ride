import { DRAW_MIN_KEEP, INITIAL_MIN_KEEP } from './apply';
import { claimableRoutes } from './rules/claimRoute';
import type { RouteId } from './state';
import type { PlayerView } from './view';

/**
 * What the viewer may do right now, computed from their own view so the
 * client can enable controls without the server. The server still has the
 * final say through `apply`.
 */
export type LegalAction =
  | { type: 'chooseInitialTickets'; minKeep: number }
  /** Which face-up slots may be taken right now. */
  | { type: 'drawFaceUp'; indexes: number[] }
  | { type: 'drawBlind' }
  /** Routes the viewer can legally claim and pay for from their hand. */
  | { type: 'claimRoute'; routes: RouteId[] }
  | { type: 'drawTickets' }
  | { type: 'chooseTickets'; minKeep: number };

/** The draw actions open to the current player, given whether this is the second draw. */
function drawActions(view: PlayerView, secondDraw: boolean): LegalAction[] {
  const actions: LegalAction[] = [];
  const indexes = view.faceUp
    .map((card, i) => (secondDraw && card === 'locomotive' ? -1 : i))
    .filter((i) => i >= 0);
  if (indexes.length > 0) actions.push({ type: 'drawFaceUp', indexes });
  if (view.trainDeckSize + view.discardSize > 0) actions.push({ type: 'drawBlind' });
  return actions;
}

export function legalActions(view: PlayerView): LegalAction[] {
  switch (view.phase) {
    case 'setup':
      return view.me.pendingTickets.length > 0
        ? [{ type: 'chooseInitialTickets', minKeep: INITIAL_MIN_KEEP }]
        : [];
    case 'turnStart':
      if (view.currentPlayer !== view.me.id) return [];
      return [
        ...drawActions(view, false),
        { type: 'claimRoute', routes: claimableRoutes(view) },
        ...(view.ticketDeckSize > 0 ? [{ type: 'drawTickets' } as const] : []),
      ];
    case 'drewOne':
      if (view.currentPlayer !== view.me.id) return [];
      return drawActions(view, true);
    case 'choosingTickets':
      return view.currentPlayer === view.me.id && view.me.pendingTickets.length > 0
        ? [{ type: 'chooseTickets', minKeep: DRAW_MIN_KEEP }]
        : [];
    case 'finished':
      return [];
  }
}
