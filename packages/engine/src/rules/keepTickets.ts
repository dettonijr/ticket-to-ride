import type { GameState, PlayerState, Ticket, TicketId } from '../state';
import { refuse, type Refusal } from '../violation';

/**
 * The shared shape of both ticket choices: keep at least `minKeep` of the
 * player's pending tickets, move them into their hand of tickets, and send the
 * rest to the bottom of the ticket deck. Returns the state before any phase
 * change, plus what was kept, or the rule that was broken.
 */
export function keepFromPending(
  state: GameState,
  player: PlayerState,
  keep: readonly TicketId[],
  minKeep: number,
  tooFewMessage: string,
): { ok: true; state: GameState; kept: Ticket[] } | Refusal {
  const unknown = keep.find((id) => !player.pendingTickets.some((t) => t.id === id));
  if (unknown !== undefined) return refuse('unknown-ticket', 'That ticket is not yours to keep');
  const keepSet = new Set(keep);
  if (keepSet.size < minKeep) return refuse('keep-too-few', tooFewMessage);

  const kept = player.pendingTickets.filter((t) => keepSet.has(t.id));
  const returned = player.pendingTickets.filter((t) => !keepSet.has(t.id));
  return {
    ok: true,
    kept,
    state: {
      ...state,
      ticketDeck: [...state.ticketDeck, ...returned],
      players: state.players.map((p) =>
        p.id === player.id ? { ...p, tickets: [...p.tickets, ...kept], pendingTickets: [] } : p,
      ),
    },
  };
}
