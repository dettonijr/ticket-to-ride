import { drawFromSupply, refillFaceUp } from '../setup';
import type { Card, GameState, PlayerState } from '../state';
import { endTurn } from '../turn';
import { refuse, type ApplyResult } from '../violation';

/** Phases in which the current player may draw a train card. */
function drawingPhase(state: GameState): boolean {
  return state.phase === 'turnStart' || state.phase === 'drewOne';
}

/** A card can still be drawn: the deck or discards hold one, or a non-locomotive is face up. */
export function secondDrawPossible(table: {
  faceUp: readonly Card[];
  trainDeckSize: number;
  discardSize: number;
}): boolean {
  return (
    table.trainDeckSize + table.discardSize > 0 || table.faceUp.some((c) => c !== 'locomotive')
  );
}

function checkTurn(state: GameState, player: PlayerState): ApplyResult | undefined {
  if (!drawingPhase(state)) return refuse('wrong-phase', 'You cannot draw train cards right now');
  if (state.currentPlayer !== player.id) return refuse('not-your-turn', 'It is not your turn');
  return undefined;
}

function withCard(state: GameState, player: PlayerState, card: Card): PlayerState[] {
  return state.players.map((p) => (p.id === player.id ? { ...p, hand: [...p.hand, card] } : p));
}

/** Finish a draw: stay for the second draw, or close the turn when the draw is complete. */
function afterDraw(state: GameState, player: PlayerState, description: string): GameState {
  const lastAction = { playerId: player.id, description };
  const drawComplete = state.phase === 'drewOne';
  const nothingLeft = !secondDrawPossible({
    faceUp: state.faceUp,
    trainDeckSize: state.trainDeck.length,
    discardSize: state.discard.length,
  });
  if (drawComplete || nothingLeft) return endTurn(state, lastAction);
  return { ...state, phase: 'drewOne', lastAction };
}

export function drawFaceUp(state: GameState, player: PlayerState, index: number): ApplyResult {
  const refused = checkTurn(state, player);
  if (refused) return refused;
  const card = Number.isInteger(index) ? state.faceUp[index] : undefined;
  if (card === undefined) return refuse('bad-index', 'There is no face-up card there');
  if (card === 'locomotive' && state.phase === 'drewOne')
    return refuse(
      'locomotive-second-draw',
      'A face-up locomotive cannot be taken as your second card',
    );

  const row = state.faceUp.filter((_, i) => i !== index);
  const refilled = refillFaceUp(row, state.trainDeck, state.discard, state.rng);
  const next: GameState = {
    ...state,
    players: withCard(state, player, card),
    faceUp: refilled.faceUp,
    trainDeck: refilled.trainDeck,
    discard: refilled.discard,
    rng: refilled.rng,
  };

  if (card === 'locomotive') {
    return {
      ok: true,
      state: endTurn(next, {
        playerId: player.id,
        description: `${player.name} took a locomotive`,
      }),
    };
  }
  return { ok: true, state: afterDraw(next, player, `${player.name} took a ${card} card`) };
}

export function drawBlind(state: GameState, player: PlayerState): ApplyResult {
  const refused = checkTurn(state, player);
  if (refused) return refused;

  const { card, supply } = drawFromSupply({
    trainDeck: state.trainDeck,
    discard: state.discard,
    rng: state.rng,
  });
  if (card === undefined) return refuse('deck-empty', 'The deck and the discards are both empty');

  const refilled = refillFaceUp(state.faceUp, supply.trainDeck, supply.discard, supply.rng);
  const next: GameState = {
    ...state,
    players: withCard(state, player, card),
    faceUp: refilled.faceUp,
    trainDeck: refilled.trainDeck,
    discard: refilled.discard,
    rng: refilled.rng,
  };
  return { ok: true, state: afterDraw(next, player, `${player.name} drew a card from the deck`) };
}
