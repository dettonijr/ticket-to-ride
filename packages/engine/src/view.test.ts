import { describe, expect, it } from 'vitest';
import { apply } from './apply';
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

  it('never leaks another player’s hand or tickets, in setup or once play starts', () => {
    let state = createGame(seats, 11);
    const check = () => {
      for (const viewer of state.players) {
        const view = redact(state, viewer.id);
        const text = JSON.stringify(view);
        for (const other of state.players) {
          if (other.id === viewer.id) continue;
          for (const t of [...other.tickets, ...other.pendingTickets]) {
            expect(text).not.toContain(`"${t.id}"`);
          }
          expect(text).not.toContain(JSON.stringify(other.hand));
        }
      }
    };
    check();
    for (const p of state.players) {
      const result = apply(state, p.id, {
        type: 'chooseInitialTickets',
        keep: p.pendingTickets.slice(0, 2).map((t) => t.id),
      });
      if (!result.ok) throw new Error(result.violation.message);
      state = result.state;
      check();
    }
    expect(state.phase).toBe('turnStart');
    expect(redact(state, 'p1').waitingOn).toEqual([]);
    expect(redact(state, 'p1').lastAction?.description).toBe('Bob kept 2 tickets');
  });
});
