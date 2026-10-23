# Railyard: online Ticket to Ride for friends

Draft spec synthesised from the design interview of 2026-10-23. Vocabulary follows `GLOSSARY.md`; the architecture is in `docs/architecture.md` and ADR 0001.

## Problem Statement

A group of friends who enjoy Ticket to Ride cannot play together when they are in different places. Existing online versions require accounts, cost money, or lack the exact USA rules they know. They want to open a link, type a name, and play a faithful game of the classic USA map with two to five people, with no setup beyond sharing a code.

## Solution

A web app called Railyard. One person creates a game and gets a short join code. Others open the site, enter the code and a nickname, and pick a colour. When the host starts, the official 2015 USA rules run on a server that nobody can cheat: each player sees only their own hand and tickets, the board updates for everyone as routes are claimed, and the game scores itself at the end, including the longest path bonus and tie-breaks. A player who loses connection reopens the page and continues where they were. The board is a schematic drawn from the real city and route data, in the project's own style.

## User Stories

### Lobby

1. As a host, I want to create a game and receive a short join code, so that I can share it with friends.
2. As a player, I want to join a game by entering the code and a nickname, so that I need no account.
3. As a player, I want to choose one of the five train colours, so that my trains are recognisable on the board.
4. As a player, I want to see who has joined and which colours are taken, so that I know when we are ready.
5. As a host, I want to start the game once two to five players are present, so that we can begin when everyone has arrived.
6. As a player, I want turn order and the first player chosen at random, so that nobody has to decide who is "the most experienced traveler".

### Setup

7. As a player, I want to receive four train cards and three tickets at the start, so that setup matches the rulebook.
8. As a player, I want to choose which of my three starting tickets to keep, keeping at least two, so that I can plan my game.
9. As a player, I want returned tickets to go to the bottom of the ticket deck, so that the deck behaves like the physical one.
10. As a player, I want to see five face-up cards beside the deck from the start, so that I can plan my first draw.

### Taking a turn

11. As the current player, I want to know it is my turn, so that I do not wait on someone else.
12. As a player waiting, I want to see whose turn it is and what they did last, so that I can follow the game.
13. As the current player, I want to draw a face-up card and see it replaced immediately, so that I can decide my second draw with full information.
14. As the current player, I want to draw a blind card from the deck, so that I can gamble on what I need.
15. As the current player, I want taking a face-up locomotive to end my draw, so that the rulebook's locomotive rule is enforced.
16. As the current player, I want to be prevented from taking a face-up locomotive as my second card, so that the rule is enforced rather than left to honesty.
17. As a player, I want a blind-drawn locomotive to count as one card, so that I still get two draws.
18. As a player, I want the five face-up cards to be discarded and redealt whenever three of them are locomotives, so that the rulebook is followed.
19. As a player, I want the discard pile reshuffled into a new deck when the deck runs out, so that the game continues.
20. As a player, I want drawing to be unavailable when both the deck and the discards are empty, so that the rare hoarding case is handled as the rulebook says.
21. As the current player, I want to click an unclaimed route and choose which cards to spend, so that claiming is a single clear action.
22. As the current player, I want the claim dialog to offer only valid card combinations, so that I cannot submit an illegal claim.
23. As the current player, I want grey routes to accept any single colour plus locomotives, so that grey routes work as printed.
24. As a player, I want a route I cannot afford or cannot legally claim to be visibly disabled, so that I do not have to guess.
25. As a player, I want my trains to appear on a claimed route in my colour and my score to rise by the route's value, so that the board reflects the game.
26. As a player in a two or three player game, I want the twin of a claimed double route to become unavailable to everyone, so that the player-count rule is enforced.
27. As a player in a four or five player game, I want to be prevented from claiming both twins of a double route, so that the rule is enforced.
28. As the current player, I want to draw three tickets and keep at least one, so that I can take on new goals mid-game.
29. As the current player, I want to draw fewer tickets when fewer than three remain, so that a short deck does not block the action.
30. As a player, I want my turn to end automatically after a complete action, so that play moves on without a confirm button.
31. As a player, I want the server to reject any action that breaks a rule with a clear reason, so that the game cannot be corrupted by a buggy or modified client.

### Information

32. As a player, I want to see my own hand grouped by colour with counts, so that I can plan claims.
33. As a player, I want to see my kept tickets and whether each is currently completed, so that I know what I still need.
34. As a player, I want to see every other player's score, trains left, hand size and ticket count, so that I have the same information as at a table.
35. As a player, I want never to receive another player's hand or tickets, even in the data sent to my browser, so that cheating is impossible.
36. As a player, I want to see the number of cards left in the train deck and the ticket deck, so that I can judge the end of the game.

