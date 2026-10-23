import { Card, Rank } from '@poker-night/shared';

export enum HandCategory {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
  RoyalFlush = 9,
}

export interface EvaluatedHand {
  category: HandCategory;
  score: number[]; // Lexicographical score vector [category, ...kickers]
  bestFiveCards: Card[];
  nameEn: string;
  nameTr: string;
}

const RANK_NAMES_EN: Record<Rank, string> = {
  14: 'Ace',
  13: 'King',
  12: 'Queen',
  11: 'Jack',
  10: '10',
  9: '9',
  8: '8',
  7: '7',
  6: '6',
  5: '5',
  4: '4',
  3: '3',
  2: '2',
};

const RANK_NAMES_TR: Record<Rank, string> = {
  14: 'As',
  13: 'Papaz',
  12: 'Kız',
  11: 'Vale',
  10: '10',
  9: '9',
  8: '8',
  7: '7',
  6: '6',
  5: '5',
  4: '4',
  3: '3',
  2: '2',
};

/**
 * Evaluates exactly 5 cards
 */
export function evaluate5Cards(cards: Card[]): EvaluatedHand {
  if (cards.length !== 5) {
    throw new Error('evaluate5Cards requires exactly 5 cards');
  }

  // Sort descending by rank
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);

  // Group by rank
  const rankCounts: Record<number, number> = {};
  for (const c of sorted) {
    rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
  }

  // Check flush
  const isFlush = sorted.every((c) => c.suit === sorted[0].suit);

  // Check straight
  let isStraight = false;
  let straightHighRank: Rank = sorted[0].rank;

  const ranks = sorted.map((c) => c.rank);
  const isNormalStraight =
    ranks[0] - ranks[1] === 1 &&
    ranks[1] - ranks[2] === 1 &&
    ranks[2] - ranks[3] === 1 &&
    ranks[3] - ranks[4] === 1;

  // Ace-low straight (wheel): A-5-4-3-2
  const isWheelStraight =
    ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2;

  if (isNormalStraight) {
    isStraight = true;
    straightHighRank = ranks[0];
  } else if (isWheelStraight) {
    isStraight = true;
    straightHighRank = 5; // In wheel, 5 is the high card
  }

  // Count groups
  const groups: { rank: Rank; count: number }[] = Object.keys(rankCounts)
    .map((r) => ({ rank: Number(r) as Rank, count: rankCounts[Number(r)] }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  // 1. Royal Flush / Straight Flush
  if (isFlush && isStraight) {
    if (straightHighRank === 14 && !isWheelStraight) {
      return {
        category: HandCategory.RoyalFlush,
        score: [HandCategory.RoyalFlush, 14],
        bestFiveCards: sorted,
        nameEn: 'Royal Flush',
        nameTr: 'Royal Flush',
      };
    }
    return {
      category: HandCategory.StraightFlush,
      score: [HandCategory.StraightFlush, straightHighRank],
      bestFiveCards: isWheelStraight
        ? [sorted[1], sorted[2], sorted[3], sorted[4], sorted[0]]
        : sorted,
      nameEn: `Straight Flush (${RANK_NAMES_EN[straightHighRank]} high)`,
      nameTr: `Straight Flush (${RANK_NAMES_TR[straightHighRank]} yüksek)`,
    };
  }

  // 2. Four of a kind
  if (groups[0].count === 4) {
    const quadRank = groups[0].rank;
    const kicker = groups[1].rank;
    return {
      category: HandCategory.FourOfAKind,
      score: [HandCategory.FourOfAKind, quadRank, kicker],
      bestFiveCards: sorted,
      nameEn: `Four of a Kind (${RANK_NAMES_EN[quadRank]}s)`,
      nameTr: `Four of a Kind (${RANK_NAMES_TR[quadRank]})`,
    };
  }

  // 3. Full house
  if (groups[0].count === 3 && groups[1].count === 2) {
    const tripsRank = groups[0].rank;
    const pairRank = groups[1].rank;
    return {
      category: HandCategory.FullHouse,
      score: [HandCategory.FullHouse, tripsRank, pairRank],
      bestFiveCards: sorted,
      nameEn: `Full House (${RANK_NAMES_EN[tripsRank]}s full of ${RANK_NAMES_EN[pairRank]}s)`,
      nameTr: `Full House (${RANK_NAMES_TR[tripsRank]} / ${RANK_NAMES_TR[pairRank]})`,
    };
  }

  // 4. Flush
  if (isFlush) {
    return {
      category: HandCategory.Flush,
      score: [HandCategory.Flush, ...ranks],
      bestFiveCards: sorted,
      nameEn: `Flush (${RANK_NAMES_EN[ranks[0]]} high)`,
      nameTr: `Flush (${RANK_NAMES_TR[ranks[0]]} yüksek)`,
    };
  }

  // 5. Straight
  if (isStraight) {
    return {
      category: HandCategory.Straight,
      score: [HandCategory.Straight, straightHighRank],
      bestFiveCards: isWheelStraight
        ? [sorted[1], sorted[2], sorted[3], sorted[4], sorted[0]]
        : sorted,
      nameEn: `Straight (${RANK_NAMES_EN[straightHighRank]} high)`,
      nameTr: `Straight (${RANK_NAMES_TR[straightHighRank]} yüksek)`,
    };
  }

  // 6. Three of a kind
  if (groups[0].count === 3) {
    const tripsRank = groups[0].rank;
    const kickers = [groups[1].rank, groups[2].rank].sort((a, b) => b - a);
    return {
      category: HandCategory.ThreeOfAKind,
      score: [HandCategory.ThreeOfAKind, tripsRank, ...kickers],
      bestFiveCards: sorted,
      nameEn: `Three of a Kind (${RANK_NAMES_EN[tripsRank]}s)`,
      nameTr: `Three of a Kind (${RANK_NAMES_TR[tripsRank]})`,
    };
  }

  // 7. Two Pair
  if (groups[0].count === 2 && groups[1].count === 2) {
    const highPair = Math.max(groups[0].rank, groups[1].rank);
    const lowPair = Math.min(groups[0].rank, groups[1].rank);
    const kicker = groups[2].rank;
    return {
      category: HandCategory.TwoPair,
      score: [HandCategory.TwoPair, highPair, lowPair, kicker],
      bestFiveCards: sorted,
      nameEn: `Two Pair (${RANK_NAMES_EN[highPair as Rank]}s and ${RANK_NAMES_EN[lowPair as Rank]}s)`,
      nameTr: `Two Pair (${RANK_NAMES_TR[highPair as Rank]} ve ${RANK_NAMES_TR[lowPair as Rank]})`,
    };
  }

  // 8. One Pair
  if (groups[0].count === 2) {
    const pairRank = groups[0].rank;
    const kickers = [groups[1].rank, groups[2].rank, groups[3].rank].sort((a, b) => b - a);
    return {
      category: HandCategory.OnePair,
      score: [HandCategory.OnePair, pairRank, ...kickers],
      bestFiveCards: sorted,
      nameEn: `Pair (${RANK_NAMES_EN[pairRank]}s)`,
      nameTr: `Pair (${RANK_NAMES_TR[pairRank]})`,
    };
  }

  // 9. High Card
  return {
    category: HandCategory.HighCard,
    score: [HandCategory.HighCard, ...ranks],
    bestFiveCards: sorted,
    nameEn: `High Card (${RANK_NAMES_EN[ranks[0]]})`,
    nameTr: `High Card (${RANK_NAMES_TR[ranks[0]]})`,
  };
}

/**
 * Compare two evaluated hands.
 * Returns > 0 if handA beats handB, < 0 if handB beats handA, 0 if tie.
 */
export function compareHands(handA: EvaluatedHand, handB: EvaluatedHand): number {
  const len = Math.max(handA.score.length, handB.score.length);
  for (let i = 0; i < len; i++) {
    const scoreA = handA.score[i] || 0;
    const scoreB = handB.score[i] || 0;
    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }
  }
  return 0;
}

