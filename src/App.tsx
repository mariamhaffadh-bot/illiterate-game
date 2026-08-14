import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from './store/gameStore';
import { useGameSync } from './hooks/useGameSync';
import { isMuted, toggleMute, ensureAudioReady } from './engine/audioEngine';
import { HomeScreen } from './components/screens/HomeScreen';
import { PlayerSetup } from './components/screens/PlayerSetup';
import { TeamSetup } from './components/screens/TeamSetup';
import { GameSettingsScreen } from './components/screens/GameSettings';
import { TurnIntro } from './components/screens/TurnIntro';
import { PlayingScreen } from './components/screens/PlayingScreen';
import { TurnReview } from './components/screens/TurnReview';
import { PieceMoving } from './components/screens/PieceMoving';
import { GameOver } from './components/screens/GameOver';
import { RedemptionResult } from './components/screens/RedemptionResult';
import { DisplayPage } from './components/screens/DisplayPage';
import { DisplayLinkModal } from './components/screens/DisplayLink';
import { storage } from './utils';

function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = storage.get<boolean | null>('dark_mode', null);
    if (saved !== null) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    storage.set('dark_mode', dark);
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

const GAME_PHASES = new Set([
  'turn_intro', 'playing', 'turn_review', 'piece_moving',
  'game_over', 'redemption_result',
]);

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return hash;
}

function AppRouter() {
  const hash = useHashRoute();

  // Match #/display/GAMEID
  const displayMatch = hash.match(/^#\/display\/([A-Z0-9]+)$/i);
  if (displayMatch) {
    return <DisplayPage gameId={displayMatch[1].toUpperCase()} />;
  }

  return <App />;
}

function App() {
  const phase = useGameStore((s) => s.phase);
  const gameId = useGameStore((s) => s.gameId);
  const goHome = useGameStore((s) => s.goHome);
  const { dark, toggle } = useTheme();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showDisplayLink, setShowDisplayLink] = useState(false);
  const [muted, setMuted] = useState(isMuted);

  // WebSocket sync — pushes public state to display clients
  useGameSync();

  const inGame = GAME_PHASES.has(phase);

  const renderPhase = () => {
    switch (phase) {
      case 'home':
        return <HomeScreen key="home" />;
      case 'player_setup':
        return <PlayerSetup key="player_setup" />;
      case 'team_setup':
        return <TeamSetup key="team_setup" />;
      case 'game_settings':
        return <GameSettingsScreen key="game_settings" />;
      case 'turn_intro':
        return <TurnIntro key="turn_intro" />;
      case 'playing':
        return <PlayingScreen key="playing" />;
      case 'turn_review':
        return <TurnReview key="turn_review" />;
      case 'piece_moving':
        return <PieceMoving key="piece_moving" />;
      case 'redemption_result':
        return <RedemptionResult key="redemption_result" />;
      case 'game_over':
        return <GameOver key="game_over" />;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Top-right controls */}
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Mute toggle */}
        <button
          onClick={() => { ensureAudioReady(); setMuted(toggleMute()); }}
          style={{
            width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: dark ? '#1f2937' : '#f3f4f6', color: dark ? '#d1d5db' : '#4b5563',
            border: dark ? '1px solid #374151' : '1px solid #d1d5db', cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)', fontSize: 16,
          }}
          title={muted ? 'Unmute sounds' : 'Mute sounds'}
        >
          {muted ? '🔇' : '🔊'}
        </button>

        {/* Display Board button */}
        {inGame && gameId && (
          <button
            onClick={() => setShowDisplayLink(true)}
            style={{
              height: 36, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              paddingLeft: 12, paddingRight: 12, gap: 6,
              background: dark ? '#1f2937' : '#f3f4f6', color: dark ? '#d1d5db' : '#4b5563',
              border: dark ? '1px solid #374151' : '1px solid #d1d5db', cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)', fontSize: 12, fontWeight: 600,
            }}
            title="Open board display"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            TV
          </button>
        )}

        {/* Dark/Light toggle */}
        <button
          onClick={toggle}
          style={{
            width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: dark ? '#1f2937' : '#f3f4f6', color: dark ? '#d1d5db' : '#4b5563',
            border: dark ? '1px solid #374151' : '1px solid #d1d5db', cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>

        {/* Leave game button */}
        {inGame && (
          <button
            onClick={() => setShowLeaveConfirm(true)}
            style={{
              width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: dark ? '#1f2937' : '#f3f4f6', color: dark ? '#d1d5db' : '#4b5563',
              border: dark ? '1px solid #374151' : '1px solid #d1d5db', cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
            title="Leave game"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        )}

        {/* How to play */}
        <button
          onClick={() => setShowHelp(true)}
          style={{
            width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: dark ? '#1f2937' : '#f3f4f6', color: dark ? '#d1d5db' : '#4b5563',
            border: dark ? '1px solid #374151' : '1px solid #d1d5db', cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)', fontWeight: 700, fontSize: 16,
          }}
          title="How to play"
        >
          ?
        </button>
      </div>

      {/* Display Link Modal */}
      {gameId && (
        <DisplayLinkModal
          gameId={gameId}
          isOpen={showDisplayLink}
          onClose={() => setShowDisplayLink(false)}
        />
      )}

      {/* Leave confirmation dialog */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-6"
            onClick={() => setShowLeaveConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Leave Game?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your current game progress will be lost.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setShowLeaveConfirm(false); goHome(); }}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium cursor-pointer hover:bg-red-600 transition-colors"
                >
                  Leave
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How to play modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-5 max-h-[85dvh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">How to Play</h2>
                <button
                  onClick={() => setShowHelp(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
                <Section title="Setup">
                  Add 3+ players, split into teams, and pick your game piece. Choose standard categories or create custom ones with any theme you like.
                </Section>

                <Section title="Taking Turns">
                  Each turn, one player is the describer. A card with 6 words is shown — you must describe the word matching your team's current board category without saying the word itself. Your teammates guess.
                </Section>

                <Section title="Scoring">
                  Each correct guess = 1 space forward on the board. When the timer runs out, your team reviews and confirms the score, then your piece moves.
                </Section>

                <Section title="Spade Spaces">
                  Land on a Spade space? Instead of describing, you must act out the word — no talking allowed! Look for the ♠ symbol on the card.
                </Section>

                <Section title="Winning">
                  The first team to reach the finish line triggers a Redemption Round — every other team gets one final turn. If another team also crosses the finish line, it's a draw!
                </Section>

                <Section title="Controls">
                  <span className="font-semibold">Space</span> = Correct &nbsp; <span className="font-semibold">P</span> = Pass &nbsp; <span className="font-semibold">Esc</span> = Pause
                </Section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {renderPhase()}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export default AppRouter;
