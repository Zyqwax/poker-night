import { describe, expect, it } from 'vitest';
import { Card } from '@poker-night/shared';
import {
  HandCategory,
  compareHands,
  detectCurrentBestHand,
  evaluate5Cards,
  evaluateBestHand,
} from '../evaluator.js';
import { parseCard } from '../deck.js';

describe('Hand Evaluator', () => {
  const cards = (str: string): Card[] => str.split(' ').map(parseCard);

  it('evaluates Royal Flush', () => {
    const hand = evaluate5Cards(cards('As Ks Qs Js 10s'));
    expect(hand.category).toBe(HandCategory.RoyalFlush);
    expect(hand.nameEn).toBe('Royal Flush');
  });

  it('evaluates Straight Flush', () => {
    const hand = evaluate5Cards(cards('9h 8h 7h 6h 5h'));
    expect(hand.category).toBe(HandCategory.StraightFlush);
    expect(hand.score[1]).toBe(9);
  });

  it('evaluates Ace-low Straight Flush (Steel Wheel)', () => {
    const hand = evaluate5Cards(cards('Ad 5d 4d 3d 2d'));
    expect(hand.category).toBe(HandCategory.StraightFlush);
    expect(hand.score[1]).toBe(5);
  });

  it('evaluates Four of a Kind with kicker', () => {
    const hand = evaluate5Cards(cards('Kh Kc Kd Ks 2h'));
    expect(hand.category).toBe(HandCategory.FourOfAKind);
    expect(hand.score[1]).toBe(13);
    expect(hand.score[2]).toBe(2);
  });

  it('evaluates Full House', () => {
    const hand = evaluate5Cards(cards('Qh Qc Qd 10s 10c'));
    expect(hand.category).toBe(HandCategory.FullHouse);
    expect(hand.score[1]).toBe(12); // Qs full of
    expect(hand.score[2]).toBe(10); // 10s
  });

  it('evaluates Flush', () => {
    const hand = evaluate5Cards(cards('Ac Jc 8c 6c 2c'));
    expect(hand.category).toBe(HandCategory.Flush);
    expect(hand.score[1]).toBe(14);
  });

  it('evaluates Straight with Ace-high and Ace-low', () => {
    const broadway = evaluate5Cards(cards('Ac Kd Qh Jc 10s'));
    expect(broadway.category).toBe(HandCategory.Straight);
    expect(broadway.score[1]).toBe(14);

    const wheel = evaluate5Cards(cards('5s 4h 3c 2d Ah'));
    expect(wheel.category).toBe(HandCategory.Straight);
    expect(wheel.score[1]).toBe(5);

    expect(compareHands(broadway, wheel)).toBeGreaterThan(0);
  });

  it('evaluates Three of a Kind', () => {
    const hand = evaluate5Cards(cards('8s 8d 8c Kh 2d'));
    expect(hand.category).toBe(HandCategory.ThreeOfAKind);
    expect(hand.score[1]).toBe(8);
  });

  it('evaluates Two Pair and kicker', () => {
    const hand = evaluate5Cards(cards('Js Jd 9c 9s Ah'));
    expect(hand.category).toBe(HandCategory.TwoPair);
    expect(hand.score[1]).toBe(11);
    expect(hand.score[2]).toBe(9);
    expect(hand.score[3]).toBe(14);
  });

  it('evaluates One Pair and kickers', () => {
    const hand = evaluate5Cards(cards('10s 10d Ac Kd 4s'));
    expect(hand.category).toBe(HandCategory.OnePair);
    expect(hand.score[1]).toBe(10);
    expect(hand.score[2]).toBe(14);
  });

  it('evaluates High Card', () => {
    const hand = evaluate5Cards(cards('Ah Kd 9s 6c 3d'));
    expect(hand.category).toBe(HandCategory.HighCard);
    expect(hand.score[1]).toBe(14);
  });

  it('finds best 5 cards out of 7 cards', () => {
    // 7 cards: player has Ah Kh, board has Qh Jh 10h 2c 3d -> Royal Flush
    const sevenCards = cards('Ah Kh Qh Jh 10h 2c 3d');
    const best = evaluateBestHand(sevenCards);
    expect(best.category).toBe(HandCategory.RoyalFlush);
    expect(best.bestFiveCards.length).toBe(5);
  });

  it('detectCurrentBestHand provides helpful Turkish text', () => {
    const hole = cards('Ah Kh');
    const board = cards('Qh Jh 10h');
    const detected = detectCurrentBestHand(hole, board);
    expect(detected.textTr).toContain('Royal Flush');

    const hole2 = cards('Ah Ad');
    const preflopDetect = detectCurrentBestHand(hole2, []);
    expect(preflopDetect.textTr).toBe('Şu an: Pair (As)');
  });
});
