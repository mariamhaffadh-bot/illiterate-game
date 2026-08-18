import { create } from 'zustand';

function getWsUrl(): string {
  const isDev = window.location.port === '5173';
  if (isDev) return 'ws://localhost:3000';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
}

export interface MPPlayer { id: string; name: string; isHost: boolean; color: string }
export interface MPTeam { id: string; name: string; color: string; score: number; playerIds: string[]; currentExplainerIndex: number }

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
  wsStatus: 'closed' | 'connecting' | 'open';
  status: 'idle' | 'connecting' | 'lobby' | 'playing' | 'disconnected' | 'error';
  errorMsg: string | null;
  roomCode: string | null;
  playerId: string | null;
  players: MPPlayer[];
  isHost: boolean;
  teams: MPTeam[];
  gameState: MPGameState | null;
}

export const useMPStore = create<Store>(() => ({
  wsStatus: 'closed',
  status: 'idle', errorMsg: null, roomCode: null, playerId: null,
  players: [], isHost: false, teams: [], gameState: null,
}));

// ── Module-level WebSocket with auto-reconnect ──────────────────

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let intentionalClose = false;
let pendingMessages: string[] = [];

function send(msg: object) {
  const payload = JSON.stringify(msg);
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(payload);
  } else {
    // Queue message to send after reconnect
    pendingMessages.push(payload);
  }
}

function flushPending() {
  while (pendingMessages.length > 0 && ws?.readyState === WebSocket.OPEN) {
    ws.send(pendingMessages.shift()!);
  }
}

function onMsg(data: string) {
  let msg: any;
  try { msg = JSON.parse(data); } catch { return; }
  const set = useMPStore.setState;
  switch (msg.type) {
    case 'room_created': set({ status: 'lobby', roomCode: msg.roomCode, playerId: msg.playerId, players: msg.players, isHost: true, errorMsg: null }); break;
    case 'room_joined': set({ status: 'lobby', roomCode: msg.roomCode, playerId: msg.playerId, players: msg.players, isHost: false, errorMsg: null }); break;
    case 'player_joined': case 'player_left': set({ players: msg.players }); break;
    case 'teams_updated': set({ teams: msg.teams }); break;
    case 'game_started': case 'game_update': set({ status: 'playing', gameState: msg.gameState }); break;
    case 'turn_summary': set(s => ({ gameState: s.gameState ? { ...s.gameState, ...msg.summary, phase: 'turnSummary' as const } : null })); break;
    case 'game_over': set(s => ({ gameState: s.gameState ? { ...s.gameState, phase: 'gameOver' as const, teams: msg.finalScores || s.gameState.teams } : null })); break;
    case 'error': set({ status: 'error', errorMsg: msg.message }); break;
    case 'host_left': set({ status: 'disconnected', errorMsg: 'Host left the room' }); break;
    case 'kicked': set({ status: 'error', errorMsg: 'You were removed from the room', roomCode: null, players: [] }); break;
  }
}

function connectWs(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws?.readyState === WebSocket.OPEN) { resolve(); return; }

    // Clean up any existing connection
    if (ws) { try { ws.close(); } catch {} }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

    intentionalClose = false;
    const url = getWsUrl();
    console.log('[WS] Connecting to:', url);
    useMPStore.setState({ wsStatus: 'connecting', status: 'connecting' });

    const socket = new WebSocket(url);
    ws = socket;

    socket.onopen = () => {
      console.log('[WS] Connected');
      useMPStore.setState({ wsStatus: 'open' });
      flushPending();
      resolve();
    };

    socket.onmessage = (e) => onMsg(e.data);

    socket.onclose = (event) => {
      console.log('[WS] Closed. Code:', event.code, 'Clean:', event.wasClean);
      ws = null;
      useMPStore.setState({ wsStatus: 'closed' });

      if (intentionalClose) return;

      const s = useMPStore.getState();
      if (s.status === 'idle' || s.status === 'error') return;

      // Auto-reconnect
      console.log('[WS] Will reconnect in 2s...');
      useMPStore.setState({ status: 'disconnected', errorMsg: 'Reconnecting...' });
      reconnectTimer = setTimeout(() => {
        const current = useMPStore.getState();
        if (current.status === 'idle' || current.status === 'error') return;
        console.log('[WS] Reconnecting...');
        connectWs().catch(() => {});
      }, 2000);
    };

    socket.onerror = (err) => {
      console.error('[WS] Error:', err);
      // Don't reject here — onclose will fire and handle reconnect
      // Only reject if we haven't opened yet
      if (socket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket connection failed'));
      }
    };
  });
}

// ── Public actions ──────────────────────────────────────────────

export async function mpCreateRoom(hostName: string, categories: string[], timer: number, numTeams: number, wordPools: Record<string, string[]>) {
  try {
    await connectWs();
    console.log('[MP] Sending create_room, wordPools size:', JSON.stringify(wordPools).length, 'bytes');
    send({ type: 'create_room', hostName, categories, timerSeconds: timer, numTeams, wordPools });
  } catch (err) {
    console.error('[MP] Failed to connect:', err);
    useMPStore.setState({ status: 'error', errorMsg: 'Could not connect to server. Please try again.' });
  }
}

export async function mpJoinRoom(code: string, name: string) {
  useMPStore.setState({ errorMsg: null });
  try {
    await connectWs();
    send({ type: 'join_room', roomCode: code, playerName: name });
  } catch {
    useMPStore.setState({ status: 'error', errorMsg: 'Could not connect to server. Please try again.' });
  }
}

export function mpAutoAssign() { send({ type: 'auto_assign' }); }
export function mpAssignTeams(teams: { name: string; color: string; playerIds: string[] }[]) { send({ type: 'assign_teams', teams }); }
export function mpStartGame() { send({ type: 'start_game' }); }
export function mpCorrect() { send({ type: 'correct' }); }
export function mpSkip() { send({ type: 'skip' }); }
export function mpKick(id: string) { send({ type: 'kick_player', playerId: id }); }

export function mpDisconnect() {
  intentionalClose = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  pendingMessages = [];
  ws?.close();
  ws = null;
  useMPStore.setState({
    wsStatus: 'closed', status: 'idle', errorMsg: null, roomCode: null,
    playerId: null, players: [], isHost: false, teams: [], gameState: null,
  });
}
