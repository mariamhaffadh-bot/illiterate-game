import { create } from 'zustand';

function getWsUrl(): string {
  const isDev = window.location.port === '5173';
  if (isDev) return 'ws://localhost:3000';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
}

// ── Types ───────────────────────────────────────────────────────

export interface MPPlayer {
  id: string;
  name: string;
  isHost: boolean;
  color: string;
}

export interface MPTeam {
  id: string;
  name: string;
  color: string;
  score: number;
  playerIds: string[];
  currentExplainerIndex: number;
}

export interface MPGameState {
  phase: 'playing' | 'turnSummary' | 'gameOver';
  teams: MPTeam[];
  players: { id: string; name: string; color: string; teamId: string | null }[];
  currentTeamIndex: number;
  currentExplainerId: string;
  currentCategory: string;
  currentWord: string | null;
  timerSeconds: number;
  turnStartedAt: number;
  turnScore: number;
  round: number;
  lastTurnTeamName?: string;
  lastTurnScore?: number;
  nextExplainerName?: string;
  nextTeamName?: string;
}

interface Store {
  status: 'idle' | 'connecting' | 'lobby' | 'teamSetup' | 'playing' | 'disconnected' | 'error';
  errorMsg: string | null;
  roomCode: string | null;
  playerId: string | null;
  players: MPPlayer[];
  isHost: boolean;
  teams: MPTeam[];
  gameState: MPGameState | null;
}

export const useMPStore = create<Store>(() => ({
  status: 'idle', errorMsg: null, roomCode: null, playerId: null,
  players: [], isHost: false, teams: [], gameState: null,
}));

// ── WebSocket (module-level, survives remounts) ─────────────────

let ws: WebSocket | null = null;

function send(msg: object) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function onMsg(data: string) {
  let msg: any;
  try { msg = JSON.parse(data); } catch { return; }
  const set = useMPStore.setState;

  switch (msg.type) {
    case 'room_created':
      set({ status: 'lobby', roomCode: msg.roomCode, playerId: msg.playerId, players: msg.players, isHost: true, errorMsg: null });
      break;
    case 'room_joined':
      set({ status: 'lobby', roomCode: msg.roomCode, playerId: msg.playerId, players: msg.players, isHost: false, errorMsg: null });
      break;
    case 'player_joined':
    case 'player_left':
      set({ players: msg.players });
      break;
    case 'teams_set':
      set({ teams: msg.teams });
      break;
    case 'game_started':
    case 'game_update':
      set({ status: 'playing', gameState: msg.gameState });
      break;
    case 'turn_end':
      set(s => ({ gameState: s.gameState ? { ...s.gameState, ...msg.summary, phase: 'turnSummary' as const } : null }));
      break;
    case 'game_over':
      set(s => ({ gameState: s.gameState ? { ...s.gameState, phase: 'gameOver' as const, teams: msg.finalScores || s.gameState.teams } : null }));
      break;
    case 'join_error':
    case 'room_error':
      set({ status: 'error', errorMsg: msg.message });
      break;
    case 'host_left':
      set({ status: 'disconnected', errorMsg: 'Host left the room' });
      break;
    case 'kicked':
      set({ status: 'error', errorMsg: 'You were removed from the room', roomCode: null, players: [] });
      break;
  }
}

function ensureConnected(): Promise<void> {
  return new Promise((resolve) => {
    if (ws?.readyState === WebSocket.OPEN) { resolve(); return; }
    useMPStore.setState({ status: 'connecting' });
    ws = new WebSocket(getWsUrl());
    ws.onopen = () => resolve();
    ws.onmessage = (e) => onMsg(e.data);
    ws.onclose = () => {
      ws = null;
      const s = useMPStore.getState();
      if (s.status !== 'idle' && s.status !== 'error') {
        useMPStore.setState({ status: 'disconnected', errorMsg: 'Connection lost' });
      }
    };
    ws.onerror = () => ws?.close();
  });
}

// ── Public actions ──────────────────────────────────────────────

export async function mpCreateRoom(hostName: string, categories: string[], timerSeconds: number, numTeams: number, wordPools: Record<string, string[]>) {
  await ensureConnected();
  send({ type: 'create_room', hostName, categories, timerSeconds, numTeams, wordPools });
}

export async function mpJoinRoom(roomCode: string, playerName: string) {
  useMPStore.setState({ errorMsg: null });
  await ensureConnected();
  send({ type: 'join_room', roomCode, playerName });
}

export function mpAutoAssign() { send({ type: 'auto_assign' }); }
export function mpAssignTeams(teams: { name: string; color: string; playerIds: string[] }[]) { send({ type: 'assign_teams', teams }); }
export function mpStartGame() { send({ type: 'start_game' }); }
export function mpCorrect() { send({ type: 'correct' }); }
export function mpSkip() { send({ type: 'skip' }); }
export function mpKick(playerId: string) { send({ type: 'kick_player', playerId }); }

export function mpDisconnect() {
  ws?.close(); ws = null;
  useMPStore.setState({ status: 'idle', errorMsg: null, roomCode: null, playerId: null, players: [], isHost: false, teams: [], gameState: null });
}

export function mpSetStatus(status: Store['status']) { useMPStore.setState({ status }); }
