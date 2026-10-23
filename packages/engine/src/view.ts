import type {
  Card,
  GameState,
  LastAction,
  Phase,
  PlayerColour,
  PlayerId,
  RouteId,
  Ticket,
} from './state';

/** What a table shows about every player. */
export interface PublicPlayer {
  id: PlayerId;
  name: string;
  colour: PlayerColour;
  score: number;
  trainsLeft: number;
  handSize: number;
  ticketCount: number;
}

/** Everything one player is allowed to see. */
export interface PlayerView {
  me: {
    id: PlayerId;
    hand: Card[];
    tickets: Ticket[];
    pendingTickets: Ticket[];
  };
  players: PublicPlayer[];
  turnOrder: PlayerId[];
  currentPlayer: PlayerId;
  phase: Phase;
  faceUp: Card[];
  trainDeckSize: number;
  discardSize: number;
  ticketDeckSize: number;
  claimed: Record<RouteId, PlayerId>;
  finalRoundTriggeredBy?: PlayerId;
  lastAction?: LastAction;
  /** Ids of players who still have to choose tickets, so the client can show who is waited on. */
  waitingOn: PlayerId[];
}

/** Build the view for one player: their own private cards plus public info. */
export function redact(state: GameState, playerId: PlayerId): PlayerView {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) throw new Error(`unknown player ${playerId}`);
  const view: PlayerView = {
    me: {
      id: me.id,
      hand: me.hand.slice(),
      tickets: me.tickets.slice(),
      pendingTickets: me.pendingTickets.slice(),
    },
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      colour: p.colour,
      score: p.score,
      trainsLeft: p.trainsLeft,
      handSize: p.hand.length,
      ticketCount: p.tickets.length,
    })),
    turnOrder: state.turnOrder.slice(),
    currentPlayer: state.currentPlayer,
    phase: state.phase,
    faceUp: state.faceUp.slice(),
    trainDeckSize: state.trainDeck.length,
    discardSize: state.discard.length,
    ticketDeckSize: state.ticketDeck.length,
    claimed: { ...state.claimed },
    waitingOn: state.players.filter((p) => p.pendingTickets.length > 0).map((p) => p.id),
  };
  if (state.finalRoundTriggeredBy !== undefined) {
    view.finalRoundTriggeredBy = state.finalRoundTriggeredBy;
  }
  if (state.lastAction !== undefined) {
    view.lastAction = { ...state.lastAction };
  }
  return view;
}
