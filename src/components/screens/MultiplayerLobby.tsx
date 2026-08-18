import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useMPStore, mpCreateRoom, mpJoinRoom, mpAssignTeams, mpStartGame, mpKick, mpDisconnect } from '../../store/multiplayerStore';
import { Button } from '../ui/Button';
import { allCards } from '../../data/cards';
import { BASE_CATEGORIES, TEAM_COLORS } from '../../types';

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


  // ════════════════════════════════════════════════════════════
  // ERROR / DISCONNECTED
  // ════════════════════════════════════════════════════════════
  if (status === 'disconnected') {
    const isReconnecting = error === 'Reconnecting...';
    return (
      <Screen>
        <div className="text-5xl">{isReconnecting ? '🔄' : '😵'}</div>
        <p className="text-lg text-gray-500 font-game-ui">{isReconnecting ? 'Reconnecting...' : (error || 'Connection lost')}</p>
        {isReconnecting && <p className="text-sm text-gray-400 font-game-ui animate-pulse">Trying to reconnect automatically</p>}
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
    const hasTeams = teams.length > 0 && teams.some(t => t.playerIds.length > 0);
    return (
      <Screen>
        <BackBtn onClick={goBack} label="Leave Room" />
        <h1 className="text-2xl font-game-title text-gray-900 dark:text-white">
          {hasTeams ? 'Teams are set! 🎉' : 'You\'re in! 🎉'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 font-game-ui">
          Room <span className="font-bold text-gray-900 dark:text-white tracking-widest" style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)' }}>{roomCode}</span>
        </p>

        {/* Show teams if assigned */}
        {hasTeams ? (
          <div className="w-full space-y-3" style={{ maxWidth: 400 }}>
            {teams.filter(t => t.playerIds.length > 0).map((t, idx) => {
              const tc = TEAM_COLORS[idx % TEAM_COLORS.length];
              const names = t.playerIds.map(id => {
                const p = players.find(pl => pl.id === id);
                return p ? (p.id === myId ? `${p.name} (You)` : p.name) : 'Unknown';
              });
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: tc.light + '30', borderLeft: `4px solid ${tc.bg}` }}>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tc.bg }} />
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 dark:text-white font-game-ui text-sm">{t.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-game-ui">{names.join(', ')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <PlayerList players={players} myId={myId} />
        )}

        <div className="text-center space-y-2 mt-2">
          <div className="animate-pulse text-3xl">⏳</div>
          <p className="text-gray-500 dark:text-gray-400 font-game-ui">
            {hasTeams ? 'Waiting for host to start...' : 'Host is setting up teams...'}
          </p>
        </div>
      </Screen>
    );
  }

  // ════════════════════════════════════════════════════════════
  // HOST TEAM ASSIGNMENT — pure local state, no server round-trips
  // ════════════════════════════════════════════════════════════
  if (showTeams) {
    return (
      <TeamAssignment
        players={players}
        numTeams={numTeams}
        myId={myId}
        onBack={() => setShowTeams(false)}
        onStartGame={(builtTeams) => {
          // Send teams to server and start the game
          mpAssignTeams(builtTeams.map(t => ({ name: t.name, color: t.color, playerIds: t.players.map((p: any) => p.id) })));
          // Small delay to let server process teams, then start
          setTimeout(() => mpStartGame(), 200);
        }}
      />
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
  const ws = useMPStore((s) => s.wsStatus);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-5"
      style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Connection indicator */}
      <div className="fixed top-4 right-4 flex items-center gap-1.5 text-xs font-game-ui z-10" style={{ opacity: 0.6 }}>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ws === 'open' ? '#22C55E' : ws === 'connecting' ? '#EAB308' : '#EF4444' }} />
        <span className="text-gray-500 dark:text-gray-400">{ws === 'open' ? 'Connected' : ws === 'connecting' ? 'Connecting...' : 'Offline'}</span>
      </div>
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

// ── Team Assignment — pure local state, no server round-trips ───

const TA_COLORS = ['#C0392B', '#2471A3', '#1E8449', '#D4A017', '#7D3C98', '#117A65'];

