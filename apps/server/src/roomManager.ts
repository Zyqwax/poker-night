import * as crypto from 'node:crypto';
import { DEFAULT_ROOM_SETTINGS, RoomSettings, parseRoomCode } from '@poker-night/shared';
import { Room, ServerPlayer } from './types.js';
import { closeRoom, getRoomHands, saveRoom } from './db.js';

interface RateLimitRecord {
  attempts: number;
  blockedUntil: number;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private ipRateLimits = new Map<string, RateLimitRecord>();

  /**
   * Generates a unique 6-digit room code
   */
  public generateUniqueCode(): string {
    let code = '';
    do {
      code = crypto.randomInt(100000, 999999).toString();
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Check IP rate limit for joining / guessing codes
   */
  public checkRateLimit(ip: string): boolean {
    const record = this.ipRateLimits.get(ip);
    const now = Date.now();
    if (record && record.blockedUntil > now) {
      return false;
    }
    return true;
  }

  public recordFailedAttempt(ip: string): void {
    const now = Date.now();
    const record = this.ipRateLimits.get(ip) || { attempts: 0, blockedUntil: 0 };
    record.attempts += 1;
    if (record.attempts >= 10) {
      record.blockedUntil = now + 5 * 60 * 1000; // 5 min block
      record.attempts = 0;
    }
    this.ipRateLimits.set(ip, record);
  }

  public getRoom(code: string): Room | undefined {
    return this.rooms.get(parseRoomCode(code));
  }

  /**
   * Create a new room
   */
  public createRoom(
    hostPlayerId: string,
    hostNick: string,
    socketId: string,
    ip: string,
    customSettings?: Partial<RoomSettings>
  ): Room {
    const code = this.generateUniqueCode();
    const settings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      ...(customSettings || {}),
    };

    const hostPlayer: ServerPlayer = {
      id: hostPlayerId,
      nick: hostNick,
      seatIndex: 0,
      chips: settings.startingChips,
      currentRoundBet: 0,
      totalHandBet: 0,
      status: 'active',
      isConnected: true,
      isReady: false,
      isHost: true,
      hasActedThisRound: false,
      holeCards: [],
      socketId,
      ip,
      joinedAt: Date.now(),
      initialChips: settings.startingChips,
    };

    const room: Room = {
      code,
      hostPlayerId,
      settings,
      players: [hostPlayer],
      engine: null,
      isGameActive: false,
      dealerBotStatus: 'idle',
      turnTimer: null,
      disconnectTimer: null,
      stageTimer: null,
      history: [],
      statsMap: new Map(),
      lastActivityAt: Date.now(),
      previousDealerSeat: 0,
    };

    this.rooms.set(code, room);
    saveRoom(code, hostPlayerId, settings);
    return room;
  }

  /**
   * Join an existing room
   */
  public joinRoom(
    rawCode: string,
    playerId: string,
    nick: string,
    socketId: string,
    ip: string
  ): Room {
    const code = parseRoomCode(rawCode);
    const room = this.rooms.get(code);

    if (!room) {
      this.recordFailedAttempt(ip);
      throw new Error('Oda bulunamadı. Lütfen 6 haneli kodu kontrol et.');
    }

    this.cancelDisconnectCleanup(room.code);
    room.lastActivityAt = Date.now();

    // Check if player is reconnecting
    const existingPlayer = room.players.find((p) => p.id === playerId);
    if (existingPlayer) {
      existingPlayer.socketId = socketId;
      existingPlayer.ip = ip;
      existingPlayer.isConnected = true;
      existingPlayer.nick = nick; // allow updating nick
      return room;
    }

    // Check nick uniqueness in room
    const nickTaken = room.players.some(
      (p) => p.nick.trim().toLowerCase() === nick.trim().toLowerCase()
    );
    if (nickTaken) {
      throw new Error(`"${nick}" adı bu odada zaten kullanılıyor. Başka bir nick seç.`);
    }

    // Check room capacity
    if (room.players.length >= room.settings.maxPlayers) {
      throw new Error('Oda dolu. Maksimum oyuncu sayısına ulaşıldı.');
    }

    // Find first free seat index from 0 to 9
    const occupiedSeats = new Set(room.players.map((p) => p.seatIndex));
    let freeSeat = 0;
    while (occupiedSeats.has(freeSeat) && freeSeat < 10) {
      freeSeat++;
    }

    const newPlayer: ServerPlayer = {
      id: playerId,
      nick,
      seatIndex: freeSeat,
      chips: room.settings.startingChips,
      currentRoundBet: 0,
      totalHandBet: 0,
      status: room.isGameActive ? 'sitting-out' : 'active',
      isConnected: true,
      isReady: false,
      isHost: false,
      hasActedThisRound: false,
      holeCards: [],
      socketId,
      ip,
      joinedAt: Date.now(),
      initialChips: room.settings.startingChips,
    };

    room.players.push(newPlayer);
    return room;
  }

  /**
   * Handle player disconnect
   */
  public handleDisconnect(socketId: string): { room: Room; player: ServerPlayer } | null {
    for (const room of this.rooms.values()) {
      const player = room.players.find((p) => p.socketId === socketId);
      if (player) {
        player.isConnected = false;
        room.lastActivityAt = Date.now();
        return { room, player };
      }
    }
    return null;
  }

  /**
   * Immediately destroys a room, clears all timers, closes DB record and removes from memory
   */
  public destroyRoom(rawCode: string): void {
    const code = parseRoomCode(rawCode);
    const room = this.rooms.get(code);
    if (!room) return;

    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }
    if (room.disconnectTimer) {
      clearTimeout(room.disconnectTimer);
      room.disconnectTimer = null;
    }
    if (room.stageTimer) {
      clearTimeout(room.stageTimer);
      room.stageTimer = null;
    }

    closeRoom(code);
    this.rooms.delete(code);
  }

