import {
  ActionType,
  AvailableActions,
  Card,
  GamePublicState,
  GameStage,
  HandWinner,
  PlayerAction,
  PlayerPublicState,
  PlayerStatus,
  RoomSettings,
  SidePot,
} from '@poker-night/shared';
import { createDeck, shuffleDeck } from './deck.js';
import { HandCategory, detectCurrentBestHand, evaluateBestHand } from './evaluator.js';
import { CalculatedPot, PlayerContribution, awardPots, calculatePots } from './pots.js';

export interface InternalPlayerState extends PlayerPublicState {
  holeCards: Card[];
}

export interface EngineGameState {
  handNumber: number;
  stage: GameStage;
  deck: Card[];
  communityCards: Card[];
  pot: number;
  sidePots: SidePot[];
  currentHighestBet: number;
  minRaiseIncrement: number;
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  currentTurnSeat: number | null;
  turnEndsAt: number | null;
  players: InternalPlayerState[];
  lastAction: {
    playerId: string;
    nick: string;
    action: ActionType;
    amount?: number;
  } | null;
  winners: HandWinner[];
}

/**
 * Finds the next occupied seat clockwise from a given seat index
 */
export function getNextOccupiedSeat(
  players: (PlayerPublicState | InternalPlayerState)[],
  fromSeat: number
): number {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const next = (fromSeat + step) % n;
    const p = players.find((pl) => pl.seatIndex === next);
    if (p) return next;
  }
  return fromSeat;
}

/**
 * Finds the next active (in hand and not folded) player who still has decisions to make (not all-in)
 */
export function getNextPlayerToAct(
  players: InternalPlayerState[],
  fromSeat: number
): number | null {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const next = (fromSeat + step) % n;
    const p = players.find((pl) => pl.seatIndex === next);
    if (p && p.status === 'active') {
      return next;
    }
  }
  return null;
}

/**
 * Check if the current betting round is settled.
 * Round is complete when:
 * 1) Fewer than 2 players remain active (e.g. all but one folded) OR
 * 2) All active players have acted this round AND their currentRoundBet equals currentHighestBet (or they are all-in)
 */
export function isBettingRoundComplete(players: InternalPlayerState[]): boolean {
  const nonFolded = players.filter((p) => p.status !== 'folded' && p.status !== 'sitting-out');
  if (nonFolded.length <= 1) return true;

  const activePlayers = nonFolded.filter((p) => p.status === 'active');
  // If 0 active players (all non-folded are all-in), round is complete
  if (activePlayers.length === 0) return true;

  // If only 1 player is active and all others are all-in, and that 1 player has called the highest bet
  const highestBet = Math.max(...nonFolded.map((p) => p.currentRoundBet), 0);
  const allActed = activePlayers.every((p) => p.hasActedThisRound);
  const allMatched = activePlayers.every((p) => p.currentRoundBet === highestBet);

  return allActed && allMatched;
}

/**
 * Calculates available actions for a specific player
 */
export function getAvailableActions(
  state: EngineGameState,
  player: InternalPlayerState
): AvailableActions {
  if (state.currentTurnSeat !== player.seatIndex || player.status !== 'active') {
    return {
      canFold: false,
      canCheck: false,
      canCall: false,
      callAmount: 0,
      canRaise: false,
      minRaiseTotal: 0,
      maxRaiseTotal: 0,
      canAllIn: false,
      allInAmount: 0,
    };
  }

  const toCall = state.currentHighestBet - player.currentRoundBet;
  const canCheck = toCall === 0;
  const canFold = true;
  const canAllIn = player.chips > 0;
  const allInAmount = player.currentRoundBet + player.chips;

  let canCall = false;
  let callAmount = 0;

  if (toCall > 0) {
    if (player.chips > toCall) {
      canCall = true;
      callAmount = toCall;
    } else {
      // Calling puts player all-in
      canCall = true;
      callAmount = player.chips;
    }
  }

  // Raise
  let canRaise = false;
  let minRaiseTotal = 0;
  let maxRaiseTotal = 0;

  const minRaiseTarget = state.currentHighestBet + state.minRaiseIncrement;
  const neededForMinRaise = minRaiseTarget - player.currentRoundBet;

  if (player.chips > toCall && player.chips >= neededForMinRaise) {
    canRaise = true;
    minRaiseTotal = minRaiseTarget;
    maxRaiseTotal = player.currentRoundBet + player.chips;
  }

  return {
    canFold,
    canCheck,
    canCall,
    callAmount,
    canRaise,
    minRaiseTotal,
    maxRaiseTotal,
    canAllIn,
    allInAmount,
  };
}

/**
 * Initializes a new hand. Deals 2 cards to each player, posts ante & blinds.
 */
