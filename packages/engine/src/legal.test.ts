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

  it('lists only the routes the current player can pay for and is allowed to take', () => {
    const base = chooseAll(createGame(seats, 3));
    const state: GameState = {
      ...base,
      claimed: { 'kansas-city-oklahoma-city-1': 'p2', 'new-york-boston-1': 'p2' },
      players: base.players.map((p) =>
        p.id === 'p1' ? { ...p, hand: ['green', 'green', 'locomotive'], trainsLeft: 2 } : p,
      ),
    };
    const claim = legalActions(redact(state, 'p1')).find((a) => a.type === 'claimRoute');
    if (!claim || claim.type !== 'claimRoute') throw new Error('expected claimRoute');
    // Green or grey routes of length ≤ 2 (two trains left) that are open and whose twin is not
    // closed by the two-player rule.
    expect(claim.routes).toContain('duluth-omaha-1');
    expect(claim.routes).toContain('saint-louis-chicago-1');
    expect(claim.routes).not.toContain('kansas-city-oklahoma-city-2'); // twin closed
    expect(claim.routes).not.toContain('new-york-boston-2'); // red, twin closed anyway
    expect(claim.routes).not.toContain('denver-omaha-1'); // purple, length 4
    expect(claim.routes).not.toContain('new-orleans-little-rock-1'); // green but length 3
    expect(claim.routes.every((id) => !state.claimed[id])).toBe(true);
  });
});
