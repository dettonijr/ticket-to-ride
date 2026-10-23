import { describe, expect, it } from 'vitest';
import { apply } from './apply';
import { createGame } from './setup';
import type { GameState } from './state';

const seats = [
  { id: 'p1', name: 'Ann', colour: 'blue' as const },
  { id: 'p2', name: 'Bob', colour: 'red' as const },
  { id: 'p3', name: 'Cat', colour: 'green' as const },
];

function pending(state: GameState, playerId: string): string[] {
  return state.players.find((p) => p.id === playerId)!.pendingTickets.map((t) => t.id);
}

function ok(result: ReturnType<typeof apply>): GameState {
  if (!result.ok) throw new Error(`expected ok, got ${result.violation.code}`);
  return result.state;
}

describe('apply chooseInitialTickets', () => {
  it('rejects keeping fewer than two tickets', () => {
    const game = createGame(seats, 5);
    const [first] = pending(game, 'p1');
    const result = apply(game, 'p1', { type: 'chooseInitialTickets', keep: [first!] });
    expect(result).toMatchObject({ ok: false, violation: { code: 'keep-too-few' } });
  });

  it('rejects a ticket the player does not hold', () => {
    const game = createGame(seats, 5);
    const [a] = pending(game, 'p1');
    const [b] = pending(game, 'p2');
    const result = apply(game, 'p1', { type: 'chooseInitialTickets', keep: [a!, b!] });
    expect(result).toMatchObject({ ok: false, violation: { code: 'unknown-ticket' } });
  });

  it('keeps the chosen tickets and sends the rest to the bottom of the deck', () => {
    const game = createGame(seats, 5);
    const [a, b, c] = pending(game, 'p1');
    const next = ok(apply(game, 'p1', { type: 'chooseInitialTickets', keep: [a!, c!] }));
    const ann = next.players.find((p) => p.id === 'p1')!;
    expect(ann.tickets.map((t) => t.id)).toEqual([a, c]);
    expect(ann.pendingTickets).toEqual([]);
    expect(next.ticketDeck.at(-1)?.id).toBe(b);
    expect(next.ticketDeck).toHaveLength(game.ticketDeck.length + 1);
    expect(next.phase).toBe('setup');
  });

  it('allows keeping all three', () => {
    const game = createGame(seats, 5);
    const keep = pending(game, 'p1');
    const next = ok(apply(game, 'p1', { type: 'chooseInitialTickets', keep }));
    expect(next.players[0]!.tickets).toHaveLength(3);
    expect(next.ticketDeck).toHaveLength(game.ticketDeck.length);
  });

  it('rejects choosing twice', () => {
    const game = createGame(seats, 5);
    const keep = pending(game, 'p1');
    const next = ok(apply(game, 'p1', { type: 'chooseInitialTickets', keep }));
    const again = apply(next, 'p1', { type: 'chooseInitialTickets', keep });
    expect(again).toMatchObject({ ok: false, violation: { code: 'already-chosen' } });
  });

  it('rejects an unknown player', () => {
    const game = createGame(seats, 5);
    const result = apply(game, 'nobody', { type: 'chooseInitialTickets', keep: [] });
    expect(result).toMatchObject({ ok: false, violation: { code: 'unknown-player' } });
  });

  it('moves to turnStart only once everyone has chosen, in any order', () => {
    const game = createGame(seats, 5);
    let state = ok(
      apply(game, 'p3', { type: 'chooseInitialTickets', keep: pending(game, 'p3').slice(0, 2) }),
    );
    expect(state.phase).toBe('setup');
    state = ok(
      apply(state, 'p1', {
        type: 'chooseInitialTickets',
        keep: pending(state, 'p1').slice(0, 2),
      }),
    );
    expect(state.phase).toBe('setup');
    state = ok(
      apply(state, 'p2', {
        type: 'chooseInitialTickets',
        keep: pending(state, 'p2').slice(0, 2),
      }),
    );
    expect(state.phase).toBe('turnStart');
    expect(state.currentPlayer).toBe('p1');
  });

  it('records who acted last, without revealing the choice', () => {
    const game = createGame(seats, 5);
    const next = ok(
      apply(game, 'p2', { type: 'chooseInitialTickets', keep: pending(game, 'p2').slice(0, 2) }),
    );
    expect(next.lastAction).toEqual({ playerId: 'p2', description: 'Bob kept 2 tickets' });
  });

  it('never mutates the input state', () => {
    const game = createGame(seats, 5);
    const frozen = JSON.stringify(game);
    apply(game, 'p1', { type: 'chooseInitialTickets', keep: pending(game, 'p1') });
    expect(JSON.stringify(game)).toBe(frozen);
  });

  it('rejects setup actions outside setup, and turn actions during setup', () => {
    const game = createGame(seats, 5);
    expect(apply(game, 'p1', { type: 'drawBlind' })).toMatchObject({
      ok: false,
      violation: { code: 'wrong-phase' },
    });
    let state = game;
    for (const id of ['p1', 'p2', 'p3']) {
      state = ok(
        apply(state, id, { type: 'chooseInitialTickets', keep: pending(state, id).slice(0, 2) }),
      );
    }
    expect(apply(state, 'p1', { type: 'chooseInitialTickets', keep: [] })).toMatchObject({
      ok: false,
      violation: { code: 'wrong-phase' },
    });
  });

  it('reports turn actions as not implemented yet', () => {
    const game = createGame(seats, 5);
    let state = game;
    for (const id of ['p1', 'p2', 'p3']) {
      state = ok(
        apply(state, id, { type: 'chooseInitialTickets', keep: pending(state, id).slice(0, 2) }),
      );
    }
    expect(apply(state, 'p1', { type: 'drawBlind' })).toMatchObject({
      ok: false,
      violation: { code: 'not-implemented' },
    });
  });
});
