export type Suit = 's' | 'h' | 'd' | 'c';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type PlayerStatus = 'active' | 'folded' | 'all-in' | 'sitting-out';

export interface PlayerPublicState {
  id: string;
  nick: string;
  seatIndex: number;
  chips: number;
  currentRoundBet: number;
  totalHandBet: number;
  status: PlayerStatus;
  isConnected: boolean;
  isReady: boolean;
  isHost: boolean;
  hasActedThisRound: boolean;
  timeRemaining?: number;
}

export interface RoomSettings {
  maxPlayers: number;
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  blindIncreaseInterval: number; // 0 = off, else every N hands
  turnTimeSeconds: number;
  disconnectToleranceSeconds: number;
  autoStart: boolean;
  rebuy: boolean;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 6,
  startingChips: 1000,
  smallBlind: 5,
  bigBlind: 10,
  ante: 0,
  blindIncreaseInterval: 0,
  turnTimeSeconds: 30,
  disconnectToleranceSeconds: 60,
  autoStart: false,
  rebuy: false,
};

export type GameStage = 'idle' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended';

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'all-in';

export interface PlayerAction {
  type: ActionType;
  amount?: number;
}

export interface AvailableActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaiseTotal: number;
  maxRaiseTotal: number;
  canAllIn: boolean;
  allInAmount: number;
}

export interface ShowdownHandResult {
  playerId: string;
  nick: string;
  holeCards: Card[];
  handCategory: number;
  handRankName: string;
  bestFiveCards: Card[];
  wonAmount: number;
}

export interface HandWinner {
  playerId: string;
  nick: string;
  amount: number;
  handRankName?: string;
  cards?: Card[];
}

export interface HandHistoryItem {
  handNumber: number;
  pot: number;
  communityCards: Card[];
  winners: HandWinner[];
  timestamp: number;
  summary: string;
}

export interface PlayerGameStats {
  playerId: string;
  nick: string;
  chips: number;
  handsPlayed: number;
  handsWon: number;
  foldCount: number;
  netProfit: number;
  chipHistory: { handNumber: number; chips: number }[];
}

export interface GamePublicState {
  handNumber: number;
  stage: GameStage;
  pot: number;
  sidePots: SidePot[];
  communityCards: Card[];
  currentTurnSeat: number | null;
  turnEndsAt: number | null;
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  currentHighestBet: number;
  minRaise: number;
  lastAction: {
    playerId: string;
    nick: string;
    action: ActionType;
    amount?: number;
  } | null;
  winners: HandWinner[];
}

export interface RoomStatePayload {
  code: string;
  hostId: string;
  settings: RoomSettings;
  players: PlayerPublicState[];
  isGameActive: boolean;
  game: GamePublicState | null;
  dealerBotStatus: 'ready' | 'dealing' | 'waiting' | 'idle';
  history: HandHistoryItem[];
  stats: PlayerGameStats[];
  isGameOver?: boolean;
  gameWinner?: { playerId: string; nick: string; chips: number } | null;
  notice?: string | null;
}

// Socket Events
export const SOCKET_EVENTS = {
  // Client to Server
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_TOGGLE_READY: 'room:toggle_ready',
  ROOM_UPDATE_SETTINGS: 'room:update_settings',
  GAME_START: 'game:start',
  GAME_ACTION: 'game:action',
  GAME_REBUY: 'game:rebuy',
  GAME_RESTART: 'game:restart',
  GAME_RETURN_TO_LOBBY: 'game:return_to_lobby',
  ROOM_KICK_PLAYER: 'room:kick_player',

  // Server to Client
  ROOM_STATE: 'room:state',
  ROOM_ERROR: 'room:error',
  GAME_HOLE_CARDS: 'game:hole_cards',
  GAME_SHOWDOWN: 'game:showdown',
  NOTIFICATION: 'room:notification',
} as const;

export interface CreateRoomDto {
  nick: string;
  playerId: string;
  settings?: Partial<RoomSettings>;
}

export interface JoinRoomDto {
  code: string;
  nick: string;
  playerId: string;
}

export interface ActionDto {
  action: ActionType;
  amount?: number;
}

export function formatRoomCode(code: string): string {
  const clean = code.replace(/\D/g, '').slice(0, 6);
  if (clean.length > 3) {
    return `${clean.slice(0, 3)} ${clean.slice(3)}`;
  }
  return clean;
}

export function parseRoomCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}
