import { isTicketCompleted, type Claimed } from '../connectivity';
import { ROUTE_BY_ID } from '../data/usa';
import type { CityId, GameState, PlayerId, RouteId, Ticket } from '../state';

/** Points for holding the longest continuous path, shared by everyone tied for it. */
export const LONGEST_PATH_BONUS = 10;

export interface TicketResult {
  ticket: Ticket;
  completed: boolean;
}

/** One player's end-of-game breakdown. */
export interface PlayerResult {
  playerId: PlayerId;
  /** Points scored while claiming routes. */
  routePoints: number;
  tickets: TicketResult[];
  /** Completed ticket values minus failed ticket values. */
  ticketPoints: number;
  /** Length in spaces of the player's longest continuous path. */
  longestPath: number;
  longestPathBonus: boolean;
  total: number;
}

export interface FinalResult {
  players: PlayerResult[];
  /** The longest path anyone built, in spaces. */
  longestPath: number;
  /** Player ids from first to last. */
  ranking: PlayerId[];
  /** Usually one id; several on a dead heat. */
  winnerIds: PlayerId[];
}

interface Edge {
  routeId: RouteId;
  to: CityId;
  length: number;
}

/**
 * The longest continuous path one player's trains form, in spaces: a route is
 * used at most once, a city may be passed any number of times. Depth-first
 * search from every city; player route counts are small enough for this.
 */
export function longestPath(claimed: Claimed, playerId: PlayerId): number {
  const edges = new Map<CityId, Edge[]>();
  const add = (from: CityId, edge: Edge) => {
    const list = edges.get(from);
    if (list) list.push(edge);
    else edges.set(from, [edge]);
  };
  for (const [routeId, owner] of Object.entries(claimed)) {
    if (owner !== playerId) continue;
    const route = ROUTE_BY_ID.get(routeId);
    if (!route) continue;
    add(route.from, { routeId, to: route.to, length: route.length });
    add(route.to, { routeId, to: route.from, length: route.length });
  }

  const used = new Set<RouteId>();
  const walk = (city: CityId): number => {
    let best = 0;
    for (const edge of edges.get(city) ?? []) {
      if (used.has(edge.routeId)) continue;
      used.add(edge.routeId);
      best = Math.max(best, edge.length + walk(edge.to));
      used.delete(edge.routeId);
    }
    return best;
  };

  let best = 0;
  for (const city of edges.keys()) best = Math.max(best, walk(city));
  return best;
}

/** Score a finished game. Pure: the same state always gives the same result. */
export function finalScores(state: GameState): FinalResult {
  const scored = state.players.map((p) => {
    const tickets = p.tickets.map((ticket) => ({
      ticket,
      completed: isTicketCompleted(state.claimed, p.id, ticket),
    }));
    const ticketPoints = tickets.reduce(
      (sum, t) => sum + (t.completed ? t.ticket.points : -t.ticket.points),
      0,
    );
    return {
      playerId: p.id,
      routePoints: p.score,
      tickets,
      ticketPoints,
      longestPath: longestPath(state.claimed, p.id),
    };
  });

  const longest = Math.max(0, ...scored.map((p) => p.longestPath));
  const players: PlayerResult[] = scored.map((p) => {
    // The card goes to a path; with no routes on the board nobody holds it.
    const longestPathBonus = longest > 0 && p.longestPath === longest;
    return {
      ...p,
      longestPathBonus,
      total: p.routePoints + p.ticketPoints + (longestPathBonus ? LONGEST_PATH_BONUS : 0),
    };
  });

  const completedCount = (p: PlayerResult) => p.tickets.filter((t) => t.completed).length;
  const compare = (a: PlayerResult, b: PlayerResult): number =>
    b.total - a.total ||
    completedCount(b) - completedCount(a) ||
    Number(b.longestPathBonus) - Number(a.longestPathBonus);
  const ordered = players.slice().sort(compare);
  const first = ordered[0];
  const winnerIds = first
    ? ordered.filter((p) => compare(first, p) === 0).map((p) => p.playerId)
    : [];

  return {
    players,
    longestPath: longest,
    ranking: ordered.map((p) => p.playerId),
    winnerIds,
  };
}