  /**
   * Schedule room destruction if all players remain disconnected
   */
  public scheduleDisconnectCleanup(rawCode: string, delayMs = 60000): void {
    const code = parseRoomCode(rawCode);
    const room = this.rooms.get(code);
    if (!room) return;

    if (room.disconnectTimer) {
      clearTimeout(room.disconnectTimer);
    }

    room.disconnectTimer = setTimeout(() => {
      const currentRoom = this.rooms.get(code);
      if (currentRoom) {
        const allDisconnected = currentRoom.players.length === 0 || currentRoom.players.every((p) => !p.isConnected);
        if (allDisconnected) {
          this.destroyRoom(code);
        }
      }
    }, delayMs);
  }

  public cancelDisconnectCleanup(rawCode: string): void {
    const code = parseRoomCode(rawCode);
    const room = this.rooms.get(code);
    if (room && room.disconnectTimer) {
      clearTimeout(room.disconnectTimer);
      room.disconnectTimer = null;
    }
  }

  /**
   * Handle player explicitly leaving room
   */
  public leaveRoom(room: Room, playerId: string): void {
    const idx = room.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return;

    room.lastActivityAt = Date.now();

    // Remove player
    room.players.splice(idx, 1);

    // If room is empty or everyone left/disconnected, destroy room immediately
    if (room.players.length === 0 || room.players.every((p) => !p.isConnected)) {
      this.destroyRoom(room.code);
      return;
    }

    // If host left, pass host status to oldest connected player
    if (room.hostPlayerId === playerId) {
      const nextHost = room.players.find((p) => p.isConnected) || room.players[0];
      if (nextHost) {
        room.hostPlayerId = nextHost.id;
        nextHost.isHost = true;
      }
    }
  }

  /**
   * Periodic cleanup: destroy empty rooms and rooms where all players are disconnected
   */
  public cleanupInactiveRooms(): void {
    const now = Date.now();
    const sixtySecondsAgo = now - 60 * 1000;
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;

    for (const [code, room] of this.rooms.entries()) {
      const allDisconnected = room.players.length === 0 || room.players.every((p) => !p.isConnected);
      if ((allDisconnected && room.lastActivityAt < sixtySecondsAgo) || room.lastActivityAt < twoHoursAgo) {
        this.destroyRoom(code);
      }
    }
  }
}
