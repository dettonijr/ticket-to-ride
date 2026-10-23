import { describe, expect, it } from 'vitest';
import { apply } from '../apply';
import { legalActions } from '../legal';
import { createGame } from '../setup';
import type { GameState } from '../state';
import { redact } from '../view';

const seats = [
  { id: 'p1', name: 'Ann', colour: 'blue' as const },
  { id: 'p2', name: 'Bob', colour: 'red' as const },
];

function ok(result: ReturnType<typeof apply>): GameState {
  if (!result.ok) throw new Error(`expected ok, got ${result.violation.code}`);
  return result.state;
}

function player(state: GameState, id: string) {
  return state.players.find((p) => p.id === id)!;
}

/** A two-player game at turnStart with Ann to play. */
function playing(seed = 7): GameState {
  let state = createGame(seats, seed);
  for (const id of ['p1', 'p2']) {
    state = ok(
      apply(state, id, {
        type: 'chooseInitialTickets',
        keep: player(state, id).pendingTickets.map((t) => t.id),
      }),
    );
  }
  return state;
}

describe('drawTickets', () => {
  it('takes the top three tickets into pending and moves to choosingTickets', () => {
    const game = playing();
    const top = game.ticketDeck.slice(0, 3).map((t) => t.id);
    const next = ok(apply(game, 'p1', { type: 'drawTickets' }));
    expect(next.phase).toBe('choosingTickets');
    expect(next.currentPlayer).toBe('p1');
    expect(player(next, 'p1').pendingTickets.map((t) => t.id)).toEqual(top);
    expect(next.ticketDeck).toHaveLength(game.ticketDeck.length - 3);
  });

  it('takes what remains when fewer than three are left', () => {
    const game = { ...playing(), ticketDeck: playing().ticketDeck.slice(0, 2) };
    const next = ok(apply(game, 'p1', { type: 'drawTickets' }));
    expect(player(next, 'p1').pendingTickets).toHaveLength(2);
    expect(next.ticketDeck).toHaveLength(0);
  });

  it('is refused when the ticket deck is empty, and not offered as legal', () => {
    const game = { ...playing(), ticketDeck: [] };
    expect(apply(game, 'p1', { type: 'drawTickets' })).toMatchObject({
      ok: false,
      violation: { code: 'no-tickets' },
    });
    expect(legalActions(redact(game, 'p1')).some((a) => a.type === 'drawTickets')).toBe(false);
    expect(legalActions(redact(playing(), 'p1')).some((a) => a.type === 'drawTickets')).toBe(true);
  });

  it('is refused for a player whose turn it is not', () => {
    expect(apply(playing(), 'p2', { type: 'drawTickets' })).toMatchObject({
      ok: false,
      violation: { code: 'not-your-turn' },
    });
  });

  it('is refused outside turnStart', () => {
    const drawn = ok(apply(playing(), 'p1', { type: 'drawTickets' }));
    expect(apply(drawn, 'p1', { type: 'drawTickets' })).toMatchObject({
      ok: false,
      violation: { code: 'wrong-phase' },
    });
  });
});

describe('chooseTickets', () => {
  it('keeps at least one, returns the rest to the bottom, and passes the turn', () => {
    const game = playing();
    const drawn = ok(apply(game, 'p1', { type: 'drawTickets' }));
    const [a, b, c] = player(drawn, 'p1').pendingTickets.map((t) => t.id);
    const next = ok(apply(drawn, 'p1', { type: 'chooseTickets', keep: [b!] }));
    const ann = player(next, 'p1');
    expect(ann.pendingTickets).toEqual([]);
    expect(ann.tickets.map((t) => t.id)).toContain(b);
    expect(ann.tickets).toHaveLength(player(game, 'p1').tickets.length + 1);
    expect(next.ticketDeck.slice(-2).map((t) => t.id)).toEqual([a, c]);
    expect(next.phase).toBe('turnStart');
    expect(next.currentPlayer).toBe('p2');
    expect(next.lastAction).toEqual({
      playerId: 'p1',
      description: 'Ann drew tickets and kept 1',
    });
  });

  it('allows keeping all of them', () => {
    const drawn = ok(apply(playing(), 'p1', { type: 'drawTickets' }));
    const keep = player(drawn, 'p1').pendingTickets.map((t) => t.id);
    const next = ok(apply(drawn, 'p1', { type: 'chooseTickets', keep }));
    expect(player(next, 'p1').tickets).toHaveLength(6);
    expect(next.ticketDeck).toHaveLength(drawn.ticketDeck.length);
  });

  it('rejects keeping none', () => {
    const drawn = ok(apply(playing(), 'p1', { type: 'drawTickets' }));
    expect(apply(drawn, 'p1', { type: 'chooseTickets', keep: [] })).toMatchObject({
      ok: false,
      violation: { code: 'keep-too-few' },
    });
  });

  it('rejects a ticket not among the drawn ones', () => {
    const drawn = ok(apply(playing(), 'p1', { type: 'drawTickets' }));
    const owned = player(drawn, 'p1').tickets[0]!.id;
    expect(apply(drawn, 'p1', { type: 'chooseTickets', keep: [owned] })).toMatchObject({
      ok: false,
      violation: { code: 'unknown-ticket' },
    });
  });

  it('is refused from the wrong player or phase', () => {
    const drawn = ok(apply(playing(), 'p1', { type: 'drawTickets' }));
    expect(apply(drawn, 'p2', { type: 'chooseTickets', keep: [] })).toMatchObject({
      ok: false,
      violation: { code: 'not-your-turn' },
    });
    expect(apply(playing(), 'p1', { type: 'chooseTickets', keep: [] })).toMatchObject({
      ok: false,
      violation: { code: 'wrong-phase' },
    });
  });

  it('offers chooseTickets with a minimum of one while choosing', () => {
    const drawn = ok(apply(playing(), 'p1', { type: 'drawTickets' }));
    expect(legalActions(redact(drawn, 'p1'))).toEqual([{ type: 'chooseTickets', minKeep: 1 }]);
    expect(legalActions(redact(drawn, 'p2'))).toEqual([]);
  });

  it('never mutates the input state', () => {
    const drawn = ok(apply(playing(), 'p1', { type: 'drawTickets' }));
    const frozen = JSON.stringify(drawn);
    apply(drawn, 'p1', {
      type: 'chooseTickets',
      keep: [player(drawn, 'p1').pendingTickets[0]!.id],
    });
    expect(JSON.stringify(drawn)).toBe(frozen);
  });
});
