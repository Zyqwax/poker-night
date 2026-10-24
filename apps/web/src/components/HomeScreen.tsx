import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Edit2, History } from 'lucide-react';
import { formatRoomCode } from '@poker-night/shared';
import { useSocket } from '../context/SocketContext.js';
import { t } from '../i18n/tr.js';
import { getRecentRooms } from '../utils/storage.js';

interface HomeScreenProps {
  onOpenHelp: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onOpenHelp }) => {
  const {
    nick,
    setNick,
    createRoom,
    joinRoom,
    activeRoomCode,
    abandonActiveRoom,
    lastError,
    clearError,
  } = useSocket();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isChangingNick, setIsChangingNick] = useState(() => !nick);
  const [nickInput, setNickInput] = useState(nick);
  const [showRecent, setShowRecent] = useState(false);
  const [nickNotice, setNickNotice] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleCreateRoom = () => {
    if (!nick.trim()) {
      setNickNotice(t.home.noNickWarning);
      setIsChangingNick(true);
      return;
    }
    createRoom();
  };

  const handleDigitChange = (index: number, value: string) => {
    clearError();
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    // Single character
    const char = clean.slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);

    // Auto advance
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    clearError();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = [...digits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    setDigits(next);

    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nick.trim()) {
      setNickNotice(t.home.noNickWarning);
      setIsChangingNick(true);
      return;
    }
    const code = digits.join('');
    if (code.length === 6) {
      joinRoom(code);
    }
  };

  const handleSaveNick = (e: React.FormEvent) => {
    e.preventDefault();
    if (nickInput.trim().length >= 2) {
      setNick(nickInput.trim());
      setIsChangingNick(false);
      setNickNotice(null);
    }
  };

  const recentRooms = getRecentRooms();
  const isCodeComplete = digits.join('').length === 6;

  return (
    <div className="min-h-screen bg-poker-dark flex flex-col justify-between px-6 py-10 max-w-md mx-auto relative select-none">
      {/* Top Header */}
      <div className="pt-6 text-center space-y-3">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl sm:text-5xl font-serif font-bold tracking-tight text-amber-100"
        >
          {t.app.title}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-stone-400 text-sm whitespace-pre-line leading-relaxed"
        >
          {t.app.subtitle}
        </motion.p>
      </div>

      {/* Main Actions matching PDF Page 1 */}
      <div className="my-auto py-8 space-y-10">
        {/* Create Room Button */}
        <div>
          <button
            onClick={() => handleCreateRoom()}
            className="w-full py-4 px-6 rounded-2xl bg-poker-wine hover:bg-poker-wineHover border border-poker-border text-poker-gold font-serif font-bold text-lg flex items-center justify-between shadow-xl transition-all active:scale-[0.99]"
          >
            <span>{t.home.createRoom}</span>
          </button>
        </div>

        {/* Join Room Section */}
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-serif font-bold text-stone-100">
              {t.home.joinRoom}
            </h2>
            <p className="text-stone-400 text-xs mt-1">
              {t.home.enterCodeHint}
            </p>
          </div>

          {/* 6 Digits Input */}
          <div className="flex justify-between gap-2.5 pt-2" onPaste={handlePaste}>
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (inputRefs.current[idx] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-serif font-bold rounded-xl border bg-poker-dark text-amber-100 focus:outline-none transition-all ${
                  digit
                    ? 'border-poker-gold/80 bg-poker-card shadow-sm'
                    : 'border-stone-800 focus:border-poker-gold/60'
                }`}
              />
            ))}
          </div>

          {lastError && (
            <p className="text-rose-400 text-xs bg-rose-950/40 border border-rose-900/50 p-2.5 rounded-xl">
              {lastError}
            </p>
          )}

          {/* Join Button */}
          <button
            disabled={!isCodeComplete}
            onClick={() => handleJoin()}
            className="w-full py-3.5 rounded-2xl border border-poker-gold/80 text-poker-gold hover:bg-poker-gold/10 font-bold transition-all disabled:opacity-40 disabled:border-stone-700 disabled:text-stone-500 disabled:cursor-not-allowed shadow-md"
          >
            {t.home.joinBtn}
          </button>
        </div>

        {/* Help & Recent Rooms Links */}
        <div className="flex items-center justify-center gap-6 pt-2 text-xs text-stone-400">
          <button
            onClick={onOpenHelp}
            className="flex items-center gap-1.5 hover:text-poker-gold transition-colors"
          >
            <BookOpen size={14} />
            {t.home.handHelpBtn}
          </button>
          {recentRooms.length > 0 && (
            <button
              onClick={() => setShowRecent(!showRecent)}
              className="flex items-center gap-1.5 hover:text-poker-gold transition-colors"
            >
              <History size={14} />
              {t.home.recentRooms}
            </button>
          )}
        </div>

        {/* Recent Rooms Dropdown */}
        {showRecent && recentRooms.length > 0 && (
          <div className="bg-poker-card border border-poker-border rounded-xl p-3 space-y-2 text-xs">
            <span className="font-semibold text-stone-400 block">{t.home.recentRooms}:</span>
            <div className="flex flex-wrap gap-2">
              {recentRooms.map((r) => (
                <button
                  key={r.code}
                  onClick={() => joinRoom(r.code)}
                  className="px-3 py-1.5 bg-poker-dark border border-poker-border hover:border-poker-gold text-amber-200 rounded-lg font-mono transition-colors"
                >
                  {r.code.slice(0, 3)} {r.code.slice(3)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar: Nick on Left, Nick Değiştir on Right */}
      <div className="pt-6 border-t border-poker-border/40 flex items-center justify-between text-sm">
        <div className="text-stone-400">
          <span>{t.home.nickLabel} </span>
          {nick ? (
            <span className="text-amber-100 font-semibold">{nick}</span>
          ) : (
            <span className="text-amber-300/80 font-medium italic underline cursor-pointer" onClick={() => setIsChangingNick(true)}>
              {t.home.unspecifiedNick}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            setNickInput(nick);
            setIsChangingNick(true);
          }}
          className={`transition-colors ${
            nick
              ? 'text-stone-400 hover:text-poker-gold'
              : 'text-poker-gold hover:text-poker-goldHover font-bold animate-pulse'
          }`}
        >
          {nick ? t.home.changeNick : t.home.setNickFirst}
        </button>
      </div>

      {/* Nick Change Modal */}
      {isChangingNick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-poker-card border border-poker-border rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div>
              <h3 className="text-lg font-serif font-bold text-poker-gold">
                {t.home.enterNickTitle}
              </h3>
              {nickNotice && (
                <p className="text-xs text-rose-300 mt-1.5 bg-rose-950/40 border border-rose-900/40 p-2 rounded-lg">
                  {nickNotice}
                </p>
              )}
            </div>
            <form onSubmit={handleSaveNick} className="space-y-4">
              <input
                type="text"
                autoFocus
                maxLength={16}
                value={nickInput}
                onChange={(e) => setNickInput(e.target.value)}
                placeholder={t.home.nickPlaceholder}
                className="w-full bg-poker-dark border border-poker-border rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-poker-gold"
              />
              <div className="flex justify-end gap-3">
                {nick && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingNick(false);
                      setNickNotice(null);
                    }}
                    className="px-4 py-2 rounded-xl text-stone-400 hover:text-white"
                  >
                    {t.home.cancel}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={nickInput.trim().length < 2}
                  className="px-5 py-2 rounded-xl bg-poker-wine hover:bg-poker-wineHover text-poker-gold font-bold disabled:opacity-40"
                >
                  {t.home.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Room Reconnect / Abandon Modal */}
      {activeRoomCode && !isChangingNick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-poker-card border border-poker-gold/40 rounded-2xl w-full max-w-sm p-6 space-y-5 shadow-2xl text-center"
          >
            <div>
              <h3 className="text-xl font-serif font-bold text-amber-100">
                {t.home.activeRoomTitle}
              </h3>
              <p className="text-sm text-stone-300 mt-2">
                <span className="font-mono font-bold text-poker-gold tracking-widest text-lg">
                  {formatRoomCode(activeRoomCode)}
                </span>{' '}
                {t.home.inRoomNotice}
              </p>
            </div>

            {lastError && (
              <p className="text-rose-400 text-xs bg-rose-950/40 border border-rose-900/50 p-2.5 rounded-xl">
                {lastError}
              </p>
            )}

            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => {
                  if (!nick.trim()) {
                    setNickNotice(t.home.noNickWarning);
                    setIsChangingNick(true);
                    return;
                  }
                  joinRoom(activeRoomCode);
                }}
                className="w-full py-3.5 px-4 rounded-xl bg-poker-wine hover:bg-poker-wineHover text-poker-gold border border-poker-border font-bold font-serif text-base shadow-lg transition-all active:scale-[0.98]"
              >
                {t.home.rejoinBtn}
              </button>
              <button
                onClick={() => abandonActiveRoom(activeRoomCode)}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-900/80 hover:bg-stone-800 text-stone-400 hover:text-rose-400 border border-stone-800 font-medium text-sm transition-all"
              >
                {t.home.abandonBtn}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
