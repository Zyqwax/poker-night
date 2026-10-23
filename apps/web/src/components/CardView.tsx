import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Card, Rank, Suit } from '@poker-night/shared';

interface CardViewProps {
  card?: Card;
  hidden?: boolean;
  empty?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SUIT_ICONS: Record<Suit, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

const SUIT_COLORS: Record<Suit, string> = {
  s: 'text-stone-900',
  c: 'text-stone-900',
  h: 'text-red-600',
  d: 'text-red-600',
};

const RANK_LABELS: Record<Rank, string> = {
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

export const CardView: React.FC<CardViewProps> = ({
  card,
  hidden = false,
  empty = false,
  className = '',
  size = 'md',
}) => {
  const shouldReduceMotion = useReducedMotion();

  const sizeClasses = {
    sm: 'w-10 h-14 text-xs rounded',
    md: 'w-12 h-18 sm:w-14 sm:h-20 text-sm sm:text-base rounded-md',
    lg: 'w-14 h-20 sm:w-16 sm:h-24 text-base sm:text-lg rounded-lg',
  }[size];

  if (empty) {
    return (
      <div
        className={`${sizeClasses} border-2 border-dashed border-poker-border/60 bg-poker-dark/40 flex items-center justify-center ${className}`}
      />
    );
  }

  if (hidden || !card) {
    return (
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className={`${sizeClasses} bg-gradient-to-br from-poker-wine to-poker-dark border border-poker-gold/40 shadow-md flex items-center justify-center p-1 ${className}`}
      >
        <div className="w-full h-full border border-poker-gold/20 rounded flex items-center justify-center bg-poker-wine/50">
          <span className="text-poker-gold/60 text-lg sm:text-xl">♠</span>
        </div>
      </motion.div>
    );
  }

  const isRed = card.suit === 'h' || card.suit === 'd';
  const rankLabel = RANK_LABELS[card.rank];
  const suitIcon = SUIT_ICONS[card.suit];
  const colorClass = isRed ? 'text-red-600' : 'text-stone-900';

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`${sizeClasses} bg-[#FDFBF7] border border-stone-300 shadow-md flex flex-col justify-between p-1.5 font-bold ${colorClass} select-none ${className}`}
    >
      <div className="flex flex-col items-center leading-none self-start">
        <span className="font-serif tracking-tight">{rankLabel}</span>
        <span className="text-[10px] sm:text-xs">{suitIcon}</span>
      </div>
      <div className="self-center text-xl sm:text-2xl leading-none my-auto">
        {suitIcon}
      </div>
      <div className="flex flex-col items-center leading-none self-end rotate-180">
        <span className="font-serif tracking-tight">{rankLabel}</span>
        <span className="text-[10px] sm:text-xs">{suitIcon}</span>
      </div>
    </motion.div>
  );
};
