import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { Card, PlayerPublicState, formatRoomCode } from '@poker-night/shared';
import { detectCurrentBestHand } from '@poker-night/engine';
import { useSocket } from '../context/SocketContext.js';
import { t } from '../i18n/tr.js';
import { CardView } from './CardView.js';
import { SettingsModal } from './SettingsModal.js';
import { HistoryAndStatsModal } from './HistoryAndStatsModal.js';
import { HandRankingsModal } from './HandRankingsModal.js';

/**
 * Calculates coordinates on the upper ellipse arc for opponent seats
 * so they neatly border the table felt without colliding with center cards or pot.
 */
function getSeatPosition(idx: number, total: number): { left: string; top: string } {
  if (total === 1) {
    return { left: '50%', top: '13%' };
  }
  if (total === 2) {
    const angles = [0.75 * Math.PI, 0.25 * Math.PI];
    const a = angles[idx];
    return {
      left: `${50 - 39 * Math.cos(a)}%`,
      top: `${50 - 37 * Math.sin(a)}%`,
    };
  }
  if (total === 3) {
    const angles = [0.88 * Math.PI, 0.5 * Math.PI, 0.12 * Math.PI];
    const a = angles[idx];
    return {
      left: `${50 - 41 * Math.cos(a)}%`,
      top: `${50 - 37 * Math.sin(a)}%`,
    };
  }
  // 4 to 9 opponents: evenly spread across upper perimeter arc
  const start = 1.05 * Math.PI;
  const end = -0.05 * Math.PI;
  const a = start - (idx / (total - 1)) * (start - end);
  return {
    left: `${50 + 41 * Math.cos(a)}%`,
    top: `${50 - 37 * Math.sin(a)}%`,
  };
}

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

  // Sync default raise amount when minRaise changes
  useEffect(() => {
    if (game && currentPlayer) {
      setRaiseAmount(game.minRaise);
    }
  }, [game?.minRaise, currentPlayer?.seatIndex]);

  // Fullscreen toggle
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

  // Total Pot = collected pot + all active round bets
  const totalPot =
    game.pot + roomState.players.reduce((sum, p) => sum + (p.currentRoundBet || 0), 0);

  // Betting validation
  const callAmount = Math.max(0, game.currentHighestBet - (currentPlayer?.currentRoundBet || 0));
  const canCheck = callAmount === 0;
  const canCall = callAmount > 0 && (currentPlayer?.chips || 0) > 0;
  const actualCallToPay = Math.min(callAmount, currentPlayer?.chips || 0);

  const minRaise = game.minRaise;
  const maxRaise = (currentPlayer?.currentRoundBet || 0) + (currentPlayer?.chips || 0);
  const canRaise =
    (currentPlayer?.chips || 0) > callAmount &&
    maxRaise >= minRaise &&
    (currentPlayer?.chips || 0) >= minRaise - (currentPlayer?.currentRoundBet || 0);

  // Arrange players relative to current user at bottom
  const sortedPlayers = [...roomState.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const myIndex = sortedPlayers.findIndex((p) => p.id === playerId);
  const reorderedPlayers: PlayerPublicState[] =
    myIndex >= 0
      ? [...sortedPlayers.slice(myIndex), ...sortedPlayers.slice(0, myIndex)]
      : sortedPlayers;

  const otherPlayers = reorderedPlayers.filter((p) => p.id !== playerId);
  const formattedRoomCode = formatRoomCode(roomState.code);

  return (
    <div className="h-screen h-[100dvh] max-h-[100dvh] bg-[#140E10] flex flex-col justify-between p-2 sm:p-4 select-none text-stone-200 overflow-hidden relative">
      {/* Top Bar: Room Code on Left, Navigation Links on Right */}
      <div className="w-full max-w-[1400px] mx-auto flex items-center justify-between py-1.5 sm:py-2.5 px-2 sm:px-4 z-10 shrink-0">
        <div className="font-serif font-bold text-xl sm:text-2xl lg:text-3xl text-[#EDE6DE] tracking-tight">
          {t.table.room} {formattedRoomCode}
        </div>
        <div className="flex items-center gap-3 sm:gap-5 text-xs sm:text-sm font-medium text-stone-300">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="hover:text-[#D5A04D] transition-colors"
          >
            {t.table.history}
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="hover:text-[#D5A04D] transition-colors"
          >
            {t.table.settings}
          </button>
          <button
            onClick={() => setIsHelpOpen(true)}
            className="hover:text-[#D5A04D] transition-colors"
          >
            {t.table.help}
          </button>
          <button
            onClick={toggleFullscreen}
            className="hover:text-[#D5A04D] transition-colors"
          >
            {isFullscreen ? t.table.exitFullscreen : t.table.fullscreen}
          </button>
        </div>
      </div>

      {/* Main Body: Oval Table on Left/Center, Action Controls on Right */}
      <div className="flex-1 min-h-0 w-full max-w-[1400px] mx-auto flex flex-col lg:flex-row items-center justify-center gap-3 lg:gap-8 px-1 sm:px-4 pb-1 sm:pb-3">
        {/* Table Container */}
        <div className="flex-1 w-full h-full min-h-[300px] max-h-[58vh] lg:max-h-[82vh] flex items-center justify-center relative">
          {/* Oval Table Felt */}
          <div className="relative w-full h-full max-w-[850px] max-h-[520px] aspect-[16/10] sm:aspect-[16/9] rounded-[110px] sm:rounded-[180px] lg:rounded-[240px] bg-gradient-to-b from-[#38161F] to-[#260D15] border-[6px] sm:border-[10px] border-[#4A1D27] shadow-[0_0_50px_rgba(0,0,0,0.85)_inset,0_15px_35px_rgba(0,0,0,0.7)] flex flex-col items-center justify-center">
            {/* Inner Table Rim */}
            <div className="absolute inset-[-2px] rounded-[112px] sm:rounded-[182px] lg:rounded-[242px] border border-[#D5A04D]/25 pointer-events-none" />

            {/* Opponent Seats along Perimeter */}
            {otherPlayers.map((player, idx) => {
              const pos = getSeatPosition(idx, otherPlayers.length);
              const isTurn = game.currentTurnSeat === player.seatIndex;
              const isDealer = game.dealerSeat === player.seatIndex;
              const isSB = game.smallBlindSeat === player.seatIndex;
              const isBB = game.bigBlindSeat === player.seatIndex;
              const revealedCards = showdownData?.cardsByPlayer[player.id];

              return (
                <div
                  key={player.id}
                  style={{ left: pos.left, top: pos.top }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center z-10 transition-all duration-300 pointer-events-auto ${
                    !player.isConnected || player.status === 'sitting-out' ? 'opacity-40' : ''
                  }`}
                >
                  {/* Revealed Cards at Showdown */}
                  {revealedCards && (
                    <div className="flex gap-1 mb-1 scale-75 origin-bottom">
                      {revealedCards.map((c, i) => (
                        <CardView key={i} card={c} size="sm" />
                      ))}
                    </div>
                  )}

                  {/* Player Nick & Badges */}
                  <div className="flex items-center gap-1">
                    <span
                      className={`font-semibold text-xs sm:text-sm lg:text-base leading-tight ${
                        isTurn ? 'text-[#D5A04D] font-bold underline' : 'text-stone-100'
                      }`}
                    >
                      {player.nick}
                    </span>
                    {isDealer && (
                      <span className="text-[9px] sm:text-[10px] bg-[#D5A04D] text-[#160E11] font-black px-1.5 py-0.2 rounded-full leading-tight shadow">
                        D
                      </span>
                    )}
                    {isSB && (
                      <span className="text-[9px] bg-stone-800 text-stone-200 font-bold px-1 rounded leading-tight">
                        SB
                      </span>
                    )}
                    {isBB && (
                      <span className="text-[9px] bg-stone-800 text-stone-200 font-bold px-1 rounded leading-tight">
                        BB
                      </span>
                    )}
                    {isHost && (
                      <button
                        onClick={() => kickPlayer(player.id)}
                        title="Oyuncuyu Odadan At"
                        className="text-[9px] text-rose-300 hover:text-white bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 px-1 py-0.2 rounded transition-colors ml-0.5"
                      >
                        {t.lobby.kick}
                      </button>
                    )}
                  </div>

                  {/* Player Chips */}
                  <span className="text-stone-300 font-serif font-bold text-xs sm:text-sm lg:text-base leading-tight">
                    {player.chips.toLocaleString()}
                  </span>

                  {/* Current Round Bet Badge */}
                  {player.currentRoundBet > 0 && (
                    <div className="mt-0.5 px-2 py-0.2 rounded-full bg-[#4E1925] border border-[#D5A04D]/50 text-[10px] font-mono font-bold text-amber-200 shadow">
                      {player.currentRoundBet}
                    </div>
                  )}

                  {/* Disconnected Indicator */}
                  {!player.isConnected && (
                    <span className="text-[10px] text-rose-400 mt-0.5 flex items-center gap-0.5 font-medium">
                      <WifiOff size={10} />
                      {t.table.disconnected}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Table Center: Pot, Community Cards, User Hole Cards, User Badge */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {/* Pot Display */}
              <div className="absolute top-[22%] sm:top-[25%] flex flex-col items-center text-center pointer-events-auto">
                <span className="text-[10px] sm:text-xs text-[#A69A93] font-medium tracking-widest uppercase">
                  {t.table.pot}
                </span>
                <span className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-[#F5EFE6] leading-none mt-0.5 drop-shadow-md">
                  {totalPot.toLocaleString()}
                </span>

                {/* Side Pots if any */}
                {game.sidePots.length > 1 && (
                  <div className="text-[10px] text-amber-300/80 mt-1">
                    Side Pot: {game.sidePots.slice(1).map((sp) => sp.amount).join(' / ')}
                  </div>
                )}

                {/* Showdown Winner Announcement */}
                {game.winners.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="mt-1 px-3 py-0.5 bg-amber-500/20 border border-amber-400/60 rounded-full text-xs font-bold text-amber-200 shadow-lg"
                  >
                    🏆 {game.winners.map((w) => `${w.nick} (${w.amount} chip)`).join(', ')}
                  </motion.div>
                )}
              </div>

              {/* Community Cards: 5 Card Slots */}
              <div className="absolute top-[45%] sm:top-[47%] -translate-y-1/2 flex items-center gap-1 sm:gap-2 pointer-events-auto">
                {[0, 1, 2, 3, 4].map((idx) => {
                  const card = game.communityCards[idx];
                  return (
                    <CardView
                      key={card ? `${card.suit}-${card.rank}` : `empty-${idx}`}
                      card={card}
                      empty={!card}
                      size="md"
                    />
                  );
                })}
              </div>

              {/* Current User Hole Cards */}
              <div className="absolute top-[67%] sm:top-[69%] -translate-y-1/2 flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
                {myHoleCards.length === 2 ? (
                  myHoleCards.map((card, i) => (
                    <CardView
                      key={`${card.suit}-${card.rank}-${i}`}
                      card={card}
                      size="md"
                    />
                  ))
                ) : (
                  <>
                    <CardView hidden size="md" />
                    <CardView hidden size="md" />
                  </>
                )}
              </div>

              {/* Current User Badge - Pinned to bottom border */}
              <div className="absolute top-[90%] -translate-y-1/2 z-20 flex flex-col items-center pointer-events-auto">
                <div
                  className={`px-4 py-1.5 sm:px-6 sm:py-2 rounded-xl border-2 bg-[#170E12]/95 shadow-2xl flex items-center gap-3 transition-all ${
                    isMyTurn
                      ? 'border-[#D5A04D] ring-2 ring-[#D5A04D]/40 shadow-[#D5A04D]/25'
                      : 'border-[#4A2430]'
                  }`}
                >
                  <span className="font-bold text-stone-100 text-sm sm:text-base">
                    {currentPlayer?.nick}
                  </span>
                  <span className="font-serif font-bold text-[#D5A04D] text-sm sm:text-lg">
                    {currentPlayer?.chips.toLocaleString()}
                  </span>
                </div>

                {/* Turn Status Indicator */}
                <div className="mt-1 text-center">
                  {isMyTurn ? (
                    <span className="text-[#D5A04D] font-serif font-bold text-xs sm:text-sm drop-shadow">
                      {t.table.yourTurn} · {timeLeft} sn
                    </span>
                  ) : game.currentTurnSeat !== null ? (
                    <span className="text-stone-400 text-xs">
                      {t.table.waitingFor}{' '}
                      <span className="text-stone-200 font-medium">
                        {roomState.players.find((p) => p.seatIndex === game.currentTurnSeat)?.nick}
                      </span>{' '}
                      · {timeLeft} sn
                    </span>
                  ) : null}
                </div>

                {/* Auto-detected Best Hand string */}
                {currentHandInfo.textTr && (
                  <span className="text-[11px] text-amber-200/90 font-medium drop-shadow mt-0.5">
                    {currentHandInfo.textTr}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls Panel on Right (Docked side-by-side without layout shifts) */}
        <div
          className={`w-full lg:w-[320px] max-w-sm shrink-0 flex flex-col justify-center space-y-2.5 sm:space-y-3 transition-opacity ${
            isMyTurn ? 'opacity-100' : 'opacity-40 pointer-events-none'
          }`}
        >
          {/* Raise Header & Slider */}
          <div className="bg-[#1C1216]/85 border border-[#3D1E27] rounded-2xl p-3 sm:p-4 space-y-2 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-stone-300 font-serif text-sm font-medium">
                {t.table.raise}
              </span>
              <span className="text-2xl sm:text-3xl font-serif font-black text-white font-mono">
                {raiseAmount}
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={minRaise}
              max={maxRaise}
              step={roomState.settings.bigBlind || 10}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              disabled={!isMyTurn || !canRaise}
              className="w-full accent-[#D5A04D] cursor-pointer h-2 bg-[#2D161E] rounded-lg"
            />

            {/* Quick Preset Buttons: Min | 1/2 pot | Pot */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-xs font-serif font-bold">
              <button
                type="button"
                disabled={!isMyTurn || !canRaise}
                onClick={() => setRaiseAmount(minRaise)}
                className="py-1.5 rounded-lg bg-[#27151D] hover:bg-[#381E29] border border-[#4A2533] text-stone-200 transition-colors shadow disabled:opacity-40"
              >
                {t.table.min}
              </button>
              <button
                type="button"
                disabled={!isMyTurn || !canRaise}
                onClick={() =>
                  setRaiseAmount(
                    Math.min(
                      maxRaise,
                      Math.max(minRaise, Math.floor(totalPot / 2) + game.currentHighestBet)
                    )
                  )
                }
                className="py-1.5 rounded-lg bg-[#27151D] hover:bg-[#381E29] border border-[#4A2533] text-stone-200 transition-colors shadow disabled:opacity-40"
              >
                {t.table.halfPot}
              </button>
              <button
                type="button"
                disabled={!isMyTurn || !canRaise}
                onClick={() =>
                  setRaiseAmount(
                    Math.min(maxRaise, Math.max(minRaise, totalPot + game.currentHighestBet))
                  )
                }
                className="py-1.5 rounded-lg bg-[#27151D] hover:bg-[#381E29] border border-[#4A2533] text-stone-200 transition-colors shadow disabled:opacity-40"
              >
                {t.table.fullPot}
              </button>
            </div>
          </div>

          {/* Action Buttons Grid */}
          <div className="flex flex-col gap-2 sm:gap-2.5">
            {/* Row 1: Fold and Check / Call */}
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {/* Fold */}
              <button
                type="button"
                disabled={!isMyTurn}
                onClick={() => sendAction('fold')}
                className="py-3 rounded-xl bg-[#3B1824] hover:bg-[#4E2130] border border-[#582535] text-white font-serif font-bold text-base sm:text-lg shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t.table.fold}
              </button>

              {/* Check / Call (Dedicated button, not swapped with Raise) */}
              {canCall ? (
                <button
                  type="button"
                  disabled={!isMyTurn}
                  onClick={() => sendAction('call')}
                  className="py-3 rounded-xl bg-[#1B463F] hover:bg-[#255D53] border border-[#2B6A5F] text-emerald-100 font-serif font-bold text-base sm:text-lg shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t.table.call} {actualCallToPay}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!isMyTurn || !canCheck}
                  onClick={() => sendAction('check')}
                  className="py-3 rounded-xl bg-[#231A1E] hover:bg-[#32252B] border border-stone-800 text-stone-200 font-serif font-bold text-base sm:text-lg shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t.table.check}
                </button>
              )}
            </div>

            {/* Row 2: Raise (Dedicated Full-Width Button) */}
            <button
              type="button"
              disabled={!isMyTurn || !canRaise}
              onClick={() => sendAction('raise', raiseAmount)}
              className="w-full py-3 sm:py-3.5 rounded-xl bg-[#1E4D46] hover:bg-[#276259] border border-[#2F7166] text-white font-serif font-bold text-lg sm:text-xl shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t.table.raise} {raiseAmount}
            </button>

            {/* Row 3: All in (Dedicated Full-Width Button) */}
            <button
              type="button"
              disabled={!isMyTurn || (currentPlayer?.chips || 0) <= 0}
              onClick={() => sendAction('all-in')}
              className="w-full py-3 sm:py-3.5 rounded-xl bg-[#C18C39] hover:bg-[#D59C42] border border-[#D9A54E] text-[#1D1307] font-serif font-black text-lg sm:text-xl shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t.table.allIn}
            </button>
          </div>

          {/* Rebuy option if chips are 0 */}
          {currentPlayer?.chips === 0 && roomState.settings.rebuy && (
            <div className="bg-amber-950/80 border border-amber-700/80 p-2.5 rounded-xl flex items-center justify-between text-xs pointer-events-auto">
              <span className="text-amber-200 font-medium">{t.table.rebuyPrompt}</span>
              <button
                onClick={rebuy}
                className="px-3 py-1 bg-[#D5A04D] text-[#1B1108] font-bold text-xs rounded-lg hover:bg-amber-400 shadow"
              >
                {t.table.rebuyBtn}
              </button>
            </div>
          )}
        </div>
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
