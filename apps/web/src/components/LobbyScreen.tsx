import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Settings, LogOut } from 'lucide-react';
import { useSocket } from '../context/SocketContext.js';
import { t } from '../i18n/tr.js';
import { SettingsModal } from './SettingsModal.js';

export const LobbyScreen: React.FC = () => {
  const {
    playerId,
    roomState,
    leaveRoom,
    toggleReady,
    startGame,
    updateSettings,
    kickPlayer,
    lastError,
  } = useSocket();

  const [copied, setCopied] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  if (!roomState) return null;

  const currentPlayer = roomState.players.find((p) => p.id === playerId);
  const isHost = roomState.hostId === playerId;
  const isReady = currentPlayer?.isReady || false;

  const handleCopy = () => {
    navigator.clipboard.writeText(roomState.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedCode = `${roomState.code.slice(0, 3)} ${roomState.code.slice(3)}`;
  const notReadyCount = roomState.players.filter((p) => !p.isReady).length;
  const canHostStart = roomState.players.length >= 2;

  return (
    <div className="min-h-screen bg-poker-dark flex flex-col justify-between px-6 py-8 max-w-md mx-auto select-none">
      {/* Top Bar: Lobi on left, Odadan çık on right */}
      <div className="flex items-center justify-between border-b border-poker-border/40 pb-4">
        <h1 className="text-3xl font-serif font-bold text-amber-100">
          {t.lobby.title}
        </h1>
        <button
          onClick={leaveRoom}
          className="text-stone-400 hover:text-rose-400 text-sm flex items-center gap-1.5 transition-colors"
        >
          <LogOut size={16} />
          {t.lobby.leaveRoom}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="my-auto py-6 space-y-8">
        {/* Room Code Section */}
        <div className="space-y-1">
          <span className="text-stone-400 text-xs block">{t.lobby.roomCode}</span>
          <div className="flex items-center justify-between">
            <span className="text-4xl sm:text-5xl font-serif font-bold tracking-wider text-amber-100">
              {formattedCode}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-poker-card border border-poker-border hover:border-poker-gold/60 text-sm text-stone-200 transition-colors"
            >
              {copied ? (
                <>
                  <Check size={16} className="text-emerald-400" />
                  <span className="text-emerald-400 text-xs">{t.lobby.copied}</span>
                </>
              ) : (
                <>
                  <Copy size={16} className="text-poker-gold" />
                  <span className="text-xs">{t.lobby.copy}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Players List */}
        <div className="space-y-3 divide-y divide-poker-border/40">
          {roomState.players.map((p) => (
            <div key={p.id} className="pt-3 first:pt-0 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-stone-100">{p.nick}</span>
                {p.isHost && (
                  <span className="text-xs text-amber-400/90 font-serif">
                    {t.lobby.hostBadge}
                  </span>
                )}
                {!p.isConnected && (
                  <span className="text-[10px] text-rose-400 border border-rose-800 px-1.5 py-0.2 rounded">
                    Koptu
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <span
                  className={`text-xs font-medium ${
                    p.isReady ? 'text-amber-200' : 'text-stone-500'
                  }`}
                >
                  {p.isReady ? t.lobby.ready : t.lobby.waiting}
                </span>
                {isHost && p.id !== playerId && (
                  <button
                    onClick={() => kickPlayer(p.id)}
                    title="Oyuncuyu Odadan At"
                    className="text-[11px] text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/50 px-2 py-0.5 rounded-lg transition-colors"
                  >
                    {t.lobby.kick}
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Dealer Bot Row */}
          <div className="pt-3 flex items-center justify-between text-sm">
            <span className="font-semibold text-stone-300">{t.lobby.dealer}</span>
            <span className="text-xs text-poker-gold font-medium">
              {t.lobby.dealerReady}
            </span>
          </div>
        </div>

        {/* Room Settings Summary */}
        <div className="bg-poker-card/60 border border-poker-border rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-serif font-bold text-amber-100 text-lg">
              {t.lobby.settings}
            </span>
            {isHost && (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="text-xs text-poker-gold hover:text-poker-goldHover transition-colors flex items-center gap-1"
              >
                <Settings size={14} />
                {t.lobby.edit}
              </button>
            )}
          </div>
          <div className="text-xs text-stone-400 space-y-1">
            <p>
              Başlangıç chip {roomState.settings.startingChips.toLocaleString()} · Blind{' '}
              {roomState.settings.smallBlind} / {roomState.settings.bigBlind}
            </p>
            <p>
              Hamle süresi {roomState.settings.turnTimeSeconds} sn · Bağlantı toleransı{' '}
              {roomState.settings.disconnectToleranceSeconds} sn
            </p>
          </div>
        </div>

        {lastError && (
          <p className="text-rose-400 text-xs bg-rose-950/40 border border-rose-900/50 p-2.5 rounded-xl">
            {lastError}
          </p>
        )}
      </div>

      {/* Bottom Action Buttons */}
      <div className="space-y-3 pt-4">
        {/* Hazırım Button */}
        <button
          onClick={toggleReady}
          className={`w-full py-4 rounded-2xl font-serif font-bold text-lg transition-all shadow-xl active:scale-[0.99] ${
            isReady
              ? 'bg-poker-border text-stone-300 hover:bg-stone-800'
              : 'bg-poker-gold hover:bg-poker-goldHover text-stone-950 shadow-poker-gold/20'
          }`}
        >
          {isReady ? t.lobby.iAmNotReady : t.lobby.iAmReady}
        </button>

        {/* Host Start Game Button */}
        {isHost && (
          <button
            disabled={!canHostStart}
            onClick={startGame}
            className="w-full py-3 text-stone-400 hover:text-stone-200 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {notReadyCount > 0
              ? `${t.lobby.startGame} · ${notReadyCount} ${t.lobby.waitingPlayers}`
              : t.lobby.startGame}
          </button>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={roomState.settings}
        isHost={isHost}
        isGameActive={false}
        onSave={(newSet) => updateSettings(newSet)}
      />
    </div>
  );
};
