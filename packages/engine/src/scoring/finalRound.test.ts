import { describe, expect, it } from 'vitest';
import { apply } from '../apply';
import { createGame } from '../setup';
import type { Card, GameState, PlayerId } from '../state';

const seats = [
  { id: 'p1', name: 'Ann', colour: 'blue' as const },
  { id: 'p2', name: 'Bob', colour: 'red' as const },
  { id: 'p3', name: 'Cat', colour: 'green' as const },
];

/** Three players at turnStart, each holding plenty of blue cards; trains by fiat. */
function playing(trains: Record<PlayerId, number>): GameState {
  let state = createGame(seats, 7);
  for (const p of state.players) {
    const r = apply(state, p.id, {
      type: 'chooseInitialTickets',
      keep: p.pendingTickets.slice(0, 2).map((t) => t.id),
    });
    if (!r.ok) throw new Error(r.violation.message);
    state = r.state;
  }
  const hand: Card[] = ['blue', 'blue', 'blue', 'blue', 'blue', 'blue'];
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, hand, trainsLeft: trains[p.id] ?? 45 })),
  };
}

// One-space grey routes, one per claim so no twin rules get in the way.
const ONE_SPACE = [
  'nashville-atlanta-1',
  'vancouver-seattle-1',
  'seattle-portland-1',
  'dallas-houston-1',
  'omaha-kansas-city-1',
  'vancouver-seattle-2',
  'seattle-portland-2',
];

function claim(state: GameState, who: PlayerId, routeId: string): GameState {
  const r = apply(state, who, { type: 'claimRoute', routeId, cards: ['blue'] });
  if (!r.ok) throw new Error(`${who} ${routeId}: ${r.violation.message}`);
  return r.state;
}

describe('the final round through apply', () => {
  it('triggered by the first player in turn order, ends after the other two and the first again', () => {
    let s = playing({ p1: 3 });
    s = claim(s, 'p1', ONE_SPACE[0]!); // Ann drops to 2: final round begins
    expect(s.finalRoundTriggeredBy).toBe('p1');
    expect(s.phase).toBe('turnStart');
    s = claim(s, 'p2', ONE_SPACE[1]!);
    s = claim(s, 'p3', ONE_SPACE[2]!);
    expect(s.phase).toBe('turnStart');
    expect(s.currentPlayer).toBe('p1');
    s = claim(s, 'p1', ONE_SPACE[3]!); // Ann's one last turn
    expect(s.phase).toBe('finished');
    expect(s.result?.players.find((p) => p.playerId === 'p1')?.routePoints).toBe(2);
    expect(apply(s, 'p2', { type: 'drawBlind' })).toMatchObject({ ok: false });
  });

  it('triggered by the last player in turn order, gives everyone one more turn in order', () => {
    let s = playing({ p3: 2 });
    s = claim(s, 'p1', ONE_SPACE[0]!);
    s = claim(s, 'p2', ONE_SPACE[1]!);
    s = claim(s, 'p3', ONE_SPACE[2]!); // Cat drops to 1: final round begins
    expect(s.finalRoundTriggeredBy).toBe('p3');
    expect(s.turnsRemaining).toBe(3);
    s = claim(s, 'p1', ONE_SPACE[3]!);
    s = claim(s, 'p2', ONE_SPACE[4]!);
    expect(s.phase).toBe('turnStart');
    expect(s.currentPlayer).toBe('p3');
    const draw = apply(s, 'p3', { type: 'drawBlind' });
    if (!draw.ok) throw new Error(draw.violation.message);
    const second = apply(draw.state, 'p3', { type: 'drawBlind' });
    if (!second.ok) throw new Error(second.violation.message);
    expect(second.state.phase).toBe('finished');
    expect(second.state.result?.ranking).toHaveLength(3);
  });

  it('is not re-triggered when a second player also runs low during it', () => {
    let s = playing({ p1: 3, p2: 3 });
    s = claim(s, 'p1', ONE_SPACE[0]!);
    s = claim(s, 'p2', ONE_SPACE[1]!); // Bob also at 2, but the round is already running
    expect(s.finalRoundTriggeredBy).toBe('p1');
    expect(s.turnsRemaining).toBe(2);
  });
});
