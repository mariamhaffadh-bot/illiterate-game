import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useMPStore, mpCreateRoom, mpJoinRoom, mpAutoAssign, mpAssignTeams, mpStartGame, mpKick, mpDisconnect } from '../../store/multiplayerStore';
import { Button } from '../ui/Button';
import { allCards } from '../../data/cards';
import { BASE_CATEGORIES } from '../../types';

export function MultiplayerLobby() {
  const multiplayerRole = useGameStore((s) => s.multiplayerRole);
  const setPhase = useGameStore((s) => s.setPhase);
  const setMultiplayerMode = useGameStore((s) => s.setMultiplayerMode);

  const status = useMPStore((s) => s.status);
  const errorMsg = useMPStore((s) => s.errorMsg);
  const roomCode = useMPStore((s) => s.roomCode);
  const myId = useMPStore((s) => s.playerId);
  const players = useMPStore((s) => s.players);
  const isHost = useMPStore((s) => s.isHost);
  const teams = useMPStore((s) => s.teams);
  const gameState = useMPStore((s) => s.gameState);

  const [name, setName] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [timerSetting, setTimerSetting] = useState(30);
  const [numTeams, setNumTeams] = useState(2);
  const [showTeamSetup, setShowTeamSetup] = useState(false);

  const isHostMode = multiplayerRole === 'host';

  // Pre-fill room code from URL
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('room');
    if (r && !isHostMode) setRoomInput(r);
  }, [isHostMode]);

  // Transition to game
  useEffect(() => {
    if (status === 'playing' && gameState) setPhase('multiplayer_playing' as any);
  }, [status, gameState, setPhase]);

  const handleBack = () => { mpDisconnect(); setMultiplayerMode(null); setPhase('mode_select'); };

  const handleCreateRoom = () => {
    if (!name.trim()) return;
    const wordPools: Record<string, string[]> = {};
    const categories: string[] = [];
    for (const cat of BASE_CATEGORIES) {
      const key = cat.toLowerCase() as 'action' | 'object' | 'nature' | 'random' | 'person' | 'world';
      wordPools[cat] = allCards.map(c => c[key]).filter(Boolean);
      categories.push(cat);
    }
    mpCreateRoom(name.trim(), categories, timerSetting, numTeams, wordPools);
  };

  const handleJoinRoom = () => {
    if (!name.trim() || roomInput.length !== 4) return;
    mpJoinRoom(roomInput.trim(), name.trim());
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}?room=${roomCode}`).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const allAssigned = teams.length >= 2 && teams.every(t => t.playerIds.length > 0)
    && players.every(p => teams.some(t => t.playerIds.includes(p.id)));

  // ── Entry form ────────────────────────────────────────────────
  if (status === 'idle' || status === 'connecting' || status === 'error') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6">
        <button onClick={handleBack} className="fixed top-4 left-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer font-game-ui">← Back</button>
        <h1 className="text-3xl font-game-title text-gray-900 dark:text-white">{isHostMode ? 'Host a Game' : 'Join a Game'}</h1>
        <div className="w-full max-w-xs space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 font-game-ui">Your Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" maxLength={20} autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-game-ui text-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              onKeyDown={(e) => { if (e.key === 'Enter') isHostMode ? handleCreateRoom() : handleJoinRoom(); }} />
          </div>
          {!isHostMode && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 font-game-ui">Room Code</label>
              <input type="text" value={roomInput} onChange={(e) => setRoomInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4-digit code" maxLength={4} inputMode="numeric"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-game-ui text-3xl text-center tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-violet-500"
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoinRoom(); }} />
            </div>
          )}
          {isHostMode && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 font-game-ui">Turn Timer</label>
                <select value={timerSetting} onChange={(e) => setTimerSetting(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-game-ui focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value={30}>30 seconds</option><option value={45}>45 seconds</option>
                  <option value={60}>60 seconds</option><option value={90}>90 seconds</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 font-game-ui">Number of Teams</label>
                <div className="flex gap-2">
                  {[2, 3, 4].map(n => (
                    <button key={n} onClick={() => setNumTeams(n)}
                      className={`flex-1 py-2 rounded-xl font-bold font-game-ui text-sm cursor-pointer transition-all ${numTeams === n ? 'bg-violet-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>{n} Teams</button>
                  ))}
                </div>
              </div>
            </>
          )}
          <Button size="xl" disabled={!name.trim() || (!isHostMode && roomInput.length !== 4) || status === 'connecting'} className="w-full"
            onClick={() => isHostMode ? handleCreateRoom() : handleJoinRoom()}>
            {status === 'connecting' ? 'Connecting...' : isHostMode ? 'Create Room' : 'Join'}
          </Button>
          {errorMsg && <p className="text-red-500 text-sm text-center font-game-ui">{errorMsg}</p>}
        </div>
      </motion.div>
    );
  }

  // ── Disconnected ──────────────────────────────────────────────
  if (status === 'disconnected') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-5xl">😵</div>
        <p className="text-lg text-gray-500 font-game-ui">{errorMsg || 'Connection lost'}</p>
        <Button onClick={handleBack}>Back to Menu</Button>
      </motion.div>
    );
  }

  // ── Player waiting screen ─────────────────────────────────────
  if (!isHost) {
    const myTeam = teams.find(t => t.playerIds.includes(myId || ''));
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6">
        <button onClick={handleBack} className="fixed top-4 left-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer font-game-ui">← Leave</button>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-game-title text-gray-900 dark:text-white">You're in! 🎉</h1>
          <p className="text-gray-500 dark:text-gray-400 font-game-ui">Room: <span className="font-bold text-gray-900 dark:text-white text-xl tracking-widest">{roomCode}</span></p>
        </div>
        {myTeam && (
          <div className="px-4 py-2 rounded-xl text-sm font-bold text-white font-game-ui" style={{ backgroundColor: myTeam.color }}>{myTeam.name}</div>
        )}
        <div className="w-full max-w-xs space-y-2">
          <p className="text-sm text-gray-400 font-game-ui text-center font-bold">Players in room:</p>
          {players.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="font-game-ui text-gray-900 dark:text-white font-medium">
                {p.name}{p.id === myId ? ' (You)' : ''}{p.isHost ? ' (Host)' : ''}
              </span>
            </div>
          ))}
        </div>
        <div className="text-center space-y-2 mt-4">
          <div className="animate-pulse text-3xl">⏳</div>
          <p className="text-gray-500 dark:text-gray-400 font-game-ui">{teams.length > 0 ? 'Waiting for host to start...' : 'Waiting for host to set up teams...'}</p>
        </div>
      </motion.div>
    );
  }

  // ── Host: Team setup overlay ──────────────────────────────────
  if (showTeamSetup) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6">
        <button onClick={() => setShowTeamSetup(false)} className="fixed top-4 left-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer font-game-ui">← Back to Lobby</button>
        <h2 className="text-2xl font-game-title text-gray-900 dark:text-white">Assign Teams</h2>
        <Button variant="secondary" size="md" onClick={() => mpAutoAssign()}>Auto-Assign</Button>

        {teams.length > 0 && (
          <div className="grid grid-cols-2 gap-3 w-full max-w-md">
            {teams.map(team => {
              const tp = players.filter(p => team.playerIds.includes(p.id));
              return (
                <div key={team.id} className="rounded-xl p-4 border-2" style={{ borderColor: team.color, background: team.color + '10' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: team.color }} />
                    <span className="font-bold text-gray-900 dark:text-white font-game-ui text-sm">{team.name}</span>
                  </div>
                  {tp.length > 0 ? tp.map(p => <p key={p.id} className="text-sm text-gray-600 dark:text-gray-300 font-game-ui">{p.name}</p>)
                    : <p className="text-xs text-gray-400 italic font-game-ui">Empty</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* Unassigned players */}
        {teams.length > 0 && (() => {
          const unassigned = players.filter(p => !teams.some(t => t.playerIds.includes(p.id)));
          if (!unassigned.length) return null;
          return (
            <div className="w-full max-w-md space-y-2">
              <p className="text-xs text-amber-500 font-game-ui text-center">Assign these players:</p>
              {unassigned.map(p => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="flex-1 font-game-ui text-sm text-gray-900 dark:text-white">{p.name}</span>
                  <select onChange={(e) => {
                    const idx = Number(e.target.value);
                    const updated = teams.map((t, i) => ({
                      name: t.name, color: t.color,
                      playerIds: i === idx ? [...t.playerIds.filter(id => id !== p.id), p.id] : t.playerIds.filter(id => id !== p.id),
                    }));
                    mpAssignTeams(updated);
                  }} defaultValue=""
                    className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-game-ui">
                    <option value="" disabled>Pick team</option>
                    {teams.map((t, i) => <option key={t.id} value={i}>{t.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          );
        })()}

        <Button size="xl" onClick={() => mpStartGame()} disabled={!allAssigned} className="w-full max-w-xs">
          Start Game ▶
        </Button>
        {!allAssigned && teams.length > 0 && <p className="text-xs text-gray-400 text-center font-game-ui">Assign all players to start</p>}
      </motion.div>
    );
  }

  // ── Host lobby ────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6">
      <button onClick={handleBack} className="fixed top-4 left-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer font-game-ui z-10">← Leave</button>

      {/* Room code */}
      <div className="text-center space-y-2">
        <p className="text-xs text-gray-400 uppercase tracking-widest font-bold font-game-ui">Room Code</p>
        <div className="text-6xl sm:text-7xl font-black tracking-[0.4em] text-gray-900 dark:text-white font-game-title">{roomCode}</div>
        <button onClick={copyLink}
          className="px-5 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer font-game-ui">
          {copied ? 'Copied!' : 'Copy Join Link'}
        </button>
      </div>

      {/* Player list */}
      <div className="w-full max-w-xs space-y-2">
        <p className="text-sm text-gray-400 font-game-ui text-center font-bold">Players waiting ({players.length})</p>
        <AnimatePresence>
          {players.map(p => (
            <motion.div key={p.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="flex-1 font-semibold text-gray-900 dark:text-white font-game-ui">
                {p.name}{p.id === myId ? ' (You - Host)' : ''}
              </span>
              {!p.isHost && <button onClick={() => mpKick(p.id)} className="text-xs text-red-400 hover:text-red-600 cursor-pointer">Kick</button>}
            </motion.div>
          ))}
        </AnimatePresence>
        {players.length < 2 && <p className="text-xs text-amber-500 text-center font-game-ui animate-pulse">🟡 Waiting for players...</p>}
      </div>

      {/* Assign Teams & Start */}
      <Button size="xl" onClick={() => setShowTeamSetup(true)} disabled={players.length < 2} className="w-full max-w-xs">
        Assign Teams & Start
      </Button>
      {players.length < 2 && <p className="text-xs text-gray-400 text-center font-game-ui">Need at least 2 players</p>}
    </motion.div>
  );
}
