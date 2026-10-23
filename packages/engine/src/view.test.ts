import { describe, expect, it } from 'vitest';
import { createGame } from './setup';
import { redact } from './view';

const seats = [
  { id: 'p1', name: 'Ann', colour: 'blue' as const },
  { id: 'p2', name: 'Bob', colour: 'red' as const },
];

describe('redact', () => {
  it('gives a player their own hand and pending tickets', () => {
    const game = createGame(seats, 9);
    const view = redact(game, 'p1');
    expect(view.me.id).toBe('p1');
    expect(view.me.hand).toEqual(game.players[0]?.hand);
    expect(view.me.pendingTickets).toEqual(game.players[0]?.pendingTickets);
  });

  it('shows only public information about other players', () => {
    const game = createGame(seats, 9);
    const view = redact(game, 'p1');
    const bob = view.players.find((p) => p.id === 'p2');
    expect(bob).toEqual({
      id: 'p2',
      name: 'Bob',
      colour: 'red',
      score: 0,
      trainsLeft: 45,
      handSize: 4,
      ticketCount: 0,
    });
    const serialised = JSON.stringify(view);
    expect(serialised).not.toContain('"hand":' + JSON.stringify(game.players[1]?.hand));
    expect(Object.keys(bob ?? {})).not.toContain('hand');
    expect(Object.keys(bob ?? {})).not.toContain('tickets');
  });

  it('exposes deck sizes, the face-up row and the phase, not the deck itself', () => {
    const game = createGame(seats, 9);
    const view = redact(game, 'p2');
    expect(view.faceUp).toEqual(game.faceUp);
    expect(view.trainDeckSize).toBe(game.trainDeck.length);
    expect(view.ticketDeckSize).toBe(game.ticketDeck.length);
    expect(view.phase).toBe('setup');
    expect(view.currentPlayer).toBe('p1');
    expect('trainDeck' in view).toBe(false);
    expect('ticketDeck' in view).toBe(false);
  });

  it('rejects an unknown player', () => {
    expect(() => redact(createGame(seats, 1), 'nobody')).toThrow();
  });
});