export function initHand(
  players: InternalPlayerState[],
  settings: RoomSettings,
  previousDealerSeat: number,
  handNumber: number,
  deckOverride?: Card[]
): EngineGameState {
  const deck = deckOverride || shuffleDeck(createDeck());

  // Determine eligible players who have chips > 0
  const eligiblePlayers = players.filter((p) => p.chips > 0 && p.isConnected);
  if (eligiblePlayers.length < 2) {
    throw new Error('At least 2 players with chips are required to start a hand');
  }

  // Next dealer seat
  const dealerSeat = getNextOccupiedSeat(eligiblePlayers, previousDealerSeat);

  // Position logic (Heads-up vs 3+ players)
  let sbSeat: number;
  let bbSeat: number;
  let firstToActSeat: number;

  if (eligiblePlayers.length === 2) {
    // Heads-up: Dealer is Small Blind, acts first preflop, acts last postflop
    sbSeat = dealerSeat;
    bbSeat = getNextOccupiedSeat(eligiblePlayers, sbSeat);
    firstToActSeat = sbSeat;
  } else {
    // 3+ players: SB is next to Dealer, BB next to SB, UTG acts first preflop
    sbSeat = getNextOccupiedSeat(eligiblePlayers, dealerSeat);
    bbSeat = getNextOccupiedSeat(eligiblePlayers, sbSeat);
    firstToActSeat = getNextOccupiedSeat(eligiblePlayers, bbSeat);
  }

  // Reset player hand states
  const handPlayers: InternalPlayerState[] = players.map((p) => {
    const isEligible = eligiblePlayers.some((ep) => ep.id === p.id);
    return {
      ...p,
      holeCards: [],
      currentRoundBet: 0,
      totalHandBet: 0,
      status: isEligible ? ('active' as PlayerStatus) : ('sitting-out' as PlayerStatus),
      hasActedThisRound: false,
    };
  });

  // Deal 2 hole cards to each eligible player
  let deckIndex = 0;
  for (let round = 0; round < 2; round++) {
    for (const p of handPlayers) {
      if (p.status === 'active') {
        p.holeCards.push(deck[deckIndex++]);
      }
    }
  }

  let pot = 0;

  // Collect Antes if any
  if (settings.ante > 0) {
    for (const p of handPlayers) {
      if (p.status === 'active') {
        const anteAmt = Math.min(p.chips, settings.ante);
        p.chips -= anteAmt;
        p.totalHandBet += anteAmt;
        pot += anteAmt;
        if (p.chips === 0) {
          p.status = 'all-in';
        }
      }
    }
  }

  // Post Blinds
  const sbPlayer = handPlayers.find((p) => p.seatIndex === sbSeat)!;
  const bbPlayer = handPlayers.find((p) => p.seatIndex === bbSeat)!;

  const sbAmount = Math.min(sbPlayer.chips, settings.smallBlind);
  sbPlayer.chips -= sbAmount;
  sbPlayer.currentRoundBet += sbAmount;
  sbPlayer.totalHandBet += sbAmount;
  if (sbPlayer.chips === 0) sbPlayer.status = 'all-in';

  const bbAmount = Math.min(bbPlayer.chips, settings.bigBlind);
  bbPlayer.chips -= bbAmount;
  bbPlayer.currentRoundBet += bbAmount;
  bbPlayer.totalHandBet += bbAmount;
  if (bbPlayer.chips === 0) bbPlayer.status = 'all-in';

  const remainingDeck = deck.slice(deckIndex);
  const currentHighestBet = Math.max(sbAmount, bbAmount);
  const minRaiseIncrement = settings.bigBlind;

  return {
    handNumber,
    stage: 'preflop',
    deck: remainingDeck,
    communityCards: [],
    pot,
    sidePots: [],
    currentHighestBet,
    minRaiseIncrement,
    dealerSeat,
    smallBlindSeat: sbSeat,
    bigBlindSeat: bbSeat,
    currentTurnSeat: firstToActSeat,
    turnEndsAt: Date.now() + settings.turnTimeSeconds * 1000,
    players: handPlayers,
    lastAction: null,
    winners: [],
  };
}

/**
 * Applies a player action to the game state
 */
