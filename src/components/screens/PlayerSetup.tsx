import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { Button } from '../ui/Button';
import { PlayerBadge } from '../ui/PlayerBadge';

export function PlayerSetup() {
  const [name, setName] = useState('');
  const players = useGameStore((s) => s.players);
  const addPlayer = useGameStore((s) => s.addPlayer);
  const removePlayer = useGameStore((s) => s.removePlayer);
  const setPhase = useGameStore((s) => s.setPhase);
  const createTeams = useGameStore((s) => s.createTeams);
  const goHome = useGameStore((s) => s.goHome);

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addPlayer(trimmed);
    setName('');
  };

  const canContinue = players.length >= 3;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="min-h-[100dvh] flex flex-col p-6 max-w-lg mx-auto w-full"
    >
      <div className="pt-8 pb-6">
        <button onClick={goHome} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-6 inline-flex items-center gap-1 cursor-pointer">
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Add Players</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">You need at least 3 players to start</p>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Enter player name..."
          maxLength={20}
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-base"
          autoFocus
        />
        <Button onClick={handleAdd} disabled={!name.trim()} size="md">Add</Button>
      </div>

      <div className="flex-1">
        <div className="flex flex-wrap gap-2">
          <AnimatePresence mode="popLayout">
            {players.map((player) => (
              <PlayerBadge key={player.id} name={player.name} color={player.color} onRemove={() => removePlayer(player.id)} />
            ))}
          </AnimatePresence>
        </div>
        {players.length > 0 && players.length < 3 && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-amber-500 mt-4">
            Add {3 - players.length} more player{3 - players.length !== 1 ? 's' : ''} to continue
          </motion.p>
        )}
      </div>

      <div className="py-6 flex justify-between items-center">
        <span className="text-sm text-gray-400 tabular-nums">{players.length} player{players.length !== 1 ? 's' : ''}</span>
        <Button
          onClick={() => {
            createTeams(Math.min(Math.floor(players.length / 2), 2));
            setPhase('team_setup');
          }}
          disabled={!canContinue}
          size="lg"
        >
          Set Up Teams →
        </Button>
      </div>
    </motion.div>
  );
}
