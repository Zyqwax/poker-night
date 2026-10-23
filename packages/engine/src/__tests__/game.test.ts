import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOM_SETTINGS } from '@poker-night/shared';
import {
  applyAction,
  getAvailableActions,
  initHand,
  InternalPlayerState,
} from '../game.js';

describe('Game Engine State Transitions', () => {
  const createMockPlayer = (
    id: string,
    nick: string,
    seatIndex: number,
    chips = 1000
  ): InternalPlayerState => ({
    id,
    nick,
    seatIndex,
    chips,
    currentRoundBet: 0,
    totalHandBet: 0,
    status: 'active',
    isConnected: true,
    isReady: true,
    isHost: seatIndex === 0,
    hasActedThisRound: false,
    holeCards: [],
  });

  it('initializes hand for 3 players, posts blinds and sets UTG turn', () => {
    const players = [
      createMockPlayer('p1', 'Player 1', 0),
      createMockPlayer('p2', 'Player 2', 1),
      createMockPlayer('p3', 'Player 3', 2),
    ];

    const state = initHand(players, DEFAULT_ROOM_SETTINGS, 2, 1);
    expect(state.dealerSeat).toBe(0);
    expect(state.smallBlindSeat).toBe(1);
    expect(state.bigBlindSeat).toBe(2);
    // In 3-player game, first to act preflop is seat 0 (UTG / left of BB)
    expect(state.currentTurnSeat).toBe(0);

    // Blinds posted
    const sb = state.players.find((p) => p.seatIndex === 1)!;
    const bb = state.players.find((p) => p.seatIndex === 2)!;
    expect(sb.currentRoundBet).toBe(5);
    expect(sb.chips).toBe(995);
    expect(bb.currentRoundBet).toBe(10);
    expect(bb.chips).toBe(990);
  });

  it('correctly handles Heads-Up blind rules', () => {
    // Heads-up: Dealer is SB and acts first preflop
    const players = [
      createMockPlayer('p1', 'Player 1', 0),
      createMockPlayer('p2', 'Player 2', 1),
    ];

    const state = initHand(players, DEFAULT_ROOM_SETTINGS, 1, 1);
    expect(state.dealerSeat).toBe(0);
    expect(state.smallBlindSeat).toBe(0);
    expect(state.bigBlindSeat).toBe(1);
    expect(state.currentTurnSeat).toBe(0); // Dealer/SB acts first preflop
  });

  it('validates betting actions (fold, call, raise)', () => {
    const players = [
      createMockPlayer('p1', 'Player 1', 0),
      createMockPlayer('p2', 'Player 2', 1),
      createMockPlayer('p3', 'Player 3', 2),
    ];

    let state = initHand(players, DEFAULT_ROOM_SETTINGS, 2, 1);
    const p1 = state.players.find((p) => p.seatIndex === 0)!;

    const actions = getAvailableActions(state, p1);
    expect(actions.canFold).toBe(true);
    expect(actions.canCheck).toBe(false); // Must call 10 (BB)
    expect(actions.canCall).toBe(true);
    expect(actions.callAmount).toBe(10);
    expect(actions.canRaise).toBe(true);
    expect(actions.minRaiseTotal).toBe(20); // 10 + 10

    // P1 calls 10
    state = applyAction(state, p1, { type: 'call' }, DEFAULT_ROOM_SETTINGS);
    expect(state.currentTurnSeat).toBe(1); // SB is next

    // SB raises to 40
    const sb = state.players.find((p) => p.seatIndex === 1)!;
    state = applyAction(state, sb, { type: 'raise', amount: 40 }, DEFAULT_ROOM_SETTINGS);
    expect(state.currentHighestBet).toBe(40);
    expect(state.currentTurnSeat).toBe(2); // BB is next

    // BB folds
    const bb = state.players.find((p) => p.seatIndex === 2)!;
    state = applyAction(state, bb, { type: 'fold' }, DEFAULT_ROOM_SETTINGS);
    expect(state.players.find((p) => p.seatIndex === 2)!.status).toBe('folded');
    expect(state.currentTurnSeat).toBe(0); // P1 must respond to 40

    // P1 calls 40
    const p1Updated = state.players.find((p) => p.seatIndex === 0)!;
    state = applyAction(state, p1Updated, { type: 'call' }, DEFAULT_ROOM_SETTINGS);

    // Round complete -> stage transitions to Flop
    expect(state.stage).toBe('flop');
    expect(state.communityCards.length).toBe(3);
    expect(state.pot).toBe(90); // 40 (p1) + 40 (sb) + 10 (bb fold)
  });

  it('awards pot immediately when all but one fold', () => {
    const players = [
      createMockPlayer('p1', 'Player 1', 0),
      createMockPlayer('p2', 'Player 2', 1),
    ];

    let state = initHand(players, DEFAULT_ROOM_SETTINGS, 1, 1);
    const p1 = state.players.find((p) => p.seatIndex === 0)!;

    // P1 folds immediately
    state = applyAction(state, p1, { type: 'fold' }, DEFAULT_ROOM_SETTINGS);
    expect(state.stage).toBe('ended');
    expect(state.winners.length).toBe(1);
    expect(state.winners[0].playerId).toBe('p2');
    const p2 = state.players.find((p) => p.id === 'p2')!;
    expect(p2.chips).toBe(1005); // started 1000, put in 10 BB, won 15 pot -> 1005
  });
});
