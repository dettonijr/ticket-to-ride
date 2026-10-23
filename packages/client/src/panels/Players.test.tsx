import { cleanup, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createGame, redact } from '@railyard/engine';
import { Players } from './Players';

const seats = [
  { id: 'p1', name: 'Ann', colour: 'blue' as const },
  { id: 'p2', name: 'Bob', colour: 'red' as const },
];

describe('Players panel', () => {
  it('marks a player who has dropped their connection', () => {
    const view = redact(createGame(seats, 5), 'p1');
    render(<Players view={view} presence={{ p1: true, p2: false }} />);
    const bob = screen.getByTestId('player-p2');
    expect(bob).toHaveClass('disconnected');
    expect(bob).toHaveTextContent('disconnected');
    expect(screen.getByTestId('player-p1')).not.toHaveTextContent('disconnected');
  });

  it('says "your turn" on the viewer’s own row and "their turn" on others', () => {
    const game = createGame(seats, 5);
    const playing = { ...game, phase: 'turnStart' as const, currentPlayer: 'p1' };
    render(<Players view={redact(playing, 'p1')} />);
    expect(screen.getByTestId('player-p1')).toHaveTextContent('your turn');
    expect(screen.getByTestId('player-p1')).not.toHaveTextContent('their turn');
    cleanup();
    render(<Players view={redact(playing, 'p2')} />);
    expect(screen.getByTestId('player-p1')).toHaveTextContent('their turn');
  });

  it('treats everyone as connected when no presence is known', () => {
    const view = redact(createGame(seats, 5), 'p1');
    render(<Players view={view} />);
    expect(screen.queryByText('disconnected')).not.toBeInTheDocument();
  });
});
