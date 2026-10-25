import { Server } from 'socket.io';
import {
  HandWinner,
  SOCKET_EVENTS,
  formatRoomCode,
} from '@poker-night/shared';
import {
  EngineGameState,
  applyAction,
  getAvailableActions,
  initHand,
  toPublicGameState,
} from '@poker-night/engine';
import { Room, ServerPlayer } from './types.js';
import { saveHandRecord, updatePlayerStats } from './db.js';

export class DealerBot {
  constructor(private io: Server) {}

  /**
   * Broadcasts room state to all players in the room, keeping hole cards private!
   */
  public broadcastRoomState(room: Room): void {
    const publicPlayers = room.players.map((p) => ({
      id: p.id,
      nick: p.nick,
      seatIndex: p.seatIndex,
      chips: p.chips,
      currentRoundBet: p.currentRoundBet,
      totalHandBet: p.totalHandBet,
      status: p.status,
      isConnected: p.isConnected,
      isReady: p.isReady,
      isHost: p.id === room.hostPlayerId,
      hasActedThisRound: p.hasActedThisRound,
    }));

    const publicGame = room.engine ? toPublicGameState(room.engine) : null;

    const payload = {
      code: room.code,
      hostId: room.hostPlayerId,
      settings: room.settings,
      players: publicPlayers,
      isGameActive: room.isGameActive,
      game: publicGame,
      dealerBotStatus: room.dealerBotStatus,
      history: room.history.slice(-20),
      stats: Array.from(room.statsMap.values()),
      isGameOver: room.isGameOver || false,
      gameWinner: room.gameWinner || null,
      notice: room.notice || null,
    };

    this.io.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE, payload);