### End of game

37. As a player, I want the final round to begin when any player ends a turn with two or fewer trains, so that the game ends as the rulebook says.
38. As a player, I want everyone, including the player who triggered it, to get exactly one more turn, so that the final round is fair.
39. As a player, I want all tickets revealed at the end, with completed ones added and failed ones subtracted, so that scoring is transparent.
40. As a player, I want the longest path bonus computed correctly, including loops and cities visited twice, with ties sharing the bonus, so that the rulebook's definition is honoured.
41. As a player, I want the winner decided by points, then completed tickets, then the longest path card, so that ties resolve as the rulebook says.
42. As a player, I want a score breakdown per player (routes, tickets won, tickets lost, longest path), so that I can see how the result came about.
43. As a host, I want to start a rematch with the same players and a fresh shuffle, so that we can play again without re-entering the lobby.

### Reliability

44. As a player, I want to reconnect after closing the tab or losing network and resume with my current view, so that a dropped connection does not end my game.
45. As a player, I want the game to wait for a disconnected player with no time limit, so that nobody is penalised for a flaky connection.
46. As a player, I want to see which players are currently disconnected, so that I know why the game is waiting.
47. As a developer, I want any game to be reproducible from its seed and action log, so that bugs reported by players can be replayed exactly.

## Implementation Decisions

- Three packages in a pnpm workspace: a pure engine, a Node server, and a React client. Client and server depend on the engine; the engine depends on nothing (ADR 0001).
- The engine exposes `apply(state, action)` returning either a new state or a rule violation, `legalActions(state, playerId)`, `createGame(players, seed)`, and `redact(state, playerId)` producing a player view. It never mutates input and uses a seeded random generator for all shuffles.
- Actions, one per decision point: `chooseInitialTickets`, `drawFaceUp`, `drawBlind`, `claimRoute`, `drawTickets`, `chooseTickets`. Drawing train cards is two separate actions within a turn.
- Game phases: Setup, TurnStart, DrewOne, ChoosingTickets, EndTurn (transient), FinalRound, Finished. The turn state machine in `docs/architecture.md` is authoritative.
- The USA map is data: 36 cities with normalised coordinates, 100 routes on 78 city pairs, 30 tickets, 110 train cards (12 per colour plus 14 locomotives), 45 trains per player, route values 1, 2, 4, 7, 10, 15.
- The server keeps rooms in memory. A room moves lobby → playing → finished. Each accepted action is appended to the room's action log and the state replaced. After every accepted action, each connected player receives a full redacted snapshot. Rejections go only to the acting player.
- Protocol is JSON over a WebSocket. Client messages: create, join, start, action, rematch. Server messages: joined (with reconnect token), lobby, snapshot, rejected, error.
- Reconnect tokens are random, issued on join, stored by the browser, and map to a player in a room.
- The client renders the board as SVG from the city coordinates and route data. It imports the engine only to compute legal actions for its own view and grey out controls. It holds no rule logic of its own.
- Turn order and the first player are random at start. Join codes are six characters from an unambiguous alphabet.
- Project name in code and UI is Railyard. Repository name stays as is.

## Testing Decisions

- A good test drives the public seam and asserts observable outcomes: the resulting state or view, or the violation returned. Tests do not inspect internals such as deck order except through the seed.
- Engine seam: `apply` and `legalActions` on states built by `createGame` with known seeds, plus hand-built states for edge cases. One test per rule in the rulebook, including each locomotive rule, the three-locomotive reshuffle, deck exhaustion, double-route rules at each player count, short ticket deck, final-round trigger, scoring, longest path with loops, and tie-breaks. A property test replays random action logs and asserts the replayed state equals the live state.
- Server seam: integration tests that open two or more WebSocket clients against an in-process server and play a short scripted game, asserting on the snapshots each client receives and that no client ever receives another player's hand.
- Client: component tests for the board's route hit-testing and the claim dialog's card choices. Screens are verified by playing.
- No prior art exists in the repository; these tests establish the conventions.

## Out of Scope

Spectators, chat, sound, turn timers, kicking or abandoning players, bots, accounts, persistence across server restarts, other maps or expansions, mobile-first layout, localisation.

## Further Notes

- The Days of Wonder artwork and the Ticket to Ride name are protected. The app uses its own schematic style and the name Railyard. City names and route data are facts.
- Game state is small (well under 10 KB), so full snapshots after each action are cheap. Moving to event streams later would be for animation, not performance.
- The seed-plus-log design means persistence, if ever wanted, is a matter of writing the log to disk and replaying on restart.
