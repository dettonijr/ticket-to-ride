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

  it('reveals every player’s tickets and the breakdown only once finished', () => {
    let state = createGame(seats, 11);
    for (const p of state.players) {
      const r = apply(state, p.id, {
        type: 'chooseInitialTickets',
        keep: p.pendingTickets.slice(0, 2).map((t) => t.id),
      });
      if (!r.ok) throw new Error(r.violation.message);
      state = r.state;
    }
    const bobTicket = state.players[1]!.tickets[0]!.id;
    // Ann is about to run out of trains; one-space claims end the game quickly.
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === 'p1' ? { ...p, trainsLeft: 3, hand: ['blue', 'blue'] } : { ...p, hand: ['red'] },
      ),
    };
    const claim = (s: typeof state, who: string, routeId: string, card: 'blue' | 'red') => {
      const r = apply(s, who, { type: 'claimRoute', routeId, cards: [card] });
      if (!r.ok) throw new Error(r.violation.message);
      return r.state;
    };
    state = claim(state, 'p1', 'nashville-atlanta-1', 'blue'); // triggers the final round
    expect(redact(state, 'p1').turnsRemaining).toBe(2);
    expect(redact(state, 'p1').finalRoundTriggeredBy).toBe('p1');
    expect(JSON.stringify(redact(state, 'p1'))).not.toContain(`"${bobTicket}"`);
    expect(redact(state, 'p1').result).toBeUndefined();

    state = claim(state, 'p2', 'vancouver-seattle-1', 'red');
    state = claim(state, 'p1', 'seattle-portland-1', 'blue');
    expect(state.phase).toBe('finished');
    const view = redact(state, 'p1');
    expect(view.result).toBeDefined();
    expect(view.turnsRemaining).toBe(0);
    expect(JSON.stringify(view.result)).toContain(`"${bobTicket}"`);
    expect(view.result?.players.map((p) => p.playerId).sort()).toEqual(['p1', 'p2']);
  });
});
