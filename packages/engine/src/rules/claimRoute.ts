import { countCards } from '../cards';
import { cityName, ROUTE_BY_ID, ROUTES } from '../data/usa';
import {
  COLOURS,
  type Card,
  type Colour,
  type GameState,
  type PlayerId,
  type PlayerState,
  type Route,
  type RouteId,
} from '../state';
import { endTurn } from '../turn';
import type { PlayerView } from '../view';
import { refuse, type ApplyResult } from '../violation';

/** Points for claiming a route, by its length in spaces. */
export const ROUTE_POINTS: Readonly<Record<number, number>> = {
  1: 1,
  2: 2,
  3: 4,
  4: 7,
  5: 10,
  6: 15,
};

/** With this many players or fewer, only one of a double route's twins may be claimed. */
export const TWIN_CLOSED_AT_OR_BELOW = 3;

/**
 * Every valid set of cards a hand can spend on a route. For each usable colour
 * (grey routes accept any colour) every split between that colour and
 * locomotives the hand can afford is offered, fewest locomotives first, so a
 * player may keep colour cards by spending locomotives instead. Locomotives
 * alone come last, once. Colours follow the fixed colour order so clients
 * render options stably.
 */
export function claimOptions(hand: readonly Card[], route: Route): Card[][] {
  const counts = countCards(hand);
  const locomotives = counts.get('locomotive') ?? 0;
  const colours: Colour[] = route.colour === 'grey' ? [...COLOURS] : [route.colour];
  const options: Card[][] = [];
  for (const colour of colours) {
    const have = counts.get(colour) ?? 0;
    if (have === 0) continue;
    const fewest = Math.max(0, route.length - have);
    const most = Math.min(locomotives, route.length - 1);
    for (let n = fewest; n <= most; n++) {
      options.push([
        ...Array<Card>(route.length - n).fill(colour),
        ...Array<Card>(n).fill('locomotive'),
      ]);
    }
  }
  if (locomotives >= route.length) options.push(Array<Card>(route.length).fill('locomotive'));
  return options;
}

/** The public facts a route's availability depends on; both GameState and PlayerView have them. */
export interface ClaimContext {
  claimed: Readonly<Record<RouteId, PlayerId>>;
  playerCount: number;
  playerId: PlayerId;
  trainsLeft: number;
}

/** The rule that stops a claim before cards are even considered, or undefined if none. */
function claimValidation(ctx: ClaimContext, route: Route): ApplyResult | undefined {
  if (ctx.claimed[route.id] !== undefined)
    return refuse('route-taken', 'That route has already been claimed');
  if (route.twinId !== undefined) {
    const twinOwner = ctx.claimed[route.twinId];
    if (twinOwner === ctx.playerId)
      return refuse('own-twin', 'You already hold the other route between these cities');
    if (twinOwner !== undefined && ctx.playerCount <= TWIN_CLOSED_AT_OR_BELOW)
      return refuse(
        'twin-closed',
        `With ${ctx.playerCount} players only one of a double route can be claimed`,
      );
  }
  if (ctx.trainsLeft < route.length)
    return refuse('not-enough-trains', `You need ${route.length} trains for that route`);
  return undefined;
}

/**
 * Every route the viewer could claim right now with the cards in their hand,
 * from their own view. The client uses it to light up the board; `claimRoute`
 * re-checks everything on the server.
 */
export function claimableRoutes(view: PlayerView): RouteId[] {
  if (view.phase !== 'turnStart' || view.currentPlayer !== view.me.id) return [];
  const me = view.players.find((p) => p.id === view.me.id);
  if (!me) return [];
  const ctx: ClaimContext = {
    claimed: view.claimed,
    playerCount: view.players.length,
    playerId: me.id,
    trainsLeft: me.trainsLeft,
  };
  return ROUTES.filter(
    (route) =>
      claimValidation(ctx, route) === undefined && claimOptions(view.me.hand, route).length > 0,
  ).map((route) => route.id);
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

  const blocked = claimValidation(
    {
      claimed: state.claimed,
      playerCount: state.players.length,
      playerId: player.id,
      trainsLeft: player.trainsLeft,
    },
    route,
  );
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
  return {
    ok: true,
    state: endTurn(
      {
        ...state,
        players,
        discard: [...state.discard, ...cards],
        claimed: { ...state.claimed, [route.id]: player.id },
      },
      {
        playerId: player.id,
        description: `${player.name} claimed ${cityName(route.from)} to ${cityName(route.to)}`,
      },
    ),
  };
}
