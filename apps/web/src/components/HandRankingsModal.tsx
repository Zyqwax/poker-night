import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { t } from '../i18n/tr.js';

interface HandRankingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HandRankingsModal: React.FC<HandRankingsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="bg-poker-card border border-poker-border rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-poker-border bg-poker-dark/60">
            <h2 className="text-xl font-serif font-bold text-poker-gold">
              {t.handRanksModal.title}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-poker-border/40 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* List */}
          <div className="p-6 overflow-y-auto space-y-4 text-sm divide-y divide-poker-border/50">
            <p className="text-stone-400 text-xs pb-1">
              {t.handRanksModal.description}
            </p>
            {t.handRanksModal.ranks.map((rank, idx) => (
              <div key={rank.name} className="pt-3 first:pt-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-poker-gold font-serif text-base">
                    {idx + 1}. {rank.name}
                  </span>
                  <span className="font-mono text-xs tracking-wider bg-poker-dark px-2 py-0.5 rounded border border-poker-border text-amber-200">
                    {rank.example}
                  </span>
                </div>
                <p className="text-stone-300 text-xs leading-relaxed">{rank.desc}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-poker-border bg-poker-dark/60 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-poker-wine hover:bg-poker-wineHover text-amber-100 font-medium transition-colors"
            >
              {t.handRanksModal.close}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
