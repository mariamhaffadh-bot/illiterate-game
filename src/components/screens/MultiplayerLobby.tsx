import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useMPStore, mpCreateRoom, mpJoinRoom, mpAutoAssign, mpAssignTeams, mpStartGame, mpKick, mpDisconnect } from '../../store/multiplayerStore';
import { Button } from '../ui/Button';
import { allCards } from '../../data/cards';
import { BASE_CATEGORIES } from '../../types';

export function MultiplayerLobby() {
  const role = useGameStore((s) => s.multiplayerRole);
  const setPhase = useGameStore((s) => s.setPhase);
  const setMPMode = useGameStore((s) => s.setMultiplayerMode);

  const status = useMPStore((s) => s.status);
  const error = useMPStore((s) => s.errorMsg);
  const roomCode = useMPStore((s) => s.roomCode);
  const myId = useMPStore((s) => s.playerId);
  const players = useMPStore((s) => s.players);
  const isHost = useMPStore((s) => s.isHost);
  const teams = useMPStore((s) => s.teams);
  const gs = useMPStore((s) => s.gameState);

  // Local form state
  const [name, setName] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [timer, setTimer] = useState(30);
  const [numTeams, setNumTeams] = useState(2);
  const [copied, setCopied] = useState(false);
  const [showTeams, setShowTeams] = useState(false);

  const isHostFlow = role === 'host';

  // Pre-fill code from URL
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('room');
    if (r && !isHostFlow) setCodeInput(r);
  }, [isHostFlow]);

  // Transition to game
  useEffect(() => {
    if (status === 'playing' && gs) setPhase('multiplayer_playing' as any);
  }, [status, gs, setPhase]);

  const goBack = () => { mpDisconnect(); setMPMode(null); setPhase('mode_select'); };
  const copy = () => { navigator.clipboard.writeText(`${window.location.origin}?room=${roomCode}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  const createRoom = () => {
    if (!name.trim()) return;
    const pools: Record<string, string[]> = {};
    const cats: string[] = [];
    for (const c of BASE_CATEGORIES) {
      const k = c.toLowerCase() as 'action' | 'object' | 'nature' | 'random' | 'person' | 'world';
      pools[c] = allCards.map(card => card[k]).filter(Boolean);
      cats.push(c);
    }
    mpCreateRoom(name.trim(), cats, timer, numTeams, pools);
  };

  const joinRoom = () => {
    if (!name.trim() || codeInput.length !== 4) return;
    mpJoinRoom(codeInput.trim(), name.trim());
  };

  const startGame = () => {
    const allAssigned = teams.length >= 2 && teams.every(t => t.playerIds.length > 0)
      && players.every(p => teams.some(t => t.playerIds.includes(p.id)));
    if (!allAssigned) return;
    mpStartGame();
  };

  // ════════════════════════════════════════════════════════════
  // ERROR / DISCONNECTED
  // ════════════════════════════════════════════════════════════
  if (status === 'disconnected') {
    return (
      <Screen><div className="text-5xl">😵</div>
        <p className="text-lg text-gray-500 font-game-ui">{error || 'Connection lost'}</p>
        <Button onClick={goBack}>Back to Menu</Button>
      </Screen>
    );
  }

  // ════════════════════════════════════════════════════════════
  // HOST SETUP (before room created)
  // ════════════════════════════════════════════════════════════
  if (isHostFlow && (status === 'idle' || status === 'connecting' || status === 'error')) {
    return (
      <Screen>
        <BackBtn onClick={goBack} />
        <h1 className="text-2xl sm:text-3xl font-game-title text-gray-900 dark:text-white">Host a Game</h1>
        <div className="w-full space-y-4" style={{ maxWidth: 400 }}>
          <Field label="Your Name">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" maxLength={20} autoFocus
              className="input-base" onKeyDown={e => { if (e.key === 'Enter') createRoom(); }} />
          </Field>
          <Field label="Turn Timer">
            <select value={timer} onChange={e => setTimer(Number(e.target.value))} className="input-base">
              <option value={30}>30 seconds</option><option value={45}>45 seconds</option>
              <option value={60}>60 seconds</option><option value={90}>90 seconds</option>
            </select>
          </Field>
          <Field label="Number of Teams">
            <div className="flex gap-2">
              {[2, 3, 4].map(n => (
                <button key={n} onClick={() => setNumTeams(n)}
                  className={`flex-1 py-3 rounded-xl font-bold font-game-ui cursor-pointer transition-all ${numTeams === n ? 'bg-violet-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                  style={{ minHeight: 48 }}>{n}</button>
              ))}
            </div>
          </Field>
          <Button size="xl" disabled={!name.trim() || status === 'connecting'} className="w-full" onClick={createRoom}>
            {status === 'connecting' ? 'Connecting...' : 'Create Room'}
          </Button>
          {error && <p className="text-red-500 text-sm text-center font-game-ui">{error}</p>}
        </div>
      </Screen>
    );
  }

  // ════════════════════════════════════════════════════════════
  // JOIN FORM (player, before joined)
  // ════════════════════════════════════════════════════════════
  if (!isHostFlow && (status === 'idle' || status === 'connecting' || status === 'error')) {
    return (
      <Screen>
        <BackBtn onClick={goBack} />
        <h1 className="text-2xl sm:text-3xl font-game-title text-gray-900 dark:text-white">Join a Game</h1>
        <div className="w-full space-y-4" style={{ maxWidth: 400 }}>
          <Field label="Your Name">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" maxLength={20} autoFocus
              className="input-base" onKeyDown={e => { if (e.key === 'Enter') joinRoom(); }} />
          </Field>
          <Field label="Room Code">
            <input type="text" value={codeInput} onChange={e => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="4-digit code" maxLength={4} inputMode="numeric"
              className="input-base text-center tracking-[0.5em] font-bold"
              style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)' }}
              onKeyDown={e => { if (e.key === 'Enter') joinRoom(); }} />
          </Field>
          <Button size="xl" disabled={!name.trim() || codeInput.length !== 4 || status === 'connecting'} className="w-full" onClick={joinRoom}>
            {status === 'connecting' ? 'Connecting...' : 'Join Game'}
          </Button>
          {error && <p className="text-red-500 text-sm text-center font-game-ui">{error}</p>}
        </div>
      </Screen>
    );
  }

  // ════════════════════════════════════════════════════════════
  // PLAYER WAITING LOBBY
  // ════════════════════════════════════════════════════════════
  if (!isHost) {
    const myTeam = teams.find(t => t.playerIds.includes(myId || ''));
    return (
      <Screen>
        <BackBtn onClick={goBack} label="Leave Room" />
        <h1 className="text-2xl font-game-title text-gray-900 dark:text-white">You're in! 🎉</h1>
        <p className="text-gray-500 dark:text-gray-400 font-game-ui">
          Room <span className="font-bold text-gray-900 dark:text-white tracking-widest" style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)' }}>{roomCode}</span>
        </p>
        {myTeam && <div className="px-4 py-2 rounded-xl text-sm font-bold text-white font-game-ui" style={{ backgroundColor: myTeam.color }}>{myTeam.name}</div>}
        <PlayerList players={players} myId={myId} />
        <div className="text-center space-y-2 mt-2">
          <div className="animate-pulse text-3xl">⏳</div>
          <p className="text-gray-500 dark:text-gray-400 font-game-ui">
            {teams.length > 0 ? 'Waiting for host to start...' : 'Waiting for host to set up teams...'}
          </p>
        </div>
      </Screen>
    );
  }

  // ════════════════════════════════════════════════════════════
  // HOST TEAM ASSIGNMENT
  // ════════════════════════════════════════════════════════════
  if (showTeams) {
    const allAssigned = teams.length >= 2 && teams.every(t => t.playerIds.length > 0)
      && players.every(p => teams.some(t => t.playerIds.includes(p.id)));
    const unassigned = players.filter(p => !teams.some(t => t.playerIds.includes(p.id)));

    return (
      <Screen>
        <BackBtn onClick={() => setShowTeams(false)} label="Back to Lobby" />
        <h2 className="text-2xl font-game-title text-gray-900 dark:text-white">Assign Teams</h2>
        <Button variant="secondary" size="md" onClick={() => mpAutoAssign()}>🔀 Auto-Assign</Button>

        {teams.length > 0 && (
          <div className="grid grid-cols-2 gap-3 w-full" style={{ maxWidth: 480 }}>
            {teams.map(team => {
              const tp = players.filter(p => team.playerIds.includes(p.id));
              return (
                <div key={team.id} className="rounded-xl p-4 border-2" style={{ borderColor: team.color, background: team.color + '10' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: team.color }} />
                    <span className="font-bold text-gray-900 dark:text-white font-game-ui">{team.name}</span>
                  </div>
                  {tp.length > 0 ? tp.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-game-ui">{p.name}</span>
                      <button onClick={() => {
                        const updated = teams.map(t => ({ name: t.name, color: t.color, playerIds: t.playerIds.filter(id => id !== p.id) }));
                        mpAssignTeams(updated);
                      }} className="text-xs text-red-400 hover:text-red-600 cursor-pointer">✕</button>
                    </div>
                  )) : <p className="text-xs text-gray-400 italic font-game-ui">Empty</p>}
                </div>
              );
            })}
          </div>
        )}

        {unassigned.length > 0 && (
          <div className="w-full space-y-2" style={{ maxWidth: 480 }}>
            <p className="text-xs text-amber-500 font-game-ui text-center">Assign these players:</p>
            {unassigned.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="flex-1 font-game-ui text-gray-900 dark:text-white" style={{ fontSize: '1rem' }}>{p.name}</span>
                <select onChange={e => {
                  const idx = Number(e.target.value);
                  const updated = teams.map((t, i) => ({ name: t.name, color: t.color, playerIds: i === idx ? [...t.playerIds.filter(id => id !== p.id), p.id] : t.playerIds.filter(id => id !== p.id) }));
                  mpAssignTeams(updated);
                }} defaultValue="" className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-game-ui" style={{ minHeight: 48, fontSize: 16 }}>
                  <option value="" disabled>Pick team</option>
                  {teams.map((t, i) => <option key={t.id} value={i}>{t.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}

        <Button size="xl" onClick={startGame} disabled={!allAssigned} className="w-full" style={{ maxWidth: 400 }}>
          ▶ Start Game
        </Button>
        {!allAssigned && teams.length > 0 && <p className="text-xs text-gray-400 text-center font-game-ui">Assign all players first</p>}
      </Screen>
    );
  }

  // ════════════════════════════════════════════════════════════
  // HOST LOBBY (room created, waiting for players)
  // ════════════════════════════════════════════════════════════
  return (
    <Screen>
      <BackBtn onClick={goBack} label="Leave Room" />

      <p className="text-xs text-gray-400 uppercase tracking-widest font-bold font-game-ui">Share this with your players</p>
      <div className="text-center">
        <div className="font-game-title font-black tracking-[0.3em] text-gray-900 dark:text-white"
          style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)' }}>
          {roomCode}
        </div>
      </div>
      <button onClick={copy}
        className="px-5 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer font-game-ui"
        style={{ minHeight: 48, fontSize: 16 }}>
        {copied ? '✓ Copied!' : '📋 Copy Join Link'}
      </button>

      <PlayerList players={players} myId={myId} isHost onKick={mpKick} />

      <Button size="xl" onClick={() => setShowTeams(true)} disabled={players.length < 2} className="w-full" style={{ maxWidth: 400 }}>
        Assign Teams
      </Button>
      {players.length < 2 && <p className="text-xs text-gray-400 text-center font-game-ui animate-pulse">Waiting for players to join...</p>}
    </Screen>
  );
}

// ── Shared components ───────────────────────────────────────────

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-5"
      style={{ maxWidth: 800, margin: '0 auto' }}>
      {children}
    </motion.div>
  );
}

