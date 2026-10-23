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
  /** Which face-up slots may be taken right now. */
  | { type: 'drawFaceUp'; indexes: number[] }
  | { type: 'drawBlind' }
  | { type: 'claimRoute' }
  | { type: 'drawTickets' };

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
      return [...drawActions(view, false), { type: 'claimRoute' }, { type: 'drawTickets' }];
    case 'drewOne':
      if (view.currentPlayer !== view.me.id) return [];
      return drawActions(view, true);
    case 'choosingTickets':
    case 'finished':
      return [];
  }
}
