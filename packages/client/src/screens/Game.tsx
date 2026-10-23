import { useState } from 'react';
import {
  legalActions,
  ROUTE_BY_ID,
  type PlayerColour,
  type PlayerId,
  type PlayerView,
  type RouteId,
} from '@railyard/engine';
import { Board } from '../board/Board';
import { ClaimDialog } from '../panels/ClaimDialog';
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
  const faceUpIndexes = legal.find((a) => a.type === 'drawFaceUp')?.indexes ?? [];
  const canDrawBlind = legal.some((a) => a.type === 'drawBlind');
  const claim = legal.find((a) => a.type === 'claimRoute');
  const claimable = new Set<RouteId>(claim && claim.type === 'claimRoute' ? claim.routes : []);
  const [claiming, setClaiming] = useState<RouteId | undefined>();
  const claimingRoute = claiming && claimable.has(claiming) ? ROUTE_BY_ID.get(claiming) : undefined;
  const myTurn = view.phase !== 'setup' && view.currentPlayer === view.me.id;
  const secondDraw = myTurn && view.phase === 'drewOne';
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
            {secondDraw ? 'Your turn: draw one more card.' : 'Your turn.'}
          </p>
        )}
        {rejection && (
          <p className="rejection" role="alert">
            {rejection}
          </p>
        )}
        {claimingRoute && (
          <ClaimDialog
            key={claimingRoute.id}
            route={claimingRoute}
            hand={view.me.hand}
            onClaim={(cards) => {
              client.send({
                type: 'action',
                action: { type: 'claimRoute', routeId: claimingRoute.id, cards },
              });
              setClaiming(undefined);
            }}
            onCancel={() => setClaiming(undefined)}
          />
        )}
        <Board
          claimed={view.claimed}
          playerColours={playerColours}
          claimable={claimable}
          onRouteClick={setClaiming}
        />
      </section>
      <aside className="sidebar">
        <Players view={view} />
        <Table
          faceUp={view.faceUp}
          trainDeckSize={view.trainDeckSize}
          discardSize={view.discardSize}
          ticketDeckSize={view.ticketDeckSize}
          faceUpIndexes={faceUpIndexes}
          canDrawBlind={canDrawBlind}
          onDrawFaceUp={(index) =>
            client.send({ type: 'action', action: { type: 'drawFaceUp', index } })
          }
          onDrawBlind={() => client.send({ type: 'action', action: { type: 'drawBlind' } })}
        />
        <Hand hand={view.me.hand} />
        <Tickets tickets={view.me.tickets} />
      </aside>
    </main>
  );
}
