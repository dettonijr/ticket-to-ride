import type { Action, RuleViolation } from './actions';
import { INITIAL_TICKETS, type GameState, type PlayerId, type PlayerState } from './state';

export type ApplyResult = { ok: true; state: GameState } | { ok: false; violation: RuleViolation };

/** Minimum tickets to keep from the initial deal. */
export const INITIAL_MIN_KEEP = 2;
/** Minimum tickets to keep from a mid-game draw. */
export const DRAW_MIN_KEEP = 1;

function refuse(code: string, message: string): ApplyResult {
  return { ok: false, violation: { code, message } };
}

/**
 * The whole rulebook in one function: take the current game and one player's
 * action, return the new game or the rule it broke. Never mutates `state`.
 */
export function apply(state: GameState, playerId: PlayerId, action: Action): ApplyResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return refuse('unknown-player', 'You are not in this game');

  switch (action.type) {
    case 'chooseInitialTickets':
      return chooseInitialTickets(state, player, action.keep);
    case 'drawFaceUp':
    case 'drawBlind':
    case 'claimRoute':
    case 'drawTickets':
    case 'chooseTickets':
      if (state.phase === 'setup')
        return refuse('wrong-phase', 'Everyone has to choose their tickets first');
      return refuse('not-implemented', `${action.type} is not implemented yet`);
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
  const unknown = keep.find((id) => !player.pendingTickets.some((t) => t.id === id));
  if (unknown !== undefined) return refuse('unknown-ticket', 'That ticket is not yours to keep');
  const keepSet = new Set(keep);
  if (keepSet.size < INITIAL_MIN_KEEP)
    return refuse(
      'keep-too-few',
      `Keep at least ${INITIAL_MIN_KEEP} of your ${INITIAL_TICKETS} tickets`,
    );

  const kept = player.pendingTickets.filter((t) => keepSet.has(t.id));
  const returned = player.pendingTickets.filter((t) => !keepSet.has(t.id));

  const players = state.players.map((p) =>
    p.id === player.id ? { ...p, tickets: [...p.tickets, ...kept], pendingTickets: [] } : p,
  );
  const everyoneChosen = players.every((p) => p.pendingTickets.length === 0);

  return {
    ok: true,
    state: {
      ...state,
      players,
      ticketDeck: [...state.ticketDeck, ...returned],
      phase: everyoneChosen ? 'turnStart' : 'setup',
      currentPlayer: everyoneChosen
        ? (state.turnOrder[0] ?? state.currentPlayer)
        : state.currentPlayer,
      lastAction: {
        playerId: player.id,
        description: `${player.name} kept ${kept.length} ticket${kept.length === 1 ? '' : 's'}`,
      },
    },
  };
}
