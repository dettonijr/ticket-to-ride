import { describe, expect, it } from 'vitest';
import type { Action, LoggedAction } from './actions';
import { apply } from './apply';
import { ROUTE_BY_ID } from './data/usa';
import { legalActions } from './legal';
import { claimOptions } from './rules/claimRoute';
import { createGame, type PlayerSeat } from './setup';
import type { GameState, PlayerColour } from './state';
import { redact, type PlayerView } from './view';

/**
 * Property: a game is fully determined by its seed and its accepted actions.
 * A random policy plays games of every size; every accepted action is logged;
 * replaying the log from `createGame` with the same seed must reproduce the
 * live state after every single step. Along the way no view may ever carry
 * another player's hand or tickets before the game is finished.
 */

const SEEDS = 25;
const MAX_ACTIONS = 3000;

/** A tiny linear congruential generator for the test's own choices. */
function policyRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const COLOURS: PlayerColour[] = ['blue', 'red', 'green', 'yellow', 'black'];
function seatsFor(count: number): PlayerSeat[] {
  return COLOURS.slice(0, count).map((colour, i) => ({
    id: `p${i + 1}`,
    name: `P${i + 1}`,
    colour,
  }));
}

function pick<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('pick from empty list');
  return item;
}

/** A random subset of at least `min` items. */
function subset<T>(items: readonly T[], min: number, random: () => number): T[] {
  const chosen = items.filter(() => random() < 0.5);
  while (chosen.length < min) {
    const extra = pick(
      items.filter((i) => !chosen.includes(i)),
      random,
    );
    chosen.push(extra);
  }
  return chosen;
}

/** Who may act now, and one random legal action for them. */
function randomAction(
  state: GameState,
  random: () => number,
): { playerId: string; action: Action } | undefined {
  const actors =
    state.phase === 'setup'
      ? state.players.filter((p) => p.pendingTickets.length > 0).map((p) => p.id)
      : [state.currentPlayer];
  if (actors.length === 0) return undefined;
  const playerId = pick(actors, random);
  const view = redact(state, playerId);
  const legal = legalActions(view);
  if (legal.length === 0) return undefined;
  const chosen = pick(legal, random);
  switch (chosen.type) {
    case 'chooseInitialTickets':
      return {
        playerId,
        action: {
          type: 'chooseInitialTickets',
          keep: subset(
            view.me.pendingTickets.map((t) => t.id),
            chosen.minKeep,
            random,
          ),
        },
      };
    case 'chooseTickets':
      return {
        playerId,
        action: {
          type: 'chooseTickets',
          keep: subset(
            view.me.pendingTickets.map((t) => t.id),
            chosen.minKeep,
            random,
          ),
        },
      };
    case 'drawFaceUp':
      return { playerId, action: { type: 'drawFaceUp', index: pick(chosen.indexes, random) } };
    case 'drawBlind':
      return { playerId, action: { type: 'drawBlind' } };
    case 'drawTickets':
      return { playerId, action: { type: 'drawTickets' } };
    case 'claimRoute': {
      if (chosen.routes.length === 0) return randomAction(state, random);
      const routeId = pick(chosen.routes, random);
      const route = ROUTE_BY_ID.get(routeId);
      if (!route) throw new Error(`unknown route ${routeId}`);
      const cards = pick(claimOptions(view.me.hand, route), random);
      return { playerId, action: { type: 'claimRoute', routeId, cards } };
    }
  }
}

/** Nothing private about another player appears in a view before the end. */
function assertNoLeak(state: GameState, view: PlayerView): void {
  const text = JSON.stringify(view);
  for (const other of state.players) {
    if (other.id === view.me.id) continue;
    for (const t of [...other.tickets, ...other.pendingTickets]) {
      expect(text).not.toContain(`"${t.id}"`);
    }
  }
  for (const p of view.players) {
    expect(p).not.toHaveProperty('hand');
    expect(p).not.toHaveProperty('tickets');
  }
}

describe('replaying a game from its seed and action log', () => {
  const seeds = Array.from({ length: SEEDS }, (_, i) => 1000 + i * 7919);
  let finishedGames = 0;

  it.each(seeds)('reproduces every step of a random game (seed %i)', (seed) => {
    const random = policyRng(seed);
    const seats = seatsFor(2 + (seed % 4));
    let live = createGame(seats, seed);
    let replayed = createGame(seats, seed);
    const log: LoggedAction[] = [];

    for (let step = 0; step < MAX_ACTIONS && live.phase !== 'finished'; step++) {
      const next = randomAction(live, random);
      if (!next) throw new Error(`no legal action in phase ${live.phase} at step ${step}`);
      const result = apply(live, next.playerId, next.action);
      if (!result.ok)
        throw new Error(`legal action refused: ${result.violation.code} at step ${step}`);
      live = result.state;
      log.push(next);

      const again = apply(replayed, next.playerId, next.action);
      if (!again.ok) throw new Error(`replay refused: ${again.violation.code} at step ${step}`);
      replayed = again.state;
      expect(JSON.stringify(replayed)).toBe(JSON.stringify(live));

      if (live.phase !== 'finished') {
        for (const p of live.players) assertNoLeak(live, redact(live, p.id));
      }
    }

    if (live.phase === 'finished') finishedGames++;
    expect(log.length).toBeGreaterThan(seats.length);

    // And once more from scratch, in one go.
    let fresh = createGame(seats, seed);
    for (const entry of log) {
      const r = apply(fresh, entry.playerId, entry.action);
      if (!r.ok) throw new Error(r.violation.message);
      fresh = r.state;
    }
    expect(fresh).toEqual(live);
  });

  it('finishes most random games within the action cap', () => {
    expect(finishedGames).toBeGreaterThan(SEEDS / 2);
  });
});
