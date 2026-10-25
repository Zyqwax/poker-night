import React, { useEffect, useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { WifiOff, Volume2, VolumeX, LogOut } from 'lucide-react';
import { Card, PlayerPublicState, formatRoomCode } from '@poker-night/shared';
import { detectCurrentBestHand } from '@poker-night/engine';
import { useSocket } from '../context/SocketContext.js';
import { t } from '../i18n/tr.js';
import { CardView } from './CardView.js';
import { SettingsModal } from './SettingsModal.js';
import { HistoryAndStatsModal } from './HistoryAndStatsModal.js';
import { HandRankingsModal } from './HandRankingsModal.js';
import { HoldButton } from './HoldButton.js';
import { soundManager } from '../utils/sound.js';

/**
 * Calculates coordinates on the upper ellipse arc for opponent seats
 * so they neatly border the table felt without colliding with center cards or pot.
 */
function getSeatPosition(idx: number, total: number): { left: string; top: string } {
  if (total === 1) {
    return { left: '50%', top: '16%' };
  }
  if (total === 2) {
    const angles = [0.75 * Math.PI, 0.25 * Math.PI];
    const a = angles[idx];
    return {
      left: `${50 - 39 * Math.cos(a)}%`,
      top: `${50 - 34 * Math.sin(a)}%`,
    };
  }
  if (total === 3) {
    const angles = [0.88 * Math.PI, 0.5 * Math.PI, 0.12 * Math.PI];
    const a = angles[idx];
    return {
      left: `${50 - 41 * Math.cos(a)}%`,
      top: `${50 - 34 * Math.sin(a)}%`,
    };
  }
  // 4 to 9 opponents: evenly spread across upper perimeter arc
  const start = 1.05 * Math.PI;
  const end = -0.05 * Math.PI;
  const a = start - (idx / (total - 1)) * (start - end);
  return {
    left: `${50 + 41 * Math.cos(a)}%`,
    top: `${50 - 34 * Math.sin(a)}%`,
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
    startGame,
    restartGame,
    returnToLobby,
    leaveRoom,
  } = useSocket();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState(() => soundManager.isEnabled());

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

  // Audio effect triggers
  const prevIsMyTurn = useRef(false);
  useEffect(() => {
    if (isMyTurn && !prevIsMyTurn.current) {
      soundManager.playTurnAlert();
    }
    prevIsMyTurn.current = isMyTurn;
  }, [isMyTurn]);

  const prevCommunityCount = useRef(game?.communityCards.length || 0);
  useEffect(() => {
    const currentCount = game?.communityCards.length || 0;
    if (currentCount > prevCommunityCount.current) {
      soundManager.playCard();
    }
    prevCommunityCount.current = currentCount;
  }, [game?.communityCards.length]);

  const prevHoleCardsLength = useRef(myHoleCards.length);
  useEffect(() => {
    if (myHoleCards.length > 0 && prevHoleCardsLength.current === 0) {
      soundManager.playCard();
    }
    prevHoleCardsLength.current = myHoleCards.length;
  }, [myHoleCards.length]);

  const prevWinnerCount = useRef(game?.winners.length || 0);
  useEffect(() => {
    const winCount = game?.winners.length || 0;
    if (winCount > 0 && prevWinnerCount.current === 0) {
      soundManager.playWin();
    }
    prevWinnerCount.current = winCount;
  }, [game?.winners.length]);

  const prevLastAction = useRef(game?.lastAction);
  useEffect(() => {
    if (game?.lastAction && game.lastAction !== prevLastAction.current) {
      if (game.lastAction.playerId !== playerId) {
        if (game.lastAction.action === 'fold') soundManager.playFold();
        else if (game.lastAction.action === 'check') soundManager.playCheck();
        else soundManager.playChips();
      }
    }
    prevLastAction.current = game?.lastAction;
  }, [game?.lastAction, playerId]);

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

  // Orientation lock & portrait detector
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerHeight > window.innerWidth && window.innerWidth < 1024;
    }
    return false;
  });

  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 1024;
      setIsPortrait(portrait);
    };

    try {
      (screen.orientation as any)?.lock?.('landscape').catch(() => {});
    } catch {}

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const handleRequestLandscape = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      await (screen.orientation as any)?.lock?.('landscape');
      setIsFullscreen(true);
    } catch {
      // Browser requires physical rotation
    }
  };

  // Fullscreen toggle with orientation lock
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        (screen.orientation as any)?.lock?.('landscape').catch(() => {});
      } catch {}
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

  const isHandEnded = Boolean(
    game && (game.stage === 'ended' || (game.winners && game.winners.length > 0))
  );
  const isGameOver = Boolean(roomState.isGameOver);

  return (
    <div className="h-screen h-[100dvh] max-h-[100dvh] bg-[#140E10] flex flex-col justify-between p-1.5 sm:p-2 lg:p-4 select-none text-stone-200 overflow-hidden relative">
      {/* Forced Landscape Overlay for Mobile/Tablet in Portrait */}
      {isPortrait && (
        <div className="fixed inset-0 z-50 bg-[#120C0E] flex flex-col items-center justify-center p-6 text-center select-none backdrop-blur-md">
          {/* Animated Rotating Phone Graphic */}
          <motion.div
            animate={{ rotate: [0, -90, -90, 0] }}
            transition={{
              repeat: Infinity,
              duration: 2.5,
              ease: 'easeInOut',
              times: [0, 0.45, 0.8, 1],
            }}
            className="w-14 h-24 sm:w-16 sm:h-28 border-4 border-[#D5A04D] rounded-2xl flex items-center justify-center relative mb-6 shadow-[0_0_30px_rgba(213,160,77,0.25)]"
          >
            <div className="w-2 h-2 rounded-full bg-[#D5A04D]/60 absolute bottom-2" />
            <div className="w-8 h-1 bg-[#D5A04D]/40 rounded absolute top-2" />
            <span className="text-[#D5A04D] text-2xl font-serif select-none">♠</span>
          </motion.div>

          <h2 className="font-serif font-bold text-2xl sm:text-3xl text-[#EDE6DE] mb-2 tracking-tight">
            {t.table.rotateDevice}
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 max-w-xs mb-6 leading-relaxed">
            {t.table.rotateNotice}
          </p>

          <button
            onClick={handleRequestLandscape}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#D5A04D] to-[#B88236] text-[#160E11] font-serif font-bold text-sm sm:text-base shadow-xl hover:brightness-110 active:scale-95 transition-all"
          >
            {t.table.forceLandscapeBtn}
          </button>
        </div>
      )}

      {/* Top Bar: Room Code on Left, Navigation Links on Right */}
      <div className="w-full max-w-[1400px] mx-auto flex items-center justify-between py-1 lg:py-2 px-1 sm:px-3 z-10 shrink-0">
        <div className="font-serif font-bold text-base sm:text-xl lg:text-3xl text-[#EDE6DE] tracking-tight">
          {t.table.room} {formattedRoomCode}
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-[11px] sm:text-xs lg:text-sm font-medium text-stone-300">
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
          <button
            onClick={() => {
              const next = soundManager.toggle();
              setSoundEnabled(next);
            }}
            title={soundEnabled ? t.table.soundOn : t.table.soundOff}
            className="hover:text-[#D5A04D] transition-colors flex items-center gap-1 pl-1"
          >
            {soundEnabled ? (
              <Volume2 size={16} className="text-[#D5A04D]" />
            ) : (
              <VolumeX size={16} className="text-stone-500" />
            )}
          </button>
          <button
            onClick={() => setIsLeaveModalOpen(true)}
            title={t.table.leaveRoom}
            className="hover:text-rose-400 text-rose-300/80 transition-colors flex items-center gap-1 border-l border-stone-700/60 pl-2 ml-0.5"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">{t.table.leaveRoom}</span>
          </button>
        </div>
      </div>

      {/* Main Body: Oval Table on Left/Center, Action Controls on Right */}
      <div className="flex-1 min-h-0 w-full max-w-[1400px] mx-auto flex flex-row items-center justify-between gap-1.5 sm:gap-3 lg:gap-6 px-1 sm:px-2 pb-1 overflow-hidden">
        {/* Table Container */}
        <div className="flex-1 min-w-0 h-full max-h-full flex items-center justify-center relative p-0.5 sm:p-1 overflow-hidden">
          {/* Oval Table Felt */}
          <div className="relative w-full h-full max-w-[760px] max-h-full aspect-[16/10] sm:aspect-[16/9] rounded-[60px] sm:rounded-[120px] lg:rounded-[200px] bg-gradient-to-b from-[#38161F] to-[#260D15] border-[4px] sm:border-[7px] lg:border-[10px] border-[#4A1D27] shadow-[0_0_40px_rgba(0,0,0,0.85)_inset,0_10px_25px_rgba(0,0,0,0.7)] flex flex-col items-center justify-center">
            {/* Inner Table Rim */}
            <div className="absolute inset-[-2px] rounded-[62px] sm:rounded-[122px] lg:rounded-[202px] border border-[#D5A04D]/25 pointer-events-none" />

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
              <div className="absolute top-[18%] sm:top-[21%] flex flex-col items-center text-center pointer-events-auto">
                <span className="text-[9px] sm:text-[10px] lg:text-xs text-[#A69A93] font-medium tracking-widest uppercase">
                  {t.table.pot}
                </span>
                <span className="text-xl sm:text-3xl lg:text-4xl font-serif font-bold text-[#F5EFE6] leading-none mt-0.5 drop-shadow-md">
                  {totalPot.toLocaleString()}
                </span>

                {/* Side Pots if any */}
                {game.sidePots.length > 1 && (
                  <div className="text-[9px] sm:text-[10px] text-amber-300/80 mt-0.5">
                    Side Pot: {game.sidePots.slice(1).map((sp) => sp.amount).join(' / ')}
                  </div>
                )}

                {/* Showdown Winner Announcement */}
                {game.winners.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="mt-1 px-2.5 py-0.5 bg-amber-500/20 border border-amber-400/60 rounded-full text-[10px] sm:text-xs font-bold text-amber-200 shadow-lg"
                  >
                    🏆 {game.winners.map((w) => `${w.nick} (${w.amount} chip)`).join(', ')}
                  </motion.div>
                )}
              </div>

              {/* Community Cards: 5 Card Slots */}
              <div className="absolute top-[44%] sm:top-[46%] -translate-y-1/2 flex items-center gap-1 sm:gap-1.5 pointer-events-auto">
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
              <div className="absolute top-[67%] sm:top-[69%] -translate-y-1/2 flex items-center gap-1 sm:gap-1.5 pointer-events-auto">
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
                  className={`px-3 py-1 sm:px-5 sm:py-1.5 rounded-lg sm:rounded-xl border-2 bg-[#170E12]/95 shadow-xl flex items-center gap-2 sm:gap-3 transition-all ${
                    isMyTurn
                      ? 'border-[#D5A04D] ring-2 ring-[#D5A04D]/40 shadow-[#D5A04D]/25'
                      : 'border-[#4A2430]'
                  }`}
                >
                  <span className="font-bold text-stone-100 text-xs sm:text-sm">
                    {currentPlayer?.nick}
                  </span>
                  <span className="font-serif font-bold text-[#D5A04D] text-xs sm:text-base">
                    {currentPlayer?.chips.toLocaleString()}
                  </span>
                </div>

                {/* Turn Status Indicator */}
                <div className="mt-0.5 text-center">
                  {isMyTurn ? (
                    <span className="text-[#D5A04D] font-serif font-bold text-[10px] sm:text-xs drop-shadow">
                      {t.table.yourTurn} · {timeLeft} sn
                    </span>
                  ) : game.currentTurnSeat !== null ? (
                    <span className="text-stone-400 text-[10px] sm:text-xs">
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
                  <span className="text-[10px] sm:text-[11px] text-amber-200/90 font-medium drop-shadow mt-0.5">
                    {currentHandInfo.textTr}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls Panel on Right (Docked side-by-side without layout shifts) */}
        <div
          className={`w-[190px] sm:w-[230px] md:w-[270px] lg:w-[310px] shrink-0 h-full max-h-full flex flex-col justify-center space-y-1 sm:space-y-1.5 lg:space-y-2.5 transition-opacity overflow-y-auto no-scrollbar ${
            isMyTurn ? 'opacity-100' : 'opacity-40 pointer-events-none'
          }`}
        >
          {/* Raise Header & Slider */}
          <div className="bg-[#1C1216]/85 border border-[#3D1E27] rounded-xl sm:rounded-2xl p-2 sm:p-2.5 lg:p-3.5 space-y-1 sm:space-y-1.5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-stone-300 font-serif text-xs sm:text-sm font-medium">
                {t.table.raise}
              </span>
              <span className="text-base sm:text-xl lg:text-2xl font-serif font-black text-white font-mono">
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
              className="w-full accent-[#D5A04D] cursor-pointer h-1.5 sm:h-2 bg-[#2D161E] rounded-lg"
            />

            {/* Quick Preset Buttons: Min | 1/2 pot | Pot */}
            <div className="grid grid-cols-3 gap-1 sm:gap-1.5 pt-0.5 text-[10px] sm:text-xs font-serif font-bold">
              <button
                type="button"
                disabled={!isMyTurn || !canRaise}
                onClick={() => setRaiseAmount(minRaise)}
                className="py-1 rounded-lg bg-[#27151D] hover:bg-[#381E29] border border-[#4A2533] text-stone-200 transition-colors shadow disabled:opacity-40"
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
                className="py-1 rounded-lg bg-[#27151D] hover:bg-[#381E29] border border-[#4A2533] text-stone-200 transition-colors shadow disabled:opacity-40"
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
                className="py-1 rounded-lg bg-[#27151D] hover:bg-[#381E29] border border-[#4A2533] text-stone-200 transition-colors shadow disabled:opacity-40"
              >
                {t.table.fullPot}
              </button>
            </div>
          </div>

          {/* Action Buttons Grid with 500ms Hold to Act */}
          <div className="flex flex-col gap-1 sm:gap-1.5">
            {/* Hold Hint */}
            <div className="text-[9px] sm:text-[10px] text-stone-400 text-center flex items-center justify-center gap-1 opacity-80">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D5A04D] animate-pulse" />
              <span>{t.table.holdToActHint}</span>
            </div>

            {/* Row 1: Fold and Check / Call */}
            <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
              {/* Fold */}
              <HoldButton
                disabled={!isMyTurn}
                onTrigger={() => sendAction('fold')}
                soundType="fold"
                progressColor="bg-rose-500/30"
                className="py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-[#3B1824] hover:bg-[#4E2130] border border-[#582535] text-white font-serif font-bold text-xs sm:text-base shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t.table.fold}
              </HoldButton>

              {/* Check / Call (Dedicated button, not swapped with Raise) */}
              {canCall ? (
                <HoldButton
                  disabled={!isMyTurn}
                  onTrigger={() => sendAction('call')}
                  soundType="call"
                  progressColor="bg-emerald-400/30"
                  className="py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-[#1B463F] hover:bg-[#255D53] border border-[#2B6A5F] text-emerald-100 font-serif font-bold text-xs sm:text-base shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t.table.call} {actualCallToPay}
                </HoldButton>
              ) : (
                <HoldButton
                  disabled={!isMyTurn || !canCheck}
                  onTrigger={() => sendAction('check')}
                  soundType="check"
                  progressColor="bg-stone-400/30"
                  className="py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-[#231A1E] hover:bg-[#32252B] border border-stone-800 text-stone-200 font-serif font-bold text-xs sm:text-base shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t.table.check}
                </HoldButton>
              )}
            </div>

            {/* Row 2: Raise (Dedicated Full-Width Button) */}
            <HoldButton
              disabled={!isMyTurn || !canRaise}
              onTrigger={() => sendAction('raise', raiseAmount)}
              soundType="raise"
              progressColor="bg-teal-400/30"
              className="w-full py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-[#1E4D46] hover:bg-[#276259] border border-[#2F7166] text-white font-serif font-bold text-xs sm:text-base shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t.table.raise} {raiseAmount}
            </HoldButton>

            {/* Row 3: All in (Dedicated Full-Width Button) */}
            <HoldButton
              disabled={!isMyTurn || (currentPlayer?.chips || 0) <= 0}
              onTrigger={() => sendAction('all-in')}
              soundType="all-in"
              progressColor="bg-amber-300/40"
              className="w-full py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl bg-[#C18C39] hover:bg-[#D59C42] border border-[#D9A54E] text-[#1D1307] font-serif font-black text-xs sm:text-base shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t.table.allIn}
            </HoldButton>
          </div>

          {/* Rebuy option if chips are 0 */}
          {currentPlayer?.chips === 0 && roomState.settings.rebuy && (
            <div className="bg-amber-950/80 border border-amber-700/80 p-1.5 sm:p-2 rounded-xl flex items-center justify-between text-[10px] sm:text-xs pointer-events-auto">
              <span className="text-amber-200 font-medium">{t.table.rebuyPrompt}</span>
              <button
                onClick={rebuy}
                className="px-2.5 py-1 bg-[#D5A04D] text-[#1B1108] font-bold text-[10px] sm:text-xs rounded-lg hover:bg-amber-400 shadow"
              >
                {t.table.rebuyBtn}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Game Over / Tournament Winner Modal */}
      {isGameOver && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md bg-[#1C1116] border-2 border-[#D5A04D] rounded-2xl p-6 text-center shadow-2xl space-y-4"
          >
            <div className="text-4xl mb-1">🏆</div>
            <h2 className="text-2xl sm:text-3xl font-serif font-black text-amber-200">
              {t.table.gameOverTitle}
            </h2>
            <p className="text-sm text-stone-300">
              <span className="font-bold text-[#D5A04D] text-base">
                {roomState.gameWinner?.nick || 'Şampiyon'}
              </span>{' '}
              {t.table.allChipsWon}
            </p>

            {/* Standings table */}
            <div className="bg-[#120B0E] border border-stone-800 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2 text-xs">
              {roomState.players
                .slice()
                .sort((a, b) => b.chips - a.chips)
                .map((p, rank) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-1.5 px-3 rounded bg-[#1B1115] border border-stone-800/60"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-stone-500 font-mono font-bold">#{rank + 1}</span>
                      <span
                        className={`font-semibold ${
                          p.id === roomState.gameWinner?.playerId
                            ? 'text-[#D5A04D]'
                            : 'text-stone-200'
                        }`}
                      >
                        {p.nick}
                      </span>
                    </div>
                    <span className="font-serif font-bold text-amber-100">
                      {p.chips > 0 ? `${p.chips.toLocaleString()} chip` : 'Elendi (0 chip)'}
                    </span>
                  </div>
                ))}
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex flex-col gap-2">
              {isHost ? (
                <>
                  <button
                    onClick={restartGame}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D5A04D] to-[#BA8538] text-[#160E11] font-serif font-black text-base shadow-xl hover:brightness-110 active:scale-95 transition-all"
                  >
                    {t.table.restartGameBtn}
                  </button>
                  <button
                    onClick={returnToLobby}
                    className="w-full py-2.5 rounded-xl bg-[#2D161F] hover:bg-[#3D1E2B] border border-[#542839] text-stone-200 font-serif font-bold text-sm transition-all"
                  >
                    {t.table.returnToLobbyBtn}
                  </button>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-stone-400 italic">
                    {t.table.waitingHostRestart}
                  </p>
                  <button
                    onClick={leaveRoom}
                    className="w-full py-2 rounded-xl bg-[#27151D] border border-stone-800 text-stone-300 text-xs hover:bg-stone-800 transition-colors"
                  >
                    Odadan Ayrıl
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Hand Ended (Showdown / Winner) Modal */}
      {isHandEnded && !isGameOver && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-sm sm:max-w-md bg-[#1D1116] border border-[#D5A04D]/60 rounded-2xl p-5 sm:p-6 text-center shadow-2xl space-y-3.5"
          >
            <div className="inline-block px-3 py-1 rounded-full bg-[#D5A04D]/15 border border-[#D5A04D]/40 text-xs font-serif font-bold text-[#D5A04D]">
              {t.table.handEndedTitle}
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-serif font-black text-white">
                {game.winners.map((w) => w.nick).join(', ')} {t.table.wins}
              </h2>
              <p className="text-lg sm:text-xl font-serif font-bold text-amber-200 font-mono">
                +{game.winners.reduce((sum, w) => sum + w.amount, 0).toLocaleString()} chip
              </p>
              {game.winners[0]?.handRankName && (
                <p className="text-xs sm:text-sm text-stone-300 font-medium">
                  {game.winners[0].handRankName}
                </p>
              )}
            </div>

            {/* Revealed Cards at Showdown */}
            {showdownData && Object.keys(showdownData.cardsByPlayer).length > 0 && (
              <div className="bg-[#120B0E] border border-stone-800/80 rounded-xl p-2.5 max-h-40 overflow-y-auto space-y-2">
                {Object.entries(showdownData.cardsByPlayer).map(([pId, cards]) => {
                  const pNick = roomState.players.find((pl) => pl.id === pId)?.nick || 'Oyuncu';
                  const isWinner = game.winners.some((w) => w.playerId === pId);
                  return (
                    <div
                      key={pId}
                      className="flex items-center justify-between py-1 px-2 rounded bg-[#1A1015]"
                    >
                      <span
                        className={`text-xs font-semibold ${
                          isWinner ? 'text-[#D5A04D]' : 'text-stone-300'
                        }`}
                      >
                        {pNick} {isWinner && '👑'}
                      </span>
                      <div className="flex items-center gap-1 scale-90 origin-right">
                        {cards.map((c, i) => (
                          <CardView key={i} card={c} size="sm" />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Next Hand Button for Host */}
            <div className="pt-2">
              {isHost ? (
                <button
                  onClick={startGame}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D5A04D] to-[#BA8538] text-[#160E11] font-serif font-black text-base shadow-xl hover:brightness-110 active:scale-95 transition-all"
                >
                  {t.table.nextHandBtn}
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-stone-400 italic">
                    {t.table.waitingHostNextHand}
                  </p>
                  {currentPlayer?.chips === 0 && roomState.settings.rebuy && (
                    <button
                      onClick={rebuy}
                      className="px-4 py-1.5 bg-[#D5A04D] text-[#160E11] font-bold text-xs rounded-lg hover:bg-amber-400 shadow"
                    >
                      {t.table.rebuyBtn}
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Leave Room Confirmation Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-[#1C1116] border border-stone-800 rounded-2xl p-5 text-center shadow-2xl space-y-4"
          >
            <div className="text-3xl">🚪</div>
            <h3 className="text-lg font-serif font-bold text-stone-100">
              {t.table.leaveConfirmTitle}
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              {t.table.leaveConfirmDesc}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setIsLeaveModalOpen(false)}
                className="py-2.5 rounded-xl bg-[#2B1B22] hover:bg-[#3D2530] text-stone-300 font-serif font-semibold text-xs transition-colors"
              >
                {t.table.cancelBtn}
              </button>
              <button
                onClick={() => {
                  setIsLeaveModalOpen(false);
                  leaveRoom();
                }}
                className="py-2.5 rounded-xl bg-rose-900/90 hover:bg-rose-800 text-white font-serif font-bold text-xs transition-colors shadow-lg"
              >
                {t.table.leaveConfirmBtn}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Single Player Remaining Warning Modal */}
      {(otherPlayers.length === 0 || roomState.players.length <= 1) && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-[#1C1116] border-2 border-amber-500/80 rounded-2xl p-6 text-center shadow-2xl space-y-4"
          >
            <div className="text-4xl animate-bounce">⚠️</div>
            <h3 className="text-xl font-serif font-bold text-amber-200">
              {t.table.singlePlayerTitle}
            </h3>
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
              {t.table.singlePlayerDesc}
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={returnToLobby}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D5A04D] to-[#BA8538] text-[#160E11] font-serif font-black text-sm sm:text-base shadow-xl hover:brightness-110 active:scale-95 transition-all"
              >
                {t.table.returnToLobbyBtn}
              </button>
              <button
                onClick={leaveRoom}
                className="w-full py-2 rounded-xl bg-[#27151D] border border-stone-800 text-stone-400 hover:text-white text-xs transition-colors"
              >
                {t.table.leaveRoom}
              </button>
            </div>
          </motion.div>
        </div>
      )}

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
