import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, History, Users } from 'lucide-react';
import { HandHistoryItem, PlayerGameStats } from '@poker-night/shared';
import { t } from '../i18n/tr.js';

interface HistoryAndStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HandHistoryItem[];
  stats: PlayerGameStats[];
}

export const HistoryAndStatsModal: React.FC<HistoryAndStatsModalProps> = ({
  isOpen,
  onClose,
  history,
  stats,
}) => {
  const [activeTab, setActiveTab] = useState<'hands' | 'stats' | 'chart'>('hands');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-poker-card border border-poker-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-poker-border bg-poker-dark/60">
            <h2 className="text-xl font-serif font-bold text-poker-gold">
              {t.historyModal.title}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-poker-border/40 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-poker-border bg-poker-dark/30 px-6 gap-2">
            <button
              onClick={() => setActiveTab('hands')}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'hands'
                  ? 'border-poker-gold text-poker-gold'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <History size={16} />
              {t.historyModal.handsTab}
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'stats'
                  ? 'border-poker-gold text-poker-gold'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <Users size={16} />
              {t.historyModal.statsTab}
            </button>
            <button
              onClick={() => setActiveTab('chart')}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'chart'
                  ? 'border-poker-gold text-poker-gold'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <TrendingUp size={16} />
              {t.historyModal.chartTab}
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1 text-sm">
            {activeTab === 'hands' && (
              <div className="space-y-3">
                {history.length === 0 ? (
                  <p className="text-center text-stone-500 py-8">{t.historyModal.noHandsYet}</p>
                ) : (
                  history
                    .slice()
                    .reverse()
                    .map((item) => (
                      <div
                        key={item.handNumber}
                        className="bg-poker-dark/60 border border-poker-border rounded-xl p-3.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-poker-gold font-serif">
                            {t.historyModal.handNum}
                            {item.handNumber}
                          </span>
                          <span className="text-stone-400">Pot: {item.pot} chip</span>
                        </div>
                        <p className="text-stone-300 text-xs">{item.summary}</p>
                      </div>
                    ))
                )}
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-300 border-collapse">
                  <thead>
                    <tr className="border-b border-poker-border text-stone-400">
                      <th className="py-2 px-2">{t.historyModal.player}</th>
                      <th className="py-2 px-2">{t.historyModal.chips}</th>
                      <th className="py-2 px-2">{t.historyModal.netProfit}</th>
                      <th className="py-2 px-2">{t.historyModal.handsPlayed}</th>
                      <th className="py-2 px-2">{t.historyModal.winRate}</th>
                      <th className="py-2 px-2">{t.historyModal.foldRate}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-poker-border/40">
                    {stats.map((st) => {
                      const winRate =
                        st.handsPlayed > 0
                          ? Math.round((st.handsWon / st.handsPlayed) * 100)
                          : 0;
                      const foldRate =
                        st.handsPlayed > 0
                          ? Math.round((st.foldCount / st.handsPlayed) * 100)
                          : 0;
                      return (
                        <tr key={st.playerId} className="hover:bg-poker-dark/30">
                          <td className="py-2.5 px-2 font-bold text-white">{st.nick}</td>
                          <td className="py-2.5 px-2 text-poker-gold font-mono">{st.chips}</td>
                          <td
                            className={`py-2.5 px-2 font-mono ${
                              st.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {st.netProfit > 0 ? `+${st.netProfit}` : st.netProfit}
                          </td>
                          <td className="py-2.5 px-2">{st.handsPlayed}</td>
                          <td className="py-2.5 px-2">{winRate}%</td>
                          <td className="py-2.5 px-2">{foldRate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'chart' && (
              <div className="space-y-4">
                <p className="text-xs text-stone-400">
                  Her el sonunda oyuncuların chip miktarlarındaki değişim:
                </p>
                <div className="bg-poker-dark/80 p-4 rounded-xl border border-poker-border flex items-center justify-center min-h-[220px]">
                  {stats.some((s) => s.chipHistory.length > 0) ? (
                    <SimpleChipChart stats={stats} />
                  ) : (
                    <p className="text-xs text-stone-500">
                      Grafik için en az bir el tamamlanmalıdır.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-poker-border bg-poker-dark/60 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-poker-wine hover:bg-poker-wineHover text-amber-100 font-medium transition-colors"
            >
              {t.historyModal.close}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

/**
 * Lightweight SVG line chart for chip histories
 */
function SimpleChipChart({ stats }: { stats: PlayerGameStats[] }) {
  const maxHands = Math.max(1, ...stats.map((s) => s.chipHistory.length));
  const maxChip = Math.max(1500, ...stats.flatMap((s) => s.chipHistory.map((h) => h.chips)));
  const minChip = Math.min(0, ...stats.flatMap((s) => s.chipHistory.map((h) => h.chips)));

  const width = 500;
  const height = 180;
  const padding = 30;

  const getX = (idx: number) => padding + (idx / Math.max(1, maxHands - 1)) * (width - 2 * padding);
  const getY = (val: number) =>
    height - padding - ((val - minChip) / Math.max(1, maxChip - minChip)) * (height - 2 * padding);

  const colors = ['#D6A653', '#38BDF8', '#4ADE80', '#F43F5E', '#A855F7', '#FB923C'];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-[220px]">
        {/* Baseline grid */}
        <line
          x1={padding}
          y1={getY(1000)}
          x2={width - padding}
          y2={getY(1000)}
          stroke="#332537"
          strokeDasharray="4 4"
        />
        {/* Lines */}
        {stats.map((s, sIdx) => {
          if (s.chipHistory.length === 0) return null;
          const points = s.chipHistory
            .map((h, i) => `${getX(i)},${getY(h.chips)}`)
            .join(' ');
          const strokeColor = colors[sIdx % colors.length];

          return (
            <g key={s.playerId}>
              <polyline
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />
              {s.chipHistory.map((h, i) => (
                <circle
                  key={i}
                  cx={getX(i)}
                  cy={getY(h.chips)}
                  r="3.5"
                  fill={strokeColor}
                />
              ))}
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div className="flex flex-wrap gap-4 justify-center mt-3 text-xs">
        {stats.map((s, idx) => (
          <div key={s.playerId} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors[idx % colors.length] }}
            />
            <span className="text-stone-300 font-medium">{s.nick}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
