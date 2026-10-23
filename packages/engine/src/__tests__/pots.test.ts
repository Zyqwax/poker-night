import { describe, expect, it } from 'vitest';
import { PlayerContribution, awardPots, calculatePots } from '../pots.js';
import { evaluate5Cards } from '../evaluator.js';
import { parseCard } from '../deck.js';

describe('Pots and Side Pots', () => {
  const cards = (str: string) => str.split(' ').map(parseCard);

  it('calculates simple pot when all players bet the same amount', () => {
    const contributions: PlayerContribution[] = [
      { playerId: 'p1', seatIndex: 0, totalHandBet: 100, folded: false },
      { playerId: 'p2', seatIndex: 1, totalHandBet: 100, folded: false },
      { playerId: 'p3', seatIndex: 2, totalHandBet: 100, folded: false },
    ];

    const pots = calculatePots(contributions);
    expect(pots.length).toBe(1);
    expect(pots[0].amount).toBe(300);
    expect(pots[0].eligiblePlayerIds).toEqual(['p1', 'p2', 'p3']);
  });

  it('excludes folded players from eligibility but keeps their money in the pot', () => {
    const contributions: PlayerContribution[] = [
      { playerId: 'p1', seatIndex: 0, totalHandBet: 100, folded: false },
      { playerId: 'p2', seatIndex: 1, totalHandBet: 100, folded: true },
      { playerId: 'p3', seatIndex: 2, totalHandBet: 100, folded: false },
    ];

    const pots = calculatePots(contributions);
    expect(pots.length).toBe(1);
    expect(pots[0].amount).toBe(300);
    expect(pots[0].eligiblePlayerIds).toEqual(['p1', 'p3']);
  });

  it('creates main pot and side pots when multiple players are all in with different stacks', () => {
    // p1 has 50 (all-in)
    // p2 has 150 (all-in)
    // p3 has 300
    // Total pot = 50*3 (150) + 100*2 (200) + 150 (150) = 500
    const contributions: PlayerContribution[] = [
      { playerId: 'p1', seatIndex: 0, totalHandBet: 50, folded: false },
      { playerId: 'p2', seatIndex: 1, totalHandBet: 150, folded: false },
      { playerId: 'p3', seatIndex: 2, totalHandBet: 300, folded: false },
    ];

    const pots = calculatePots(contributions);
    expect(pots.length).toBe(3);
    // Pot 0: 50 * 3 = 150 (eligible: p1, p2, p3)
    expect(pots[0].amount).toBe(150);
    expect(pots[0].eligiblePlayerIds).toEqual(['p1', 'p2', 'p3']);

    // Pot 1: (150 - 50) * 2 = 200 (eligible: p2, p3)
    expect(pots[1].amount).toBe(200);
    expect(pots[1].eligiblePlayerIds).toEqual(['p2', 'p3']);

    // Pot 2: excess 150 from p3 (eligible: p3)
    expect(pots[2].amount).toBe(150);
    expect(pots[2].eligiblePlayerIds).toEqual(['p3']);
  });

  it('splits pot evenly on tie and awards odd chip clockwise from dealer button', () => {
    // 2 players tie with pot of 25.
    // Dealer is at seat 0.
    // p1 is at seat 1 (distance 1).
    // p2 is at seat 2 (distance 2).
    // p1 gets 13, p2 gets 12.
    const hand = evaluate5Cards(cards('As Ks Qs Js 9h'));
    const contributions: PlayerContribution[] = [
      { playerId: 'p1', seatIndex: 1, totalHandBet: 100, folded: false, hand },
      { playerId: 'p2', seatIndex: 2, totalHandBet: 100, folded: false, hand },
    ];

    const pots = [{ amount: 25, eligiblePlayerIds: ['p1', 'p2'] }];
    const { playerPayouts } = awardPots(pots, contributions, 0, 6);

    expect(playerPayouts['p1']).toBe(13);
    expect(playerPayouts['p2']).toBe(12);
  });
});
