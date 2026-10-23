import { describe, expect, it } from 'vitest';
import { apply } from '../apply';
import { ROUTE_BY_ID } from '../data/usa';
import { createGame } from '../setup';
import type { Card, GameState } from '../state';
import { claimOptions, ROUTE_POINTS } from './claimRoute';

const allSeats = [
  { id: 'p1', name: 'Ann', colour: 'blue' as const },
  { id: 'p2', name: 'Bob', colour: 'red' as const },
  { id: 'p3', name: 'Cat', colour: 'green' as const },
  { id: 'p4', name: 'Dan', colour: 'yellow' as const },
];

/** A game at turnStart with p1 to play, with the given hands dealt by fiat. */
function playing(hands: Record<string, Card[]>, playerCount = 2): GameState {
  const seats = allSeats.slice(0, playerCount);
  let state = createGame(seats, 11);
  for (const p of state.players) {
    const result = apply(state, p.id, {
      type: 'chooseInitialTickets',
      keep: p.pendingTickets.slice(0, 2).map((t) => t.id),
    });
    if (!result.ok) throw new Error(result.violation.message);
    state = result.state;
  }
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, hand: hands[p.id] ?? p.hand })),
  };
}

function ok(result: ReturnType<typeof apply>): GameState {
  if (!result.ok) throw new Error(`expected ok, got ${result.violation.code}`);
  return result.state;
}

function player(state: GameState, id: string) {
  return state.players.find((p) => p.id === id)!;
}

const DENVER_OMAHA = 'denver-omaha-1'; // purple, length 4
const KC_OKC_1 = 'kansas-city-oklahoma-city-1'; // grey, length 2, double
const KC_OKC_2 = 'kansas-city-oklahoma-city-2';
const NY_BOSTON_1 = 'new-york-boston-2'; // red, length 2, double
const NY_BOSTON_2 = 'new-york-boston-1'; // yellow, length 2

