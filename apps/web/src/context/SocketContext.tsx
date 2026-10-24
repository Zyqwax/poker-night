import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ActionType,
  Card,
  HandWinner,
  RoomSettings,
  RoomStatePayload,
  SOCKET_EVENTS,
  parseRoomCode,
} from '@poker-night/shared';
import {
  getOrCreatePlayerId,
  getSavedNick,
  saveNick,
  saveRecentRoom,
  getActiveRoom,
  saveActiveRoom,
  clearActiveRoom,
} from '../utils/storage.js';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  playerId: string;
  nick: string;
  setNick: (newNick: string) => void;
  roomState: RoomStatePayload | null;
  activeRoomCode: string | null;
  myHoleCards: Card[];
  showdownData: { cardsByPlayer: Record<string, Card[]>; winners: HandWinner[] } | null;
  lastError: string | null;
  clearError: () => void;
  createRoom: (customSettings?: Partial<RoomSettings>) => void;
  joinRoom: (code: string) => void;
  leaveRoom: () => void;
  abandonActiveRoom: (code?: string) => void;
  toggleReady: () => void;
  startGame: () => void;
  sendAction: (action: ActionType, amount?: number) => void;
  updateSettings: (settings: Partial<RoomSettings>) => void;
  rebuy: () => void;
  kickPlayer: (targetPlayerId: string) => void;
  restartGame: () => void;
  returnToLobby: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [playerId] = useState<string>(() => getOrCreatePlayerId());
  const [nick, setNickState] = useState<string>(() => getSavedNick());
  const [roomState, setRoomState] = useState<RoomStatePayload | null>(null);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(() => getActiveRoom());
  const [myHoleCards, setMyHoleCards] = useState<Card[]>([]);
  const [showdownData, setShowdownData] = useState<{
    cardsByPlayer: Record<string, Card[]>;
    winners: HandWinner[];
  } | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const setNick = useCallback((newNick: string) => {
    saveNick(newNick);
    setNickState(newNick);
  }, []);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  // Initialize socket connection
  useEffect(() => {
    // In production or local dev, Socket.IO connects to origin (Vite proxies /socket.io in dev)
    const s = io({
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    });

    s.on('connect', () => {
      setIsConnected(true);
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    s.on(SOCKET_EVENTS.ROOM_STATE, (payload: RoomStatePayload) => {
      setRoomState(payload);
      saveRecentRoom(payload.code);
      saveActiveRoom(payload.code);
      setActiveRoomCode(payload.code);
      // Clear showdown data if a new active hand starts
      if (payload.game && payload.game.stage !== 'ended') {
        setShowdownData(null);
      }
    });

    s.on(SOCKET_EVENTS.GAME_HOLE_CARDS, (data: { cards: Card[] }) => {
      setMyHoleCards(data.cards || []);
    });

    s.on(
      SOCKET_EVENTS.GAME_SHOWDOWN,
      (data: { cardsByPlayer: Record<string, Card[]>; winners: HandWinner[] }) => {
        setShowdownData(data);
      }
    );

    s.on(SOCKET_EVENTS.ROOM_ERROR, (err: { message: string }) => {
      setLastError(err.message);
      if (err.message && err.message.toLowerCase().includes('oda bulunamadı')) {
        clearActiveRoom();
        setActiveRoomCode(null);
      }
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  const createRoom = useCallback(
    (customSettings?: Partial<RoomSettings>) => {
      if (!socket) return;
      clearError();
      socket.emit(SOCKET_EVENTS.ROOM_CREATE, {
        playerId,
        nick,
        settings: customSettings,
      });
    },
    [socket, playerId, nick, clearError]
  );

  const joinRoom = useCallback(
    (code: string) => {
      if (!socket) return;
      clearError();
      socket.emit(SOCKET_EVENTS.ROOM_JOIN, {
        code: parseRoomCode(code),
        playerId,
        nick,
      });
    },
    [socket, playerId, nick, clearError]
  );

  const leaveRoom = useCallback(() => {
    if (!socket) return;
    const code = roomState?.code || activeRoomCode;
    socket.emit(SOCKET_EVENTS.ROOM_LEAVE, { code, playerId });
    clearActiveRoom();
    setActiveRoomCode(null);
    setRoomState(null);
    setMyHoleCards([]);
    setShowdownData(null);
  }, [socket, roomState, activeRoomCode, playerId]);

  const abandonActiveRoom = useCallback(
    (code?: string) => {
      if (!socket) return;
      const targetCode = code || activeRoomCode || roomState?.code;
      socket.emit(SOCKET_EVENTS.ROOM_LEAVE, { code: targetCode, playerId });
      clearActiveRoom();
      setActiveRoomCode(null);
      setRoomState(null);
      setMyHoleCards([]);
      setShowdownData(null);
    },
    [socket, activeRoomCode, roomState, playerId]
  );

  const toggleReady = useCallback(() => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.ROOM_TOGGLE_READY);
  }, [socket]);

  const startGame = useCallback(() => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.GAME_START);
  }, [socket]);

  const sendAction = useCallback(
    (action: ActionType, amount?: number) => {
      if (!socket) return;
      socket.emit(SOCKET_EVENTS.GAME_ACTION, { action, amount });
    },
    [socket]
  );

  const updateSettings = useCallback(
    (settings: Partial<RoomSettings>) => {
      if (!socket) return;
      socket.emit(SOCKET_EVENTS.ROOM_UPDATE_SETTINGS, settings);
    },
    [socket]
  );

  const rebuy = useCallback(() => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.GAME_REBUY);
  }, [socket]);

  const kickPlayer = useCallback(
    (targetPlayerId: string) => {
      if (!socket) return;
      socket.emit(SOCKET_EVENTS.ROOM_KICK_PLAYER, { targetPlayerId });
    },
    [socket]
  );

  const restartGame = useCallback(() => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.GAME_RESTART);
  }, [socket]);

  const returnToLobby = useCallback(() => {
    if (!socket) return;
    socket.emit(SOCKET_EVENTS.GAME_RETURN_TO_LOBBY);
  }, [socket]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        playerId,
        nick,
        setNick,
        roomState,
        activeRoomCode,
        myHoleCards,
        showdownData,
        lastError,
        clearError,
        createRoom,
        joinRoom,
        leaveRoom,
        abandonActiveRoom,
        toggleReady,
        startGame,
        sendAction,
        updateSettings,
        rebuy,
        kickPlayer,
        restartGame,
        returnToLobby,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
