import { randomBytes, randomInt } from 'node:crypto';
import {
  apply,
  createGame,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COLOURS,
  redact,
  type Action,
  type GameState,
  type LoggedAction,
  type PlayerColour,
  type PlayerId,
} from '@railyard/engine';
import type { LobbyPlayer, Presence, ServerMessage } from '@railyard/protocol';

/** Something that can receive server messages: a socket, or a test double. */
export interface Outbox {
  send(message: ServerMessage): void;
}

export interface Seat {
  id: PlayerId;
  name: string;
  colour: PlayerColour;
  token: string;
  outbox: Outbox | undefined;
}

export interface Room {
  code: string;
  hostId: PlayerId;
  seats: Seat[];
  status: 'lobby' | 'playing' | 'finished';
  game: GameState | undefined;
  log: LoggedAction[];
}

export class RoomError extends Error {}

/** Unambiguous alphabet: no 0/O or 1/I. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export interface RoomManagerOptions {
  /** Override randomness in tests. Defaults to crypto. */
  randomCode?: () => string;
  randomSeed?: () => number;
  randomOrder?: <T>(items: T[]) => T[];
}

function cryptoCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

function cryptoShuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private byToken = new Map<string, { room: Room; seat: Seat }>();
  private readonly randomCode: () => string;
  private readonly randomSeed: () => number;
  private readonly randomOrder: <T>(items: T[]) => T[];

  constructor(options: RoomManagerOptions = {}) {
    this.randomCode = options.randomCode ?? cryptoCode;
    this.randomSeed = options.randomSeed ?? (() => randomInt(0, 2 ** 31));
    this.randomOrder = options.randomOrder ?? cryptoShuffle;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  /** Create a room with its host seated. Returns the room and the host's seat. */
  create(name: string, colour: PlayerColour, outbox: Outbox): { room: Room; seat: Seat } {
    validateName(name);
    validateColour(colour);
    let code = this.randomCode();
    while (this.rooms.has(code)) code = this.randomCode();
    const seat = this.newSeat(name, colour, outbox);
    const room: Room = {
      code,
      hostId: seat.id,
      seats: [seat],
      status: 'lobby',
      game: undefined,
      log: [],
    };
    this.rooms.set(code, room);
    this.byToken.set(seat.token, { room, seat });
    seat.outbox?.send(this.joinedMessage(room, seat));
    this.broadcastLobby(room);
    return { room, seat };
  }

  join(
    code: string,
    name: string,
    colour: PlayerColour,
    outbox: Outbox,
  ): { room: Room; seat: Seat } {
    const room = this.get(code);
    if (!room) throw new RoomError('No game with that code');
    if (room.status !== 'lobby') throw new RoomError('That game has already started');
    if (room.seats.length >= MAX_PLAYERS) throw new RoomError('That game is full');
    validateName(name);
    validateColour(colour);
    if (room.seats.some((s) => s.name.toLowerCase() === name.trim().toLowerCase()))
      throw new RoomError('That nickname is taken');
    if (room.seats.some((s) => s.colour === colour)) throw new RoomError('That colour is taken');
    const seat = this.newSeat(name, colour, outbox);
    room.seats.push(seat);
    this.byToken.set(seat.token, { room, seat });
    seat.outbox?.send(this.joinedMessage(room, seat));
    this.broadcastLobby(room);
    return { room, seat };
  }

  /**
   * Reattach a socket to its seat and resend the current state. During a game
   * everyone gets a fresh snapshot so their table shows the player is back.
   */
  reconnect(token: string, outbox: Outbox): { room: Room; seat: Seat } {
    const found = this.byToken.get(token);
    if (!found) throw new RoomError('Unknown reconnect token');
    const { room, seat } = found;
    seat.outbox = outbox;
    outbox.send(this.joinedMessage(room, seat));
    this.broadcastLobby(room);
    this.broadcastSnapshots(room);
    return { room, seat };
  }

  /** Mark a seat disconnected and tell the others. The game keeps waiting for them. */
  disconnect(seat: Seat, outbox: Outbox): void {
    if (seat.outbox !== outbox) return;
    seat.outbox = undefined;
    const found = this.byToken.get(seat.token);
    if (!found) return;
    this.broadcastLobby(found.room);
    this.broadcastSnapshots(found.room);
  }

  start(room: Room, byPlayerId: PlayerId): void {
    if (room.hostId !== byPlayerId) throw new RoomError('Only the host can start the game');
    if (room.status !== 'lobby') throw new RoomError('That game has already started');
    if (room.seats.length < MIN_PLAYERS)
      throw new RoomError(`Need at least ${MIN_PLAYERS} players to start`);
    this.deal(room);
  }

  /** Same seats and colours, new order and seed, straight into the deal. */
  rematch(room: Room, byPlayerId: PlayerId): void {
    if (room.hostId !== byPlayerId) throw new RoomError('Only the host can start a rematch');
    if (room.status !== 'finished') throw new RoomError('The game is not over yet');
    this.deal(room);
  }

  private deal(room: Room): void {
    const order = this.randomOrder(room.seats);
    room.game = createGame(
      order.map((s) => ({ id: s.id, name: s.name, colour: s.colour })),
      this.randomSeed(),
    );
    room.log = [];
    room.status = 'playing';
    this.broadcastSnapshots(room);
  }

  /**
   * Run one player's action through the engine. On success the action joins
   * the room's log, the state is replaced and everyone gets a fresh snapshot.
   * On a rule violation the caller gets a RoomError and nothing else changes.
   */
  act(room: Room, playerId: PlayerId, action: Action): void {
    if (!room.game || room.status === 'lobby') throw new RoomError('The game has not started');
    const result = apply(room.game, playerId, action);
    if (!result.ok) throw new RoomError(result.violation.message);
    room.game = result.state;
    room.log.push({ playerId, action });
    if (result.state.phase === 'finished') room.status = 'finished';
    this.broadcastSnapshots(room);
  }

  broadcastSnapshots(room: Room): void {
    if (!room.game) return;
    for (const seat of room.seats) this.sendSnapshot(room, seat);
  }

  private sendSnapshot(room: Room, seat: Seat): void {
    if (!room.game) return;
    seat.outbox?.send({
      type: 'snapshot',
      view: redact(room.game, seat.id),
      presence: this.presence(room),
    });
  }

  private presence(room: Room): Presence[] {
    return room.seats.map((s) => ({ id: s.id, connected: s.outbox !== undefined }));
  }

  private broadcastLobby(room: Room): void {
    const msg = this.lobbyMessage(room);
    for (const seat of room.seats) seat.outbox?.send(msg);
  }

  private lobbyMessage(room: Room): ServerMessage {
    const players: LobbyPlayer[] = room.seats.map((s) => ({
      id: s.id,
      name: s.name,
      colour: s.colour,
      connected: s.outbox !== undefined,
    }));
    return { type: 'lobby', code: room.code, hostId: room.hostId, players };
  }

  private joinedMessage(room: Room, seat: Seat): ServerMessage {
    return {
      type: 'joined',
      code: room.code,
      playerId: seat.id,
      token: seat.token,
      hostId: room.hostId,
    };
  }

  private newSeat(name: string, colour: PlayerColour, outbox: Outbox): Seat {
    return {
      id: randomBytes(6).toString('hex'),
      name: name.trim(),
      colour,
      token: randomBytes(18).toString('base64url'),
      outbox,
    };
  }
}

function validateName(name: string): void {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 20)
    throw new RoomError('Nickname must be 1 to 20 characters');
}

function validateColour(colour: string): asserts colour is PlayerColour {
  if (!(PLAYER_COLOURS as readonly string[]).includes(colour))
    throw new RoomError('Pick one of the five train colours');
}
