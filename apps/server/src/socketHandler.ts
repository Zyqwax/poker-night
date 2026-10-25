import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { SOCKET_EVENTS, parseRoomCode } from '@poker-night/shared';
import { RoomManager } from './roomManager.js';
import { DealerBot } from './dealerBot.js';

const createRoomSchema = z.object({
  nick: z.string().trim().min(2, 'Nick en az 2 karakter olmalıdır').max(16, 'Nick en fazla 16 karakter olabilir'),
  playerId: z.string().min(1),
  settings: z
    .object({
      maxPlayers: z.number().int().min(2).max(10).optional(),
      startingChips: z.number().int().min(100).max(100000).optional(),
      smallBlind: z.number().int().min(1).optional(),
      bigBlind: z.number().int().min(2).optional(),
      ante: z.number().int().min(0).optional(),
      blindIncreaseInterval: z.number().int().min(0).optional(),
      turnTimeSeconds: z.number().int().min(10).max(120).optional(),
      disconnectToleranceSeconds: z.number().int().min(10).max(300).optional(),
      autoStart: z.boolean().optional(),
      rebuy: z.boolean().optional(),
    })
    .optional(),
});

const joinRoomSchema = z.object({
  code: z.string().min(6),
  nick: z.string().trim().min(2).max(16),
  playerId: z.string().min(1),
});

const actionSchema = z.object({
  action: z.enum(['fold', 'check', 'call', 'raise', 'all-in']),
  amount: z.number().int().positive().optional(),
});

