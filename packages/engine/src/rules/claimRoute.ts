import type { ApplyResult } from '../apply';
import { CITY_BY_ID, ROUTE_BY_ID } from '../data/usa';
import { COLOURS, type Card, type Colour, type GameState, type PlayerState, type Route } from '../state';
import { endTurn } from '../turn';

/** Points for claiming a route, by its length in spaces. */
export const ROUTE_POINTS: Readonly<Record<number, number>> = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 10, 6: 15 };

/** With this many players or fewer, only one of a double route's twins may be claimed. */
export const TWIN_CLOSED_AT_OR_BELOW = 3;

function refuse(code: string, message: string): ApplyResult {
  return { ok: false, violation: { code, message } };
}

function countCards(cards: readonly Card[]): Map<Card, number> {
  const counts = new Map<Card, number>();
  for (const c of cards) counts.set(c, (counts.get(c) ?? 0) + 1);
  return counts;
}

/**
 * Every valid set of cards a hand can spend on a route: one entry per usable
 * colour (grey routes accept any colour), each using as few locomotives as the
 * hand allows, plus locomotives alone when the hand holds enough. Colours are
 * listed in the fixed colour order so clients render options stably.
 */
export function claimOptions(hand: readonly Card[], route: Route): Card[][] {
  const counts = countCards(hand);
  const locomotives = counts.get('locomotive') ?? 0;
  const colours: Colour[] = route.colour === 'grey' ? [...COLOURS] : [route.colour];
  const options: Card[][] = [];
  for (const colour of colours) {
    const have = counts.get(colour) ?? 0;
    if (have === 0) continue;
    const useColour = Math.min(have, route.length);
    const needLocomotives = route.length - useColour;
    if (needLocomotives > locomotives) continue;
    options.push([
      ...Array<Card>(useColour).fill(colour),
      ...Array<Card>(needLocomotives).fill('locomotive'),
    ]);
  }
  if (locomotives >= route.length) options.push(Array<Card>(route.length).fill('locomotive'));
  return options;
}

/** Can this player, holding this hand and these trains, claim this route at all? */
export function canClaim(state: GameState, player: PlayerState, route: Route): boolean {
  return claimValidation(state, player, route) === undefined;
}

/** The rule that stops a claim before cards are even considered, or undefined if none. */
function claimValidation(
  state: GameState,
  player: PlayerState,
  route: Route,
): ApplyResult | undefined {
  if (state.claimed[route.id] !== undefined)
    return refuse('route-taken', 'That route has already been claimed');
  if (route.twinId !== undefined) {
    const twinOwner = state.claimed[route.twinId];
    if (twinOwner === player.id)
      return refuse('own-twin', 'You already hold the other route between these cities');
    if (twinOwner !== undefined && state.players.length <= TWIN_CLOSED_AT_OR_BELOW)
      return refuse(
        'twin-closed',
        `With ${state.players.length} players only one of a double route can be claimed`,
      );
  }
  if (player.trainsLeft < route.length)
    return refuse('not-enough-trains', `You need ${route.length} trains for that route`);
  return undefined;
}

export function claimRoute(
  state: GameState,
  player: PlayerState,
  routeId: string,
  cards: readonly Card[],
): ApplyResult {
  if (state.phase !== 'turnStart')
    return refuse('wrong-phase', 'You can only claim a route at the start of your turn');
  if (state.currentPlayer !== player.id) return refuse('not-your-turn', 'It is not your turn');
  const route = ROUTE_BY_ID.get(routeId);
  if (!route) return refuse('unknown-route', 'There is no such route');

  const blocked = claimValidation(state, player, route);
  if (blocked) return blocked;

  if (cards.length !== route.length)
    return refuse('wrong-card-count', `That route needs exactly ${route.length} cards`);

  const held = countCards(player.hand);
  for (const [card, n] of countCards(cards)) {
    if ((held.get(card) ?? 0) < n) return refuse('cards-not-held', 'You do not hold those cards');
  }

  const colours = new Set(cards.filter((c): c is Colour => c !== 'locomotive'));
  if (colours.size > 1)
    return refuse('mixed-colours', 'A set must be one colour plus any locomotives');
  const [colour] = colours;
  if (colour !== undefined && route.colour !== 'grey' && colour !== route.colour)
    return refuse('wrong-colour', `That route needs ${route.colour} cards`);

  const hand = player.hand.slice();
  for (const card of cards) hand.splice(hand.indexOf(card), 1);
  const points = ROUTE_POINTS[route.length] ?? 0;
  const players = state.players.map((p) =>
    p.id === player.id
      ? { ...p, hand, trainsLeft: p.trainsLeft - route.length, score: p.score + points }
      : p,
  );
  const from = CITY_BY_ID.get(route.from)?.name ?? route.from;
  const to = CITY_BY_ID.get(route.to)?.name ?? route.to;

  return {
    ok: true,
    state: endTurn(
      {
        ...state,
        players,
        discard: [...state.discard, ...cards],
        claimed: { ...state.claimed, [route.id]: player.id },
      },
      { playerId: player.id, description: `${player.name} claimed ${from} to ${to}` },
    ),
  };
}
