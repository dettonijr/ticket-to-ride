import { describe, expect, it } from 'vitest';
import { apply } from './apply';
import { legalActions } from './legal';
import { createGame } from './setup';
import type { GameState } from './state';
import { redact } from './view';

const seats = [
  { id: 'p1', name: 'Ann', colour: 'blue' as const },
  { id: 'p2', name: 'Bob', colour: 'red' as const },
];

function chooseAll(game: GameState): GameState {
  let state = game;
  for (const p of game.players) {
    const result = apply(state, p.id, {
      type: 'chooseInitialTickets',
      keep: p.pendingTickets.slice(0, 2).map((t) => t.id),
    });
    if (!result.ok) throw new Error(result.violation.message);
    state = result.state;
  }
  return state;
}

describe('legalActions', () => {
  it('offers only the initial ticket choice during setup, to players who still hold pending tickets', () => {
    const game = createGame(seats, 3);
    expect(legalActions(redact(game, 'p1'))).toEqual([
      { type: 'chooseInitialTickets', minKeep: 2 },
    ]);
    const result = apply(game, 'p1', {
      type: 'chooseInitialTickets',
      keep: game.players[0]!.pendingTickets.slice(0, 2).map((t) => t.id),
    });
    if (!result.ok) throw new Error('unexpected');
    expect(legalActions(redact(result.state, 'p1'))).toEqual([]);
    expect(legalActions(redact(result.state, 'p2'))).toEqual([
      { type: 'chooseInitialTickets', minKeep: 2 },
    ]);
  });

  it('offers the turn actions to the current player at turnStart and nothing to the others', () => {
    const state = chooseAll(createGame(seats, 3));
    expect(legalActions(redact(state, 'p1')).map((a) => a.type)).toEqual([
      'drawFaceUp',
      'drawBlind',
      'claimRoute',
      'drawTickets',
    ]);
    expect(legalActions(redact(state, 'p2'))).toEqual([]);
  });
});
