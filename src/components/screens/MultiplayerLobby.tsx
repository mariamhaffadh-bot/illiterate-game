import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useMultiplayerStore, createRoom, joinRoom, kickPlayer, startGame, disconnectMultiplayer } from '../../store/multiplayerStore';
import { Button } from '../ui/Button';
import { allCards } from '../../data/cards';
import { BASE_CATEGORIES } from '../../types';

export function MultiplayerLobby() {
  const multiplayerRole = useGameStore((s) => s.multiplayerRole);
  const setPhase = useGameStore((s) => s.setPhase);
  const setMultiplayerMode = useGameStore((s) => s.setMultiplayerMode);

  const status = useMultiplayerStore((s) => s.status);
  const roomCode = useMultiplayerStore((s) => s.roomCode);
  const playerId = useMultiplayerStore((s) => s.playerId);
  const players = useMultiplayerStore((s) => s.players);
  const isHost = useMultiplayerStore((s) => s.isHost);
  const gameState = useMultiplayerStore((s) => s.gameState);

  const [name, setName] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [timerSetting, setTimerSetting] = useState(30);

  const isHostMode = multiplayerRole === 'host';

  // Pre-fill room code from URL param
  useEffect(() => {
    const urlRoom = new URLSearchParams(window.location.search).get('room');
    if (urlRoom && !isHostMode) setRoomInput(urlRoom);
  }, [isHostMode]);

  // When game starts, transition to game screen
  useEffect(() => {
    if (status === 'playing' && gameState) {
      setPhase('multiplayer_playing' as any);
    }
  }, [status, gameState, setPhase]);

  const handleCreateRoom = () => {
    if (!name.trim()) return;
    createRoom(name.trim());
  };

  const handleJoinRoom = () => {
    if (!name.trim() || roomInput.length !== 4) return;
    joinRoom(roomInput.trim(), name.trim());
  };

  const handleStartGame = () => {
    if (players.length < 2) return;
    // Build word pools from the built-in card data
    const wordPools: Record<string, string[]> = {};
    const categories: string[] = [];
    for (const cat of BASE_CATEGORIES) {
      const key = cat.toLowerCase() as 'action' | 'object' | 'nature' | 'random' | 'person' | 'world';
      const words = allCards.map(c => c[key]).filter(Boolean);
      wordPools[cat] = words;
      categories.push(cat);
    }
    startGame(wordPools, categories, timerSetting);
  };

  const handleBack = () => {
    disconnectMultiplayer();
    setMultiplayerMode(null);
    setPhase('mode_select');
  };

  const displayUrl = roomCode ? `${window.location.origin}?room=${roomCode}` : null;

  const copyLink = () => {
    if (!displayUrl) return;
    navigator.clipboard.writeText(displayUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Name + code entry (before room is created/joined) ──────
  if (status === 'idle' || status === 'connecting' || status === 'not_found' || status === 'kicked') {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6"
      >
        <button onClick={handleBack} className="fixed top-4 left-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer font-game-ui">
          ← Back
        </button>

        <h1 className="text-3xl font-game-title text-gray-900 dark:text-white">
          {isHostMode ? 'Host a Game' : 'Join a Game'}
        </h1>

        <div className="w-full max-w-xs space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 font-game-ui">Your Name</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name" maxLength={20} autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-game-ui text-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              onKeyDown={(e) => { if (e.key === 'Enter') isHostMode ? handleCreateRoom() : handleJoinRoom(); }}
            />
          </div>

          {!isHostMode && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 font-game-ui">Room Code</label>
              <input
                type="text" value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4-digit code" maxLength={4} inputMode="numeric"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-game-ui text-3xl text-center tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-violet-500"
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoinRoom(); }}
              />
            </div>
          )}

          {isHostMode && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 font-game-ui">Turn Timer</label>
              <select
                value={timerSetting} onChange={(e) => setTimerSetting(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-game-ui text-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value={30}>30 seconds</option>
                <option value={45}>45 seconds</option>
                <option value={60}>60 seconds</option>
                <option value={90}>90 seconds</option>
              </select>
            </div>
          )}

          <Button
            size="xl"
            onClick={isHostMode ? handleCreateRoom : handleJoinRoom}
            disabled={!name.trim() || (!isHostMode && roomInput.length !== 4) || status === 'connecting'}
            className="w-full"
          >
            {status === 'connecting' ? 'Connecting...' : isHostMode ? 'Create Room' : 'Join Game'}
          </Button>

          {status === 'not_found' && (
            <p className="text-red-500 text-sm text-center font-game-ui">Room not found. Check the code and try again.</p>
          )}
          {status === 'kicked' && (
            <p className="text-red-500 text-sm text-center font-game-ui">You were removed from the room.</p>
          )}
        </div>
      </motion.div>
    );
  }

  // ── Disconnected state ─────────────────────────────────────
  if (status === 'disconnected') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-5xl">😵</div>
        <p className="text-lg text-gray-500 dark:text-gray-400 font-game-ui">Connection lost</p>
        <Button onClick={handleBack}>Back to Menu</Button>
      </motion.div>
    );
  }

  // ── Lobby (room created/joined) ────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6"
    >
      <button onClick={handleBack} className="fixed top-4 left-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer font-game-ui">
        ← Leave Room
      </button>

      {/* Room code — large and prominent */}
      {roomCode && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-2"
        >
          <p className="text-sm text-gray-400 dark:text-gray-500 font-game-ui uppercase tracking-widest font-bold">Room Code</p>
          <div className="text-6xl sm:text-7xl font-black tracking-[0.4em] text-gray-900 dark:text-white font-game-title">
            {roomCode}
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500 font-game-ui">Share this with your players</p>
          {displayUrl && (
            <button
              onClick={copyLink}
              className="mt-2 px-5 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer font-game-ui"
            >
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </button>
          )}
        </motion.div>
      )}

      {/* Player list */}
      <div className="w-full max-w-sm space-y-2 mt-4">
        <p className="text-sm text-gray-400 dark:text-gray-500 font-game-ui text-center font-bold">
          Players ({players.length})
        </p>
        <AnimatePresence>
          {players.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="flex-1 font-semibold text-gray-900 dark:text-white font-game-ui">
                {p.name}
                {p.id === playerId && <span className="text-gray-400 font-normal"> (You)</span>}
              </span>
              {p.isHost && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-bold">
                  HOST
                </span>
              )}
              {isHost && !p.isHost && (
                <button onClick={() => kickPlayer(p.id)} className="text-xs text-red-400 hover:text-red-600 cursor-pointer font-game-ui">
                  Kick
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Host: Start Game / Player: Waiting */}
      {isHost ? (
        <div className="w-full max-w-xs space-y-3 mt-4">
          <Button
            size="xl" onClick={handleStartGame} disabled={players.length < 2} className="w-full"
          >
            Start Game
          </Button>
          {players.length < 2 && (
            <p className="text-xs text-gray-400 text-center font-game-ui">Need at least 2 players to start</p>
          )}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-center space-y-2 mt-4"
        >
          <div className="animate-pulse text-3xl">⏳</div>
          <p className="text-gray-500 dark:text-gray-400 font-game-ui">Waiting for host to start the game...</p>
        </motion.div>
      )}
    </motion.div>
  );
}
