import { SidePot } from '@poker-night/shared';
import { EvaluatedHand, compareHands } from './evaluator.js';

export interface PlayerContribution {
  playerId: string;
  totalHandBet: number;
  folded: boolean;
  hand?: EvaluatedHand;
  seatIndex: number;
}

export interface CalculatedPot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface PotWinnerPayout {
  potIndex: number;
  amount: number;
  winnerPlayerIds: string[];
  payouts: { playerId: string; amount: number }[];
}

/**
 * Calculates main pot and side pots based on each player's total investment in the hand.
 */
export function calculatePots(contributions: PlayerContribution[]): CalculatedPot[] {
  // Only consider players who put money in the pot
  const activeBets = contributions.filter((c) => c.totalHandBet > 0);
  if (activeBets.length === 0) {
    return [];
  }

  // Find all distinct non-zero contribution amounts from all players
  const levels = Array.from(new Set(activeBets.map((c) => c.totalHandBet))).sort((a, b) => a - b);

  const rawPots: CalculatedPot[] = [];
  let prevLevel = 0;

  for (const level of levels) {
    const potSliceContribution = level - prevLevel;
    let sliceAmount = 0;
    const eligiblePlayerIds: string[] = [];

    for (const c of activeBets) {
      if (c.totalHandBet >= level) {
        sliceAmount += potSliceContribution;
        if (!c.folded) {
          eligiblePlayerIds.push(c.playerId);
        }
      } else if (c.totalHandBet > prevLevel) {
        sliceAmount += c.totalHandBet - prevLevel;
      }
    }

    if (sliceAmount > 0) {
      rawPots.push({
        amount: sliceAmount,
        eligiblePlayerIds,
      });
    }

    prevLevel = level;
  }

  // Merge consecutive pots that have the exact same eligible players
  const mergedPots: CalculatedPot[] = [];
  for (const pot of rawPots) {
    if (mergedPots.length === 0) {
      mergedPots.push(pot);
      continue;
    }

    const last = mergedPots[mergedPots.length - 1];
    const sameEligible =
      last.eligiblePlayerIds.length === pot.eligiblePlayerIds.length &&
      last.eligiblePlayerIds.every((id) => pot.eligiblePlayerIds.includes(id));

    if (sameEligible) {
      last.amount += pot.amount;
    } else {
      mergedPots.push(pot);
    }
  }

  return mergedPots;
}

/**
 * Distributes each pot to the winner(s) among its eligible players.
 * Ties are split equally; odd chips are awarded 1 by 1 starting clockwise from the dealer button.
 */
export function awardPots(
  pots: CalculatedPot[],
  contributions: PlayerContribution[],
  dealerSeatIndex: number,
  totalSeats: number
): {
  playerPayouts: Record<string, number>;
  details: PotWinnerPayout[];
} {
  const playerPayouts: Record<string, number> = {};
  const details: PotWinnerPayout[] = [];

  // Sort helper to break tie for odd chips: distance clockwise from dealer button
  const getClockwiseDistance = (seatIndex: number): number => {
    return (seatIndex - dealerSeatIndex + totalSeats) % totalSeats;
  };

  const contribMap = new Map<string, PlayerContribution>();
  for (const c of contributions) {
    contribMap.set(c.playerId, c);
  }

  pots.forEach((pot, potIndex) => {
    if (pot.amount === 0) return;

    // Filter eligible players who did not fold
    const eligible = pot.eligiblePlayerIds
      .map((id) => contribMap.get(id))
      .filter((c): c is PlayerContribution => !!c && !c.folded);

    if (eligible.length === 0) {
      return;
    }

    // If only 1 eligible player, they win this entire pot
    if (eligible.length === 1) {
      const winnerId = eligible[0].playerId;
      playerPayouts[winnerId] = (playerPayouts[winnerId] || 0) + pot.amount;
      details.push({
        potIndex,
        amount: pot.amount,
        winnerPlayerIds: [winnerId],
        payouts: [{ playerId: winnerId, amount: pot.amount }],
      });
      return;
    }

    // If showdown hands exist, compare hands
    const withHands = eligible.filter((e) => !!e.hand);
    let bestHandEligible: PlayerContribution[] = [];

    if (withHands.length > 0) {
      let best = withHands[0];
      bestHandEligible = [best];

      for (let i = 1; i < withHands.length; i++) {
        const current = withHands[i];
        const cmp = compareHands(current.hand!, best.hand!);
        if (cmp > 0) {
          best = current;
          bestHandEligible = [current];
        } else if (cmp === 0) {
          bestHandEligible.push(current);
        }
      }
    } else {
      // Fallback if no hands (e.g. all but one folded earlier)
      bestHandEligible = eligible;
    }

    const share = Math.floor(pot.amount / bestHandEligible.length);
    let remainder = pot.amount % bestHandEligible.length;

    // Sort tied winners clockwise from dealer button for odd chip allocation
    bestHandEligible.sort((a, b) => getClockwiseDistance(a.seatIndex) - getClockwiseDistance(b.seatIndex));

    const potPayouts: { playerId: string; amount: number }[] = [];

    for (const winner of bestHandEligible) {
      let winAmount = share;
      if (remainder > 0) {
        winAmount += 1;
        remainder -= 1;
      }
      playerPayouts[winner.playerId] = (playerPayouts[winner.playerId] || 0) + winAmount;
      potPayouts.push({ playerId: winner.playerId, amount: winAmount });
    }

    details.push({
      potIndex,
      amount: pot.amount,
      winnerPlayerIds: bestHandEligible.map((w) => w.playerId),
      payouts: potPayouts,
    });
  });

  return { playerPayouts, details };
}
