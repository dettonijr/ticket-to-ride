import { ROUTES, TICKETS } from './data/usa';
import { seedRng, shuffle, type RngState } from './rng';
import {
  CARDS_PER_COLOUR,
  COLOURS,
  FACE_UP_COUNT,
  INITIAL_HAND,
  INITIAL_TICKETS,
  LOCOMOTIVE_COUNT,
  TRAINS_PER_PLAYER,
  type Card,
  type GameState,
  type PlayerColour,
  type PlayerId,
  type PlayerState,
} from './state';

export interface PlayerSeat {
  id: PlayerId;
  name: string;
  colour: PlayerColour;
}

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;

/** A full, unshuffled train deck: 12 of each colour plus 14 locomotives. */
export function fullTrainDeck(): Card[] {
  const deck: Card[] = [];
  for (const colour of COLOURS) for (let i = 0; i < CARDS_PER_COLOUR; i++) deck.push(colour);
  for (let i = 0; i < LOCOMOTIVE_COUNT; i++) deck.push('locomotive');
  return deck;
}

/**
 * Fill the face-up row to five from the deck (reshuffling discards in when the
 * deck runs dry) and, whenever three or more face-up cards are locomotives,
 * discard the whole row and deal again. Pure: returns new arrays and rng.
 */
export function refillFaceUp(
  faceUp: readonly Card[],
  trainDeck: readonly Card[],
  discard: readonly Card[],
  rng: RngState,
): { faceUp: Card[]; trainDeck: Card[]; discard: Card[]; rng: RngState } {
  let row = faceUp.slice();
  let deck = trainDeck.slice();
  let pile = discard.slice();
  let state = rng;

  const draw = (): Card | undefined => {
    if (deck.length === 0 && pile.length > 0) {
      [deck, state] = shuffle(pile, state);
      pile = [];
    }
    return deck.shift();
  };

  // Guard against an endless loop when the supply holds too many locomotives
  // to ever deal a legal row (cannot happen with a full deck, but be safe).
  for (let attempts = 0; attempts < 10; attempts++) {
    while (row.length < FACE_UP_COUNT) {
      const card = draw();
      if (card === undefined) break;
      row.push(card);
    }
    const locomotives = row.filter((c) => c === 'locomotive').length;
    if (locomotives < 3) break;
    pile = pile.concat(row);
    row = [];
  }
  return { faceUp: row, trainDeck: deck, discard: pile, rng: state };
}

/**
 * Create a dealt game in the setup phase. Turn order is the order of `seats`;
 * the caller randomises it. Deterministic for a given seed.
 */
export function createGame(seats: readonly PlayerSeat[], seed: number): GameState {
  if (seats.length < MIN_PLAYERS || seats.length > MAX_PLAYERS) {
    throw new Error(`a game needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players`);
  }
  let rng = seedRng(seed);
  let trainDeck: Card[];
  let ticketDeck: typeof TICKETS extends readonly (infer T)[] ? T[] : never;
  [trainDeck, rng] = shuffle(fullTrainDeck(), rng);
  [ticketDeck, rng] = shuffle(TICKETS, rng);

  const players: PlayerState[] = seats.map((seat) => {
    const hand = trainDeck.splice(0, INITIAL_HAND);
    const pendingTickets = ticketDeck.splice(0, INITIAL_TICKETS);
    return {
      id: seat.id,
      name: seat.name,
      colour: seat.colour,
      hand,
      tickets: [],
      pendingTickets,
      trainsLeft: TRAINS_PER_PLAYER,
      score: 0,
    };
  });

  const dealt = refillFaceUp([], trainDeck, [], rng);
  const turnOrder = seats.map((s) => s.id);
  const first = turnOrder[0];
  if (first === undefined) throw new Error('unreachable: no players');

  return {
    seed,
    rng: dealt.rng,
    phase: 'setup',
    players,
    turnOrder,
    currentPlayer: first,
    trainDeck: dealt.trainDeck,
    discard: dealt.discard,
    faceUp: dealt.faceUp,
    ticketDeck,
    claimed: {},
  };
}

/** Total number of train cards in the game, for sanity checks. */
export const TOTAL_TRAIN_CARDS = COLOURS.length * CARDS_PER_COLOUR + LOCOMOTIVE_COUNT;
/** Total number of routes on the board. */
export const TOTAL_ROUTES = ROUTES.length;
