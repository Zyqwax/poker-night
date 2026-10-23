import { Card, Rank, Suit } from '@poker-night/shared';

export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/**
 * Returns a cryptographically secure random integer in [0, maxExclusive)
 * Uses standard Web Crypto API (globalThis.crypto.getRandomValues)
 */
function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const array = new Uint32Array(1);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(array);
    return array[0] % maxExclusive;
  }
  throw new Error('Cryptographically secure RNG is not available');
}

/**
 * Cryptographically secure Fisher-Yates shuffle
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

export function parseCard(str: string): Card {
  const s = str.trim();
  const suitChar = s.slice(-1).toLowerCase() as Suit;
  const rankStr = s.slice(0, -1).toUpperCase();
  let rank: Rank;
  if (rankStr === 'A') rank = 14;
  else if (rankStr === 'K') rank = 13;
  else if (rankStr === 'Q') rank = 12;
  else if (rankStr === 'J') rank = 11;
  else if (rankStr === 'T' || rankStr === '10') rank = 10;
  else rank = parseInt(rankStr, 10) as Rank;

  return { suit: suitChar, rank };
}

export function formatCard(card: Card): string {
  const rankNames: Record<Rank, string> = {
    14: 'A',
    13: 'K',
    12: 'Q',
    11: 'J',
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
  return `${rankNames[card.rank]}${card.suit}`;
}