describe('claimRoute', () => {
  it('claims a coloured route with matching cards, scoring by length and spending trains', () => {
    const state = playing({ p1: ['purple', 'purple', 'purple', 'purple', 'blue'] });
    const next = ok(
      apply(state, 'p1', {
        type: 'claimRoute',
        routeId: DENVER_OMAHA,
        cards: ['purple', 'purple', 'purple', 'purple'],
      }),
    );
    const ann = player(next, 'p1');
    expect(next.claimed[DENVER_OMAHA]).toBe('p1');
    expect(ann.hand).toEqual(['blue']);
    expect(ann.trainsLeft).toBe(45 - 4);
    expect(ann.score).toBe(7);
    expect(next.discard.slice(-4)).toEqual(['purple', 'purple', 'purple', 'purple']);
    expect(next.phase).toBe('turnStart');
    expect(next.currentPlayer).toBe('p2');
    expect(next.lastAction).toEqual({ playerId: 'p1', description: 'Ann claimed Denver to Omaha' });
  });

  it('scores 1, 2, 4, 7, 10, 15 for lengths one to six', () => {
    expect(ROUTE_POINTS).toEqual({ 1: 1, 2: 2, 3: 4, 4: 7, 5: 10, 6: 15 });
  });

  it('rejects a route that does not exist', () => {
    const state = playing({ p1: ['purple'] });
    expect(
      apply(state, 'p1', { type: 'claimRoute', routeId: 'nowhere-1', cards: ['purple'] }),
    ).toMatchObject({ ok: false, violation: { code: 'unknown-route' } });
  });

  it('rejects a route already claimed', () => {
    const state = playing({ p1: ['purple', 'purple', 'purple', 'purple'] });
    const taken = { ...state, claimed: { [DENVER_OMAHA]: 'p2' } };
    expect(
      apply(taken, 'p1', {
        type: 'claimRoute',
        routeId: DENVER_OMAHA,
        cards: ['purple', 'purple', 'purple', 'purple'],
      }),
    ).toMatchObject({ ok: false, violation: { code: 'route-taken' } });
  });

  it('rejects a claim by a player whose turn it is not', () => {
    const state = playing({ p2: ['purple', 'purple', 'purple', 'purple'] });
    expect(
      apply(state, 'p2', {
        type: 'claimRoute',
        routeId: DENVER_OMAHA,
        cards: ['purple', 'purple', 'purple', 'purple'],
      }),
    ).toMatchObject({ ok: false, violation: { code: 'not-your-turn' } });
  });

  it('rejects a claim outside turnStart', () => {
    const state = {
      ...playing({ p1: ['purple', 'purple', 'purple', 'purple'] }),
      phase: 'drewOne' as const,
    };
    expect(
      apply(state, 'p1', {
        type: 'claimRoute',
        routeId: DENVER_OMAHA,
        cards: ['purple', 'purple', 'purple', 'purple'],
      }),
    ).toMatchObject({ ok: false, violation: { code: 'wrong-phase' } });
  });

  it('rejects the wrong number of cards', () => {
    const state = playing({ p1: ['purple', 'purple', 'purple', 'purple', 'purple'] });
    expect(
      apply(state, 'p1', {
        type: 'claimRoute',
        routeId: DENVER_OMAHA,
        cards: ['purple', 'purple', 'purple'],
      }),
    ).toMatchObject({ ok: false, violation: { code: 'wrong-card-count' } });
    expect(
      apply(state, 'p1', {
        type: 'claimRoute',
        routeId: DENVER_OMAHA,
        cards: ['purple', 'purple', 'purple', 'purple', 'purple'],
      }),
    ).toMatchObject({ ok: false, violation: { code: 'wrong-card-count' } });
  });

  it('rejects cards the player does not hold', () => {
    const state = playing({ p1: ['purple', 'purple', 'purple', 'blue'] });
    expect(
      apply(state, 'p1', {
        type: 'claimRoute',
        routeId: DENVER_OMAHA,
        cards: ['purple', 'purple', 'purple', 'purple'],
      }),
    ).toMatchObject({ ok: false, violation: { code: 'cards-not-held' } });
  });

  it('rejects a mixed-colour set', () => {
    const state = playing({ p1: ['red', 'yellow', 'locomotive'] });
    expect(
      apply(state, 'p1', { type: 'claimRoute', routeId: NY_BOSTON_1, cards: ['red', 'yellow'] }),
    ).toMatchObject({ ok: false, violation: { code: 'mixed-colours' } });
  });

  it('rejects a colour that does not match the route', () => {
    const state = playing({ p1: ['yellow', 'yellow'] });
    expect(
      apply(state, 'p1', { type: 'claimRoute', routeId: NY_BOSTON_1, cards: ['yellow', 'yellow'] }),
    ).toMatchObject({ ok: false, violation: { code: 'wrong-colour' } });
  });

  it('accepts locomotives standing in for any colour, alone or mixed with the colour', () => {
    const state = playing({ p1: ['red', 'locomotive', 'locomotive', 'locomotive'] });
    const mixed = ok(
      apply(state, 'p1', {
        type: 'claimRoute',
        routeId: NY_BOSTON_1,
        cards: ['red', 'locomotive'],
      }),
    );
    expect(mixed.claimed[NY_BOSTON_1]).toBe('p1');
    const alone = ok(
      apply(state, 'p1', {
        type: 'claimRoute',
        routeId: NY_BOSTON_1,
        cards: ['locomotive', 'locomotive'],
      }),
    );
    expect(player(alone, 'p1').hand).toEqual(['red', 'locomotive']);
  });

  it('lets a grey route take any single colour', () => {
    const state = playing({ p1: ['green', 'green', 'blue'] });
    const next = ok(
      apply(state, 'p1', { type: 'claimRoute', routeId: KC_OKC_1, cards: ['green', 'green'] }),
    );
    expect(next.claimed[KC_OKC_1]).toBe('p1');
    expect(player(next, 'p1').score).toBe(2);
  });

  it('rejects a claim when the player lacks enough trains', () => {
    const state = playing({ p1: ['purple', 'purple', 'purple', 'purple'] });
    const short = {
      ...state,
      players: state.players.map((p) => (p.id === 'p1' ? { ...p, trainsLeft: 3 } : p)),
    };
    expect(
      apply(short, 'p1', {
        type: 'claimRoute',
        routeId: DENVER_OMAHA,
        cards: ['purple', 'purple', 'purple', 'purple'],
      }),
    ).toMatchObject({ ok: false, violation: { code: 'not-enough-trains' } });
  });

  it('closes the twin of a double route to everyone in a 2 or 3 player game', () => {
    for (const count of [2, 3]) {
      const state = playing({ p1: ['green', 'green'], p2: ['blue', 'blue'] }, count);
      const next = ok(
        apply(state, 'p1', { type: 'claimRoute', routeId: KC_OKC_1, cards: ['green', 'green'] }),
      );
      expect(
        apply(next, 'p2', { type: 'claimRoute', routeId: KC_OKC_2, cards: ['blue', 'blue'] }),
      ).toMatchObject({ ok: false, violation: { code: 'twin-closed' } });
    }
  });

  it('lets another player take the twin in a 4 player game, but not the same player', () => {
    const state = playing({ p1: ['green', 'green', 'blue', 'blue'], p2: ['blue', 'blue'] }, 4);
    const first = ok(
      apply(state, 'p1', { type: 'claimRoute', routeId: KC_OKC_1, cards: ['green', 'green'] }),
    );
    const bobsTurn = ok(
      apply(first, 'p2', { type: 'claimRoute', routeId: KC_OKC_2, cards: ['blue', 'blue'] }),
    );
    expect(bobsTurn.claimed[KC_OKC_2]).toBe('p2');

    const annAgain = { ...first, currentPlayer: 'p1' };
    expect(
      apply(annAgain, 'p1', { type: 'claimRoute', routeId: KC_OKC_2, cards: ['blue', 'blue'] }),
    ).toMatchObject({ ok: false, violation: { code: 'own-twin' } });
  });

  it('triggers the final round when the claim leaves two or fewer trains', () => {
    const state = playing({ p1: ['purple', 'purple', 'purple', 'purple'] });
    const low = {
      ...state,
      players: state.players.map((p) => (p.id === 'p1' ? { ...p, trainsLeft: 6 } : p)),
    };
    const next = ok(
      apply(low, 'p1', {
        type: 'claimRoute',
        routeId: DENVER_OMAHA,
        cards: ['purple', 'purple', 'purple', 'purple'],
      }),
    );
    expect(next.finalRoundTriggeredBy).toBe('p1');
    expect(next.turnsRemaining).toBe(2);
  });

  it('never mutates the input state', () => {
    const state = playing({ p1: ['purple', 'purple', 'purple', 'purple'] });
    const frozen = JSON.stringify(state);
    apply(state, 'p1', {
      type: 'claimRoute',
      routeId: DENVER_OMAHA,
      cards: ['purple', 'purple', 'purple', 'purple'],
    });
    expect(JSON.stringify(state)).toBe(frozen);
  });
});

