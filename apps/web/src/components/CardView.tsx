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
    sm: 'w-9 h-13 sm:w-10 sm:h-14 text-xs rounded-md',
    md: 'w-11 h-16 sm:w-13 sm:h-18 md:w-14 md:h-20 text-sm sm:text-base rounded-lg',
    lg: 'w-13 h-18 sm:w-16 sm:h-22 md:w-16 md:h-24 text-base sm:text-lg rounded-xl',
  }[size];

  if (empty) {
    return (
      <div
        className={`${sizeClasses} border border-[#6B323F]/60 bg-[#250F16]/35 flex items-center justify-center shadow-inner ${className}`}
      />
    );
  }

  if (hidden || !card) {
    return (
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={`${sizeClasses} bg-gradient-to-br from-[#4A1D27] to-[#1E0D12] border border-[#8C4B59]/60 shadow-lg flex items-center justify-center p-1 overflow-hidden ${className}`}
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
          : { opacity: 0, scale: 0.8, y: -10, rotateY: 90 }
      }
      animate={{ opacity: 1, scale: 1, y: 0, rotateY: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.9, 0.3, 1] }}
      className={`${sizeClasses} bg-[#F8F5EE] border border-[#D6CEC2] shadow-xl relative overflow-hidden font-serif select-none ${colorClass} ${className}`}
    >
      {/* Top-left corner: Rank and small suit */}
      <div className="absolute top-0.5 sm:top-1 left-1 flex flex-col items-center leading-none pointer-events-none">
        <span className="text-[11px] sm:text-xs font-black tracking-tight leading-none">
          {rankLabel}
        </span>
        <span className="text-[8px] sm:text-[10px] leading-none mt-0.5">{suitIcon}</span>
      </div>

      {/* Center: Large bold rank */}
      <div className="absolute inset-0 flex items-center justify-center text-lg sm:text-2xl font-black leading-none pointer-events-none">
        {rankLabel}
      </div>

      {/* Bottom-right corner: Inverted suit icon to prevent text crowding */}
      <div className="absolute bottom-0.5 sm:bottom-1 right-1 text-[9px] sm:text-[11px] leading-none rotate-180 pointer-events-none opacity-80">
        {suitIcon}
      </div>
    </motion.div>
  );
};
