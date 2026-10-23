import { ROUTE_BY_ID } from './data/usa';
import type { CityId, PlayerId, RouteId, Ticket } from './state';

/** Claimed routes as a view or state carries them: route id to owner. */
export type Claimed = Readonly<Record<RouteId, PlayerId>>;

/**
 * Build a predicate telling whether two cities are joined by one player's
 * claimed routes. Union-find over the player's routes; the result is a
 * function so callers can test many pairs against one claim map.
 */
export function connectedCities(
  claimed: Claimed,
  playerId: PlayerId,
): (a: CityId, b: CityId) => boolean {
  const parent = new Map<CityId, CityId>();
  const find = (c: CityId): CityId => {
    let root = c;
    while (parent.get(root) !== undefined && parent.get(root) !== root) root = parent.get(root)!;
    // Path compression.
    let cur = c;
    while (cur !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: CityId, b: CityId): void => {
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const [routeId, owner] of Object.entries(claimed)) {
    if (owner !== playerId) continue;
    const route = ROUTE_BY_ID.get(routeId);
    if (route) union(route.from, route.to);
  }

  return (a, b) => a === b || (parent.has(a) && parent.has(b) && find(a) === find(b));
}

/** Whether the player's claimed routes currently join the ticket's two cities. */
export function isTicketCompleted(claimed: Claimed, playerId: PlayerId, ticket: Ticket): boolean {
  return connectedCities(claimed, playerId)(ticket.from, ticket.to);
}