/**
 * Generates all 5-card combinations from a set of cards (e.g. 5, 6, or 7 cards)
 */
function getCombinations(cards: Card[], k = 5): Card[][] {
  const result: Card[][] = [];

  function helper(start: number, combo: Card[]) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < cards.length; i++) {
      combo.push(cards[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }

  helper(0, []);
  return result;
}

/**
 * Evaluates best 5-card hand out of 5, 6, or 7 cards
 */
export function evaluateBestHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    throw new Error('evaluateBestHand requires at least 5 cards');
  }
  if (cards.length === 5) {
    return evaluate5Cards(cards);
  }

  const combos = getCombinations(cards, 5);
  let best: EvaluatedHand | null = null;

  for (const combo of combos) {
    const current = evaluate5Cards(combo);
    if (!best || compareHands(current, best) > 0) {
      best = current;
    }
  }

  return best!;
}

/**
 * Auto-detects the player's best current hand given hole cards and community cards
 * Works with 2, 5, 6, or 7 cards!
 */
export function detectCurrentBestHand(holeCards: Card[], communityCards: Card[]): {
  hand: EvaluatedHand | null;
  textTr: string;
  textEn: string;
} {
  const totalCards = [...holeCards, ...communityCards];
  if (totalCards.length < 5) {
    // When only preflop (2 cards) or fewer than 5 cards
    if (holeCards.length === 2) {
      if (holeCards[0].rank === holeCards[1].rank) {
        const rank = holeCards[0].rank;
        return {
          hand: null,
          textTr: `Şu an: Pair (${RANK_NAMES_TR[rank]})`,
          textEn: `Current: Pair of ${RANK_NAMES_EN[rank]}s`,
        };
      }
      const highRank = Math.max(holeCards[0].rank, holeCards[1].rank) as Rank;
      return {
        hand: null,
        textTr: `Şu an: High Card (${RANK_NAMES_TR[highRank]})`,
        textEn: `Current: High Card (${RANK_NAMES_EN[highRank]})`,
      };
    }
    return {
      hand: null,
      textTr: '',
      textEn: '',
    };
  }

  const best = evaluateBestHand(totalCards);
  return {
    hand: best,
    textTr: `Şu an: ${best.nameTr}`,
    textEn: `Current: ${best.nameEn}`,
  };
}