    // Send secret hole cards individually to each connected player
    if (room.engine) {
      for (const p of room.engine.players) {
        const serverPlayer = room.players.find((sp) => sp.id === p.id);
        if (serverPlayer && serverPlayer.isConnected && serverPlayer.socketId) {
          this.io.to(serverPlayer.socketId).emit(SOCKET_EVENTS.GAME_HOLE_CARDS, {
            cards: p.holeCards || [],
          });
        }
      }
    }
  }

  /**
   * Starts a new poker hand
   */
  public startHand(room: Room): void {
    this.clearTimers(room);
    room.notice = null;

    const eligible = room.players.filter((p) => p.chips > 0 && p.isConnected);
    if (eligible.length < 2) {
      room.isGameActive = false;
      room.dealerBotStatus = 'idle';
      this.broadcastRoomState(room);
      return;
    }

    room.isGameActive = true;
    room.dealerBotStatus = 'dealing';

    // Blind increase logic
    const nextHandNum = (room.engine?.handNumber || 0) + 1;
    if (
      room.settings.blindIncreaseInterval > 0 &&
      nextHandNum > 1 &&
      (nextHandNum - 1) % room.settings.blindIncreaseInterval === 0
    ) {
      room.settings.smallBlind *= 2;
      room.settings.bigBlind *= 2;
      if (room.settings.ante > 0) room.settings.ante *= 2;
    }

    try {
      room.engine = initHand(
        room.players,
        room.settings,
        room.previousDealerSeat,
        nextHandNum
      );
      room.previousDealerSeat = room.engine.dealerSeat;
      this.syncEnginePlayersBackToRoom(room);
      this.broadcastRoomState(room);

      // Start turn timer for first to act
      this.scheduleTurnTimer(room);
    } catch (err: any) {
      console.error(`Failed to start hand in room ${room.code}:`, err.message);
      room.isGameActive = false;
      room.dealerBotStatus = 'idle';
      this.broadcastRoomState(room);
    }
  }

  /**
   * Handles player action
   */
  public handlePlayerAction(
    room: Room,
    playerId: string,
    action: { type: any; amount?: number }
  ): void {
    if (!room.engine || room.engine.stage === 'ended' || room.engine.stage === 'idle') {
      throw new Error('No active hand in progress');
    }

    const player = room.engine.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error('Player not found in hand');
    }

    if (room.engine.currentTurnSeat !== player.seatIndex) {
      throw new Error("It is not this player's turn");
    }

    this.clearTimers(room);

    try {
      room.engine = applyAction(room.engine, player, action, room.settings);
      this.syncEnginePlayersBackToRoom(room);
      this.broadcastRoomState(room);

      if (room.engine.stage === 'ended') {
        this.handleHandCompletion(room);
      } else {
        this.scheduleTurnTimer(room);
      }
    } catch (err: any) {
      // Re-schedule turn timer if action threw error
      this.scheduleTurnTimer(room);
      throw err;
    }
  }

  /**
   * Schedules turn timer (with disconnect tolerance if player is offline)
   */
  public scheduleTurnTimer(room: Room): void {
    this.clearTimers(room);
    if (!room.engine || room.engine.currentTurnSeat === null || room.engine.stage === 'ended') {
      return;
    }

    const currentSeat = room.engine.currentTurnSeat;
    const player = room.players.find((p) => p.seatIndex === currentSeat);
    if (!player) return;

    const isConnected = player.isConnected;
    const waitSeconds = isConnected
      ? room.settings.turnTimeSeconds
      : room.settings.disconnectToleranceSeconds;

    room.engine.turnEndsAt = Date.now() + waitSeconds * 1000;

    room.turnTimer = setTimeout(() => {
      this.handleTurnTimeout(room, player.id);
    }, waitSeconds * 1000);
  }

  /**
   * Timeout auto-check or auto-fold
   */
  private handleTurnTimeout(room: Room, playerId: string): void {
    if (!room.engine || room.engine.stage === 'ended') return;
    const player = room.engine.players.find((p) => p.id === playerId);
    if (!player || room.engine.currentTurnSeat !== player.seatIndex) return;

    const actions = getAvailableActions(room.engine, player);
    const actionToTake = actions.canCheck ? { type: 'check' as const } : { type: 'fold' as const };

    try {
      this.handlePlayerAction(room, playerId, actionToTake);
    } catch (e) {
      console.error('Error handling turn timeout:', e);
    }
  }

  /**
   * Finalizes an ended hand, logs history, updates SQLite, and prepares next hand
   */
  public handleHandCompletion(room: Room): void {
    this.clearTimers(room);
    if (!room.engine) return;

    const engine = room.engine;
    const winners = engine.winners;
    const pot = engine.pot;

    // Showdown reveal broadcast
    const showdownHoleCards: Record<string, any> = {};
    for (const p of engine.players) {
      if (p.status !== 'folded' && p.status !== 'sitting-out') {
        showdownHoleCards[p.id] = p.holeCards;
      }
    }
    this.io.to(room.code).emit(SOCKET_EVENTS.GAME_SHOWDOWN, {
      cardsByPlayer: showdownHoleCards,
      winners,
    });

    // Summary line
    const winnerNames = winners.map((w) => `${w.nick} (${w.amount} chip)`).join(', ');
    const summary = `El #${engine.handNumber}: ${winnerNames} kazandı. Toplam Pot: ${pot}`;

    // Record hand history
    const historyItem = {
      handNumber: engine.handNumber,
      pot,
      communityCards: engine.communityCards,
      winners,
      timestamp: Date.now(),
      summary,
    };
    room.history.push(historyItem);

    // Persist to SQLite
    saveHandRecord(
      room.code,
      engine.handNumber,
      pot,
      engine.communityCards,
      winners,
      summary
    );

    // Update player stats
    for (const p of room.players) {
      const isWinner = winners.some((w) => w.playerId === p.id);
      const isFolded = p.status === 'folded';
      const initial = p.initialChips || room.settings.startingChips;
      const netDelta = p.chips - initial;

      updatePlayerStats(p.id, p.nick, isWinner, isFolded, netDelta, p.chips);

      // Update room local stats map
      const existing = room.statsMap.get(p.id) || {
        playerId: p.id,
        nick: p.nick,
        chips: p.chips,
        handsPlayed: 0,
        handsWon: 0,
        foldCount: 0,
        netProfit: 0,
        chipHistory: [],
      };
      existing.chips = p.chips;
      existing.handsPlayed += 1;
      if (isWinner) existing.handsWon += 1;
      if (isFolded) existing.foldCount += 1;
      existing.netProfit = p.chips - initial;
      existing.chipHistory.push({ handNumber: engine.handNumber, chips: p.chips });
      room.statsMap.set(p.id, existing);
    }

    this.broadcastRoomState(room);

    // Check if players have 0 chips
    for (const p of room.players) {
      if (p.chips === 0 && !room.settings.rebuy) {
        p.status = 'sitting-out';
        p.isReady = false;
      }
    }

    // If only 1 player remains in the room, close game and return to lobby immediately
    if (room.players.length <= 1) {
      this.returnToLobby(room, 'Odada tek kişi kaldığı için oyun kapatıldı ve lobiye dönüldü.');
      return;
    }

    const activeChipsPlayers = room.players.filter((p) => p.chips > 0 && p.isConnected);
    if (activeChipsPlayers.length < 2) {
      // Game over! Not enough players with chips. Stay on table and prompt host.
      room.isGameOver = true;
      room.gameWinner =
        activeChipsPlayers.length === 1
          ? {
              playerId: activeChipsPlayers[0].id,
              nick: activeChipsPlayers[0].nick,
              chips: activeChipsPlayers[0].chips,
            }
          : null;
      room.dealerBotStatus = 'waiting';
      this.broadcastRoomState(room);
      return;
    }

    // Normal hand end: leave dealerBotStatus as waiting so host can click "Devam Et"
    room.isGameOver = false;
    room.gameWinner = null;
    room.dealerBotStatus = 'waiting';
    this.broadcastRoomState(room);

    if (room.settings.autoStart) {
      room.stageTimer = setTimeout(() => {
        this.startHand(room);
      }, 5000);
    }
  }

  /**
   * Resets all player chips and restarts game (Host only)
   */
  public restartGame(room: Room): void {
    this.clearTimers(room);
    room.isGameOver = false;
    room.gameWinner = null;
    room.isGameActive = true;
    for (const p of room.players) {
      p.chips = room.settings.startingChips;
      p.status = 'active';
      p.isReady = true;
      p.currentRoundBet = 0;
      p.totalHandBet = 0;
    }
    this.startHand(room);
  }

  /**
   * Ends game and returns room back to waiting lobby
   */
  public returnToLobby(room: Room, notice?: string): void {
    this.clearTimers(room);
    room.isGameOver = false;
    room.gameWinner = null;
    room.isGameActive = false;
    room.dealerBotStatus = 'ready';
    room.engine = null;
    room.notice = notice || null;
    for (const p of room.players) {
      p.isReady = false;
      p.status = 'active';
      p.currentRoundBet = 0;
      p.totalHandBet = 0;
    }
    this.broadcastRoomState(room);
  }

  /**
   * Syncs internal player chips & status back to room server players
   */
  private syncEnginePlayersBackToRoom(room: Room): void {
    if (!room.engine) return;
    for (const ep of room.engine.players) {
      const rp = room.players.find((p) => p.id === ep.id);
      if (rp) {
        rp.chips = ep.chips;
        rp.currentRoundBet = ep.currentRoundBet;
        rp.totalHandBet = ep.totalHandBet;
        rp.status = ep.status;
        rp.hasActedThisRound = ep.hasActedThisRound;
        rp.holeCards = ep.holeCards;
      }
    }
  }

  public clearTimers(room: Room): void {
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
  }
}