export function setupSocketHandlers(io: Server, roomManager: RoomManager, dealerBot: DealerBot): void {
  io.on('connection', (socket: Socket) => {
    const ip = socket.handshake.address || socket.conn.remoteAddress || 'unknown';

    // Room Create
    socket.on(SOCKET_EVENTS.ROOM_CREATE, (rawPayload: unknown) => {
      try {
        const payload = createRoomSchema.parse(rawPayload);
        const room = roomManager.createRoom(
          payload.playerId,
          payload.nick,
          socket.id,
          ip,
          payload.settings
        );
        socket.join(room.code);
        socket.data.roomCode = room.code;
        socket.data.playerId = payload.playerId;

        dealerBot.broadcastRoomState(room);
      } catch (err: any) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
          message: err?.issues ? err.issues[0].message : err.message || 'Oda kurulamadı',
        });
      }
    });

    // Room Join
    socket.on(SOCKET_EVENTS.ROOM_JOIN, (rawPayload: unknown) => {
      try {
        if (!roomManager.checkRateLimit(ip)) {
          throw new Error('Çok fazla hatalı deneme yapıldı. Lütfen 5 dakika sonra tekrar dene.');
        }

        const payload = joinRoomSchema.parse(rawPayload);
        const room = roomManager.joinRoom(
          payload.code,
          payload.playerId,
          payload.nick,
          socket.id,
          ip
        );

        socket.join(room.code);
        socket.data.roomCode = room.code;
        socket.data.playerId = payload.playerId;

        dealerBot.broadcastRoomState(room);
      } catch (err: any) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
          message: err?.issues ? err.issues[0].message : err.message || 'Odaya katılım başarısız',
        });
      }
    });

    // Toggle Ready
    socket.on(SOCKET_EVENTS.ROOM_TOGGLE_READY, () => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      if (!roomCode || !playerId) return;

      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      const player = room.players.find((p) => p.id === playerId);
      if (!player) return;

      player.isReady = !player.isReady;
      dealerBot.broadcastRoomState(room);

      // Auto start if enabled and all players are ready
      if (
        room.settings.autoStart &&
        !room.isGameActive &&
        room.players.length >= 2 &&
        room.players.every((p) => p.isReady)
      ) {
        dealerBot.startHand(room);
      }
    });

    // Host Start Game
    socket.on(SOCKET_EVENTS.GAME_START, () => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      if (!roomCode || !playerId) return;

      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      if (room.hostPlayerId !== playerId) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: 'Yalnızca kurucu oyunu başlatabilir.' });
        return;
      }

      if (room.players.length < 2) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: 'Oyunu başlatmak için en az 2 oyuncu gerekir.' });
        return;
      }

      dealerBot.startHand(room);
    });

    // Update Room Settings
    socket.on(SOCKET_EVENTS.ROOM_UPDATE_SETTINGS, (newSettings: unknown) => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      if (!roomCode || !playerId) return;

      const room = roomManager.getRoom(roomCode);
      if (!room || room.hostPlayerId !== playerId) return;

      const parsed = z
        .object({
          turnTimeSeconds: z.number().int().min(10).max(120).optional(),
          disconnectToleranceSeconds: z.number().int().min(10).max(300).optional(),
          blindIncreaseInterval: z.number().int().min(0).optional(),
          autoStart: z.boolean().optional(),
          rebuy: z.boolean().optional(),
          // Blinds and chips can only be changed before game starts
          startingChips: z.number().int().min(100).max(100000).optional(),
          smallBlind: z.number().int().min(1).optional(),
          bigBlind: z.number().int().min(2).optional(),
          ante: z.number().int().min(0).optional(),
          maxPlayers: z.number().int().min(2).max(10).optional(),
        })
        .safeParse(newSettings);

      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: 'Geçersiz ayarlar' });
        return;
      }

      if (room.isGameActive) {
        // Blind and chip settings cannot be modified once game has started
        const { startingChips, smallBlind, bigBlind, ante, maxPlayers, ...allowed } = parsed.data;
        Object.assign(room.settings, allowed);
      } else {
        Object.assign(room.settings, parsed.data);
      }

      dealerBot.broadcastRoomState(room);
    });

    // Player Game Action
    socket.on(SOCKET_EVENTS.GAME_ACTION, (rawPayload: unknown) => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      if (!roomCode || !playerId) return;

      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      try {
        const { action, amount } = actionSchema.parse(rawPayload);
        dealerBot.handlePlayerAction(room, playerId, { type: action, amount });
      } catch (err: any) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
          message: err?.issues ? err.issues[0].message : err.message || 'Hamle uygulanamadı',
        });
      }
    });

    // Rebuy
    socket.on(SOCKET_EVENTS.GAME_REBUY, () => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      if (!roomCode || !playerId) return;

      const room = roomManager.getRoom(roomCode);
      if (!room || !room.settings.rebuy) return;

      const player = room.players.find((p) => p.id === playerId);
      if (!player || player.chips > 0) return;

      player.chips = room.settings.startingChips;
      player.status = 'active';
      player.isReady = true;

      dealerBot.broadcastRoomState(room);
    });

    // Restart Game (Host only)
    socket.on(SOCKET_EVENTS.GAME_RESTART, () => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      if (!roomCode || !playerId) return;

      const room = roomManager.getRoom(roomCode);
      if (!room || room.hostPlayerId !== playerId) return;

      dealerBot.restartGame(room);
    });

    // Return to Lobby (Host or sole remaining player)
    socket.on(SOCKET_EVENTS.GAME_RETURN_TO_LOBBY, () => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      if (!roomCode || !playerId) return;

      const room = roomManager.getRoom(roomCode);
      if (!room) return;
      if (room.hostPlayerId !== playerId && room.players.length > 1) return;

      dealerBot.returnToLobby(room);
    });

    // Leave Room
    socket.on(SOCKET_EVENTS.ROOM_LEAVE, (rawPayload?: unknown) => {
      let roomCode = socket.data.roomCode;
      let playerId = socket.data.playerId;

      if ((!roomCode || !playerId) && typeof rawPayload === 'object' && rawPayload !== null) {
        const p = rawPayload as { code?: string; playerId?: string };
        if (p.code) roomCode = parseRoomCode(p.code);
        if (p.playerId) playerId = p.playerId;
      }

      if (!roomCode || !playerId) return;

      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      // If player is in active hand, fold them
      if (room.engine && room.isGameActive) {
        const enginePlayer = room.engine.players.find((p) => p.id === playerId);
        if (enginePlayer && enginePlayer.status === 'active') {
          try {
            dealerBot.handlePlayerAction(room, playerId, { type: 'fold' });
          } catch {}
        }
      }

      roomManager.leaveRoom(room, playerId);
      socket.leave(roomCode);
      delete socket.data.roomCode;

      if (roomManager.getRoom(roomCode)) {
        if (room.isGameActive && room.players.length <= 1) {
          dealerBot.returnToLobby(room, 'Odada tek kişi kaldığı için oyun kapatıldı ve lobiye dönüldü.');
        } else {
          dealerBot.broadcastRoomState(room);
        }
      }
    });

    // Kick Player (Host only)
    socket.on(SOCKET_EVENTS.ROOM_KICK_PLAYER, (rawPayload: unknown) => {
      const roomCode = socket.data.roomCode;
      const hostPlayerId = socket.data.playerId;
      if (!roomCode || !hostPlayerId) return;

      const room = roomManager.getRoom(roomCode);
      if (!room || room.hostPlayerId !== hostPlayerId) {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: 'Yalnızca kurucu oyuncuları atabilir.' });
        return;
      }

      const parsed = z.object({ targetPlayerId: z.string().min(1) }).safeParse(rawPayload);
      if (!parsed.success) return;

      const targetPlayerId = parsed.data.targetPlayerId;
      if (targetPlayerId === hostPlayerId) return;

      const targetPlayer = room.players.find((p) => p.id === targetPlayerId);
      if (!targetPlayer) return;

      // If player is in active hand, fold them
      if (room.engine && room.isGameActive) {
        const enginePlayer = room.engine.players.find((p) => p.id === targetPlayerId);
        if (enginePlayer && enginePlayer.status === 'active') {
          try {
            dealerBot.handlePlayerAction(room, targetPlayerId, { type: 'fold' });
          } catch {}
        }
      }

      const targetSocket = io.sockets.sockets.get(targetPlayer.socketId);
      if (targetSocket) {
        targetSocket.leave(roomCode);
        delete targetSocket.data.roomCode;
        targetSocket.emit(SOCKET_EVENTS.ROOM_ERROR, {
          message: 'Kurucu tarafından odadan çıkarıldınız.',
        });
        targetSocket.emit(SOCKET_EVENTS.ROOM_STATE, null);
      }

      roomManager.leaveRoom(room, targetPlayerId);
      if (roomManager.getRoom(roomCode)) {
        if (room.isGameActive && room.players.length <= 1) {
          dealerBot.returnToLobby(room, 'Odada tek kişi kaldığı için oyun kapatıldı ve lobiye dönüldü.');
        } else {
          dealerBot.broadcastRoomState(room);
        }
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      const res = roomManager.handleDisconnect(socket.id);
      if (res) {
        const { room, player } = res;

        // Check if all players in the room are now disconnected
        const allDisconnected = room.players.length === 0 || room.players.every((p) => !p.isConnected);
        if (allDisconnected) {
          // Schedule room destruction after 60 seconds (grace period for temporary blips or page reload)
          roomManager.scheduleDisconnectCleanup(room.code, 60 * 1000);
        } else {
          dealerBot.broadcastRoomState(room);

          // If it was this player's turn, start the turn timer
          if (
            room.engine &&
            room.engine.currentTurnSeat === player.seatIndex &&
            room.engine.stage !== 'ended'
          ) {
            dealerBot.scheduleTurnTimer(room);
          }
        }
      }
    });
  });
}