export function applyAction(
  state: EngineGameState,
  player: InternalPlayerState,
  action: PlayerAction,
  settings: RoomSettings
): EngineGameState {
  const actions = getAvailableActions(state, player);
  const updatedPlayers = state.players.map((p) => ({ ...p }));
  const p = updatedPlayers.find((pl) => pl.id === player.id)!;

  let currentHighestBet = state.currentHighestBet;
  let minRaiseIncrement = state.minRaiseIncrement;

  switch (action.type) {
    case 'fold': {
      p.status = 'folded';
      p.hasActedThisRound = true;
      break;
    }
    case 'check': {
      if (!actions.canCheck) {
        throw new Error('Check is not available');
      }
      p.hasActedThisRound = true;
      break;
    }
    case 'call': {
      if (!actions.canCall) {
        throw new Error('Call is not available');
      }
      const needed = currentHighestBet - p.currentRoundBet;
      const amountToPay = Math.min(p.chips, needed);
      p.chips -= amountToPay;
      p.currentRoundBet += amountToPay;
      p.totalHandBet += amountToPay;
      p.hasActedThisRound = true;
      if (p.chips === 0) {
        p.status = 'all-in';
      }
      break;
    }
    case 'raise': {
      const targetBet = action.amount;
      if (!targetBet || targetBet < actions.minRaiseTotal || targetBet > actions.maxRaiseTotal) {
        throw new Error(
          `Invalid raise amount: ${targetBet}. Must be between ${actions.minRaiseTotal} and ${actions.maxRaiseTotal}`
        );
      }
      const additionalChips = targetBet - p.currentRoundBet;
      p.chips -= additionalChips;
      p.currentRoundBet = targetBet;
      p.totalHandBet += additionalChips;
      p.hasActedThisRound = true;

      const raiseDiff = targetBet - currentHighestBet;
      if (raiseDiff >= minRaiseIncrement) {
        minRaiseIncrement = raiseDiff;
      }
      currentHighestBet = targetBet;

      if (p.chips === 0) {
        p.status = 'all-in';
      }

      // Reset hasActedThisRound for other active players because bet was raised
      for (const other of updatedPlayers) {
        if (other.id !== p.id && other.status === 'active') {
          other.hasActedThisRound = false;
        }
      }
      break;
    }
    case 'all-in': {
      if (!actions.canAllIn) {
        throw new Error('All-in is not available');
      }
      const allInTotalBet = p.currentRoundBet + p.chips;
      const additional = p.chips;
      p.chips = 0;
      p.currentRoundBet = allInTotalBet;
      p.totalHandBet += additional;
      p.status = 'all-in';
      p.hasActedThisRound = true;

      if (allInTotalBet > currentHighestBet) {
        const diff = allInTotalBet - currentHighestBet;
        if (diff >= minRaiseIncrement) {
          minRaiseIncrement = diff;
        }
        currentHighestBet = allInTotalBet;

        // Reset hasActed for players who need to match this new raise
        for (const other of updatedPlayers) {
          if (other.id !== p.id && other.status === 'active') {
            other.hasActedThisRound = false;
          }
        }
      }
      break;
    }
  }

  const newState: EngineGameState = {
    ...state,
    players: updatedPlayers,
    currentHighestBet,
    minRaiseIncrement,
    lastAction: {
      playerId: p.id,
      nick: p.nick,
      action: action.type,
      amount: action.amount,
    },
  };

  // Check if hand ended because only 1 active player remains
  const nonFolded = updatedPlayers.filter(
    (pl) => pl.status !== 'folded' && pl.status !== 'sitting-out'
  );
  if (nonFolded.length === 1) {
    return resolveFoldVictory(newState);
  }

  // Check if betting round is complete
  if (isBettingRoundComplete(updatedPlayers)) {
    return advanceStage(newState, settings);
  }

  // Otherwise advance to next player to act
  const nextSeat = getNextPlayerToAct(updatedPlayers, p.seatIndex);
  return {
    ...newState,
    currentTurnSeat: nextSeat,
    turnEndsAt: nextSeat !== null ? Date.now() + settings.turnTimeSeconds * 1000 : null,
  };
}

/**
 * Moves to the next stage (preflop -> flop -> turn -> river -> showdown)
 */
export function advanceStage(state: EngineGameState, settings: RoomSettings): EngineGameState {
  // Consolidate round bets into pot
  let newPot = state.pot;
  const updatedPlayers = state.players.map((p) => {
    newPot += p.currentRoundBet;
    return {
      ...p,
      currentRoundBet: 0,
      hasActedThisRound: false,
    };
  });

  // Calculate side pots based on totalHandBet so far
  const contributions: PlayerContribution[] = updatedPlayers.map((p) => ({
    playerId: p.id,
    seatIndex: p.seatIndex,
    totalHandBet: p.totalHandBet,
    folded: p.status === 'folded' || p.status === 'sitting-out',
  }));
  const calculatedPots = calculatePots(contributions);

  // Check if we can proceed to next stage or showdown
  let nextStage: GameStage = state.stage;
  const communityCards = [...state.communityCards];
  let deck = [...state.deck];

  if (state.stage === 'preflop') {
    nextStage = 'flop';
    // Deal 3 flop cards
    communityCards.push(deck[0], deck[1], deck[2]);
    deck = deck.slice(3);
  } else if (state.stage === 'flop') {
    nextStage = 'turn';
    // Deal 1 turn card
    communityCards.push(deck[0]);
    deck = deck.slice(1);
  } else if (state.stage === 'turn') {
    nextStage = 'river';
    // Deal 1 river card
    communityCards.push(deck[0]);
    deck = deck.slice(1);
  } else if (state.stage === 'river') {
    nextStage = 'showdown';
  }

  const stageState: EngineGameState = {
    ...state,
    stage: nextStage,
    deck,
    communityCards,
    pot: newPot,
    sidePots: calculatedPots,
    currentHighestBet: 0,
    minRaiseIncrement: settings.bigBlind,
    players: updatedPlayers,
  };

  // If we reached showdown, resolve showdown
  if (nextStage === 'showdown') {
    return resolveShowdown(stageState);
  }

  // Check if all remaining players are all-in (auto-run remaining board cards)
  const nonFoldedActive = updatedPlayers.filter((p) => p.status === 'active');
  if (nonFoldedActive.length <= 1) {
    // If 0 or 1 active player and at least 1 all-in player, no more betting can take place
    // Automatically advance until showdown
    return advanceStage(stageState, settings);
  }

  // Action post-flop starts with first active player clockwise from dealer button
  const firstToAct = getNextPlayerToAct(updatedPlayers, state.dealerSeat);

  return {
    ...stageState,
    currentTurnSeat: firstToAct,
    turnEndsAt: firstToAct !== null ? Date.now() + settings.turnTimeSeconds * 1000 : null,
  };
}

