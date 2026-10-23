import type { GameState, PlayerState, TicketId } from '../state';
import { endTurn } from '../turn';
import { refuse, type ApplyResult } from '../violation';
import { keepFromPending } from './keepTickets';

/** Tickets drawn in one mid-game draw. */
export const TICKETS_PER_DRAW = 3;
/** Minimum tickets to keep from a mid-game draw. */
export const DRAW_MIN_KEEP = 1;

/**
 * Draw up to three tickets from the top of the ticket deck into the player's
 * pending tickets. The turn continues in `choosingTickets` until they choose.
 */
export function drawTickets(state: GameState, player: PlayerState): ApplyResult {
  if (state.phase !== 'turnStart') return refuse('wrong-phase', 'You cannot draw tickets now');
  if (state.currentPlayer !== player.id) return refuse('not-your-turn', 'It is not your turn');
  if (state.ticketDeck.length === 0) return refuse('no-tickets', 'The ticket deck is empty');

  const drawn = state.ticketDeck.slice(0, TICKETS_PER_DRAW);
  return {
    ok: true,
    state: {
      ...state,
      phase: 'choosingTickets',
      ticketDeck: state.ticketDeck.slice(drawn.length),
      players: state.players.map((p) => (p.id === player.id ? { ...p, pendingTickets: drawn } : p)),
      lastAction: { playerId: player.id, description: `${player.name} is drawing tickets` },
    },
  };
}

/**
 * Keep at least one of the drawn tickets; the rest go to the bottom of the
 * deck. Ends the turn.
 */
export function chooseTickets(
  state: GameState,
  player: PlayerState,
  keep: readonly TicketId[],
): ApplyResult {
  if (state.phase !== 'choosingTickets')
    return refuse('wrong-phase', 'You have no tickets to choose from');
  if (state.currentPlayer !== player.id) return refuse('not-your-turn', 'It is not your turn');
  const chosen = keepFromPending(state, player, keep, DRAW_MIN_KEEP, 'Keep at least one ticket');
  if (!chosen.ok) return chosen;
  return {
    ok: true,
    state: endTurn(chosen.state, {
      playerId: player.id,
      description: `${player.name} drew tickets and kept ${chosen.kept.length}`,
    }),
  };
}
