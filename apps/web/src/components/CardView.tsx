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
    sm: 'w-8 h-12 sm:w-10 sm:h-14 text-xs rounded-md',
    md: 'w-11 h-16 sm:w-13 sm:h-18 md:w-14 md:h-20 text-sm sm:text-base rounded-lg',
    lg: 'w-13 h-18 sm:w-16 sm:h-22 md:w-16 md:h-24 text-base sm:text-lg rounded-xl',
  }[size];

  if (empty) {
    return (
      <div
        className={`${sizeClasses} border border-[#6B323F]/50 bg-[#250F16]/30 flex items-center justify-center shadow-inner ${className}`}
      />
    );
  }

  if (hidden || !card) {
    return (
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={`${sizeClasses} bg-gradient-to-br from-[#4A1D27] to-[#1E0D12] border border-[#8C4B59]/60 shadow-lg flex items-center justify-center p-1 ${className}`}
      >
        <div className="w-full h-full border border-[#D5A04D]/30 rounded flex items-center justify-center bg-[#35151D]/60">
          <span className="text-[#D5A04D]/60 text-base sm:text-lg select-none">♠</span>
        </div>
      </motion.div>
    );
  }

  const isRed = card.suit === 'h' || card.suit === 'd';
  const rankLabel = RANK_LABELS[card.rank];
  const suitIcon = SUIT_ICONS[card.suit];
  const colorClass = isRed ? 'text-[#8E2828]' : 'text-[#1F1D1D]';

  return (
    <motion.div
      initial={
        shouldReduceMotion
          ? false
          : { opacity: 0, scale: 0.8, y: -12, rotateY: 90 }
      }
      animate={{ opacity: 1, scale: 1, y: 0, rotateY: 0 }}
      transition={{ duration: 0.32, ease: [0.2, 0.9, 0.3, 1] }}
      className={`${sizeClasses} bg-[#F8F5EE] border border-[#D6CEC2] shadow-xl flex flex-col justify-between p-1 sm:p-1.5 font-bold ${colorClass} select-none ${className}`}
    >
      <div className="flex flex-col items-center leading-none self-start">
        <span className="font-serif tracking-tight text-xs sm:text-sm font-black">
          {rankLabel}
        </span>
        <span className="text-[9px] sm:text-[11px] leading-tight">{suitIcon}</span>
      </div>
      <div className="self-center text-lg sm:text-2xl leading-none my-auto select-none">
        {rankLabel}
      </div>
      <div className="flex flex-col items-center leading-none self-end rotate-180">
        <span className="font-serif tracking-tight text-xs sm:text-sm font-black">
          {rankLabel}
        </span>
        <span className="text-[9px] sm:text-[11px] leading-tight">{suitIcon}</span>
      </div>
    </motion.div>
  );
};
