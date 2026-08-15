/**
 * Multiplayer state store + WebSocket connection manager.
 * Uses module-level WebSocket so the connection survives component remounts.
 */
import { create } from 'zustand';
import type { MultiplayerPlayer } from '../types';

function getWsUrl(): string {
  const isDev = window.location.port === '5173';
  if (isDev) return 'ws://localhost:3000';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
}

// ── Game state shape broadcast by server ────────────────────────

export interface MPGameState {
  currentPlayerIndex: number;
  currentPlayerId: string;
  currentCategory: string;
  currentWord: string | null; // null for non-active players (server strips it)
  scores: Record<string, number>;
  players: { id: string; name: string; color: string }[];
  timerSeconds: number;
  turnStartedAt: number;
  phase: 'playing' | 'turnEnd' | 'gameOver';
  round: number;
  turnScore: number;
}

// ── Store shape ─────────────────────────────────────────────────

interface MultiplayerStore {
  status: 'idle' | 'connecting' | 'lobby' | 'playing' | 'disconnected' | 'not_found' | 'kicked';
  roomCode: string | null;
  playerId: string | null;
  players: MultiplayerPlayer[];
  isHost: boolean;
  gameState: MPGameState | null;
}

export const useMultiplayerStore = create<MultiplayerStore>(() => ({
  status: 'idle',
  roomCode: null,
  playerId: null,
  players: [],
  isHost: false,
  gameState: null,
}));

// ── Module-level WebSocket ──────────────────────────────────────

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function send(msg: object) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function handleMessage(data: string) {
  let msg: any;
  try { msg = JSON.parse(data); } catch { return; }
  const set = useMultiplayerStore.setState;

  switch (msg.type) {
    case 'room_created':
      set({ status: 'lobby', roomCode: msg.roomCode, playerId: msg.playerId, players: msg.players, isHost: true });
      break;
    case 'room_joined':
      set({ status: 'lobby', roomCode: msg.roomCode, playerId: msg.playerId, players: msg.players, isHost: false });
      break;
    case 'player_joined':
    case 'player_left':
      set({ players: msg.players });
      break;
    case 'room_not_found':
    case 'room_already_started':
    case 'room_full':
      set({ status: 'not_found' });
      break;
    case 'kicked':
      set({ status: 'kicked', roomCode: null, playerId: null, players: [] });
      break;
    case 'host_left':
      set({ status: 'disconnected' });
      break;
    case 'game_started':
      set({ status: 'playing', gameState: msg.gameState });
      break;
    case 'game_update':
      set({ gameState: msg.gameState });
      break;
    case 'game_ended':
      set({ status: 'lobby', gameState: null });
      break;
  }
}

function connect(): Promise<void> {
  return new Promise((resolve) => {
    if (ws?.readyState === WebSocket.OPEN) { resolve(); return; }
    useMultiplayerStore.setState({ status: 'connecting' });

    ws = new WebSocket(getWsUrl());
    ws.onopen = () => resolve();
    ws.onmessage = (e) => handleMessage(e.data);
    ws.onclose = () => {
      ws = null;
      const s = useMultiplayerStore.getState();
      if (s.status !== 'idle' && s.status !== 'kicked' && s.status !== 'not_found') {
        useMultiplayerStore.setState({ status: 'disconnected' });
      }
    };
    ws.onerror = () => ws?.close();
  });
}

// ── Public actions ──────────────────────────────────────────────

export async function createRoom(playerName: string) {
  await connect();
  send({ type: 'create_room', playerName });
}

export async function joinRoom(roomCode: string, playerName: string) {
  await connect();
  send({ type: 'join_room', roomCode, playerName });
}

export function startGame(wordPools: Record<string, string[]>, categories: string[], timerSeconds: number) {
  send({ type: 'start_game', wordPools, categories, timerSeconds });
}

export function sendCorrect() {
  send({ type: 'correct' });
}

export function sendSkip() {
  send({ type: 'skip' });
}

export function sendEndTurn() {
  send({ type: 'end_turn' });
}

export function kickPlayer(playerId: string) {
  send({ type: 'kick_player', playerId });
}

export function endGame() {
  send({ type: 'end_game' });
}

export function disconnectMultiplayer() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  ws?.close();
  ws = null;
  useMultiplayerStore.setState({
    status: 'idle', roomCode: null, playerId: null,
    players: [], isHost: false, gameState: null,
  });
}