describe('claimOptions', () => {
  const nyBostonRed = ROUTE_BY_ID.get(NY_BOSTON_1)!;
  const nyBostonYellow = ROUTE_BY_ID.get(NY_BOSTON_2)!;
  const grey = ROUTE_BY_ID.get(KC_OKC_1)!;
  const denverOmaha = ROUTE_BY_ID.get(DENVER_OMAHA)!;

  it('offers nothing when the hand cannot pay', () => {
    expect(claimOptions(['red', 'blue'], nyBostonRed)).toEqual([]);
    expect(claimOptions(['yellow', 'yellow'], nyBostonRed)).toEqual([]);
  });

  it('offers the matching colour, using as few locomotives as possible', () => {
    expect(claimOptions(['red', 'red', 'locomotive'], nyBostonRed)).toEqual([['red', 'red']]);
    expect(claimOptions(['red', 'locomotive', 'locomotive'], nyBostonRed)).toEqual([
      ['red', 'locomotive'],
      ['locomotive', 'locomotive'],
    ]);
    expect(claimOptions(['locomotive', 'locomotive'], nyBostonYellow)).toEqual([
      ['locomotive', 'locomotive'],
    ]);
  });

  it('offers one option per usable colour on a grey route', () => {
    expect(claimOptions(['green', 'green', 'blue', 'blue', 'red'], grey)).toEqual([
      ['blue', 'blue'],
      ['green', 'green'],
    ]);
  });

  it('counts locomotives towards every colour on a grey route, and alone', () => {
    expect(claimOptions(['green', 'locomotive', 'locomotive'], grey)).toEqual([
      ['green', 'locomotive'],
      ['locomotive', 'locomotive'],
    ]);
    expect(claimOptions(['purple', 'purple', 'locomotive'], denverOmaha)).toEqual([]);
  });
});