function TeamAssignment({ players, numTeams, myId, onBack, onStartGame }: {
  players: any[];
  numTeams: number;
  myId: string | null;
  onBack: () => void;
  onStartGame: (teams: { id: string; name: string; color: string; players: any[] }[]) => void;
}) {
  const [assignments, setAssignments] = useState<Record<string, number | undefined>>({});

  const buildTeams = () => {
    const teams = Array.from({ length: numTeams }, (_, i) => ({
      id: `team${i + 1}`,
      name: `Team ${i + 1}`,
      color: TA_COLORS[i % TA_COLORS.length],
      players: [] as any[],
    }));
    players.forEach(p => {
      const idx = assignments[p.id];
      if (idx !== undefined) teams[idx].players.push(p);
    });
    return teams;
  };

  const autoAssign = () => {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const next: Record<string, number> = {};
    shuffled.forEach((p, i) => { next[p.id] = i % numTeams; });
    setAssignments(next);
  };

  const allAssigned = players.every(p => assignments[p.id] !== undefined);
  const unassignedCount = players.filter(p => assignments[p.id] === undefined).length;

  const handleStart = () => {
    if (!allAssigned) return;
    onStartGame(buildTeams());
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 20, fontFamily: 'Nunito, sans-serif' }}>
      <button onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: '#888', marginBottom: 16, minHeight: 48, display: 'flex', alignItems: 'center' }}>
        ← Back to Lobby
      </button>

      <h2 style={{ textAlign: 'center', marginBottom: 8, fontSize: '1.5rem', fontWeight: 800 }} className="text-gray-900 dark:text-white">
        Assign Teams
      </h2>

      {unassignedCount > 0 && (
        <p style={{ textAlign: 'center', color: '#e74c3c', marginBottom: 16, fontWeight: 'bold' }}>
          {unassignedCount} player{unassignedCount > 1 ? 's' : ''} not yet assigned
        </p>
      )}
      {allAssigned && (
        <p style={{ textAlign: 'center', color: '#1E8449', marginBottom: 16, fontWeight: 'bold' }}>
          All players assigned ✓
        </p>
      )}

      {/* Player assignment list */}
      <div style={{ marginBottom: 24 }}>
        {players.map(p => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', marginBottom: 10, borderRadius: 10, minHeight: 52,
            background: assignments[p.id] !== undefined ? TA_COLORS[assignments[p.id]!] + '22' : '#fff3cd',
            border: `2px solid ${assignments[p.id] !== undefined ? TA_COLORS[assignments[p.id]!] : '#e74c3c'}`,
          }}>
            <span style={{ fontWeight: 'bold', fontSize: '1rem' }} className="text-gray-900 dark:text-white">
              {p.name}{p.id === myId ? ' (You)' : ''}{p.isHost ? ' 👑' : ''}
            </span>
            <select
              value={assignments[p.id] ?? ''}
              onChange={e => {
                const val = e.target.value;
                setAssignments(prev => ({ ...prev, [p.id]: val === '' ? undefined : Number(val) }));
              }}
              style={{ padding: '8px 12px', borderRadius: 8, border: '2px solid #ccc', fontSize: '1rem', fontFamily: 'Nunito, sans-serif', minWidth: 120, minHeight: 48, cursor: 'pointer' }}
            >
              <option value="">— Pick team —</option>
              {Array.from({ length: numTeams }, (_, i) => (
                <option key={i} value={i}>Team {i + 1}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Team preview */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {Array.from({ length: numTeams }, (_, i) => {
          const tp = players.filter(p => assignments[p.id] === i);
          return (
            <div key={i} style={{
              flex: '1 1 140px', background: TA_COLORS[i] + '33', border: `3px solid ${TA_COLORS[i]}`,
              borderRadius: 12, padding: 12, minWidth: 140,
            }}>
              <div style={{ fontWeight: 'bold', color: TA_COLORS[i], marginBottom: 8, fontSize: '1rem' }}>Team {i + 1}</div>
              {tp.length === 0
                ? <div style={{ color: '#999', fontSize: '0.85rem' }}>Nobody yet</div>
                : tp.map(p => <div key={p.id} style={{ fontSize: '0.9rem', padding: '2px 0' }} className="text-gray-800 dark:text-gray-200">{p.name}</div>)
              }
            </div>
          );
        })}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
        <button onClick={autoAssign} style={{
          padding: 14, borderRadius: 10, border: '2px solid #2471A3', background: 'white',
          color: '#2471A3', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Nunito, sans-serif', minHeight: 52,
        }}>
          🔀 Auto-Assign Teams
        </button>
        <button onClick={handleStart} disabled={!allAssigned} style={{
          padding: 16, borderRadius: 10, border: 'none',
          background: allAssigned ? '#1E8449' : '#ccc', color: 'white',
          fontSize: '1.1rem', fontWeight: 'bold', cursor: allAssigned ? 'pointer' : 'not-allowed',
          fontFamily: 'Nunito, sans-serif', minHeight: 52,
        }}>
          {allAssigned ? '▶ Start Game' : `Assign all players first (${unassignedCount} left)`}
        </button>
      </div>
    </div>
  );
}
