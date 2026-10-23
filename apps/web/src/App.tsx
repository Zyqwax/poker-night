import React, { useState } from 'react';
import { useSocket } from './context/SocketContext.js';
import { HomeScreen } from './components/HomeScreen.js';
import { LobbyScreen } from './components/LobbyScreen.js';
import { PokerTable } from './components/PokerTable.js';
import { OfflineBanner } from './components/OfflineBanner.js';
import { PwaPrompt } from './components/PwaPrompt.js';
import { HandRankingsModal } from './components/HandRankingsModal.js';

export const App: React.FC = () => {
  const { roomState } = useSocket();
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <div className="min-h-screen bg-poker-dark text-stone-100 selection:bg-poker-wine selection:text-poker-gold">
      <OfflineBanner />
      <PwaPrompt />

      {!roomState ? (
        <HomeScreen onOpenHelp={() => setIsHelpOpen(true)} />
      ) : roomState.isGameActive && roomState.game ? (
        <PokerTable />
      ) : (
        <LobbyScreen />
      )}

      <HandRankingsModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};
