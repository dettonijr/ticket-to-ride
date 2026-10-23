import { finalScores } from './scoring/finalScore';
import type { GameState, LastAction } from './state';

/** A player ending a turn with this many trains or fewer triggers the final round. */
export const FINAL_ROUND_TRAINS = 2;

/**
 * Close the current player's turn and hand play to the next player.
 *
 * Shared by every action that ends a turn (second card draw, face-up
 * locomotive, claim, ticket choice). Handles the final-round rule: when the
 * player ending their turn has two or fewer trains and no final round is
 * running yet, every player including them gets exactly one more turn; once
 * those turns are used up the game is finished.
 */
export function endTurn(state: GameState, lastAction: LastAction): GameState {
  const order = state.turnOrder;
  const index = order.indexOf(state.currentPlayer);
  const next = order[(index + 1) % order.length] ?? state.currentPlayer;

  let { finalRoundTriggeredBy, turnsRemaining } = state;
  if (turnsRemaining !== undefined) {
    turnsRemaining -= 1;
  } else if (finalRoundTriggeredBy === undefined) {
    const me = state.players.find((p) => p.id === state.currentPlayer);
    if (me && me.trainsLeft <= FINAL_ROUND_TRAINS) {
      finalRoundTriggeredBy = me.id;
      turnsRemaining = order.length;
    }
  }

  const finished = turnsRemaining === 0;
  const result: GameState = {
    ...state,
    phase: finished ? 'finished' : 'turnStart',
    currentPlayer: finished ? state.currentPlayer : next,
    lastAction,
  };
  if (finalRoundTriggeredBy !== undefined) result.finalRoundTriggeredBy = finalRoundTriggeredBy;
  if (turnsRemaining !== undefined) result.turnsRemaining = turnsRemaining;
  if (finished) result.result = finalScores(result);
  return result;
}
