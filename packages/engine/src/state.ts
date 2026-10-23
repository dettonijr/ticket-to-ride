import type { RngState } from './rng';

/** The eight train card colours plus the wild locomotive. */
export const COLOURS = [
  'purple',
  'blue',
  'orange',
  'white',
  'green',
  'yellow',
  'black',
  'red',
] as const;
export type Colour = (typeof COLOURS)[number];

/** A train card in a hand, deck or the face-up row. */
export type Card = Colour | 'locomotive';

/** A route's printed colour; grey takes any one colour. */
export type RouteColour = Colour | 'grey';

/** The five player colours of the physical game. */
export const PLAYER_COLOURS = ['blue', 'red', 'green', 'yellow', 'black'] as const;
export type PlayerColour = (typeof PLAYER_COLOURS)[number];

export type CityId = string;
export type RouteId = string;
export type TicketId = string;
export type PlayerId = string;

export interface City {
  id: CityId;
  name: string;
  /** Normalised board position, 0..1, origin top-left. */
  x: number;
  y: number;
}

export interface Route {
  id: RouteId;
  from: CityId;
  to: CityId;
  /** Number of spaces, 1..6. */
  length: number;
  colour: RouteColour;
  /** The parallel route of a double route, if any. */
  twinId?: RouteId;
}

export interface Ticket {
  id: TicketId;
  from: CityId;
  to: CityId;
  points: number;
}

export type Phase =
  'setup' | 'turnStart' | 'drewOne' | 'choosingTickets' | 'finalRound' | 'finished';

export interface PlayerState {
  id: PlayerId;
  name: string;
  colour: PlayerColour;
  hand: Card[];
  tickets: Ticket[];
  /** Tickets drawn but not yet chosen from (setup, or after drawTickets). */
  pendingTickets: Ticket[];
  trainsLeft: number;
  score: number;
}

/** What the table saw happen last: who acted and a public one-line description. */
export interface LastAction {
  playerId: PlayerId;
  description: string;
}

export interface GameState {
  seed: number;
  rng: RngState;
  phase: Phase;
  players: PlayerState[];
  lastAction?: LastAction;
  /** Player ids in play order. */
  turnOrder: PlayerId[];
  currentPlayer: PlayerId;
  trainDeck: Card[];
  discard: Card[];
  faceUp: Card[];
  ticketDeck: Ticket[];
  /** Route id to the id of the player who claimed it. */
  claimed: Record<RouteId, PlayerId>;
  /** Set when a player ends a turn with two or fewer trains. */
  finalRoundTriggeredBy?: PlayerId;
  /** Turns left in the final round, once triggered. */
  turnsRemaining?: number;
}

export const TRAINS_PER_PLAYER = 45;
export const CARDS_PER_COLOUR = 12;
export const LOCOMOTIVE_COUNT = 14;
export const FACE_UP_COUNT = 5;
export const INITIAL_HAND = 4;
export const INITIAL_TICKETS = 3;
