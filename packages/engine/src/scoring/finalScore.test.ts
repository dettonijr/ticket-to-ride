import { describe, expect, it } from 'vitest';
import { TICKET_BY_ID } from '../data/usa';
import { createGame } from '../setup';
import type { GameState, PlayerId, RouteId, Ticket } from '../state';
import { finalScores, LONGEST_PATH_BONUS, longestPath } from './finalScore';

const seats = [
  { id: 'p1', name: 'Ann', colour: 'blue' as const },
  { id: 'p2', name: 'Bob', colour: 'red' as const },
  { id: 'p3', name: 'Cat', colour: 'green' as const },
];

/** A finished game built by fiat: who claimed what, who holds which tickets, route points. */
function finished(
  claimed: Record<RouteId, PlayerId>,
  tickets: Record<PlayerId, Ticket[]> = {},
  routePoints: Record<PlayerId, number> = {},
  playerCount = 3,
): GameState {
  const game = createGame(seats.slice(0, playerCount), 5);
  return {
    ...game,
    phase: 'finished',
    claimed,
    players: game.players.map((p) => ({
      ...p,
      pendingTickets: [],
      tickets: tickets[p.id] ?? [],
      score: routePoints[p.id] ?? 0,
    })),
  };
}

const ticket = (id: string): Ticket => {
  const t = TICKET_BY_ID.get(id);
  if (!t) throw new Error(`no ticket ${id}`);
  return t;
};

// Routes around Atlanta used by these tests (all lengths from the board).
const NASHVILLE_ATLANTA = 'nashville-atlanta-1'; // 1
const ATLANTA_CHARLESTON = 'atlanta-charleston-1'; // 2
const RALEIGH_CHARLESTON = 'raleigh-charleston-1'; // 2
const NASHVILLE_RALEIGH = 'nashville-raleigh-1'; // 3
const ATLANTA_RALEIGH = 'atlanta-raleigh-1'; // 2
const ATLANTA_MIAMI = 'atlanta-miami-1'; // 5
const NEW_YORK_ATLANTA = 't04'; // New York to Atlanta, 6 points
const TORONTO_MIAMI = 't08'; // 10 points

describe('longestPath', () => {
  it('is zero for a player with no routes', () => {
    expect(longestPath({}, 'p1')).toBe(0);
  });

  it('adds up a simple chain in spaces', () => {
    // Nashville -1- Atlanta -2- Charleston
    expect(longestPath({ [NASHVILLE_ATLANTA]: 'p1', [ATLANTA_CHARLESTON]: 'p1' }, 'p1')).toBe(3);
  });

  it('ignores other players’ routes', () => {
    expect(longestPath({ [NASHVILLE_ATLANTA]: 'p1', [ATLANTA_CHARLESTON]: 'p2' }, 'p1')).toBe(1);
  });

  it('follows a loop through a city twice but never reuses a route', () => {
    // Cycle Nashville -1- Atlanta -2- Charleston -2- Raleigh -3- Nashville, plus a 5-space spur
    // Atlanta -5- Miami. Best path: Miami -5- Atlanta -2- Charleston -2- Raleigh -3- Nashville
    // -1- Atlanta = 13, passing Atlanta twice.
    const claimed = {
      [NASHVILLE_ATLANTA]: 'p1',
      [ATLANTA_CHARLESTON]: 'p1',
      [RALEIGH_CHARLESTON]: 'p1',
      [NASHVILLE_RALEIGH]: 'p1',
      [ATLANTA_MIAMI]: 'p1',
    };
    expect(longestPath(claimed, 'p1')).toBe(13);
  });

  it('does not join two disconnected pieces', () => {
    expect(longestPath({ [NASHVILLE_ATLANTA]: 'p1', [RALEIGH_CHARLESTON]: 'p1' }, 'p1')).toBe(2);
  });
});

