import { describe, expect, it } from 'vitest';
import { apply, type ApplyResult } from '../apply';
import { legalActions } from '../legal';
import { createGame } from '../setup';
import type { Card, GameState } from '../state';
import { redact } from '../view';

const seats = [
  { id: 'p1', name: 'Ann', colour: 'blue' as const },
  { id: 'p2', name: 'Bob', colour: 'red' as const },
];

/** A two-player game at Ann's turnStart, with the table set exactly as given. */
function table(
  overrides: Partial<Pick<GameState, 'faceUp' | 'trainDeck' | 'discard' | 'phase'>> = {},
): GameState {
  const game = createGame(seats, 7);
  return {
    ...game,
    phase: 'turnStart',
    players: game.players.map((p) => ({ ...p, pendingTickets: [], hand: [] })),
    faceUp: ['blue', 'red', 'green', 'yellow', 'black'],
    trainDeck: ['purple', 'orange', 'white', 'blue', 'red', 'green'],
    discard: [],
    ...overrides,
  };
}

function ok(result: ApplyResult): GameState {
  if (!result.ok) throw new Error(`expected ok, got ${result.violation.code}`);
  return result.state;
}

function hand(state: GameState, id = 'p1'): Card[] {
  return state.players.find((p) => p.id === id)!.hand;
}

