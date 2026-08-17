import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useMPStore, mpCreateRoom, mpJoinRoom, mpAutoAssign, mpAssignTeams, mpStartGame, mpKick, mpDisconnect } from '../../store/multiplayerStore';
import { Button } from '../ui/Button';
import { PlayerBadge } from '../ui/PlayerBadge';
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
  // HOST TEAM ASSIGNMENT — mirrors Pass & Play TeamSetup
  // ════════════════════════════════════════════════════════════
  if (showTeams) {
    const assignedIds = new Set(teams.flatMap(t => t.playerIds));
    const unassigned = players.filter(p => !assignedIds.has(p.id));
    const allAssigned = unassigned.length === 0 && teams.length >= 2 && teams.every(t => t.playerIds.length > 0);

    const moveToTeam = (playerId: string, teamId: string) => {
      const updated = teams.map(t => ({
        name: t.name, color: t.color,
        playerIds: t.id === teamId
          ? [...t.playerIds.filter(id => id !== playerId), playerId]
          : t.playerIds.filter(id => id !== playerId),
      }));
      mpAssignTeams(updated);
    };

    const removeFromTeam = (playerId: string) => {
      const updated = teams.map(t => ({ name: t.name, color: t.color, playerIds: t.playerIds.filter(id => id !== playerId) }));
      mpAssignTeams(updated);
    };

    return (
      <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
        className="min-h-[100dvh] flex flex-col p-6 w-full" style={{ maxWidth: 800, margin: '0 auto' }}>

        <div className="pt-8 pb-6">
          <button onClick={() => setShowTeams(false)}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-6 inline-flex items-center gap-1 cursor-pointer font-game-ui"
            style={{ minHeight: 48 }}>← Back to Lobby</button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-game-title">Create Teams</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 font-game-ui">Assign players to teams</p>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 mb-6 items-center">
          <Button variant="secondary" size="sm" onClick={() => mpAutoAssign()}>🔀 Shuffle & Auto-assign</Button>
        </div>

        {/* Unassigned players */}
        <AnimatePresence>
          {unassigned.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-6">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 font-game-ui">Unassigned ({unassigned.length})</p>
              <div className="flex flex-wrap gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                {unassigned.map(p => (
                  <PlayerBadge key={p.id} name={p.name} color={p.color} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Team cards — mirrors Pass & Play exactly */}
        <div className="flex-1 grid gap-4 sm:grid-cols-2">
          {teams.map((team, idx) => {
            const tc = TEAM_COLORS[idx % TEAM_COLORS.length];
            const teamPlayers = team.playerIds
              .map(pid => players.find(p => p.id === pid))
              .filter(Boolean);

            return (
              <motion.div key={team.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border-2 p-4"
                style={{ borderColor: tc.mid, backgroundColor: tc.light + '20' }}>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tc.bg }} />
                    <span className="text-sm font-bold text-gray-900 dark:text-white font-game-ui">{team.name}</span>
                  </div>
                </div>

                {/* Players in this team */}
                <div className="min-h-[40px] space-y-1.5">
                  <AnimatePresence mode="popLayout">
                    {teamPlayers.map(p => (
                      <PlayerBadge key={p!.id} name={p!.name} color={p!.color} size="sm"
                        onRemove={() => removeFromTeam(p!.id)} />
                    ))}
                  </AnimatePresence>
                  {teamPlayers.length === 0 && (
                    <p className="text-xs text-gray-400 italic py-2 font-game-ui">No players yet</p>
                  )}
                </div>

                {/* Tap to add unassigned players */}
                {unassigned.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
                    <p className="text-xs text-gray-400 mb-1.5 font-game-ui">Tap to add:</p>
                    <div className="flex flex-wrap gap-1">
                      {unassigned.map(p => (
                        <button key={p.id} onClick={() => moveToTeam(p.id, team.id)}
                          className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer font-game-ui"
                          style={{ minHeight: 32 }}>
                          + {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="text-sm text-gray-400 font-game-ui">
            {allAssigned ? 'All players assigned ✓' : `${unassigned.length} unassigned`}
          </span>
          <Button onClick={startGame} disabled={!allAssigned} size="lg" className="w-full sm:w-auto">
            ▶ Start Game
          </Button>
        </div>
      </motion.div>
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
