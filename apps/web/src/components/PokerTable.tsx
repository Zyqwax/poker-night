import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Minimize2, Settings, History, HelpCircle, WifiOff } from 'lucide-react';
import { Card, GamePublicState, PlayerPublicState, formatRoomCode } from '@poker-night/shared';
import { detectCurrentBestHand } from '@poker-night/engine';
import { useSocket } from '../context/SocketContext.js';
import { t } from '../i18n/tr.js';
import { CardView } from './CardView.js';
import { SettingsModal } from './SettingsModal.js';
import { HistoryAndStatsModal } from './HistoryAndStatsModal.js';
import { HandRankingsModal } from './HandRankingsModal.js';

export const PokerTable: React.FC = () => {
  const {
    playerId,
    roomState,
    myHoleCards,
    showdownData,
    sendAction,
    updateSettings,
    rebuy,
    kickPlayer,
    isConnected,
  } = useSocket();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const game = roomState?.game;
  const isHost = roomState?.hostId === playerId;

  const currentPlayer = useMemo(
    () => roomState?.players.find((p) => p.id === playerId),
    [roomState, playerId]
  );

  const isMyTurn = Boolean(
    game &&
      game.currentTurnSeat !== null &&
      currentPlayer &&
      game.currentTurnSeat === currentPlayer.seatIndex &&
      currentPlayer.status === 'active'
  );

  // Turn timer countdown
  useEffect(() => {
    if (!game?.turnEndsAt) {
      setTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((game.turnEndsAt! - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [game?.turnEndsAt]);

  // Sync default raise slider
  useEffect(() => {
    if (game && currentPlayer) {
      const minTarget = game.minRaise;
      setRaiseAmount(minTarget);
    }
  }, [game?.minRaise, currentPlayer?.seatIndex]);

  // Fullscreen toggler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!roomState || !game) return null;

  // Best 5 cards detection for the user
  const currentHandInfo = detectCurrentBestHand(myHoleCards, game.communityCards);

  // Calculate call amount
  const callAmount = Math.max(0, game.currentHighestBet - (currentPlayer?.currentRoundBet || 0));
  const canCheck = callAmount === 0;
  const canCall = callAmount > 0 && (currentPlayer?.chips || 0) > 0;
  const actualCallToPay = Math.min(callAmount, currentPlayer?.chips || 0);

  // Raise targets
  const minRaise = game.minRaise;
  const maxRaise = (currentPlayer?.currentRoundBet || 0) + (currentPlayer?.chips || 0);
  const canRaise =
    (currentPlayer?.chips || 0) > callAmount &&
    maxRaise >= minRaise &&
    (currentPlayer?.chips || 0) >= minRaise - (currentPlayer?.currentRoundBet || 0);

  // Arrange players around table relative to current user
  const sortedPlayers = [...roomState.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const myIndex = sortedPlayers.findIndex((p) => p.id === playerId);
  const reorderedPlayers: PlayerPublicState[] =
    myIndex >= 0
      ? [...sortedPlayers.slice(myIndex), ...sortedPlayers.slice(0, myIndex)]
      : sortedPlayers;

  // Other players (excluding current player at bottom)
  const otherPlayers = reorderedPlayers.filter((p) => p.id !== playerId);

  const formattedRoomCode = formatRoomCode(roomState.code);

  return (
    <div className="h-screen h-[100dvh] max-h-[100dvh] bg-poker-dark flex flex-col justify-between p-2 sm:p-4 select-none text-stone-200 overflow-hidden relative">
      {/* Top Bar: Room Code on Left, Fullscreen and Actions on Right */}
      <div className="flex items-center justify-between z-10 py-1 border-b border-poker-border/40 shrink-0">
        <div className="font-serif font-bold text-base sm:text-lg text-amber-100 flex items-center gap-2">
          <span>{t.table.room} {formattedRoomCode}</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm font-medium text-stone-300">
          <button
            onClick={toggleFullscreen}
            className="hover:text-poker-gold transition-colors flex items-center gap-1"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            <span className="hidden sm:inline">
              {isFullscreen ? t.table.exitFullscreen : t.table.fullscreen}
            </span>
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="hover:text-poker-gold transition-colors flex items-center gap-1"
          >
            <Settings size={15} />
            <span className="hidden sm:inline">{t.table.settings}</span>
          </button>
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="hover:text-poker-gold transition-colors flex items-center gap-1"
          >
            <History size={15} />
            <span className="hidden sm:inline">{t.table.history}</span>
          </button>
          <button
            onClick={() => setIsHelpOpen(true)}
            className="hover:text-poker-gold transition-colors flex items-center gap-1"
          >
            <HelpCircle size={15} />
            <span className="hidden sm:inline">{t.table.help}</span>
          </button>
        </div>
      </div>

      {/* Main Oval Poker Table Area */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center relative w-full max-w-3xl mx-auto px-2 py-1">
        {/* The Oval Felt Table */}
        <div className="relative w-full max-w-[560px] sm:max-w-[680px] aspect-[16/10] max-h-[46vh] sm:max-h-[50vh] rounded-[100px] sm:rounded-[180px] bg-gradient-to-b from-[#441822] to-[#2B0E16] border-[8px] sm:border-[12px] border-[#50232E] shadow-[0_0_40px_rgba(0,0,0,0.8)_inset,0_10px_30px_rgba(0,0,0,0.7)] flex flex-col items-center justify-center p-3 sm:p-5">
          {/* Outer Gold Accent Rim */}
          <div className="absolute inset-[-3px] rounded-[103px] sm:rounded-[183px] border border-poker-gold/30 pointer-events-none" />

          {/* Center Community Cards and Pot */}
          <div className="flex flex-col items-center gap-2 sm:gap-2.5 z-10">
            {/* Community Cards */}
            <div className="flex items-center gap-1 sm:gap-2">
              {[0, 1, 2, 3, 4].map((idx) => {
                const card = game.communityCards[idx];
                return (
                  <CardView
                    key={idx}
                    card={card}
                    empty={!card}
                    size="sm"
                    className="shadow-xl"
                  />
                );
              })}
            </div>

            {/* Pot Display matching PDF Page 2 */}
            <div className="flex flex-col items-center text-center">
              <span className="text-[10px] sm:text-xs text-stone-400 font-medium tracking-wide">
                {t.table.pot}
              </span>
              <span className="text-2xl sm:text-3xl font-serif font-bold text-amber-100 leading-none">
                {game.pot.toLocaleString()}
              </span>
              {/* Chip indicators */}
              <div className="flex items-center gap-1 mt-1">
                <span className="w-2 h-2 rounded-full bg-white border border-stone-300 shadow-sm" />
                <span className="w-2 h-2 rounded-full bg-amber-400 border border-amber-600 shadow-sm" />
                <span className="w-2 h-2 rounded-full bg-rose-600 border border-rose-800 shadow-sm" />
              </div>

              {/* Side Pots if any */}
              {game.sidePots.length > 1 && (
                <div className="text-[9px] text-stone-400 mt-0.5">
                  Side Pot: {game.sidePots.slice(1).map((sp) => sp.amount).join(' / ')}
                </div>
              )}
            </div>
          </div>

          {/* Opponent Player Seats positioned around top/sides */}
          {otherPlayers.map((player, idx) => {
            const isTurn = game.currentTurnSeat === player.seatIndex;
            const isDealer = game.dealerSeat === player.seatIndex;
            const isSB = game.smallBlindSeat === player.seatIndex;
            const isBB = game.bigBlindSeat === player.seatIndex;

            // Geometry positioning for 1 to 9 opponents around top semicircle
            const total = otherPlayers.length;
            const angle = Math.PI * (0.15 + (0.7 * (idx + 0.5)) / total);
            const xPercent = Math.cos(angle) * 44;
            const yPercent = -Math.sin(angle) * 44;

            const revealedCards = showdownData?.cardsByPlayer[player.id];

            return (
              <div
                key={player.id}
                style={{
                  transform: `translate(${xPercent * 1.85}%, ${yPercent * 1.6}%)`,
                }}
                className={`absolute flex flex-col items-center text-center transition-all duration-300 ${
                  !player.isConnected || player.status === 'sitting-out' ? 'opacity-40' : ''
                }`}
              >
                {/* Revealed cards at showdown */}
                {revealedCards && (
                  <div className="flex gap-1 mb-0.5 scale-75 origin-bottom">
                    {revealedCards.map((c, i) => (
                      <CardView key={i} card={c} size="sm" />
                    ))}
                  </div>
                )}

                {/* Player Name, Badge & Host Kick */}
                <div className="flex items-center gap-1">
                  <span
                    className={`font-semibold text-[11px] sm:text-xs ${
                      isTurn ? 'text-poker-gold underline font-bold' : 'text-stone-200'
                    }`}
                  >
                    {player.nick}
                  </span>
                  {isDealer && (
                    <span className="text-[9px] bg-amber-500 text-stone-950 font-bold px-1 py-0.2 rounded-full">
                      D
                    </span>
                  )}
                  {isSB && (
                    <span className="text-[9px] bg-stone-700 text-stone-200 px-1 rounded">
                      SB
                    </span>
                  )}
                  {isBB && (
                    <span className="text-[9px] bg-stone-700 text-stone-200 px-1 rounded">
                      BB
                    </span>
                  )}
                  {isHost && (
                    <button
                      onClick={() => kickPlayer(player.id)}
                      title="Oyuncuyu Odadan At"
                      className="text-[9px] text-rose-300 hover:text-white bg-rose-950/70 hover:bg-rose-900 border border-rose-800/60 px-1 rounded transition-colors ml-0.5"
                    >
                      {t.lobby.kick}
                    </button>
                  )}
                </div>

                {/* Chips */}
                <span className="text-stone-300 font-serif font-bold text-[11px] sm:text-xs">
                  {player.chips.toLocaleString()}
                </span>

                {/* Round Bet on Felt */}
                {player.currentRoundBet > 0 && (
                  <div className="mt-0.5 px-1.5 py-0.2 rounded-full bg-poker-wine border border-poker-gold/40 text-[9px] font-mono text-amber-200">
                    {player.currentRoundBet}
                  </div>
                )}

                {/* Disconnected Notice */}
                {!player.isConnected && (
                  <span className="text-[9px] text-rose-400 mt-0.5 flex items-center gap-0.5">
                    <WifiOff size={9} />
                    {t.table.disconnected}
                  </span>
                )}
              </div>
            );
          })}

          {/* Current User Box at Bottom of Table matching PDF Page 2 ("Enes 640") */}
          <div className="absolute bottom-[-12px] sm:bottom-[-16px] z-20 flex flex-col items-center">
            {/* User Hole Cards */}
            <div className="flex gap-1.5 mb-1">
              {myHoleCards.length === 2 ? (
                myHoleCards.map((card, i) => (
                  <CardView key={i} card={card} size="md" className="shadow-2xl" />
                ))
              ) : (
                <>
                  <CardView hidden size="md" />
                  <CardView hidden size="md" />
                </>
              )}
            </div>

            {/* Current user badge */}
            <div
              className={`px-4 py-1 sm:px-5 sm:py-1.5 rounded-xl border bg-poker-card/95 shadow-xl flex items-center gap-2.5 ${
                isMyTurn
                  ? 'border-poker-gold shadow-poker-gold/30 ring-2 ring-poker-gold/50'
                  : 'border-poker-border'
              }`}
            >
              <span className="font-serif font-bold text-stone-100 text-sm sm:text-base">
                {currentPlayer?.nick}
              </span>
              <span className="font-serif font-bold text-poker-gold text-sm sm:text-base">
                {currentPlayer?.chips.toLocaleString()}
              </span>
            </div>

            {/* Best 5-card Hand auto-detected text */}
            {currentHandInfo.textTr && (
              <span className="text-[11px] sm:text-xs text-amber-300/90 font-medium mt-0.5 drop-shadow-md">
                {currentHandInfo.textTr}
              </span>
            )}
          </div>
        </div>

        {/* Turn Status Indicator matching PDF Page 2 */}
        <div className="mt-2.5 sm:mt-3 text-center">
          {isMyTurn ? (
            <motion.div
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-amber-300 font-serif font-bold text-sm sm:text-base flex items-center justify-center gap-1.5"
            >
              <span>{t.table.yourTurn}</span>
              <span>·</span>
              <span>{timeLeft} sn</span>
            </motion.div>
          ) : game.currentTurnSeat !== null ? (
            <div className="text-stone-400 text-xs">
              {t.table.waitingFor}{' '}
              <span className="text-stone-200 font-medium">
                {roomState.players.find((p) => p.seatIndex === game.currentTurnSeat)?.nick}
              </span>{' '}
              · {timeLeft} sn
            </div>
          ) : null}
        </div>
      </div>

      {/* Action Controls Panel matching PDF Page 2 */}
      <div className="w-full max-w-lg mx-auto pt-1 pb-1 sm:pb-2 space-y-1.5 z-20 shrink-0">
        {/* Raise Slider and Preset Buttons */}
        {isMyTurn && canRaise && (
          <div className="bg-poker-card/90 border border-poker-border rounded-xl p-2 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-300">
              <span className="text-poker-gold font-serif text-[11px]">{t.table.raise}</span>
              <span className="text-base font-serif font-bold text-amber-100 font-mono">
                {raiseAmount}
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={minRaise}
              max={maxRaise}
              step={roomState.settings.bigBlind}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              className="w-full accent-poker-gold cursor-pointer h-1.5"
            />

            {/* Quick Presets: Min | 1/2 pot | Pot */}
            <div className="grid grid-cols-3 gap-1.5 pt-0.5 text-[11px] font-medium">
              <button
                onClick={() => setRaiseAmount(minRaise)}
                className="py-1 rounded bg-poker-dark hover:bg-poker-border border border-poker-border text-stone-300 transition-colors"
              >
                {t.table.min}
              </button>
              <button
                onClick={() =>
                  setRaiseAmount(
                    Math.min(maxRaise, Math.max(minRaise, Math.floor(game.pot / 2)))
                  )
                }
                className="py-1 rounded bg-poker-dark hover:bg-poker-border border border-poker-border text-stone-300 transition-colors"
              >
                {t.table.halfPot}
              </button>
              <button
                onClick={() =>
                  setRaiseAmount(Math.min(maxRaise, Math.max(minRaise, game.pot)))
                }
                className="py-1 rounded bg-poker-dark hover:bg-poker-border border border-poker-border text-stone-300 transition-colors"
              >
                {t.table.fullPot}
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons matching PDF Page 2: Fold, Check, Call, All in */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Fold */}
          <button
            disabled={!isMyTurn}
            onClick={() => sendAction('fold')}
            className="py-2.5 sm:py-3 rounded-xl bg-poker-wine hover:bg-poker-wineHover text-rose-100 font-serif font-bold text-sm sm:text-base disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
          >
            {t.table.fold}
          </button>

          {/* Check */}
          <button
            disabled={!isMyTurn || !canCheck}
            onClick={() => sendAction('check')}
            className="py-2.5 sm:py-3 rounded-xl bg-poker-wine hover:bg-poker-wineHover text-stone-200 font-serif font-bold text-sm sm:text-base disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
          >
            {t.table.check}
          </button>

          {/* Call / Raise action */}
          {canRaise && raiseAmount > game.currentHighestBet ? (
            <button
              disabled={!isMyTurn}
              onClick={() => sendAction('raise', raiseAmount)}
              className="py-2.5 sm:py-3 rounded-xl bg-poker-teal hover:bg-poker-tealHover text-emerald-100 font-serif font-bold text-sm sm:text-base disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
            >
              {t.table.raise} {raiseAmount}
            </button>
          ) : (
            <button
              disabled={!isMyTurn || !canCall}
              onClick={() => sendAction('call')}
              className="py-2.5 sm:py-3 rounded-xl bg-poker-teal hover:bg-poker-tealHover text-emerald-100 font-serif font-bold text-sm sm:text-base disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
            >
              {t.table.call} {callAmount > 0 ? actualCallToPay : ''}
            </button>
          )}

          {/* All in */}
          <button
            disabled={!isMyTurn || (currentPlayer?.chips || 0) === 0}
            onClick={() => sendAction('all-in')}
            className="py-2.5 sm:py-3 rounded-xl bg-poker-gold hover:bg-poker-goldHover text-stone-950 font-serif font-bold text-sm sm:text-base disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
          >
            {t.table.allIn}
          </button>
        </div>

        {/* Rebuy option if chips are 0 */}
        {currentPlayer?.chips === 0 && roomState.settings.rebuy && (
          <div className="bg-amber-950/70 border border-amber-800 p-2 rounded-xl flex items-center justify-between text-xs">
            <span className="text-amber-200 text-[11px]">{t.table.rebuyPrompt}</span>
            <button
              onClick={rebuy}
              className="px-3 py-1 bg-poker-gold text-stone-950 font-bold text-xs rounded-lg hover:bg-poker-goldHover shadow"
            >
              {t.table.rebuyBtn}
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={roomState.settings}
        isHost={isHost}
        isGameActive={true}
        onSave={(newSet) => updateSettings(newSet)}
      />

      <HistoryAndStatsModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={roomState.history}
        stats={roomState.stats}
      />

      <HandRankingsModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
};
