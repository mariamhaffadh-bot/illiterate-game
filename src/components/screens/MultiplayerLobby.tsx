import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useMultiplayer } from '../../hooks/useMultiplayer';
import { Button } from '../ui/Button';

export function MultiplayerLobby() {
  const multiplayerRole = useGameStore((s) => s.multiplayerRole);
  const setPhase = useGameStore((s) => s.setPhase);
  const setMultiplayerMode = useGameStore((s) => s.setMultiplayerMode);
  const startMultiplayerGame = useGameStore((s) => s.startMultiplayerGame);

  const mp = useMultiplayer();
  const [name, setName] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'name' | 'lobby'>('name');

  const isHost = multiplayerRole === 'host';

  // Pre-fill room code from URL param
  const urlRoom = new URLSearchParams(window.location.search).get('room');

  useEffect(() => {
    if (urlRoom && !isHost) {
      setRoomInput(urlRoom);
    }
  }, [urlRoom, isHost]);

  // When game starts (non-host receives game_started)
  useEffect(() => {
    if (mp.startedData && !isHost) {
      startMultiplayerGame(mp);
    }
  }, [mp.startedData]);

  const handleCreateRoom = () => {
    if (!name.trim()) return;
    mp.createRoom(name.trim());
    setStep('lobby');
  };

  const handleJoinRoom = () => {
    if (!name.trim() || !roomInput.trim()) return;
    mp.joinRoom(roomInput.trim(), name.trim());
    setStep('lobby');
  };

  const handleStartGame = () => {
    if (!isHost || mp.players.length < 2) return;
    // Move to player/team setup on host's device
    // Store the multiplayer connection in the game store
    startMultiplayerGame(mp);
  };

  const handleBack = () => {
    mp.disconnect();
    setMultiplayerMode(null);
    setPhase('mode_select');
  };

  const displayUrl = mp.roomCode
    ? `${window.location.origin}?room=${mp.roomCode}`
    : null;

  const copyLink = () => {
    if (!displayUrl) return;
    navigator.clipboard.writeText(displayUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Name entry step
  if (step === 'name') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6"
      >
        <button onClick={handleBack} className="fixed top-4 left-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer font-game-ui">
          ← Back
        </button>

        <h1 className="text-3xl font-game-title text-gray-900 dark:text-white">
          {isHost ? 'Host a Game' : 'Join a Game'}
        </h1>

        <div className="w-full max-w-xs space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 font-game-ui">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-game-ui text-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') isHost ? handleCreateRoom() : handleJoinRoom();
              }}
            />
          </div>

          {!isHost && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 font-game-ui">Room Code</label>
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4-digit code"
                maxLength={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-game-ui text-lg text-center tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-violet-500"
                inputMode="numeric"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleJoinRoom();
                }}
              />
            </div>
          )}

          <Button
            size="xl"
            onClick={isHost ? handleCreateRoom : handleJoinRoom}
            disabled={!name.trim() || (!isHost && roomInput.length !== 4)}
            className="w-full"
          >
            {isHost ? 'Create Room' : 'Join Room'}
          </Button>

          {mp.status === 'not_found' && (
            <p className="text-red-500 text-sm text-center font-game-ui">Room not found. Check the code and try again.</p>
          )}
          {mp.status === 'kicked' && (
            <p className="text-red-500 text-sm text-center font-game-ui">You were removed from the room.</p>
          )}
        </div>
      </motion.div>
    );
  }

  // Lobby step
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6"
    >
      <button onClick={handleBack} className="fixed top-4 left-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer font-game-ui">
        ← Leave Room
      </button>

      {mp.status === 'connecting' && (
        <div className="text-center space-y-4">
          <div className="text-4xl animate-pulse">🔗</div>
          <p className="text-lg text-gray-500 dark:text-gray-400 font-game-ui">Connecting...</p>
        </div>
      )}

      {mp.status === 'disconnected' && (
        <div className="text-center space-y-4">
          <div className="text-4xl">😵</div>
          <p className="text-lg text-gray-500 dark:text-gray-400 font-game-ui">Connection lost</p>
          <Button onClick={handleBack}>Back to Menu</Button>
        </div>
      )}

      {(mp.status === 'lobby' || mp.status === 'playing') && (
        <>
          <h1 className="text-2xl font-game-title text-gray-900 dark:text-white">
            {isHost ? 'Your Room' : 'Waiting Room'}
          </h1>

          {/* Room code */}
          {mp.roomCode && (
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-400 dark:text-gray-500 font-game-ui uppercase tracking-wide">Room Code</p>
              <div className="text-5xl font-black tracking-[0.3em] text-gray-900 dark:text-white font-game-title">
                {mp.roomCode}
              </div>
              {displayUrl && (
                <div className="flex gap-2 justify-center mt-3">
                  <button
                    onClick={copyLink}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer font-game-ui"
                  >
                    {copied ? 'Copied!' : 'Copy Invite Link'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Player list */}
          <div className="w-full max-w-sm space-y-2">
            <p className="text-sm text-gray-400 dark:text-gray-500 font-game-ui text-center">
              {mp.players.length} player{mp.players.length !== 1 ? 's' : ''} joined
            </p>
            <AnimatePresence>
              {mp.players.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: p.color }}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-gray-900 dark:text-white font-game-ui">{p.name}</span>
                    {p.isHost && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-bold">
                        HOST
                      </span>
                    )}
                  </div>
                  {isHost && !p.isHost && (
                    <button
                      onClick={() => mp.kickPlayer(p.id)}
                      className="text-xs text-red-400 hover:text-red-600 cursor-pointer font-game-ui"
                    >
                      Kick
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Actions */}
          {isHost ? (
            <div className="w-full max-w-xs space-y-3">
              <Button
                size="xl"
                onClick={handleStartGame}
                disabled={mp.players.length < 2}
                className="w-full"
              >
                Start Game ({mp.players.length} players)
              </Button>
              {mp.players.length < 2 && (
                <p className="text-xs text-gray-400 text-center font-game-ui">Waiting for at least 2 players...</p>
              )}
            </div>
          ) : (
            <div className="text-center space-y-2">
              <div className="animate-pulse text-3xl">⏳</div>
              <p className="text-gray-500 dark:text-gray-400 font-game-ui">Waiting for host to start the game...</p>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
