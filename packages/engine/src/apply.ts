import type { Action } from './actions';
import { claimRoute } from './rules/claimRoute';
import { drawBlind, drawFaceUp } from './rules/drawCards';
import { chooseTickets, drawTickets } from './rules/drawTickets';
import { keepFromPending } from './rules/keepTickets';
import { INITIAL_TICKETS, type GameState, type PlayerId, type PlayerState } from './state';
import { refuse, type ApplyResult } from './violation';

export type { ApplyResult } from './violation';

/** Minimum tickets to keep from the initial deal. */
export const INITIAL_MIN_KEEP = 2;
export { DRAW_MIN_KEEP } from './rules/drawTickets';

/**
 * The whole rulebook in one function: take the current game and one player's
 * action, return the new game or the rule it broke. Never mutates `state`.
 */
export function apply(state: GameState, playerId: PlayerId, action: Action): ApplyResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return refuse('unknown-player', 'You are not in this game');

  if (action.type !== 'chooseInitialTickets' && state.phase === 'setup')
    return refuse('wrong-phase', 'Everyone has to choose their tickets first');

  switch (action.type) {
    case 'chooseInitialTickets':
      return chooseInitialTickets(state, player, action.keep);
    case 'drawFaceUp':
      return drawFaceUp(state, player, action.index);
    case 'drawBlind':
      return drawBlind(state, player);
    case 'claimRoute':
      return claimRoute(state, player, action.routeId, action.cards);
    case 'drawTickets':
      return drawTickets(state, player);
    case 'chooseTickets':
      return chooseTickets(state, player, action.keep);
  }
}

function chooseInitialTickets(
  state: GameState,
  player: PlayerState,
  keep: readonly string[],
): ApplyResult {
  if (state.phase !== 'setup') return refuse('wrong-phase', 'The game has already started');
  if (player.pendingTickets.length === 0)
    return refuse('already-chosen', 'You have already chosen your tickets');
  const chosen = keepFromPending(
    state,
    player,
    keep,
    INITIAL_MIN_KEEP,
    `Keep at least ${INITIAL_MIN_KEEP} of your ${INITIAL_TICKETS} tickets`,
  );
  if (!chosen.ok) return chosen;

  const everyoneChosen = chosen.state.players.every((p) => p.pendingTickets.length === 0);
  const kept = chosen.kept.length;
  return {
    ok: true,
    state: {
      ...chosen.state,
      phase: everyoneChosen ? 'turnStart' : 'setup',
      currentPlayer: everyoneChosen
        ? (state.turnOrder[0] ?? state.currentPlayer)
        : state.currentPlayer,
      lastAction: {
        playerId: player.id,
        description: `${player.name} kept ${kept} ticket${kept === 1 ? '' : 's'}`,
      },
    },
  };
}