describe('finalScores', () => {
  it('adds completed tickets and subtracts failed ones', () => {
    // Ann holds Atlanta -2- Raleigh and Raleigh -2- Charleston: no path to New York, so t04 fails.
    const state = finished(
      { [ATLANTA_RALEIGH]: 'p1', [RALEIGH_CHARLESTON]: 'p1' },
      { p1: [ticket(NEW_YORK_ATLANTA)], p2: [ticket(TORONTO_MIAMI)] },
      { p1: 4, p2: 0 },
    );
    const result = finalScores(state);
    const ann = result.players.find((p) => p.playerId === 'p1')!;
    const bob = result.players.find((p) => p.playerId === 'p2')!;
    expect(ann.routePoints).toBe(4);
    expect(ann.tickets).toEqual([{ ticket: ticket(NEW_YORK_ATLANTA), completed: false }]);
    expect(ann.ticketPoints).toBe(-6);
    expect(ann.longestPath).toBe(4);
    expect(ann.longestPathBonus).toBe(true);
    expect(ann.total).toBe(4 - 6 + LONGEST_PATH_BONUS);
    expect(bob.ticketPoints).toBe(-10);
    expect(bob.longestPath).toBe(0);
    expect(bob.longestPathBonus).toBe(false);
    expect(bob.total).toBe(-10);
  });

  it('marks a ticket completed when the player’s own routes join its cities', () => {
    // No printed ticket is satisfied by one short route, so use a hand-made one.
    const atlantaCharleston: Ticket = { id: 'test', from: 'atlanta', to: 'charleston', points: 3 };
    const state = finished({ [ATLANTA_CHARLESTON]: 'p1' }, { p1: [atlantaCharleston] }, { p1: 2 });
    const ann = finalScores(state).players.find((p) => p.playerId === 'p1')!;
    expect(ann.tickets[0]?.completed).toBe(true);
    expect(ann.ticketPoints).toBe(3);
    expect(ann.total).toBe(2 + 3 + LONGEST_PATH_BONUS);
  });

  it('gives the longest path bonus to everyone tied for it', () => {
    const state = finished(
      { [ATLANTA_CHARLESTON]: 'p1', [RALEIGH_CHARLESTON]: 'p2', [NASHVILLE_ATLANTA]: 'p3' },
      {},
      { p1: 2, p2: 2, p3: 1 },
    );
    const result = finalScores(state);
    expect(result.longestPath).toBe(2);
    expect(result.players.map((p) => [p.playerId, p.longestPathBonus])).toEqual([
      ['p1', true],
      ['p2', true],
      ['p3', false],
    ]);
    expect(result.players.find((p) => p.playerId === 'p1')?.total).toBe(12);
    expect(result.players.find((p) => p.playerId === 'p3')?.total).toBe(1);
  });

  it('ranks by total points first', () => {
    const state = finished({}, {}, { p1: 5, p2: 20, p3: 7 });
    const result = finalScores(state);
    expect(result.ranking).toEqual(['p2', 'p3', 'p1']);
    expect(result.winnerIds).toEqual(['p2']);
  });

  it('awards no longest path bonus when nobody built a path', () => {
    const state = finished({}, {}, { p1: 5, p2: 5, p3: 0 });
    const result = finalScores(state);
    expect(result.longestPath).toBe(0);
    expect(result.players.every((p) => !p.longestPathBonus)).toBe(true);
    expect(result.players.find((p) => p.playerId === 'p1')?.total).toBe(5);
    expect(result.winnerIds).toEqual(['p1', 'p2']);
  });

  it('breaks a points tie by completed tickets', () => {
    const atlantaCharleston: Ticket = { id: 'ac', from: 'atlanta', to: 'charleston', points: 2 };
    // Ann: 2 route points + 2 ticket = 4. Bob: 4 route points, no tickets = 4. Same longest path (2).
    const state = finished(
      { [ATLANTA_CHARLESTON]: 'p1', [RALEIGH_CHARLESTON]: 'p2' },
      { p1: [atlantaCharleston] },
      { p1: 2, p2: 4, p3: 0 },
    );
    const result = finalScores(state);
    expect(result.players.find((p) => p.playerId === 'p1')?.total).toBe(14);
    expect(result.players.find((p) => p.playerId === 'p2')?.total).toBe(14);
    expect(result.ranking.slice(0, 2)).toEqual(['p1', 'p2']);
    expect(result.winnerIds).toEqual(['p1']);
  });

  it('breaks a remaining tie by holding the longest path', () => {
    // Ann: 1 route point + bonus = 11. Bob: 11 route points, no routes claimed → no bonus... but
    // then Bob has longest path 0 while Ann has 1, so Ann alone holds the bonus. Totals equal (11),
    // completed tickets equal (0), Ann wins on the longest path card.
    const state = finished({ [NASHVILLE_ATLANTA]: 'p1' }, {}, { p1: 1, p2: 11, p3: 0 });
    const result = finalScores(state);
    expect(result.players.find((p) => p.playerId === 'p1')?.total).toBe(11);
    expect(result.players.find((p) => p.playerId === 'p2')?.total).toBe(11);
    expect(result.ranking.slice(0, 2)).toEqual(['p1', 'p2']);
    expect(result.winnerIds).toEqual(['p1']);
  });

  it('reports a dead heat as several winners', () => {
    const state = finished({}, {}, { p1: 3, p2: 3, p3: 0 });
    expect(finalScores(state).winnerIds).toEqual(['p1', 'p2']);
  });

  it('never mutates the state', () => {
    const state = finished({ [NASHVILLE_ATLANTA]: 'p1' }, {}, { p1: 1 });
    const before = JSON.stringify(state);
    finalScores(state);
    expect(JSON.stringify(state)).toBe(before);
  });
});