function BackBtn({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return <button onClick={onClick} className="fixed top-4 left-4 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer font-game-ui z-10" style={{ minHeight: 48, display: 'flex', alignItems: 'center' }}>← {label}</button>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 font-game-ui">{label}</label>
      {children}
    </div>
  );
}

function PlayerList({ players, myId, isHost, onKick }: { players: any[]; myId: string | null; isHost?: boolean; onKick?: (id: string) => void }) {
  return (
    <div className="w-full space-y-2" style={{ maxWidth: 400 }}>
      <p className="text-sm text-gray-400 font-game-ui text-center font-bold">Players joined ({players.length})</p>
      <AnimatePresence>
        {players.map(p => (
          <motion.div key={p.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50" style={{ minHeight: 52 }}>
            <div className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
            <span className="flex-1 font-semibold text-gray-900 dark:text-white font-game-ui" style={{ fontSize: '1rem' }}>
              {p.name}{p.id === myId ? ' (You)' : ''}{p.isHost ? ' — Host' : ''}
            </span>
            {p.isHost && <span className="text-xs text-violet-500 font-bold">👑</span>}
            {isHost && !p.isHost && onKick && (
              <button onClick={() => onKick(p.id)} className="text-xs text-red-400 hover:text-red-600 cursor-pointer" style={{ minHeight: 48, padding: '0 8px' }}>Kick</button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
