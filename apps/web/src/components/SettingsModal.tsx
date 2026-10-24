import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, VolumeX } from 'lucide-react';
import { RoomSettings } from '@poker-night/shared';
import { t } from '../i18n/tr.js';
import { soundManager } from '../utils/sound.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RoomSettings;
  isHost: boolean;
  isGameActive: boolean;
  onSave: (newSettings: Partial<RoomSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  isHost,
  isGameActive,
  onSave,
}) => {
  const [form, setForm] = useState<RoomSettings>({ ...settings });
  const [soundEnabled, setSoundEnabled] = useState(() => soundManager.isEnabled());

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHost) {
      onClose();
      return;
    }
    onSave(form);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-poker-card border border-poker-border rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-poker-border bg-poker-dark/60">
            <h2 className="text-xl font-serif font-bold text-poker-gold">
              {t.settingsModal.title}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-poker-border/40 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm">
            {isGameActive && (
              <p className="text-xs text-amber-300 bg-amber-950/40 p-2.5 rounded-lg border border-amber-800/50">
                {t.settingsModal.readOnlyNotice}
              </p>
            )}

            {/* Starting Chips */}
            <div>
              <label className="block text-xs font-semibold text-stone-400 mb-1">
                {t.settingsModal.startingChips}
              </label>
              <input
                type="number"
                disabled={!isHost || isGameActive}
                value={form.startingChips}
                onChange={(e) => setForm({ ...form, startingChips: Number(e.target.value) })}
                className="w-full bg-poker-dark border border-poker-border rounded-xl px-3 py-2 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:border-poker-gold"
              />
            </div>

            {/* Small Blind & Big Blind */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-400 mb-1">
                  {t.settingsModal.smallBlind}
                </label>
                <input
                  type="number"
                  disabled={!isHost || isGameActive}
                  value={form.smallBlind}
                  onChange={(e) => setForm({ ...form, smallBlind: Number(e.target.value) })}
                  className="w-full bg-poker-dark border border-poker-border rounded-xl px-3 py-2 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:border-poker-gold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-400 mb-1">
                  {t.settingsModal.bigBlind}
                </label>
                <input
                  type="number"
                  disabled={!isHost || isGameActive}
                  value={form.bigBlind}
                  onChange={(e) => setForm({ ...form, bigBlind: Number(e.target.value) })}
                  className="w-full bg-poker-dark border border-poker-border rounded-xl px-3 py-2 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:border-poker-gold"
                />
              </div>
            </div>

            {/* Turn Time */}
            <div>
              <label className="block text-xs font-semibold text-stone-400 mb-1">
                {t.settingsModal.turnTime} ({form.turnTimeSeconds} sn)
              </label>
              <input
                type="range"
                min={10}
                max={120}
                step={5}
                disabled={!isHost}
                value={form.turnTimeSeconds}
                onChange={(e) => setForm({ ...form, turnTimeSeconds: Number(e.target.value) })}
                className="w-full accent-poker-gold disabled:opacity-60 cursor-pointer"
              />
            </div>

            {/* Disconnect Tolerance */}
            <div>
              <label className="block text-xs font-semibold text-stone-400 mb-1">
                {t.settingsModal.disconnectTolerance} ({form.disconnectToleranceSeconds} sn)
              </label>
              <input
                type="range"
                min={15}
                max={180}
                step={15}
                disabled={!isHost}
                value={form.disconnectToleranceSeconds}
                onChange={(e) =>
                  setForm({ ...form, disconnectToleranceSeconds: Number(e.target.value) })
                }
                className="w-full accent-poker-gold disabled:opacity-60 cursor-pointer"
              />
            </div>

            {/* Blind Increase */}
            <div>
              <label className="block text-xs font-semibold text-stone-400 mb-1">
                {t.settingsModal.blindIncrease}
              </label>
              <select
                disabled={!isHost}
                value={form.blindIncreaseInterval}
                onChange={(e) =>
                  setForm({ ...form, blindIncreaseInterval: Number(e.target.value) })
                }
                className="w-full bg-poker-dark border border-poker-border rounded-xl px-3 py-2 text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:border-poker-gold"
              >
                <option value={0}>{t.settingsModal.blindIncreaseOff}</option>
                <option value={5}>Her 5 elde bir</option>
                <option value={10}>Her 10 elde bir</option>
                <option value={20}>Her 20 elde bir</option>
              </select>
            </div>

            {/* Checkboxes: Auto-start & Rebuy */}
            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isHost}
                  checked={form.autoStart}
                  onChange={(e) => setForm({ ...form, autoStart: e.target.checked })}
                  className="w-4 h-4 rounded accent-poker-gold"
                />
                <span className="text-xs text-stone-300">{t.settingsModal.autoStart}</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isHost}
                  checked={form.rebuy}
                  onChange={(e) => setForm({ ...form, rebuy: e.target.checked })}
                  className="w-4 h-4 rounded accent-poker-gold"
                />
                <span className="text-xs text-stone-300">{t.settingsModal.rebuy}</span>
              </label>
            </div>

            {/* Personal Settings: Sound Effects (Available to everyone) */}
            <div className="pt-3 border-t border-poker-border/60 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 block">
                {t.settingsModal.personalSettings}
              </span>
              <label className="flex items-center justify-between p-3 rounded-xl bg-poker-dark border border-poker-border cursor-pointer hover:border-poker-gold/40 transition-colors">
                <div className="flex items-center gap-2.5">
                  {soundEnabled ? (
                    <Volume2 size={18} className="text-poker-gold shrink-0" />
                  ) : (
                    <VolumeX size={18} className="text-stone-500 shrink-0" />
                  )}
                  <div>
                    <span className="text-xs font-semibold text-stone-200 block">
                      {t.settingsModal.soundEffects}
                    </span>
                    <span className="text-[11px] text-stone-400 block">
                      {t.settingsModal.soundEffectsDesc}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setSoundEnabled(next);
                    soundManager.setEnabled(next);
                    if (next) soundManager.playClick();
                  }}
                  className="w-4 h-4 rounded accent-poker-gold cursor-pointer"
                />
              </label>
            </div>

            {/* Buttons */}
            <div className="pt-4 flex justify-end gap-3 border-t border-poker-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-stone-400 hover:text-white transition-colors"
              >
                {t.settingsModal.close}
              </button>
              {isHost && (
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-poker-wine hover:bg-poker-wineHover text-poker-gold font-bold transition-colors shadow-md"
                >
                  {t.settingsModal.saveChanges}
                </button>
              )}
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