describe('drawing train cards', () => {
  it('a face-up card goes to the hand, is replaced from the deck, and leaves the player at drewOne', () => {
    const next = ok(apply(table(), 'p1', { type: 'drawFaceUp', index: 1 }));
    expect(hand(next)).toEqual(['red']);
    expect(next.faceUp).toEqual(['blue', 'green', 'yellow', 'black', 'purple']);
    expect(next.trainDeck).toEqual(['orange', 'white', 'blue', 'red', 'green']);
    expect(next.phase).toBe('drewOne');
    expect(next.currentPlayer).toBe('p1');
    expect(next.lastAction).toEqual({ playerId: 'p1', description: 'Ann took a red card' });
  });

  it('a blind card goes to the hand without saying what it was', () => {
    const next = ok(apply(table(), 'p1', { type: 'drawBlind' }));
    expect(hand(next)).toEqual(['purple']);
    expect(next.trainDeck).toEqual(['orange', 'white', 'blue', 'red', 'green']);
    expect(next.phase).toBe('drewOne');
    expect(next.lastAction).toEqual({
      playerId: 'p1',
      description: 'Ann drew a card from the deck',
    });
  });

  it('the second draw ends the turn and passes play on', () => {
    const one = ok(apply(table(), 'p1', { type: 'drawBlind' }));
    const two = ok(apply(one, 'p1', { type: 'drawFaceUp', index: 0 }));
    expect(hand(two)).toEqual(['purple', 'blue']);
    expect(two.phase).toBe('turnStart');
    expect(two.currentPlayer).toBe('p2');
  });

  it('taking a face-up locomotive is the whole draw', () => {
    const next = ok(
      apply(table({ faceUp: ['locomotive', 'red', 'green', 'yellow', 'black'] }), 'p1', {
        type: 'drawFaceUp',
        index: 0,
      }),
    );
    expect(hand(next)).toEqual(['locomotive']);
    expect(next.phase).toBe('turnStart');
    expect(next.currentPlayer).toBe('p2');
    expect(next.lastAction?.description).toBe('Ann took a locomotive');
  });

  it('a face-up locomotive cannot be taken as the second card', () => {
    const one = ok(
      apply(table({ faceUp: ['blue', 'locomotive', 'green', 'yellow', 'black'] }), 'p1', {
        type: 'drawFaceUp',
        index: 0,
      }),
    );
    expect(one.faceUp[0]).toBe('locomotive');
    const result = apply(one, 'p1', { type: 'drawFaceUp', index: 0 });
    expect(result).toMatchObject({ ok: false, violation: { code: 'locomotive-second-draw' } });
  });

  it('a locomotive drawn blind counts as one card, so the second draw remains', () => {
    const next = ok(
      apply(table({ trainDeck: ['locomotive', 'orange'] }), 'p1', { type: 'drawBlind' }),
    );
    expect(hand(next)).toEqual(['locomotive']);
    expect(next.phase).toBe('drewOne');
  });

  it('three face-up locomotives, even after a replacement, discard the row and deal five new', () => {
    const start = table({
      faceUp: ['locomotive', 'locomotive', 'blue', 'green', 'yellow'],
      trainDeck: ['locomotive', 'red', 'orange', 'white', 'purple', 'black', 'blue'],
    });
    const next = ok(apply(start, 'p1', { type: 'drawFaceUp', index: 2 }));
    expect(hand(next)).toEqual(['blue']);
    // The replacement was a locomotive, making three: the row of five went to the discard.
    expect(next.discard).toHaveLength(5);
    expect(next.discard.filter((c) => c === 'locomotive')).toHaveLength(3);
    expect(next.faceUp).toEqual(['red', 'orange', 'white', 'purple', 'black']);
    expect(next.trainDeck).toEqual(['blue']);
  });

  it('an empty deck reshuffles the discards before a blind draw', () => {
    const start = table({ trainDeck: [], discard: ['white', 'white', 'white'] });
    const next = ok(apply(start, 'p1', { type: 'drawBlind' }));
    expect(hand(next)).toEqual(['white']);
    expect(next.discard).toEqual([]);
    expect(next.trainDeck).toHaveLength(2);
  });

  it('with deck and discards both empty, a blind draw is refused and not offered', () => {
    const start = table({ trainDeck: [], discard: [] });
    expect(apply(start, 'p1', { type: 'drawBlind' })).toMatchObject({
      ok: false,
      violation: { code: 'deck-empty' },
    });
    const legal = legalActions(redact(start, 'p1'));
    expect(legal.some((a) => a.type === 'drawBlind')).toBe(false);
    expect(legal.some((a) => a.type === 'drawFaceUp')).toBe(true);
  });

  it('a face-up draw with an empty supply leaves a shorter row and still works', () => {
    const start = table({ faceUp: ['blue', 'red'], trainDeck: [], discard: [] });
    const next = ok(apply(start, 'p1', { type: 'drawFaceUp', index: 1 }));
    expect(next.faceUp).toEqual(['blue']);
    expect(hand(next)).toEqual(['red']);
    expect(next.phase).toBe('drewOne');
  });

  it('ends the turn after the first draw when no second draw is possible', () => {
    const start = table({ faceUp: ['blue', 'locomotive'], trainDeck: [], discard: [] });
    const next = ok(apply(start, 'p1', { type: 'drawFaceUp', index: 0 }));
    expect(next.phase).toBe('turnStart');
    expect(next.currentPlayer).toBe('p2');
  });

  it('refuses an index outside the face-up row', () => {
    expect(apply(table(), 'p1', { type: 'drawFaceUp', index: 5 })).toMatchObject({
      ok: false,
      violation: { code: 'bad-index' },
    });
  });

  it('only the current player may draw, and only in a drawing phase', () => {
    expect(apply(table(), 'p2', { type: 'drawBlind' })).toMatchObject({
      ok: false,
      violation: { code: 'not-your-turn' },
    });
    expect(apply(table({ phase: 'choosingTickets' }), 'p1', { type: 'drawBlind' })).toMatchObject({
      ok: false,
      violation: { code: 'wrong-phase' },
    });
  });

  it('never mutates the input state', () => {
    const start = table();
    const frozen = JSON.stringify(start);
    apply(start, 'p1', { type: 'drawFaceUp', index: 0 });
    apply(start, 'p1', { type: 'drawBlind' });
    expect(JSON.stringify(start)).toBe(frozen);
  });
});

describe('legalActions for drawing', () => {
  it('at turnStart offers every face-up card and the deck to the current player only', () => {
    const start = table();
    const mine = legalActions(redact(start, 'p1'));
    expect(mine).toContainEqual({ type: 'drawFaceUp', indexes: [0, 1, 2, 3, 4] });
    expect(mine).toContainEqual({ type: 'drawBlind' });
    expect(legalActions(redact(start, 'p2'))).toEqual([]);
  });

  it('at drewOne offers only the second draw, without face-up locomotives', () => {
    const one = ok(
      apply(table({ faceUp: ['blue', 'locomotive', 'green', 'yellow', 'black'] }), 'p1', {
        type: 'drawBlind',
      }),
    );
    const legal = legalActions(redact(one, 'p1'));
    expect(legal).toContainEqual({ type: 'drawFaceUp', indexes: [0, 2, 3, 4] });
    expect(legal).toContainEqual({ type: 'drawBlind' });
    expect(legal.some((a) => a.type === 'claimRoute' || a.type === 'drawTickets')).toBe(false);
  });
});
