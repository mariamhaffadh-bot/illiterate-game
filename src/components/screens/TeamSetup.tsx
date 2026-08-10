import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { Button } from '../ui/Button';
import { PlayerBadge } from '../ui/PlayerBadge';
import { TEAM_COLORS, GAME_PIECES } from '../../types';

export function TeamSetup() {
  const players = useGameStore((s) => s.players);
  const teams = useGameStore((s) => s.teams);
  const setPhase = useGameStore((s) => s.setPhase);
  const createTeams = useGameStore((s) => s.createTeams);
  const autoAssign = useGameStore((s) => s.autoAssign);
  const movePlayerToTeam = useGameStore((s) => s.movePlayerToTeam);
  const addTeam = useGameStore((s) => s.addTeam);
  const removeTeam = useGameStore((s) => s.removeTeam);
  const updateTeamName = useGameStore((s) => s.updateTeamName);
  const setTeamPiece = useGameStore((s) => s.setTeamPiece);
  const removePlayerFromTeam = useGameStore((s) => s.removePlayerFromTeam);

  const assignedPlayerIds = new Set(teams.flatMap((t) => t.playerIds));
  const unassignedPlayers = players.filter((p) => !assignedPlayerIds.has(p.id));
  const usedPieceIds = new Set(teams.map((t) => t.pieceId));

  const allAssigned = unassignedPlayers.length === 0;
  const allTeamsHavePlayers = teams.every((t) => t.playerIds.length > 0);
  const allTeamsHaveUniquePieces = new Set(teams.map((t) => t.pieceId)).size === teams.length;
  const canContinue = allAssigned && allTeamsHavePlayers && teams.length >= 2 && allTeamsHaveUniquePieces;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="min-h-[100dvh] flex flex-col p-6 max-w-3xl mx-auto w-full"
    >
      <div className="pt-8 pb-6">
        <button onClick={() => setPhase('player_setup')} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-6 inline-flex items-center gap-1 cursor-pointer">
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Teams</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Assign players and choose your game pieces</p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex items-center gap-2 mr-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">Teams:</span>
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => createTeams(n)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                teams.length === n
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              {n}
            </button>
          ))}
          {teams.length <= 4 && (
            <button onClick={addTeam} className="w-9 h-9 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors cursor-pointer">
              +
            </button>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={autoAssign}>Shuffle & Auto-assign</Button>
      </div>

      {/* Unassigned players */}
      <AnimatePresence>
        {unassignedPlayers.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Unassigned ({unassignedPlayers.length})</p>
            <div className="flex flex-wrap gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              {unassignedPlayers.map((p) => (
                <PlayerBadge key={p.id} name={p.name} color={p.color} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Teams */}
      <div className="flex-1 grid gap-4 sm:grid-cols-2">
        {teams.map((team, idx) => {
          const tc = TEAM_COLORS[idx % TEAM_COLORS.length];
          const teamPlayers = team.playerIds
            .map((pid) => players.find((p) => p.id === pid))
            .filter(Boolean) as typeof players;
          const currentPiece = GAME_PIECES.find((p) => p.id === team.pieceId);

          return (
            <motion.div
              key={team.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border-2 p-4"
              style={{ borderColor: tc.mid, backgroundColor: tc.light + '20' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tc.bg }} />
                  <input
                    type="text"
                    value={team.name}
                    onChange={(e) => updateTeamName(team.id, e.target.value)}
                    className="text-sm font-bold bg-transparent border-none outline-none text-gray-900 dark:text-white w-32"
                    maxLength={20}
                  />
                </div>
                {teams.length > 2 && (
                  <button onClick={() => removeTeam(team.id)} className="text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer">Remove</button>
                )}
              </div>

              {/* Piece selector */}
              <div className="mb-3">
                <p className="text-xs text-gray-400 mb-1.5">Game piece:</p>
                <div className="flex flex-wrap gap-1">
                  {GAME_PIECES.map((piece) => {
                    const isSelected = team.pieceId === piece.id;
                    const isUsedByOther = usedPieceIds.has(piece.id) && !isSelected;
                    return (
                      <button
                        key={piece.id}
                        onClick={() => !isUsedByOther && setTeamPiece(team.id, piece.id)}
                        disabled={isUsedByOther}
                        className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-offset-1 bg-white dark:bg-gray-700 shadow-sm'
                            : isUsedByOther
                            ? 'opacity-20 cursor-not-allowed'
                            : 'hover:bg-white/60 dark:hover:bg-gray-700/60'
                        }`}
                        style={isSelected ? { outlineColor: tc.bg } : undefined}
                        title={piece.name}
                      >
                        {piece.emoji}
                      </button>
                    );
                  })}
                </div>
                {currentPiece && (
                  <p className="text-xs text-gray-500 mt-1">{currentPiece.emoji} {currentPiece.name}</p>
                )}
              </div>

              {/* Players */}
              <div className="min-h-[40px] space-y-1.5">
                <AnimatePresence mode="popLayout">
                  {teamPlayers.map((p) => (
                    <PlayerBadge key={p.id} name={p.name} color={p.color} size="sm" onRemove={() => removePlayerFromTeam(p.id)} />
                  ))}
                </AnimatePresence>
                {teamPlayers.length === 0 && (
                  <p className="text-xs text-gray-400 italic py-2">No players yet</p>
                )}
              </div>

              {/* Assign buttons */}
              {unassignedPlayers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
                  <p className="text-xs text-gray-400 mb-1.5">Tap to add:</p>
                  <div className="flex flex-wrap gap-1">
                    {unassignedPlayers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => movePlayerToTeam(p.id, team.id)}
                        className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                      >
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

      <div className="py-6 flex justify-between items-center">
        <span className="text-sm text-gray-400">
          {allAssigned ? 'All players assigned' : `${unassignedPlayers.length} unassigned`}
        </span>
        <Button onClick={() => setPhase('game_settings')} disabled={!canContinue} size="lg">
          Game Settings →
        </Button>
      </div>
    </motion.div>
  );
}