/**
 * Resolves victory when all other players folded
 */
export function resolveFoldVictory(state: EngineGameState): EngineGameState {
  let totalPot = state.pot;
  const updatedPlayers = state.players.map((p) => {
    totalPot += p.currentRoundBet;
    return {
      ...p,
      currentRoundBet: 0,
    };
  });

  const winner = updatedPlayers.find((p) => p.status !== 'folded' && p.status !== 'sitting-out')!;
  winner.chips += totalPot;

  const winners: HandWinner[] = [
    {
      playerId: winner.id,
      nick: winner.nick,
      amount: totalPot,
    },
  ];

  return {
    ...state,
    stage: 'ended',
    pot: totalPot,
    players: updatedPlayers,
    currentTurnSeat: null,
    turnEndsAt: null,
    winners,
  };
}

/**
 * Resolves showdown by evaluating each eligible player's hand and awarding pots
 */
export function resolveShowdown(state: EngineGameState): EngineGameState {
  let totalPot = state.pot;
  const updatedPlayers = state.players.map((p) => {
    totalPot += p.currentRoundBet;
    return {
      ...p,
      currentRoundBet: 0,
    };
  });

  const contributions: PlayerContribution[] = updatedPlayers.map((p) => {
    const isFolded = p.status === 'folded' || p.status === 'sitting-out';
    const hand =
      !isFolded && p.holeCards.length === 2 && state.communityCards.length === 5
        ? evaluateBestHand([...p.holeCards, ...state.communityCards])
        : undefined;

    return {
      playerId: p.id,
      seatIndex: p.seatIndex,
      totalHandBet: p.totalHandBet,
      folded: isFolded,
      hand,
    };
  });

  const pots = calculatePots(contributions);
  const { playerPayouts, details } = awardPots(
    pots,
    contributions,
    state.dealerSeat,
    updatedPlayers.length
  );

  const winnersMap = new Map<string, HandWinner>();

  for (const [playerId, payout] of Object.entries(playerPayouts)) {
    const p = updatedPlayers.find((pl) => pl.id === playerId);
    if (!p) continue;
    p.chips += payout;

    const contrib = contributions.find((c) => c.playerId === playerId);
    winnersMap.set(playerId, {
      playerId,
      nick: p.nick,
      amount: (winnersMap.get(playerId)?.amount || 0) + payout,
      handRankName: contrib?.hand?.nameEn,
      cards: contrib?.hand?.bestFiveCards,
    });
  }

  return {
    ...state,
    stage: 'ended',
    pot: totalPot,
    sidePots: pots,
    players: updatedPlayers,
    currentTurnSeat: null,
    turnEndsAt: null,
    winners: Array.from(winnersMap.values()),
  };
}

/**
 * Helper to convert EngineGameState to GamePublicState (stripping hole cards, deck, etc.)
 */
export function toPublicGameState(state: EngineGameState): GamePublicState {
  return {
    handNumber: state.handNumber,
    stage: state.stage,
    pot: state.pot,
    sidePots: state.sidePots,
    communityCards: state.communityCards,
    currentTurnSeat: state.currentTurnSeat,
    turnEndsAt: state.turnEndsAt,
    dealerSeat: state.dealerSeat,
    smallBlindSeat: state.smallBlindSeat,
    bigBlindSeat: state.bigBlindSeat,
    currentHighestBet: state.currentHighestBet,
    minRaise: state.currentHighestBet + state.minRaiseIncrement,
    lastAction: state.lastAction,
    winners: state.winners,
  };
}
