import {
  HandHistoryItem,
  PlayerGameStats,
  RoomSettings,
} from '@poker-night/shared';
import { EngineGameState, InternalPlayerState } from '@poker-night/engine';

export interface ServerPlayer extends InternalPlayerState {
  socketId: string;
  ip: string;
  joinedAt: number;
  initialChips: number;
}

export interface Room {
  code: string;
  hostPlayerId: string;
  settings: RoomSettings;
  players: ServerPlayer[];
  engine: EngineGameState | null;
  isGameActive: boolean;
  dealerBotStatus: 'ready' | 'dealing' | 'waiting' | 'idle';
  turnTimer: NodeJS.Timeout | null;
  disconnectTimer: NodeJS.Timeout | null;
  stageTimer: NodeJS.Timeout | null;
  history: HandHistoryItem[];
  statsMap: Map<string, PlayerGameStats>;
  lastActivityAt: number;
  previousDealerSeat: number;
}
