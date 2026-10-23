import { legalActions, type PlayerColour, type PlayerId, type PlayerView } from '@railyard/engine';
import { Board } from '../board/Board';
import { Hand } from '../panels/Hand';
import { Players } from '../panels/Players';
import { Table } from '../panels/Table';
import { TicketChoice } from '../panels/TicketChoice';
import { Tickets } from '../panels/Tickets';
import { client } from '../ws';

export function Game({ view, rejection }: { view: PlayerView; rejection?: string | undefined }) {
  const playerColours: Record<PlayerId, PlayerColour> = {};
  for (const p of view.players) playerColours[p.id] = p.colour;
  const legal = legalActions(view);
  const ticketChoice = legal.find((a) => a.type === 'chooseInitialTickets');
  const canDraw = legal.some((a) => a.type === 'drawFaceUp' || a.type === 'drawBlind');
  const myTurn = view.phase !== 'setup' && view.currentPlayer === view.me.id;
  const waitingNames = view.waitingOn
    .filter((id) => id !== view.me.id)
    .map((id) => view.players.find((p) => p.id === id)?.name ?? id);

  return (
    <main className="game">
      <section className="board-wrap">
        {ticketChoice && (
          <TicketChoice
            key="initial"
            tickets={view.me.pendingTickets}
            minKeep={ticketChoice.minKeep}
            onKeep={(keep) =>
              client.send({ type: 'action', action: { type: 'chooseInitialTickets', keep } })
            }
          />
        )}
        {view.phase === 'setup' && !ticketChoice && (
          <p className="banner" role="status">
            Waiting for {waitingNames.join(', ')} to choose tickets.
          </p>
        )}
        {myTurn && (
          <p className="banner" role="status">
            Your turn.
          </p>
        )}
        {rejection && (
          <p className="rejection" role="alert">
            {rejection}
          </p>
        )}
        <Board claimed={view.claimed} playerColours={playerColours} />
      </section>
      <aside className="sidebar">
        <Players view={view} />
        <Table
          faceUp={view.faceUp}
          trainDeckSize={view.trainDeckSize}
          discardSize={view.discardSize}
          ticketDeckSize={view.ticketDeckSize}
          canDraw={canDraw}
        />
        <Hand hand={view.me.hand} />
        <Tickets tickets={view.me.tickets} />
      </aside>
    </main>
  );
}
