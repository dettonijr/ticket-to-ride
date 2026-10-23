import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { apply, createGame, redact, type GameState } from '@railyard/engine';
import { Summary } from './Summary';

const seats = [
  { id: 'p1', name: 'Ann', colour: 'blue' as const },
  { id: 'p2', name: 'Bob', colour: 'red' as const },
];

/** Play a tiny game to the end: Ann triggers the final round, both claim one-space routes. */
function finishedGame(): GameState {
  let state = createGame(seats, 11);
  for (const p of state.players) {
    const r = apply(state, p.id, {
      type: 'chooseInitialTickets',
      keep: p.pendingTickets.slice(0, 2).map((t) => t.id),
    });
    if (!r.ok) throw new Error(r.violation.message);
    state = r.state;
  }
  state = {
    ...state,
    players: state.players.map((p) =>
      p.id === 'p1' ? { ...p, trainsLeft: 3, hand: ['blue', 'blue'] } : { ...p, hand: ['red'] },
    ),
  };
  const claim = (s: GameState, who: string, routeId: string, card: 'blue' | 'red') => {
    const r = apply(s, who, { type: 'claimRoute', routeId, cards: [card] });
    if (!r.ok) throw new Error(r.violation.message);
    return r.state;
  };
  state = claim(state, 'p1', 'nashville-atlanta-1', 'blue');
  state = claim(state, 'p2', 'vancouver-seattle-1', 'red');
  state = claim(state, 'p1', 'seattle-portland-1', 'blue');
  if (state.phase !== 'finished') throw new Error('expected a finished game');
  return state;
}

describe('Summary screen', () => {
  it('shows the ranking, every player’s revealed tickets and the breakdown', () => {
    const state = finishedGame();
    const view = redact(state, 'p2');
    render(<Summary view={view} />);

    expect(screen.getByRole('heading', { name: /game over/i })).toBeInTheDocument();
    const ranking = screen.getByRole('list', { name: 'ranking' });
    const rows = within(ranking).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const result = state.result!;
    const winner = state.players.find((p) => p.id === result.winnerIds[0])!;
    expect(rows[0]).toHaveTextContent(winner.name);
    expect(rows[0]).toHaveTextContent('Winner');

    // Breakdown table has one column per player and the four scoring rows plus the total.
    const table = screen.getByRole('table', { name: 'score breakdown' });
    expect(within(table).getByText('Routes')).toBeInTheDocument();
    expect(within(table).getByText('Tickets completed')).toBeInTheDocument();
    expect(within(table).getByText('Tickets failed')).toBeInTheDocument();
    expect(within(table).getByText('Longest path')).toBeInTheDocument();
    expect(within(table).getByText('Total')).toBeInTheDocument();

    // Ann's tickets are revealed to Bob now that the game is over.
    const ann = state.players[0]!;
    for (const t of ann.tickets) {
      expect(screen.getByTestId(`ticket-${t.id}`)).toBeInTheDocument();
    }
    const annTotal = result.players.find((p) => p.playerId === 'p1')!.total;
    expect(screen.getByTestId('total-p1')).toHaveTextContent(String(annTotal));

    // The board is still there and the rematch button waits for the next ticket.
    expect(screen.getByRole('img', { name: /board/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rematch' })).toBeDisabled();
  });
});
