import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apply, createGame, redact, type GameState } from '@railyard/engine';
import { client } from '../ws';
import { Game } from './Game';

const seats = [
  { id: 'p1', name: 'Ann', colour: 'blue' as const },
  { id: 'p2', name: 'Bob', colour: 'red' as const },
];

function chooseAll(game: GameState): GameState {
  let state = game;
  for (const p of game.players) {
    const r = apply(state, p.id, {
      type: 'chooseInitialTickets',
      keep: p.pendingTickets.slice(0, 2).map((t) => t.id),
    });
    if (!r.ok) throw new Error(r.violation.message);
    state = r.state;
  }
  return state;
}

afterEach(() => vi.restoreAllMocks());

describe('Game screen', () => {
  it('shows the ticket choice during setup and sends the choice', () => {
    const send = vi.spyOn(client, 'send').mockImplementation(() => {});
    const game = createGame(seats, 21);
    render(<Game view={redact(game, 'p1')} />);
    expect(screen.getByRole('dialog', { name: 'Choose your tickets' })).toBeInTheDocument();
    const boxes = screen.getAllByRole('checkbox');
    fireEvent.click(boxes[0]!);
    fireEvent.click(boxes[1]!);
    fireEvent.click(screen.getByRole('button', { name: /keep 2/i }));
    expect(send).toHaveBeenCalledWith({
      type: 'action',
      action: {
        type: 'chooseInitialTickets',
        keep: game.players[0]!.pendingTickets.slice(0, 2).map((t) => t.id),
      },
    });
  });

  it('tells a player who has chosen who they are waiting for', () => {
    const game = createGame(seats, 21);
    const r = apply(game, 'p1', {
      type: 'chooseInitialTickets',
      keep: game.players[0]!.pendingTickets.map((t) => t.id),
    });
    if (!r.ok) throw new Error('unexpected');
    render(<Game view={redact(r.state, 'p1')} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for Bob to choose tickets.');
    expect(screen.getByText('Your tickets (3)')).toBeInTheDocument();
  });

  it('shows the full table once play starts, with the current player marked', () => {
    const state = chooseAll(createGame(seats, 21));
    render(<Game view={redact(state, 'p2')} />);
    expect(screen.getByText('Your hand (4)')).toBeInTheDocument();
    expect(screen.getByText('Your tickets (2)')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^face-up/ })).toHaveLength(5);
    expect(screen.getByTestId('player-p1')).toHaveClass('current');
    expect(screen.getByTestId('player-p1')).toHaveTextContent('their turn');
    expect(screen.queryByText('Your turn.')).not.toBeInTheDocument();
    expect(screen.getByText('Bob kept 2 tickets')).toBeInTheDocument();
    // Not Bob's turn: nothing on the table is clickable.
    for (const b of screen.getAllByRole('button', { name: /^face-up|^train deck/ })) {
      expect(b).toBeDisabled();
    }
  });

  it('lets the current player draw, and asks for one more card after the first', () => {
    const send = vi.spyOn(client, 'send').mockImplementation(() => {});
    const state = chooseAll(createGame(seats, 21));
    const { unmount } = render(<Game view={redact(state, 'p1')} />);
    expect(screen.getByRole('status')).toHaveTextContent('Your turn.');
    fireEvent.click(screen.getByRole('button', { name: /^train deck/ }));
    expect(send).toHaveBeenCalledWith({ type: 'action', action: { type: 'drawBlind' } });
    unmount();

    const r = apply(state, 'p1', { type: 'drawBlind' });
    if (!r.ok) throw new Error(r.violation.message);
    render(<Game view={redact(r.state, 'p1')} />);
    expect(screen.getByRole('status')).toHaveTextContent('Your turn: draw one more card.');
    expect(screen.getByRole('button', { name: /^train deck/ })).toBeEnabled();
  });
});
